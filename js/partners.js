/* ============================================================================
   ARNOUR — SI/PARTNERS
   What a partner's team delivers (edited on the company profile), "Find partners" for everybody, the partner page, and
   requests from SAP Customers: send -> the partner accepts or declines -> both see each other's contact details.
   Live site: list_partners / get_partner / request_partner / respond_partner_request / my_partner_requests (release 35).
   Offline demo: the same screens run on the sample data in the browser.
   No rates or prices anywhere.
   ============================================================================ */
(function () {
  'use strict';
  var h = function (s) { return APP.h(s == null ? '' : String(s)); };

  APP.PT_DELIVERY = [['onsite', 'On-site'], ['remote', 'Remote'], ['hybrid', 'Hybrid']];
  APP.PT_ENGAGE = [['team', 'Project team'], ['consultants', 'Individual consultants'], ['support', 'Support / AMS']];
  APP.PT_SIZES = ['1-10', '11-50', '51-200', '200+'];
  APP.PT_NEED = [['team', 'A project team'], ['consultants', 'Individual consultants'], ['both', 'A team or consultants (open)']];
  function lab(list, id) { for (var i = 0; i < list.length; i++) if (list[i][0] === id) return list[i][1]; return id; }
  function pairsToOpts(list) { return list.map(function (p) { return { id: p[0], name: p[1] }; }); }
  function realId(id) { return String(id || '').replace(/^cx:/, ''); }
  function slug(s) { return String(s || 'company').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function safeUrl(u) {
    u = String(u || '').trim(); if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u) ? 'https://' + u : '';
  }
  function myCo() { var s = APP.db.session; return s && s.role === 'employer' ? APP.company(s.companyId) : null; }
  APP.ptCanAsk = function () { var c = myCo(); return !!(c && c.companyType === 'customer'); };
  APP.ptLive = function () { return !!(APP.LIVE && APP.backend && APP.backend.rpc && APP.backend.ready); };
  APP.ptRerender = function () { if (/^#\/(partners|partner\/|e\/partner-requests|e\/dashboard|e\/company)/.test(location.hash)) APP.render(); };

  /* ------------------------------ data: partners ------------------------------ */
  APP.partners = null; APP.ptOne = {}; APP.partnerReqs = null; APP.partnerReqsFor = '';

  /* offline demo: the same card the database would send (a hidden partner shows capabilities only) */
  function localRevealed(coId) {
    var me = myCo();
    return !!(me && (APP.db.partnerRequests || []).some(function (r) { return r.to === coId && r.from === me.id && r.status === 'accepted'; }));
  }
  function localCard(c) {
    var me = myCo(), mine = !!(me && me.id === c.id);
    var hid = !!(c.partner && c.partner.hideName) && !mine && !localRevealed(c.id);
    var base = { companyType: 'partner', country: c.country, size: c.size, sample: !!c.sample };
    if (!hid) return Object.assign(base, { id: c.id, name: c.name, about: c.about, city: c.city, industry: c.industry, website: c.website, linkedin: c.linkedin, anon: false, partner: c.partner });
    var p = Object.assign({}, c.partner); delete p.bestAt;
    return Object.assign(base, { id: 'cx:' + c.id, name: 'Confidential SI/Partner', anon: true, _anon: true, partner: p });
  }
  function localList() {
    return Object.keys(APP.db.companies || {}).map(function (k) { return APP.db.companies[k]; })
      .filter(function (c) { return c.companyType === 'partner' && c.partner && (c.partner.skills || []).length; }).map(localCard);
  }
  APP.ptLoad = function (force) {
    if (!APP.ptLive()) { APP.partners = localList(); return; }
    if (APP.ptBusy || (APP.partners && !force)) return;
    APP.ptBusy = true;
    APP.backend.rpc('list_partners').then(function (rows) {
      APP.partners = Array.isArray(rows) ? rows : []; APP.ptBusy = false; APP.ptFail = false; APP.ptRerender();
    }, function () { APP.ptBusy = false; APP.ptFail = true; APP.partners = APP.partners || []; APP.ptRerender(); });
  };
  APP.ptGet = function (id) {
    var l = (APP.partners || []).filter(function (p) { return p.id === id; })[0];
    if (l) return l;
    if (!APP.ptLive()) { var c = APP.db.companies && APP.db.companies[realId(id)]; return c && c.partner && (c.partner.skills || []).length ? localCard(c) : null; }
    var one = APP.ptOne[id];
    if (one !== undefined) return one;
    if (!APP.ptBusyOne) {
      APP.ptBusyOne = true;
      APP.backend.rpc('get_partner', { p_id: id }).then(function (r) { APP.ptOne[id] = r || null; APP.ptBusyOne = false; APP.ptRerender(); },
        function () { APP.ptOne[id] = null; APP.ptBusyOne = false; APP.ptRerender(); });
    }
    return undefined;
  };

  /* ------------------------------ data: requests ------------------------------ */
  function localReqs() {
    var me = myCo(); if (!me) return [];
    return (APP.db.partnerRequests || []).filter(function (r) { return r.from === me.id || r.to === me.id; })
      .sort(function (a, b) { return b.ts - a.ts; }).map(function (r) {
        var incoming = r.to === me.id, oc = APP.company(incoming ? r.from : r.to) || {};
        var card = incoming
          ? { id: oc.id, name: oc.name, about: oc.about, country: oc.country, city: oc.city, website: oc.website, linkedin: oc.linkedin, contactName: oc.contactName, contactTitle: oc.contactTitle, companyType: oc.companyType }
          : Object.assign(localCard(oc), r.status === 'accepted' ? { contactName: oc.contactName, contactTitle: oc.contactTitle } : {});
        var shared = incoming ? r.share : r.toShare;
        return { id: r.id, dir: incoming ? 'in' : 'out', status: r.status, need: r.need, timing: r.timing, note: r.note, ts: r.ts, respTs: r.respTs, other: card,
          contactEmail: r.status === 'accepted' && shared ? (oc.contactEmail || 'hello@' + slug(oc.name) + '.example') : null, unread: 0, iShared: incoming ? !!r.toShare : !!r.share };
      });
  }
  APP.ptLoadReqs = function (force) {
    var me = myCo();
    if (!me) { APP.partnerReqs = null; APP.partnerReqsFor = ''; return; }
    if (!APP.ptLive()) { APP.partnerReqs = localReqs(); APP.partnerReqsFor = me.id; return; }
    if (APP.ptReqBusy || (!force && APP.partnerReqsFor === me.id && APP.partnerReqs)) return;
    APP.ptReqBusy = true;
    APP.backend.rpc('my_partner_requests').then(function (rows) {
      APP.partnerReqs = Array.isArray(rows) ? rows : []; APP.partnerReqsFor = me.id; APP.ptReqBusy = false; APP.ptRerender();
    }, function () { APP.partnerReqs = APP.partnerReqs || []; APP.partnerReqsFor = me.id; APP.ptReqBusy = false; });
  };
  APP.ptPendingIn = function () { return (APP.partnerReqs || []).filter(function (r) { return r.dir === 'in' && r.status === 'pending'; }).length; };
  function reqFor(p, pageId) {
    return (APP.partnerReqs || []).filter(function (r) { return r.dir === 'out' && r.other && (r.other.id === p.id || r.other.id === pageId || realId(r.other.id) === realId(p.id)); })[0];
  }

  /* messages on an accepted request */
  APP.ptMsgs = {}; var msgBusy = {};
  function localMsgs(rid) {
    var me = myCo(), r = (APP.db.partnerRequests || []).filter(function (x) { return x.id === rid; })[0];
    if (!me || !r) return [];
    var mine = r.from === me.id ? 'from' : 'to';
    return (APP.db.partnerMessages || []).filter(function (m) { return m.req === rid; }).map(function (m) { return { id: m.id, mine: m.side === mine, text: m.text, ts: m.ts }; });
  }
  APP.ptLoadMsgs = function (rid, force) {
    var mc = myCo(); if (APP.ptMsgsFor !== (mc && mc.id)) { APP.ptMsgs = {}; msgBusy = {}; APP.ptMsgsFor = mc && mc.id; } /* never show another account's thread */
    if (!force && (APP.ptMsgs[rid] !== undefined || msgBusy[rid])) return;
    if (!APP.ptLive()) { APP.ptMsgs[rid] = localMsgs(rid); return; }
    msgBusy[rid] = true;
    APP.backend.rpc('partner_messages_for', { p_req: rid }).then(function (rows) {
      APP.ptMsgs[rid] = Array.isArray(rows) ? rows : []; msgBusy[rid] = false; APP.ptRerender();
    }, function () { APP.ptMsgs[rid] = APP.ptMsgs[rid] || []; msgBusy[rid] = false; });
  };
  APP.ptMsgSend = function (f) {
    var rid = f.dataset.rid, ta = f.querySelector('textarea'), txt = ta ? String(ta.value || '').trim().slice(0, 2000) : '';
    if (!txt) { APP.toast('Write a message first.'); return; }
    var btn = f.querySelector('button[type=submit]');
    if (APP.ptLive()) {
      if (btn) btn.disabled = true;
      APP.backend.rpc('send_partner_message', { p_req: rid, p_text: txt }).then(function () { APP.ptLoadMsgs(rid, true); },
        function (e) { if (btn) btn.disabled = false; APP.toast(/too many/i.test(String(e && e.message)) ? 'Too many messages, try again later.' : 'Could not send. Check your connection and try again.'); });
      return;
    }
    var me = myCo(), r = (APP.db.partnerRequests || []).filter(function (x) { return x.id === rid; })[0];
    if (!me || !r || r.status !== 'accepted') return;
    (APP.db.partnerMessages = APP.db.partnerMessages || []).push({ id: 'pm' + Date.now().toString(36), req: rid, side: r.from === me.id ? 'from' : 'to', text: txt, ts: Date.now() });
    APP.save(); APP.ptMsgs[rid] = localMsgs(rid); APP.render();
  };

  /* ------------------------------ actions ------------------------------ */
  function errText(e) {
    var m = String((e && e.message) || '');
    if (/only SAP customers/i.test(m)) return 'Only companies marked as SAP Customer can ask partners. You can change your company type on your company profile.';
    if (/did not accept your last request|too many requests|already connected/i.test(m)) return m.charAt(0).toUpperCase() + m.slice(1) + (/\.$/.test(m) ? '' : '.');
    return 'Could not do that. Check your connection and try again.';
  }
  APP.ptSend = function (f) {
    if (!APP.ptCanAsk()) { APP.toast('Only companies marked as SAP Customer can ask partners.'); return; }
    var fd = new FormData(f), pid = f.dataset.pid;
    var need = String(fd.get('need') || 'both'), timing = String(fd.get('timing') || '').trim().slice(0, 80), note = String(fd.get('note') || '').trim().slice(0, 600), share = !!fd.get('share');
    if (!note) { APP.toast('Tell them a little about the project first.'); return; }
    var btn = f.querySelector('button[type=submit]');
    if (APP.ptLive()) {
      if (btn) btn.disabled = true;
      APP.backend.rpc('request_partner', { p_partner: pid, p_need: need, p_timing: timing, p_note: note, p_share_email: share }).then(function () {
        APP.toast('Request sent ✓'); APP.ptLoadReqs(true);
      }, function (e) { if (btn) btn.disabled = false; APP.toast(errText(e)); });
      return;
    }
    var me = myCo(), real = realId(pid), list = (APP.db.partnerRequests = APP.db.partnerRequests || []);
    if (list.some(function (r) { return r.from === me.id && r.to === real && r.status !== 'declined'; })) { APP.toast('You already asked this partner.'); return; }
    list.push({ id: 'pr' + Date.now().toString(36), from: me.id, to: real, need: need, timing: timing, note: note, share: share, toShare: false, status: 'pending', ts: Date.now(), respTs: null });
    APP.save(); APP.toast('Request sent ✓'); APP.ptLoadReqs(true); APP.render();
  };
  APP.ptAnswer = function (id, yes) {
    var cb = document.querySelector('[data-pt-share="' + id + '"]'), share = !!(cb && cb.checked);
    if (APP.ptLive()) {
      APP.backend.rpc('respond_partner_request', { p_id: id, p_accept: !!yes, p_share_email: share }).then(function () {
        APP.toast(yes ? 'Accepted. You can now see each other\'s contact details.' : 'Declined.'); APP.ptLoadReqs(true);
      }, function (e) { APP.toast(errText(e)); });
      return;
    }
    var r = (APP.db.partnerRequests || []).filter(function (x) { return x.id === id; })[0];
    if (!r || r.status !== 'pending') return;
    r.status = yes ? 'accepted' : 'declined'; r.toShare = !!yes && share; r.respTs = Date.now();
    APP.save(); APP.toast(yes ? 'Accepted. You can now see each other\'s contact details.' : 'Declined.'); APP.ptLoadReqs(true); APP.render();
  };

  /* ------------------------------ capabilities: editing (company profile) ------------------------------ */
  var LISTS = ['skills', 'industries', 'specialties', 'countries', 'languages', 'delivery', 'engagement'];
  APP.ptEnsure = function (d) {
    var p = d.partner = d.partner && typeof d.partner === 'object' ? d.partner : {};
    LISTS.forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
    if (typeof p.teamSize !== 'string') p.teamSize = '';
    if (typeof p.bestAt !== 'string') p.bestAt = '';
    return p;
  };
  /* the draft the capabilities editor works on: the sign-up wizard's data while a company signs up, otherwise the Edit profile draft */
  APP.ptHost = function () { return APP._ptHostWiz && APP.wizE ? APP.wizE.data : APP.profileDraft; };
  APP.ptSummaryLine = function (p) {
    var n = APP.ptSkillCount(p), prods = {}; ((p && p.skills) || []).forEach(function (k) { if (k.moduleId) prods[k.productId] = 1; });
    var np = Object.keys(prods).length;
    return n ? n + (n === 1 ? ' module' : ' modules') + ' across ' + np + (np === 1 ? ' product' : ' products') : '—';
  };
  /* what a partner must fill in besides its skills; returns the first thing missing (text for a toast) or '' */
  APP.ptMissing = function (p) {
    p = p || {};
    if (!(p.countries || []).length) return 'Choose at least one country you deliver in';
    if (!(p.languages || []).length) return 'Choose at least one language your team works in';
    if (!(p.delivery || []).length) return 'Choose how you deliver (on-site, remote or hybrid)';
    if (!(p.engagement || []).length) return 'Choose what you provide (a project team, consultants or support)';
    if (!p.teamSize) return 'Choose your team size';
    if (!String(p.bestAt || '').trim()) return 'Tell customers in a sentence what you are best at';
    return '';
  };
  APP.ptSkillCount = function (p) { return ((p && p.skills) || []).filter(function (k) { return k && k.productId && k.moduleId; }).length; };
  var grp = function (title, hint, body) { return '<div class="field"><span class="label">' + title + (hint ? ' <span class="muted">' + hint + '</span>' : '') + '</span>' + body + '</div>'; };
  /* pane 1: the products and modules the team delivers (what customers search on), plus industries and specialties */
  APP.ptSkillsHtml = function (d) {
    var p = APP.ptEnsure(d);
    return '<p class="muted small">SAP Customers find you by this on Find partners. Add at least one product and module to be listed. Please leave out rates and prices.</p>' +
      grp('SAP products and modules your team has delivered', '', APP.skillCardsHtml('partnerCaps', p.skills, 'full')) +
      grp('Industries', '(optional)', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'industries', APP.industries, p.industries) + '</div>') +
      grp('Specialties', '(optional)', APP.specialtyChipsHtml('partnerCaps', p.specialties, 'specialties'));
  };
  /* pane 2: where and how the team delivers, size, best-at text and the hide-name switch */
  APP.ptDetailsHtml = function (d) {
    var p = APP.ptEnsure(d);
    var R = '<span class="req-star">*</span>';
    return APP.visPt(d, 'pt') + grp('Countries you deliver in ' + R, '', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'countries', APP.countries.map(function (c) { return { id: c.id, name: c.name }; }), p.countries) + '</div>') +
      grp('Languages your team works in ' + R, '', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'languages', APP.languages, p.languages) + '</div>') +
      '<div class="form-grid">' +
      grp('How you deliver ' + R, '', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'delivery', pairsToOpts(APP.PT_DELIVERY), p.delivery) + '</div>') +
      grp('What you provide ' + R, '', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'engagement', pairsToOpts(APP.PT_ENGAGE), p.engagement) + '</div>') +
      '</div>' +
      grp('Team size (SAP consultants) ' + R, '', '<div class="chip-wrap">' + APP.chipGroup('partnerCaps', 'teamSize', APP.PT_SIZES, p.teamSize, true) + '</div>') +
      '<label class="field"><span class="label">What you are best at ' + R + ' <span class="muted">(up to 400 characters)</span></span>' +
      '<textarea class="input" rows="3" maxlength="400" data-pt-best placeholder="e.g. S/4HANA Public Cloud rollouts for retail groups in the Gulf, with a local support desk.">' + h(p.bestAt) + '</textarea></label>';
  };
  /* "Build it from your company presentation": a lazy-loaded card (js/partner-import.js), only on the live site, only when the feature is switched on */
  APP.ptImportSlotHtml = function () {
    if (!APP.LIVE) return '';
    if (!APP.ptImpLoaded) {
      if (!APP.ptImpLoading) {
        APP.ptImpLoading = true;
        var s = document.createElement('script');
        s.src = '/js/partner-import.js';
        s.onload = function () { APP.ptImpLoaded = true; APP.ptImpInit(); };
        s.onerror = function () { /* the form works without it */ };
        document.head.appendChild(s);
      }
      return '<div id="pt-slot"></div>';
    }
    return '<div id="pt-slot">' + APP.ptImpCardHtml() + '</div>';
  };

  /* called by the company-edit save: keep the capabilities of a partner, drop them for any other type */
  APP.ptCollect = function (d, co) {
    if (d.companyType === 'partner') { var p = APP.ptEnsure(d); p.hideName = !!p.hideName; }
    else { delete d.partner; delete co.partner; }
  };

  /* ------------------------------ capabilities: showing ------------------------------ */
  function chips(arr, fn) { return (arr || []).length ? '<div class="chip-wrap">' + arr.map(function (x) { return '<span class="chip">' + h(fn ? fn(x) : x) + '</span>'; }).join('') + '</div>' : ''; }
  function countryName(id) { return (APP.countriesById[id] || {}).name || id; }
  function groupedSkills(skills) {
    var order = [], by = {};
    (skills || []).forEach(function (k) { if (!by[k.productId]) { by[k.productId] = []; order.push(k.productId); } by[k.productId].push(k); });
    return order.map(function (pid) { return { pid: pid, mods: by[pid] }; });
  }
  /* the facts strip under the name: where, how many, how, in which languages */
  APP.ptFactsHtml = function (c) {
    var cs = c.countries || [], names = cs.map(countryName);
    var f = [
      ['Delivers in', cs.length ? (names.slice(0, 3).join(', ') + (cs.length > 3 ? ' +' + (cs.length - 3) + ' more' : '')) : ''],
      ['Team', c.teamSize ? c.teamSize + ' SAP consultants' : ''],
      ['How', (c.delivery || []).map(function (x) { return lab(APP.PT_DELIVERY, x); }).join(' · ')],
      ['Languages', (c.languages || []).slice(0, 4).join(', ') + ((c.languages || []).length > 4 ? ' +' + ((c.languages || []).length - 4) : '')]
    ].filter(function (x) { return x[1]; });
    return f.length ? '<dl class="pt-facts-strip">' + f.map(function (x) { return '<div><dt>' + h(x[0]) + '</dt><dd>' + h(x[1]) + '</dd></div>'; }).join('') + '</dl>' : '';
  };
  APP.ptCapsHtml = function (p, opts) {
    var c = p.partner || {}; opts = opts || {};
    var groups = groupedSkills(c.skills);
    var card = function (g) {
      return '<div class="pt-prod-card"><div class="pt-prod-top"><b>' + h(APP.productShort(g.pid) || g.pid) + '</b><span class="muted small">' + g.mods.length + (g.mods.length === 1 ? ' module' : ' modules') + '</span></div>' +
        '<div class="chip-wrap">' + g.mods.map(function (k) {
          var nm = APP.skillName(k.productId, k.moduleId) || k.moduleId;
          return '<span class="chip pt-mod">' + h(nm) + (k.projects ? '<small>' + k.projects + (k.projects === 1 ? ' project' : ' projects') + '</small>' : '') +
            (k.certified ? '<span class="pt-cert" title="The team holds an SAP certification in this module">' + APP.icon('check', 12) + ' certified</span>' : '') + '</span>';
        }).join('') + '</div></div>';
    };
    var prods = groups.length
      ? '<div class="pt-prod-grid">' + groups.slice(0, 3).map(card).join('') + '</div>' +
        (groups.length > 3 ? '<details class="pt-more-prod"><summary>Show ' + (groups.length - 3) + ' more product' + (groups.length - 3 === 1 ? '' : 's') + '</summary><div class="pt-prod-grid">' + groups.slice(3).map(card).join('') + '</div></details>' : '')
      : '<p class="muted small">Nothing added yet.</p>';
    var focus = [
      ['Industries', chips(c.industries)],
      ['Specialties', chips(c.specialties, function (id) { return APP.specialtyName(id); })]
    ].filter(function (b) { return b[1]; });
    var cs = c.countries || [];
    var reach = [
      ['Countries served', cs.length > 8
        ? '<details class="pt-more-prod"><summary>' + cs.length + ' countries</summary>' + chips(cs, countryName) + '</details>' : chips(cs, countryName)],
      ['What they provide', chips(c.engagement, function (x) { return lab(APP.PT_ENGAGE, x); })]
    ].filter(function (b) { return b[1]; });
    var blk = function (arr) { return arr.map(function (b) { return '<div class="pt-fact"><div class="pt-fact-h">' + h(b[0]) + '</div>' + b[1] + '</div>'; }).join(''); };
    return (c.bestAt && !opts.noBest ? '<div class="card pt-best"><div class="pt-fact-h">What they are best at</div><p>' + h(c.bestAt) + '</p></div>' : '') +
      '<div class="card"><div class="card-h">What the team delivers</div>' + prods + '</div>' +
      (focus.length ? '<div class="card pt-facts"><div class="card-h">Focus</div>' + blk(focus) + '</div>' : '') +
      (reach.length ? '<div class="card pt-facts"><div class="card-h">Reach</div>' + blk(reach) + '</div>' : '');
  };
  /* on the partner's own company page: the page customers see, plus the owner's tools in the side column */
  APP.ptOwnHtml = function (co, extra) {
    var c = co.partner || {}, n = APP.ptSkillCount(c), miss = n ? APP.ptMissing(c) : 'Add at least one SAP product and module your team delivers';
    var meta = [co.industry, co.size, co.country ? countryName(co.country) + (co.city ? ', ' + co.city : '') : ''].filter(Boolean).join(' · ');
    var site = safeUrl(co.website);
    APP.ptLoadReqs();
    var pend = APP.ptPendingIn();
    var status = c.hideName
      ? '<div class="card pt-anon-card">' + APP.icon('lock', 16) + ' <span>Your name is hidden. Customers see what your team delivers, not who you are, until you accept their request. Change this in Edit profile, Reach &amp; visibility.</span></div>'
      : '<p class="muted small pt-own-note">' + APP.icon('check', 13) + ' Listed on <a class="link" href="#/partners">Find partners</a> with your name. <a class="link" href="#/partner/' + h(co.id) + '">See it as a customer sees it →</a></p>';
    var side =
      '<div class="card pt-own-card"><div class="card-h">' + (miss ? 'Finish your profile' : 'Profile complete') + '</div>' +
      (miss ? '<p class="muted small">' + h(miss) + '. Customers can only find you once the required details are in.</p><button class="btn btn-primary btn-sm" data-action="co-edit-on">Complete it</button>'
            : '<p class="muted small">' + APP.icon('check', 13) + ' Everything customers need to judge fit is filled in.</p>') + '</div>' +
      '<div class="card pt-own-card"><div class="card-h">Requests</div>' +
      '<p class="muted small">' + (pend ? '<b>' + pend + '</b> waiting for your answer.' : 'No request is waiting for you.') + '</p>' +
      '<a class="btn btn-outline btn-sm" href="#/e/partner-requests">Open requests</a></div>' +
      '<div class="card pt-own-card"><div class="card-h">Your contact</div><p class="small">' + (co.contactName ? '<b>' + h(co.contactName) + '</b>' + (co.contactTitle ? ' · ' + h(co.contactTitle) : '') : '<span class="muted">No contact person yet</span>') + '</p>' +
      '<p class="muted small">' + (co.contactEmail ? h(co.contactEmail) : 'Your sign-in email') + ' · shared only after you accept a request.</p></div>' +
      (extra || '');
    return '<header class="card pt-hero"><div class="pt-hero-top"><span class="brand-logo lg" aria-hidden="true">' + h(APP.initials(co.name)) + '</span>' +
      '<div class="grow"><h1 class="pt-h1">' + h(co.name) + ' ' + APP.coTypeBadgeOf('partner') + '</h1>' + (meta ? '<p class="muted pt-meta">' + h(meta) + '</p>' : '') +
      (site ? '<p class="small pt-site"><a class="link" href="' + h(site) + '" target="_blank" rel="noopener noreferrer">' + h(co.website) + '</a></p>' : '') + '</div>' +
      '<button class="btn btn-outline pt-hero-cta" data-action="co-edit-on">Edit profile</button></div>' +
      APP.ptFactsHtml(c) + '</header>' + status +
      '<div class="pt-cols"><div class="pt-main">' +
      (n ? APP.ptCapsHtml({ partner: c }) : '<div class="card pt-empty-card"><div class="card-h">What your team delivers</div><p class="muted">Not filled in yet. SAP Customers cannot find you on Find partners until you add at least one product and module.</p><button class="btn btn-primary btn-sm" data-action="co-edit-on">Add it</button></div>') +
      (co.about ? '<div class="card"><div class="card-h">About</div><p class="pt-about">' + h(co.about) + '</p></div>' : '') +
      '</div><aside class="pt-side pt-own-side">' + side + '</aside></div>';
  };
  /* kept for older callers */
  APP.ptViewHtml = function (co) { return co && co.companyType === 'partner' ? APP.ptCapsHtml({ partner: co.partner || {} }) : ''; };

  /* ------------------------------ Find partners ------------------------------ */
  var emptyF = function () { return { q: '', product: '', module: '', industry: '', country: '', language: '', engagement: '' }; };
  APP.ptF = function () { return APP.state.ptF || (APP.state.ptF = emptyF()); };
  function metOf(p, f) {
    var c = p.partner || {}, sk = c.skills || [], total = 0, met = 0;
    if (f.product) { total++; if (sk.some(function (k) { return k.productId === f.product && (!f.module || k.moduleId === f.module); })) met++; }
    if (f.industry) { total++; if ((c.industries || []).indexOf(f.industry) !== -1) met++; }
    if (f.country) { total++; if ((c.countries || []).indexOf(f.country) !== -1) met++; }
    if (f.language) { total++; if ((c.languages || []).indexOf(f.language) !== -1) met++; }
    if (f.engagement) { total++; if ((c.engagement || []).indexOf(f.engagement) !== -1) met++; }
    return { met: met, total: total };
  }
  APP.ptFiltered = function (f) {
    var q = String(f.q || '').toLowerCase();
    var out = (APP.partners || []).filter(function (p) {
      var c = p.partner || {}, sk = c.skills || [];
      if (f.product && !sk.some(function (k) { return k.productId === f.product; })) return false;   /* the product is a must; the rest only ranks */
      if (q) {
        var hay = [p.name, p.about, c.bestAt, sk.map(function (k) { return APP.productShort(k.productId) + ' ' + APP.skillName(k.productId, k.moduleId); }).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).map(function (p) { return { p: p, m: metOf(p, f) }; });
    out.sort(function (a, b) { return (b.m.met - a.m.met) || String(a.p.name).localeCompare(String(b.p.name)); });
    return out;
  };
  /* A calm card: who they are, what they are best at, the products (never the modules), and how they work with you.
     The modules are on the partner page. With a product filter on, one line says which modules of that product they delivered. */
  function cardHtml(x, f) {
    var p = x.p, c = p.partner || {}, sk = c.skills || [];
    var byProd = {}, order = [];
    sk.forEach(function (k) { if (!byProd[k.productId]) { byProd[k.productId] = 0; order.push(k.productId); } byProd[k.productId] += (k.projects || 0) + 1; });
    order.sort(function (a, b) { return byProd[b] - byProd[a]; });
    var shown = order.slice(0, 4).map(function (id) { return '<span class="chip">' + h(APP.productShort(id)) + '</span>'; }).join('');
    var more = order.length > 4 ? '<span class="chip chip-more">+' + (order.length - 4) + ' more</span>' : '';
    var meta = [p.country ? countryName(p.country) : '', c.teamSize ? c.teamSize + ' consultants' : ''].filter(Boolean).join(' · ');
    var tag = String(c.bestAt || p.about || '').trim();
    var how = (c.engagement || []).map(function (e) { return lab(APP.PT_ENGAGE, e); }).join(' · ');
    var here = '';
    if (f && f.product) {
      var ms = sk.filter(function (k) { return k.productId === f.product && k.moduleId && k.moduleId !== '*'; }).map(function (k) { return APP.moduleShort(APP.skillName(k.productId, k.moduleId) || k.moduleId); });
      if (ms.length) here = '<div class="pt-here">Delivered here: <b>' + h(ms.slice(0, 4).join(', ')) + '</b>' + (ms.length > 4 ? ' +' + (ms.length - 4) : '') + '</div>';
    }
    var metTxt = x.m.total ? '<span class="pt-met' + (x.m.met === x.m.total ? ' all' : '') + '">Covers ' + x.m.met + ' of ' + x.m.total + (x.m.total === 1 ? ' need' : ' needs') + '</span>' : '';
    return '<div class="card pt-card" data-card-href="#/partner/' + h(p.id) + '">' +
      '<div class="pt-card-top"><span class="brand-logo">' + (p.anon ? APP.icon('lock', 16) : h(APP.initials(p.name))) + '</span>' +
      '<div class="grow"><div class="pt-name"><a class="card-title" href="#/partner/' + h(p.id) + '">' + h(p.name) + '</a>' + APP.coTypeBadgeOf('partner') + '</div>' +
      '<div class="muted small">' + h(meta) + '</div></div>' + metTxt + '</div>' +
      (tag ? '<p class="pt-tag">' + h(tag) + '</p>' : '') +
      '<div class="chip-wrap pt-chips">' + shown + more + '</div>' + here +
      (how ? '<div class="pt-how muted small">' + h(how) + '</div>' : '') +
      (p.anon ? '<div class="muted small pt-anon">' + APP.icon('lock', 12) + ' Name shared after they accept your request</div>' : '') +
      '</div>';
  }
  function resultsHtml(f) {
    if (!APP.partners) return '<div class="card"><p class="muted">Loading partners…</p></div>';
    if (APP.ptFail && !APP.partners.length) return '<div class="card empty"><p>Partners could not be loaded.</p><button class="btn btn-outline btn-sm" data-action="pt-retry">Try again</button></div>';
    var list = APP.ptFiltered(f), any = APP.partners.length;
    if (!any) {
      return '<div class="card empty"><h3>No partners listed yet</h3><p class="muted">Implementation partners describe what their team delivers here. Is your company an SI/Partner or consultancy?</p>' +
        '<a class="btn btn-primary btn-sm" href="' + (APP.db.session ? '#/e/company' : '#/register/e') + '">' + (APP.db.session ? 'Open your company profile' : 'Create a company profile') + '</a></div>';
    }
    if (!list.length) return '<div class="card empty"><h3>No partner matches yet</h3><p class="muted">Try removing a filter. The SAP product is the only one that must match.</p></div>';
    return '<p class="muted small pt-count">' + list.length + (list.length === 1 ? ' partner' : ' partners') + (APP.ptFilterCount(f) ? ' · best match first' : '') + '</p><div class="pt-grid">' + list.map(function (x) { return cardHtml(x, f); }).join('') + '</div>';
  }
  APP.ptFilterCount = function (f) { return ['product', 'industry', 'country', 'language', 'engagement'].filter(function (k) { return f[k]; }).length; };
  function selHtml(name, label, pairs, val, any) {
    return '<label class="field"><span class="label">' + h(label) + '</span><select class="input" data-pt-f="' + name + '"><option value="">' + h(any) + '</option>' + APP.opt(pairs, val) + '</select></label>';
  }
  APP.views['partners'] = function () {
    APP.ptLoad();
    var f = APP.ptF(), s = APP.db.session;
    var mods = f.product && typeof CAT_INDEX !== 'undefined' && CAT_INDEX.byId[f.product] ? CAT_INDEX.byId[f.product].modules.map(function (m) { return [m.id, m.name]; }) : [];
    var filters = '<div class="card pt-filters"><div class="pt-filter-grid">' +
      selHtml('product', 'SAP product', CATALOG.products.map(function (p) { return [p.id, p.name]; }), f.product, 'Any product') +
      (f.product ? selHtml('module', 'Module', mods, f.module, 'Any module') : '') +
      selHtml('industry', 'Industry', APP.industries.map(function (i) { return [i, i]; }), f.industry, 'Any industry') +
      selHtml('country', 'Country served', APP.countries.map(function (c) { return [c.id, c.name]; }), f.country, 'Any country') +
      selHtml('language', 'Language', APP.languages.map(function (l) { return [l, l]; }), f.language, 'Any language') +
      selHtml('engagement', 'What you need', APP.PT_ENGAGE, f.engagement, 'Anything') +
      '</div><div class="pt-q-row"><input class="input" data-pt-f="q" placeholder="Search by name, product or what they are best at" value="' + h(f.q) + '" aria-label="Search partners">' +
      ((f.q || APP.ptFilterCount(f)) ? '<button type="button" class="btn btn-ghost btn-sm" data-action="pt-clear">Clear</button>' : '') + '</div></div>';
    var mine = myCo();
    var cta = !s ? '<a class="btn btn-outline btn-sm" href="#/register/e">List your company as a partner</a>'
      : (mine && mine.companyType === 'partner') ? '<a class="btn btn-outline btn-sm" href="#/e/company">Edit what your team delivers</a>' : '';
    return '<div class="pt-page">' +
      '<div class="page-head"><h2>Find SAP partners</h2><p class="muted">Implementation partners and consultancies, described by the SAP products, modules and industries their teams have delivered. Some keep their name private until they accept your request.</p>' + cta + '</div>' +
      filters + '<div id="pt-results">' + resultsHtml(f) + '</div></div>';
  };

  /* ------------------------------ partner page ------------------------------ */
  function chatHtml(r) {
    APP.ptLoadMsgs(r.id);
    var m = APP.ptMsgs[r.id];
    var list = m === undefined ? '<p class="muted small">Loading…</p>'
      : m.length ? '<div class="pt-msgs">' + m.map(function (x) { return '<div class="pt-msg ' + (x.mine ? 'mine' : 'theirs') + '"><div class="pt-bub">' + h(x.text) + '</div><span class="muted small">' + APP.timeAgo(x.ts) + '</span></div>'; }).join('') + '</div>'
      : '<p class="muted small">No messages yet. Say hello and share what you need.</p>';
    return '<div class="pt-chat"><div class="card-h">' + APP.icon('msg', 16) + ' Messages</div>' + list +
      '<form data-form="pt-msg" data-rid="' + h(r.id) + '" class="pt-msg-form"><textarea name="text" class="input" rows="2" maxlength="2000" placeholder="Write a message…" aria-label="Message"></textarea>' +
      '<button type="submit" class="btn btn-primary btn-sm">Send</button></form></div>';
  }
  function contactHtml(r) {
    var o = r.other || {}, site = safeUrl(o.website), li = /^https?:\/\//i.test(o.linkedin || '') ? o.linkedin : '';
    return '<div class="pt-contact"><div class="card-h">' + APP.icon('check', 16) + ' Connected: contact details</div>' +
      '<p><strong>' + h(o.name) + '</strong></p>' +
      (o.contactName ? '<p>' + APP.icon('users', 14) + ' ' + h(o.contactName) + (o.contactTitle ? ' · ' + h(o.contactTitle) : '') + '</p>' : '') +
      (r.contactEmail ? '<p>' + APP.icon('msg', 14) + ' <a class="link" href="mailto:' + h(r.contactEmail) + '">' + h(r.contactEmail) + '</a></p>'
        : '<p class="muted small">No email address was shared. Use their website or LinkedIn below.</p>') +
      (site ? '<p><a class="link" href="' + h(site) + '" target="_blank" rel="noopener noreferrer">' + h(o.website) + '</a></p>' : '') +
      (li ? '<p><a class="link" href="' + h(li) + '" target="_blank" rel="noopener noreferrer">LinkedIn</a></p>' : '') +
      '</div>' + chatHtml(r);
  }
  function requestFormHtml(p) {
    return '<form data-form="pt-send" data-pid="' + h(p.id) + '" class="card pt-req"><div class="card-h">Ask this partner</div>' +
      '<label class="field"><span class="label">What do you need?</span><select name="need" class="input">' + APP.opt(APP.PT_NEED, 'both') + '</select></label>' +
      '<label class="field"><span class="label">When? <span class="muted">(optional)</span></span><input name="timing" class="input" maxlength="80" placeholder="e.g. start in January, about 6 months"></label>' +
      '<label class="field"><span class="label">Tell them about the project</span><textarea name="note" class="input" rows="4" maxlength="600" placeholder="Products and modules, countries, size, anything that helps them answer."></textarea></label>' +
      '<label class="field checkbox-field chk-line"><input type="checkbox" name="share" checked> <span>Share my sign-in email address with them if they accept<small class="muted"> — so they can reply by email. Your company name and contact person are always shown to them.</small></span></label>' +
      '<button type="submit" class="btn btn-primary">Send request</button></form>';
  }
  function actionHtml(p, pageId) {
    var s = APP.db.session, me = myCo();
    if (!s) return '<div class="card"><div class="card-h">Ask this partner</div><p class="muted">Sign in with a company account marked as SAP Customer to send a request.</p><div class="btn-row"><a class="btn btn-primary btn-sm" href="#/login">Sign in</a><a class="btn btn-outline btn-sm" href="#/register/e">Create a company account</a></div></div>';
    if (s.role === 'consultant') return '<div class="card"><p class="muted">Professionals can browse partners. Only SAP Customers can send requests.</p></div>';
    if (me && me.id === realId(p.id)) return '<div class="card"><p class="muted">This is how customers see your company.</p><a class="btn btn-outline btn-sm" href="#/e/company">Edit what your team delivers</a></div>';
    if (!APP.ptCanAsk()) return '<div class="card"><p class="muted">Only companies marked as SAP Customer can ask partners. You can change your company type on your <a class="link" href="#/e/company">company profile</a>.</p></div>';
    APP.ptLoadReqs();
    if (!APP.partnerReqs) return '<div class="card"><p class="muted">Loading…</p></div>';
    var r = reqFor(p, pageId);
    if (r && r.status === 'pending') return '<div class="card pt-status"><div class="card-h">Request sent</div><p class="muted">' + APP.timeAgo(r.ts) + '. You will be notified when they answer.</p><p class="small">' + h(lab(APP.PT_NEED, r.need)) + (r.timing ? ' · ' + h(r.timing) : '') + '</p><p class="small muted">' + h(r.note) + '</p></div>';
    if (r && r.status === 'accepted') return contactHtml(r);
    if (r && r.status === 'declined') return '<div class="card pt-status"><div class="card-h">Not accepted this time</div><p class="muted">This partner did not accept your last request. You can try again after 30 days.</p></div>';
    return requestFormHtml(p);
  }
  APP.views['partner-detail'] = function (ctx) {
    APP.ptLoad();
    var id = ctx.p[0], back = '<div class="crumb"><a class="link" href="#/partners">← Find partners</a></div>';
    var p = APP.ptGet(id);
    if (p === undefined || !APP.partners) return '<div class="narrow">' + back + '<div class="card"><p class="muted">Loading…</p></div></div>';
    if (!p || p.private) return '<div class="narrow">' + back + '<div class="card empty anon-empty">' + APP.icon('lock', 28) + '<h3>This partner is not available</h3><p class="muted">It may keep its name private, or no longer be listed. Browse the partners that are listed.</p><a class="btn btn-outline btn-sm" href="#/partners">Find partners</a></div></div>';
    document.title = (p.anon ? 'SAP SI/Partner' : p.name + ' — SAP SI/Partner') + ' · Arnour';
    var c = p.partner || {};
    var meta = [p.industry, p.size, p.country ? countryName(p.country) + (p.city ? ', ' + p.city : '') : ''].filter(Boolean).join(' · ');
    var site = safeUrl(p.website);
    var req = actionHtml(p, id);
    var canAsk = req.indexOf('data-form="pt-send"') >= 0;
    return '<div class="narrow pt-wide">' + back +
      '<header class="card pt-hero"><div class="pt-hero-top"><span class="brand-logo lg" aria-hidden="true">' + (p.anon ? APP.icon('lock', 22) : h(APP.initials(p.name))) + '</span>' +
      '<div class="grow"><h1 class="pt-h1">' + h(p.name) + ' ' + APP.coTypeBadgeOf('partner') + '</h1>' + (meta ? '<p class="muted pt-meta">' + h(meta) + '</p>' : '') +
      (site && !p.anon ? '<p class="small pt-site"><a class="link" href="' + h(site) + '" target="_blank" rel="noopener noreferrer">' + h(p.website) + '</a></p>' : '') + '</div>' +
      (canAsk ? '<button type="button" class="btn btn-primary pt-hero-cta" data-action="pt-scroll-req">Send a request</button>' : '') + '</div>' +
      APP.ptFactsHtml(c) + '</header>' +
      (p.anon ? '<div class="card pt-anon-card">' + APP.icon('lock', 16) + ' <span>This partner keeps its name private. You will see its name, contact person and contact details once it accepts your request.</span></div>' : '') +
      '<div class="pt-cols"><div class="pt-main">' +
      APP.ptCapsHtml(p, { noBest: p.anon }) +
      (p.about && !p.anon ? '<div class="card"><div class="card-h">About</div><p class="pt-about">' + h(p.about) + '</p></div>' : '') +
      '</div><aside class="pt-side" id="pt-req">' + req + '</aside></div></div>';
  };

  /* ------------------------------ requests page ------------------------------ */
  function reqRow(r) {
    var o = r.other || {}, inc = r.dir === 'in';
    var status = { pending: ['Waiting', 'badge-warning'], accepted: ['Connected', 'badge-success'], declined: ['Not accepted', 'badge-neutral'] }[r.status] || ['', ''];
    var title = inc ? h(o.name) + ' wants to connect' : 'You asked ' + (o.anon ? 'a confidential SI/Partner' : h(o.name));
    var link = !inc ? '<a class="link small" href="#/partner/' + h(o.id) + '">View partner</a>' : '';
    var actions = inc && r.status === 'pending'
      ? '<div class="pt-answer"><label class="chk-line"><input type="checkbox" data-pt-share="' + h(r.id) + '" checked> <span>Share my sign-in email address with them</span></label>' +
        '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="pt-accept" data-id="' + h(r.id) + '">Accept</button><button class="btn btn-outline btn-sm" data-action="pt-decline" data-id="' + h(r.id) + '">Decline</button></div></div>' : '';
    var contact = r.status === 'accepted' ? contactHtml(r) : '';
    return '<div class="card pt-reqrow"><div class="pt-reqrow-h"><strong>' + title + '</strong><span class="pill ' + status[1] + '">' + status[0] + '</span>' + (r.unread ? '<span class="pill warn-pill">' + r.unread + ' new</span>' : '') + '<span class="muted small">' + APP.timeAgo(r.ts) + '</span></div>' +
      '<p class="small">' + h(lab(APP.PT_NEED, r.need)) + (r.timing ? ' · ' + h(r.timing) : '') + '</p>' +
      (r.note ? '<p class="pt-note">' + h(r.note) + '</p>' : '') + link + actions + contact + '</div>';
  }
  APP.views['partner-requests'] = function () {
    APP.ptLoadReqs();
    var rows = APP.partnerReqs;
    var head = '<div class="page-head"><h2>Partner requests</h2><p class="muted">Requests between SAP Customers and SI/Partners. When a partner accepts, you see each other\'s contact details.</p></div>';
    if (!rows) return '<div class="narrow">' + head + '<div class="card"><p class="muted">Loading…</p></div></div>';
    var inP = rows.filter(function (r) { return r.dir === 'in' && r.status === 'pending'; });
    var rest = rows.filter(function (r) { return !(r.dir === 'in' && r.status === 'pending'); });
    var me = myCo();
    var empty = !rows.length ? '<div class="card empty"><p class="muted">' + (me && me.companyType === 'partner' ? 'No requests yet. Customers find you on Find partners.' : 'You have not asked a partner yet.') + '</p><a class="btn btn-outline btn-sm" href="#/partners">Find partners</a></div>' : '';
    return '<div class="narrow">' + head + empty +
      (inP.length ? '<h3 class="pt-sec">Waiting for your answer</h3>' + inP.map(reqRow).join('') : '') +
      (rest.length ? '<h3 class="pt-sec">All requests</h3>' + rest.map(reqRow).join('') : '') + '</div>';
  };

  /* ------------------------------ wiring ------------------------------ */
  APP.routes.push(
    { re: /^#\/partners$/, view: 'partners', auth: null },
    { re: /^#\/partner\/([A-Za-z0-9:_-]+)$/, view: 'partner-detail', auth: null },
    { re: /^#\/e\/partner-requests$/, view: 'partner-requests', auth: 'employer' });
  ['pt-send', 'pt-accept', 'pt-decline', 'pt-msg'].forEach(function (a) { APP.ACTION_RULES.employer.push(a); });

  (function () {
    var title = APP.pageTitle;
    APP.pageTitle = function (view) {
      if (view === 'partners') return 'Find SAP partners — Arnour';
      if (view === 'partner-detail') return 'SAP SI/Partner — Arnour';
      if (view === 'partner-requests') return 'Partner requests — Arnour';
      return title.apply(this, arguments);
    };
    var click = APP.onClick, submit = APP.onSubmit;
    APP.onClick = function (el, e) {
      var a = el && el.dataset && el.dataset.action;
      if (a === 'pt-accept' || a === 'pt-decline') { APP.ptAnswer(el.dataset.id, a === 'pt-accept'); return; }
      if (a === 'pt-scroll-req') { var rq = document.getElementById('pt-req'); if (rq) { rq.scrollIntoView({ behavior: 'smooth', block: 'start' }); var ta = rq.querySelector('textarea,select'); if (ta) ta.focus({ preventScroll: true }); } return; }
      if (a === 'pt-clear') { APP.state.ptF = emptyF(); APP.render(); return; }
      if (a === 'pt-retry') { APP.ptFail = false; APP.ptLoad(true); APP.render(); return; }
      return click.apply(this, arguments);
    };
    APP.onSubmit = function (f) {
      if (f && f.dataset && f.dataset.form === 'pt-send') { APP.ptSend(f); return; }
      if (f && f.dataset && f.dataset.form === 'pt-msg') { APP.ptMsgSend(f); return; }
      return submit.apply(this, arguments);
    };
    /* the menu: a Partners link before Community, and my requests in the account menu */
    var before = /(<a class="nav-link(?: active)?" href="#\/community">)/;
    var link = function () { return '<a class="nav-link' + (/^#\/partners?(\/|$)/.test(location.hash) ? ' active' : '') + '" href="#/partners">' + APP.icon('briefcase', 16) + ' Partners</a>'; };
    var nav = APP.navbar, pub = APP.pubHeader;
    APP.navbar = function () {
      var html = nav.apply(this, arguments); if (!html) return html;
      var me = myCo();
      if (me && (me.companyType === 'customer' || me.companyType === 'partner')) {
        APP.ptLoadReqs();
        var n = APP.ptPendingIn();
        html = html.replace('<button class="menu-item" data-action="sign-out">', '<a class="menu-item" href="#/e/partner-requests">Partner requests' + (n ? ' <span class="count-pill">' + n + '</span>' : '') + '</a><button class="menu-item" data-action="sign-out">');
      }
      return html.replace(before, function (m) { return link() + m; });
    };
    APP.pubHeader = function () { var html = pub.apply(this, arguments); return html.replace(before, function (m) { return link() + m; }); };
    /* the company dashboard: a prompt for customers and partners */
    var dash = APP.views['e-dash'];
    APP.views['e-dash'] = function () {
      var html = dash.apply(this, arguments), me = myCo(), card = '';
      if (me && me.companyType === 'customer') card = '<a class="card pt-promo" href="#/partners"><strong>Find an SAP partner</strong><span class="muted small">Implementation partners described by the products, modules and industries their teams have delivered.</span></a>';
      if (me && me.companyType === 'partner') {
        APP.ptLoadReqs(); var n = APP.ptPendingIn();
        card = !((me.partner || {}).skills || []).length
          ? '<a class="card pt-promo" href="#/e/company"><strong>Describe what your team delivers</strong><span class="muted small">SAP Customers find partners by product, module and industry. Add yours so you are listed.</span></a>'
          : (n ? '<a class="card pt-promo" href="#/e/partner-requests"><strong>' + n + (n === 1 ? ' request' : ' requests') + ' waiting for your answer</strong><span class="muted small">SAP Customers asked to connect with you.</span></a>' : '');
      }
      return card ? html.replace('<div class="stat-row">', card + '<div class="stat-row">') : html;
    };
  })();

  /* filters on Find partners, and the editing fields of the capabilities section */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.matches) return;
    if (t.name === 'companyType' && t.closest('form[data-form="wiz-e"]') && APP.wizE) {
      APP.wizE.data.companyType = t.value;
      var bar = document.querySelector('.wiz-progress'); if (bar) bar.innerHTML = APP.wizProgressHtml(APP.wizStepsEFor(APP.wizE.data), APP.wizE.step);
      return;
    }
    if (t.name === 'companyType' && t.closest('form[data-form="company-edit"]')) {
      /* the sections on the left change with the type, so rebuild the page (typed values are kept) */
      if (APP.profileDraft) { APP.syncFormsToDrafts(null); APP.profileDraft.companyType = t.value; APP.render(); }
      return;
    }
    if (t.hasAttribute('data-pt-hide') && APP.ptHost()) { APP.ptEnsure(APP.ptHost()).hideName = !!t.checked; return; }
    var k = t.getAttribute('data-pt-f');
    if (k && k !== 'q') { var f = APP.ptF(); f[k] = t.value; if (k === 'product') f.module = ''; APP.render(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.hasAttribute) return;
    if (t.hasAttribute('data-pt-best') && APP.ptHost()) { APP.ptEnsure(APP.ptHost()).bestAt = String(t.value).slice(0, 400); return; }
    if (t.getAttribute('data-pt-f') === 'q') {
      APP.ptF().q = t.value;
      var box = document.getElementById('pt-results'); if (box) box.innerHTML = resultsHtml(APP.ptF());
    }
  });
})();
