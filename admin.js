/* ============================================================
   Bildiri Sistemi — Yönetici Paneli mantığı
   ============================================================ */
(function () {
  'use strict';

  const B = window.Bildiri;
  const E = window.BildiriExport;

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

  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value;
    const user = B.authenticate(u, p);
    const err = document.getElementById('loginErr');
    if (!user) {
      err.textContent = 'Kullanıcı adı veya şifre hatalı.';
      err.classList.remove('hidden');
      return;
    }
    err.classList.add('hidden');
    B.setSession(user);
    showApp();
  });

  document.getElementById('logoutBtn').addEventListener('click', function () {
    B.clearSession();
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

    const recent = subs.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, 6);
    const wrap = document.getElementById('ov-recent');
    if (!recent.length) {
      wrap.innerHTML = '<div class="py-6 text-center text-sm text-zinc-500">Henüz başvuru yok.</div>';
      return;
    }
    wrap.innerHTML = recent.map(function (s) {
      const c = B.statusColor(s.status);
      return '<div class="py-3 flex items-start gap-3">' +
        '<span class="badge ' + c + ' ring-1">' + B.statusLabel(s.status) + '</span>' +
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

  // ---- Submissions ----
  let cachedFiltered = [];

  function applyFilter() {
    const txt = (document.getElementById('filterText').value || '').toLocaleLowerCase('tr-TR').trim();
    const st = document.getElementById('filterStatus').value;
    const sort = document.getElementById('filterSort').value;
    let list = B.listSubmissions();
    if (st) list = list.filter(function (s) { return s.status === st; });
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
        const presenter = (s.authors || []).find(function (a) { return a.presenter; });
        const presName = presenter ? presenter.fullName : ((s.authors || [])[0] || {}).fullName || '-';
        return '<tr>' +
          '<td><div class="font-mono text-xs text-zinc-500">' + B.escapeHtml(s.id) + '</div></td>' +
          '<td>' +
            '<div class="font-medium text-zinc-900 line-clamp-2">' + B.escapeHtml(s.title || '(başlıksız)') + '</div>' +
            '<div class="text-xs text-zinc-500 mt-0.5">Sunan: ' + B.escapeHtml(presName) + ' · ' + B.escapeHtml(s.contactEmail || '-') + '</div>' +
          '</td>' +
          '<td><span class="badge ' + c + ' ring-1">' + B.statusLabel(s.status) + '</span></td>' +
          '<td><div class="text-sm">' + B.formatDate(s.createdAt) + '</div></td>' +
          '<td class="text-right">' +
            '<div class="flex justify-end gap-1">' +
              '<button class="btn btn-ghost btn-sm" data-open="' + s.id + '">Aç</button>' +
              '<button class="btn btn-ghost btn-sm" data-docx="' + s.id + '">DOCX</button>' +
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

  ['filterText', 'filterStatus', 'filterSort'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderSubmissions);
    document.getElementById(id).addEventListener('change', renderSubmissions);
  });
  document.getElementById('clearFilters').addEventListener('click', function () {
    document.getElementById('filterText').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSort').value = 'new';
    renderSubmissions();
  });
  document.getElementById('exportFilteredXlsx').addEventListener('click', function () {
    if (!cachedFiltered.length) { showToast('Liste boş.', 'err'); return; }
    E.exportAllXlsx(cachedFiltered, 'filtreli_bildiriler.xlsx');
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
    const wc = B.countWords(s.abstract || '');

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
        '<div class="text-xs text-zinc-500 mb-1">Özet</div>' +
        '<textarea id="d-abstract" class="field" style="min-height:240px;">' + B.escapeHtml(s.abstract || '') + '</textarea>' +
      '</div>' +

      '<div class="grid sm:grid-cols-2 gap-3 mt-4">' +
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
        '<div class="flex gap-2">' +
          '<button class="btn btn-ghost" id="d-docx">Word olarak indir</button>' +
          '<button class="btn btn-ghost" data-close>İptal</button>' +
          '<button class="btn btn-accent" id="d-save">Kaydet</button>' +
        '</div>' +
      '</div>';

    document.getElementById('detailModal').classList.remove('hidden');

    document.getElementById('d-save').onclick = function () {
      B.updateSubmission(s.id, {
        title: document.getElementById('d-title').value.trim(),
        abstract: document.getElementById('d-abstract').value.trim(),
        status: document.getElementById('d-status').value,
        statusNote: document.getElementById('d-note').value.trim()
      }, actor());
      closeModal();
      renderAll();
      showToast('Bildiri güncellendi.', 'ok');
    };
    document.getElementById('d-delete').onclick = function () {
      if (!confirm('Bu bildiriyi tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
      B.deleteSubmission(s.id, actor());
      closeModal();
      renderAll();
      showToast('Bildiri silindi.', 'err');
    };
    document.getElementById('d-docx').onclick = function () { E.exportSubmissionDocx(s); };
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
  const SECTION_LABELS = {
    contact: 'İletişim Bilgileri',
    authors: 'Yazarlar',
    affiliations: 'Kurumlar',
    title: 'Bildiri Başlığı',
    abstract: 'Özet',
    declaration: 'Beyan'
  };
  const DEFAULT_SECTION_ORDER = ['contact', 'authors', 'affiliations', 'title', 'abstract', 'declaration'];

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
    document.getElementById('setLimit').value = s.wordLimit || 350;
    document.getElementById('setDeadline').value = (s.deadline || '').slice(0, 10);
    document.getElementById('setOpen').checked = !!s.submissionsOpen;
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

  document.getElementById('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    B.updateSettings({
      eventTitle: document.getElementById('setEvent').value.trim(),
      eventShort: document.getElementById('setShort').value.trim(),
      organizer: document.getElementById('setOrg').value.trim(),
      wordLimit: Math.max(100, Math.min(1000, parseInt(document.getElementById('setLimit').value, 10) || 350)),
      deadline: document.getElementById('setDeadline').value,
      submissionsOpen: document.getElementById('setOpen').checked
    });
    showToast('Ayarlar kaydedildi.', 'ok');
    document.getElementById('appEvent').textContent = B.getSettings().eventTitle;
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
