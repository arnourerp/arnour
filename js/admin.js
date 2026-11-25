/* Arnour admin area, reporting and moderation tools (live mode only). */
(function () {
  'use strict';
  var B = APP.backend, h = APP.h;
  if (!B) return;

  var A = { data: {}, loading: {}, err: {}, q: { people: '', roles: '', community: '' }, rstatus: 'open', fstatus: 'open', conv: null, msg: { id: null, thread: null, busy: false }, imp: { text: '', rows: null, error: '', result: null, busy: false }, feed: { busy: {}, reading: {}, note: {}, unticked: {}, open: {}, listsSaved: false, secretBusy: false } };
  var RM = APP.reportMeta, REASONS = RM.REASONS, REASON_LABEL = RM.REASON_LABEL, KIND_LABEL = RM.KIND_LABEL, REMOVABLE = RM.REMOVABLE; /* shared with js/report.js */
  function when(ts) { var d = new Date(typeof ts === 'number' ? ts : ts); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function whenT(ts) { return APP.timeAgo ? APP.timeAgo(typeof ts === 'number' ? ts : new Date(ts).getTime()) : when(ts); }

  function reasonDialog(o) {
    APP.openDialog({
      title: o.title, sub: o.sub, danger: !!o.danger, confirmLabel: o.confirmLabel,
      body: '<label class="field"><span class="label">' + h(o.label || 'Note') + ' <span class="muted">(' + (o.required ? 'required' : 'optional') + ')</span></span><textarea id="dlg-note" class="input" rows="3" maxlength="300"></textarea><span class="muted small dlg-count" id="dlg-count">0 / 300</span></label>',
      onConfirm: function (v) {
        if (o.required && !String(v.note || '').trim()) { APP.toast('Please add a note'); return; }
        o.run(String(v.note || '').trim());
      }
    });
  }

  /* ---------- data ---------- */
  function load(key, fn, args) {
    if (A.loading[key]) return;
    A.loading[key] = true; delete A.err[key];
    B.rpc(fn, args || {}).then(function (d) { A.data[key] = d; }, function (e) { A.err[key] = (e && e.message) || 'Could not load'; }).then(function () {
      A.loading[key] = false;
      if (/^#\/admin/.test(location.hash)) APP.render();
    });
  }
  function reload(key) { delete A.data[key]; }
  function act(fn, args, okMsg, keys) {
    return B.rpc(fn, args).then(function () {
      (keys || []).forEach(reload); reload('overview'); reload('log');
      if (okMsg) APP.toast(okMsg);
      if (B.fetchCommunity) B.fetchCommunity().then(function (c) { if (c && !B.commBusy) B.applyCommunity(APP.db, c); APP.render(); }, function () { APP.render(); });
      else APP.render();
    }, function (e) { APP.toast('Could not do that: ' + String((e && e.message) || 'error')); });
  }

  /* ---------- views ---------- */
  /* sidebar groups: [group title, [[tab id, label, one-line hint], ...]] */
  var GROUPS = [
    ['Overview', [['overview', 'Dashboard', 'Numbers at a glance'], ['traffic', 'Traffic', 'Visitors, sign-ups and what people did'], ['health', 'Health', 'Errors and email delivery']]],
    ['People & roles', [['people', 'People', 'Professionals and companies'], ['unfinished', 'Unfinished', 'Accounts without a profile and professional profiles saved without SAP skills'], ['certs', 'Certifications', 'Badges professionals added from Credly: open them, and remove one if it is wrong'], ['roles', 'Roles', 'Posted and imported roles'], ['reports', 'Reports', 'Content people reported'], ['community', 'Community', 'Questions, answers, articles']]],
    ['Content', [['catalog', 'SAP catalog', 'Products, modules, specialties'], ['lists', 'Countries & languages', 'Countries, cities, regions, nationalities, languages'], ['import', 'Import jobs', 'Add roles from company career pages'], ['feeds', 'Job feeds', 'Check a company careers page every day and bring its SAP roles in as drafts']]],
    ['Communicate', [['messages', 'Messages', 'Write to people as the Arnour team, and read their replies'], ['reminders', 'Reminders', 'Follow-up e-mails to people who did not finish their profile, waiting for your approval'], ['announce', 'Announcements', 'Banner, bell and email to users'], ['feedback', 'Feedback', 'What people sent you']]],
    ['Settings', [['settings', 'Site settings', 'Sample content on or off'], ['log', 'Activity log', 'Everything admins did']]]
  ];
  var TABS = []; GROUPS.forEach(function (g) { g[1].forEach(function (t) { TABS.push(t); }); });

  function shell(tab, inner) {
    var open = A.data.overview ? A.data.overview.openReports : 0, fb = A.data.health && A.data.health.openFeedback ? A.data.health.openFeedback : 0;
    var mn = typeof A.data.staffN === 'number' ? A.data.staffN : 0, rn = typeof A.data.remN === 'number' ? A.data.remN : 0;
    var un = A.data.unfN ? (Number(A.data.unfN.noProfile) || 0) + (Number(A.data.unfN.noSkills) || 0) : 0;
    var menuOpen = !!A.menuOpen; A.menuOpen = false; /* the phone menu closes on the next page or refresh */
    var cur = TABS.filter(function (t) { return t[0] === tab; })[0];
    var badge = function (id) { var n = id === 'reports' ? open : id === 'feedback' ? fb : id === 'messages' ? mn : id === 'reminders' ? rn : id === 'unfinished' ? un : 0; return n ? ' <em>' + n + '</em>' : ''; };
    var groupBadge = function (g) { var n = 0; g[1].forEach(function (t) { n += t[0] === 'reports' ? open : t[0] === 'feedback' ? fb : t[0] === 'messages' ? mn : t[0] === 'reminders' ? rn : t[0] === 'unfinished' ? un : 0; }); return n; };
    /* phones: the grey page intro folds behind an (i) button next to the title */
    inner = String(inner).replace(/^(<h1>[^<]*<\/h1>)(<p class="muted[^"]*">[\s\S]*?<\/p>)/, function (m, t, p) {
      return '<div class="adm-togg"><div class="adm-head">' + t + '<button type="button" class="adm-i" data-action="adm-tog" aria-label="About this page">i</button></div>' + p.replace('<p class="', '<p class="adm-intro ') + '</div>';
    });
    var bnav = [['overview', 'Dashboard', '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'], ['people', 'People', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14.4c2 .8 3.5 2.6 3.5 5.6"/>'], ['roles', 'Roles', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'], ['messages', 'Messages', '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>']];
    var bar = '<nav class="adm-bottom" aria-label="Main admin sections">' + bnav.map(function (b) {
      return '<a class="adm-bt' + (b[0] === tab ? ' on' : '') + '" href="#/admin/' + b[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + b[2] + '</svg><span>' + b[1] + badge(b[0]) + '</span></a>';
    }).join('') + '<button type="button" class="adm-bt adm-menu-btn' + (bnav.some(function (b) { return b[0] === tab; }) ? '' : ' on') + '" data-action="adm-menu" aria-expanded="' + menuOpen + '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>More' + (open + fb + rn + un ? ' <em>' + (open + fb + rn + un) + '</em>' : '') + '</span></button></nav>';
    return '<div class="adm' + (menuOpen ? ' adm-menu-open' : '') + '"><header class="adm-top"><a class="brand-logo" href="#/admin" aria-label="Arnour admin">A</a><strong>Arnour admin</strong>' +
      '<span class="adm-title">' + h(cur ? cur[1] : '') + '</span><span class="grow"></span>' +
      '<a class="btn btn-ghost btn-sm" href="#/home">← View the site</a></header>' +
      '<div class="adm-backdrop" data-action="adm-menu-close"></div>' +
      '<div class="adm-body"><nav class="adm-tabs" aria-label="Admin sections">' + GROUPS.map(function (g) {
        var gb = groupBadge(g);
        return '<div class="adm-group"><div class="adm-group-t">' + h(g[0]) + (gb ? ' <em>' + gb + '</em>' : '') + '</div>' + g[1].map(function (t) {
          return '<a class="adm-tab' + (t[0] === tab ? ' on' : '') + '" href="#/admin/' + t[0] + '" title="' + h(t[2]) + '">' + h(t[1]) + badge(t[0]) + '</a>';
        }).join('') + '</div>';
      }).join('') + '</nav><main class="adm-main">' + inner + '</main></div>' + bar + '</div>';
  }
  function need(key, fn, args) {
    if (A.data[key] !== undefined) return null;
    if (A.err[key]) return '<div class="empty">Could not load: ' + h(A.err[key]) + ' <button class="btn btn-sm btn-outline" data-action="adm-retry" data-key="' + key + '">Try again</button></div>';
    load(key, fn, args);
    return '<div class="empty">Loading…</div>';
  }
  function searchBar(tab, ph) {
    return '<form class="adm-search" data-form="adm-search" data-tab="' + tab + '"><input class="input" name="q" value="' + h(A.q[tab] || '') + '" placeholder="' + h(ph) + '" autocomplete="off"><button class="btn btn-outline btn-sm" type="submit">Search</button></form>';
  }

  function vOverview() {
    var w = need('overview', 'admin_overview'); if (w) return w;
    var o = A.data.overview, max = Math.max.apply(null, (o.series || []).map(function (s) { return s.n; }).concat([1]));
    function st(n, l, href) { return '<a class="adm-stat" href="' + (href || '#/admin/overview') + '"><strong>' + n + '</strong><span>' + l + '</span></a>'; }
    return '<h1>Overview</h1><div class="adm-stats">' +
      st(o.openReports, 'Open reports', '#/admin/reports') + st(o.professionals, 'Professionals', '#/admin/people') + st(o.companies, 'Companies', '#/admin/people') +
      st(o.signups7, 'Sign-ups, 7 days') + st(o.signups30, 'Sign-ups, 30 days') + st(o.openRoles, 'Open roles', '#/admin/roles') +
      st(o.applications7, 'Applications, 7 days') + st(o.conversations, 'Conversations') + st(o.messages7, 'Messages, 7 days') +
      st(o.posts7, 'Community posts, 7 days', '#/admin/community') + st(o.suspended, 'Suspended', '#/admin/people') + st(o.selfCertified, 'Self-declared certified') +
      (A.data.unfN ? st((Number(A.data.unfN.noProfile) || 0) + (Number(A.data.unfN.noSkills) || 0), 'Unfinished professionals', '#/admin/unfinished') : '') +
      '</div><h2>Sign-ups, last 14 days</h2><div class="adm-bars adm-bars-n">' + (o.series || []).map(function (s) {
        var p = typeof s.p === 'number' ? s.p : s.n, np = s.n - p;
        return '<div class="adm-bar" title="' + h(s.d) + ': ' + s.n + ' sign-up(s), ' + p + ' with a profile, ' + np + ' with no profile yet"><b>' + (s.n || '') + '</b><div class="adm-bar-col" style="height:' + (s.n ? Math.max(6, Math.round(s.n / max * 90)) : 0) + 'px">' +
          (np ? '<i class="adm-np" style="flex:' + np + '"></i>' : '') + (p ? '<i style="flex:' + p + '"></i>' : '') + '</div><span>' + s.d.slice(8) + '</span></div>';
      }).join('') + '</div><p class="muted small adm-legend"><span class="adm-key"></span> Profile completed <span class="adm-key adm-np"></span> No profile yet. The number above each bar is that day\'s sign-ups. For visitors, sources and what people did, see <a class="link" href="#/admin/traffic">Traffic</a>.</p>' +
      (o.noProfile ? '<p class="muted small">' + o.noProfile + ' account(s) in total have signed up but not finished creating a profile.</p>' : '');
  }

  function vReports() {
    var key = 'reports:' + A.rstatus;
    var w = need(key, 'admin_reports', { p_status: A.rstatus, p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    var seg = ['open', 'resolved', 'dismissed', 'all'].map(function (s) { return '<button type="button" class="chip' + (A.rstatus === s ? ' chip-on' : '') + '" data-action="adm-rstatus" data-s="' + s + '">' + s[0].toUpperCase() + s.slice(1) + '</button>'; }).join('');
    return '<h1>Reports</h1><div class="chip-wrap mb16">' + seg + '</div>' + (list.length ? list.map(function (r) {
      var openR = r.status === 'open';
      return '<article class="adm-card"><div class="adm-row"><span class="pill">' + h(KIND_LABEL[r.kind] || r.kind) + '</span> <strong>' + h(r.label || r.target) + '</strong>' +
        (r.exists ? '' : ' <span class="pill muted-pill">Already removed</span>') + (openR ? '' : ' <span class="pill muted-pill">' + h(r.status) + '</span>') + '</div>' +
        '<p class="small"><strong>' + h(REASON_LABEL[r.reason] || r.reason) + '</strong>' + (r.note ? ' — ' + h(r.note) : '') + '</p>' +
        '<p class="muted small">Reported ' + whenT(r.createdTs) + ' by ' + h(r.reporter || 'a deleted account') + (r.ownerEmail ? ' · owner ' + h(r.ownerEmail) + (r.ownerSuspended ? ' (suspended)' : '') : '') + '</p>' +
        (r.handledNote ? '<p class="muted small">Note: ' + h(r.handledNote) + '</p>' : '') +
        '<div class="adm-actions">' +
        (r.kind === 'conversation' ? '<button class="btn btn-outline btn-sm" data-action="adm-read-conv" data-id="' + h(r.target) + '">Read conversation</button>' : '') +
        (r.link && r.exists && r.kind !== 'conversation' ? '<a class="btn btn-outline btn-sm" href="' + h(r.link) + '">Open</a>' : '') +
        (openR ? (r.canRemove && r.exists ? '<button class="btn btn-danger btn-sm" data-action="adm-mod" data-id="' + r.id + '" data-do="remove">Remove content</button>' : '') +
          (r.canSuspend && !r.ownerSuspended ? '<button class="btn btn-outline btn-sm" data-action="adm-mod" data-id="' + r.id + '" data-do="suspend">Suspend owner</button>' : '') +
          '<button class="btn btn-ghost btn-sm" data-action="adm-mod" data-id="' + r.id + '" data-do="resolve">Mark resolved</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="adm-mod" data-id="' + r.id + '" data-do="dismiss">Dismiss</button>' : '') +
        '</div></article>';
    }).join('') : '<div class="empty">Nothing here. ✓</div>') + convPanel();
  }
  function convPanel() {
    if (!A.conv) return '';
    var c = A.conv;
    return '<div class="adm-conv"><div class="adm-row"><strong>Reported conversation</strong><span class="grow"></span><button class="btn btn-ghost btn-sm" data-action="adm-close-conv">Close</button></div>' +
      '<p class="muted small">' + h(c.professional || '') + ' ↔ ' + h(c.company || '') + ' · opening this was recorded in the activity log.</p>' +
      (c.messages || []).map(function (m) {
        return '<p class="adm-msg"><b>' + (m.side === 'c' ? h(c.professional || 'Professional') : h(c.company || 'Company')) + '</b> <span class="muted small">' + when(m.ts) + '</span><br>' + (m.deleted ? '<em class="muted small">[deleted by sender]</em>' : h(m.text || '')) + (m.cv ? ' <em class="muted small">[CV: ' + h(m.cv) + ']</em>' : '') +
          (m.history || []).map(function (x) { return '<br><span class="muted small">' + (x.action === 'delete' ? 'Before deletion' : 'Before edit') + ' (' + when(x.ts) + '): </span>' + h(x.text || '') + (x.cv ? ' <em class="muted small">[CV: ' + h(x.cv) + ']</em>' : '') + (x.call ? ' <em class="muted small">[call proposal]</em>' : ''); }).join('') + '</p>';
      }).join('') + '</div>';
  }

  function vPeople(id) {
    var key = 'people:' + (A.q.people || '');
    var w = need(key, 'admin_people', { p_q: A.q.people || '', p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    if (id) { var one = list.filter(function (p) { return p.entityId === id || p.userId === id; })[0];
      if (!one) { A.q.people = id; return '<div class="empty">Looking up…</div>'; } list = [one]; }
    return '<h1>People</h1>' + (id ? '<p><a href="#/admin/people">← All people</a></p>' : searchBar('people', 'Search name, email, headline…')) +
      (list.length ? list.map(function (p) {
        var anon = p.anonymous ? ' <span class="pill muted-pill">Private</span>' : '';
        return '<article class="adm-card' + (p.suspended ? ' sus' : '') + '"><div class="adm-row"><strong>' + h(p.name || (p.role ? '' : 'No profile yet')) + '</strong>' + anon +
          ' <span class="pill muted-pill">' + h(p.role === 'consultant' ? 'Professional' : p.role === 'employer' ? 'Company' : 'No profile') + '</span>' +
          (p.suspended ? ' <span class="pill sus-pill">Suspended</span>' : '') + (p.certRevoked ? ' <span class="pill muted-pill">Badge removed</span>' : p.selfCertified ? ' <span class="pill">Self-declared certified</span>' : '') +
          (p.confirmed ? '' : ' <span class="pill muted-pill">Email not confirmed</span>') + '</div>' +
          '<p class="muted small">' + h(p.email) + (p.headline ? ' · ' + h(p.headline) : '') + '</p>' +
          '<p class="muted small">Joined ' + when(p.createdAt) + (p.lastSignIn ? ' · last seen ' + when(p.lastSignIn) : '') + ' · ' + p.posts + ' posts · ' + p.roles + ' roles · ' + p.applications + ' applications</p>' +
          (p.suspended && p.reason ? '<p class="small">Reason: ' + h(p.reason) + '</p>' : '') +
          '<div class="adm-actions">' +
          (p.entityId ? '<a class="btn btn-outline btn-sm" href="' + (p.role === 'consultant' ? '#/talent/' : '#/company/') + h(p.entityId) + '">View public page</a>' : '') +
          (p.entityId && !p.suspended ? '<button class="btn btn-outline btn-sm" data-action="adm-message" data-id="' + h(p.entityId) + '">Message as Arnour team</button>' : '') +
          '<span class="adm-more"><button type="button" class="btn btn-ghost btn-sm adm-more-btn" data-action="adm-tog" aria-label="More actions">⋯ More</button><span class="adm-more-body">' +
          (p.suspended ? '<button class="btn btn-outline btn-sm" data-action="adm-unsuspend" data-u="' + p.userId + '">Reinstate</button>'
            : '<button class="btn btn-outline btn-sm" data-action="adm-suspend" data-u="' + p.userId + '" data-n="' + h(p.email) + '">Suspend</button>') +
          (p.role === 'consultant' && p.selfCertified ? (p.certRevoked ? '<button class="btn btn-ghost btn-sm" data-action="adm-cert" data-e="' + h(p.entityId) + '" data-on="0">Restore badge</button>' : '<button class="btn btn-ghost btn-sm" data-action="adm-cert" data-e="' + h(p.entityId) + '" data-on="1">Remove badge</button>') : '') +
          '<button class="btn btn-danger btn-sm" data-action="adm-delete-user" data-u="' + p.userId + '" data-n="' + h(p.email) + '">Delete account</button></span></span></div></article>';
      }).join('') : '<div class="empty">No one found.</div>');
  }

  function vRoles() {
    var key = 'roles:' + (A.q.roles || '');
    var w = need(key, 'admin_jobs', { p_q: A.q.roles || '', p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    return '<h1>Roles</h1>' + searchBar('roles', 'Search title, company, email…') + (list.length ? list.map(function (j) {
      return '<article class="adm-card"><div class="adm-row"><strong>' + h(j.title) + '</strong> <span class="pill muted-pill">' + h(j.status) + '</span>' + (j.sample ? ' <span class="pill muted-pill">Sample</span>' : '') + (j.external ? ' <span class="pill ext-badge">External · ' + h(j.extEmployer || '') + '</span>' : '') + (j.confidential ? ' <span class="pill muted-pill">Confidential</span>' : '') + '</div>' +
        '<p class="muted small">' + h(j.company || '') + ' · ' + h(j.email || '') + ' · posted ' + whenT(j.postedTs) + ' · ' + j.applicants + ' applicants</p>' +
        '<div class="adm-actions"><a class="btn btn-outline btn-sm" href="#/job/' + h(j.id) + '">Open</a><span class="adm-more"><button type="button" class="btn btn-ghost btn-sm adm-more-btn" data-action="adm-tog" aria-label="More actions">⋯ More</button><span class="adm-more-body">' +
        (j.status === 'open' ? '<button class="btn btn-outline btn-sm" data-action="adm-job-status" data-id="' + h(j.id) + '" data-s="closed">Close role</button>' : '<button class="btn btn-outline btn-sm" data-action="adm-job-status" data-id="' + h(j.id) + '" data-s="open">Reopen</button>') +
        '<button class="btn btn-danger btn-sm" data-action="adm-job-delete" data-id="' + h(j.id) + '">Delete</button></span></span></div></article>';
    }).join('') : '<div class="empty">No roles found.</div>');
  }


  /* ---------- import roles from company career pages ---------- */
  var ROLE_IDS = ['functional', 'technical', 'basis', 'architect', 'delivery', 'support', 'keyuser', 'junior'];
  function checkImport(text) {
    var arr, out = [];
    try { arr = JSON.parse(text); } catch (e) {
      /* be forgiving: strip code fences / smart quotes, and escape raw line breaks that landed inside a text value */
      var fixed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
      var out2 = '', inStr = false, esc = false, ch, k;
      for (k = 0; k < fixed.length; k++) {
        ch = fixed.charAt(k);
        if (inStr) {
          if (esc) { esc = false; out2 += ch; }
          else if (ch === '\\') { esc = true; out2 += ch; }
          else if (ch === '"') { inStr = false; out2 += ch; }
          else if (ch === '\n') out2 += '\\n';
          else if (ch === '\r') { /* drop */ }
          else if (ch === '\t') out2 += '\\t';
          else out2 += ch;
        } else { if (ch === '"') inStr = true; out2 += ch; }
      }
      try { arr = JSON.parse(out2); } catch (e2) {
        var tail = !/\]\s*$/.test(fixed);
        return { error: (tail ? 'The text looks cut off: it does not end with ]. Copy the whole code block again (use the Copy button on the block). ' : '') + 'This is not valid JSON: ' + e2.message };
      }
    }
    if (!Array.isArray(arr)) return { error: 'Expected a list (an array) of roles, starting with [' };
    if (!arr.length) return { error: 'The list is empty.' };
    if (arr.length > 50) return { error: 'Import at most 50 roles at a time.' };
    arr.forEach(function (j) {
      var w = [];
      j = j || {};
      if (!String(j.title || '').trim()) w.push('Missing title');
      if (!String(j.extEmployer || '').trim()) w.push('Missing employer name');
      if (!/^https:\/\/[^ ]+\.[^ ]+$/.test(String(j.applyUrl || ''))) w.push('Apply link must be a full https link');
      if (!APP.countriesById[j.country]) w.push('Unknown country “' + (j.country || '') + '”');
      if (ROLE_IDS.indexOf(j.roleType) === -1) w.push('Unknown role type “' + (j.roleType || '') + '”');
      if (APP.jobTypes.indexOf(j.employmentType) === -1) w.push('Employment type should be one of ' + APP.jobTypes.join(', '));
      var req = Array.isArray(j.requires) ? j.requires : [];
      if (!req.length) w.push('No SAP skills mapped');
      req.forEach(function (r) {
        var p = APP.product(r && r.productId);
        if (!p || !p.modules || !p.modules.length) w.push('Unknown product “' + (r && r.productId) + '”');
        else if (r.moduleId !== '*' && !p.modules.some(function (m) { return m.id === r.moduleId; })) w.push('Unknown module “' + r.moduleId + '” in ' + p.name);
      });
      if (String(j.description || '').length > 8000) w.push('Description is over 8,000 characters and will be cut');
      /* non-blocking notes: weak skill mapping the admin should look at before importing */
      var nt = [];
      if (req.length && req.every(function (r) { return r && r.moduleId === '*'; }) && ['functional', 'technical'].indexOf(j.roleType) !== -1) nt.push('Skills are “any module” only. If the posting names modules, list them (use alternatives) instead.');
      if (/recruit|agency|staffing/i.test(String(j.extEmployer || '')) && !/recruiter|agency/i.test(String(j.extSource || ''))) nt.push('Looks like a recruiter or agency: the source label should say so.');
      out.push({ job: j, warn: w, note: nt });
    });
    return { rows: out };
  }
  /* used by js/jd-import.js: appends one role read from a pasted posting to the list, then runs the usual check */
  APP.adminImpAdd = function (row) {
    var ta = document.getElementById('imp-text'), cur = String(ta ? ta.value : A.imp.text).trim(), list = [];
    if (cur) {
      var c0 = checkImport(cur);
      if (c0.error) return { ok: false, msg: 'The list below has a problem, so nothing was added. Fix it or clear it first. ' + c0.error };
      list = JSON.parse(c0.rows ? JSON.stringify(c0.rows.map(function (r) { return r.job; })) : '[]');
    }
    if (list.length >= 50) return { ok: false, msg: 'The list already has 50 roles. Import them first.' };
    list.push(row);
    A.imp.text = JSON.stringify(list, null, 2); A.imp.result = null; A.imp.error = '';
    var c = checkImport(A.imp.text); A.imp.rows = c.rows || null;
    APP.render();
    return { ok: true };
  };
  function vImport() {
    var I = A.imp, bad = I.rows ? I.rows.filter(function (r) { return r.warn.length; }).length : 0;
    var html = '<h1>Import jobs</h1><p class="muted">Paste a posting below to have it read into the list, or paste the JSON produced by the “arnour-external-jobs” skill. Roles appear under <strong>Jobs on Arnour</strong>, labelled “External listing”, and expire after 60 days. Close or delete any of them anytime from the Roles tab.</p>' +
      (APP.jdSlotHtml ? APP.jdSlotHtml('admin') : '') +
      '<label class="field"><span class="label">Roles (JSON)</span><textarea id="imp-text" class="input" rows="10" spellcheck="false" placeholder="[ { &quot;title&quot;: &quot;…&quot;, … } ]">' + h(I.text) + '</textarea></label>' +
      '<div class="adm-actions"><label class="btn btn-ghost btn-sm" for="imp-file" style="cursor:pointer">Open a .json file…</label><input id="imp-file" type="file" accept=".json,.txt,application/json,text/plain" style="display:none"><button class="btn btn-outline btn-sm" data-action="adm-imp-check">Check</button>' +
      (I.rows && !bad ? '<button class="btn btn-primary btn-sm" data-action="adm-imp-run"' + (I.busy ? ' disabled' : '') + '>Import ' + I.rows.length + ' role' + (I.rows.length === 1 ? '' : 's') + '</button>' : '') + '</div>';
    if (I.error) html += '<p class="field-error" role="alert">' + h(I.error) + '</p>';
    if (I.rows) {
      html += '<h2>' + I.rows.length + ' role' + (I.rows.length === 1 ? '' : 's') + (bad ? ' · ' + bad + ' need fixing' : ' · ready to import') + '</h2>' + I.rows.map(function (r) {
        var j = r.job;
        return '<article class="adm-card"><div class="adm-row"><strong>' + h(j.title || '(no title)') + '</strong> ' + (r.warn.length ? '<span class="pill muted-pill">Fix</span>' : '<span class="pill">OK</span>') + '</div>' +
          '<p class="muted small">' + h(j.extEmployer || '') + ' · ' + h(j.extSource || '') + ' · ' + h((APP.countriesById[j.country] || {}).name || j.country || '') + (j.city ? ', ' + h(j.city) : '') + ' · ' + (Array.isArray(j.requires) ? j.requires.length : 0) + ' skill(s)</p>' +
          (r.warn.length ? '<ul class="small">' + r.warn.map(function (w) { return '<li>' + h(w) + '</li>'; }).join('') + '</ul>' : '') + (r.note && r.note.length ? '<ul class="small muted">' + r.note.map(function (w) { return '<li>Note: ' + h(w) + '</li>'; }).join('') + '</ul>' : '') + '</article>';
      }).join('');
    }
    if (I.result) {
      html += '<article class="adm-card"><strong>Imported ' + I.result.imported + '</strong>' + (I.result.skipped.length ? '<ul class="small">' + I.result.skipped.map(function (s) { return '<li>' + h(s.title || '(no title)') + ': ' + h(s.reason) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="adm-actions"><a class="btn btn-outline btn-sm" href="#/admin/roles">See in Roles</a></div></article>';
    }
    return html;
  }



  /* ---------- Job feeds (release 56): a company's careers page is checked every day; SAP roles arrive as drafts of that company ---------- */
  var FEED_ERR = {
    no_jobs: 'No job links were found on that page. Many careers pages build their job list with scripts, which Arnour cannot read. Try the address of the plain job list, or an RSS / sitemap address of the same site.',
    bad_link: 'That is not a link Arnour may open (it must be a public https address).', blocked_site: 'LinkedIn, Indeed and Glassdoor do not allow automatic reading.',
    link_unreachable: 'The page could not be opened (it may be down or slow).', link_blocked: 'The site refuses automatic readers (sign-in or bot protection).',
    not_page: 'The address is not a web page, feed or sitemap Arnour can read.', unreadable: 'The page was opened but no readable text was found (it may need scripts or a sign-in).',
    many_jobs: 'The page lists several jobs, not one.', gave_up: 'Could not be read after three tries.', no_sap_skills: 'No SAP skills found in the text.', not_a_job: 'Not a job ad.',
    ai: 'The reader had a problem (it will try again).', signin: 'Please sign in again.', not_allowed: 'Only an administrator may do this.', service: 'The service had a problem. Try again in a minute.',
    network: 'The connection dropped. Try again.', not_configured: 'The AI reader is not switched on (no ANTHROPIC_API_KEY in Netlify).', bad_request: 'The request was not understood. Reload the page and try again.'
  };
  var FEED_STATE = { found: 'Waiting for you', selected: 'Waiting to be read', drafted: 'Draft created', ignored: 'Set aside', failed: 'Could not be read', gone: 'No longer on the page' };
  function feedErr(code) { return FEED_ERR[code] || String(code || 'Something went wrong'); }
  function feedCall(action, id) {
    return B.ensureSession().then(function (s) {
      if (!s || !s.access_token) throw { code: 'signin' };
      var body = { action: action, feedId: id }; if (action === 'read') body.lists = APP.jobReaderLists();
      var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 70000);
      return fetch('/.netlify/functions/job-feed', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined }).then(function (r) {
        clearTimeout(to);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { code: (j && j.error) || 'service' }; return j; });
      }, function () { clearTimeout(to); throw { code: 'network' }; });
    });
  }
  function feedRefresh(id) {
    if (id) delete A.data['feeditems:' + id];
    return B.rpc('admin_feed_list', {}).then(function (d) { A.data.feeds = d; reload('log'); APP.render(); }, function () { APP.render(); });
  }
  function feedCheck(id) {
    var F = A.feed; if (F.busy[id]) return;
    F.busy[id] = 'check'; F.note[id] = ''; APP.render();
    feedCall('check', id).then(function (r) {
      F.busy[id] = '';
      if (r.status === 'ok') F.note[id] = r.found + ' role' + (r.found === 1 ? '' : 's') + ' on the page' + (r.new ? ', ' + r.new + ' new for you' : ', nothing new') + (r.closed ? '; ' + r.closed + ' closed because they left the page' : '') + '.';
      else if (r.status === 'warn') F.note[id] = '';
      else if (r.status === 'failed') F.note[id] = '';
      else F.note[id] = 'That page is no longer connected.';
      feedRefresh(id);
    }, function (e) { F.busy[id] = ''; F.note[id] = 'Could not check: ' + feedErr(e && e.code); APP.render(); });
  }
  function feedRead(id) {
    var F = A.feed; if (F.reading[id]) return;
    F.reading[id] = { n: 0 }; APP.render();
    var stop = function (msg) { delete F.reading[id]; if (msg) F.note[id] = msg; feedRefresh(id); };
    (function step() {
      feedCall('read', id).then(function (r) {
        if (r.done) return stop(r.stopped ? (r.stopped === 'limit' ? 'Stopped: the daily limit of AI reads is used up. Try again tomorrow.' : r.stopped === 'busy' ? 'Stopped: the site-wide daily limit of AI reads is used up.' : 'Stopped: the service had a problem. Press Read to continue.') : F.reading[id].n ? 'Done: ' + F.reading[id].n + ' role' + (F.reading[id].n === 1 ? '' : 's') + ' read. The company has been told about the new drafts.' : 'Nothing was waiting to be read.');
        F.reading[id].n++;
        B.rpc('admin_feed_list', {}).then(function (lst) { A.data.feeds = lst; APP.render(); }, function () { APP.render(); });
        step();
      }, function (e) { stop('Stopped: ' + feedErr(e && e.code) + ' Press Read to continue.'); });
    })();
  }
  function feedLists() { /* the site's option lists are copied to the database once per visit, so the daily run can read roles without a browser */
    var F = A.feed; if (F.listsSaved) return; F.listsSaved = true;
    try { B.rpc('admin_feed_save_lists', { p_lists: APP.jobReaderLists() }).then(function () { delete A.data.feedst; }, function () { /* the Read button still sends the lists itself */ }); } catch (e) { /* not ready */ }
  }
  function feedItemsHtml(f, showAll) {
    var key = 'feeditems:' + f.id, w = need(key, 'admin_feed_items', { p_id: f.id }); if (w) return w;
    var F = A.feed, L = A.data[key] || [], un = F.unticked[f.id] || {}, out = '';
    var found = L.filter(function (i) { return i.state === 'found'; });
    if (found.length) {
      var n = found.filter(function (i) { return !un[i.key]; }).length;
      out += '<p class="small"><strong>Tick the roles to bring in.</strong> They arrive as drafts of ' + h(f.company) + '; nothing goes live. Roles you leave unticked are set aside and never offered again.</p><div class="feed-tick">' +
        found.map(function (i, k) {
          return '<label class="feed-row"><input type="checkbox" data-action="adm-feed-tick" data-id="' + h(f.id) + '" data-k="' + k + '"' + (un[i.key] ? '' : ' checked') + '> <span>' + h(i.title) + '</span>' +
            (i.url ? ' <a class="small" href="' + h(i.url) + '" target="_blank" rel="noopener noreferrer">open</a>' : '') + '</label>';
        }).join('') + '</div><div class="adm-actions"><button class="btn btn-primary btn-sm" data-action="adm-feed-bring" data-id="' + h(f.id) + '"' + (F.busy[f.id] ? ' disabled' : '') + '>Bring in ' + n + ' role' + (n === 1 ? '' : 's') + ' as drafts</button></div>';
    }
    if (showAll) {
      out += '<table class="adm-table"><thead><tr><th>Role</th><th>State</th><th></th></tr></thead><tbody>' + (L.length ? L.map(function (i) {
        return '<tr><td>' + h(i.title) + (i.url ? '<div class="fb-meta"><a href="' + h(i.url) + '" target="_blank" rel="noopener noreferrer">open on the company page</a></div>' : '') + '</td><td>' + h(FEED_STATE[i.state] || i.state) + (i.error ? '<div class="fb-meta">' + h(feedErr(i.error)) + '</div>' : '') + '</td>' +
          '<td>' + (i.jobId ? '<a href="#/job/' + h(i.jobId) + '">Open role</a>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="3" class="muted">Nothing yet. Press Check now.</td></tr>') + '</tbody></table>';
    }
    return out;
  }
  function feedCard(f) {
    var F = A.feed, id = f.id, c = f.counts || {}, rd = F.reading[id], busy = F.busy[id], note = F.note[id];
    var st = f.lastStatus === 'new' ? 'Not checked yet' : f.lastStatus === 'failed' ? 'Could not read the page' : f.lastStatus === 'warn' ? 'Needs a look' : 'Checked ' + whenT(f.lastCheckedAt);
    var parts = [];
    if (c.found) parts.push(c.found + ' waiting for you to tick'); if (c.selected) parts.push(c.selected + ' waiting to be read'); if (c.drafted) parts.push(c.drafted + ' drafted');
    if (c.ignored) parts.push(c.ignored + ' set aside'); if (c.failed) parts.push(c.failed + ' could not be read'); if (c.gone) parts.push(c.gone + ' gone from the page');
    var html = '<article class="adm-card feed-card" data-feed="' + h(id) + '"><div class="adm-row"><strong>' + h(f.company) + '</strong> <span class="pill' + (f.lastStatus === 'ok' ? '' : ' muted-pill') + '">' + h(st) + '</span>' +
      (f.enabled ? '' : ' <span class="pill muted-pill">Switched off</span>') + (f.filter === 'all' ? ' <span class="pill muted-pill">Every role</span>' : '') + '</div>' +
      '<p class="muted small"><a href="' + h(f.url) + '" target="_blank" rel="noopener noreferrer">' + h(f.url) + '</a>' + (f.approved ? ' · new roles arrive as drafts by themselves' : ' · first list not ticked yet') + (f.autoClose ? ' · roles that disappear are closed' : '') + '</p>';
    if (f.lastStatus === 'failed' || f.lastStatus === 'warn') html += '<p class="field-error" role="alert">' + h(feedErr(f.lastError)) + '</p>';
    if (f.lastStatus === 'ok' && f.lastCounts && f.lastCounts.closed) html += '<p class="small">The last check closed ' + f.lastCounts.closed + ' role' + (f.lastCounts.closed === 1 ? '' : 's') + ' that left the page.</p>';
    if (parts.length) html += '<p class="small">' + h(parts.join(' · ')) + '</p>';
    if (note) html += '<p class="small" role="status">' + h(note) + '</p>';
    if (rd) html += '<p class="small" role="status"><strong>Reading roles…</strong> ' + rd.n + ' done. Keep this page open.</p>';
    html += feedItemsHtml(f, !!F.open[id]);
    html += '<div class="adm-actions"><button class="btn btn-outline btn-sm" data-action="adm-feed-check" data-id="' + h(id) + '"' + (busy || rd ? ' disabled' : '') + '>' + (busy === 'check' ? 'Checking…' : 'Check now') + '</button>' +
      (c.selected && !rd ? '<button class="btn btn-outline btn-sm" data-action="adm-feed-read" data-id="' + h(id) + '">Read the ' + c.selected + ' waiting role' + (c.selected === 1 ? '' : 's') + '</button>' : '') +
      (c.failed ? '<button class="btn btn-outline btn-sm" data-action="adm-feed-retry" data-id="' + h(id) + '">Try the ' + c.failed + ' failed again</button>' : '') +
      '<button class="btn btn-ghost btn-sm" data-action="adm-feed-all" data-id="' + h(id) + '">' + (F.open[id] ? 'Hide all roles' : 'Show all roles') + '</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="adm-feed-toggle" data-id="' + h(id) + '" data-on="' + (f.enabled ? '0' : '1') + '">' + (f.enabled ? 'Switch off' : 'Switch on') + '</button>' +
      '<button class="btn btn-danger btn-sm" data-action="adm-feed-remove" data-id="' + h(id) + '" data-n="' + h(f.company) + '">Disconnect</button></div></article>';
    return html;
  }
  function vFeeds() {
    var F = A.feed, w = need('feeds', 'admin_feed_list'); if (w) return '<h1>Job feeds</h1>' + w;
    var wc = need('feedco', 'admin_feed_companies'); if (wc) return '<h1>Job feeds</h1>' + wc;
    var ws = need('feedst', 'admin_feed_worker_status'); if (ws) return '<h1>Job feeds</h1>' + ws;
    feedLists();
    var S = A.data.feedst || {}, feeds = A.data.feeds || [], cos = A.data.feedco || [];
    var daily = S.hasSecret
      ? '<p><span class="pill">Daily check: on</span> ' + (S.lastTick ? 'last ran ' + h(whenT(S.lastTick)) + ' (it runs every 5 minutes and looks at each page once a day).' : 'The secret is saved, but the daily check has not run yet. It starts about 10 minutes after the Netlify setting is added and the site is deployed.') + '</p>' +
        '<div class="adm-actions"><button class="btn btn-ghost btn-sm" data-action="adm-feed-secret"' + (F.secretBusy ? ' disabled' : '') + '>Create a new secret</button></div>'
      : '<p><span class="pill muted-pill">Daily check: off</span> Until it is set up, pages are only looked at when you press <em>Check now</em>.</p>' +
        '<div class="adm-actions"><button class="btn btn-primary btn-sm" data-action="adm-feed-secret"' + (F.secretBusy ? ' disabled' : '') + '>Set up the daily check</button></div>';
    return '<h1>Job feeds</h1><p class="muted">Connect a company\'s careers page. Arnour looks at it, lists the SAP roles, and reads the ones you tick into <strong>drafts</strong> of that company (nothing goes live by itself). After the first list, new roles arrive as drafts by themselves, the company is told in the app and by e-mail, and roles that disappear from the page are closed after two daily checks.</p>' +
      '<article class="adm-card"><h2>Connect a careers page</h2><div class="adm-actions" style="align-items:flex-end;flex-wrap:wrap">' +
      '<label class="field" style="min-width:220px"><span class="label">Company</span><select id="feed-co" class="input"><option value="">Choose…</option>' + cos.map(function (c) { return '<option value="' + h(c.id) + '"' + (F.co === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field" style="flex:1;min-width:260px"><span class="label">Link to the careers page, job list, RSS feed or sitemap</span><input id="feed-url" class="input" placeholder="https://careers.example.com/jobs" autocomplete="off" inputmode="url" value="' + h(F.url || '') + '"></label></div>' +
      '<fieldset class="field"><legend class="label">Which roles?</legend><label class="small"><input type="radio" name="feed-filter" value="sap"' + (F.flt === 'all' ? '' : ' checked') + '> Only roles that look SAP-related (recommended)</label><br><label class="small"><input type="radio" name="feed-filter" value="all"' + (F.flt === 'all' ? ' checked' : '') + '> Every role (the reader sets aside the ones with no SAP skills; slower and costs more)</label></fieldset>' +
      '<div class="adm-actions"><button class="btn btn-primary btn-sm" data-action="adm-feed-add">Connect and check</button></div>' +
      (F.addMsg ? '<p class="field-error" role="alert">' + h(F.addMsg) + '</p>' : '') + '</article>' +
      '<article class="adm-card"><h2>Daily check</h2>' + daily + '</article>' +
      '<h2>Connected pages</h2>' + (feeds.length ? feeds.map(feedCard).join('') : '<div class="empty">No page connected yet.</div>');
  }

  /* ---------- problem reports, error log, usage ---------- */
  var CAT = { problem: 'Problem', suggestion: 'Suggestion', other: 'Other' };
  function shortUa(ua) {
    ua = String(ua || ''); var b = /(Edg|Chrome|CriOS|Firefox|FxiOS|Safari)\/[\d.]+/.exec(ua);
    var os = /iPhone|iPad|Android|Windows|Mac OS X|Linux/.exec(ua);
    return (b ? b[1].replace('Edg', 'Edge').replace('CriOS', 'Chrome').replace('FxiOS', 'Firefox') : 'Browser') + ' · ' + (os ? os[0] : '');
  }
  function vFeedback() {
    var key = 'feedback:' + A.fstatus;
    var w = need(key, 'admin_feedback', { p_status: A.fstatus, p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    return '<h1>Feedback</h1><div class="adm-actions"><button class="btn btn-sm ' + (A.fstatus === 'open' ? 'btn-primary' : 'btn-outline') + '" data-action="adm-fstatus" data-s="open">Open</button>' +
      '<button class="btn btn-sm ' + (A.fstatus === 'done' ? 'btn-primary' : 'btn-outline') + '" data-action="adm-fstatus" data-s="done">Done</button></div>' +
      (list.length ? list.map(function (f) {
        var errs = (f.ctx && f.ctx.errors) || [];
        return '<article class="adm-card"><div class="adm-row"><span class="pill">' + h(CAT[f.category] || f.category) + '</span> <strong>' + h(f.email || 'Anonymous') + '</strong>' +
          (f.role ? ' <span class="pill muted-pill">' + h(f.role) + '</span>' : '') + ' <span class="muted small">' + whenT(f.created_ts) + '</span></div>' +
          '<p style="white-space:pre-line">' + h(f.message) + '</p>' +
          '<p class="fb-meta">' + h(f.page) + ' · ' + h(shortUa(f.ua)) + (f.ctx && f.ctx.viewport ? ' · ' + h(f.ctx.viewport) : '') + '</p>' +
          (errs.length ? '<details class="fb-meta"><summary>' + errs.length + ' recent error(s)</summary>' + errs.map(function (e) { return '<div>' + h(e.t + ' ' + e.m + ' ' + (e.s || '')) + '</div>'; }).join('') + '</details>' : '') +
          '<div class="adm-actions">' +
          (f.shot ? '<button class="btn btn-outline btn-sm" data-action="adm-fb-shot" data-p="' + h(f.shot) + '">View screenshot</button>' : '') +
          (f.email ? '<a class="btn btn-outline btn-sm" href="mailto:' + h(f.email) + '?subject=' + encodeURIComponent('Re: your Arnour report') + '&body=' + encodeURIComponent('Hi,\n\nThank you for your report:\n"' + f.message.slice(0, 300) + '"\n\n') + '">Reply by email</a>' : '') +
          '<button class="btn btn-outline btn-sm" data-action="adm-fb-set" data-id="' + f.id + '" data-s="' + (f.status === 'open' ? 'done' : 'open') + '">' + (f.status === 'open' ? 'Mark done' : 'Reopen') + '</button></div></article>';
      }).join('') : '<div class="empty">Nothing here.</div>');
  }
  var OUTCOME_LABEL = { fixed: 'Fixed', noise: 'Not a bug', cleared: 'Cleared' };
  function errHistory() {
    var open = !!A.errHistOpen;
    var head = '<h2>Error history</h2><div class="adm-actions" style="margin-top:0"><button type="button" class="btn btn-outline btn-sm" data-action="adm-err-history">' + (open ? 'Hide the history' : 'Show the history') + '</button></div>';
    if (!open) return head;
    var w = need('errhist', 'admin_error_history', { p_limit: 300 }); if (w) return head + w;
    var L = A.data.errhist || [];
    return head + (L.length ? '<table class="adm-table"><thead><tr><th>Dealt with</th><th>Error</th><th>Times</th><th>What was done</th></tr></thead><tbody>' +
      L.map(function (x) {
        return '<tr><td>' + h(when(+x.resolved_ts)) + '<div class="fb-meta"><span class="pill ' + (x.outcome === 'fixed' ? 'inv' : 'muted-pill') + '">' + h(OUTCOME_LABEL[x.outcome] || x.outcome) + '</span></div></td>' +
          '<td>' + h(x.message) + '<div class="fb-meta">' + h(x.src) + ' · ' + h(x.page) + ' · ' + h(shortUa(x.ua)) + '</div></td><td>' + x.n + '</td><td>' + h(x.note || '') + '</td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">Nothing in the history yet.</div>');
  }
  function vHealth() {
    var w = need('health', 'admin_health'); if (w) return w;
    var H = A.data.health, errs = H.errors || [], use = H.usage || [];
    var names = {}, days = {};
    use.forEach(function (u) { names[u.name] = names[u.name] || {}; names[u.name][u.d] = u.n; days[u.d] = 1; });
    var dl = Object.keys(days).sort().reverse().slice(0, 7), nl = Object.keys(names).sort();
    return '<h1>Health</h1><h2>Errors from users\' browsers</h2><p class="muted small">Recorded automatically, grouped by message. No names or typed text are stored.</p>' +
      (errs.length ? '<div class="adm-actions"><button class="btn btn-outline btn-sm" data-action="adm-clear-errors">Clear all</button></div><table class="adm-table"><thead><tr><th>Error</th><th>Times</th><th>Last seen</th><th>Where</th><th></th></tr></thead><tbody>' +
        errs.map(function (e) { return '<tr><td>' + h(e.message) + (e.returned ? ' <span class="pill warn-pill" title="This one was marked fixed or not a bug before">Came back</span>' : '') + '<div class="fb-meta">' + h(e.src) + '</div></td><td>' + e.n + '</td><td>' + whenT(e.last_ts) + '</td><td>' + h(e.page) + '<div class="fb-meta">' + h(shortUa(e.ua)) + '</div></td>' +
          '<td class="adm-err-acts"><button type="button" class="btn btn-outline btn-sm" data-action="adm-err-resolve" data-fp="' + h(e.fp) + '" data-o="fixed">Fixed</button> <button type="button" class="btn btn-ghost btn-sm" data-action="adm-err-resolve" data-fp="' + h(e.fp) + '" data-o="noise">Not a bug</button></td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No errors recorded. 🎉</div>') +
      '<p class="muted small">“Fixed” and “Not a bug” move an error to the history below, with a note, so it is never lost. If the same error appears again it is marked “Came back”.</p>' +
      errHistory() +
      '<h2>Usage (last 7 days)</h2><p class="muted small">Counts of page views by section (v:…), external-apply clicks and applications, new visitors from a link or campaign (lnd:facebook…) and completed profiles by source (conv:c: consultants, conv:e: companies). No cookies, no personal data.</p>' +
      (nl.length ? '<table class="adm-table"><thead><tr><th></th>' + dl.map(function (d) { return '<th>' + h(d.slice(5)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        nl.map(function (n) { return '<tr><td>' + h(usageLabel(n)) + '<div class="fb-meta">' + h(n) + '</div></td>' + dl.map(function (d) { return '<td>' + (names[n][d] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No data yet.</div>');
  }


  /* plain-English names for the anonymous counters */
  var VIEW_LABEL = { home: 'Home page', job: 'Role pages', jobs: 'Role list', c: 'Professional area (signed in)', e: 'Company area (signed in)', login: 'Sign-in page', register: 'Sign-up page', onboard: 'Profile steps, professional', 'onboard-e': 'Profile steps, company', 'check-email': '“Confirm your email” screen', community: 'Community', company: 'Company pages', talent: 'Talent page', partners: 'Partners page', partner: 'Partner pages', account: 'Account settings', search: 'Search', start: 'Start page', admin: 'Admin (your own visits)' };
  function usageLabel(n) {
    var m;
    if ((m = /^v:(.+)$/.exec(n))) return (VIEW_LABEL[m[1]] || m[1]) + ' — views';
    if (n === 'apply') return 'Applied to a role on Arnour';
    if (n === 'ext_apply') return 'Clicked an external apply link';
    if ((m = /^mn:(seen|go|no|open):(list|job|apply|save)$/.exec(n))) return 'Match prompt (visitors): ' + ({ seen: 'shown', go: 'tapped Create my profile', no: 'closed it (Not now)', open: 'tapped Open a role' })[m[1]] + ' — ' + ({ list: 'slide-up on the role list', job: 'slide-up on a role page', apply: 'popup after Apply', save: 'popup after Save' })[m[2]];
    if ((m = /^wz:(next|later):(.+)$/.exec(n))) return 'Professional sign-up, ' + (m[1] === 'next' ? 'pressed Continue on' : 'pressed Save and finish later on') + ' step: ' + m[2];
    if ((m = /^fp:go:(.+)$/.exec(n))) return 'Tapped Finish your profile (' + m[1] + ')';
    if ((m = /^lnd:(.+)$/.exec(n))) return 'New visitors from ' + m[1];
    if ((m = /^lc:(.+)$/.exec(n))) return 'New visitors from the campaign ' + m[1];
    if ((m = /^conv:c:(.+)$/.exec(n))) return 'Professional profiles completed, from ' + m[1];
    if ((m = /^conv:e:(.+)$/.exec(n))) return 'Company profiles completed, from ' + m[1];
    return n;
  }
  APP.adminUsageLabel = usageLabel;

  function vTraffic() {
    var days = A.trafficDays || 14, hrs = days === 'h24';
    var w = need('traffic:' + days, hrs ? 'admin_traffic_hours' : 'admin_traffic', hrs ? {} : { p_days: days }); if (w) return w;
    var T = A.data['traffic:' + days], use = T.usage || [], acc = (T.accounts || []).map(function (a) { return { d: a.d || a.h, n: a.n, p: a.p }; });
    var by = {}, tot = {};
    use.forEach(function (u) { var k = u.d || u.h; (by[k] = by[k] || {})[u.name] = u.n; tot[u.name] = (tot[u.name] || 0) + u.n; });
    /* the 24-hour view: hours are shown in Dubai time (the database keeps them in UTC) */
    function hourLabel(iso) { var dt = new Date(iso); return dt.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short' }) + ' ' + dt.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false }); }
    function sumPrefix(o, re) { var t = 0; Object.keys(o).forEach(function (k) { if (re.test(k)) t += o[k]; }); return t; }
    var dayList = acc.map(function (a) { return a.d; });
    function rowOf(d, a) {
      var o = by[d] || {};
      return { d: d, visitors: sumPrefix(o, /^lnd:/), views: sumPrefix(o, /^v:/) - (o['v:admin'] || 0), home: o['v:home'] || 0, jobs: o['v:job'] || 0, reg: o['v:register'] || 0,
        acc: a.n, prof: a.p, applied: (o.apply || 0), ext: (o.ext_apply || 0) };
    }
    var rows = acc.map(function (a) { return rowOf(a.d, a); });
    var T0 = { visitors: 0, views: 0, home: 0, jobs: 0, reg: 0, acc: 0, prof: 0, applied: 0, ext: 0 };
    rows.forEach(function (r) { Object.keys(T0).forEach(function (k) { T0[k] += r[k]; }); });
    var chips = '<button type="button" class="chip' + (hrs ? ' chip-on' : '') + '" data-action="adm-traffic-days" data-n="h24">Last 24 hours</button>' +
      [7, 14, 30].map(function (n) { return '<button type="button" class="chip' + (days === n ? ' chip-on' : '') + '" data-action="adm-traffic-days" data-n="' + n + '">' + n + ' days</button>'; }).join('');
    function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '—'; }
    var steps = [
      ['New visitors', T0.visitors, 'People who arrived for the first time on this browser (counted once per browser).'],
      ['Views of the sign-up page', T0.reg, 'Page views, not people: one person can count more than once.'],
      ['Accounts created', T0.acc, 'Real accounts, from the database.'],
      ['Profile completed', T0.prof, 'Accounts created in this period that now have a profile.'],
      ['Applied or clicked apply', T0.applied + T0.ext, 'Applications on Arnour plus clicks on external apply links.']
    ];
    var funnel = '<table class="adm-table"><thead><tr><th>Step</th><th>Total</th><th></th></tr></thead><tbody>' + steps.map(function (s) {
      return '<tr><td>' + h(s[0]) + '<div class="fb-meta">' + h(s[2]) + '</div></td><td><strong>' + s[1] + '</strong></td><td></td></tr>';
    }).join('') + '</tbody></table><p class="muted small">Of the accounts created: ' + pct(T0.prof, T0.acc) + ' have a profile.</p>';
    var dayTable = '<div class="adm-scroll"><table class="adm-table adm-table-num"><thead><tr><th>' + (hrs ? 'Hour (Dubai)' : 'Day') + '</th><th>New visitors</th><th>Page views</th><th>Home</th><th>Role pages</th><th>Sign-up page</th><th>Accounts</th><th>Profile done</th><th>Applied</th><th>External apply</th></tr></thead><tbody>' +
      '<tr class="adm-total"><td><strong>Total</strong></td><td>' + T0.visitors + '</td><td>' + T0.views + '</td><td>' + T0.home + '</td><td>' + T0.jobs + '</td><td>' + T0.reg + '</td><td>' + T0.acc + '</td><td>' + T0.prof + '</td><td>' + T0.applied + '</td><td>' + T0.ext + '</td></tr>' +
      rows.slice().reverse().map(function (r) {
        return '<tr><td>' + h(hrs ? hourLabel(r.d) : r.d.slice(5)) + '</td><td>' + (r.visitors || '') + '</td><td>' + (r.views || '') + '</td><td>' + (r.home || '') + '</td><td>' + (r.jobs || '') + '</td><td>' + (r.reg || '') + '</td><td>' + (r.acc || '') + '</td><td>' + (r.prof || '') + '</td><td>' + (r.applied || '') + '</td><td>' + (r.ext || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var src = {};
    Object.keys(tot).forEach(function (k) {
      var m = /^(lnd|conv:c|conv:e):(.+)$/.exec(k); if (!m) return;
      var o = src[m[2]] = src[m[2]] || { v: 0, c: 0, e: 0 };
      if (m[1] === 'lnd') o.v += tot[k]; else if (m[1] === 'conv:c') o.c += tot[k]; else o.e += tot[k];
    });
    var sl = Object.keys(src).sort(function (a, b) { return (src[b].v + src[b].c + src[b].e) - (src[a].v + src[a].c + src[a].e); });
    var srcTable = sl.length ? '<table class="adm-table adm-table-num"><thead><tr><th>Where they came from</th><th>New visitors</th><th>Professional profiles done</th><th>Company profiles done</th></tr></thead><tbody>' + sl.map(function (k) {
      return '<tr><td>' + h(k === 'direct' ? 'direct (no link or tag found)' : k) + '</td><td>' + (src[k].v || '') + '</td><td>' + (src[k].c || '') + '</td><td>' + (src[k].e || '') + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="empty">No tagged visits yet.</div>';
    /* per campaign: new visitors come from the anonymous counters (lc:<campaign>), accounts and finished profiles from the sign-up note saved with each account */
    var cmp = {};
    Object.keys(tot).forEach(function (k) { var m = /^lc:(.+)$/.exec(k); if (m) (cmp[m[1]] = cmp[m[1]] || { v: 0, n: 0, pc: 0, pe: 0, g: 0, src: {} }).v += tot[k]; });
    (T.campaigns || []).forEach(function (c) {
      var o = cmp[c.c] = cmp[c.c] || { v: 0, n: 0, pc: 0, pe: 0, g: 0, src: {} };
      o.n += c.n; o.pc += c.pc; o.pe += c.pe; o.g += c.g || 0; o.src[c.s + ' / ' + c.m] = 1;
    });
    var cl = Object.keys(cmp).sort(function (a, b) { return (cmp[b].n - cmp[a].n) || (cmp[b].v - cmp[a].v) || (a < b ? -1 : 1); });
    var cmpTable = cl.length ? '<div class="adm-scroll"><table class="adm-table adm-table-num" id="adm-campaigns"><thead><tr><th>Campaign</th><th>New visitors</th><th>Accounts</th><th>Professional profiles done</th><th>Company profiles done</th><th>Visitor to profile</th></tr></thead><tbody>' + cl.map(function (k) {
      var o = cmp[k], done = o.pc + o.pe, srcs = Object.keys(o.src).join(', ');
      return '<tr><td>' + h(k) + (srcs || o.g ? '<div class="fb-meta">' + h(srcs) + (o.g ? (srcs ? ' · ' : '') + o.g + ' from a Google ad click' : '') + '</div>' : '') + '</td><td>' + (o.v || '') + '</td><td>' + (o.n || '') + '</td><td>' + (o.pc || '') + '</td><td>' + (o.pe || '') + '</td><td>' + (o.v ? pct(done, o.v) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="muted small">A campaign is the <code>utm_campaign</code> on the link that first brought the person (Google Ads final URLs, posts, e-mails). Visitors are counted once per browser; accounts and profiles are those created in this period' + (hrs ? ' (the last 24 hours)' : '') + '. Clicks, cost and cost per profile are in Google Ads.</p>'
      : '<div class="empty">No campaign links yet. Links with <code>utm_campaign=…</code> show up here.</div>';
    /* visitor match prompt (slide-up and popup): shown / tapped Create my profile / closed */
    var mnRows = [['list', 'Slide-up on the role list'], ['job', 'Slide-up on a role page'], ['apply', 'Popup after Apply'], ['save', 'Popup after Save']];
    var mnAny = mnRows.some(function (r) { return tot['mn:seen:' + r[0]]; });
    var mnTable = mnAny ? '<table class="adm-table adm-table-num" id="adm-mnudge"><thead><tr><th>Where</th><th>Shown</th><th>Tapped Create my profile</th><th>Closed (Not now)</th><th>Tapped Open a role</th></tr></thead><tbody>' + mnRows.map(function (r) {
      var sn = tot['mn:seen:' + r[0]] || 0, go = tot['mn:go:' + r[0]] || 0;
      return '<tr><td>' + h(r[1]) + '</td><td>' + (sn || '') + '</td><td>' + (go ? go + ' (' + pct(go, sn) + ')' : '') + '</td><td>' + (tot['mn:no:' + r[0]] || '') + '</td><td>' + (r[0] === 'list' ? (tot['mn:open:list'] || '') : '') + '</td></tr>';
    }).join('') + '</tbody></table><p class="muted small">The slide-up shows once per browser. Tapped Create my profile counts the tap, not a finished profile: compare with the funnel above and the campaign table.</p>' : '<div class="empty">No prompt shown yet.</div>';
    /* professional sign-up: how many pressed Continue on each step, and how many saved early with "Save and finish later" */
    var wzRows = [['about', 'About you'], ['privacy', 'Privacy'], ['experience', 'Experience'], ['skills', 'SAP skills'], ['specialties', 'Specialties']];
    var wzAny = wzRows.some(function (r) { return tot['wz:next:' + r[0]] || tot['wz:later:' + r[0]]; });
    var wzTable = wzAny ? '<table class="adm-table adm-table-num" id="adm-wizsteps"><thead><tr><th>Sign-up step</th><th>Pressed Continue</th><th>Pressed Save and finish later</th></tr></thead><tbody>' + wzRows.map(function (r) {
      return '<tr><td>' + h(r[1]) + '</td><td>' + (tot['wz:next:' + r[0]] || '') + '</td><td>' + (tot['wz:later:' + r[0]] || '') + '</td></tr>';
    }).join('') + '</tbody></table><p class="muted small">Counts taps, not people: someone who goes back and forth counts twice. “Save and finish later” is offered from the Privacy step on. The step after Specialties creates the profile, so it is counted in the funnel above. “Finish your profile” taps (dashboard, roles list, role page): ' + [['dash', 'dashboard'], ['jobs', 'roles list'], ['job', 'role page'], ['card', 'grey pill on a role card']].map(function (r) { return h(r[1]) + ' ' + (tot['fp:go:' + r[0]] || 0); }).join(', ') + '.</p>' : '<div class="empty">No sign-up step counted yet.</div>';
    var pv = Object.keys(tot).filter(function (k) { return /^v:/.test(k) && k !== 'v:admin'; }).sort(function (a, b) { return tot[b] - tot[a]; });
    var pvTable = pv.length ? '<table class="adm-table adm-table-num"><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>' + pv.map(function (k) { return '<tr><td>' + h(usageLabel(k).replace(/ — views$/, '')) + '</td><td>' + tot[k] + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No data yet.</div>';
    return '<h1>Traffic</h1><div class="chip-wrap mb16">' + chips + '</div>' +
      (hrs ? '<p class="muted small">The last 24 hours, hour by hour, in Dubai time (the current hour is still filling). Anonymous counters: no cookies, no names. A “page view” is one page opened, so one person can add several.' +
          (T.since && new Date(T.since) > new Date(T.start) ? ' Hourly counting started at ' + hourLabel(T.since) + ', so earlier hours show only accounts.' : '') + '</p>'
        : '<p class="muted small">Anonymous counters: no cookies, no names. Days are counted in UTC (Dubai is 4 hours ahead). A “page view” is one page opened, so one person can add several. Your own visits stop being counted from this release; earlier days still include them (except the Admin row, which is hidden here).</p>') +
      '<h2>From visit to profile</h2>' + funnel +
      '<h2>' + (hrs ? 'Hour by hour' : 'Day by day') + '</h2>' + dayTable +
      '<h2>Where people came from</h2>' + srcTable +
      '<h2>By campaign</h2>' + cmpTable +
      '<h2>Match prompt for visitors</h2>' + mnTable +
      '<h2>Professional sign-up steps</h2>' + wzTable +
      '<h2>Pages people opened</h2>' + pvTable +
      '<p class="muted small">For real visitor totals, search impressions and clicks, see Netlify Analytics and Google Search Console.</p>';
  }


  /* ---------- reminders: follow-up e-mails to people who did not finish their profile (you approve each one) ---------- */
  var REM_ROLE = { consultant: 'Professional', employer: 'Company', any: 'Not chosen yet' };
  var REM_STATUS = { sent: 'Sent', skipped: 'Skipped', expired: 'Expired (not approved in time)', done: 'Finished the profile first', failed: 'Failed to send', approved: 'Sending…' };
  var REM_TEXT = { skills1: 'Saved without SAP skills · 1st reminder', skills2: 'Saved without SAP skills · 2nd (last) reminder', consultant1: 'Professional · 1st reminder', consultant2: 'Professional · 2nd (last) reminder', employer1: 'Company · 1st reminder', employer2: 'Company · 2nd (last) reminder', any1: 'Role not chosen · 1st reminder', any2: 'Role not chosen · 2nd (last) reminder' };
  function vReminders() {
    var w = need('reminders', 'admin_reminders'); if (w) return w;
    var R = A.data.reminders, pend = R.pending || [], rec = R.recent || [], texts = R.texts || [];
    var table = pend.length ? '<div class="adm-actions" style="margin-top:0"><button type="button" class="btn btn-primary btn-sm" data-action="adm-rem-all">Send all (' + pend.length + ')</button></div>' +
      '<div class="adm-scroll"><table class="adm-table"><thead><tr><th>E-mail</th><th>Signed up as</th><th>Came from</th><th>Confirmed</th><th>Reminder</th><th></th></tr></thead><tbody>' + pend.map(function (r) {
        return '<tr><td>' + h(r.email) + '</td><td>' + h(REM_ROLE[r.role] || r.role) + '</td><td>' + h(r.src) + '</td><td>' + whenT(r.confirmedTs) + '</td><td>' + (r.kind === 'skills' ? 'SAP skills · ' : '') + (r.step === 2 ? '2nd (last)' : '1st') + '</td>' +
          '<td class="adm-err-acts"><button type="button" class="btn btn-outline btn-sm" data-action="adm-rem-send" data-id="' + r.id + '">Send</button> <button type="button" class="btn btn-ghost btn-sm" data-action="adm-rem-skip" data-id="' + r.id + '">Skip</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="empty">Nobody is waiting. 🎉 People appear here about 2 hours after they confirm their e-mail (or save a profile), if they still have no profile or no SAP skills.</div>';
    var hist = rec.length ? '<table class="adm-table"><thead><tr><th>E-mail</th><th>Reminder</th><th>What happened</th><th>When</th></tr></thead><tbody>' + rec.map(function (r) {
      return '<tr><td>' + h(r.email) + '</td><td>' + (r.kind === 'skills' ? 'SAP skills · ' : '') + (r.step === 2 ? '2nd' : '1st') + '</td><td>' + h(REM_STATUS[r.status] || r.status) + '</td><td>' + whenT(r.ts) + '</td></tr>';
    }).join('') + '</tbody></table>' : '<div class="empty">Nothing yet.</div>';
    var edit = texts.map(function (t) {
      return '<form class="adm-card" data-form="adm-rem-text" data-key="' + h(t.key) + '"><strong>' + h(REM_TEXT[t.key] || t.key) + '</strong>' +
        '<label class="field"><span class="label">Subject</span><input class="input" name="subject" maxlength="120" value="' + h(t.subject) + '"></label>' +
        '<label class="field"><span class="label">Text <span class="muted">(blank line = new paragraph)</span></span><textarea class="input" name="body" rows="6" maxlength="1500">' + h(t.body) + '</textarea></label>' +
        '<div class="adm-actions"><button class="btn btn-outline btn-sm" type="submit">Save wording</button></div></form>';
    }).join('');
    return '<h1>Reminders</h1><p class="muted small">People who confirmed their e-mail but have no profile after 2 hours, and professionals who saved a profile without SAP skills (marked “SAP skills”). Nothing is sent until you press Send. Each person gets at most one reminder, plus one more about 3 days after the first (also needs your approval). Waiting items expire after 3 days. People who finished their profile or unsubscribed are never sent one.</p>' +
      (R.ready ? '' : '<div class="adm-card sus"><strong>E-mail sending is not set up</strong><p class="muted small">The Resend key is missing, so approved reminders will wait.</p></div>') +
      '<h2>Waiting for your approval</h2>' + table +
      '<h2>Sent and decided</h2>' + hist +
      '<h2>The wording</h2><p class="muted small">Every e-mail has an “Arnour” header, a button (“Finish my profile” or “Add my SAP skills”) and an unsubscribe link added automatically. Check the text before you send the first one.</p>' + edit;
  }

  /* ---------- unfinished: accounts without a profile and profiles saved without SAP skills ---------- */
  A.unfF = A.unfF || 'all';
  /* Certifications: every badge a professional added (the database checked it with Credly); name differences first */
  function vCerts() {
    var w = need('certs', 'admin_credentials'); if (w) return w;
    var rows = A.data.certs || [], odd = rows.filter(function (r) { return r.nameMatch === false; }).length;
    var table = rows.length ? '<div class="adm-scroll"><table class="adm-table" id="adm-cert-table"><thead><tr><th>Professional</th><th>Badge</th><th>Dates</th><th>Name on badge</th><th>Checked</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
      var nm = r.nameMatch === false ? '<span class="pill" style="background:#FEF3C7;color:#92400E">Different from profile</span>' : r.nameMatch === true ? '<span class="muted">Matches</span>' : '<span class="muted">Not known</span>';
      return '<tr data-cred="' + h(r.id) + '"><td><strong>' + h(r.who || 'No name') + '</strong><br><span class="muted small">' + h(r.headline || '') + '</span></td>' +
        '<td>' + h(r.title) + '<br><span class="muted small">' + h([r.issuer, r.kind].filter(Boolean).join(' · ')) + '</span></td>' +
        '<td class="small">' + h(r.issued || '') + (r.expires ? '<br>to ' + h(r.expires) : '') + '</td><td>' + nm + '</td><td class="small">' + whenT(r.checked) + '</td>' +
        '<td><a class="btn btn-ghost btn-sm" href="' + h(r.url) + '" target="_blank" rel="noopener">Open on Credly</a> <a class="btn btn-ghost btn-sm" href="#/talent/' + h(r.entity) + '">Profile</a> ' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="adm-cred-remove" data-id="' + h(r.id) + '" data-n="' + h(r.title) + '">Remove</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">No certifications added yet.</div>';
    return '<h1>Certifications</h1><p class="muted">Badges that professionals added with a Credly link. The database asked Credly and saved what Credly said; the person cannot change it. Open the badge on Credly to compare it with the profile. A badge whose name is different from the profile name is listed first.</p>' +
      '<div class="adm-stats adm-stats-sm"><div class="adm-stat"><strong>' + rows.length + '</strong><span>Badges</span></div><div class="adm-stat"><strong>' + odd + '</strong><span>Name is different</span></div></div>' + table;
  }

  function vUnfinished() {
    var w = need('unfinished', 'admin_unfinished'); if (w) return w;
    var U = A.data.unfinished, rows = U.rows || [];
    var f = A.unfF, shown = rows.filter(function (r) { return f === 'all' ? true : f === 'noskills' ? r.stage === 'noskills' : f === 'noprofile' ? r.stage === 'noprofile' && r.who !== 'e' : r.stage === 'noprofile' && r.who === 'e'; });
    function st(n, l, key) { return '<button type="button" class="adm-stat adm-stat-btn' + (f === key ? ' on' : '') + '" data-action="adm-unf-f" data-f="' + key + '"><strong>' + n + '</strong><span>' + l + '</span></button>'; }
    var stats = '<div class="adm-stats adm-stats-sm" id="adm-unf-stats">' + st((Number(U.noProfile) || 0) + (Number(U.noSkills) || 0), 'Unfinished professionals', 'all') + st(U.noSkills || 0, 'Saved, no SAP skills yet', 'noskills') + st(U.noProfile || 0, 'Signed up, no profile yet', 'noprofile') + st(U.noProfileCompany || 0, 'Companies, no profile yet', 'company') + '</div>';
    var remText = function (r) {
      if (!r.rem) return '<span class="muted">None yet</span>';
      var k = r.rem.kind === 'skills' ? 'SAP skills · ' : '', n = r.rem.step === 2 ? '2nd' : '1st';
      return h(r.rem.status === 'pending' ? k + n + ': waiting for your approval' : k + n + ': ' + (REM_STATUS[r.rem.status] || r.rem.status));
    };
    var table = shown.length ? '<div class="adm-scroll"><table class="adm-table" id="adm-unf-table"><thead><tr><th>Who</th><th>Where they stopped</th><th>Still missing</th><th>Came from</th><th>When</th><th>Reminder</th><th></th></tr></thead><tbody>' + shown.map(function (r) {
      var who = r.stage === 'noskills' ? '<strong>' + h(r.name || 'No name') + '</strong><br><span class="muted small">' + h(r.email) + (r.headline ? ' · ' + h(r.headline) : '') + '</span>' : '<strong>' + h(r.email) + '</strong>' + (r.who === 'e' ? '<br><span class="muted small">Company</span>' : r.who === 'c' ? '<br><span class="muted small">Professional</span>' : '');
      var stage = r.stage === 'noskills' ? 'Profile saved, no SAP skills' : 'No profile yet';
      var miss = r.stage === 'noskills' ? (r.missing || []).map(h).join(', ') : 'The whole profile';
      return '<tr><td>' + who + '</td><td>' + h(stage) + (r.confirmed ? '' : '<br><span class="pill muted-pill">E-mail not confirmed</span>') + '</td><td>' + miss + '</td><td>' + h(r.src || '') + '</td><td>' + whenT(r.ts) + '</td><td>' + remText(r) + '</td>' +
        '<td class="adm-err-acts">' + (r.id ? '<button type="button" class="btn btn-outline btn-sm" data-action="adm-message" data-id="' + h(r.id) + '" data-name="' + h(r.name || '') + '">Message as Arnour team</button> <a class="btn btn-ghost btn-sm" href="#/admin/people/' + h(r.id) + '">Open</a>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">Nobody here. ✓</div>';
    return '<h1>Unfinished</h1><p class="muted small">Professionals who stopped before the profile was useful for matching. “Saved, no SAP skills yet” means the profile exists (companies can see it as “Profile in progress”) but has no SAP product with a module. Reminder e-mails for these people wait for your approval in <a class="link" href="#/admin/reminders">Reminders</a>; a person with an unconfirmed e-mail cannot be reminded. The newest 300 are shown.</p>' + stats + table;
  }

  function vCommunity() {
    var key = 'community:' + (A.q.community || '');
    var w = need(key, 'admin_posts', { p_q: A.q.community || '', p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    return '<h1>Community</h1>' + searchBar('community', 'Search title or author email…') + (list.length ? list.map(function (p) {
      return '<article class="adm-card"><div class="adm-row"><span class="pill">' + h(KIND_LABEL[p.kind]) + '</span> <strong>' + h(p.title) + '</strong>' + (p.sample ? ' <span class="pill muted-pill">Sample</span>' : '') + (p.anonymous ? ' <span class="pill muted-pill">Anonymous</span>' : '') + '</div>' +
        '<p class="muted small">' + h(p.email || 'sample content') + ' · ' + whenT(p.createdTs) + ' · ' + p.count + (p.kind === 'question' ? ' answers' : ' comments') + '</p>' +
        '<div class="adm-actions"><a class="btn btn-outline btn-sm" href="#/community/' + (p.kind === 'question' ? 'q/' : 'a/') + h(p.id) + '">Open</a>' +
        '<button class="btn btn-danger btn-sm" data-action="adm-remove-post" data-kind="' + p.kind + '" data-id="' + h(p.id) + '">Remove</button></div></article>';
    }).join('') : '<div class="empty">Nothing found.</div>');
  }

  function vSettings() {
    var w = need('settings', 'admin_settings'); if (w) return w;
    var s = A.data.settings;
    return '<h1>Site settings</h1><article class="adm-card"><div class="adm-row"><strong>Sample content</strong> <span class="pill ' + (s.hideSamples ? 'muted-pill' : '') + '">' + (s.hideSamples ? 'Hidden' : 'Showing') + '</span></div>' +
      '<p class="muted small">Sample professionals, companies, roles and community posts are labelled “Sample”. Hide them all once you have enough real members.</p>' +
      '<div class="adm-actions"><button class="btn btn-outline btn-sm" data-action="adm-samples" data-on="' + (s.hideSamples ? '0' : '1') + '">' + (s.hideSamples ? 'Show sample content' : 'Hide sample content') + '</button></div></article>' +
      '<p class="muted small">The activity log of everything admins did is under <a class="link" href="#/admin/log">Settings → Activity log</a>.</p>';
  }
  function vLog() {
    var w = need('log', 'admin_log_list', { p_limit: 100 }); if (w) return w;
    var log = A.data.log;
    return '<h1>Activity log</h1><p class="muted">The last 100 things admins did on the site.</p>' + (log.length ? '<div class="adm-log">' + log.map(function (l) {
        return '<p><span class="muted small">' + h(new Date(l.ts).toLocaleString('en-GB')) + '</span> <strong>' + h(l.action) + '</strong> ' + h(l.target || '') + (l.detail ? ' <span class="muted">— ' + h(l.detail) + '</span>' : '') + '</p>';
      }).join('') + '</div>' : '<div class="empty">No actions yet.</div>');
  }

  /* ---------- catalog: products, modules, practice areas, specialties ---------- */
  var CORE_P = { s4onprem: 1, ecc: 1, s4public: 1 };
  var FAM_LABEL = { fin: 'Finance', log: 'Logistics & operations', tech: 'Technical' };
  var ROLE_LABEL = { functional: 'Functional', technical: 'Technical', basis: 'Basis', architect: 'Architect', delivery: 'Delivery Manager', support: 'Support', keyuser: 'Key User', junior: 'Junior' };
  A.cat = { sub: 'skills', openP: {}, openA: {}, ed: null, merge: null, busy: false };
  function pl(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function useTxt(u, withPosts) {
    if (!u) return '<span class="muted small">Not used</span>';
    var b = [];
    if (u.pros) b.push(pl(u.pros, 'professional'));
    if (u.roles) b.push(pl(u.roles, 'role'));
    if (withPosts && u.posts) b.push(pl(u.posts, 'post'));
    return b.length ? '<span class="small">Used by ' + b.join(' · ') + '</span>' : '<span class="muted small">Not used</span>';
  }
  function cb(a, label, d, cls) {
    var at = ''; Object.keys(d || {}).forEach(function (k) { at += ' data-' + k + '="' + h(d[k]) + '"'; });
    return '<button type="button" class="btn ' + (cls || 'btn-outline') + ' btn-sm" data-action="' + a + '"' + at + '>' + label + '</button>';
  }
  function arrows(kind, d) {
    return cb('adm-cat-move', '↑', Object.assign({ kind: kind, dir: '-1' }, d), 'btn-ghost') + cb('adm-cat-move', '↓', Object.assign({ kind: kind, dir: '1' }, d), 'btn-ghost');
  }
  function findProduct(C, id) { return (C.products || []).filter(function (p) { return p.id === id; })[0]; }
  function findModule(C, pid, mid) { var p = findProduct(C, pid); return p && (p.modules || []).filter(function (m) { return m.id === mid; })[0]; }
  function allSpecs(C) { var out = []; (C.areas || []).forEach(function (a) { (a.groups || []).forEach(function (g) { (g.items || []).forEach(function (it) { out.push(Object.assign({ area: a.id, areaName: a.name, grp: g.name }, it)); }); }); }); return out; }
  function catSave(op, args, ok) {
    if (A.cat.busy) return Promise.resolve();
    A.cat.busy = true;
    return B.rpc('admin_catalog_save', { p_op: op, p_args: args }).then(function (r) {
      A.cat.busy = false;
      if (r && r.catalog) { A.data.catalog = r.catalog; try { APP.applyCatalog(r.catalog); } catch (e) { /* ignore */ } }
      delete A.data.catusage; delete A.data.catlog; reload('log');
      A.cat.ed = null; A.cat.merge = null;
      if (ok) APP.toast(typeof ok === 'function' ? ok(r) : ok);
      APP.render();
    }, function (e) { A.cat.busy = false; APP.toast(String((e && e.message) || 'Could not save').replace(/^.*?(Please|That|The|Unknown|Choose|Merges|Nothing)/, '$1')); APP.render(); });
  }

  function edForm(C) {
    var ed = A.cat.ed; if (!ed) return '';
    var v = ed.vals, k = ed.kind, title, fields = '';
    var nm = '<label class="field"><span class="label">Name</span><input class="input" name="name" maxlength="120" value="' + h(v.name) + '" autocomplete="off"></label>';
    var sh = '<label class="field"><span class="label">Short label <span class="muted">(shown in chips)</span></span><input class="input" name="short" maxlength="60" value="' + h(v.short) + '" autocomplete="off"></label>';
    var hid = '<label class="check-row"><input type="checkbox" name="hidden"' + (v.hidden ? ' checked' : '') + '> <span>Hidden <span class="muted small">— not offered in new choices; anyone who already has it keeps it</span></span></label>';
    if (k === 'product') { title = ed.id ? 'Edit product' : 'New product'; fields = nm + sh + hid; }
    else if (k === 'module') {
      var pr = findProduct(C, ed.product_id);
      title = (ed.id ? 'Edit module' : 'New module') + ' · ' + h(pr ? pr.name : '');
      fields = nm + (CORE_P[ed.product_id] ? '<label class="field"><span class="label">Match family <span class="muted">(a different module in the same family still earns partial credit for ERP skills)</span></span><select class="input" name="family">' +
        [['', 'None'], ['fin', 'Finance'], ['log', 'Logistics & operations'], ['tech', 'Technical']].map(function (o) { return '<option value="' + o[0] + '"' + (v.family === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' : '') + hid;
    } else if (k === 'area') { title = ed.id ? 'Edit practice area' : 'New practice area'; fields = nm + hid; }
    else {
      title = ed.id ? 'Edit specialty' : 'New specialty';
      var groups = {}; (C.areas || []).forEach(function (a) { if (a.id === v.area_id) (a.groups || []).forEach(function (g) { if (g.name) groups[g.name] = 1; }); });
      fields = nm + sh +
        '<label class="field"><span class="label">Practice area</span><select class="input" name="area_id">' + (C.areas || []).map(function (a) { return '<option value="' + h(a.id) + '"' + (a.id === v.area_id ? ' selected' : '') + '>' + h(a.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="label">Group <span class="muted">(optional — pick one or type a new one)</span></span><input class="input" name="grp" list="cat-groups" maxlength="80" value="' + h(v.grp) + '" autocomplete="off"><datalist id="cat-groups">' + Object.keys(groups).map(function (g) { return '<option value="' + h(g) + '"></option>'; }).join('') + '</datalist></label>' +
        '<div class="field"><span class="label">Suggested first for these role types</span><div class="adm-row" style="gap:4px 18px">' + Object.keys(ROLE_LABEL).map(function (r) {
          return '<label class="check-row" style="margin:4px 0"><input type="checkbox" name="role" value="' + r + '"' + (v.roles.indexOf(r) !== -1 ? ' checked' : '') + '> <span>' + ROLE_LABEL[r] + '</span></label>'; }).join('') + '</div></div>' + hid;
    }
    return '<form class="adm-card" data-form="adm-cat-ed"><h2 style="margin-top:0">' + title + '</h2>' + fields +
      (ed.id ? '<p class="muted small">Id: <code>' + h(ed.id) + '</code> — ids never change, so existing profiles and roles keep working.</p>' : '<p class="muted small">The id is made from the name and then stays fixed.</p>') +
      '<div class="adm-actions"><button class="btn btn-primary btn-sm" type="submit"' + (A.cat.busy ? ' disabled' : '') + '>Save</button>' + cb('adm-cat-cancel', 'Cancel', {}, 'btn-ghost') + '</div></form>';
  }

  function mergeForm(C, U) {
    var m = A.cat.merge; if (!m) return '';
    if (m.kind === 'module') {
      var from = findModule(C, m.fp, m.fm), fp = findProduct(C, m.fp), use = (U.mods || {})[m.fp + ':' + m.fm];
      var tp = m.tp || m.fp, tprod = findProduct(C, tp);
      var opts = (tprod ? tprod.modules : []).filter(function (x) { return !x.hidden && !(tp === m.fp && x.id === m.fm); });
      return '<form class="adm-card sus" data-form="adm-cat-merge"><h2 style="margin-top:0">Merge “' + h(from ? from.name : m.fm) + '” into another module</h2>' +
        '<p>Everyone who has it — ' + (use ? pl(use.pros || 0, 'professional') + ', ' + pl(use.roles || 0, 'role') + (use.posts ? ', ' + pl(use.posts, 'post') : '') : 'nobody right now') + ' — will move to the module you pick. Where someone already has both, the higher project count is kept. The old one is hidden. <strong>This cannot be undone.</strong></p>' +
        '<div class="adm-row"><label class="field" style="flex:1"><span class="label">Product</span><select class="input" name="tp" data-cat-tp>' + (C.products || []).filter(function (p) { return !p.hidden; }).map(function (p) { return '<option value="' + h(p.id) + '"' + (p.id === tp ? ' selected' : '') + '>' + h(p.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field" style="flex:1"><span class="label">Module</span><select class="input" name="tm"><option value="">Choose…</option>' + opts.map(function (x) { return '<option value="' + h(x.id) + '"' + (m.tm === x.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select></label></div>' +
        '<label class="field"><span class="label">Type MERGE to confirm</span><input class="input" name="confirm" placeholder="MERGE" autocomplete="off"></label>' +
        '<div class="adm-actions"><button class="btn btn-danger btn-sm" type="submit"' + (A.cat.busy ? ' disabled' : '') + '>Merge</button>' + cb('adm-cat-cancel', 'Cancel', {}, 'btn-ghost') + '</div></form>';
    }
    var f0 = allSpecs(C).filter(function (x) { return x.id === m.from; })[0], use2 = (U.specs || {})[m.from];
    return '<form class="adm-card sus" data-form="adm-cat-merge"><h2 style="margin-top:0">Merge “' + h(f0 ? f0.name : m.from) + '” into another specialty</h2>' +
      '<p>Everyone who has it — ' + (use2 ? pl(use2.pros || 0, 'professional') + ', ' + pl(use2.roles || 0, 'role') : 'nobody right now') + ' — will move to the specialty you pick. The old one is hidden. <strong>This cannot be undone.</strong></p>' +
      '<label class="field"><span class="label">Merge into</span><select class="input" name="to"><option value="">Choose…</option>' + allSpecs(C).filter(function (x) { return !x.hidden && x.id !== m.from; }).map(function (x) { return '<option value="' + h(x.id) + '"' + (m.to === x.id ? ' selected' : '') + '>' + h(x.areaName + ' · ' + x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span class="label">Type MERGE to confirm</span><input class="input" name="confirm" placeholder="MERGE" autocomplete="off"></label>' +
      '<div class="adm-actions"><button class="btn btn-danger btn-sm" type="submit"' + (A.cat.busy ? ' disabled' : '') + '>Merge</button>' + cb('adm-cat-cancel', 'Cancel', {}, 'btn-ghost') + '</div></form>';
  }

  function vCatalogSkills(C, U) {
    var q = (A.q.catalog || '').toLowerCase();
    return '<div class="adm-actions" style="margin-top:0">' + cb('adm-cat-add', 'Add product', { kind: 'product' }, 'btn-primary') + '</div>' + searchBar('catalog', 'Find a product or module…') +
      (C.products || []).map(function (p, pi) {
        var mods = (p.modules || []).filter(function (m) { return !q || (m.name + ' ' + m.id).toLowerCase().indexOf(q) !== -1 || (p.name.toLowerCase().indexOf(q) !== -1); });
        if (q && !mods.length && p.name.toLowerCase().indexOf(q) === -1) return '';
        var open = A.cat.openP[p.id] || !!q;
        var vis = (p.modules || []).filter(function (m) { return !m.hidden; }).length;
        return '<article class="adm-card' + (p.hidden ? ' cat-dim' : '') + '"><div class="adm-row"><strong>' + h(p.name) + '</strong> <code class="muted small">' + h(p.id) + '</code>' +
          (p.hidden ? ' <span class="pill muted-pill">Hidden</span>' : '') + ' <span class="muted small">' + vis + ' module' + (vis === 1 ? '' : 's') + (vis !== (p.modules || []).length ? ' (+' + ((p.modules || []).length - vis) + ' hidden)' : '') + '</span> ' + useTxt((U.prods || {})[p.id]) + '</div>' +
          '<div class="adm-actions">' + cb('adm-cat-toggle', open ? 'Hide modules' : 'Show modules', { id: p.id }) + cb('adm-cat-edit', 'Edit', { kind: 'product', id: p.id }) +
          cb('adm-cat-edit', p.hidden ? 'Unhide' : 'Hide', { kind: 'product', id: p.id, quick: p.hidden ? 'unhide' : 'hide' }) + cb('adm-cat-add', 'Add module', { kind: 'module', product: p.id }) + arrows('product', { id: p.id }) + '</div>' +
          (open ? '<table class="adm-table" style="margin-top:10px"><thead><tr><th>Module</th><th>Usage</th><th></th></tr></thead><tbody>' + (mods.length ? mods.map(function (m) {
            var mu = (U.mods || {})[p.id + ':' + m.id];
            var merged = (C.merged || []).filter(function (x) { return x[0] === p.id && x[1] === m.id; })[0];
            return '<tr class="' + (m.hidden ? 'cat-dim' : '') + '"><td>' + h(m.name) + ' <code class="muted small">' + h(m.id) + '</code>' + (m.hidden ? ' <span class="pill muted-pill">' + (merged ? 'Merged into ' + h(merged[2] + ':' + merged[3]) : 'Hidden') + '</span>' : '') +
              (CORE_P[p.id] && m.family ? ' <span class="pill">' + h(FAM_LABEL[m.family]) + '</span>' : '') + '</td><td>' + useTxt(mu, true) + '</td><td><div class="adm-actions" style="margin:0">' +
              cb('adm-cat-edit', 'Edit', { kind: 'module', product: p.id, id: m.id }) + cb('adm-cat-edit', m.hidden ? 'Unhide' : 'Hide', { kind: 'module', product: p.id, id: m.id, quick: m.hidden ? 'unhide' : 'hide' }) +
              (merged ? '' : cb('adm-cat-merge', 'Merge…', { kind: 'module', product: p.id, id: m.id })) + (q ? '' : arrows('module', { product: p.id, id: m.id })) + '</div></td></tr>';
          }).join('') : '<tr><td colspan="3" class="muted">No modules yet.</td></tr>') + '</tbody></table>' : '') + '</article>';
      }).join('');
  }

  function vCatalogSpecs(C, U) {
    return '<div class="adm-actions" style="margin-top:0">' + cb('adm-cat-add', 'Add practice area', { kind: 'area' }, 'btn-primary') + cb('adm-cat-add', 'Add specialty', { kind: 'spec' }) + '</div>' +
      '<p class="muted small">“Suggested first for” decides which specialties a role type sees on top of its list. Everything else stays under “Add other specialties”.</p>' +
      (C.areas || []).map(function (a) {
        var open = A.cat.openA[a.id] !== false;
        return '<article class="adm-card' + (a.hidden ? ' cat-dim' : '') + '"><div class="adm-row"><strong>' + h(a.name) + '</strong> <code class="muted small">' + h(a.id) + '</code>' + (a.hidden ? ' <span class="pill muted-pill">Hidden</span>' : '') + '</div>' +
          '<div class="adm-actions">' + cb('adm-cat-atoggle', open ? 'Collapse' : 'Expand', { id: a.id }) + cb('adm-cat-edit', 'Edit', { kind: 'area', id: a.id }) + cb('adm-cat-edit', a.hidden ? 'Unhide' : 'Hide', { kind: 'area', id: a.id, quick: a.hidden ? 'unhide' : 'hide' }) +
          cb('adm-cat-add', 'Add specialty', { kind: 'spec', area: a.id }) + arrows('area', { id: a.id }) + '</div>' +
          (open ? (a.groups || []).map(function (g) {
            return '<div style="margin-top:12px"><div class="adm-row"><strong class="small">' + h(g.name || 'No group') + '</strong>' + (g.name ? arrows('group', { area: a.id, id: g.name }) : '') + '</div>' +
              '<table class="adm-table"><tbody>' + g.items.map(function (it) {
                var roles = Object.keys(C.roles || {}).filter(function (r) { return (C.roles[r] || []).indexOf(it.id) !== -1; });
                var mg = (C.mergedSpecs || []).filter(function (x) { return x[0] === it.id; })[0];
                return '<tr class="' + (it.hidden ? 'cat-dim' : '') + '"><td>' + h(it.name) + ' <code class="muted small">' + h(it.id) + '</code>' + (it.hidden ? ' <span class="pill muted-pill">' + (mg ? 'Merged into ' + h(mg[1]) : 'Hidden') + '</span>' : '') +
                  '<div class="muted small">' + (roles.length ? 'Suggested first for ' + roles.map(function (r) { return h(ROLE_LABEL[r] || r); }).join(', ') : 'Not suggested first for any role type') + '</div></td><td>' + useTxt((U.specs || {})[it.id]) + '</td><td><div class="adm-actions" style="margin:0">' +
                  cb('adm-cat-edit', 'Edit', { kind: 'spec', id: it.id }) + cb('adm-cat-edit', it.hidden ? 'Unhide' : 'Hide', { kind: 'spec', id: it.id, quick: it.hidden ? 'unhide' : 'hide' }) +
                  (mg ? '' : cb('adm-cat-merge', 'Merge…', { kind: 'spec', id: it.id })) + arrows('spec', { area: a.id, group: g.name, id: it.id }) + '</div></td></tr>';
              }).join('') + '</tbody></table></div>';
          }).join('') : '') + '</article>';
      }).join('');
  }

  function vCatalogHistory(L) {
    return L.length ? '<div class="adm-log">' + L.map(function (l) {
      return '<p><span class="muted small">' + h(new Date(l.ts).toLocaleString('en-GB')) + '</span> <strong>' + h(l.summary) + '</strong> <span class="muted small">by ' + h(l.admin) + '</span>' +
        (l.undone ? ' <span class="pill muted-pill">Undone</span>' : '') + (l.canUndo ? ' ' + cb('adm-cat-undo', 'Undo', {}) : '') + '</p>';
    }).join('') + '</div>' : '<div class="empty">No catalog changes yet.</div>';
  }


  /* ---------- lists: regions, countries, cities, nationalities, languages ---------- */
  var LST_LABEL = { region: 'region', country: 'country', city: 'city', nationality: 'nationality', language: 'language' };
  A.lst = { sub: 'countries', open: {}, ed: null, merge: null, busy: false };
  function lstSave(op, args, ok) {
    if (A.lst.busy) return Promise.resolve();
    A.lst.busy = true;
    return B.rpc('admin_lists_save', { p_op: op, p_args: args }).then(function (r) {
      A.lst.busy = false;
      if (r && r.lists) { A.data.lists = r.lists; try { APP.applyLists(r.lists); } catch (e) { /* ignore */ } }
      delete A.data.lstusage; delete A.data.lstlog; reload('log');
      A.lst.ed = null; A.lst.merge = null;
      if (ok) APP.toast(typeof ok === 'function' ? ok(r) : ok);
      APP.render();
    }, function (e) { A.lst.busy = false; APP.toast(String((e && e.message) || 'Could not save').replace(/^.*?(Please|That|The|Unknown|Choose|Merges|Nothing|Cities|Regions|This)/, '$1')); APP.render(); });
  }
  function lcb(a, label, d, cls) { return cb(a, label, d, cls); }
  function lItems(L, kind, parent) {
    if (kind === 'region') return L.regions || [];
    if (kind === 'country') return L.countries || [];
    if (kind === 'nationality') return L.nationalities || [];
    if (kind === 'language') return L.languages || [];
    var c = (L.countries || []).filter(function (x) { return x.id === parent; })[0]; return c ? c.cities : [];
  }
  function lFind(L, kind, id, parent) { return lItems(L, kind, parent).filter(function (x) { return x.id === id; })[0]; }
  function lUse(U, kind, it, parent) {
    if (kind === 'country') return U.country && U.country[it.id];
    if (kind === 'city') return U.city && U.city[parent + '|' + it.name];
    if (kind === 'nationality') return U.nationality && U.nationality[it.name];
    if (kind === 'language') return U.language && U.language[it.name];
    return null;
  }
  function lRow(L, U, kind, it, parent, extra) {
    var u = lUse(U, kind, it, parent), merged = it.hidden && (L.mergedCountries || []).some(function (m) { return m[0] === it.id; });
    return '<div class="adm-row" style="padding:6px 0;border-top:1px solid var(--border,#e5e7eb)"><div style="flex:1;min-width:200px"><strong>' + h(it.name) + '</strong>' + (it.hidden ? ' <span class="pill muted-pill">' + (merged ? 'Merged' : 'Hidden') + '</span>' : '') + (extra || '') + ' ' + useTxt(u, false) + '</div>' +
      '<div class="adm-actions" style="margin:0">' + cb('adm-lst-edit', 'Edit', { kind: kind, id: it.id, parent: parent || '' }) + cb('adm-lst-edit', it.hidden ? 'Unhide' : 'Hide', { kind: kind, id: it.id, parent: parent || '', quick: it.hidden ? 'unhide' : 'hide' }) +
      (kind === 'region' || it.hidden ? '' : cb('adm-lst-merge', 'Merge…', { kind: kind, id: it.id, parent: parent || '' })) + cb('adm-lst-move', '↑', { kind: kind, id: it.id, parent: parent || '', dir: '-1' }, 'btn-ghost') + cb('adm-lst-move', '↓', { kind: kind, id: it.id, parent: parent || '', dir: '1' }, 'btn-ghost') + '</div></div>';
  }
  function lstForm(L) {
    var ed = A.lst.ed; if (!ed) return '';
    var v = ed.vals, k = ed.kind, lbl = LST_LABEL[k];
    var par = '';
    if (k === 'country') par = '<label class="field"><span class="label">Region</span><select class="input" name="parent">' + (L.regions || []).filter(function (r) { return !r.hidden || r.id === v.parent; }).map(function (r) { return '<option value="' + h(r.id) + '"' + (r.id === v.parent ? ' selected' : '') + '>' + h(r.name) + '</option>'; }).join('') + '</select></label>';
    var cn = k === 'city' ? (lFind(L, 'country', ed.parent) || {}).name : '';
    var note = ed.id && (k === 'city' || k === 'nationality' || k === 'language') ? '<p class="muted small">Renaming updates every profile and role that uses it.</p>' : '';
    return '<form class="adm-card" data-form="adm-lst-ed"><h2 style="margin-top:0">' + (ed.id ? 'Edit ' : 'New ') + lbl + (cn ? ' · ' + h(cn) : '') + '</h2>' +
      '<label class="field"><span class="label">Name' + (k === 'nationality' ? ' <span class="muted">(e.g. Egyptian)</span>' : '') + '</span><input class="input" name="name" maxlength="80" value="' + h(v.name) + '" autocomplete="off"></label>' + par + note +
      '<label class="check-row"><input type="checkbox" name="hidden"' + (v.hidden ? ' checked' : '') + '> <span>Hidden <span class="muted small">— not offered in new choices; anyone who already has it keeps it</span></span></label>' +
      '<div class="adm-actions"><button class="btn btn-primary btn-sm" type="submit"' + (A.lst.busy ? ' disabled' : '') + '>Save</button>' + cb('adm-lst-cancel', 'Cancel', {}, 'btn-ghost') + '</div></form>';
  }
  function lstMergeForm(L, U) {
    var m = A.lst.merge; if (!m) return '';
    var from = lFind(L, m.kind, m.id, m.parent), use = from && lUse(U, m.kind, from, m.parent);
    var opts = lItems(L, m.kind, m.parent).filter(function (x) { return !x.hidden && x.id !== m.id; });
    return '<form class="adm-card sus" data-form="adm-lst-merge"><h2 style="margin-top:0">Merge “' + h(from ? from.name : m.id) + '” into another ' + LST_LABEL[m.kind] + '</h2>' +
      '<p>Everyone who has it — ' + (use ? pl(use.pros || 0, 'professional') + (m.kind === 'nationality' ? '' : ', ' + pl(use.roles || 0, 'role')) : 'nobody right now') + ' — will move to the one you pick' + (m.kind === 'country' ? ', and its cities move with it' : '') + '. The old one is hidden. <strong>This cannot be undone.</strong></p>' +
      '<label class="field"><span class="label">Merge into</span><select class="input" name="to"><option value="">Choose…</option>' + opts.map(function (x) { return '<option value="' + h(x.id) + '"' + (m.to === x.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span class="label">Type MERGE to confirm</span><input class="input" name="confirm" placeholder="MERGE" autocomplete="off"></label>' +
      '<div class="adm-actions"><button class="btn btn-danger btn-sm" type="submit"' + (A.lst.busy ? ' disabled' : '') + '>Merge</button>' + cb('adm-lst-cancel', 'Cancel', {}, 'btn-ghost') + '</div></form>';
  }
  function vListsCountries(L, U) {
    return '<div class="adm-actions" style="margin-top:0">' + cb('adm-lst-add', 'Add country', { kind: 'country' }, 'btn-primary') + '</div>' +
      (L.countries || []).map(function (c) {
        var open = !!A.lst.open[c.id], vis = c.cities.filter(function (x) { return !x.hidden; }).length;
        var rg = (L.regions || []).filter(function (r) { return r.id === c.region; })[0];
        return '<div class="adm-card"><div class="adm-row"><strong>' + h(c.name) + '</strong> <code>' + h(c.id) + '</code> <span class="muted small">' + h(rg ? rg.name : c.region) + ' · ' + pl(vis, 'city').replace('citys', 'cities') + '</span>' +
          (c.hidden ? ' <span class="pill muted-pill">' + ((L.mergedCountries || []).some(function (m) { return m[0] === c.id; }) ? 'Merged' : 'Hidden') + '</span>' : '') + ' ' + useTxt(lUse(U, 'country', c), false) + '</div>' +
          '<div class="adm-actions">' + cb('adm-lst-toggle', open ? 'Hide cities' : 'Show cities', { id: c.id }) + cb('adm-lst-edit', 'Edit', { kind: 'country', id: c.id }) + cb('adm-lst-edit', c.hidden ? 'Unhide' : 'Hide', { kind: 'country', id: c.id, quick: c.hidden ? 'unhide' : 'hide' }) +
          (c.hidden ? '' : cb('adm-lst-merge', 'Merge…', { kind: 'country', id: c.id })) + cb('adm-lst-add', 'Add city', { kind: 'city', parent: c.id }) + cb('adm-lst-move', '↑', { kind: 'country', id: c.id, dir: '-1' }, 'btn-ghost') + cb('adm-lst-move', '↓', { kind: 'country', id: c.id, dir: '1' }, 'btn-ghost') + '</div>' +
          (open ? (c.cities.length ? c.cities.map(function (t) { return lRow(L, U, 'city', t, c.id); }).join('') : '<p class="muted small">No cities yet.</p>') : '') + '</div>';
      }).join('');
  }
  function vListsSimple(L, U, kind) {
    var items = lItems(L, kind), what = { region: 'Region', nationality: 'Nationality', language: 'Language' }[kind];
    return '<div class="adm-actions" style="margin-top:0">' + cb('adm-lst-add', 'Add ' + what.toLowerCase(), { kind: kind }, 'btn-primary') + '</div>' +
      (kind === 'region' ? '<p class="muted small">Regions group countries for the region filters. A region can be hidden once it has no visible countries. Move countries between regions with Edit on the country.</p>' : '') +
      '<div class="adm-card">' + (items.length ? items.map(function (it) {
        var extra = kind === 'region' ? ' <span class="muted small">' + pl((L.countries || []).filter(function (c) { return c.region === it.id && !c.hidden; }).length, 'country').replace('countrys', 'countries') + '</span>' : '';
        return lRow(L, U, kind, it, '', extra); }).join('') : '<p class="muted">Nothing yet.</p>') + '</div>';
  }
  function lstExport(L) {
    var vis = function (a) { return (a || []).filter(function (x) { return !x.hidden; }); };
    return '## Countries (id = name; cities)\n' + vis(L.countries).map(function (c) { return c.id + ' ' + c.name + ' (' + (vis(c.cities).map(function (t) { return t.name; }).join(', ') || '—') + ')'; }).join('; ') +
      '\n\n## Languages\n' + vis(L.languages).map(function (x) { return x.name; }).join(', ') +
      '\n\n## Nationalities\n' + vis(L.nationalities).map(function (x) { return x.name; }).join(', ');
  }
  function vListsExport(L) {
    return '<div class="adm-card"><h2 style="margin-top:0">Export for the job-import skill</h2><p class="muted">The current countries, cities, languages and nationalities as plain text. Paste it into the “Countries” part of the job-import skill whenever you change the lists, so imported roles use the right ids.</p>' +
      '<textarea class="input" readonly rows="14" style="width:100%;font-family:monospace;font-size:12px" id="adm-lst-export">' + h(lstExport(L)) + '</textarea>' +
      '<div class="adm-actions">' + cb('adm-lst-copy', 'Copy to clipboard', {}, 'btn-primary') + '</div></div>';
  }
  function vListsHistory(Lg) {
    if (!Lg.length) return '<div class="empty">No changes yet.</div>';
    return '<div class="adm-card">' + Lg.map(function (l) {
      return '<p><span class="muted small">' + h(new Date(l.ts).toLocaleString('en-GB')) + '</span> <strong>' + h(l.admin) + '</strong> — ' + h(l.summary) +
        (l.undone ? ' <span class="pill muted-pill">Undone</span>' : '') + (l.canUndo ? ' ' + cb('adm-lst-undo', 'Undo', {}) : '') + '</p>';
    }).join('') + '</div>';
  }
  function vLists() {
    var w = need('lists', 'get_lists') || need('lstusage', 'admin_lists_usage') || need('lstlog', 'admin_lists_log', { p_limit: 60 }); if (w) return w;
    var L = A.data.lists, U = A.data.lstusage, Lg = A.data.lstlog, sub = A.lst.sub;
    var undo = Lg.length && Lg[0].canUndo ? cb('adm-lst-undo', 'Undo: ' + h(Lg[0].summary), {}) : '';
    var vis = function (a) { return (a || []).filter(function (x) { return !x.hidden; }).length; };
    var tabs = [['countries', 'Countries & cities (' + vis(L.countries) + ')'], ['regions', 'Regions (' + vis(L.regions) + ')'], ['nationalities', 'Nationalities (' + vis(L.nationalities) + ')'], ['languages', 'Languages (' + vis(L.languages) + ')'], ['history', 'History'], ['export', 'Export for skill']];
    return '<h1>Lists</h1><p class="muted">The countries, cities, regions, nationalities and languages people choose from. Changes are live for everyone on their next page load. Nothing is ever deleted: <strong>hide</strong> an item and it leaves the pickers while people who already have it keep it, or <strong>merge</strong> it into another to move everyone across.</p>' +
      '<div class="chip-wrap" style="margin-bottom:14px">' + tabs.map(function (t) {
        return '<button type="button" class="chip' + (sub === t[0] ? ' chip-on' : '') + '" data-action="adm-lst-sub" data-s="' + t[0] + '">' + t[1] + '</button>'; }).join('') + (undo ? ' ' + undo : '') + '</div>' +
      lstForm(L) + lstMergeForm(L, U) +
      (sub === 'regions' ? vListsSimple(L, U, 'region') : sub === 'nationalities' ? vListsSimple(L, U, 'nationality') : sub === 'languages' ? vListsSimple(L, U, 'language') : sub === 'history' ? vListsHistory(Lg) : sub === 'export' ? vListsExport(L) : vListsCountries(L, U));
  }

  /* ---------- announcements: banner, bell notification, email ---------- */
  var ANN0 = { title: '', body: '', link: '', link_label: '', ch_banner: true, ch_bell: true, ch_email: false, banner_days: 7, who: 'all', country: '', role_type: '' };
  A.ann = { f: Object.assign({}, ANN0), step: 'edit', counts: null, busy: false, confirmW: 0 };
  function annAudience(a) {
    var who = a.who === 'pros' ? 'Professionals' : a.who === 'companies' ? 'Companies' : 'Everyone';
    var c = a.country ? (APP.countriesById[a.country] || {}).name || a.country : '';
    var r = a.role_type ? (APP.roleTypeById[a.role_type] || {}).name || a.role_type : '';
    return who + (c ? ' in ' + c : '') + (r ? ' · ' + r : '');
  }
  function annPreview(f) {
    var link = f.link ? ' <span style="text-decoration:underline;font-weight:600;white-space:nowrap">' + h(f.link_label || 'Learn more') + ' →</span>' : '';
    var out = '<div class="adm-card"><h2 style="margin-top:0">Preview</h2>';
    if (f.ch_banner) out += '<p class="muted small" style="margin-bottom:4px">Banner</p><div class="ann-banner" style="border-radius:8px"><div class="ann-text"><strong>' + h(f.title || 'Your title') + '</strong>' + (f.body ? ' <span>' + h(f.body) + '</span>' : '') + link + '</div></div>';
    if (f.ch_bell) out += '<p class="muted small" style="margin:12px 0 4px">Bell notification</p><div class="card" style="padding:10px 12px;margin:0">' + h((f.title || 'Your title') + (f.body ? ': ' + f.body : '')) + '</div>';
    if (f.ch_email) out += '<p class="muted small" style="margin:12px 0 4px">Email — subject: <strong>' + h(f.title || 'Your title') + '</strong></p><div class="card" style="padding:10px 12px;margin:0"><strong>' + h(f.title || 'Your title') + '</strong><br>' + h(f.body || '') + '</div>';
    return out + '</div>';
  }
  function annForm() {
    var f = A.ann.f, busy = A.ann.busy;
    var chk = function (n, label, hint) { return '<label class="check-row"><input type="checkbox" name="' + n + '"' + (f[n] ? ' checked' : '') + '> <span><strong>' + label + '</strong> <span class="muted small">— ' + hint + '</span></span></label>'; };
    var opts = function (pairs, v) { return pairs.map(function (o) { return '<option value="' + h(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join(''); };
    return '<form class="adm-card" data-form="adm-ann"><h2 style="margin-top:0">New announcement</h2>' +
      '<label class="field"><span class="label">Title <span class="muted">(80 characters at most)</span></span><input class="input" name="title" maxlength="80" value="' + h(f.title) + '" autocomplete="off" placeholder="e.g. New: AI skills on your profile"></label>' +
      '<label class="field"><span class="label">Message <span class="muted">(optional, 400 characters at most)</span></span><textarea class="input" name="body" rows="3" maxlength="400" placeholder="One or two sentences on what is new and why it matters.">' + h(f.body) + '</textarea></label>' +
      '<div class="form-grid"><label class="field"><span class="label">Link <span class="muted">(optional — a page on Arnour)</span></span><input class="input" name="link" value="' + h(f.link) + '" autocomplete="off" placeholder="#/c/profile"></label>' +
      '<label class="field"><span class="label">Link text</span><input class="input" name="link_label" maxlength="30" value="' + h(f.link_label) + '" autocomplete="off" placeholder="Learn more"></label></div>' +
      '<div class="field"><span class="label">How should it reach people?</span>' +
        chk('ch_banner', 'Banner', 'a bar at the top of the site that each person can close') +
        (f.ch_banner ? '<label class="field" style="margin:4px 0 8px 28px;max-width:220px"><span class="label">Keep the banner up for</span><select class="input" name="banner_days">' + opts([[1, '1 day'], [3, '3 days'], [7, '7 days'], [14, '14 days'], [30, '30 days'], [90, '90 days']].map(function (x) { return [String(x[0]), x[1]]; }), String(f.banner_days)) + '</select></label>' : '') +
        chk('ch_bell', 'Bell notification', 'appears in the notification list') +
        chk('ch_email', 'Email', 'sent to everyone in the audience who has not switched announcement emails off') + '</div>' +
      '<div class="form-grid"><label class="field"><span class="label">Who</span><select class="input" name="who">' + opts([['all', 'Everyone'], ['pros', 'Professionals'], ['companies', 'Companies']], f.who) + '</select></label>' +
      '<label class="field"><span class="label">Country <span class="muted">(optional)</span></span><select class="input" name="country"><option value="">Any country</option>' + APP.countries.map(function (c) { return '<option value="' + h(c.id) + '"' + (c.id === f.country ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span class="label">Role type <span class="muted">(professionals only)</span></span><select class="input" name="role_type"' + (f.who === 'pros' ? '' : ' disabled') + '><option value="">Any role type</option>' + APP.roleTypes.map(function (r) { return '<option value="' + h(r.id) + '"' + (r.id === f.role_type ? ' selected' : '') + '>' + h(r.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="adm-actions"><button class="btn btn-primary btn-sm" type="submit"' + (busy ? ' disabled' : '') + '>Review &amp; send</button>' + cb('adm-ann-test', 'Send me a test', {}, 'btn-outline') + cb('adm-ann-reset', 'Clear', {}, 'btn-ghost') + '</div>' +
      '<p class="muted small">“Send me a test” delivers it only to you (bell and email), so you can see exactly what people will get. Nothing is sent to anyone else until you confirm on the next screen.</p></form>';
  }
  function annReview() {
    var f = A.ann.f, c = A.ann.counts || { total: 0, pros: 0, companies: 0, emails: 0 };
    var lines = [];
    if (f.ch_banner) lines.push('Banner for ' + f.banner_days + ' day' + (Number(f.banner_days) === 1 ? '' : 's'));
    if (f.ch_bell) lines.push('Bell notification to ' + pl(c.total, 'person').replace('persons', 'people'));
    if (f.ch_email) lines.push('Email to ' + pl(c.emails, 'person').replace('persons', 'people') + (c.total - c.emails > 0 ? ' (' + (c.total - c.emails) + ' switched announcement emails off)' : ''));
    return '<div class="adm-card sus"><h2 style="margin-top:0">Ready to send?</h2><p><strong>' + h(f.title) + '</strong>' + (f.body ? '<br>' + h(f.body) : '') + '</p>' +
      '<p>Audience: <strong>' + h(annAudience(f)) + '</strong> — ' + pl(c.total, 'person').replace('persons', 'people') + ' (' + pl(c.pros, 'professional') + ', ' + pl(c.companies, 'company').replace('companys', 'companies') + ').</p>' +
      '<ul>' + lines.map(function (l) { return '<li>' + h(l) + '</li>'; }).join('') + '</ul>' +
      (c.total === 0 ? '<p class="muted">Nobody matches this audience yet, so nothing would be delivered.</p>' : '<p class="muted small">Once sent it cannot be taken back, except that you can end the banner and stop emails that have not gone out yet.</p>') +
      '<div class="adm-actions"><button type="button" class="btn btn-danger btn-sm" data-action="adm-ann-send"' + (A.ann.busy || c.total === 0 ? ' disabled' : '') + '>Send now</button>' + cb('adm-ann-back', 'Back to edit', {}, 'btn-ghost') + '</div></div>' + annPreview(f);
  }
  function annHistory(L) {
    if (!L.length) return '<div class="empty">Nothing sent yet.</div>';
    return L.map(function (a) {
      var ch = [a.ch_banner ? 'Banner' : '', a.ch_bell ? 'Bell ' + a.bell : '', a.ch_email ? 'Email ' + a.email : ''].filter(Boolean).join(' · ');
      var act = (a.banner_live || a.email_waiting > 0) && !a.withdrawn
        ? (A.ann.confirmW === a.id ? cb('adm-ann-withdraw', 'Confirm: end banner and stop waiting emails', { id: a.id, yes: '1' }, 'btn-danger') + cb('adm-ann-withdraw', 'Cancel', { id: a.id }, 'btn-ghost') : cb('adm-ann-withdraw', 'Withdraw', { id: a.id }))
        : '';
      return '<div class="adm-card"><div class="adm-row"><strong>' + h(a.title) + '</strong>' + (a.banner_live ? ' <span class="pill">Banner live</span>' : '') + (a.withdrawn ? ' <span class="pill muted-pill">Withdrawn</span>' : '') + '</div>' +
        (a.body ? '<p style="margin:4px 0">' + h(a.body) + '</p>' : '') +
        '<p class="muted small">' + h(new Date(a.ts).toLocaleString('en-GB')) + ' · ' + h(annAudience(a)) + ' · ' + pl(a.audience, 'person').replace('persons', 'people') + ' · ' + h(ch) + (a.email_waiting ? ' · ' + a.email_waiting + ' email(s) still waiting' : '') + '</p>' +
        (act ? '<div class="adm-actions">' + act + '</div>' : '') + '</div>';
    }).join('');
  }
  function vAnnounce() {
    var w = need('annlist', 'admin_announce_list'); if (w) return w;
    return '<h1>Announcements</h1><p class="muted">Tell people about something new. Choose a banner on screen, a bell notification, an email, or any mix, and narrow it to the people who should see it.</p>' +
      (A.ann.step === 'review' ? annReview() : annForm() + annPreview(A.ann.f)) +
      '<h2 style="margin-top:28px">Sent so far</h2>' + annHistory(A.data.annlist);
  }
  function annArgs() {
    var f = A.ann.f;
    return { title: f.title, body: f.body, link: f.link, link_label: f.link_label, ch_banner: !!f.ch_banner, ch_bell: !!f.ch_bell, ch_email: !!f.ch_email, banner_days: Number(f.banner_days) || 7, who: f.who, country: f.country, role_type: f.who === 'pros' ? f.role_type : '' };
  }
  function annErr(e) { A.ann.busy = false; APP.toast(String((e && e.message) || 'Could not do that').replace(/^.*?(Please|The|A role|Choose|Unknown)/, '$1')); APP.render(); }

  /* ---------- messages: the Arnour team writes to people and reads their replies ---------- */
  function vMessages() {
    var M = A.msg;
    if (M.id) return vMsgThread();
    var w = need('staffbox', 'admin_staff_inbox'); if (w) return w;
    var L = A.data.staffbox;
    return '<h1>Messages</h1><p class="muted">Everything you send here goes out as <strong>Arnour team</strong>: the person never sees your name or e-mail, and can reply. To start a new conversation, open a person or company (People, or any profile) and press Message.</p>' +
      '<div class="adm-actions" style="margin-top:0"><a class="btn btn-outline btn-sm" href="#/admin/people">Find a person →</a></div>' +
      (L.length ? L.map(function (c) {
        return '<div class="adm-card adm-msg-row' + (c.unread ? ' unread' : '') + '"><div class="adm-row"><strong>' + h(c.name) + '</strong> <span class="pill muted-pill">' + (c.kind === 'company' ? 'Company' : 'Professional') + '</span>' +
          (c.unread ? ' <span class="pill warn-pill">' + c.unread + ' new</span>' : '') + '<span class="grow"></span><span class="muted small">' + h(whenT(+c.lastTs)) + '</span></div>' +
          '<p class="muted" style="margin:4px 0">' + (c.fromThem ? '' : 'You: ') + h(c.last || '') + '</p>' +
          '<div class="adm-actions">' + cb('adm-msg-open', c.unread ? 'Read and reply' : 'Open', { id: c.id }, c.unread ? 'btn-primary' : 'btn-outline') + '</div></div>';
      }).join('') : '<div class="empty">No messages yet. Open a person or company and press Message to write the first one.</div>');
  }
  function vMsgThread() {
    var M = A.msg, T = M.thread;
    if (!T) return '<div class="empty">Loading…</div>';
    return '<div class="crumb"><button type="button" class="link-btn" data-action="adm-msg-back">← All messages</button></div>' +
      '<h1>' + h(T.name) + ' <span class="pill muted-pill">' + (T.kind === 'company' ? 'Company' : 'Professional') + '</span></h1>' +
      '<p class="muted small">You write as <strong>Arnour team</strong>. ' + h(T.name) + ' sees your messages under Messages on Arnour.</p>' +
      '<div class="adm-card adm-thread" id="adm-thread">' + (T.messages.length ? T.messages.map(function (m) {
        return '<div class="adm-bub ' + (m.mine ? 'me' : 'them') + '"><div class="adm-bub-t">' + (m.deleted ? '<em class="muted">Message deleted</em>' : h(m.text)) + '</div><small class="muted">' + (m.mine ? 'Arnour team' : h(T.name)) + ' · ' + h(new Date(+m.ts).toLocaleString('en-GB')) + '</small></div>';
      }).join('') : '<p class="muted">No messages yet.</p>') + '</div>' +
      '<form class="adm-card" data-form="adm-msg-send"><label class="field"><span class="label">Reply as Arnour team</span><textarea class="input" name="t" rows="3" maxlength="2000" placeholder="Write your message…"></textarea></label>' +
      '<div class="adm-actions"><button class="btn btn-primary btn-sm" type="submit"' + (M.busy ? ' disabled' : '') + '>Send</button></div></form>';
  }
  function msgName(target) {
    var c = APP.db.consultants && APP.db.consultants[target], co = APP.db.companies && APP.db.companies[target];
    if (c) return ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || 'this professional';
    if (co) return co.name || 'this company';
    return 'this person';
  }
  /* the Message button on any profile, company or role page opens this for the admin */
  APP.adminMessage = function (target, name) {
    if (!B.isAdmin || !target) return;
    var nm = msgName(target); if (nm === 'this person' && name) nm = name;
    APP.openDialog({
      title: 'Message ' + h(nm) + ' as Arnour team',
      sub: h(nm) + ' will see “Arnour team”, not your name or e-mail. They can reply, and you will read the reply under Admin → Messages.',
      body: '<label class="field"><span class="label">Your message</span><textarea id="dlg-note" class="input" rows="5" maxlength="2000" placeholder="Write your message…"></textarea></label>',
      confirmLabel: 'Send as Arnour team',
      onConfirm: function (v) {
        var text = String(v.note || '').trim();
        if (!text) { APP.toast('Write a message first'); return; }
        B.rpc('admin_staff_send', { p_target: target, p_text: text }).then(function (r) {
          reload('staffbox'); reload('staffN'); reload('log');
          APP.toast('Sent as Arnour team ✓');
          if (/^#\/admin\/messages/.test(location.hash)) APP.render();
        }, function (e) {
          var m = String((e && e.message) || '');
          APP.toast(/too many/i.test(m) ? 'Too many messages in the last hour. Try again later.' : /no account/i.test(m) ? 'This profile has no account to message.' : /unknown profile/i.test(m) ? 'Could not find that profile.' : /too long/i.test(m) ? 'That message is too long (up to 2000 characters).' : 'Could not send. Please try again.');
        });
      }
    });
  };

  function vCatalog() {
    var w = need('catalog', 'get_catalog') || need('catusage', 'admin_catalog_usage') || need('catlog', 'admin_catalog_log', { p_limit: 60 }); if (w) return w;
    var C = A.data.catalog, U = A.data.catusage, L = A.data.catlog, sub = A.cat.sub;
    var undo = L.length && L[0].canUndo ? cb('adm-cat-undo', 'Undo: ' + h(L[0].summary), {}) : '';
    return '<h1>Catalog</h1><p class="muted">The SAP products, modules and specialties people choose from. Changes are live for everyone within seconds of the next page load. Nothing is ever deleted: <strong>hide</strong> an item and it leaves the pickers while people who already have it keep it, or <strong>merge</strong> it into another item to move everyone across.</p>' +
      '<div class="chip-wrap" style="margin-bottom:14px">' + [['skills', 'Skills (' + (C.products || []).reduce(function (n, p) { return n + (p.hidden ? 0 : (p.modules || []).filter(function (m) { return !m.hidden; }).length); }, 0) + ')'], ['specs', 'Specialties (' + allSpecs(C).filter(function (x) { return !x.hidden; }).length + ')'], ['history', 'History']].map(function (t) {
        return '<button type="button" class="chip' + (sub === t[0] ? ' chip-on' : '') + '" data-action="adm-cat-sub" data-s="' + t[0] + '">' + t[1] + '</button>'; }).join('') + (undo ? ' ' + undo : '') + '</div>' +
      edForm(C) + mergeForm(C, U) + (sub === 'specs' ? vCatalogSpecs(C, U) : sub === 'history' ? vCatalogHistory(L) : vCatalogSkills(C, U));
  }

  APP.views.admin = function (ctx) {
    document.title = 'Admin — Arnour';
    if (!B.isAdmin) return '<div class="empty">Not available.</div>';
    var tab = (ctx && ctx.p && ctx.p[0]) || 'overview', rest = ctx && ctx.p && ctx.p[1];
    if (!A.data.overview && tab !== 'overview') load('overview', 'admin_overview');
    if (A.data.health === undefined && tab !== 'health' && !A.err.health) load('health', 'admin_health');
    if (A.data.staffN === undefined && !A.err.staffN) load('staffN', 'admin_staff_unread');
    if (A.data.remN === undefined && !A.err.remN) load('remN', 'admin_reminders_count');
    if (A.data.unfN === undefined && !A.err.unfN) load('unfN', 'admin_unfinished_count');
    var body = tab === 'reports' ? vReports() : tab === 'people' ? vPeople(rest) : tab === 'roles' ? vRoles() : tab === 'import' ? vImport() : tab === 'feeds' ? vFeeds() : tab === 'catalog' ? vCatalog() : tab === 'lists' ? vLists() : tab === 'messages' ? vMessages() : tab === 'announce' ? vAnnounce() : tab === 'feedback' ? vFeedback() : tab === 'health' ? vHealth() : tab === 'traffic' ? vTraffic() : tab === 'reminders' ? vReminders() : tab === 'unfinished' ? vUnfinished() : tab === 'certs' ? vCerts() : tab === 'community' ? vCommunity() : tab === 'settings' ? vSettings() : tab === 'log' ? vLog() : (tab = 'overview', vOverview());
    return shell(tab, body);
  };


  function catQuick(d, v) {
    var op = d.kind + '_save', args = { id: d.id, name: v.name, short: v.short, family: v.family, hidden: v.hidden };
    if (d.kind === 'module') args.product_id = d.product;
    if (d.kind === 'spec') { args.area_id = v.area_id; args.grp = v.grp; args.roles = v.roles; }
    catSave(op, args, v.hidden ? 'Hidden — people who have it keep it ✓' : 'Visible again ✓');
  }

  /* ---------- actions ---------- */
  /* this file arrives after the page has started (it is loaded only for an administrator), so it hooks in below the access guard of js/main.js:
     APP._click / APP._submit are the inner handlers the guard calls. Loaded the old way (before main.js) it wraps APP.onClick as before. */
  var CK = APP._click ? '_click' : 'onClick', SK = APP._submit ? '_submit' : 'onSubmit';
  var prevClick = APP[CK], prevSubmit = APP[SK];
  APP[CK] = function (el, e) {
    var a = el.dataset.action, d = el.dataset;
    if (!a || a.indexOf('adm-') !== 0) return prevClick.apply(this, arguments);
    switch (a) {
      case 'adm-retry': delete A.err[d.key]; APP.render(); break;
      case 'adm-rstatus': A.rstatus = d.s; APP.render(); break;
      case 'adm-unf-f': A.unfF = d.f; APP.render(); break;
      case 'adm-rem-send': act('admin_reminder_decide', { p_ids: [Number(d.id)], p_action: 'approve' }, 'Sent ✓', ['reminders', 'remN', 'unfinished']); break;
      case 'adm-rem-skip': act('admin_reminder_decide', { p_ids: [Number(d.id)], p_action: 'skip' }, 'Skipped', ['reminders', 'remN', 'unfinished']); break;
      case 'adm-rem-all': {
        var ids = ((A.data.reminders && A.data.reminders.pending) || []).map(function (r) { return r.id; }); if (!ids.length) break;
        APP.openDialog({ title: 'Send ' + ids.length + ' reminder' + (ids.length === 1 ? '' : 's') + '?', sub: 'Each person gets the reminder e-mail now.', confirmLabel: 'Send all', body: '', onConfirm: function () { act('admin_reminder_decide', { p_ids: ids, p_action: 'approve' }, 'Sent ✓', ['reminders', 'remN', 'unfinished']); } });
        break;
      }
      case 'adm-traffic-days': A.trafficDays = d.n === 'h24' ? 'h24' : (Number(d.n) || 14); if (d.n === 'h24') reload('traffic:h24'); APP.render(); break;
      case 'adm-close-conv': A.conv = null; APP.render(); break;
      case 'adm-read-conv':
        B.rpc('admin_conversation', { p_conv: d.id }).then(function (c) { A.conv = c; reload('log'); APP.render(); }, function () { APP.toast('Could not open the conversation'); });
        break;
      case 'adm-mod': {
        var map = { remove: ['Remove this content?', 'The author is told it was removed. All reports about it are closed.', 'Remove', true],
          suspend: ['Suspend the owner?', 'They will be signed out of everything and see a notice. You can reinstate them later.', 'Suspend', true],
          resolve: ['Mark as resolved', 'No further action on the content.', 'Resolve', false],
          dismiss: ['Dismiss report', 'Nothing wrong was found.', 'Dismiss', false] }[d['do']];
        reasonDialog({ title: map[0], sub: map[1], confirmLabel: map[2], danger: map[3], label: d['do'] === 'dismiss' || d['do'] === 'resolve' ? 'Note' : 'Message to the person', required: d['do'] === 'suspend',
          run: function (note) { act('admin_moderate', { p_report: Number(d.id), p_action: d['do'], p_note: note }, 'Done ✓', ['reports:open', 'reports:resolved', 'reports:dismissed', 'reports:all', 'people:' + (A.q.people || ''), 'community:' + (A.q.community || ''), 'roles:' + (A.q.roles || '')]); } });
        break;
      }
      case 'adm-suspend':
        reasonDialog({ title: 'Suspend ' + d.n + '?', sub: 'They cannot sign in to use Arnour, their profile and content are hidden, and they see this reason.', confirmLabel: 'Suspend', danger: true, label: 'Reason shown to the person', required: true,
          run: function (note) { act('admin_set_suspended', { p_user: d.u, p_on: true, p_reason: note }, 'Account suspended', allKeys()); } });
        break;
      case 'adm-unsuspend': act('admin_set_suspended', { p_user: d.u, p_on: false, p_reason: '' }, 'Account reinstated ✓', allKeys()); break;
      case 'adm-delete-user':
        window.__admDel = '';
        APP.openDialog({ title: 'Delete ' + h(d.n) + '?', sub: 'This permanently deletes the account, profile, messages and posts. It cannot be undone. Type DELETE to confirm.', danger: true, confirmLabel: 'Delete account',
          body: '<label class="field"><input id="adm-del" class="input" placeholder="DELETE" autocomplete="off"></label>',
          onConfirm: function () {
            if (!window.__admDel || window.__admDel !== 'DELETE') { APP.toast('Not deleted — type DELETE to confirm'); return; }
            act('admin_delete_user', { p_user: d.u }, 'Account deleted', allKeys());
          } });
        break;
      case 'adm-cert': act('admin_set_cert_revoked', { p_entity: d.e, p_on: d.on === '1' }, d.on === '1' ? 'Badge removed' : 'Badge restored ✓', allKeys()); break;
      case 'adm-job-status': act('admin_set_job_status', { p_id: d.id, p_status: d.s, p_reason: '' }, d.s === 'open' ? 'Role reopened' : 'Role closed', allKeys()); break;
      case 'adm-job-delete':
        reasonDialog({ title: 'Delete this role?', sub: 'The company is told. Applications to it are deleted too.', confirmLabel: 'Delete role', danger: true, label: 'Message to the company',
          run: function (note) { act('admin_delete_job', { p_id: d.id, p_reason: note }, 'Role deleted', allKeys()); } });
        break;
      case 'adm-remove-post':
      case 'adm-inline-remove':
        if (d.kind === 'job') {
          reasonDialog({ title: 'Delete this role?', sub: 'The company is told.', confirmLabel: 'Delete role', danger: true, label: 'Message to the company',
            run: function (note) { act('admin_delete_job', { p_id: d.id, p_reason: note }, 'Role deleted', allKeys()).then(function () { if (a === 'adm-inline-remove') location.hash = '#/jobs'; }); } });
          break;
        }
        reasonDialog({ title: 'Remove this ' + (KIND_LABEL[d.kind] || 'post').toLowerCase() + '?', sub: 'The author is told it was removed.', confirmLabel: 'Remove', danger: true, label: 'Message to the author',
          run: function (note) {
            act('admin_remove_post', { p_kind: d.kind, p_id: d.id, p_reason: note }, 'Removed', allKeys()).then(function () {
              if (a === 'adm-inline-remove' && (d.kind === 'question' || d.kind === 'article')) location.hash = '#/community';
            });
          } });
        break;
      case 'adm-imp-check': {
        var ta = document.getElementById('imp-text'); A.imp.text = ta ? ta.value : A.imp.text; A.imp.result = null;
        var c = checkImport(A.imp.text); A.imp.error = c.error || ''; A.imp.rows = c.rows || null; APP.render(); break;
      }
      case 'adm-imp-run': {
        var ta2 = document.getElementById('imp-text'); if (ta2) A.imp.text = ta2.value;
        var c2 = checkImport(A.imp.text); if (c2.error || c2.rows.some(function (r) { return r.warn.length; })) { A.imp.error = c2.error || 'Fix the flagged roles first'; A.imp.rows = c2.rows || null; APP.render(); break; }
        if (A.imp.busy) break; A.imp.busy = true; APP.render();
        B.rpc('admin_import_external_jobs', { p_jobs: JSON.parse(A.imp.text) }).then(function (r) {
          A.imp.busy = false; A.imp.result = r; A.imp.rows = null; A.imp.text = ''; A.imp.error = '';
          allKeys().forEach(reload); reload('overview'); reload('log');
          if (B.fetchCommunity) B.fetchCommunity().then(function (cm) { if (cm && !B.commBusy) B.applyCommunity(APP.db, cm); APP.render(); }, function () { APP.render(); }); else APP.render();
        }, function (e) { A.imp.busy = false; A.imp.error = String((e && e.message) || 'Could not import'); APP.render(); });
        break;
      }
      case 'adm-feed-add': {
        var fco = document.getElementById('feed-co'), fu = document.getElementById('feed-url'), ff = document.querySelector('input[name=feed-filter]:checked');
        var fcv = fco ? fco.value : '', fuv = fu ? String(fu.value || '').trim() : '';
        A.feed.co = fcv; A.feed.url = fuv; A.feed.flt = ff ? ff.value : 'sap'; /* kept, so a message does not wipe what was typed */
        if (!fcv) { A.feed.addMsg = 'Choose the company first.'; APP.render(); break; }
        if (!/^https:\/\//i.test(fuv)) fuv = 'https://' + fuv.replace(/^http:\/\//i, '');
        if (!/^https:\/\/[^\s\/]+\.[^\s\/]+/.test(fuv) || /\s/.test(fuv)) { A.feed.addMsg = 'Enter the full link, for example https://careers.example.com/jobs'; APP.render(); break; }
        A.feed.addMsg = '';
        B.rpc('admin_feed_add', { p_company: fcv, p_url: fuv, p_filter: ff ? ff.value : 'sap' }).then(function (id) {
          A.feed.url = ''; A.feed.co = '';
          return B.rpc('admin_feed_list', {}).then(function (lst) { A.data.feeds = lst; reload('log'); feedCheck(id); });
        }, function (e) { A.feed.addMsg = String((e && e.message) || 'Could not connect'); APP.render(); });
        break;
      }
      case 'adm-feed-check': feedCheck(d.id); break;
      case 'adm-feed-tick': {
        var fl = (A.data['feeditems:' + d.id] || []).filter(function (i) { return i.state === 'found'; }), it = fl[+d.k];
        if (it) { var u = A.feed.unticked[d.id] = A.feed.unticked[d.id] || {}; if (u[it.key]) delete u[it.key]; else u[it.key] = 1; }
        APP.render(); break;
      }
      case 'adm-feed-bring': {
        var bl = (A.data['feeditems:' + d.id] || []).filter(function (i) { return i.state === 'found'; }), bun = A.feed.unticked[d.id] || {};
        var keys = bl.filter(function (i) { return !bun[i.key]; }).map(function (i) { return i.key; });
        if (A.feed.busy[d.id]) break; A.feed.busy[d.id] = 'bring'; APP.render();
        B.rpc('admin_feed_select', { p_id: d.id, p_keys: keys }).then(function (r) {
          A.feed.busy[d.id] = ''; A.feed.unticked[d.id] = {}; A.feed.note[d.id] = keys.length ? 'Reading ' + keys.length + ' role' + (keys.length === 1 ? '' : 's') + ' into drafts…' : 'No role was ticked: all were set aside.';
          feedRefresh(d.id); if (keys.length) feedRead(d.id);
        }, function (e) { A.feed.busy[d.id] = ''; A.feed.note[d.id] = 'Could not do that: ' + String((e && e.message) || 'error'); APP.render(); });
        break;
      }
      case 'adm-feed-read': feedRead(d.id); break;
      case 'adm-feed-retry':
        B.rpc('admin_feed_retry', { p_id: d.id }).then(function (n) { A.feed.note[d.id] = n + ' role' + (n === 1 ? '' : 's') + ' put back in the queue.'; feedRefresh(d.id); if (n) feedRead(d.id); }, function (e) { APP.toast('Could not do that: ' + String((e && e.message) || 'error')); });
        break;
      case 'adm-feed-all': A.feed.open[d.id] = !A.feed.open[d.id]; delete A.data['feeditems:' + d.id]; APP.render(); break;
      case 'adm-feed-toggle': {
        var tf = (A.data.feeds || []).filter(function (x) { return x.id === d.id; })[0]; if (!tf) break;
        B.rpc('admin_feed_update', { p_id: d.id, p_enabled: d.on === '1', p_auto_close: tf.autoClose, p_filter: tf.filter }).then(function () { A.feed.note[d.id] = d.on === '1' ? 'Switched on.' : 'Switched off. It will not be checked or read until you switch it on.'; feedRefresh(d.id); }, function (e) { APP.toast('Could not do that: ' + String((e && e.message) || 'error')); });
        break;
      }
      case 'adm-cred-remove':
        APP.openDialog({ title: 'Remove this badge?', sub: h(d.n) + ' is taken off the profile. The professional can add it again with the same link.', danger: true, confirmLabel: 'Remove',
          onConfirm: function () { act('admin_cred_remove', { p_id: d.id }, 'Badge removed', ['certs']); } });
        break;
      case 'adm-feed-remove':
        APP.openDialog({ title: 'Disconnect ' + h(d.n) + '?', sub: 'Arnour stops checking this page. Drafts and roles already made stay with the company.', danger: true, confirmLabel: 'Disconnect',
          onConfirm: function () { B.rpc('admin_feed_remove', { p_id: d.id }).then(function () { delete A.data['feeditems:' + d.id]; APP.toast('Disconnected'); feedRefresh(); }, function (e) { APP.toast('Could not do that: ' + String((e && e.message) || 'error')); }); } });
        break;
      case 'adm-feed-secret': {
        if (A.feed.secretBusy) break;
        var bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
        var hex = function (arr) { return Array.prototype.map.call(arr, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
        var secret = hex(bytes); A.feed.secretBusy = true; APP.render();
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)).then(function (buf) { return B.rpc('admin_feed_set_secret', { p_hash: hex(new Uint8Array(buf)) }); }).then(function () {
          A.feed.secretBusy = false; delete A.data.feedst; reload('log'); APP.render();
          APP.openDialog({ title: 'Your daily-check secret', confirmLabel: 'Done', cancelLabel: 'Close', onConfirm: function () {},
            sub: 'Copy it now: it is shown only once (Arnour keeps just a fingerprint). If you lose it, create a new one.',
            body: '<label class="field"><span class="label">Secret</span><input id="feed-secret" class="input" readonly value="' + secret + '"></label><div class="adm-actions"><button type="button" class="btn btn-outline btn-sm" data-action="adm-feed-copy">Copy the secret</button></div>' +
              '<ol class="small"><li>Click <strong>Copy the secret</strong>.</li><li>Open <strong>app.netlify.com</strong>, click your site <strong>arnour</strong>, then <strong>Site configuration</strong> and <strong>Environment variables</strong>.</li>' +
              '<li>Click <strong>Add a variable</strong>, then <strong>Add a single variable</strong>. Key: <strong>FEED_WORKER_SECRET</strong>. Value: paste the secret. Leave the other choices as they are, and click <strong>Create variable</strong>. (If the variable already exists, click it and replace its value.)</li>' +
              '<li>Click <strong>Deploys</strong>, then <strong>Trigger deploy</strong>, then <strong>Deploy site</strong>, and wait for <strong>Published</strong>.</li><li>Come back to this page. After about 10 minutes the card says when the daily check last ran.</li></ol>' });
        }, function (e) { A.feed.secretBusy = false; APP.toast('Could not do that: ' + String((e && e.message) || 'error')); APP.render(); });
        break;
      }
      case 'adm-feed-copy': {
        var si = document.getElementById('feed-secret'); if (!si) break; si.select();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(si.value).then(function () { APP.toast('Copied ✓'); }, function () { APP.toast('Select the text and copy it by hand'); });
        else { try { document.execCommand('copy'); APP.toast('Copied ✓'); } catch (e2) { APP.toast('Select the text and copy it by hand'); } }
        break;
      }
      case 'adm-ann-reset': A.ann.f = Object.assign({}, ANN0); A.ann.step = 'edit'; APP.render(); break;
      case 'adm-ann-back': A.ann.step = 'edit'; APP.render(); break;
      case 'adm-ann-test': {
        if (A.ann.busy) break;
        A.ann.busy = true;
        B.rpc('admin_announce_send', { p_data: annArgs(), p_test: true }).then(function (r) {
          A.ann.busy = false;
          APP.toast(r && r.hasProfile === false ? 'Test not delivered: your admin account has no profile to receive it' : 'Test sent to you ✓ ' + [r.bell ? 'bell' : '', r.email ? 'email (within about 10 minutes)' : ''].filter(Boolean).join(' and '));
          APP.render();
        }, annErr);
        break;
      }
      case 'adm-ann-send': {
        if (A.ann.busy) break;
        A.ann.busy = true;
        B.rpc('admin_announce_send', { p_data: annArgs(), p_test: false }).then(function (r) {
          A.ann.busy = false; A.ann.step = 'edit'; A.ann.f = Object.assign({}, ANN0); A.ann.counts = null; delete A.data.annlist; reload('log');
          APP.toast('Sent ✓ ' + [r.banner ? 'banner live' : '', r.bell ? 'bell to ' + r.bell : '', r.email ? 'email to ' + r.email : ''].filter(Boolean).join(' · '));
          APP.render();
        }, annErr);
        break;
      }
      case 'adm-ann-withdraw': {
        var wid = Number(d.id);
        if (!d.yes) { A.ann.confirmW = A.ann.confirmW === wid ? 0 : wid; APP.render(); break; }
        B.rpc('admin_announce_withdraw', { p_ann_id: wid }).then(function (r) {
          A.ann.confirmW = 0; delete A.data.annlist; reload('log');
          APP.toast('Withdrawn ✓' + (r && r.cancelledEmails ? ' ' + r.cancelledEmails + ' waiting email(s) cancelled' : '')); APP.render();
        }, annErr);
        break;
      }
      case 'adm-message': APP.adminMessage(d.id, d.name); break;
      case 'adm-menu': A.menuOpen = true; APP.render(); break;
      case 'adm-menu-close': A.menuOpen = false; APP.render(); break;
      case 'adm-tog': { var tg = el.closest('.adm-togg, .adm-more'); if (tg) tg.classList.toggle('on'); break; }
      case 'adm-msg-open':
        A.msg.id = d.id; A.msg.thread = null; APP.render();
        B.rpc('admin_staff_thread', { p_conv: d.id }).then(function (t) {
          A.msg.thread = t; reload('staffbox'); reload('staffN'); APP.render();
          setTimeout(function () { var el = document.getElementById('adm-thread'); if (el) el.scrollTop = el.scrollHeight; }, 0);
        }, function () { A.msg.id = null; APP.toast('Could not open the conversation'); APP.render(); });
        break;
      case 'adm-msg-back': A.msg.id = null; A.msg.thread = null; reload('staffbox'); APP.render(); break;
      case 'adm-lst-sub': A.lst.sub = d.s; A.lst.ed = null; A.lst.merge = null; APP.render(); break;
      case 'adm-lst-toggle': A.lst.open[d.id] = !A.lst.open[d.id]; APP.render(); break;
      case 'adm-lst-cancel': A.lst.ed = null; A.lst.merge = null; APP.render(); break;
      case 'adm-lst-undo': lstSave('undo', {}, function (r) { return 'Undone: ' + (r && r.undone || 'last change'); }); break;
      case 'adm-lst-copy': {
        var tx = document.getElementById('adm-lst-export');
        if (tx) { tx.select(); try { navigator.clipboard.writeText(tx.value).then(function () { APP.toast('Copied ✓'); }, function () { document.execCommand('copy'); APP.toast('Copied ✓'); }); } catch (er) { try { document.execCommand('copy'); APP.toast('Copied ✓'); } catch (e2) { /* ignore */ } } }
        break;
      }
      case 'adm-lst-add':
        A.lst.merge = null;
        A.lst.ed = { kind: d.kind, id: '', parent: d.parent || '', vals: { name: '', hidden: false, parent: d.kind === 'country' ? (((A.data.lists.regions || []).filter(function (r) { return !r.hidden; })[0] || {}).id || '') : (d.parent || '') } };
        if (d.kind === 'city') A.lst.open[d.parent] = true;
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-lst-ed"] [name="name"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } }, 30);
        break;
      case 'adm-lst-edit': {
        var it = lFind(A.data.lists, d.kind, d.id, d.parent); if (!it) break;
        var lv = { name: it.name, hidden: !!it.hidden, parent: d.kind === 'country' ? it.region : (d.parent || '') };
        if (d.quick) { lv.hidden = d.quick === 'hide'; lstSave('save', { kind: d.kind, id: d.id, name: lv.name, parent: lv.parent, hidden: lv.hidden }, lv.hidden ? 'Hidden — people who have it keep it ✓' : 'Visible again ✓'); break; }
        A.lst.merge = null; A.lst.ed = { kind: d.kind, id: d.id, parent: d.parent || '', vals: lv };
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-lst-ed"] [name="name"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } }, 30);
        break;
      }
      case 'adm-lst-merge':
        A.lst.ed = null; A.lst.merge = { kind: d.kind, id: d.id, parent: d.parent || '', to: '' };
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-lst-merge"]'); if (i) i.scrollIntoView({ block: 'center' }); }, 30);
        break;
      case 'adm-lst-move': {
        var arr = lItems(A.data.lists, d.kind, d.parent).map(function (x) { return x.id; }), at = arr.indexOf(d.id), to2 = at + Number(d.dir);
        if (at < 0 || to2 < 0 || to2 >= arr.length) break;
        var tmp = arr[at]; arr[at] = arr[to2]; arr[to2] = tmp;
        lstSave('reorder', { kind: d.kind, parent: d.parent || '', ids: arr }, 'Order changed ✓');
        break;
      }
      case 'adm-cat-sub': A.cat.sub = d.s; A.cat.ed = null; A.cat.merge = null; APP.render(); break;
      case 'adm-cat-toggle': A.cat.openP[d.id] = !A.cat.openP[d.id]; APP.render(); break;
      case 'adm-cat-atoggle': A.cat.openA[d.id] = A.cat.openA[d.id] === false; APP.render(); break;
      case 'adm-cat-cancel': A.cat.ed = null; A.cat.merge = null; APP.render(); break;
      case 'adm-cat-undo': catSave('undo', {}, function (r) { return 'Undone: ' + (r && r.undone || 'last change'); }); break;
      case 'adm-cat-add': {
        A.cat.merge = null;
        var area0 = d.area || ((A.data.catalog.areas || [])[0] || {}).id || '';
        A.cat.ed = { kind: d.kind, id: '', product_id: d.product || '', vals: { name: '', short: '', family: '', hidden: false, grp: '', area_id: area0, roles: [] } };
        if (d.kind === 'module') A.cat.openP[d.product] = true;
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-cat-ed"] [name="name"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } }, 30);
        break;
      }
      case 'adm-cat-edit': {
        var C0 = A.data.catalog, v0 = null;
        if (d.kind === 'product') { var pp = findProduct(C0, d.id); if (pp) v0 = { name: pp.name, short: pp.short, family: '', hidden: !!pp.hidden, grp: '', area_id: '', roles: [] }; }
        else if (d.kind === 'module') { var mm = findModule(C0, d.product, d.id); if (mm) v0 = { name: mm.name, short: '', family: mm.family || '', hidden: !!mm.hidden, grp: '', area_id: '', roles: [] }; }
        else if (d.kind === 'area') { var aa = (C0.areas || []).filter(function (x) { return x.id === d.id; })[0]; if (aa) v0 = { name: aa.name, short: '', family: '', hidden: !!aa.hidden, grp: '', area_id: '', roles: [] }; }
        else { var sp = allSpecs(C0).filter(function (x) { return x.id === d.id; })[0]; if (sp) v0 = { name: sp.name, short: sp.short, family: '', hidden: !!sp.hidden, grp: sp.grp || '', area_id: sp.area, roles: Object.keys(C0.roles || {}).filter(function (r) { return (C0.roles[r] || []).indexOf(sp.id) !== -1; }) }; }
        if (!v0) break;
        if (d.quick) { v0.hidden = d.quick === 'hide'; catQuick(d, v0); break; }
        A.cat.merge = null; A.cat.ed = { kind: d.kind, id: d.id, product_id: d.product || '', vals: v0 };
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-cat-ed"] [name="name"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } }, 30);
        break;
      }
      case 'adm-cat-merge':
        A.cat.ed = null;
        A.cat.merge = d.kind === 'module' ? { kind: 'module', fp: d.product, fm: d.id, tp: d.product, tm: '' } : { kind: 'spec', from: d.id, to: '' };
        APP.render(); setTimeout(function () { var i = document.querySelector('form[data-form="adm-cat-merge"]'); if (i) i.scrollIntoView({ block: 'center' }); }, 30);
        break;
      case 'adm-cat-move': {
        var C1 = A.data.catalog, dir = Number(d.dir), ids, args;
        function swap(list, id) { var i = list.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return null; var c = list.slice(); c[i] = list[j]; c[j] = list[i]; return c; }
        if (d.kind === 'product') { ids = swap((C1.products || []).map(function (x) { return x.id; }), d.id); args = { kind: 'product', ids: ids }; }
        else if (d.kind === 'module') { ids = swap(findProduct(C1, d.product).modules.map(function (x) { return x.id; }), d.id); args = { kind: 'module', parent: d.product, ids: ids }; }
        else if (d.kind === 'area') { ids = swap((C1.areas || []).map(function (x) { return x.id; }), d.id); args = { kind: 'area', ids: ids }; }
        else if (d.kind === 'group') { var ar = (C1.areas || []).filter(function (x) { return x.id === d.area; })[0]; ids = swap(ar.groups.map(function (g) { return g.name; }), d.id); args = { kind: 'group', parent: d.area, ids: ids }; }
        else {
          var ar2 = (C1.areas || []).filter(function (x) { return x.id === d.area; })[0], grp = ar2.groups.filter(function (g) { return g.name === d.group; })[0];
          var gl = swap(grp.items.map(function (x) { return x.id; }), d.id);
          if (gl) { var all = []; ar2.groups.forEach(function (g) { if (g.name === d.group) all = all.concat(gl); else all = all.concat(g.items.map(function (x) { return x.id; })); }); ids = all; }
          args = { kind: 'spec', parent: d.area, ids: ids };
        }
        if (ids) catSave('reorder', args, 'Order changed ✓');
        break;
      }
      case 'adm-fstatus': A.fstatus = d.s; APP.render(); break;
      case 'adm-fb-set': act('admin_feedback_set', { p_id: Number(d.id), p_status: d.s, p_note: '' }, d.s === 'done' ? 'Marked done ✓' : 'Reopened', ['feedback:open', 'feedback:done', 'health']); break;
      case 'adm-fb-shot':
        B.sb.storage.from('feedback').createSignedUrl(d.p, 300).then(function (r) { if (r.error || !r.data) APP.toast('Could not open the screenshot'); else window.open(r.data.signedUrl, '_blank', 'noopener'); });
        break;
      case 'adm-clear-errors': act('admin_clear_errors', {}, 'Cleared. A copy is kept in the history.', ['health', 'errhist']); break;
      case 'adm-err-history': A.errHistOpen = !A.errHistOpen; if (A.errHistOpen) reload('errhist'); APP.render(); break;
      case 'adm-err-resolve': {
        var fixed = d.o === 'fixed';
        reasonDialog({
          title: fixed ? 'Mark this error as fixed?' : 'Mark this as not a bug?',
          sub: 'It moves to the history with your note. If it appears again it is shown as “Came back”.',
          label: fixed ? 'What was wrong and what was done' : 'Why it is not a bug', confirmLabel: fixed ? 'Mark fixed' : 'Not a bug',
          run: function (note) { act('admin_error_resolve', { p_fp: d.fp, p_outcome: d.o, p_note: note }, fixed ? 'Moved to the history ✓' : 'Moved to the history ✓', ['health', 'errhist']); }
        });
        break;
      }
      case 'adm-samples': act('admin_set_hide_samples', { p_on: d.on === '1' }, d.on === '1' ? 'Sample content hidden' : 'Sample content showing', ['settings'].concat(allKeys())).then(function () {
          /* the admin's own view of jobs, companies, people and community follows right away */
          if (B.refreshPublicNow) B.refreshPublicNow().then(function () { if (B.profile && B.fetchPrivate) return B.fetchPrivate().then(function (p) { B._lastPrivate = p; B.applyPrivate(APP.db, p); if (p.consultants && B.applyDirectory) B.applyDirectory(APP.db, p.consultants); }); }).then(function () { APP.render(); }, function () { APP.render(); });
        }); break;
    }
  };
  function allKeys() { return Object.keys(A.data).filter(function (k) { return k !== 'overview' && k !== 'log'; }); }

  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.id !== 'imp-file' || !t.files || !t.files[0]) return;
    var rd = new FileReader();
    rd.onload = function () {
      A.imp.text = String(rd.result || ''); A.imp.result = null;
      var c = checkImport(A.imp.text); A.imp.error = c.error || ''; A.imp.rows = c.rows || null; APP.render();
    };
    rd.readAsText(t.files[0]); t.value = '';
  });
  /* keep what is typed in the catalog forms across re-renders */
  function catKeep(e) {
    var t = e.target, f = t && t.closest ? t.closest('form[data-form="adm-cat-ed"]') : null;
    if (f && A.cat.ed) {
      var v = A.cat.ed.vals;
      if (t.name === 'name' || t.name === 'short' || t.name === 'grp' || t.name === 'family' || t.name === 'area_id') v[t.name] = t.value;
      else if (t.name === 'hidden') v.hidden = t.checked;
      else if (t.name === 'role') { v.roles = Array.prototype.map.call(f.querySelectorAll('input[name="role"]:checked'), function (x) { return x.value; }); }
      if (t.name === 'area_id' && e.type === 'change') APP.render();
      return;
    }
    var mf = t && t.closest ? t.closest('form[data-form="adm-cat-merge"]') : null;
    if (mf && A.cat.merge) {
      var m = A.cat.merge;
      if (t.name === 'tp' && e.type === 'change') { m.tp = t.value; m.tm = ''; APP.render(); }
      else if (t.name === 'tm') m.tm = t.value;
      else if (t.name === 'to') m.to = t.value;
    }
  }
  function annKeep(e) {
    var t = e.target, f = t && t.closest ? t.closest('form[data-form="adm-ann"]') : null;
    if (!f || !t.name) return;
    var v = A.ann.f;
    if (t.type === 'checkbox') { v[t.name] = t.checked; if (e.type === 'change' && t.name === 'ch_banner') APP.render(); return; }
    v[t.name] = t.value;
    if (e.type === 'change' && t.name === 'who') { if (v.who !== 'pros') v.role_type = ''; APP.render(); }
  }
  document.addEventListener('input', annKeep);
  document.addEventListener('change', annKeep);
  function lstKeep(e) {
    var t = e.target, f = t && t.closest ? t.closest('form[data-form="adm-lst-ed"]') : null;
    if (f && A.lst.ed) {
      if (t.name === 'name' || t.name === 'parent') A.lst.ed.vals[t.name] = t.value;
      else if (t.name === 'hidden') A.lst.ed.vals.hidden = t.checked;
      return;
    }
    var mf = t && t.closest ? t.closest('form[data-form="adm-lst-merge"]') : null;
    if (mf && A.lst.merge && t.name === 'to') A.lst.merge.to = t.value;
  }
  document.addEventListener('input', lstKeep);
  document.addEventListener('change', lstKeep);
  document.addEventListener('input', catKeep);
  document.addEventListener('change', catKeep);
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'adm-del') window.__admDel = e.target.value.trim(); });

  APP[SK] = function (f) {
    if (f.dataset.form === 'adm-rem-text') {
      var sj = f.querySelector('[name="subject"]'), bd = f.querySelector('[name="body"]');
      if (!sj || !bd || !String(sj.value).trim() || !String(bd.value).trim()) { APP.toast('The subject and the text cannot be empty'); return; }
      B.rpc('admin_reminder_text_save', { p_key: f.dataset.key, p_subject: sj.value, p_body: bd.value }).then(function () { reload('reminders'); reload('log'); APP.toast('Wording saved ✓'); APP.render(); }, function (e) { APP.toast('Could not save: ' + String((e && e.message) || 'error')); });
      return;
    }
    if (f.dataset.form === 'adm-msg-send') {
      var M = A.msg, ta = f.querySelector('textarea[name="t"]'), txt = ta ? String(ta.value || '').trim() : '';
      if (M.busy || !M.thread) return;
      if (!txt) { APP.toast('Write a message first'); return; }
      M.busy = true;
      B.rpc('admin_staff_send', { p_target: M.thread.entity, p_text: txt }).then(function () {
        return B.rpc('admin_staff_thread', { p_conv: M.id });
      }).then(function (t) {
        M.busy = false; M.thread = t; reload('staffbox'); reload('staffN'); reload('log'); APP.toast('Sent as Arnour team ✓'); APP.render();
        setTimeout(function () { var el = document.getElementById('adm-thread'); if (el) el.scrollTop = el.scrollHeight; }, 0);
      }, function (e) { M.busy = false; APP.toast(/too many/i.test(String((e && e.message) || '')) ? 'Too many messages in the last hour. Try again later.' : 'Could not send. Please try again.'); APP.render(); });
      return;
    }
    if (f.dataset.form === 'adm-ann') {
      if (A.ann.busy) return;
      var ar = annArgs();
      if (!ar.title.trim()) { APP.toast('Please add a title'); return; }
      A.ann.busy = true;
      B.rpc('admin_announce_count', { p_data: ar }).then(function (c) { A.ann.busy = false; A.ann.counts = c; A.ann.step = 'review'; APP.render(); window.scrollTo(0, 0); }, annErr);
      return;
    }
    if (f.dataset.form === 'adm-lst-ed') {
      var le = A.lst.ed; if (!le) return;
      var lf = new FormData(f), lname = String(lf.get('name') || '').trim();
      if (!lname) { APP.toast('Please give it a name'); return; }
      lstSave('save', { kind: le.kind, id: le.id || undefined, name: lname, parent: le.kind === 'country' ? String(lf.get('parent') || '') : (le.parent || ''), hidden: lf.get('hidden') === 'on' }, function (r) {
        var rw = r && r.rewrite; return (le.id ? 'Saved ✓' : 'Added ✓') + (rw && (rw.profiles || rw.roles) ? ' ' + pl(rw.profiles || 0, 'profile') + ' and ' + pl(rw.roles || 0, 'role') + ' updated' : ''); });
      return;
    }
    if (f.dataset.form === 'adm-lst-merge') {
      var lm = A.lst.merge; if (!lm) return;
      var lg = new FormData(f);
      if (String(lg.get('confirm') || '').trim() !== 'MERGE') { APP.toast('Not merged — type MERGE to confirm'); return; }
      var lto = String(lg.get('to') || ''); if (!lto) { APP.toast('Choose where to merge it'); return; }
      lstSave('merge', { kind: lm.kind, from: lm.id, to: lto }, function (r) { return 'Merged ✓ ' + pl(r.profiles || 0, 'profile') + ' and ' + pl(r.roles || 0, 'role') + ' moved'; });
      return;
    }
    if (f.dataset.form === 'adm-cat-ed') {
      var ed = A.cat.ed; if (!ed) return;
      var fd = new FormData(f), vals = ed.vals;
      var args = { id: ed.id || undefined, name: String(fd.get('name') || '').trim(), short: String(fd.get('short') || '').trim(), hidden: fd.get('hidden') === 'on' };
      if (ed.kind === 'module') { args.product_id = ed.product_id; args.family = String(fd.get('family') || ''); }
      if (ed.kind === 'spec') { args.area_id = String(fd.get('area_id') || ''); args.grp = String(fd.get('grp') || '').trim(); args.roles = fd.getAll('role'); }
      if (!args.name) { APP.toast('Please give it a name'); return; }
      catSave(ed.kind + '_save', args, ed.id ? 'Saved ✓' : 'Added ✓'); return;
    }
    if (f.dataset.form === 'adm-cat-merge') {
      var m = A.cat.merge; if (!m) return;
      var g = new FormData(f);
      if (String(g.get('confirm') || '').trim() !== 'MERGE') { APP.toast('Not merged — type MERGE to confirm'); return; }
      if (m.kind === 'module') {
        var tm = String(g.get('tm') || ''); if (!tm) { APP.toast('Choose the module to merge into'); return; }
        catSave('merge_module', { from_p: m.fp, from_m: m.fm, to_p: String(g.get('tp') || m.fp), to_m: tm }, function (r) { return 'Merged ✓ ' + pl(r.profiles || 0, 'profile') + ' and ' + pl(r.roles || 0, 'role') + ' moved'; });
      } else {
        var to = String(g.get('to') || ''); if (!to) { APP.toast('Choose the specialty to merge into'); return; }
        catSave('merge_spec', { from: m.from, to: to }, function (r) { return 'Merged ✓ ' + pl(r.profiles || 0, 'profile') + ' and ' + pl(r.roles || 0, 'role') + ' moved'; });
      }
      return;
    }
    if (f.dataset.form === 'adm-search') {
      var q = String(new FormData(f).get('q') || '').trim();
      A.q[f.dataset.tab] = q; APP.render(); return;
    }
    return prevSubmit.apply(this, arguments);
  };
  APP.adminLoaded = true;
})();
