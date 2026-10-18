/* Arnour — "Report a problem", automatic error log and light usage counts (live mode only). */
(function () {
  'use strict';
  var B = APP.backend, h = APP.h;
  if (!B) return;

  /* ---------- recent errors kept in memory so a report can include them ---------- */
  var recent = [], sent = {}, sentN = 0;
  function pageNow() { return String(location.hash || '#/').replace(/[?].*$/, '').slice(0, 120).replace(/\/(?:[0-9a-f]{8}-[0-9a-f-]{20,}|[a-z]-[0-9a-z]{6,})/gi, '/…'); }
  function noteError(msg, src) {
    msg = String(msg || '').trim(); if (!msg) return;
    if (/^script error\.?$/i.test(msg) || /ResizeObserver|chrome-extension|moz-extension|safari-extension|Non-Error promise rejection/i.test(msg + ' ' + (src || ''))) return;
    recent.push({ t: new Date().toISOString().slice(11, 19), m: msg.slice(0, 160), s: String(src || '').slice(0, 80) });
    if (recent.length > 5) recent.shift();
    var key = msg + '|' + src;
    if (sent[key] || sentN >= 10) return;
    sent[key] = 1; sentN++;
    B.rpc('log_client_error', { p_message: msg, p_src: String(src || ''), p_page: pageNow(), p_ua: navigator.userAgent }).then(null, function () { /* never loop on our own failure */ });
  }
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window) return; /* images / scripts failing to load */
    noteError(e && e.message, (e && e.filename ? String(e.filename).replace(/^.*\//, '') : '') + (e && e.lineno ? ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason; noteError('Unhandled: ' + ((r && (r.message || r.code)) || r), 'promise');
  });
  /* failed saves / loads (not the plain "please fix this" messages the server sends on purpose) */
  B.onRpcError = function (fn, err) {
    if (fn === 'log_client_error' || fn === 'track_usage' || fn === 'submit_feedback') return;
    if (err && err.code === 'P0001') return;
    var m = String((err && err.message) || err || ''); if (/fetch|network|load failed|timeout|abort/i.test(m)) return;
    noteError('RPC ' + fn + ' failed: ' + m, 'rpc');
  };

  /* ---------- usage counts: page views by section, no cookies, no identity ---------- */
  var lastSeen = '';
  function track(name) { if (name && name !== lastSeen) { lastSeen = name; B.rpc('track_usage', { p_name: name }).then(null, function () {}); } }
  function trackRoute() {
    var seg = String(location.hash || '#/').replace(/^#\/?/, '').split(/[/?]/)[0].toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'home';
    track('v:' + seg);
  }
  window.addEventListener('hashchange', trackRoute); trackRoute();
  var oExt = APP.openExternalApply; if (oExt) APP.openExternalApply = function () { track('ext_apply'); lastSeen = ''; return oExt.apply(this, arguments); };
  var oApply = APP.applyToJob; if (oApply) APP.applyToJob = function () { track('apply'); lastSeen = ''; return oApply.apply(this, arguments); };

  /* ---------- the report form ---------- */
  var F = { open: false, busy: false, err: '', done: false, cat: 'problem', text: '', email: '', fileName: '' };
  function root() { return document.getElementById('fb-root'); }
  function render() {
    fab();
    var r = root(); if (!r) { r = document.createElement('div'); r.id = 'fb-root'; document.body.appendChild(r); }
    if (!F.open) { r.innerHTML = ''; r.className = ''; document.body.classList.remove('no-scroll'); return; }
    document.body.classList.add('no-scroll');
    var signed = !!B.user;
    var cats = [['problem', 'Something is not working'], ['suggestion', 'A suggestion'], ['other', 'Something else']];
    var body = F.done
      ? '<p>Thank you. We read every report' + (F.email || signed ? ' and may write back to you by email' : '') + '.</p><div class="dlg-foot"><button type="button" class="btn btn-primary" data-action="fb-close">Close</button></div>'
      : '<div class="field"><span class="label">What is this about?</span><div class="chip-wrap">' + cats.map(function (c) {
          return '<button type="button" class="chip' + (F.cat === c[0] ? ' on' : '') + '" data-action="fb-cat" data-v="' + c[0] + '">' + h(c[1]) + '</button>';
        }).join('') + '</div></div>' +
        '<label class="field"><span class="label">What happened?</span><textarea id="fb-text" class="input" rows="5" maxlength="2000" placeholder="What were you trying to do, and what went wrong?">' + h(F.text) + '</textarea></label>' +
        (signed ? '' : '<label class="field"><span class="label">Your email <span class="muted">(optional, so we can reply)</span></span><input id="fb-email" class="input" type="email" maxlength="200" value="' + h(F.email) + '" autocomplete="email"></label>') +
        (signed ? '<label class="field"><span class="label">Screenshot <span class="muted">(optional)</span></span><input id="fb-shot" type="file" accept="image/png,image/jpeg,image/webp"></label>' : '') +
        '<p class="muted small">We also send the page you are on and your browser, so we can find the problem faster.</p>' +
        (F.err ? '<p class="field-error" role="alert">' + h(F.err) + '</p>' : '') +
        '<div class="dlg-foot"><button type="button" class="btn btn-ghost" data-action="fb-close">Cancel</button><button type="button" class="btn btn-primary" data-action="fb-send"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? 'Sending…' : 'Send report') + '</button></div>';
    r.innerHTML = '<div class="dlg-back" data-action="fb-close"></div><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="fb-title"><h2 id="fb-title">Report a problem</h2>' +
      '<p class="dlg-sub">Tell us what is wrong or what could be better.</p><div class="dlg-body">' + body + '</div></div>';
    r.className = 'open';
    var t = document.getElementById('fb-text'); if (t && !F.done) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }
  APP.openFeedback = function (prefill) { F = { open: true, busy: false, err: '', done: false, cat: 'problem', text: prefill ? String(prefill) : '', email: '', fileName: '' }; render(); };
  /* failure messages get a "Report this" link, which opens the form with the message already filled in */
  var oToast = APP.toast;
  APP.toast = function (msg) {
    oToast.apply(this, arguments);
    if (!/could not|couldn.t|failed|went wrong/i.test(String(msg))) return;
    var slot = document.getElementById('toasts'), el = slot && slot.lastElementChild; if (!el) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'toast-report'; b.textContent = 'Report this';
    b.setAttribute('data-action', 'fb-open'); b.setAttribute('data-prefill', 'Message I saw: ' + String(msg).slice(0, 200) + '\n\nWhat I was doing: ');
    el.appendChild(b);
  };
  function readForm() {
    var t = document.getElementById('fb-text'), e = document.getElementById('fb-email');
    if (t) F.text = t.value; if (e) F.email = e.value;
  }
  function send() {
    readForm();
    if (F.text.trim().length < 3) { F.err = 'Please describe the problem.'; render(); return; }
    var fileEl = document.getElementById('fb-shot'), file = fileEl && fileEl.files && fileEl.files[0];
    if (file && (file.size > 3 * 1024 * 1024 || !/^image\/(png|jpe?g|webp)$/.test(file.type))) { F.err = 'The screenshot must be a PNG, JPG or WebP under 3 MB.'; render(); return; }
    F.busy = true; F.err = ''; render();
    var ctx = { errors: recent.slice(), viewport: window.innerWidth + 'x' + window.innerHeight, lang: navigator.language || '' };
    var up = file && B.user
      ? B.sb.storage.from('feedback').upload(B.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + (file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg'), file, { contentType: file.type })
          .then(function (r) { return r.error ? null : r.data.path; }, function () { return null; })
      : Promise.resolve(null);
    up.then(function (path) {
      return B.rpc('submit_feedback', { p_category: F.cat, p_message: F.text.trim(), p_email: F.email.trim(), p_page: pageNow(), p_ua: navigator.userAgent, p_ctx: ctx, p_shot: path });
    }).then(function () {
      F.busy = false; F.done = true; render();
    }, function (e) {
      F.busy = false; var m = String((e && e.message) || '');
      F.err = /too many/i.test(m) ? 'You have sent several reports already. Please try again later.' : /email/i.test(m) ? m : 'Could not send the report. Please try again, or write to contact@arnour.com.';
      render();
    });
  }
  /* always-visible Feedback button (outside #app so page renders never remove it) */
  function fab() {
    var f = document.getElementById('fb-fab');
    if (!f) {
      f = document.createElement('button'); f.type = 'button'; f.id = 'fb-fab'; f.setAttribute('data-action', 'fb-open');
      f.setAttribute('aria-label', 'Report a problem or send feedback');
      f.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Feedback</span>';
      document.body.appendChild(f);
    }
    f.style.display = (/^#\/admin/.test(location.hash) || F.open) ? 'none' : '';
  }
  window.addEventListener('hashchange', fab); fab();

  APP.onClick = function (el, e) {
    var a = el.dataset && el.dataset.action;
    if (a === 'fb-open') { if (e && e.preventDefault) e.preventDefault(); APP.openFeedback(el.dataset.prefill); return; }
    if (a === 'fb-close') { F.open = false; render(); return; }
    if (a === 'fb-cat') { readForm(); F.cat = el.dataset.v; render(); return; }
    if (a === 'fb-send') { send(); return; }
    return prevClick.apply(this, arguments);
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && F.open) { F.open = false; render(); } });
})();
