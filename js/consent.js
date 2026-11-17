/* Arnour — consent for measurement (Google Ads conversion tag and Google Analytics 4).
   Nothing here does anything until a Google Ads ID (ARNOUR_CONFIG.ads.id, e.g. 'AW-123456789') or a GA4 Measurement ID
   (ARNOUR_CONFIG.ga.id, e.g. 'G-ABCDE12345') is set in js/config.js. With an ID set:
   - visitors whose browser says they are in Europe (time zone Europe/* or the Atlantic islands that belong to it) are asked
     once with a small bar; for them the default is NO: no Google script, no cookie, nothing sent until Accept.
   - everyone else is measured by default (no bar); the Privacy page says so, and the footer link "Ad measurement choice" lets
     anyone switch it off (or on) at any time. A choice made there is remembered and wins over the default.
   - measurement means: the Google tag is loaded with consent for ad measurement and analytics only (no ad personalisation, no
     Google signals), a finished profile is reported as a conversion (labels in ARNOUR_CONFIG.ads.convC / .convE), and Analytics
     gets one page_view per screen with the PAGE TYPE only (e.g. /app/job-detail), never an id, name or email, plus a few events.
   A choice is kept in this browser under "arnour-consent" ("yes" or "no" and the date). The IDs and labels are public values. */
(function () {
  'use strict';
  var CFG = (window.ARNOUR_CONFIG && window.ARNOUR_CONFIG.ads) || {};
  var GCFG = (window.ARNOUR_CONFIG && window.ARNOUR_CONFIG.ga) || {};
  var ID = /^AW-[A-Za-z0-9]{4,20}$/.test(String(CFG.id || '')) ? String(CFG.id) : '';
  var GID = /^G-[A-Za-z0-9]{4,20}$/.test(String(GCFG.id || '')) ? String(GCFG.id) : '';
  var KEY = 'arnour-consent', loaded = false, C = {};
  function label(v) { return /^[A-Za-z0-9_-]{4,60}$/.test(String(v || '')) ? String(v) : ''; }
  function read() { try { var o = JSON.parse(window.localStorage.getItem(KEY) || 'null'); return o && (o.v === 'yes' || o.v === 'no') ? o : null; } catch (e) { return null; } }
  function write(v) { try { window.localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); return true; } catch (e) { return false; } }
  C.on = function () { return !!(ID || GID); };                       /* is there anything to ask about? */
  /* does this visitor have to be asked first? (best guess from the browser's time zone; when in doubt for Europe we ask) */
  C.asks = function () {
    try { var z = String(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); return /^Europe\//.test(z) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$/.test(z); }
    catch (e) { return true; }
  };
  C.state = function () { var o = read(); return o ? o.v : ''; };                    /* the person's own choice: 'yes', 'no' or '' */
  C.granted = function () { var v = C.state(); return !!(ID || GID) && (v ? v === 'yes' : !C.asks()); };
  function gtag() { window.dataLayer.push(arguments); }
  /* the click id Google put on the ad link was noted by js/attribution.js on the first visit; after consent it is handed to the
     Google tag in the cookie that tag reads, because the address no longer carries it by the time the person accepts */
  function clickCookie() {
    try {
      var ft = window.ArnourFT && window.ArnourFT.get && window.ArnourFT.get();
      if (!ft || !ft.gc || /(^|;\s*)_gcl_aw=/.test(document.cookie)) return;
      var secs = Math.floor((ft.t || Date.now()) / 1000);
      document.cookie = '_gcl_aw=GCL.' + secs + '.' + ft.gc + '; path=/; max-age=7776000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* ignore */ }
  }
  var lastLoc = '';
  function query() {
    var keep = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid'], out = [], q = String(window.location.search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < q.length; i++) { var kv = q[i].split('='); if (keep.indexOf(kv[0]) >= 0 && /^[A-Za-z0-9._~%+-]{1,100}$/.test(kv[1] || '')) out.push(kv[0] + '=' + kv[1]); }
    return out.length ? '?' + out.join('&') : '';
  }
  /* what Google may see for this screen: the page TYPE as title, a made-up path, and only allowlisted campaign tags */
  var autoView = '';
  function place(view, landing) {
    view = String(view || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'app';
    var path = landing ? '/' + view + '/' : '/app/' + view, ref = lastLoc;
    if (!ref) { var m = String(document.referrer || '').match(/^(https?:\/\/[^/?#]+)/i); ref = m && m[1] !== window.location.origin ? m[1] + '/' : ''; }
    var p = { page_location: window.location.origin + path + (lastLoc ? '' : query()), page_path: path, page_title: view };
    if (ref) p.page_referrer = ref;
    return { p: p, view: view, base: window.location.origin + path };
  }
  function nowView() {
    if (LP) return { v: LP[1], l: true };
    try { var r = window.APP && APP.parseRoute && APP.parseRoute(); if (r && r.view) return { v: r.view, l: false }; } catch (e) { /* ignore */ }
    return { v: 'app', l: false };
  }
  function load() {
    if (loaded || !C.granted()) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    var upd = {}; if (ID) { upd.ad_storage = 'granted'; upd.ad_user_data = 'granted'; } if (GID) upd.analytics_storage = 'granted';
    window.gtag('consent', 'update', upd);
    if (ID) clickCookie();
    window.gtag('js', new Date());
    /* Google's own tag sends one automatic page view when it starts, with the real page title and full address (a role title, an id,
       any query). Whatever it reads comes from here, so the sanitized values are set BEFORE the config calls; that automatic view then
       is our page view of this screen and page() below does not send a second one. */
    var nv = nowView(), pl = place(nv.v, nv.l); lastLoc = pl.base; autoView = pl.view;
    window.gtag('set', pl.p);
    /* no automatic page view from either tag: it would carry the real page title and address (a role title, an id) into Analytics; our own sanitized page_view replaces it */
    if (ID) window.gtag('config', ID, { send_page_view: false });
    /* Analytics: no automatic page view (the app is one page, we send our own with page types), no Google signals, no ad personalisation */
    if (GID) window.gtag('config', GID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GID || ID);
    document.head.appendChild(s);
  }
  /* a finished profile: role 'c' (professional) or 'e' (company). Sent only with consent and a label; returns true when sent. */
  C.conversion = function (role) {
    var lb = label(role === 'e' ? CFG.convE : CFG.convC);
    if (!ID || !C.granted() || !lb) return false;
    load();
    window.gtag('event', 'conversion', { send_to: ID + '/' + lb });
    return true;
  };
  /* ---- Google Analytics: page types and a few events, nothing personal ---- */
  /* view = a page type such as 'job-detail' or 'jobs'; landing = true for the static pages (/about/, /sap-jobs/, /sap-consultants/) */
  C.page = function (view, landing) {
    if (!GID || !C.granted()) return false;
    var wasLoaded = loaded; load();
    var pl = place(view, landing);
    if (!wasLoaded || autoView === pl.view) { autoView = ''; return true; }   /* the automatic view of this load already carries it */
    autoView = '';
    lastLoc = pl.base;
    window.gtag('set', pl.p);
    window.gtag('event', 'page_view', pl.p);
    return true;
  };
  /* events: only these names, and only these two plain parameters */
  var EVENTS = /^(apply_click|profile_complete|share|cv_import)$/;
  C.event = function (name, role, channel) {
    if (!GID || !EVENTS.test(String(name)) || !C.granted()) return false;
    load();
    var p = {}; if (role === 'c' || role === 'e') p.role = role; if (/^[a-z]{2,12}$/.test(String(channel || ''))) p.channel = String(channel);
    window.gtag('event', String(name), p);
    return true;
  };
  function bar() { return document.getElementById('consent-bar'); }
  C.hide = function () { var b = bar(); if (b) b.remove(); };
  C.show = function () {
    if (!C.on() || bar()) return;
    var b = document.createElement('div');
    b.id = 'consent-bar'; b.className = 'consent-bar'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Measurement');
    b.innerHTML = '<p>May we measure how people find and use Arnour? If you accept, Google Analytics learns which kinds of pages are visited (never names or emails), and Google Ads learns that someone who clicked an ad created a profile. No ad personalisation. You can change this any time at the bottom of the page. <a href="#/privacy">Privacy</a></p>' +
      '<div class="consent-btns"><button type="button" class="btn btn-outline btn-sm" data-consent="no">Decline</button><button type="button" class="btn btn-outline btn-sm" data-consent="yes">Accept</button></div>';
    b.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-consent]') : null; if (!t) return;
      C.set(t.getAttribute('data-consent'));
    });
    document.body.appendChild(b);
  };
  C.set = function (v) {
    v = v === 'yes' ? 'yes' : 'no';
    write(v); C.hide();
    if (v === 'yes') { load(); try { var r = !LP && window.APP && APP.parseRoute && APP.parseRoute(); if (r && r.view) C.page(r.view); } catch (e) { /* ignore */ } }
    else if (loaded && window.gtag) window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', analytics_storage: 'denied' }); /* changed their mind: stop for the rest of the visit */
  };
  /* the three static landing pages carry this file without the app: they only send their own page view (no bar there; in Europe nothing is sent until a choice is made in the app) */
  var LP = /^\/(about|sap-consultants|sap-jobs)\/?$/.exec(String(window.location.pathname || ''));
  C.start = function () {
    if (!C.on()) return;
    if (LP) { if (C.granted()) { load(); C.page(LP[1], true); } return; }
    if (C.granted()) load(); else if (!C.state()) C.show();
  };
  window.ArnourConsent = C;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', C.start); else C.start();
})();
