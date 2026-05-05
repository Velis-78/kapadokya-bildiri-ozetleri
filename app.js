/* ============================================================
   Bildiri Yönetim Sistemi — Ortak Veri Katmanı
   Herediter Anjiyoödem ve İmmün Yetmezliklere
   Zor Olgularla Pratik Çözümler
   ============================================================ */
(function (global) {
  'use strict';

  // -------- Sabitler ----------
  const STORAGE_KEYS = {
    submissions: 'bildiri.submissions.v1',
    admins: 'bildiri.admins.v1',
    session: 'bildiri.session.v1',
    settings: 'bildiri.settings.v1',
    audit: 'bildiri.audit.v1'
  };

  const DEFAULT_ADMIN = {
    username: 'admin',
    // Varsayılan şifre: aid2026 — ilk girişte değiştirilmesi önerilir
    passwordHash: hashSync('aid2026'),
    role: 'super',
    createdAt: new Date().toISOString(),
    name: 'Sistem Yöneticisi'
  };

  const DEFAULT_SETTINGS = {
    eventTitle: 'Herediter Anjiyoödem ve İmmün Yetmezliklere Zor Olgularla Pratik Çözümler',
    eventShort: 'HAE & İmmün Yetmezlik Bildiri Sistemi',
    organizer: 'Türkiye Ulusal Allerji ve Klinik İmmünoloji Derneği',
    wordLimit: 350,
    deadline: '2026-09-30',
    submissionsOpen: true,
    accentColor: '#A3E635',
    formSectionsOrder: ['contact', 'authors', 'affiliations', 'title', 'abstract', 'declaration']
  };

  // -------- Basit hash (LocalStorage demo amaçlı) ----------
  // NOT: Üretimde Firebase Auth veya server-side bcrypt kullanılmalı.
  function hashSync(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // -------- LocalStorage yardımcıları ----------
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Veri okunamadı:', key, e);
      return fallback;
    }
  }

  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('Veri yazılamadı:', key, e);
      alert('Tarayıcı depolaması dolu veya devre dışı. Lütfen sistem yöneticinize başvurun.');
      return false;
    }
  }

  // -------- İlk kurulum ----------
  function init() {
    if (!localStorage.getItem(STORAGE_KEYS.admins)) {
      write(STORAGE_KEYS.admins, [DEFAULT_ADMIN]);
    }
    if (!localStorage.getItem(STORAGE_KEYS.settings)) {
      write(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.submissions)) {
      write(STORAGE_KEYS.submissions, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.audit)) {
      write(STORAGE_KEYS.audit, []);
    }
  }

  // -------- Bildiri CRUD ----------
  function listSubmissions() {
    return read(STORAGE_KEYS.submissions, []);
  }

  function getSubmission(id) {
    return listSubmissions().find((s) => s.id === id) || null;
  }

  function createSubmission(payload) {
    const all = listSubmissions();
    const now = new Date().toISOString();
    const id = 'BLD-' + (1000 + all.length + 1);
    const record = Object.assign(
      {
        id: id,
        status: 'pending', // pending | accepted | rejected | revision
        statusNote: '',
        createdAt: now,
        updatedAt: now
      },
      payload
    );
    all.push(record);
    write(STORAGE_KEYS.submissions, all);
    audit('create', id, payload.contactEmail || '-');
    return record;
  }

  function updateSubmission(id, patch, actor) {
    const all = listSubmissions();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    all[idx] = Object.assign({}, all[idx], patch, {
      updatedAt: new Date().toISOString()
    });
    write(STORAGE_KEYS.submissions, all);
    audit('update', id, actor || '-', JSON.stringify(Object.keys(patch)));
    return all[idx];
  }

  function deleteSubmission(id, actor) {
    const all = listSubmissions().filter((s) => s.id !== id);
    write(STORAGE_KEYS.submissions, all);
    audit('delete', id, actor || '-');
  }

  function changeStatus(id, status, note, actor) {
    return updateSubmission(id, { status: status, statusNote: note || '' }, actor);
  }

  // -------- Admin yönetimi ----------
  function listAdmins() {
    return read(STORAGE_KEYS.admins, []);
  }

  function authenticate(username, password) {
    const admins = listAdmins();
    const u = admins.find((a) => a.username.toLowerCase() === String(username).toLowerCase());
    if (!u) return null;
    if (u.passwordHash !== hashSync(password)) return null;
    return u;
  }

  function addAdmin(username, password, name, role) {
    const admins = listAdmins();
    if (admins.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Bu kullanıcı adı zaten mevcut.');
    }
    const rec = {
      username: username,
      passwordHash: hashSync(password),
      name: name || username,
      role: role || 'editor',
      createdAt: new Date().toISOString()
    };
    admins.push(rec);
    write(STORAGE_KEYS.admins, admins);
    return rec;
  }

  function removeAdmin(username) {
    const admins = listAdmins();
    if (admins.length <= 1) throw new Error('Son admin silinemez.');
    const filtered = admins.filter((a) => a.username !== username);
    write(STORAGE_KEYS.admins, filtered);
  }

  function changePassword(username, newPassword) {
    const admins = listAdmins();
    const idx = admins.findIndex((a) => a.username === username);
    if (idx === -1) throw new Error('Kullanıcı bulunamadı.');
    admins[idx].passwordHash = hashSync(newPassword);
    write(STORAGE_KEYS.admins, admins);
  }

  // -------- Oturum ----------
  function setSession(user) {
    write(STORAGE_KEYS.session, {
      username: user.username,
      role: user.role,
      name: user.name,
      loginAt: new Date().toISOString()
    });
  }

  function getSession() {
    return read(STORAGE_KEYS.session, null);
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.session);
  }

  // -------- Ayarlar ----------
  function getSettings() {
    return Object.assign({}, DEFAULT_SETTINGS, read(STORAGE_KEYS.settings, {}));
  }

  function updateSettings(patch) {
    const cur = getSettings();
    const next = Object.assign({}, cur, patch);
    write(STORAGE_KEYS.settings, next);
    return next;
  }

  // -------- Audit log ----------
  function audit(action, target, actor, extra) {
    const log = read(STORAGE_KEYS.audit, []);
    log.push({
      ts: new Date().toISOString(),
      action: action,
      target: target,
      actor: actor || '-',
      extra: extra || ''
    });
    // Sadece son 500 kaydı tut
    while (log.length > 500) log.shift();
    write(STORAGE_KEYS.audit, log);
  }

  function getAudit() {
    return read(STORAGE_KEYS.audit, []);
  }

  // -------- Yardımcılar (UI tarafından kullanılır) ----------
  function toTitleCase(str) {
    if (!str) return '';
    // Türkçe karakter güvenli, kısaltmalar ve rakamlar korunur
    const lowerWords = new Set([
      've', 'veya', 'ile', 'ya', 'da', 'de', 'ki',
      'a', 'an', 'and', 'or', 'the', 'of', 'in', 'on', 'for', 'to', 'vs'
    ]);
    return str
      .toLocaleLowerCase('tr-TR')
      .split(/(\s+)/)
      .map(function (w, i) {
        if (/^\s+$/.test(w)) return w;
        if (i > 0 && lowerWords.has(w)) return w;
        // Tamamı büyük harf olan kısaltmaları (örn. ABD, HAE) koru
        if (/^[a-zçğıöşü0-9]+$/.test(w) && w.length <= 4 && /^\d/.test(w)) return w;
        return w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1);
      })
      .join('');
  }

  function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  function statusLabel(s) {
    return (
      {
        pending: 'Beklemede',
        accepted: 'Kabul',
        rejected: 'Ret',
        revision: 'Revizyon'
      }[s] || s
    );
  }

  function statusColor(s) {
    return (
      {
        pending: 'bg-amber-100 text-amber-800 ring-amber-200',
        accepted: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
        rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
        revision: 'bg-sky-100 text-sky-800 ring-sky-200'
      }[s] || 'bg-slate-100 text-slate-800 ring-slate-200'
    );
  }

  // -------- Public API ----------
  global.Bildiri = {
    init: init,
    // CRUD
    listSubmissions: listSubmissions,
    getSubmission: getSubmission,
    createSubmission: createSubmission,
    updateSubmission: updateSubmission,
    deleteSubmission: deleteSubmission,
    changeStatus: changeStatus,
    // Admin
    listAdmins: listAdmins,
    authenticate: authenticate,
    addAdmin: addAdmin,
    removeAdmin: removeAdmin,
    changePassword: changePassword,
    // Session
    setSession: setSession,
    getSession: getSession,
    clearSession: clearSession,
    // Settings
    getSettings: getSettings,
    updateSettings: updateSettings,
    // Audit
    getAudit: getAudit,
    // Utils
    toTitleCase: toTitleCase,
    countWords: countWords,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    statusLabel: statusLabel,
    statusColor: statusColor,
    hashSync: hashSync
  };

  // Her sayfa yüklendiğinde otomatik init
  init();
})(window);
