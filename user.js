/* ============================================================
   Bildiri Sistemi — Kullanıcı tarafı (index.html) mantığı
   ============================================================ */
(function () {
  'use strict';

  const B = window.Bildiri;
  const settings = B.getSettings();
  const DRAFT_KEY = 'bildiri.draft.v1';
  const DEFAULT_ORDER = ['contact', 'authors', 'affiliations', 'title', 'abstract', 'declaration'];

  // ---- Form bölüm sıralaması ----
  function applySectionOrder() {
    const s = B.getSettings();
    const order = (s.formSectionsOrder && s.formSectionsOrder.length === DEFAULT_ORDER.length)
      ? s.formSectionsOrder
      : DEFAULT_ORDER;
    const form = document.getElementById('submissionForm');
    if (!form) return;
    const sections = {};
    Array.prototype.forEach.call(form.querySelectorAll('.form-section'), function (sec) {
      sections[sec.getAttribute('data-section')] = sec;
    });
    // Sıraya göre yeniden ekle (mevcut tüm fieldset ve divider'ları kaldır)
    const dividers = form.querySelectorAll(':scope > .divider');
    Array.prototype.forEach.call(dividers, function (d) { d.remove(); });
    order.forEach(function (key, i) {
      const sec = sections[key];
      if (!sec) return;
      const legend = sec.querySelector('.section-legend');
      if (legend) {
        // Numaralandır
        const baseLabels = {
          contact: 'İletişim Bilgileri',
          authors: 'Yazarlar',
          affiliations: 'Kurumlar',
          title: 'Bildiri Başlığı',
          abstract: 'Özet',
          declaration: 'Beyan'
        };
        legend.textContent = (i + 1) + '. ' + (baseLabels[key] || key);
      }
      // Divider ekle (ilk bölüm hariç)
      if (i > 0) {
        const div = document.createElement('div');
        div.className = 'divider';
        form.insertBefore(div, document.querySelector('#submissionForm > .pt-2') || null);
        // İlk action satırından önce ekle
        const firstAction = form.querySelector(':scope > .flex.flex-col-reverse');
        form.insertBefore(div, firstAction);
      }
      // Action satırından önce
      const firstAction = form.querySelector(':scope > .flex.flex-col-reverse');
      form.insertBefore(sec, firstAction);
    });
  }
  applySectionOrder();
  document.addEventListener('bildiri:loaded', applySectionOrder);

  // ---- Hero / üst bilgiler ----
  document.getElementById('navBrand').textContent = settings.eventShort;
  document.getElementById('footerOrg').textContent = '© ' + settings.organizer;
  document.getElementById('kpiCount').textContent = B.listSubmissions().length;
  document.getElementById('kpiLimit').textContent = settings.wordLimit;
  document.getElementById('wordLimit').textContent = settings.wordLimit;
  if (settings.deadline) {
    const d = new Date(settings.deadline);
    document.getElementById('kpiDeadline').textContent = d.toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  // ---- Yazar ve Kurum kartları ----
  const authorList = document.getElementById('authorList');
  const affList = document.getElementById('affList');

  function authorRow(data) {
    data = data || {};
    const wrap = document.createElement('div');
    wrap.className = 'author-chip flex-wrap';
    wrap.innerHTML =
      '<input class="field flex-1 min-w-[200px]" placeholder="Ad Soyad" value="' + B.escapeHtml(data.fullName || '') + '" data-k="fullName" />' +
      '<input class="field w-20" placeholder="Kurum #" value="' + B.escapeHtml(data.affiliationIndex || '') + '" data-k="affiliationIndex" />' +
      '<label class="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" data-k="presenter" ' + (data.presenter ? 'checked' : '') + ' class="h-4 w-4 rounded border-zinc-300 text-lime-600 focus:ring-lime-500" />Sunan</label>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-rm>Kaldır</button>';
    wrap.querySelector('[data-rm]').addEventListener('click', function () {
      wrap.remove();
      saveDraft();
    });
    wrap.addEventListener('input', saveDraft);
    wrap.addEventListener('change', saveDraft);
    return wrap;
  }

  function affRow(data) {
    data = data || '';
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-2';
    wrap.innerHTML =
      '<span class="w-7 h-9 inline-flex items-center justify-center text-sm text-zinc-500"></span>' +
      '<input class="field flex-1" placeholder="Kurum / Bölüm / Şehir" value="' + B.escapeHtml(data) + '" data-k="aff" />' +
      '<button type="button" class="btn btn-ghost btn-sm" data-rm>Kaldır</button>';
    wrap.querySelector('[data-rm]').addEventListener('click', function () {
      wrap.remove();
      renumberAff();
      saveDraft();
    });
    wrap.addEventListener('input', saveDraft);
    return wrap;
  }

  function renumberAff() {
    Array.prototype.forEach.call(affList.children, function (row, i) {
      row.querySelector('span').textContent = (i + 1) + '.';
    });
  }

  document.getElementById('addAuthorBtn').addEventListener('click', function () {
    authorList.appendChild(authorRow());
  });
  document.getElementById('addAffBtn').addEventListener('click', function () {
    affList.appendChild(affRow());
    renumberAff();
  });

  // ---- Otomatik Title Case ----
  const titleEl = document.getElementById('title');
  let titleTimer;
  titleEl.addEventListener('input', function () {
    clearTimeout(titleTimer);
    titleTimer = setTimeout(function () {
      const cur = titleEl.selectionStart;
      const newVal = B.toTitleCase(titleEl.value.replace(/\s{2,}/g, ' '));
      if (newVal !== titleEl.value) {
        titleEl.value = newVal;
        try { titleEl.setSelectionRange(cur, cur); } catch (e) {}
      }
      saveDraft();
    }, 220);
  });

  // ---- Kelime sayacı ----
  const abstractEl = document.getElementById('abstract');
  const wordCountEl = document.getElementById('wordCount');
  const counterBar = document.getElementById('counterBar');
  const wordHint = document.getElementById('wordHint');

  function updateCounter() {
    const wc = B.countWords(abstractEl.value);
    wordCountEl.textContent = wc;
    const pct = Math.min(100, Math.round((wc / settings.wordLimit) * 100));
    counterBar.firstElementChild.style.width = pct + '%';
    counterBar.classList.remove('warn', 'over');
    if (wc > settings.wordLimit) {
      counterBar.classList.add('over');
      wordHint.textContent = 'Sınırı aştınız (' + (wc - settings.wordLimit) + ' fazla)';
      wordHint.className = 'text-xs text-rose-600 font-medium';
    } else if (wc > settings.wordLimit * 0.9) {
      counterBar.classList.add('warn');
      wordHint.textContent = 'Sınıra yaklaştınız';
      wordHint.className = 'text-xs text-amber-600 font-medium';
    } else {
      wordHint.textContent = 'Hedef: 250–' + settings.wordLimit + ' kelime';
      wordHint.className = 'text-xs text-zinc-500';
    }
  }
  abstractEl.addEventListener('input', function () {
    updateCounter();
    saveDraft();
  });

  // ---- Diğer alanlar için autosave ----
  document.getElementById('submissionForm').addEventListener('input', saveDraft);
  document.getElementById('submissionForm').addEventListener('change', saveDraft);

  // ---- Draft (taslak) yönetimi ----
  function collectForm() {
    const authors = Array.prototype.map.call(authorList.children, function (row) {
      return {
        fullName: row.querySelector('[data-k="fullName"]').value.trim(),
        affiliationIndex: row.querySelector('[data-k="affiliationIndex"]').value.trim(),
        presenter: row.querySelector('[data-k="presenter"]').checked
      };
    }).filter(function (a) { return a.fullName; });

    const affiliations = Array.prototype.map.call(affList.children, function (row) {
      return row.querySelector('[data-k="aff"]').value.trim();
    }).filter(Boolean);

    const keywords = (document.getElementById('keywords').value || '')
      .split(',').map(function (k) { return k.trim(); }).filter(Boolean);

    return {
      contactName: document.getElementById('contactName').value.trim(),
      contactEmail: document.getElementById('contactEmail').value.trim(),
      contactPhone: document.getElementById('contactPhone').value.trim(),
      contactInst: document.getElementById('contactInst').value.trim(),
      authors: authors,
      affiliations: affiliations,
      title: document.getElementById('title').value.trim(),
      abstract: document.getElementById('abstract').value.trim(),
      keywords: keywords,
      ethicsAck: document.getElementById('ethicsAck').checked,
      originalityAck: document.getElementById('originalityAck').checked
    };
  }

  function saveDraft() {
    const data = collectForm();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
    document.getElementById('autosaveBadge').textContent = 'Kaydedildi · ' +
      new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function applyDraft(d) {
    if (!d) return;
    document.getElementById('contactName').value = d.contactName || '';
    document.getElementById('contactEmail').value = d.contactEmail || '';
    document.getElementById('contactPhone').value = d.contactPhone || '';
    document.getElementById('contactInst').value = d.contactInst || '';
    document.getElementById('title').value = d.title || '';
    document.getElementById('abstract').value = d.abstract || '';
    document.getElementById('keywords').value = (d.keywords || []).join(', ');
    document.getElementById('ethicsAck').checked = !!d.ethicsAck;
    document.getElementById('originalityAck').checked = !!d.originalityAck;
    (d.authors || []).forEach(function (a) { authorList.appendChild(authorRow(a)); });
    (d.affiliations || []).forEach(function (af) { affList.appendChild(affRow(af)); });
    renumberAff();
    updateCounter();
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }

  // ---- Form gönderim ----
  function showError(msg) {
    const el = document.getElementById('formError');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearError() {
    const el = document.getElementById('formError');
    el.textContent = '';
    el.classList.add('hidden');
  }

  function validate(d) {
    if (!d.contactName) return 'İletişim adı zorunludur.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contactEmail)) return 'Geçerli bir e-posta giriniz.';
    if (!d.authors.length) return 'En az bir yazar eklenmelidir.';
    if (!d.authors.some(function (a) { return a.presenter; })) return 'Sunan yazarı işaretleyin.';
    if (!d.affiliations.length) return 'En az bir kurum eklenmelidir.';
    if (!d.title || d.title.length < 6) return 'Başlık çok kısa.';
    if (!d.abstract) return 'Bildiri özeti boş olamaz.';
    const wc = B.countWords(d.abstract);
    if (wc > settings.wordLimit) return 'Özet ' + settings.wordLimit + ' kelimeyi aşamaz (şu an ' + wc + ').';
    if (wc < 50) return 'Özet en az 50 kelime olmalı.';
    if (d.keywords.length < 3) return 'En az 3 anahtar kelime giriniz.';
    if (d.keywords.length > 6) return 'En fazla 6 anahtar kelime giriniz.';
    if (!d.ethicsAck || !d.originalityAck) return 'Beyanları onaylamanız gerekir.';
    return null;
  }

  // ---- Review (son kontrol) modali ----
  function buildReviewHtml(d) {
    const esc = B.escapeHtml;
    const wc = B.countWords(d.abstract);
    const authors = (d.authors || []).map(function (a) {
      const sup = a.affiliationIndex ? '<sup class="text-zinc-500">' + esc(a.affiliationIndex) + '</sup>' : '';
      return esc(a.fullName) + sup + (a.presenter ? ' <span class="text-lime-700 text-xs font-semibold">(Sunan)</span>' : '');
    }).join(', ') || '<em class="text-zinc-400">—</em>';
    const affs = (d.affiliations || []).map(function (af, i) {
      return '<div class="text-sm text-zinc-700">' + (i + 1) + '. ' + esc(af) + '</div>';
    }).join('') || '<em class="text-zinc-400">—</em>';
    return (
      '<div class="space-y-5">' +
        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">İletişim</div>' +
          '<div class="card-soft p-3 space-y-1 text-sm">' +
            '<div><strong>Ad Soyad:</strong> ' + esc(d.contactName || '—') + '</div>' +
            '<div><strong>E-posta:</strong> ' + esc(d.contactEmail || '—') + '</div>' +
            (d.contactPhone ? '<div><strong>Telefon:</strong> ' + esc(d.contactPhone) + '</div>' : '') +
            (d.contactInst ? '<div><strong>Kurum:</strong> ' + esc(d.contactInst) + '</div>' : '') +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Yazarlar (' + d.authors.length + ')</div>' +
          '<div class="card-soft p-3 text-sm">' + authors + '</div>' +
        '</div>' +

        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Kurumlar (' + d.affiliations.length + ')</div>' +
          '<div class="card-soft p-3">' + affs + '</div>' +
        '</div>' +

        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Başlık</div>' +
          '<div class="card-soft p-3 text-base font-medium">' + esc(d.title) + '</div>' +
        '</div>' +

        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center justify-between">' +
            '<span>Özet</span>' +
            '<span class="text-zinc-400">' + wc + ' kelime</span>' +
          '</div>' +
          '<div class="card-soft p-3 text-sm whitespace-pre-wrap leading-relaxed">' + esc(d.abstract) + '</div>' +
        '</div>' +

        '<div>' +
          '<div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Anahtar Kelimeler</div>' +
          '<div class="card-soft p-3 text-sm">' + esc((d.keywords || []).join(', ')) + '</div>' +
        '</div>' +

        '<div class="flex items-start gap-2 text-sm text-zinc-600">' +
          '<span class="text-emerald-600 mt-0.5">✓</span>' +
          '<span>Etik kurallara uygunluk ve özgünlük beyanları onaylandı.</span>' +
        '</div>' +
      '</div>'
    );
  }

  let pendingSubmitData = null;

  document.getElementById('submissionForm').addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    const data = collectForm();
    const err = validate(data);
    if (err) { showError(err); return; }

    pendingSubmitData = data;
    document.getElementById('reviewBody').innerHTML = buildReviewHtml(data);
    openModal('reviewModal');
  });

  document.getElementById('reviewBackBtn').addEventListener('click', function () {
    closeModal('reviewModal');
  });

  document.getElementById('reviewConfirmBtn').addEventListener('click', async function () {
    if (!pendingSubmitData) return;
    const btn = this;
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Gönderiliyor...';
    try {
      const rec = await Promise.resolve(B.createSubmission(pendingSubmitData));
      clearDraft();
      document.getElementById('successId').textContent = rec.id;
      closeModal('reviewModal');
      openModal('successModal');
      document.getElementById('kpiCount').textContent = B.listSubmissions().length;
      pendingSubmitData = null;
    } catch (ex) {
      console.error(ex);
      closeModal('reviewModal');
      showError(ex.message || 'Bildiri gönderilirken hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    if (!confirm('Form temizlensin mi? Doldurulmuş tüm alanlar silinecek.')) return;
    document.getElementById('submissionForm').reset();
    authorList.innerHTML = '';
    affList.innerHTML = '';
    authorList.appendChild(authorRow());
    affList.appendChild(affRow());
    renumberAff();
    clearDraft();
    updateCounter();
    document.getElementById('autosaveBadge').textContent = 'Otomatik kaydet hazır';
  });

  document.getElementById('newSubmissionBtn').addEventListener('click', function () {
    closeModal('successModal');
    document.getElementById('submissionForm').reset();
    authorList.innerHTML = '';
    affList.innerHTML = '';
    authorList.appendChild(authorRow());
    affList.appendChild(affRow());
    renumberAff();
    updateCounter();
    document.getElementById('basvuru').scrollIntoView({ behavior: 'smooth' });
  });

  // ---- Durum sorgulama ----
  document.getElementById('checkStatusBtn').addEventListener('click', function () {
    document.getElementById('statusResult').innerHTML = '';
    openModal('statusModal');
  });

  document.getElementById('statusQueryBtn').addEventListener('click', function () {
    const id = document.getElementById('statusId').value.trim().toUpperCase();
    const email = document.getElementById('statusEmail').value.trim().toLowerCase();
    const sub = B.getSubmission(id);
    const result = document.getElementById('statusResult');
    if (!sub || (sub.contactEmail || '').toLowerCase() !== email) {
      result.innerHTML = '<div class="card-soft p-4 text-sm text-rose-700">Bu numara ve e-posta ile bir başvuru bulunamadı.</div>';
      return;
    }
    const c = B.statusColor(sub.status);
    result.innerHTML =
      '<div class="card-soft p-4">' +
        '<div class="flex items-center justify-between">' +
          '<div class="text-sm text-zinc-500">Bildiri No</div>' +
          '<span class="badge ' + c + ' ring-1">' + B.statusLabel(sub.status) + '</span>' +
        '</div>' +
        '<div class="font-semibold mt-1">' + B.escapeHtml(sub.id) + '</div>' +
        '<div class="text-sm text-zinc-700 mt-3"><strong>Başlık:</strong> ' + B.escapeHtml(sub.title) + '</div>' +
        (sub.statusNote ? '<div class="text-sm text-zinc-700 mt-2"><strong>Not:</strong> ' + B.escapeHtml(sub.statusNote) + '</div>' : '') +
        '<div class="text-xs text-zinc-500 mt-3">Son güncelleme: ' + B.formatDate(sub.updatedAt) + '</div>' +
      '</div>';
  });

  // ---- Modal yardımcıları ----
  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (btn) {
    btn.addEventListener('click', function () {
      btn.closest('.modal-backdrop').classList.add('hidden');
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.modal-backdrop'), function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) m.classList.add('hidden');
    });
  });

  // ---- İlk yükleme ----
  // Taslak veya boş başlangıç
  const draft = loadDraft();
  if (draft && (draft.title || draft.abstract || (draft.authors || []).length)) {
    applyDraft(draft);
    showToast('Yarım kalan başvurunuz yüklendi.', 'ok');
  } else {
    authorList.appendChild(authorRow());
    affList.appendChild(affRow());
    renumberAff();
    updateCounter();
  }

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
