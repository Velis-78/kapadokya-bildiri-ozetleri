/* ============================================================
   Bildiri Sistemi — Supabase Sürücüsü
   ------------------------------------------------------------
   Bu modül app.js'in LocalStorage tabanlı API'sini Supabase ile
   değiştirir. supabase-config.js boşsa bu modül devre dışı kalır
   ve LocalStorage davranışı korunur.
   ============================================================ */
(function (global) {
  'use strict';

  const cfg = global.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.anonKey) {
    // Konfigürasyon eksik → LocalStorage modunda kal
    console.info('[Bildiri] Supabase yapılandırılmadı, LocalStorage modu aktif.');
    global.BildiriBackend = { mode: 'local' };
    return;
  }

  if (!global.supabase || !global.supabase.createClient) {
    console.error('[Bildiri] Supabase JS SDK yüklenemedi.');
    global.BildiriBackend = { mode: 'local' };
    return;
  }

  const sb = global.supabase.createClient(cfg.url, cfg.anonKey);
  const B = global.Bildiri;

  // ---- DB → Uygulama dönüştürücüleri ----
  function rowToSub(r) {
    if (!r) return null;
    return {
      id: r.id,
      status: r.status,
      statusNote: r.status_note || '',
      title: r.title,
      abstract: r.abstract,
      keywords: r.keywords || [],
      authors: r.authors || [],
      affiliations: r.affiliations || [],
      contactName: r.contact_name || '',
      contactEmail: r.contact_email || '',
      contactPhone: r.contact_phone || '',
      contactInst: r.contact_inst || '',
      ethicsAck: !!r.ethics_ack,
      originalityAck: !!r.originality_ack,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  function subToRow(s) {
    return {
      title: s.title,
      abstract: s.abstract,
      keywords: s.keywords || [],
      authors: s.authors || [],
      affiliations: s.affiliations || [],
      contact_name: s.contactName || '',
      contact_email: s.contactEmail || '',
      contact_phone: s.contactPhone || '',
      contact_inst: s.contactInst || '',
      ethics_ack: !!s.ethicsAck,
      originality_ack: !!s.originalityAck,
      status: s.status || 'pending',
      status_note: s.statusNote || ''
    };
  }

  // ---- Önbellek (UI senkron çağrılar için) ----
  let cache = {
    submissions: [],
    settings: null,
    admins: [],
    audit: [],
    loaded: false
  };

  async function loadAll() {
    const [{ data: subs }, { data: setting }, { data: admins }, { data: audit }] = await Promise.all([
      sb.from('submissions').select('*').order('created_at', { ascending: false }),
      sb.from('settings').select('*').eq('id', 1).single(),
      sb.from('admins').select('*'),
      sb.from('audit_log').select('*').order('ts', { ascending: false }).limit(500)
    ]);
    cache.submissions = (subs || []).map(rowToSub);
    cache.settings = setting ? {
      eventTitle: setting.event_title,
      eventShort: setting.event_short,
      organizer: setting.organizer,
      wordLimit: setting.word_limit,
      deadline: setting.deadline,
      submissionsOpen: setting.submissions_open,
      accentColor: setting.accent_color
    } : null;
    cache.admins = (admins || []).map(function (a) {
      return { username: a.username, name: a.name, role: a.role, id: a.id };
    });
    cache.audit = (audit || []).map(function (e) {
      return { ts: e.ts, action: e.action, target: e.target, actor: e.actor, extra: e.extra };
    });
    cache.loaded = true;
  }

  function dispatchChange() {
    document.dispatchEvent(new CustomEvent('bildiri:loaded'));
  }

  // ---- Public API (Bildiri'yi override eder) ----
  // UI çağrıları senkron, biz arka planda yenileriz; ilk yüklemede await edilir.

  B.listSubmissions = function () { return cache.submissions; };
  B.getSubmission = function (id) { return cache.submissions.find(function (s) { return s.id === id; }) || null; };

  B.createSubmission = async function (payload) {
    // Sunucuda ID üret
    const { data: idData, error: idErr } = await sb.rpc('next_submission_id');
    if (idErr) { console.error(idErr); throw new Error('Bildiri oluşturulamadı.'); }
    const newId = idData;
    const row = Object.assign({ id: newId }, subToRow(payload));
    const { data, error } = await sb.from('submissions').insert(row).select().single();
    if (error) { console.error(error); throw new Error('Bildiri kaydedilemedi: ' + error.message); }
    const s = rowToSub(data);
    cache.submissions.unshift(s);
    await sb.from('audit_log').insert({ action: 'create', target: s.id, actor: payload.contactEmail || '-' });
    dispatchChange();
    return s;
  };

  B.updateSubmission = async function (id, patch, actor) {
    const dbPatch = subToRow(Object.assign({}, B.getSubmission(id) || {}, patch));
    const { data, error } = await sb.from('submissions').update(dbPatch).eq('id', id).select().single();
    if (error) { console.error(error); return null; }
    const s = rowToSub(data);
    const idx = cache.submissions.findIndex(function (x) { return x.id === id; });
    if (idx >= 0) cache.submissions[idx] = s;
    await sb.from('audit_log').insert({ action: 'update', target: id, actor: actor || '-', extra: JSON.stringify(Object.keys(patch)) });
    dispatchChange();
    return s;
  };

  B.deleteSubmission = async function (id, actor) {
    const { error } = await sb.from('submissions').delete().eq('id', id);
    if (error) { console.error(error); return; }
    cache.submissions = cache.submissions.filter(function (s) { return s.id !== id; });
    await sb.from('audit_log').insert({ action: 'delete', target: id, actor: actor || '-' });
    dispatchChange();
  };

  B.changeStatus = function (id, status, note, actor) {
    return B.updateSubmission(id, { status: status, statusNote: note || '' }, actor);
  };

  // ---- Admin/Auth ----
  B.authenticate = async function (email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
    if (error || !data.user) return null;
    // Profili getir
    const { data: profile } = await sb.from('admins').select('*').eq('id', data.user.id).single();
    if (!profile) {
      await sb.auth.signOut();
      return null;
    }
    return { username: profile.username, name: profile.name, role: profile.role, id: profile.id };
  };

  B.setSession = function (user) {
    // Supabase oturumu otomatik yönetir; ek bir şey gerekmez
    try { localStorage.setItem('bildiri.session.v1', JSON.stringify(user)); } catch (e) {}
  };

  B.getSession = function () {
    try {
      const raw = localStorage.getItem('bildiri.session.v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

  B.clearSession = async function () {
    await sb.auth.signOut();
    localStorage.removeItem('bildiri.session.v1');
  };

  B.listAdmins = function () { return cache.admins; };

  B.addAdmin = async function (email, password, name, role) {
    // Yeni admin eklemek için Supabase Auth Admin API gerek (server-side)
    // Bu UI seviyesinde Supabase Dashboard'dan kullanıcı oluşturmayı tavsiye ederiz.
    throw new Error('Yeni admin Supabase Dashboard üzerinden eklenmelidir. Bkz. README.');
  };

  B.removeAdmin = async function (username) {
    throw new Error('Admin silme işlemi Supabase Dashboard üzerinden yapılır.');
  };

  B.changePassword = async function (_username, newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  };

  // ---- Settings ----
  B.getSettings = function () {
    return cache.settings || {
      eventTitle: 'Yükleniyor...',
      eventShort: 'Bildiri Sistemi',
      organizer: '',
      wordLimit: 350,
      deadline: '',
      submissionsOpen: true
    };
  };

  B.updateSettings = async function (patch) {
    const dbPatch = {
      event_title: patch.eventTitle,
      event_short: patch.eventShort,
      organizer: patch.organizer,
      word_limit: patch.wordLimit,
      deadline: patch.deadline,
      submissions_open: patch.submissionsOpen
    };
    Object.keys(dbPatch).forEach(function (k) { if (dbPatch[k] === undefined) delete dbPatch[k]; });
    const { data, error } = await sb.from('settings').update(dbPatch).eq('id', 1).select().single();
    if (error) { console.error(error); throw new Error('Ayarlar güncellenemedi.'); }
    cache.settings = {
      eventTitle: data.event_title,
      eventShort: data.event_short,
      organizer: data.organizer,
      wordLimit: data.word_limit,
      deadline: data.deadline,
      submissionsOpen: data.submissions_open
    };
    return cache.settings;
  };

  // ---- Audit ----
  B.getAudit = function () { return cache.audit; };

  // ---- İlk yükleme ----
  // Sayfa yüklenirken UI senkron çağrılarda boş döner; sonra yenilenir.
  loadAll().then(function () {
    console.info('[Bildiri] Supabase verisi yüklendi.');
    if (typeof global.onBildiriReady === 'function') global.onBildiriReady();
    // UI'yi yenilemek için custom event yay
    document.dispatchEvent(new CustomEvent('bildiri:loaded'));
  }).catch(function (e) {
    console.error('[Bildiri] Supabase yüklenemedi:', e);
  });

  global.BildiriBackend = { mode: 'supabase', client: sb, refresh: loadAll };
})(window);
