/* ARNOUR — first-touch source.
   Remembers, in this browser only, which link or campaign first brought a visitor (for example a Facebook group post),
   so a new account can be tied to it. No cookies, no third-party services, nothing is sent anywhere by this file.
   Loaded on the app page and on the static landing pages (same site, same browser storage). */
(function () {
  var KEY = 'arnour_ft', MAX_AGE = 90 * 86400000;
  /* only these names are ever used for the anonymous counters, so a made-up ?utm_source= cannot flood them */
  var BUCKETS = ['facebook', 'instagram', 'linkedin', 'google', 'x', 'whatsapp', 'telegram', 'youtube', 'email', 'other'];
  var ALIAS = { fb: 'facebook', 'facebook.com': 'facebook', meta: 'facebook', ig: 'instagram', li: 'linkedin', lnkd: 'linkedin', twitter: 'x', 'x.com': 'x', wa: 'whatsapp', tg: 'telegram', yt: 'youtube', mail: 'email', newsletter: 'email', gmail: 'email' };
  var HOSTS = [[/(^|\.)(facebook|fb)\.com$|(^|\.)fb\.me$/, 'facebook'], [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, 'linkedin'],
    [/(^|\.)google\.[a-z.]+$/, 'google'], [/(^|\.)(twitter|x)\.com$|^t\.co$/, 'x'], [/(^|\.)whatsapp\.com$|^wa\.me$/, 'whatsapp'], [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube']];
  var OWN = /(^|\.)arnour\.com$|^localhost$|^127\.0\.0\.1$/;

  function clean(v, n) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n || 40); }
  function param(search, name) {
    var m = String(search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < m.length; i++) { var kv = m[i].split('='); if (kv[0] === name) { try { return decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); } catch (e) { return kv[1] || ''; } } }
    return '';
  }
  function bucketOf(s) {
    s = clean(s, 40); if (!s || s === 'direct') return 'direct';
    if (ALIAS[s]) s = ALIAS[s];
    return BUCKETS.indexOf(s) >= 0 ? s : 'other';
  }
  function hostOf(ref) { var m = String(ref || '').match(/^https?:\/\/([^/:?#]+)/i); return m ? m[1].toLowerCase() : ''; }

  /* what this visit says about where it came from; { s: 'direct' } when it says nothing */
  function read(search, referrer, path) {
    var src = clean(param(search, 'utm_source'), 40), med = clean(param(search, 'utm_medium'), 30), cmp = clean(param(search, 'utm_campaign'), 50), ct = clean(param(search, 'utm_content'), 50);
    var gc = String(param(search, 'gclid')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100), fbc = String(param(search, 'fbclid')).replace(/[^A-Za-z0-9_-]/g, '');
    var rh = hostOf(referrer); if (OWN.test(rh)) rh = '';
    if (!src) {
      if (gc) { src = 'google'; med = med || 'cpc'; }
      else if (fbc) { src = 'facebook'; med = med || 'referral'; }
      else if (rh) { for (var i = 0; i < HOSTS.length; i++) { if (HOSTS[i][0].test(rh)) { src = HOSTS[i][1]; break; } } if (!src) src = rh.replace(/^www\./, '').slice(0, 40); med = med || (src === 'google' ? 'organic' : 'referral'); }
    }
    if (!src) return { s: 'direct' };
    var o = { s: src, b: bucketOf(src), m: med || 'link', l: String(path || '/').replace(/[^A-Za-z0-9/_.-]/g, '').slice(0, 60) || '/', t: Date.now() };
    if (cmp) o.c = cmp; if (ct) o.ct = ct; if (gc) o.gc = gc; if (rh) o.r = rh.slice(0, 40);
    return o;
  }

  var store = { get: function () { try { return window.localStorage.getItem(KEY); } catch (e) { return null; } }, set: function (v) { try { window.localStorage.setItem(KEY, v); return true; } catch (e) { return false; } } };
  var A = { fresh: false };
  A.read = read; A.bucketOf = bucketOf;
  /* the remembered first touch, or null */
  A.get = function () {
    var raw = store.get(); if (!raw) return null;
    try { var o = JSON.parse(raw); if (o && o.s && o.t && Date.now() - o.t < MAX_AGE) return o; } catch (e) { /* ignore */ }
    return null;
  };
  A.bucket = function () { var o = A.get(); return o ? (o.b || bucketOf(o.s)) : 'direct'; };
  /* what to save on the account: short, plain text only */
  A.forAccount = function () { var o = A.get(); if (!o) return null; var out = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && k !== 'n') out[k] = o[k]; return out; };
  /* the app counts each new visitor from a source once: true the first time it asks for a remembered source, false afterwards */
  A.takeLandingCount = function () { var o = A.get(); if (!o || o.n) return false; o.n = 1; return store.set(JSON.stringify(o)); };
  A.capture = function () {
    try {
      var path = (window.__arnourEntry || (window.location && window.location.pathname) || '/');
      var now = read(window.location && window.location.search, document.referrer, path);
      if (now.s === 'direct') return;              /* nothing to remember */
      var had = A.get();
      if (had) return;                              /* first touch wins until it is 90 days old */
      if (store.set(JSON.stringify(now))) A.fresh = true;
    } catch (e) { /* never get in the way of the page */ }
  };
  window.ArnourFT = A;
  A.capture();
})();
