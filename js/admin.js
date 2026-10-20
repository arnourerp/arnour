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
  var TABS = [['overview', 'Overview'], ['reports', 'Reports'], ['people', 'People'], ['roles', 'Roles'], ['import', 'Import jobs'], ['feedback', 'Feedback'], ['health', 'Health'], ['community', 'Community'], ['settings', 'Settings & log']];

  function shell(tab, inner) {
    var open = A.data.overview ? A.data.overview.openReports : 0;
    return '<div class="adm"><header class="adm-top"><a class="brand-logo" href="#/" aria-label="Arnour home">A</a><strong>Arnour admin</strong><span class="grow"></span>' +
      '<a class="btn btn-ghost btn-sm" href="#/">← Back to site</a></header>' +
      '<nav class="adm-tabs" aria-label="Admin sections">' + TABS.map(function (t) {
        return '<a class="adm-tab' + (t[0] === tab ? ' on' : '') + '" href="#/admin/' + t[0] + '">' + t[1] + (t[0] === 'reports' && open ? ' <em>' + open + '</em>' : '') + (t[0] === 'feedback' && A.data.health && A.data.health.openFeedback ? ' <em>' + A.data.health.openFeedback + '</em>' : '') + '</a>';
      }).join('') + '</nav><main class="adm-main">' + inner + '</main></div>';
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
      out.push({ job: j, warn: w });
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
          (r.warn.length ? '<ul class="small">' + r.warn.map(function (w) { return '<li>' + h(w) + '</li>'; }).join('') + '</ul>' : '') + '</article>';
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
      '<h2>Usage (last 7 days)</h2><p class="muted small">Counts of page views by section (v:…), external-apply clicks and applications. No cookies, no personal data.</p>' +
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
    var w = need('settings', 'admin_settings') || need('log', 'admin_log_list', { p_limit: 100 }); if (w) return w;
    var s = A.data.settings, log = A.data.log;
    return '<h1>Settings & activity log</h1><article class="adm-card"><div class="adm-row"><strong>Sample content</strong> <span class="pill ' + (s.hideSamples ? 'muted-pill' : '') + '">' + (s.hideSamples ? 'Hidden' : 'Showing') + '</span></div>' +
      '<p class="muted small">Sample professionals, companies, roles and community posts are labelled “Sample”. Hide them all once you have enough real members.</p>' +
      '<div class="adm-actions"><button class="btn btn-outline btn-sm" data-action="adm-samples" data-on="' + (s.hideSamples ? '0' : '1') + '">' + (s.hideSamples ? 'Show sample content' : 'Hide sample content') + '</button></div></article>' +
      '<h2>Activity log</h2>' + (log.length ? '<div class="adm-log">' + log.map(function (l) {
        return '<p><span class="muted small">' + h(new Date(l.ts).toLocaleString('en-GB')) + '</span> <strong>' + h(l.action) + '</strong> ' + h(l.target || '') + (l.detail ? ' <span class="muted">— ' + h(l.detail) + '</span>' : '') + '</p>';
      }).join('') + '</div>' : '<div class="empty">No actions yet.</div>');
  }

  APP.views.admin = function (ctx) {
    document.title = 'Admin — Arnour';
    if (!B.isAdmin) return '<div class="empty">Not available.</div>';
    var tab = (ctx && ctx.p && ctx.p[0]) || 'overview', rest = ctx && ctx.p && ctx.p[1];
    if (!A.data.overview && tab !== 'overview') load('overview', 'admin_overview');
    if (A.data.health === undefined && tab !== 'health' && !A.err.health) load('health', 'admin_health');
    var body = tab === 'reports' ? vReports() : tab === 'people' ? vPeople(rest) : tab === 'roles' ? vRoles() : tab === 'import' ? vImport() : tab === 'feedback' ? vFeedback() : tab === 'health' ? vHealth() : tab === 'community' ? vCommunity() : tab === 'settings' ? vSettings() : (tab = 'overview', vOverview());
    return shell(tab, body);
  };

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
      case 'adm-fstatus': A.fstatus = d.s; APP.render(); break;
      case 'adm-fb-set': act('admin_feedback_set', { p_id: Number(d.id), p_status: d.s, p_note: '' }, d.s === 'done' ? 'Marked done ✓' : 'Reopened', ['feedback:open', 'feedback:done', 'health']); break;
      case 'adm-fb-shot':
        B.sb.storage.from('feedback').createSignedUrl(d.p, 300).then(function (r) { if (r.error || !r.data) APP.toast('Could not open the screenshot'); else window.open(r.data.signedUrl, '_blank', 'noopener'); });
        break;
      case 'adm-clear-errors': act('admin_clear_errors', {}, 'Cleared', ['health']); break;
      case 'adm-samples': act('admin_set_hide_samples', { p_on: d.on === '1' }, d.on === '1' ? 'Sample content hidden' : 'Sample content showing', ['settings'].concat(allKeys())); break;
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
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'adm-del') window.__admDel = e.target.value.trim(); });

  APP.onSubmit = function (f) {
    if (f.dataset.form === 'adm-search') {
      var q = String(new FormData(f).get('q') || '').trim();
      A.q[f.dataset.tab] = q; APP.render(); return;
    }
    return prevSubmit.apply(this, arguments);
  };
})();
