/* ============================================================================
   ARNOUR — CV IMPORT ("Start from your CV" in the consultant sign-up wizard)
   Loaded on demand by views-public.js: only on the live site, only when the wizard opens.
   1. This page reads the TEXT of the CV (PDF with the bundled pdf.js, DOCX with the browser's own unzip)
      and removes email addresses and phone numbers.
   2. The text goes to /.netlify/functions/cv-parse, which asks Claude to fill in a profile using
      Arnour's own product / module / specialty lists (so nothing outside the catalog can come back).
   3. The answer fills the wizard (blank fields only). The person checks every step and finishes as usual.
   Nothing here saves a profile, and the text of the CV is never stored.
   ============================================================================ */
(function () {
  'use strict';
  var FN = '/.netlify/functions/cv-parse';
  var MAX_BYTES = 5 * 1024 * 1024, MAX_PAGES = 12, MAX_CHARS = 30000, MAX_XML = 20e6;
  var S = APP.cvImp = { ready: false, configured: false, state: 'idle', msg: '' };
  var esc = function (s) { return APP.h(s == null ? '' : s); };

  /* ---------- is the feature switched on? (the function says so once an API key is set in Netlify) ---------- */
  APP.cvImpInit = function () {
    if (S.ready) { refresh(); return; }
    fetch(FN, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { S.configured = !!(j && j.configured); }, function () { S.configured = false; })
      .then(function () { S.ready = true; refresh(); });
  };
  function refresh() { var el = document.getElementById('cv-slot'); if (el) el.innerHTML = APP.cvCardHtml(); }

  /* ---------- the card on step 1 ---------- */
  APP.cvCardHtml = function () {
    var w = APP.wizC;
    if (!w || w.step !== 1 || !S.ready || !S.configured) return '';
    var i = w.cvImp || {};
    if (i.done) return foundHtml(w, i);
    if (i.dismissed) return '';
    var busy = S.state === 'reading';
    return '<section class="wiz-sec cv-import" data-sec="cvimp">' +
      '<div class="wiz-sec-h"><span class="wiz-sec-ico">' + APP.icon('spark', 18) + '</span><h2>Start from your CV <span class="muted">(optional)</span></h2></div>' +
      '<p class="field-hint">Upload your CV and we fill in this form for you, so you only check and correct it. It takes about 10 seconds.</p>' +
      (busy
        ? '<p class="live-note cv-reading" role="status"><span class="cv-spin" aria-hidden="true"></span> Reading your CV…</p>'
        : '<div class="cv-import-row"><label class="cv-drop">' + APP.icon('file', 18) + '<span>Upload your CV (PDF or Word .docx)</span><input type="file" accept=".pdf,.docx" data-cv-import hidden></label>' +
          '<button type="button" class="link-btn" data-cv-act="dismiss">No thanks, I will fill it in myself</button></div>') +
      (S.state === 'error' && S.msg ? '<p class="field-error" role="alert">' + esc(S.msg) + '</p>' : '') +
      '<p class="muted small cv-consent">' + APP.icon('lock', 13) + ' We read your CV once with AI (Anthropic\'s Claude) to fill in this form. Email addresses and phone numbers are removed on your device first. The text of your CV is not stored, not used to train AI and not shown to anyone. Your CV file is saved privately on your profile, like any CV you upload, and you can remove it on the last step. <a href="#/privacy" target="_blank" rel="noopener">Privacy</a></p>' +
      '</section>';
  };

  function foundHtml(w, i) {
    var d = w.data, f = i.found || {}, need = [];
    if (!APP.rtList(d).length) need.push('your main role');
    if (!d.firstName || !d.lastName) need.push('your name');
    if (!d.headline) need.push('your title');
    if (!d.gender) need.push('your gender');
    if (!d.nationality) need.push('your nationality');
    if (!d.country) need.push('your country');
    if (!(d.languages || []).length) need.push('your languages');
    return '<section class="wiz-sec cv-import cv-found" data-sec="cvimp">' +
      '<div class="wiz-sec-h"><span class="wiz-sec-ico">' + APP.icon('check', 18) + '</span><h2>We read your CV</h2></div>' +
      (f.parts && f.parts.length ? '<p>We filled in ' + esc(f.parts.join(', ')) + '. <b>Please check every step</b> before you finish. Nothing is saved until you press Create my profile.</p>' : '<p>We could not find much to fill in. Please complete the steps yourself.</p>') +
      (need.length ? '<p class="muted small">Still needed from you on this page: ' + esc(need.join(', ')) + '.</p>' : '') +
      (d.cv ? '<p class="muted small">' + APP.icon('lock', 13) + ' Your CV file is saved privately on your profile. You can remove it on the last step.</p>' : '') +
      '</section>';
  }

  /* ---------- clicks and file choice ---------- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[data-cv-import]')) return;
    var file = t.files && t.files[0]; t.value = '';
    if (file) run(file);
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-cv-act]');
    if (!b || !APP.wizC) return;
    if (b.getAttribute('data-cv-act') === 'dismiss') { APP.wizC.cvImp = { dismissed: true }; S.state = 'idle'; S.msg = ''; refresh(); }
  });

  var MSG = {
    no_text: 'We could not find readable text in this file (it may be a scan or a picture). Try another file, or fill in the form yourself.',
    limit: 'You have used all of today\'s CV reads. Please fill in the form yourself, or try again tomorrow.',
    busy: 'CV reading is very busy right now. Please try again in a few minutes, or fill in the form yourself.',
    signin: 'Please sign in again, then try once more.',
    network: 'Could not reach the server. Check your connection and try again.',
    file: 'We could not open this file. Try another file, or fill in the form yourself.'
  };
  function fail(code, text) { S.state = 'error'; S.msg = text || MSG[code] || 'We could not read this CV. Please try again, or fill in the form yourself.'; refresh(); }

  function run(file) {
    if (S.state === 'reading' || !APP.wizC) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'doc') return fail('', 'Old Word (.doc) files cannot be read. Save it as a PDF or DOCX and upload it again, or fill in the form yourself.');
    if (ext !== 'pdf' && ext !== 'docx') return fail('', 'Please upload a PDF or DOCX file.');
    if (file.size > MAX_BYTES) return fail('', 'That file is larger than 5 MB.');
    S.state = 'reading'; S.msg = ''; refresh();
    extract(file, ext).then(function (raw) {
      var text = clean(raw);
      if (text.length < 200) throw { code: 'no_text' };
      return APP.backend.ensureSession().then(function (s) {
        if (!s || !s.access_token) throw { code: 'signin' };
        return post(text, s.access_token);
      });
    }).then(function (profile) {
      S.state = 'idle'; S.msg = '';
      if (!APP.wizC) return;
      apply(profile);
      /* the file itself is kept privately, exactly like a CV uploaded on the last step */
      if (APP.backend.uploadCv) APP.backend.uploadCv(file).then(function (cv) {
        if (cv && APP.wizC && !APP.wizC.data.cv) { APP.wizC.data.cv = cv; APP.backend.saveWizardDraft('consultant'); refresh(); }
      });
    }).catch(function (e) { fail(e && e.code); });
  }

  /* ---------- 1. read the text on this device ---------- */
  function extract(file, ext) {
    return file.arrayBuffer().then(function (buf) { return ext === 'pdf' ? pdfText(buf) : docxText(buf); })
      .catch(function (e) { throw (e && e.code) ? e : { code: 'file' }; });
  }
  function pdfText(buf) {
    return import('/js/vendor/pdfjs/pdf.min.mjs').then(function (lib) {
      lib.GlobalWorkerOptions.workerSrc = '/js/vendor/pdfjs/pdf.worker.min.mjs';
      return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise.then(function (doc) {
        var n = Math.min(doc.numPages, MAX_PAGES), out = [], chain = Promise.resolve();
        function page(p) {
          chain = chain.then(function () {
            return doc.getPage(p).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
              var s = ''; tc.items.forEach(function (it) { s += it.str + (it.hasEOL ? '\n' : ' '); }); out.push(s);
            });
          });
        }
        for (var p = 1; p <= n; p++) page(p);
        return chain.then(function () { try { doc.destroy(); } catch (e) { /* ignore */ } return out.join('\n'); });
      });
    });
  }
  /* a .docx is a zip file; the text is in word/document.xml. The browser unzips it with its built-in DecompressionStream. */
  function docxText(buf) {
    var v = new DataView(buf), bytes = new Uint8Array(buf), eocd = -1, i;
    for (i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) { if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw { code: 'file' };
    var n = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), want = null, k;
    for (k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
      if (new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl)) === 'word/document.xml') { want = { method: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), at: v.getUint32(p + 42, true) }; break; }
      p += 46 + nl + el + cl;
    }
    if (!want) throw { code: 'file' };
    var start = want.at + 30 + v.getUint16(want.at + 26, true) + v.getUint16(want.at + 28, true);
    var raw = bytes.subarray(start, start + want.size);
    return (want.method === 0 ? Promise.resolve(raw) : inflate(raw)).then(function (b) { return xmlText(new TextDecoder('utf-8').decode(b)); });
  }
  function inflate(raw) {
    if (typeof DecompressionStream !== 'function') return Promise.reject({ code: 'file' });
    var reader = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), parts = [], total = 0;
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) { var out = new Uint8Array(total), at = 0; parts.forEach(function (c) { out.set(c, at); at += c.length; }); return out; }
        total += r.value.length;
        if (total > MAX_XML) { reader.cancel(); throw { code: 'file' }; }
        parts.push(r.value); return pump();
      });
    }
    return pump();
  }
  function xmlText(x) {
    var out = '', re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>|<w:tab\s*\/>|<w:br\s*\/>|<\/w:tc>/g, m;
    while ((m = re.exec(x))) {
      if (m[1] !== undefined) out += m[1];
      else if (m[0] === '</w:p>' || /^<w:br/.test(m[0])) out += '\n';
      else out += '\t';
    }
    return out.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&#(\d+);/g, function (_, c) { return String.fromCharCode(+c); }).replace(/&amp;/g, '&');
  }

  /* email addresses, phone numbers and web links (except a LinkedIn profile) never leave this device */
  function clean(t) {
    t = String(t || '').replace(/\r/g, '\n').replace(/ /g, ' ');
    t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ' ');
    t = t.replace(/\b(?:https?:\/\/|www\.)[^\s)>\]]+/gi, function (u) { return /linkedin\.com\/in\//i.test(u) ? u : ' '; });
    t = t.replace(/(?:\+|\b00)\d[\d\s().-]{7,}\d/g, ' ');
    t = t.replace(/\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, ' ');
    t = t.replace(/\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g, ' ');
    t = t.replace(/\b0\d{1,2}[\s.-]\d{3}[\s.-]\d{4}\b/g, ' ');
    t = t.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return t.slice(0, MAX_CHARS);
  }
  APP.cvClean = clean;

  /* ---------- 2. ask the function ---------- */
  function lists() {
    var specs = [];
    Object.keys(APP.SPECIAL_IDX || {}).forEach(function (id) { var s = APP.SPECIAL_IDX[id]; if (s && !s.hidden) specs.push({ id: id, name: s.name }); });
    return {
      products: CATALOG.products.map(function (p) { return { id: p.id, name: p.name, modules: p.modules.map(function (m) { return { id: m.id, name: m.name }; }) }; }),
      specialties: specs,
      roleTypes: APP.roleTypes.map(function (r) { return { id: r.id, name: r.name }; }),
      industries: APP.industries.slice(), languages: APP.languages.slice(), nationalities: APP.nationalities.slice()
    };
  }
  function post(text, token) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 60000);
    return fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text: text, lists: lists() }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.profile) throw { code: (j && j.error) || 'service' }; return j.profile; });
      }, function () { clearTimeout(to); throw { code: 'network' }; });
  }

  /* ---------- 3. fill the wizard (blank fields only; nothing is overwritten) ---------- */
  var ALIAS = { 'uae': 'united arab emirates', 'u.a.e': 'united arab emirates', 'u.a.e.': 'united arab emirates', 'ksa': 'saudi arabia', 'uk': 'united kingdom', 'u.k.': 'united kingdom', 'england': 'united kingdom', 'usa': 'united states', 'u.s.a.': 'united states', 'us': 'united states', 'united states of america': 'united states', 'turkiye': 'turkey', 'türkiye': 'turkey' };
  function countryId(name) {
    var n = String(name || '').trim().toLowerCase(); if (!n) return '';
    n = ALIAS[n] || n;
    var c = APP.countries.filter(function (x) { return String(x.name).toLowerCase() === n; })[0];
    return c ? c.id : '';
  }
  function cityName(cid, city) {
    var c = APP.countriesById[cid], n = String(city || '').trim().toLowerCase(); if (!c || !n) return '';
    return (c.cities || []).filter(function (x) { return String(x).toLowerCase() === n; })[0] || '';
  }
  function skillRows(p, rp) {
    var rows = [], tracked = rp.skills === 'full' || rp.skills === 'optional';
    if (rp.skills === 'products') {
      p.products.forEach(function (pid) { rows.push({ productId: pid, moduleId: '*', projects: 0, certified: p.skills.some(function (k) { return k.productId === pid && k.certified; }) }); });
      return rows;
    }
    p.skills.forEach(function (k) { rows.push({ productId: k.productId, moduleId: k.moduleId, projects: tracked ? Math.max(1, k.projects || 0) : 0, certified: !!k.certified }); });
    p.products.forEach(function (pid) { if (!rows.some(function (r) { return r.productId === pid; })) rows.push({ productId: pid, moduleId: '', projects: 0, certified: false }); });
    return rows;
  }
  function plural(n, w, pl) { return n + ' ' + (n === 1 ? w : (pl || w + 's')); }

  APP.cvApply = apply;
  function apply(p) {
    var w = APP.wizC; if (!w) return;
    APP.syncFormsToDrafts(null); /* keep whatever was typed while the CV was being read */
    var d = w.data, parts = [], blank = function (v) { return v == null || v === '' || (Array.isArray(v) && !v.length); };
    var put = function (k, v) { if (v && blank(d[k])) { d[k] = v; return true; } return false; };
    /* role first: it decides which questions the later steps ask */
    if (!APP.rtList(d).length && p.roleType && APP.roleTypeById[p.roleType]) { APP.rtSet(d, [p.roleType]); d._rtFor = d.roleType; parts.push('your main role'); }
    var rp = APP.roleProfile(d);
    var a = put('firstName', p.firstName), b = put('lastName', p.lastName), c = put('headline', p.headline);
    if (a || b || c) parts.push('your name and title');
    put('linkedin', p.linkedin);
    var cid = countryId(p.country);
    if (cid && blank(d.country)) { d.country = cid; d.city = cityName(cid, p.city) || d.city || ''; parts.push('your location'); }
    else if (cid && d.country === cid && blank(d.city)) d.city = cityName(cid, p.city);
    put('nationality', p.nationality);
    if (!(d.languages || []).length && (p.languages || []).length) { d.languages = p.languages.slice(); parts.push('your languages'); }
    if (p.yearsExp > 0) {
      d.yearsExp = Math.max(1, Math.min(30, p.yearsExp));
      d.level = d.roleType === 'junior' ? 'Junior' : (rp.lvl ? APP.levelFromYears(d.yearsExp) : d.level);
      parts.push('your years of experience');
    }
    /* SAP skills in the shape this role is asked for */
    var rows = skillRows(p, rp), have = d.skills || [], added = 0;
    rows.forEach(function (r) {
      var same = have.some(function (h) { return h.productId === r.productId && ((h.moduleId || '') === r.moduleId || (r.moduleId === '' && h.productId === r.productId)); });
      if (!same) { have.push(r); added++; }
    });
    d.skills = have;
    var nMod = rows.filter(function (r) { return r.moduleId && r.moduleId !== '*'; }).length, nProd = p.products.length;
    if (added) parts.push(plural(nProd, 'SAP product') + (nMod ? ' and ' + plural(nMod, 'module') : ''));
    /* industries and specialties: only what this role is asked for, and never more than the wizard allows */
    var indMax = rp.ind === 'one' ? 1 : rp.ind ? 5 : 0, inds = (d.industries || []).slice();
    (p.industries || []).forEach(function (x) { if (inds.length < indMax && inds.indexOf(x) === -1) inds.push(x); });
    if (inds.length > (d.industries || []).length) { d.industries = inds; parts.push('your industries'); }
    var sp = (d.specialties || []).slice(), sp0 = sp.length;
    (p.specialties || []).forEach(function (id) { if (sp.length < 8 && sp.indexOf(id) === -1 && APP.SPECIAL_IDX[id] && !APP.SPECIAL_IDX[id].hidden) sp.push(id); });
    if (sp.length > sp0) { d.specialties = sp; parts.push(plural(sp.length - sp0, 'specialty', 'specialties')); }
    var own = APP.tagList(d.otherSkills), own0 = own.length;
    (p.otherSkills || []).forEach(function (x) { if (own.indexOf(x) === -1 && own.length < 8) own.push(x); });
    if (own.length > own0) d.otherSkills = own;
    if (put('summary', p.summary)) parts.push('a short summary');
    w.cvImp = { done: true, found: { parts: parts, estimated: nMod > 0 && (rp.skills === 'full' || rp.skills === 'optional') } };
    APP.backend.saveWizardDraft('consultant');
    APP._formSyncSkip = ['wiz-c'];
    APP.render();
  }
})();
