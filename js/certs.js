/* Certifications: a professional adds the public link of a Credly badge, Arnour checks it with Credly and shows a "Verified" tick.
   Companies see the badge title, the issuer and the valid-until date. They never see the Credly link or the name on the badge.
   Expired badges stay on the profile, marked "Expired". Not linked to products or modules (decision of 2026-11-25).
   How it works: a badge is added right away (not with "Save changes"). The browser sends the link to /.netlify/functions/cred-verify, which asks Credly
   and saves the result with a secret that only the server knows (release 57, supabase/037_credentials.sql); nothing here can write a badge by itself.
   The tab only shows on the live site, for a professional, when that function is switched on (FEED_WORKER_SECRET is set in Netlify).
   APP.certApi can be replaced (practice copy and tests): { configured(): Promise<bool>, list(): Promise<[cred]>, add(url), check(id): Promise<{ok,cred}|{ok:false,error}>, remove(id): Promise } */
(function () {
  'use strict';
  if (typeof APP === 'undefined') return;
  var h = function (s) { return APP.h(s); };
  var FN = '/.netlify/functions/cred-verify';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmt(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : ''; }
  function expired(c) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(c.expires || ''); return !!m && new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59) < new Date(); }
  var ERR = {
    not_credly: 'This is not a Credly badge link. It looks like https://www.credly.com/badges/… (copy it from the Share button on your badge).',
    template: 'This link opens the description of a badge, not your own badge. Open your badge in your Credly profile, press Share and copy that link.',
    not_found: 'Credly could not find this badge, or it is no longer valid. Check the link and try again.',
    private: 'This badge is private. In Credly open the badge, make it public, then paste the link again.',
    unreachable: 'Credly did not answer. Please try again in a minute.',
    taken: 'This badge is already on another Arnour profile. If it is yours, contact us.',
    too_many: 'You can add up to 20 certifications. Remove one first.',
    limit: 'Too many checks for now. Please try again in an hour.',
    busy: 'Arnour is busy checking badges. Please try again in a few minutes.',
    signin: 'Please sign in again.', consultants_only: 'Only professionals can add certifications.', suspended: 'This account is suspended.',
    not_configured: 'Certifications are not switched on yet.', service: 'Something went wrong on our side. Please try again in a minute.',
    network: 'The connection dropped. Please try again.', bad_request: 'The request was not understood. Reload the page and try again.', too_big: 'That link is too long.'
  };
  var S = APP.certs = { on: false, ready: false, list: null, loading: false };

  /* ---------- the real service (the browser never writes a badge itself) ---------- */
  function token() { var B = APP.backend; return B && B.ensureSession ? B.ensureSession().then(function (s) { if (!s || !s.access_token) throw { code: 'signin' }; return s.access_token; }) : Promise.reject({ code: 'signin' }); }
  function post(body) {
    return token().then(function (t) {
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 25000);
      return fetch(FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }).then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j && j.cred ? { ok: true, cred: j.cred } : { ok: false, error: (j && j.error) || 'service' }; });
      }, function () { clearTimeout(to); return { ok: false, error: 'network' }; });
    }, function () { return { ok: false, error: 'signin' }; });
  }
  APP.certApi = {
    configured: function () {
      if (!APP.LIVE || !APP.backend || !APP.backend.rpc) return Promise.resolve(false);
      return fetch(FN, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return !!(j && j.configured); }, function () { return false; });
    },
    list: function () { return APP.backend.rpc('my_credentials').then(function (l) { return Array.isArray(l) ? l : []; }); },
    add: function (url) { return post({ url: url }); },
    check: function (id) { return post({ id: id }); },
    remove: function (id) { return APP.backend.rpc('cred_remove', { p_id: id }); }
  };

  function me() { var s = APP.db && APP.db.session; return s && s.role === 'consultant' ? APP.db.consultants[s.consultantId] : null; }
  /* what the profile shows to everyone (the summary the database keeps in the profile) */
  function summary(l) { return (l || []).map(function (c) { return { id: c.id, title: c.title, issuer: c.issuer, kind: c.kind, issued: c.issued, expires: c.expires }; }); }
  function setList(l) {
    S.list = l;
    var m = me(), d = APP.profileDraft;
    if (m) m.creds = summary(l);
    if (d && d.id && m && d.id === m.id) d.creds = summary(l);
  }

  /* ---------- is it switched on? ---------- */
  function init() {
    if (S.ready || S.starting) return; S.starting = true;
    Promise.resolve(APP.certApi.configured()).then(function (on) { S.on = !!on; }, function () { S.on = false; }).then(function () {
      S.ready = true;
      if (S.on && /\/profile|\/edit|\/dashboard/.test(location.hash || '')) { try { APP.render(); } catch (e) { /* ignore */ } }
    });
  }
  function ownerReady() { var s = APP.db && APP.db.session; return !!(S.on && s && s.role === 'consultant'); }

  function metaLine(c) {
    var p = [c.issuer, c.kind, c.issued ? 'Issued ' + fmt(c.issued) : '', c.expires ? (expired(c) ? 'Expired ' : 'Valid until ') + fmt(c.expires) : 'No expiry date'];
    return p.filter(Boolean).join(' · ');
  }
  /* the badge picture (Credly host only, https), with the tick on its corner; no picture = just the tick */
  var IMG_OK = /^https:\/\/images\.credly\.com\/[A-Za-z0-9\/_.%-]+$/;
  function badgeHtml(c) {
    var tick = '<span class="cr-tick" aria-hidden="true">' + APP.icon('check', 14) + '</span>';
    if (!c.image || !IMG_OK.test(c.image)) return tick;
    return '<span class="cr-badge"><img src="' + h(c.image) + '" alt="" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer">' + tick + '</span>';
  }

  function rowHtml(c, owner) {
    var ex = expired(c);
    return '<div class="cr-row' + (ex ? ' is-exp' : '') + '" data-cred="' + h(c.id) + '">' +
      badgeHtml(c) +
      '<div class="cr-body"><div class="cr-name">' + h(c.title) + '</div>' +
      '<div class="cr-meta">' + h(metaLine(c)) + '</div>' +
      '<div class="cr-chips"><span class="cr-chip ok">Verified via Credly</span>' + (ex ? '<span class="cr-chip exp">Expired</span>' : '') + '</div>' +
      (owner && (c.nameMatch === true || c.nameMatch === false || c.url) ? '<div class="cr-own">' + (c.nameMatch === false
        ? '<span class="cr-warn">The name on this badge is different from your profile name. Arnour may ask you to confirm it. Only you see this.</span>'
        : c.nameMatch === true ? '<span class="muted">The name on the badge matches your profile. Only you see this.</span>' : '') +
        (c.url ? ' <a class="link" href="' + h(c.url) + '" target="_blank" rel="noopener">Open on Credly</a>' : '') + '</div>' : '') +
      '</div>' +
      (owner ? '<div class="cr-act">' + (ex ? '<button type="button" class="btn btn-ghost btn-sm" data-action="cert-check" data-id="' + h(c.id) + '" title="Renewed it in Credly? Check again.">Check again</button>' : '') +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="cert-remove" data-id="' + h(c.id) + '">Remove</button></div>' : '') +
      '</div>';
  }

  /* the Certifications section of Edit profile */
  APP.certsPaneHtml = function (d) {
    if (!ownerReady()) return '';
    if (S.list === null && !S.loading) load();
    var l = S.list || d.creds || [];
    return '<h3 class="pe-h">Certifications' + APP.hintHtml('Paste the public link of a badge from Credly. SAP issues its certification and learning badges there. Arnour checks the link with Credly. Companies see the badge title, who issued it and the valid-until date, never your link or the name on the badge.') + '</h3>' +
      '<p class="muted">Add your SAP certifications and learning badges. Each one gets a <b>Verified</b> tick once Credly confirms it.</p>' +
      '<div class="field"><span class="label">Credly badge link</span>' +
      '<div class="cr-add"><input class="input cr-input" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://www.credly.com/badges/…" aria-label="Credly badge link">' +
      '<button type="button" class="btn btn-primary btn-sm" data-action="cert-add">' + APP.icon('check', 14) + ' Verify and add</button></div>' +
      '<p class="cr-msg" role="status" aria-live="polite"></p>' +
      '<details class="cr-help"><summary>Where do I find my badge link?</summary><ol>' +
      '<li>Sign in at credly.com and open <b>Badges</b>.</li><li>Open the badge, then press <b>Share</b>.</li><li>Copy the link. The badge must be set to <b>public</b>.</li></ol>' +
      '<p>SAP sends the badge to the e-mail you use on SAP Learning. If you cannot see it in Credly, add that e-mail to your Credly account.</p></details></div>' +
      '<div class="cr-list">' + (l.length ? l.map(function (c) { return rowHtml(c, true); }).join('') :
        '<div class="empty small">No certifications added yet.</div>') + '</div>' +
      (l.length ? '<p class="muted small mt8">A badge is saved as soon as Credly confirms it. Expired badges stay on your profile, marked <b>Expired</b>; renewed it? Press <b>Check again</b>.</p>' : '');
  };

  /* the Certifications box on the profile page (yours, and what companies see) */
  APP.certsCardHtml = function (c, owner) {
    var l = (c && c.creds) || [];
    if (!l.length) return '';
    return '<div class="card cr-card"><div class="card-h">Certifications <span class="cr-count">' + l.length + '</span></div>' +
      '<div class="cr-list">' + l.map(function (x) { return rowHtml(x, false); }).join('') + '</div>' +
      (owner ? '<p class="muted small mt8">Companies see this box. They never see your Credly link or the name on the badge.</p>' : '') + '</div>';
  };

  /* the same list as a section of the company's talent page (e-talent-detail) */
  APP.certsSectionHtml = function (c) {
    var l = (c && c.creds) || [];
    if (!l.length) return '';
    return '<section class="jd-sec"><h2>' + APP.icon('check', 16) + ' Certifications <span class="cr-count">' + l.length + '</span></h2>' +
      '<div class="cr-list">' + l.map(function (x) { return rowHtml(x, false); }).join('') + '</div></section>';
  };

  var baseSections = APP.profileSections;
  if (baseSections) APP.profileSections = function (d, rp) {
    var list = baseSections.call(this, d, rp);
    if (!ownerReady()) return list;
    var pct = list.pct, n = (S.list || d.creds || []).length;
    var item = { id: 'certs', label: 'Certifications', ok: n > 0, hint: n ? n + ' verified' : 'Optional', req: false };
    var i = list.findIndex(function (x) { return x.id === 'about'; });
    if (i < 0) list.push(item); else list.splice(i, 0, item);
    list.pct = pct;
    return list;
  };

  var baseProfile = APP.consultantProfileHtml;
  if (baseProfile) APP.consultantProfileHtml = function (c, o) {
    var html = baseProfile.call(this, c, o);
    var s = APP.db && APP.db.session, own = !!(s && s.role === 'consultant' && s.consultantId === c.id && !(o && o.public));
    var card = APP.certsCardHtml(c, own);
    if (!card) return html;
    var i = html.indexOf('<div class="grid-2">');
    return i < 0 ? html + card : html.slice(0, i) + card + html.slice(i);
  };

  /* a short prompt on the dashboard (where sign-up ends): shown to a professional whose profile has SAP skills and no badge yet, only when Credly checks are switched on.
     "Not now" hides it in this browser. The place to add and maintain badges stays Edit profile > Certifications. */
  var PROMPT_KEY = 'arnour_cert_prompt_off';
  function promptOff() { try { return localStorage.getItem(PROMPT_KEY) === '1'; } catch (e) { return false; } }
  APP.certsPromptHtml = function (c) {
    if (!c || !ownerReady() || promptOff() || !APP.profileReady(c) || (S.list || c.creds || []).length) return '';
    return '<div class="card cr-prompt"><span class="cr-prompt-ico">' + APP.icon('check', 18) + '</span>' +
      '<div class="cr-prompt-txt"><strong>Prove your SAP certifications</strong>' +
      '<p class="muted small">Paste the public link of a Credly badge and it gets a <b>Verified</b> tick. Companies see the badge, never your link or the name on it. It takes a minute.</p></div>' +
      '<div class="cr-prompt-act"><button type="button" class="btn btn-primary btn-sm" data-action="cert-prompt-go">Add a badge</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="cert-prompt-off">Not now</button></div></div>';
  };
  var baseDash = APP.views && APP.views['c-dash'];
  if (baseDash) APP.views['c-dash'] = function () {
    var html = baseDash.apply(this, arguments), card = APP.certsPromptHtml(me());
    if (!card) return html;
    var i = html.indexOf('<div class="dash-grid">');
    return i < 0 ? html : html.slice(0, i) + card + html.slice(i);
  };

  function pane() { return document.querySelector('[data-pane="certs"]'); }
  function say(text, kind) { var m = pane() && pane().querySelector('.cr-msg'); if (m) { m.textContent = text || ''; m.className = 'cr-msg' + (kind ? ' ' + kind : ''); } }
  function refresh(text, kind) {
    var d = APP.profileDraft, p = pane(); if (!p || !d) return;
    p.innerHTML = APP.certsPaneHtml(d);
    say(text, kind);
    var tab = document.querySelector('.pe-tab[data-s="certs"]'), n = (S.list || d.creds || []).length;
    if (tab) {
      var mk = tab.querySelector('.pe-mark'), sm = tab.querySelector('small');
      if (mk) { mk.className = 'pe-mark ' + (n ? 'ok' : 'todo'); mk.textContent = n ? '✓' : '!'; }
      if (sm) sm.textContent = n ? n + ' verified' : 'Optional';
    }
  }
  function load() {
    S.loading = true;
    Promise.resolve(APP.certApi.list()).then(function (l) { S.loading = false; setList(l || []); refresh(); }, function () { S.loading = false; S.list = (APP.profileDraft && APP.profileDraft.creds) || []; });
  }
  var busy = false;
  function upsert(cred) {
    var l = (S.list || []).slice(), i = l.findIndex(function (x) { return x.id === cred.id; });
    if (i < 0) l.unshift(cred); else l[i] = cred;
    l.sort(function (a, b) { return String(b.issued || '').localeCompare(String(a.issued || '')); });
    setList(l);
  }
  function run(p, ok) {
    var d = APP.profileDraft, el = pane(); if (!d || !el || busy) return;
    var btns = el.querySelectorAll('[data-action^="cert-"]');
    busy = true; btns.forEach(function (b) { b.disabled = true; });
    Promise.resolve(p).then(function (r) {
      busy = false;
      if (!r || !r.ok) { btns.forEach(function (b) { b.disabled = false; }); say(ERR[(r && r.error) || 'unreachable'] || ERR.unreachable, 'err'); return; }
      ok(r);
    }, function () { busy = false; btns.forEach(function (b) { b.disabled = false; }); say(ERR.unreachable, 'err'); });
  }
  function add() {
    var p = pane(); if (!p || busy) return;
    var url = (p.querySelector('.cr-input').value || '').trim();
    if (!url) { say('Paste the link of your Credly badge first.', 'err'); return; }
    say('Checking the badge with Credly…');
    run(APP.certApi.add(url), function (r) { var had = (S.list || []).some(function (x) { return x.id === r.cred.id; }); upsert(r.cred); refresh(had ? 'This badge was already on your profile. It is up to date.' : 'Verified and added: ' + r.cred.title + '.', 'ok'); });
  }
  function check(id) {
    say('Checking the badge with Credly…');
    run(APP.certApi.check(id), function (r) { upsert(r.cred); refresh('Checked with Credly: ' + r.cred.title + '.', 'ok'); });
  }
  function remove(id) {
    if (busy) return; busy = true;
    Promise.resolve(APP.certApi.remove(id)).then(function () { busy = false; setList((S.list || []).filter(function (x) { return x.id !== id; })); refresh('Removed.', ''); },
      function () { busy = false; say(ERR.service, 'err'); });
  }
  /* own handlers (capture phase): Enter in the box must not save the whole profile form */
  document.addEventListener('click', function (e) {
    var pt = e.target && e.target.closest && e.target.closest('[data-action="cert-prompt-go"],[data-action="cert-prompt-off"]');
    if (pt) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (pt.getAttribute('data-action') === 'cert-prompt-off') { try { localStorage.setItem(PROMPT_KEY, '1'); } catch (x) { /* it comes back next visit */ } APP.render(); return; }
      var m = me(); if (!m) return;
      APP.state.profileEdit = true; APP.state.profileSec = 'certs'; APP.profileDraft = APP.clone(m); APP.go('#/c/profile'); return;
    }
    var t = e.target && e.target.closest && e.target.closest('[data-action="cert-add"],[data-action="cert-remove"],[data-action="cert-check"]');
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var a = t.getAttribute('data-action');
    if (a === 'cert-add') add(); else if (a === 'cert-check') check(t.getAttribute('data-id')); else remove(t.getAttribute('data-id'));
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('cr-input')) { e.preventDefault(); e.stopImmediatePropagation(); add(); }
  }, true);
  APP.certsInit = init;
  /* start asking once the page has settled (backend.js sets APP.LIVE when it loads) */
  if (document.readyState === 'complete') setTimeout(init, 0); else window.addEventListener('load', function () { setTimeout(init, 0); });
})();
