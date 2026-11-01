/* ============================================================================
   ARNOUR — JOB-DESCRIPTION IMPORT ("Paste a job description" on Post a role, and on Admin → Import jobs)
   Loaded on demand by views-employer.js: only on the live site, only when one of those two pages opens.
   1. The person pastes the text of a job ad. This page removes email addresses, phone numbers and web links.
   2. The text goes to /.netlify/functions/jd-parse, which asks Claude to fill in a role using Arnour's own
      product / module / specialty / country lists (so nothing outside the catalog can come back).
   3. Post a role: the answer fills the form (the ad stays as the description). The company checks every step and publishes as usual.
      Admin: the role is added to the JSON list on the page; Check and Import work as always.
   Nothing here saves a role, and the text of the ad is never stored by Arnour.
   ============================================================================ */
(function () {
  'use strict';
  var FN = '/.netlify/functions/jd-parse';
  var MAX_CHARS = 20000, MAX_DESC = 8000;
  var S = APP.jdImp = { ready: false, configured: false, state: 'idle', msg: '', text: '', done: null, adminMsg: '', admin: { employer: '', url: '', source: 'Company career page' }, dismissed: false };
  var esc = function (s) { return APP.h(s == null ? '' : s); };

  APP.jdImpInit = function () {
    if (S.ready) { refresh(); return; }
    fetch(FN, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { S.configured = !!(j && j.configured); }, function () { S.configured = false; })
      .then(function () { S.ready = true; refresh(); });
  };
  function refresh() {
    var a = document.getElementById('jd-slot'), b = document.getElementById('jd-slot-admin');
    if (a) a.innerHTML = APP.jdCardHtml('post');
    if (b) b.innerHTML = APP.jdCardHtml('admin');
  }

  /* ---------- the card ---------- */
  APP.jdCardHtml = function (kind) {
    if (!S.ready || !S.configured) return '';
    var admin = kind === 'admin', busy = S.state === 'reading';
    if (!admin) {
      var d = APP.jobNewDraft;
      if (!d || d.editId || (APP.state.jobStep || 1) !== 1) return '';
      if (S.done && S.done.draft === d) return foundHtml(S.done);
      if (S.dismissed) return '';
    }
    var ph = 'Paste the job ad here (English)…';
    return '<section class="card form-sec cv-import jd-import" data-sec="jdimp">' +
      '<div class="sec-h"><div><h3>' + (admin ? 'Read a job ad' : 'Start from a job description') + (admin ? '' : ' <span class="muted">(optional)</span>') + '</h3>' +
      '<p class="muted small">' + (admin ? 'Paste one posting, add the employer and the link, and the role is added to the list below. Check it, then import.' : 'Paste your job ad and we fill in this form for you, so you only check and correct it. It takes about 10 seconds.') + '</p></div></div>' +
      (busy ? '<p class="live-note cv-reading" role="status"><span class="cv-spin" aria-hidden="true"></span> Reading the ad…</p>'
        : '<textarea class="input" rows="6" data-jd-text aria-label="Job description" placeholder="' + ph + '">' + esc(S.text) + '</textarea>' +
          (admin ? '<div class="form-grid"><label class="field"><span class="label">Employer name</span><input class="input" data-jd-admin="employer" value="' + esc(S.admin.employer) + '" placeholder="Leave empty to use the name in the ad"></label>' +
            '<label class="field"><span class="label">Link to the posting *</span><input class="input" data-jd-admin="url" value="' + esc(S.admin.url) + '" placeholder="https://careers.example.com/job/123"></label>' +
            '<label class="field"><span class="label">Source</span><select class="input" data-jd-admin="source">' + ['Company career page', 'Recruiter / agency posting'].map(function (o) { return '<option' + (S.admin.source === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label></div>' : '') +
          '<div class="cv-import-row"><button type="button" class="btn btn-primary btn-sm" data-jd-act="read">' + APP.icon('spark', 14) + ' ' + (admin ? 'Read the ad and add it' : 'Fill in the role') + '</button>' +
          (admin ? '' : '<button type="button" class="link-btn" data-jd-act="dismiss">No thanks, I will fill it in myself</button>') + '</div>') +
      (S.state === 'error' && S.msg ? '<p class="field-error" role="alert">' + esc(S.msg) + '</p>' : '') +
      (admin && S.adminMsg ? '<p class="live-note" role="status">' + esc(S.adminMsg) + '</p>' : '') +
      '<p class="muted small cv-consent">' + APP.icon('lock', 13) + ' We read the ad once with AI (Anthropic\'s Claude) to fill in the form. Email addresses, phone numbers and web links are removed first. The text is not stored by Arnour and not used to train AI. English ads only.</p>' +
      '</section>';
  };
  function foundHtml(done) {
    return '<section class="card form-sec cv-import cv-found jd-import" data-sec="jdimp"><div class="sec-h"><div><h3>' + APP.icon('check', 16) + ' We read your job description</h3></div></div>' +
      (done.parts.length ? '<p>We filled in ' + esc(done.parts.join(', ')) + '. <b>Please check every step</b> before you publish. Nothing is published until you press Publish role.</p>' : '<p>We could not find much to fill in. Please complete the form yourself.</p>') +
      (done.short ? '<p class="muted small">The ad was longer than 8,000 characters, so the description was shortened. Please check the end of it.</p>' : '') +
      '</section>';
  }
  APP.jdBannerHtml = function (step) {
    var d = APP.jobNewDraft;
    if (!S.done || !d || S.done.draft !== d || d.editId || step > 2) return '';
    return '<p class="live-note cv-banner">' + APP.icon('check', 14) + ' Filled in from your job description. Please check it.</p>';
  };

  /* ---------- clicks and typing ---------- */
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.matches) return;
    if (t.matches('textarea[data-jd-text]')) S.text = t.value;
    else if (t.matches('[data-jd-admin]')) S.admin[t.getAttribute('data-jd-admin')] = t.value;
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-jd-act]');
    if (!b) return;
    var a = b.getAttribute('data-jd-act'), admin = !!b.closest('#jd-slot-admin');
    if (a === 'dismiss') { S.dismissed = true; S.state = 'idle'; S.msg = ''; refresh(); }
    if (a === 'read') run(admin ? 'admin' : 'post');
  });

  var MSG = {
    no_text: 'That is too short to be a job ad. Paste the whole text of the posting.',
    not_a_job: 'We could not find a SAP job in this text. Check what you pasted, or fill in the form yourself.',
    limit: 'You have used all of today\'s job-description reads. Please fill in the form yourself, or try again tomorrow.',
    busy: 'Job reading is very busy right now. Please try again in a few minutes, or fill in the form yourself.',
    signin: 'Please sign in again, then try once more.',
    employers_only: 'Reading a job ad is available to companies.',
    not_allowed: 'Reading a job ad here is for the Arnour admin only.',
    network: 'Could not reach the server. Check your connection and try again.'
  };
  function fail(code, text) { S.state = 'error'; S.msg = text || MSG[code] || 'We could not read this job ad. Please try again, or fill in the form yourself.'; refresh(); }

  /* ---------- 1. clean the text on this device ---------- */
  function clean(t) {
    t = String(t || '').replace(/\r/g, '\n').replace(/ /g, ' ');
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ' ');
    t = t.replace(/\b(?:https?:\/\/|www\.)[^\s)>\]]+/gi, ' ');
    t = t.replace(/(?:\+|\b00)\d[\d\s().-]{7,}\d/g, ' ');
    t = t.replace(/\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, ' ');
    t = t.replace(/\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g, ' ');
    t = t.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return t.slice(0, MAX_CHARS);
  }
  APP.jdClean = clean;

  function lists() {
    var specs = [];
    Object.keys(APP.SPECIAL_IDX || {}).forEach(function (id) { var s = APP.SPECIAL_IDX[id]; if (s && !s.hidden) specs.push({ id: id, name: s.name }); });
    return {
      products: CATALOG.products.map(function (p) { return { id: p.id, name: p.name, modules: p.modules.map(function (m) { return { id: m.id, name: m.name }; }) }; }),
      specialties: specs,
      roleTypes: APP.roleTypes.map(function (r) { return { id: r.id, name: r.name }; }),
      countries: APP.countries.map(function (c) { return { id: c.id, name: c.name }; }),
      industries: APP.industries.slice(), languages: APP.languages.slice(),
      jobTypes: APP.jobTypes.slice(), durations: APP.durations.slice(), levels: APP.levels.slice()
    };
  }
  function post(text, token, kind) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 60000);
    return fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text: text, kind: kind, lists: lists() }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.job) throw { code: (j && j.error) || 'service' }; return j.job; });
      }, function () { clearTimeout(to); throw { code: 'network' }; });
  }

  function run(kind) {
    if (S.state === 'reading') return;
    var ta = document.querySelector('textarea[data-jd-text]'); if (ta) S.text = ta.value;
    var admin = kind === 'admin';
    if (admin) {
      document.querySelectorAll('[data-jd-admin]').forEach(function (el) { S.admin[el.getAttribute('data-jd-admin')] = el.value; });
      var u = String(S.admin.url || '').trim();
      if (!/^https:\/\/[^ ]+\.[^ ]+$/.test(u)) return fail('', 'Add the full https link to the posting first (it is also how duplicates are found).');
    } else if (!APP.jobNewDraft || APP.jobNewDraft.editId) return;
    var text = clean(S.text);
    if (text.length < 150) return fail('no_text');
    S.state = 'reading'; S.msg = ''; S.adminMsg = ''; refresh();
    APP.backend.ensureSession().then(function (s) {
      if (!s || !s.access_token) throw { code: 'signin' };
      return post(text, s.access_token, kind);
    }).then(function (job) {
      S.state = 'idle'; S.msg = '';
      var desc = shorten(text);
      if (admin) addToList(job, desc.text);
      else { applyToForm(job, desc); S.text = ''; }
    }).catch(function (e) { fail(e && e.code); });
  }

  /* the description is the ad itself, cleaned; if it is longer than the form allows it is cut at a paragraph or line end */
  function shorten(text) {
    if (text.length <= MAX_DESC) return { text: text, short: false };
    var cut = text.slice(0, MAX_DESC), i = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'));
    return { text: (i > MAX_DESC * 0.6 ? cut.slice(0, i) : cut).trim(), short: true };
  }
  function cityName(cid, city) {
    var c = APP.countriesById[cid], n = String(city || '').trim().toLowerCase(); if (!c || !n) return '';
    return (c.cities || []).filter(function (x) { return String(x).toLowerCase() === n; })[0] || '';
  }
  function plural(n, w, pl) { return n + ' ' + (n === 1 ? w : (pl || w + 's')); }

  /* ---------- 2a. Post a role: fill the form (the ad's own values replace the form's defaults; anything the company typed is kept) ---------- */
  function applyToForm(p, desc) {
    var d = APP.jobNewDraft; if (!d || d.editId) return;
    APP.syncFormsToDrafts(null); /* keep whatever was typed while the ad was being read */
    var parts = [], blank = function (v) { return v == null || v === '' || (Array.isArray(v) && !v.length); };
    if (blank(d.title) && p.title) { d.title = p.title; parts.push('the title'); }
    if (blank(d.roleType) && p.roleType) { d.roleType = p.roleType; parts.push('the role type'); }
    if (p.country) {
      d.country = p.country; d.city = cityName(p.country, p.city);
      parts.push('the location');
    }
    if (p.remote) d.remote = true;
    if (p.employmentType) {
      d.employmentType = p.employmentType;
      if (p.employmentType === 'Full-time') d.duration = 'Permanent';
      else if (p.duration) d.duration = p.duration;
      else if (d.duration === 'Permanent') d.duration = '6 months';
      parts.push('the contract type');
    }
    var have = (d.requires || []).filter(function (r) { return r.productId && r.moduleId; }).length;
    if (!have && p.requires.length) {
      var counts = APP.rtCounts(d.roleType);
      d.requires = p.requires.map(function (r, i) { return { productId: r.productId, moduleId: r.moduleId, minProjects: counts ? r.minProjects : 0, orPrev: i > 0 && r.orPrev }; });
      parts.push(plural(p.requires.length, 'SAP skill'));
    }
    if (blank(d.level) && p.level) { d.level = p.level; parts.push('seniority'); }
    if (!(+d.minExp) && p.minExp) { d.minExp = p.minExp; parts.push('minimum experience'); }
    if (blank(d.certification) && p.certification) d.certification = p.certification;
    if (p.languages.length) { d.languages = (d.languages || []).concat(p.languages.filter(function (x) { return (d.languages || []).indexOf(x) === -1; })); parts.push('languages'); }
    d.preferredLangs = (d.preferredLangs || []).concat(p.preferredLangs.filter(function (x) { return (d.preferredLangs || []).indexOf(x) === -1 && (d.languages || []).indexOf(x) === -1; }));
    if (p.industries.length && blank(d.industries)) { d.industries = p.industries.slice(); d.industry = d.industries[0]; }
    var sp = (d.preferredSpecialties || []).slice();
    p.specialties.forEach(function (id) { if (sp.length < 8 && sp.indexOf(id) === -1 && APP.SPECIAL_IDX[id] && !APP.SPECIAL_IDX[id].hidden) sp.push(id); });
    if (sp.length > (d.preferredSpecialties || []).length) d.preferredSpecialties = sp;
    if (p.minPrograms && !(+d.minPrograms) && APP.LEAD_RTS.indexOf(d.roleType) !== -1) d.minPrograms = p.minPrograms;
    if (blank(d.description) && desc.text) { d.description = desc.text; parts.push('the description'); }
    APP.jobRowsAnyModule(d);
    S.done = { draft: d, parts: parts, short: desc.short };
    APP.state.jobErr = null;
    APP._formSyncSkip = ['job-post'];
    APP.render();
  }

  /* ---------- 2b. Admin: add the role to the JSON list on the Import jobs page ---------- */
  function addToList(p, description) {
    var u = String(S.admin.url || '').trim(), emp = String(S.admin.employer || '').trim() || p.employerName;
    if (!p.requires.length) return fail('', 'We found no SAP skills in this ad, so it was not added. Check the text, or map it by hand.');
    var notes = [];
    if (!emp) notes.push('the employer name (the list shows a fix hint)');
    var row = {
      title: p.title, extEmployer: emp || '', extSource: S.admin.source, applyUrl: u, roleType: p.roleType,
      requires: p.requires.map(function (r) { var o = { productId: r.productId, moduleId: r.moduleId }; if (r.minProjects) o.minProjects = r.minProjects; if (r.orPrev) o.orPrev = true; return o; }),
      country: p.country, remote: !!p.remote, description: description
    };
    var city = cityName(p.country, p.city); if (city) row.city = city;
    if (p.employmentType) { row.employmentType = p.employmentType; row.duration = p.employmentType === 'Full-time' ? 'Permanent' : p.duration; if (!row.duration) { delete row.duration; notes.push('the contract length'); } }
    else { row.employmentType = 'Full-time'; row.duration = 'Permanent'; notes.push('the contract type (set to Full-time)'); }
    if (p.minExp) row.minExp = p.minExp;
    if (p.level) row.level = p.level;
    if (p.industries.length) row.industries = p.industries;
    if (p.languages.length) row.languages = p.languages;
    if (p.certification) row.certification = p.certification;
    var res = APP.adminImpAdd ? APP.adminImpAdd(row) : { ok: false, msg: 'The import page is not open.' };
    if (!res.ok) return fail('', res.msg);
    S.text = ''; S.admin.url = ''; S.admin.employer = '';
    S.adminMsg = 'Added “' + (row.title || 'role') + '” (' + plural(row.requires.length, 'skill') + ') to the list below.' + (notes.length ? ' Not stated in the ad: ' + notes.join(', ') + '.' : '') + ' Check it, then import.';
    refresh();
  }
})();
