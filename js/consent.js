/* Arnour — consent for advertising measurement (Google Ads conversion tag).
   Nothing here does anything until a Google Ads ID is set in js/config.js (ARNOUR_CONFIG.ads.id, e.g. 'AW-123456789').
   With an ID set:
   - a small bar at the bottom asks once; the default is NO: until the person presses Accept, no Google script is loaded,
     no cookie is set and nothing is sent. Decline is remembered too (the bar does not come back; the footer link reopens it).
   - after Accept the Google tag is loaded with consent for ad measurement only (no ad personalisation), and a finished
     profile is reported as a conversion (labels in ARNOUR_CONFIG.ads.convC for professionals, .convE for companies).
   The choice is kept in this browser under "arnour-consent" ("yes" or "no" and the date). The IDs and labels are public values. */
(function () {
  'use strict';
  var CFG = (window.ARNOUR_CONFIG && window.ARNOUR_CONFIG.ads) || {};
  var ID = /^AW-[A-Za-z0-9]{4,20}$/.test(String(CFG.id || '')) ? String(CFG.id) : '';
  var KEY = 'arnour-consent', loaded = false, C = {};
  function label(v) { return /^[A-Za-z0-9_-]{4,60}$/.test(String(v || '')) ? String(v) : ''; }
  function read() { try { var o = JSON.parse(window.localStorage.getItem(KEY) || 'null'); return o && (o.v === 'yes' || o.v === 'no') ? o : null; } catch (e) { return null; } }
  function write(v) { try { window.localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); return true; } catch (e) { return false; } }
  C.on = function () { return !!ID; };                       /* is there anything to ask about? */
  C.state = function () { var o = read(); return o ? o.v : ''; };
  C.granted = function () { return !!ID && C.state() === 'yes'; };
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
  function load() {
    if (loaded || !C.granted()) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
    window.gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted' });
    clickCookie();
    window.gtag('js', new Date());
    window.gtag('config', ID);
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
  }
  /* a finished profile: role 'c' (professional) or 'e' (company). Sent only with consent and a label; returns true when sent. */
  C.conversion = function (role) {
    var lb = label(role === 'e' ? CFG.convE : CFG.convC);
    if (!C.granted() || !lb) return false;
    load();
    window.gtag('event', 'conversion', { send_to: ID + '/' + lb });
    return true;
  };
  function bar() { return document.getElementById('consent-bar'); }
  C.hide = function () { var b = bar(); if (b) b.remove(); };
  C.show = function () {
    if (!ID || bar()) return;
    var b = document.createElement('div');
    b.id = 'consent-bar'; b.className = 'consent-bar'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Advertising measurement');
    b.innerHTML = '<p>May we measure whether our Google ads work? If you accept, Google learns that someone who clicked an ad created a profile here. No ad personalisation. <a href="#/privacy">Privacy</a></p>' +
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
    if (v === 'yes') load();
    else if (loaded && window.gtag) window.gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied' }); /* changed their mind: stop for the rest of the visit */
  };
  C.start = function () { if (!ID) return; if (C.state() === 'yes') load(); else if (!C.state()) C.show(); };
  window.ArnourConsent = C;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', C.start); else C.start();
})();
