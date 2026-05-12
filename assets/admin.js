/* ============================================================
   Bildiri Sistemi — Yönetici Paneli mantığı
   ============================================================ */
(function () {
  'use strict';

  const B = window.Bildiri;
  const E = window.BildiriExport;

  // ---- Modül-seviyesi state (TDZ'den korunmak için en üstte) ----
  // Bu değişkenler `let`/`const` ile tanımlı; ilk çağrılan fonksiyonların onlara
  // erişebilmesi için tüm fonksiyon tanımlarından önce burada yer alır.
  let cachedFiltered = [];
  const SECTION_LABELS = {
    contact: 'İletişim Bilgileri',
    authors: 'Yazarlar',
    affiliations: 'Kurumlar',
    title: 'Bildiri Başlığı',
    abstract: 'Özet',
    declaration: 'Beyan'
  };
  const DEFAULT_SECTION_ORDER = ['contact', 'authors', 'affiliations', 'title', 'abstract', 'declaration'];

  // ---- Genel ----
  const settings = B.getSettings();
  document.getElementById('loginEvent').textContent = settings.eventShort;
  document.getElementById('appBrand').textContent = 'Yönetici Paneli';
  document.getElementById('appEvent').textContent = settings.eventTitle;

  // ---- Login ----
  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');

  function showApp() {
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    const s = B.getSession();
    document.getElementById('userBadge').textContent = (s.name || s.username) + ' · ' + roleLabel(s.role);
    activateTab('overview');
    renderAll();
  }

  function showLogin() {
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    document.getElementById('user').focus();
  }

  function roleLabel(r) {
    return ({ super: 'Süper Admin', editor: 'Editör', reviewer: 'Hakem' })[r] || r;
  }

  // Mevcut oturum varsa direkt aç
  if (B.getSession()) {
    showApp();
  } else {
    showLogin();
  }

  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value;
    const err = document.getElementById('loginErr');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const oldText = submitBtn.textContent;
    submitBtn.textContent = 'Giriş yapılıyor...';
    try {
      const user = await Promise.resolve(B.authenticate(u, p));
      if (!user || !user.username) {
        err.textContent = 'Kullanıcı adı veya şifre hatalı. (Supabase modundaysanız e-posta ile giriş yapın.)';
        err.classList.remove('hidden');
        return;
      }
      err.classList.add('hidden');
      B.setSession(user);
      // Supabase modunda cache'in yüklenmesini bekle
      if (window.BildiriBackend && window.BildiriBackend.mode === 'supabase' && window.BildiriBackend.refresh) {
        try { await window.BildiriBackend.refresh(); } catch (e) { console.warn(e); }
      }
      showApp();
    } catch (ex) {
      console.error('Login error:', ex);
      err.textContent = 'Giriş sırasında hata: ' + (ex.message || ex);
      err.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try { await Promise.resolve(B.clearSession()); } catch (e) {}
    document.getElementById('pass').value = '';
    showLogin();
  });

  // ---- Tab yönetimi ----
  Array.prototype.forEach.call(document.querySelectorAll('.tab-btn'), function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.getAttribute('data-tab')); });
  });

  function activateTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab-btn'), function (b) {
      const on = b.getAttribute('data-tab') === name;
      b.classList.toggle('text-zinc-900', on);
      b.classList.toggle('border-lime-500', on);
      b.classList.toggle('text-zinc-500', !on);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab-pane'), function (p) {
      p.classList.add('hidden');
    });
    document.getElementById('tab-' + name).classList.remove('hidden');
    if (name === 'overview') renderOverview();
    if (name === 'submissions') renderSubmissions();
    if (name === 'admins') renderAdmins();
    if (name === 'settings') renderSettings();
    if (name === 'audit') renderAudit();
  }

  // ---- Genel render ----
  function renderAll() {
    renderOverview();
    renderSubmissions();
    renderAdmins();
    renderSettings();
    renderAudit();
  }

  // ---- Overview ----
  function renderOverview() {
    const subs = B.listSubmissions();
    document.getElementById('ov-total').textContent = subs.length;
    document.getElementById('ov-pending').textContent = subs.filter(function (s) { return s.status === 'pending'; }).length;
    document.getElementById('ov-accepted').textContent = subs.filter(function (s) { return s.status === 'accepted'; }).length;
    document.getElementById('ov-rejected').textContent = subs.filter(function (s) { return s.status === 'rejected'; }).length;
    // Tür dağılımı (varsa)
    const ovTypeBreak = document.getElementById('ov-type-breakdown');
    if (ovTypeBreak) {
      const posters = subs.filter(function (s) { return (s.type || 'poster') === 'poster'; }).length;
      const talks = subs.filter(function (s) { return s.type === 'talk'; }).length;
      ovTypeBreak.innerHTML = '📋 Poster: <strong>' + posters + '</strong>  •  🎤 Konuşma: <strong>' + talks + '</strong>';
    }

    const recent = subs.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 6);
    const wrap = document.getElementById('ov-recent');
    if (!recent.length) {
      wrap.innerHTML = '<div class="py-6 text-center text-sm text-zinc-500">Henüz başvuru yok.</div>';
      return;
    }
    wrap.innerHTML = recent.map(function (s) {
      const c = B.statusColor(s.status);
      const tp = s.type || 'poster';
      const tc = B.typeBadgeColor(tp);
      return '<div class="py-3 flex items-start gap-3">' +
        '<div class="flex flex-col gap-1">' +
          '<span class="badge ' + c + ' ring-1">' + B.statusLabel(s.status) + '</span>' +
          '<span class="badge ' + tc + ' ring-1 text-[10px]">' + B.typeIcon(tp) + ' ' + B.typeLabel(tp) + '</span>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-sm font-medium text-zinc-900 truncate">' + B.escapeHtml(s.title || '(başlıksız)') + '</div>' +
          '<div class="text-xs text-zinc-500 truncate">' + B.escapeHtml(s.id) + ' · ' + B.escapeHtml(s.contactName || '-') + ' · ' + B.formatDate(s.createdAt) + '</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-open="' + s.id + '">Aç</button>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-open')); });
    });
  }

  document.getElementById('qa-export-xlsx').addEventListener('click', function () {
    E.exportAllXlsx(B.listSubmissions(), 'tum_bildiriler.xlsx');
  });
  document.getElementById('qa-export-accepted-xlsx').addEventListener('click', function () {
    E.exportAllXlsx(B.listSubmissions().filter(function (s) { return s.status === 'accepted'; }), 'kabul_edilen_bildiriler.xlsx');
  });
  document.getElementById('qa-print-list').addEventListener('click', function () {
    activateTab('submissions');
    setTimeout(function () { window.print(); }, 100);
  });
  document.getElementById('qa-export-book-accepted').addEventListener('click', function () {
    const accepted = B.listSubmissions().filter(function (s) { return s.status === 'accepted'; });
    if (!accepted.length) {
      if (!confirm('Henüz kabul edilmiş bildiri yok. Yine de boş bir kitap iskeleti üretilsin mi?')) return;
    }
    accepted.sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    E.exportBookDocx(accepted);
    showToast('DOCX kitap hazırlanıyor (düz metin)...', 'ok');
  });
  document.getElementById('qa-export-book-all').addEventListener('click', function () {
    if (!confirm('Tüm bildiriler (beklemede ve ret olanlar dahil) taslak kitaba dahil edilecek. Devam edilsin mi?')) return;
    const all = B.listSubmissions().slice().sort(function (a, b) {
      return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
    });
    E.exportBookDocx(all);
    showToast('Taslak DOCX kitap hazırlanıyor...', 'ok');
  });
  // PDF — kabul edilenler
  document.getElementById('qa-export-book-pdf').addEventListener('click', function () {
    const accepted = B.listSubmissions().filter(function (s) { return s.status === 'accepted'; });
    if (!accepted.length) {
      alert('Henüz kabul edilmiş bildiri yok. Önce bildirileri kabul edin.');
      return;
    }
    accepted.sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    showToast('PDF kitap hazırlanıyor — büyük kitaplarda 30 saniyeyi bulabilir...', 'ok');
    E.exportBookPdf(accepted);
  });
  // PDF — tümü (taslak)
  document.getElementById('qa-export-book-pdf-all').addEventListener('click', function () {
    if (!confirm('Tüm bildiriler taslak PDF kitaba dahil edilecek. Devam edilsin mi?')) return;
    const all = B.listSubmissions().slice().sort(function (a, b) {
      return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
    });
    if (!all.length) { alert('Henüz bildiri yok.'); return; }
    showToast('Taslak PDF kitap hazırlanıyor...', 'ok');
    E.exportBookPdf(all, { title: 'Birleşik Kitap (Taslak)' });
  });

  // YENİ: Poster Kitabı (sadece poster + accepted)
  const posterBtn = document.getElementById('qa-export-poster-pdf');
  if (posterBtn) posterBtn.addEventListener('click', function () {
    const list = B.listSubmissions().filter(function (s) {
      return s.status === 'accepted' && (s.type || 'poster') === 'poster';
    });
    if (!list.length) { alert('Henüz kabul edilmiş poster bildirisi yok.'); return; }
    list.sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    showToast('Poster Kitabı PDF hazırlanıyor...', 'ok');
    E.exportBookPdf(list, { title: 'Poster Bildirileri Kitabı', kind: 'poster' });
  });

  // YENİ: Konuşma Özetleri Kitabı (sadece talk + accepted)
  const talkBtn = document.getElementById('qa-export-talk-pdf');
  if (talkBtn) talkBtn.addEventListener('click', function () {
    const list = B.listSubmissions().filter(function (s) {
      return s.status === 'accepted' && s.type === 'talk';
    });
    if (!list.length) { alert('Henüz kabul edilmiş konuşma özeti yok.'); return; }
    list.sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    showToast('Konuşma Özetleri Kitabı PDF hazırlanıyor...', 'ok');
    E.exportBookPdf(list, { title: 'Konuşma Özetleri Kitabı', kind: 'talk' });
  });

  // YENİ: Birleşik (Poster önce, Talk sonra) — kabul edilenler
  const combinedBtn = document.getElementById('qa-export-combined-pdf');
  if (combinedBtn) combinedBtn.addEventListener('click', function () {
    const accepted = B.listSubmissions().filter(function (s) { return s.status === 'accepted'; });
    if (!accepted.length) { alert('Henüz kabul edilmiş bildiri yok.'); return; }
    const posters = accepted.filter(function (s) { return (s.type || 'poster') === 'poster'; })
      .sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    const talks = accepted.filter(function (s) { return s.type === 'talk'; })
      .sort(function (a, b) { return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }); });
    const ordered = posters.concat(talks);
    showToast('Birleşik kitap (Poster + Konuşma) PDF hazırlanıyor...', 'ok');
    E.exportBookPdf(ordered, { title: 'Bildiri ve Konuşma Özetleri Kitabı', kind: 'combined', posterCount: posters.length, talkCount: talks.length });
  });

  // ---- Submissions ----
  // (cachedFiltered yukarıda en üstte tanımlandı — TDZ'den korunmak için)

  function applyFilter() {
    const txt = (document.getElementById('filterText').value || '').toLocaleLowerCase('tr-TR').trim();
    const st = document.getElementById('filterStatus').value;
    const sort = document.getElementById('filterSort').value;
    const tp = (document.getElementById('filterType') && document.getElementById('filterType').value) || '';
    let list = B.listSubmissions();
    if (st) list = list.filter(function (s) { return s.status === st; });
    if (tp) list = list.filter(function (s) { return (s.type || 'poster') === tp; });
    if (txt) {
      list = list.filter(function (s) {
        const blob = [
          s.title, s.contactName, s.contactEmail, (s.keywords || []).join(' '),
          (s.authors || []).map(function (a) { return a.fullName; }).join(' '),
          (s.affiliations || []).join(' '),
          s.id, s.abstract
        ].join(' ').toLocaleLowerCase('tr-TR');
        return blob.indexOf(txt) !== -1;
      });
    }
    list.sort(function (a, b) {
      if (sort === 'old') return a.createdAt.localeCompare(b.createdAt);
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '', 'tr-TR');
      return b.createdAt.localeCompare(a.createdAt);
    });
    cachedFiltered = list;
    return list;
  }

  function renderSubmissions() {
    const list = applyFilter();
    const tbody = document.getElementById('subTbody');
    const empty = document.getElementById('emptyState');
    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      tbody.innerHTML = list.map(function (s) {
        const c = B.statusColor(s.status);
        const tp = s.type || 'poster';
        const tc = B.typeBadgeColor(tp);
        const ti = B.typeIcon(tp);
        const tl = B.typeLabel(tp);
        const presenter = (s.authors || []).find(function (a) { return a.presenter; });
        const presName = presenter ? presenter.fullName : ((s.authors || [])[0] || {}).fullName || '-';
        return '<tr>' +
          '<td><div class="font-mono text-xs text-zinc-500">' + B.escapeHtml(s.id) + '</div>' +
            '<div class="mt-1"><span class="badge ' + tc + ' ring-1" title="' + tl + '">' + ti + ' ' + tl + '</span></div>' +
          '</td>' +
          '<td>' +
            '<div class="font-medium text-zinc-900 line-clamp-2">' + B.escapeHtml(s.title || '(başlıksız)') + '</div>' +
            '<div class="text-xs text-zinc-500 mt-0.5">Sunan: ' + B.escapeHtml(presName) + ' · ' + B.escapeHtml(s.contactEmail || '-') + '</div>' +
          '</td>' +
          '<td><span class="badge ' + c + ' ring-1">' + B.statusLabel(s.status) + '</span></td>' +
          '<td><div class="text-sm">' + B.formatDate(s.createdAt) + '</div></td>' +
          '<td class="text-right">' +
            '<div class="flex justify-end gap-1">' +
              '<button class="btn btn-ghost btn-sm" data-open="' + s.id + '">Aç</button>' +
              '<button class="btn btn-ghost btn-sm" data-pdf="' + s.id + '" title="PDF — formatlar, tablo, görseller korunur">PDF</button>' +
              '<button class="btn btn-ghost btn-sm" data-docx="' + s.id + '" title="DOCX — düz metin">DOCX</button>' +
              '<button class="btn btn-ghost btn-sm" data-quick-accept="' + s.id + '" title="Hızlı kabul">✓</button>' +
              '<button class="btn btn-ghost btn-sm" data-quick-reject="' + s.id + '" title="Hızlı ret">✕</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
      bindRowActions(tbody);
    }
    document.getElementById('subCountInfo').textContent = list.length + ' / ' + B.listSubmissions().length + ' bildiri gösteriliyor';
  }

  function bindRowActions(tbody) {
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-open')); });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-docx]'), function (b) {
      b.addEventListener('click', function () {
        const s = B.getSubmission(b.getAttribute('data-docx'));
        if (s) E.exportSubmissionDocx(s);
      });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-pdf]'), function (b) {
      b.addEventListener('click', function () {
        const s = B.getSubmission(b.getAttribute('data-pdf'));
        if (s) {
          showToast('PDF hazırlanıyor...', 'ok');
          E.exportSubmissionPdf(s);
        }
      });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-quick-accept]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Bu bildiriyi KABUL etmek istediğinize emin misiniz?')) return;
        const id = b.getAttribute('data-quick-accept');
        B.changeStatus(id, 'accepted', '', actor());
        renderAll();
        showToast('Bildiri kabul edildi.', 'ok');
      });
    });
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-quick-reject]'), function (b) {
      b.addEventListener('click', function () {
        const note = prompt('Ret nedeni (opsiyonel):') || '';
        const id = b.getAttribute('data-quick-reject');
        B.changeStatus(id, 'rejected', note, actor());
        renderAll();
        showToast('Bildiri reddedildi.', 'err');
      });
    });
  }

  ['filterText', 'filterStatus', 'filterType', 'filterSort'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', renderSubmissions);
    el.addEventListener('change', renderSubmissions);
  });
  document.getElementById('clearFilters').addEventListener('click', function () {
    document.getElementById('filterText').value = '';
    document.getElementById('filterStatus').value = '';
    const ft = document.getElementById('filterType'); if (ft) ft.value = '';
    document.getElementById('filterSort').value = 'new';
    renderSubmissions();
  });
  document.getElementById('exportFilteredXlsx').addEventListener('click', function () {
    if (!cachedFiltered.length) { showToast('Liste boş.', 'err'); return; }
    E.exportAllXlsx(cachedFiltered, 'filtreli_bildiriler.xlsx');
  });
  document.getElementById('exportFilteredBook').addEventListener('click', function () {
    if (!cachedFiltered.length) { showToast('Liste boş.', 'err'); return; }
    const sorted = cachedFiltered.slice().sort(function (a, b) {
      return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
    });
    E.exportBookDocx(sorted);
    showToast('DOCX kitap (düz metin) hazırlanıyor...', 'ok');
  });
  document.getElementById('exportFilteredBookPdf').addEventListener('click', function () {
    if (!cachedFiltered.length) { showToast('Liste boş.', 'err'); return; }
    const sorted = cachedFiltered.slice().sort(function (a, b) {
      return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
    });
    showToast('Filtreli PDF kitap hazırlanıyor...', 'ok');
    E.exportBookPdf(sorted);
  });

  // Cmd/Ctrl+F → arama kutusuna odakla
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && !appScreen.classList.contains('hidden')) {
      const tab = document.querySelector('.tab-btn[data-tab="submissions"]');
      const input = document.getElementById('filterText');
      if (input && document.getElementById('tab-submissions') && !document.getElementById('tab-submissions').classList.contains('hidden')) {
        e.preventDefault();
        input.focus(); input.select();
      }
    }
  });

  // ---- Detay modal ----
  function openDetail(id) {
    const s = B.getSubmission(id);
    if (!s) return;
    const body = document.getElementById('detailBody');
    const c = B.statusColor(s.status);
    const authors = (s.authors || []).map(function (a) {
      const sup = a.affiliationIndex ? '<sup class="text-zinc-500">' + B.escapeHtml(a.affiliationIndex) + '</sup>' : '';
      return B.escapeHtml(a.fullName) + sup + (a.presenter ? ' <span class="text-lime-700 text-xs font-semibold">(Sunan)</span>' : '');
    }).join(', ');
    const affs = (s.affiliations || []).map(function (af, i) { return (i + 1) + '. ' + B.escapeHtml(af); }).join('<br>');
    const wc = (window.BildiriEditor ? window.BildiriEditor.countWords(s.abstract || '') : B.countWords(s.abstract || ''));
    const safeAbstract = window.BildiriSanitize ? window.BildiriSanitize.sanitize(s.abstract || '') : B.escapeHtml(s.abstract || '');

    body.innerHTML =
      '<div class="flex items-center gap-3 flex-wrap">' +
        '<span class="badge ' + c + ' ring-1">' + B.statusLabel(s.status) + '</span>' +
        '<span class="font-mono text-xs text-zinc-500">' + B.escapeHtml(s.id) + '</span>' +
        '<span class="text-xs text-zinc-500">' + B.formatDate(s.createdAt) + '</span>' +
      '</div>' +
      '<h2 class="text-2xl font-semibold tracking-tight mt-3">' + B.escapeHtml(s.title || '') + '</h2>' +
      '<div class="text-sm text-zinc-700 mt-2">' + authors + '</div>' +
      '<div class="text-xs text-zinc-500 mt-1">' + affs + '</div>' +

      '<div class="grid sm:grid-cols-2 gap-3 mt-5 text-sm">' +
        '<div class="card-soft p-3"><div class="text-xs text-zinc-500">İletişim</div><div class="font-medium">' + B.escapeHtml(s.contactName || '-') + '</div><div class="text-zinc-600">' + B.escapeHtml(s.contactEmail || '-') + '</div><div class="text-zinc-600">' + B.escapeHtml(s.contactPhone || '-') + '</div></div>' +
        '<div class="card-soft p-3"><div class="text-xs text-zinc-500">Anahtar Kelimeler</div><div>' + B.escapeHtml((s.keywords || []).join(', ')) + '</div><div class="text-xs text-zinc-500 mt-2">Özet: ' + wc + ' kelime</div></div>' +
      '</div>' +

      '<div class="mt-5">' +
        '<div class="flex items-center justify-between mb-2">' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Özet (Önizleme)</div>' +
          '<button id="d-edit-abstract" class="btn btn-ghost btn-sm">✏️ Düzenle</button>' +
        '</div>' +
        '<div id="d-abstract-preview" class="card-soft p-4 prose">' + safeAbstract + '</div>' +
        '<div id="d-abstract-edit" class="hidden">' +
          '<div class="editor-wrap"><textarea id="d-abstract-editor"></textarea></div>' +
          '<div class="text-xs text-zinc-500 mt-2">Word/Google Docs\'tan tablo, görsel ve formatlı metni doğrudan yapıştırabilirsiniz.</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid sm:grid-cols-3 gap-3 mt-4">' +
        '<div>' +
          '<label class="label">Tür</label>' +
          '<select id="d-type" class="field">' +
            ['poster','talk'].map(function (k) {
              const cur = s.type || 'poster';
              return '<option value="' + k + '" ' + (cur === k ? 'selected' : '') + '>' + B.typeIcon(k) + ' ' + B.typeLabel(k) + (k === 'talk' ? ' Özeti' : ' Bildirisi') + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="label">Durum</label>' +
          '<select id="d-status" class="field">' +
            ['pending','accepted','rejected','revision'].map(function (k) {
              return '<option value="' + k + '" ' + (s.status === k ? 'selected' : '') + '>' + B.statusLabel(k) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label class="label">Yönetici Notu</label>' +
          '<input id="d-note" class="field" value="' + B.escapeHtml(s.statusNote || '') + '" placeholder="Karar nedeni / yazara not" />' +
        '</div>' +
      '</div>' +

      '<div class="mt-5">' +
        '<div class="text-xs text-zinc-500 mb-1">Başlık (düzenlenebilir)</div>' +
        '<input id="d-title" class="field" value="' + B.escapeHtml(s.title || '') + '" />' +
      '</div>' +

      '<div class="flex flex-wrap items-center justify-between gap-3 mt-6">' +
        '<button class="btn btn-danger" id="d-delete">Sil</button>' +
        '<div class="flex gap-2 flex-wrap">' +
          '<button class="btn btn-ghost" id="d-pdf" title="PDF — tablolar/görseller/formatlar korunur">📄 PDF</button>' +
          '<button class="btn btn-ghost" id="d-docx" title="DOCX — düz metin">DOCX</button>' +
          '<button class="btn btn-ghost" data-close>İptal</button>' +
          '<button class="btn btn-accent" id="d-save">Kaydet</button>' +
        '</div>' +
      '</div>';

    document.getElementById('detailModal').classList.remove('hidden');

    // CKEditor instance — sadece "Düzenle" butonuna basıldığında başlatılır
    let detailEditor = null;
    let currentAbstractHtml = s.abstract || '';

    document.getElementById('d-edit-abstract').onclick = function () {
      document.getElementById('d-abstract-preview').classList.add('hidden');
      document.getElementById('d-abstract-edit').classList.remove('hidden');
      this.classList.add('hidden');
      if (!detailEditor && window.BildiriEditor && window.BildiriEditor.init) {
        window.BildiriEditor.init('d-abstract-editor', {
          placeholder: 'Bildiri içeriği...'
        }).then(function (ed) {
          detailEditor = ed;
          ed.setData(currentAbstractHtml);
        }).catch(function (err) {
          console.error(err);
          alert('Editör yüklenemedi: ' + (err.message || err));
        });
      }
    };

    document.getElementById('d-save').onclick = async function () {
      const newAbstract = detailEditor ? detailEditor.getData() : currentAbstractHtml;
      const cleanAbstract = window.BildiriSanitize ? window.BildiriSanitize.sanitize(newAbstract) : newAbstract;
      try {
        const typeSel = document.getElementById('d-type');
        const newType = typeSel ? (typeSel.value === 'talk' ? 'talk' : 'poster') : (s.type || 'poster');
        await Promise.resolve(B.updateSubmission(s.id, {
          title: document.getElementById('d-title').value.trim(),
          abstract: cleanAbstract,
          status: document.getElementById('d-status').value,
          statusNote: document.getElementById('d-note').value.trim(),
          type: newType
        }, actor()));
        if (detailEditor) { try { await detailEditor.destroy(); } catch (e) {} detailEditor = null; }
        closeModal();
        renderAll();
        showToast('Bildiri güncellendi.', 'ok');
      } catch (ex) {
        showToast(ex.message || 'Güncelleme başarısız.', 'err');
      }
    };
    document.getElementById('d-delete').onclick = async function () {
      if (!confirm('Bu bildiriyi tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
      await Promise.resolve(B.deleteSubmission(s.id, actor()));
      if (detailEditor) { try { await detailEditor.destroy(); } catch (e) {} detailEditor = null; }
      closeModal();
      renderAll();
      showToast('Bildiri silindi.', 'err');
    };
    document.getElementById('d-docx').onclick = function () { E.exportSubmissionDocx(s); };
    document.getElementById('d-pdf').onclick = function () {
      showToast('PDF hazırlanıyor...', 'ok');
      E.exportSubmissionPdf(s);
    };
  }

  function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { b.closest('.modal-backdrop').classList.add('hidden'); });
  });
  document.getElementById('detailModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  // ---- Adminler ----
  function renderAdmins() {
    const session = B.getSession();
    if (!session) return;
    const admins = B.listAdmins();
    const tbody = document.getElementById('adminTbody');
    tbody.innerHTML = admins.map(function (a) {
      const isMe = a.username === session.username;
      const canDelete = !isMe && session.role === 'super';
      return '<tr>' +
        '<td>' + B.escapeHtml(a.name || '-') + (isMe ? ' <span class="badge bg-lime-100 text-lime-800 ring-1 ring-lime-200">siz</span>' : '') + '</td>' +
        '<td><code class="text-xs">' + B.escapeHtml(a.username) + '</code></td>' +
        '<td>' + roleLabel(a.role) + '</td>' +
        '<td class="text-right">' +
          (canDelete ? '<button class="btn btn-danger btn-sm" data-rm-admin="' + a.username + '">Kaldır</button>' : '<span class="text-xs text-zinc-400">—</span>') +
        '</td>' +
      '</tr>';
    }).join('');
    Array.prototype.forEach.call(tbody.querySelectorAll('[data-rm-admin]'), function (b) {
      b.addEventListener('click', function () {
        const u = b.getAttribute('data-rm-admin');
        if (!confirm(u + ' yöneticisini silmek istediğinize emin misiniz?')) return;
        try {
          B.removeAdmin(u);
          renderAdmins();
          showToast('Yönetici silindi.', 'ok');
        } catch (e) { showToast(e.message, 'err'); }
      });
    });
  }

  document.getElementById('addAdminForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('aaName').value.trim();
    const user = document.getElementById('aaUser').value.trim();
    const pass = document.getElementById('aaPass').value;
    const role = document.getElementById('aaRole').value;
    const err = document.getElementById('addAdminErr');
    err.classList.add('hidden');
    try {
      B.addAdmin(user, pass, name, role);
      e.target.reset();
      renderAdmins();
      showToast('Yönetici eklendi.', 'ok');
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  });

  document.getElementById('changePassForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const session = B.getSession();
    const oldP = document.getElementById('cpOld').value;
    const newP = document.getElementById('cpNew').value;
    const err = document.getElementById('cpErr');
    err.classList.add('hidden');
    if (!B.authenticate(session.username, oldP)) {
      err.textContent = 'Mevcut şifre hatalı.';
      err.classList.remove('hidden');
      return;
    }
    B.changePassword(session.username, newP);
    e.target.reset();
    showToast('Şifreniz güncellendi.', 'ok');
  });

  // ---- Ayarlar ----
  // (SECTION_LABELS ve DEFAULT_SECTION_ORDER yukarıda en üstte tanımlı — TDZ koruması)

  function renderSectionOrderList(order) {
    const list = document.getElementById('sectionOrderList');
    if (!list) return;
    list.innerHTML = order.map(function (key, i) {
      return '<li class="flex items-center gap-3 card-soft p-3" data-key="' + key + '">' +
        '<span class="w-7 h-7 inline-flex items-center justify-center rounded-full bg-lime-100 text-lime-800 font-semibold text-sm">' + (i + 1) + '</span>' +
        '<span class="flex-1 text-sm font-medium">' + (SECTION_LABELS[key] || key) + '</span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-move="up" ' + (i === 0 ? 'disabled' : '') + ' title="Yukarı taşı">↑</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-move="down" ' + (i === order.length - 1 ? 'disabled' : '') + ' title="Aşağı taşı">↓</button>' +
      '</li>';
    }).join('');

    Array.prototype.forEach.call(list.querySelectorAll('[data-move]'), function (btn) {
      btn.addEventListener('click', function () {
        const li = btn.closest('li');
        const key = li.getAttribute('data-key');
        const cur = currentSectionOrder();
        const idx = cur.indexOf(key);
        if (btn.getAttribute('data-move') === 'up' && idx > 0) {
          const tmp = cur[idx - 1];
          cur[idx - 1] = cur[idx];
          cur[idx] = tmp;
        } else if (btn.getAttribute('data-move') === 'down' && idx < cur.length - 1) {
          const tmp = cur[idx + 1];
          cur[idx + 1] = cur[idx];
          cur[idx] = tmp;
        }
        renderSectionOrderList(cur);
      });
    });
  }

  function currentSectionOrder() {
    const list = document.getElementById('sectionOrderList');
    return Array.prototype.map.call(list.querySelectorAll('li'), function (li) {
      return li.getAttribute('data-key');
    });
  }

  function renderSettings() {
    const s = B.getSettings();
    document.getElementById('setEvent').value = s.eventTitle || '';
    document.getElementById('setShort').value = s.eventShort || '';
    document.getElementById('setOrg').value = s.organizer || '';
    document.getElementById('setLimit').value = s.wordLimit || 500;
    document.getElementById('setDeadline').value = (s.deadline || '').slice(0, 10);
    document.getElementById('setOpen').checked = !!s.submissionsOpen;
    document.getElementById('setRuleFormat').value = s.ruleFormatText || '';
    document.getElementById('setRuleContent').value = s.ruleContentText || '';
    const order = (s.formSectionsOrder && s.formSectionsOrder.length === DEFAULT_SECTION_ORDER.length)
      ? s.formSectionsOrder.slice()
      : DEFAULT_SECTION_ORDER.slice();
    renderSectionOrderList(order);
  }

  // Sıralama kaydet butonu
  document.getElementById('saveSectionOrder').addEventListener('click', async function () {
    const order = currentSectionOrder();
    try {
      await Promise.resolve(B.updateSettings({ formSectionsOrder: order }));
      showToast('Form sıralaması kaydedildi.', 'ok');
    } catch (e) {
      showToast(e.message || 'Sıralama kaydedilemedi.', 'err');
    }
  });
  document.getElementById('resetSectionOrder').addEventListener('click', function () {
    renderSectionOrderList(DEFAULT_SECTION_ORDER.slice());
    showToast('Varsayılan sıralamaya dönüldü. Kaydetmeyi unutmayın.', 'ok');
  });

  document.getElementById('settingsForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      await Promise.resolve(B.updateSettings({
        eventTitle: document.getElementById('setEvent').value.trim(),
        eventShort: document.getElementById('setShort').value.trim(),
        organizer: document.getElementById('setOrg').value.trim(),
        wordLimit: Math.max(100, Math.min(50000, parseInt(document.getElementById('setLimit').value, 10) || 5000)),
        deadline: document.getElementById('setDeadline').value,
        submissionsOpen: document.getElementById('setOpen').checked,
        ruleFormatText: document.getElementById('setRuleFormat').value,
        ruleContentText: document.getElementById('setRuleContent').value
      }));
      showToast('Ayarlar kaydedildi.', 'ok');
      document.getElementById('appEvent').textContent = B.getSettings().eventTitle;
    } catch (ex) {
      showToast(ex.message || 'Ayarlar kaydedilemedi.', 'err');
    }
  });

  document.getElementById('dataBackup').addEventListener('click', function () {
    const dump = {
      exportedAt: new Date().toISOString(),
      settings: B.getSettings(),
      submissions: B.listSubmissions(),
      admins: B.listAdmins().map(function (a) {
        // Şifre hash'lerini export'a dahil ediyoruz (geri yüklemek için)
        return a;
      }),
      audit: B.getAudit()
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const fname = 'bildiri_yedek_' + new Date().toISOString().slice(0, 10) + '.json';
    saveAs(blob, fname);
  });

  document.getElementById('dataRestore').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('Mevcut veriler üzerine yazılacak. Devam edilsin mi?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        if (data.submissions) localStorage.setItem('bildiri.submissions.v1', JSON.stringify(data.submissions));
        if (data.admins) localStorage.setItem('bildiri.admins.v1', JSON.stringify(data.admins));
        if (data.settings) localStorage.setItem('bildiri.settings.v1', JSON.stringify(data.settings));
        if (data.audit) localStorage.setItem('bildiri.audit.v1', JSON.stringify(data.audit));
        showToast('Yedek geri yüklendi.', 'ok');
        renderAll();
      } catch (err) {
        showToast('Geçersiz yedek dosyası.', 'err');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('dataWipe').addEventListener('click', function () {
    const yes = prompt('TÜM verileri silmek için "SİL" yazın:');
    if (yes !== 'SİL') return;
    ['bildiri.submissions.v1', 'bildiri.audit.v1'].forEach(function (k) { localStorage.removeItem(k); });
    showToast('Tüm bildiri verileri silindi.', 'err');
    renderAll();
  });

  // ---- Audit ----
  function renderAudit() {
    const log = B.getAudit().slice().reverse();
    const tbody = document.getElementById('auditTbody');
    if (!log.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-zinc-500 py-6 text-sm">Henüz işlem yok.</td></tr>';
      return;
    }
    tbody.innerHTML = log.slice(0, 200).map(function (e) {
      return '<tr>' +
        '<td><div class="text-sm">' + B.formatDate(e.ts) + '</div></td>' +
        '<td><div class="text-sm">' + B.escapeHtml(e.actor || '-') + '</div></td>' +
        '<td><span class="badge bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200">' + B.escapeHtml(e.action) + '</span></td>' +
        '<td><div class="text-sm font-mono">' + B.escapeHtml(e.target || '-') + '</div></td>' +
        '<td><div class="text-xs text-zinc-500">' + B.escapeHtml(e.extra || '') + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function actor() {
    const s = B.getSession();
    return s ? s.username : '-';
  }

  // ---- Supabase: veri yüklendiğinde UI'yi yenile ----
  document.addEventListener('bildiri:loaded', function () {
    if (!appScreen.classList.contains('hidden')) {
      renderAll();
    }
  });

  // ---- Toast ----
  function showToast(msg, kind) {
    const wrap = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 250);
    }, 3000);
  }
})();
