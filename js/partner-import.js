/* ============================================================================
   ARNOUR — PARTNER PAGE FROM A COMPANY PRESENTATION ("Build it from your company presentation")
   Loaded on demand by partners.js: only on the live site, only for an SI/Partner who is signing up or editing the company profile.
   1. This page reads the TEXT of the presentation (PDF with the bundled pdf.js; DOCX and PPTX with the browser's own unzip)
      and removes email addresses, phone numbers and web links.
   2. The text goes to /.netlify/functions/partner-parse, which asks Claude to fill in the team capabilities using
      Arnour's own product / module / specialty / country lists (so nothing outside the catalog can come back).
   3. The answer fills the form (blank fields only, nothing is overwritten). The company checks it and saves as usual.
   Nothing here saves a profile, and the text of the file is never stored.
   ============================================================================ */
(function () {
  'use strict';
  var FN = '/.netlify/functions/partner-parse';
  var MAX_BYTES = 25 * 1024 * 1024, MAX_PAGES = 40, MAX_CHARS = 30000, MAX_XML = 20e6, MAX_SLIDES = 80;
  var S = APP.ptImp = { ready: false, configured: false, state: 'idle', msg: '', done: null, dismissed: null };
  var esc = function (s) { return APP.h(s == null ? '' : s); };

  APP.ptImpInit = function () {
    if (S.ready) { refresh(); return; }
    fetch(FN, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { S.configured = !!(j && j.configured); }, function () { S.configured = false; })
      .then(function () { S.ready = true; refresh(); });
  };
  function refresh() { var el = document.getElementById('pt-slot'); if (el) el.innerHTML = APP.ptImpCardHtml(); }

  /* ---------- the card ---------- */
  APP.ptImpCardHtml = function () {
    var host = APP.ptHost && APP.ptHost();
    if (!host || host.companyType !== 'partner' || !S.ready || !S.configured) return '';
    if (S.done && S.done.host === host) return foundHtml(S.done);
    if (S.dismissed === host) return '';
    var busy = S.state === 'reading';
    return '<section class="wiz-sec cv-import pt-import" data-sec="ptimp">' +
      '<div class="wiz-sec-h"><span class="wiz-sec-ico">' + APP.icon('spark', 18) + '</span><h2>Build it from your company presentation <span class="muted">(optional)</span></h2></div>' +
      '<p class="field-hint">Upload your company profile or presentation and we fill in your team skills, industries, countries and more, so you only check and correct it. It takes about 15 seconds.</p>' +
      (busy
        ? '<p class="live-note cv-reading" role="status"><span class="cv-spin" aria-hidden="true"></span> Reading your presentation…</p>'
        : '<div class="cv-import-row"><label class="cv-drop">' + APP.icon('file', 18) + '<span>Upload PDF, PowerPoint (.pptx) or Word (.docx)</span><input type="file" accept=".pdf,.pptx,.docx" data-pt-import hidden></label>' +
          '<button type="button" class="link-btn" data-pt-act="dismiss">No thanks, I will fill it in myself</button></div>') +
      (S.state === 'error' && S.msg ? '<p class="field-error" role="alert">' + esc(S.msg) + '</p>' : '') +
      '<p class="muted small cv-consent">' + APP.icon('lock', 13) + ' We read the file once with AI (Anthropic\'s Claude) to fill in this form. Email addresses, phone numbers and web links are removed on your device first. The text is not stored by Arnour, not used to train AI and not shown to anyone, and the file itself is not kept. Please leave prices out: they are not used.</p>' +
      '</section>';
  };
  function foundHtml(done) {
    return '<section class="wiz-sec cv-import cv-found pt-import" data-sec="ptimp">' +
      '<div class="wiz-sec-h"><span class="wiz-sec-ico">' + APP.icon('check', 18) + '</span><h2>We read your presentation</h2></div>' +
      (done.parts.length ? '<p>We filled in ' + esc(done.parts.join(', ')) + '. <b>Please check it</b> before you continue. Nothing is saved until you finish.</p>' : '<p>We could not find much to fill in. Please complete the form yourself.</p>') +
      '</section>';
  }

  /* ---------- clicks and file choice ---------- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[data-pt-import]')) return;
    var file = t.files && t.files[0]; t.value = '';
    if (file) run(file);
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-pt-act]');
    if (!b) return;
    if (b.getAttribute('data-pt-act') === 'dismiss') { S.dismissed = APP.ptHost(); S.state = 'idle'; S.msg = ''; refresh(); }
  });

  var MSG = {
    no_text: 'We could not find readable text in this file (it may be made of pictures). Try another file, or fill in the form yourself.',
    not_a_profile: 'This file does not look like a company profile. Try another file, or fill in the form yourself.',
    limit: 'You have used all of today\'s reads. Please fill in the form yourself, or try again tomorrow.',
    busy: 'Reading is very busy right now. Please try again in a few minutes, or fill in the form yourself.',
    signin: 'Please sign in again, then try once more.',
    network: 'Could not reach the server. Check your connection and try again.',
    file: 'We could not open this file. Try another file, or fill in the form yourself.'
  };
  function fail(code, text) { S.state = 'error'; S.msg = text || MSG[code] || 'We could not read this file. Please try again, or fill in the form yourself.'; refresh(); }

  function run(file) {
    var host = APP.ptHost && APP.ptHost();
    if (S.state === 'reading' || !host) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'doc' || ext === 'ppt') return fail('', 'Old Office files (.' + ext + ') cannot be read. Save it as ' + (ext === 'ppt' ? 'PPTX or PDF' : 'DOCX or PDF') + ' and upload it again, or fill in the form yourself.');
    if (ext !== 'pdf' && ext !== 'docx' && ext !== 'pptx') return fail('', 'Please upload a PDF, PPTX or DOCX file.');
    if (file.size > MAX_BYTES) return fail('', 'That file is larger than 25 MB.');
    S.state = 'reading'; S.msg = ''; refresh();
    extract(file, ext).then(function (raw) {
      var text = clean(raw);
      if (text.length < 200) throw { code: 'no_text' };
      return APP.backend.ensureSession().then(function (s) {
        if (!s || !s.access_token) throw { code: 'signin' };
        return post(text, s.access_token);
      });
    }).then(function (partner) {
      S.state = 'idle'; S.msg = '';
      if (APP.ptHost() !== host) return; /* the person moved away while it was being read */
      apply(host, partner);
    }).catch(function (e) { fail(e && e.code); });
  }

  /* ---------- 1. read the text on this device ---------- */
  function extract(file, ext) {
    return file.arrayBuffer().then(function (buf) { return ext === 'pdf' ? pdfText(buf) : zipText(buf, ext); })
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
        return chain.then(function () { try { doc.destroy(); } catch (e) { /* ignore */ } return out.join('\n\n'); });
      });
    });
  }
  /* a .docx / .pptx is a zip file. The browser unzips the few XML parts it needs with its built-in DecompressionStream. */
  function zipList(buf) {
    var v = new DataView(buf), bytes = new Uint8Array(buf), eocd = -1, i;
    for (i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) { if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw { code: 'file' };
    var n = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), list = [], k;
    for (k = 0; k < n; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
      list.push({ name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nl)), method: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), at: v.getUint32(p + 42, true) });
      p += 46 + nl + el + cl;
    }
    return { v: v, bytes: bytes, list: list };
  }
  function zipRead(z, e) {
    var start = e.at + 30 + z.v.getUint16(e.at + 26, true) + z.v.getUint16(e.at + 28, true);
    var raw = z.bytes.subarray(start, start + e.size);
    return (e.method === 0 ? Promise.resolve(raw) : inflate(raw)).then(function (b) { return new TextDecoder('utf-8').decode(b); });
  }
  function zipText(buf, ext) {
    var z = zipList(buf), names;
    if (ext === 'docx') names = z.list.filter(function (e) { return e.name === 'word/document.xml'; });
    else {
      names = z.list.filter(function (e) { return /^ppt\/slides\/slide\d+\.xml$/.test(e.name); })
        .sort(function (a, b) { return num(a.name) - num(b.name); }).slice(0, MAX_SLIDES);
    }
    if (!names.length) throw { code: 'file' };
    var out = [], chain = Promise.resolve();
    names.forEach(function (e) { chain = chain.then(function () { return zipRead(z, e); }).then(function (x) { out.push(ext === 'docx' ? xmlText(x, 'w') : xmlText(x, 'a')); }); });
    return chain.then(function () { return out.join('\n\n'); });
  }
  function num(n) { return +(n.match(/(\d+)\.xml$/) || [0, 0])[1]; }
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
  /* w = Word (<w:t>, <w:p>), a = PowerPoint / DrawingML (<a:t>, <a:p>) */
  function xmlText(x, ns) {
    var out = '', re = new RegExp('<' + ns + ':t(?:\\s[^>]*)?>([^<]*)<\\/' + ns + ':t>|<\\/' + ns + ':p>|<' + ns + ':br\\s*\\/>|<\\/' + ns + ':tc>', 'g'), m;
    while ((m = re.exec(x))) {
      if (m[1] !== undefined) out += m[1];
      else if (/<\/.:p>/.test(m[0]) || /:br/.test(m[0])) out += '\n';
      else out += '\t';
    }
    return out.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&#(\d+);/g, function (_, c) { return String.fromCharCode(+c); }).replace(/&amp;/g, '&');
  }

  /* email addresses, phone numbers and web links never leave this device */
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
  APP.ptImpClean = clean;
  APP.ptImpText = { xmlText: xmlText };

  /* ---------- 2. ask the function ---------- */
  function lists() {
    var specs = [];
    Object.keys(APP.SPECIAL_IDX || {}).forEach(function (id) { var s = APP.SPECIAL_IDX[id]; if (s && !s.hidden) specs.push({ id: id, name: s.name }); });
    return {
      products: CATALOG.products.map(function (p) { return { id: p.id, name: p.name, modules: p.modules.map(function (m) { return { id: m.id, name: m.name }; }) }; }),
      specialties: specs,
      countries: APP.countries.map(function (c) { return { id: c.id, name: c.name }; }),
      industries: APP.industries.slice(), languages: APP.languages.slice()
    };
  }
  function post(text, token) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 60000);
    return fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ text: text, lists: lists() }), signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.partner) throw { code: (j && j.error) || 'service' }; return j.partner; });
      }, function () { clearTimeout(to); throw { code: 'network' }; });
  }

  /* ---------- 3. fill the form (blank fields only; nothing is overwritten) ---------- */
  function plural(n, w, pl) { return n + ' ' + (n === 1 ? w : (pl || w + 's')); }
  APP.ptImpApply = apply;
  function apply(host, r) {
    APP.syncFormsToDrafts(null); /* keep whatever was typed while the file was being read */
    var p = APP.ptEnsure(host), parts = [];
    var union = function (key, max) {
      var have = p[key].slice(), n0 = have.length;
      (r[key] || []).forEach(function (x) { if (have.length < max && have.indexOf(x) === -1) have.push(x); });
      if (have.length > n0) { p[key] = have; return have.length - n0; } return 0;
    };
    /* skills: add rows that are not there yet (a product with no module chosen yet is replaced by its modules) */
    var added = 0, prods = {};
    (r.skills || []).forEach(function (k) {
      var same = p.skills.some(function (h) { return h.productId === k.productId && h.moduleId === k.moduleId; });
      if (same) return;
      p.skills = p.skills.filter(function (h) { return !(h.productId === k.productId && !h.moduleId); });
      p.skills.push({ productId: k.productId, moduleId: k.moduleId, projects: k.projects || 0, certified: !!k.certified }); added++; prods[k.productId] = 1;
    });
    if (added) parts.push(plural(Object.keys(prods).length, 'SAP product') + ' and ' + plural(added, 'module'));
    var ni = union('industries', 20); if (ni) parts.push('industries');
    var nsp = union('specialties', 40); if (nsp) parts.push(plural(nsp, 'specialty', 'specialties'));
    var nc = union('countries', 60); if (nc) parts.push('countries');
    var nl = union('languages', 20); if (nl) parts.push('languages');
    var nd = union('delivery', 3), ne = union('engagement', 3); if (nd || ne) parts.push('how you deliver');
    if (!p.teamSize && r.teamSize) { p.teamSize = r.teamSize; parts.push('team size'); }
    if (!String(p.bestAt || '').trim() && r.bestAt) { p.bestAt = r.bestAt; parts.push('what you are best at'); }
    if (!String(host.about || '').trim() && r.about) { host.about = r.about; parts.push('the About text'); }
    S.done = { host: host, parts: parts };
    if (APP._ptHostWiz && APP.backend && APP.backend.saveWizardDraft) APP.backend.saveWizardDraft('employer');
    APP._formSyncSkip = [APP._ptHostWiz ? 'wiz-e' : 'company-edit'];
    APP.render();
  }
})();
