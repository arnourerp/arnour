/* Arnour admin area, reporting and moderation tools (live mode only). */
(function () {
  'use strict';
  var B = APP.backend, h = APP.h;
  if (!B) return;

  var A = { data: {}, loading: {}, err: {}, q: { people: '', roles: '', community: '' }, rstatus: 'open', fstatus: 'open', conv: null, imp: { text: '', rows: null, error: '', result: null, busy: false } };
  var REASONS = [
    ['spam', 'Spam or advertising'], ['abuse', 'Harassment or abuse'], ['fake', 'Fake or misleading'],
    ['inappropriate', 'Inappropriate content'], ['privacy', 'Shares private information'], ['other', 'Something else']
  ];
  var REASON_LABEL = {}; REASONS.forEach(function (r) { REASON_LABEL[r[0]] = r[1]; });
  var KIND_LABEL = { question: 'Question', answer: 'Answer', article: 'Article', comment: 'Comment', profile: 'Profile', company: 'Company', job: 'Role', conversation: 'Conversation' };
  var REMOVABLE = ['question', 'answer', 'article', 'comment', 'job'];

  function when(ts) { var d = new Date(typeof ts === 'number' ? ts : ts); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function whenT(ts) { return APP.timeAgo ? APP.timeAgo(typeof ts === 'number' ? ts : new Date(ts).getTime()) : when(ts); }

  /* ---------- reporting + inline moderation ---------- */
  APP.reportBtn = function (kind, target, mine) {
    if (mine || !B.profile || B.isAdmin) return '';
    return '<button type="button" class="link-btn report-btn" data-action="report" data-kind="' + h(kind) + '" data-id="' + h(target) + '" title="Report to Arnour">Report</button>';
  };
  function locallyMine(kind, id) {
    try {
      var k = APP.userKey && APP.userKey(); if (!k) return false;
      if (kind === 'question') { var q = APP.db.questions[id]; return !!q && q.authorId === k; }
      if (kind === 'article') { var a = APP.db.articles[id]; return !!a && a.authorId === k; }
      var qs = APP.db.questions, as = APP.db.articles, i, j, list;
      for (i in qs) { list = qs[i].answers || []; for (j = 0; j < list.length; j++) if (list[j].id === id) return list[j].authorId === k; }
      for (i in as) { list = as[i].comments || []; for (j = 0; j < list.length; j++) if (list[j].id === id) return list[j].authorId === k; }
    } catch (e) { /* ignore */ }
    return false;
  }
  APP.modTools = function (kind, id, mine, wrap) {
    mine = mine || locallyMine(kind, id);
    var inner = '';
    if (B.isAdmin) {
      if (REMOVABLE.indexOf(kind) !== -1) inner += '<button type="button" class="link-btn danger" data-action="adm-inline-remove" data-kind="' + h(kind) + '" data-id="' + h(id) + '">Remove (admin)</button>';
      if (kind === 'profile' || kind === 'company') inner += '<a class="link-btn" href="#/admin/people/' + h(id) + '">Manage (admin)</a>';
    } else inner = APP.reportBtn(kind, id, mine);
    if (!inner) return '';
    return wrap ? '<div class="mod-row">' + inner + '</div>' : '<span class="mod-tools">' + inner + '</span>';
  };

  function reportDialog(kind, id) {
    APP.openDialog({
      title: 'Report this ' + (KIND_LABEL[kind] || 'item').toLowerCase(),
      sub: 'Only the Arnour team sees your report. The person you report is not told who reported them.',
      body: '<label class="field"><span class="label">What is wrong?</span><select id="dlg-sel" class="input">' +
        REASONS.map(function (r) { return '<option value="' + r[0] + '">' + h(r[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="label">Details <span class="muted">(optional)</span></span><textarea id="dlg-note" class="input" rows="3" maxlength="300" placeholder="Anything that helps us look into it…"></textarea><span class="muted small dlg-count" id="dlg-count">0 / 300</span></label>',
      confirmLabel: 'Send report',
      onConfirm: function (v) {
        B.rpc('report_item', { p_kind: kind, p_target: id, p_reason: v.sel || 'other', p_note: v.note || '' }).then(function () {
          APP.toast('Thank you — we will look into it ✓');
        }, function (e) {
          var m = String((e && e.message) || '');
          APP.toast(/too many/i.test(m) ? 'You have sent many reports today. Please try again tomorrow.' : /own item/i.test(m) ? 'You cannot report your own content' : 'Could not send the report. Please try again.');
        });
      }
    });
  }

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
    ['Overview', [['overview', 'Dashboard', 'Numbers at a glance'], ['health', 'Health', 'Errors and email delivery']]],
    ['People & roles', [['people', 'People', 'Professionals and companies'], ['roles', 'Roles', 'Posted and imported roles'], ['reports', 'Reports', 'Content people reported'], ['community', 'Community', 'Questions, answers, articles']]],
    ['Content', [['catalog', 'SAP catalog', 'Products, modules, specialties'], ['lists', 'Countries & languages', 'Countries, cities, regions, nationalities, languages'], ['import', 'Import jobs', 'Add roles from company career pages']]],
    ['Communicate', [['announce', 'Announcements', 'Banner, bell and email to users'], ['feedback', 'Feedback', 'What people sent you']]],
    ['Settings', [['settings', 'Site settings', 'Sample content on or off'], ['log', 'Activity log', 'Everything admins did']]]
  ];
  var TABS = []; GROUPS.forEach(function (g) { g[1].forEach(function (t) { TABS.push(t); }); });

  function shell(tab, inner) {
    var open = A.data.overview ? A.data.overview.openReports : 0, fb = A.data.health && A.data.health.openFeedback ? A.data.health.openFeedback : 0;
    var menuOpen = !!A.menuOpen; A.menuOpen = false; /* the phone menu closes on the next page or refresh */
    var cur = TABS.filter(function (t) { return t[0] === tab; })[0];
    var badge = function (id) { var n = id === 'reports' ? open : id === 'feedback' ? fb : 0; return n ? ' <em>' + n + '</em>' : ''; };
    var groupBadge = function (g) { var n = 0; g[1].forEach(function (t) { n += t[0] === 'reports' ? open : t[0] === 'feedback' ? fb : 0; }); return n; };
    return '<div class="adm' + (menuOpen ? ' adm-menu-open' : '') + '"><header class="adm-top"><a class="brand-logo" href="#/admin" aria-label="Arnour admin">A</a><strong>Arnour admin</strong>' +
      '<button type="button" class="btn btn-outline btn-sm adm-menu-btn" data-action="adm-menu" aria-expanded="' + menuOpen + '">☰ ' + h(cur ? cur[1] : 'Menu') + '</button><span class="grow"></span>' +
      '<a class="btn btn-ghost btn-sm" href="#/home">← View the site</a></header>' +
      '<div class="adm-body"><nav class="adm-tabs" aria-label="Admin sections">' + GROUPS.map(function (g) {
        var gb = groupBadge(g);
        return '<div class="adm-group"><div class="adm-group-t">' + h(g[0]) + (gb ? ' <em>' + gb + '</em>' : '') + '</div>' + g[1].map(function (t) {
          return '<a class="adm-tab' + (t[0] === tab ? ' on' : '') + '" href="#/admin/' + t[0] + '" title="' + h(t[2]) + '">' + h(t[1]) + badge(t[0]) + '</a>';
        }).join('') + '</div>';
      }).join('') + '</nav><main class="adm-main">' + inner + '</main></div></div>';
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
      '</div><h2>Sign-ups, last 14 days</h2><div class="adm-bars">' + (o.series || []).map(function (s) {
        return '<div class="adm-bar" title="' + h(s.d) + ': ' + s.n + '"><i style="height:' + Math.max(3, Math.round(s.n / max * 100)) + '%"></i><span>' + s.d.slice(8) + '</span></div>';
      }).join('') + '</div>' +
      (o.noProfile ? '<p class="muted small">' + o.noProfile + ' account(s) have signed up but not finished creating a profile.</p>' : '');
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
          (p.suspended ? '<button class="btn btn-outline btn-sm" data-action="adm-unsuspend" data-u="' + p.userId + '">Reinstate</button>'
            : '<button class="btn btn-outline btn-sm" data-action="adm-suspend" data-u="' + p.userId + '" data-n="' + h(p.email) + '">Suspend</button>') +
          (p.role === 'consultant' && p.selfCertified ? (p.certRevoked ? '<button class="btn btn-ghost btn-sm" data-action="adm-cert" data-e="' + h(p.entityId) + '" data-on="0">Restore badge</button>' : '<button class="btn btn-ghost btn-sm" data-action="adm-cert" data-e="' + h(p.entityId) + '" data-on="1">Remove badge</button>') : '') +
          '<button class="btn btn-danger btn-sm" data-action="adm-delete-user" data-u="' + p.userId + '" data-n="' + h(p.email) + '">Delete account</button></div></article>';
      }).join('') : '<div class="empty">No one found.</div>');
  }

  function vRoles() {
    var key = 'roles:' + (A.q.roles || '');
    var w = need(key, 'admin_jobs', { p_q: A.q.roles || '', p_limit: 100 }); if (w) return w;
    var list = A.data[key];
    return '<h1>Roles</h1>' + searchBar('roles', 'Search title, company, email…') + (list.length ? list.map(function (j) {
      return '<article class="adm-card"><div class="adm-row"><strong>' + h(j.title) + '</strong> <span class="pill muted-pill">' + h(j.status) + '</span>' + (j.sample ? ' <span class="pill muted-pill">Sample</span>' : '') + (j.external ? ' <span class="pill ext-badge">External · ' + h(j.extEmployer || '') + '</span>' : '') + (j.confidential ? ' <span class="pill muted-pill">Confidential</span>' : '') + '</div>' +
        '<p class="muted small">' + h(j.company || '') + ' · ' + h(j.email || '') + ' · posted ' + whenT(j.postedTs) + ' · ' + j.applicants + ' applicants</p>' +
        '<div class="adm-actions"><a class="btn btn-outline btn-sm" href="#/job/' + h(j.id) + '">Open</a>' +
        (j.status === 'open' ? '<button class="btn btn-outline btn-sm" data-action="adm-job-status" data-id="' + h(j.id) + '" data-s="closed">Close role</button>' : '<button class="btn btn-outline btn-sm" data-action="adm-job-status" data-id="' + h(j.id) + '" data-s="open">Reopen</button>') +
        '<button class="btn btn-danger btn-sm" data-action="adm-job-delete" data-id="' + h(j.id) + '">Delete</button></div></article>';
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
  function vImport() {
    var I = A.imp, bad = I.rows ? I.rows.filter(function (r) { return r.warn.length; }).length : 0;
    var html = '<h1>Import jobs</h1><p class="muted">Paste the JSON produced by the “arnour-external-jobs” skill. Roles appear under <strong>Jobs on Arnour</strong>, labelled “External listing”, and expire after 60 days. Close or delete any of them anytime from the Roles tab.</p>' +
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
  function vHealth() {
    var w = need('health', 'admin_health'); if (w) return w;
    var H = A.data.health, errs = H.errors || [], use = H.usage || [];
    var names = {}, days = {};
    use.forEach(function (u) { names[u.name] = names[u.name] || {}; names[u.name][u.d] = u.n; days[u.d] = 1; });
    var dl = Object.keys(days).sort().reverse().slice(0, 7), nl = Object.keys(names).sort();
    return '<h1>Health</h1><h2>Errors from users\' browsers</h2><p class="muted small">Recorded automatically, grouped by message. No names or typed text are stored.</p>' +
      (errs.length ? '<div class="adm-actions"><button class="btn btn-outline btn-sm" data-action="adm-clear-errors">Clear all</button></div><table class="adm-table"><thead><tr><th>Error</th><th>Times</th><th>Last seen</th><th>Where</th></tr></thead><tbody>' +
        errs.map(function (e) { return '<tr><td>' + h(e.message) + '<div class="fb-meta">' + h(e.src) + '</div></td><td>' + e.n + '</td><td>' + whenT(e.last_ts) + '</td><td>' + h(e.page) + '<div class="fb-meta">' + h(shortUa(e.ua)) + '</div></td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No errors recorded. 🎉</div>') +
      '<h2>Usage (last 7 days)</h2><p class="muted small">Counts of page views by section (v:…), external-apply clicks and applications, new visitors from a link or campaign (lnd:facebook…) and completed profiles by source (conv:c: consultants, conv:e: companies). No cookies, no personal data.</p>' +
      (nl.length ? '<table class="adm-table"><thead><tr><th></th>' + dl.map(function (d) { return '<th>' + h(d.slice(5)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        nl.map(function (n) { return '<tr><td>' + h(n) + '</td>' + dl.map(function (d) { return '<td>' + (names[n][d] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty">No data yet.</div>');
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
    var body = tab === 'reports' ? vReports() : tab === 'people' ? vPeople(rest) : tab === 'roles' ? vRoles() : tab === 'import' ? vImport() : tab === 'catalog' ? vCatalog() : tab === 'lists' ? vLists() : tab === 'announce' ? vAnnounce() : tab === 'feedback' ? vFeedback() : tab === 'health' ? vHealth() : tab === 'community' ? vCommunity() : tab === 'settings' ? vSettings() : tab === 'log' ? vLog() : (tab = 'overview', vOverview());
    return shell(tab, body);
  };


  function catQuick(d, v) {
    var op = d.kind + '_save', args = { id: d.id, name: v.name, short: v.short, family: v.family, hidden: v.hidden };
    if (d.kind === 'module') args.product_id = d.product;
    if (d.kind === 'spec') { args.area_id = v.area_id; args.grp = v.grp; args.roles = v.roles; }
    catSave(op, args, v.hidden ? 'Hidden — people who have it keep it ✓' : 'Visible again ✓');
  }

  /* ---------- actions ---------- */
  var prevClick = APP.onClick, prevSubmit = APP.onSubmit;
  APP.onClick = function (el, e) {
    var a = el.dataset.action, d = el.dataset;
    if (!a || (a !== 'report' && a.indexOf('adm-') !== 0)) return prevClick.apply(this, arguments);
    switch (a) {
      case 'report': reportDialog(d.kind, d.id); break;
      case 'adm-retry': delete A.err[d.key]; APP.render(); break;
      case 'adm-rstatus': A.rstatus = d.s; APP.render(); break;
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
      case 'adm-menu': A.menuOpen = true; APP.render(); break;
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
      case 'adm-clear-errors': act('admin_clear_errors', {}, 'Cleared', ['health']); break;
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

  APP.onSubmit = function (f) {
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
})();
