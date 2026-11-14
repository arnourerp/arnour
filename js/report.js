/* Arnour: the Report button and dialog that every signed-in person can use (live mode only).
   The admin area itself (js/admin.js) is loaded only for an administrator; it reuses the lists below. */
(function () {
  'use strict';
  var B = APP.backend, h = APP.h;
  if (!B) return;

  var REASONS = [
    ['spam', 'Spam or advertising'], ['abuse', 'Harassment or abuse'], ['fake', 'Fake or misleading'],
    ['inappropriate', 'Inappropriate content'], ['privacy', 'Shares private information'], ['other', 'Something else']
  ];
  var REASON_LABEL = {}; REASONS.forEach(function (r) { REASON_LABEL[r[0]] = r[1]; });
  var KIND_LABEL = { question: 'Question', answer: 'Answer', article: 'Article', comment: 'Comment', profile: 'Profile', company: 'Company', job: 'Role', conversation: 'Conversation' };
  var REMOVABLE = ['question', 'answer', 'article', 'comment', 'job'];

  APP.reportMeta = { REASONS: REASONS, REASON_LABEL: REASON_LABEL, KIND_LABEL: KIND_LABEL, REMOVABLE: REMOVABLE };

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
      if (kind === 'profile' || kind === 'company') inner += '<button type="button" class="link-btn" data-action="adm-message" data-id="' + h(id) + '">Message as Arnour team</button> <a class="link-btn" href="#/admin/people/' + h(id) + '">Manage (admin)</a>';
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

  var prevClick = APP.onClick;
  APP.onClick = function (el, e) {
    var d = (el && el.dataset) || {};
    if (d.action === 'report') { reportDialog(d.kind, d.id); return; }
    return prevClick.apply(this, arguments);
  };
})();
