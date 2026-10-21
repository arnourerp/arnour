/* ============================================================================
   ARNOUR — COMMUNITY VIEWS (feed, question/article detail, ask, share)
   ----------------------------------------------------------------------------
   The network layer of Arnour: open questions with accepted answers, and
   shared articles / field notes.
   Content is public — anyone can read it without an account.
   Asking, answering, upvoting and accepting require sign-in.
   ============================================================================ */

/* ------------------------------ shared card parts ------------------------------ */

APP.commTag = function (item) {
  if (item && !item.productId && item.topic) return '<span class="chip chip-topic">General · ' + APP.h(APP.topicName(item.topic)) + '</span>';
  if (!item || !item.productId) return '';
  const label = item.moduleId
    ? APP.productShort(item.productId) + ' · ' + APP.skillName(item.productId, item.moduleId)
    : APP.productShort(item.productId);
  return '<span class="chip">' + APP.h(label) + '</span>';
};

/* avatar + name + subtitle for a community item's author (consultant or company) */
APP.commAuthorHtml = function (key, anon) {
  if (anon) {
    const mine = !!APP.userKey() && APP.userKey() === key;
    return '<span class="q-who">' + APP.avatarHtml('?') + '<span class="q-who-name"><strong>Anonymous member</strong><small>' + (mine ? 'Posted by you — only you can see this' : 'Identity hidden') + '</small></span></span>';
  }
  const au = APP.communityAuthor(key);
  let name, sub;
  if (!au) { name = 'Former member'; sub = ''; }
  else if (APP.isCoKey(key)) { name = au.name; sub = au.industry || 'Company'; }
  else { name = APP.consultantFullName(au); sub = au.headline || 'Professional'; }
  const href = APP.authorHref(key);
  const inner = '<strong>' + APP.h(name) + '</strong>' + (sub ? '<small>' + APP.h(sub) + '</small>' : '');
  const badge = APP.isCoKey(key) ? '' : APP.repBadgeHtml(key);
  /* message the author: professionals can write to professionals and companies; companies to professionals */
  const ses = APP.db.session, isCo = APP.isCoKey(key);
  const canMsg = !!au && !!ses && key !== APP.userKey() && (ses.role === 'consultant' || !isCo);
  const msg = canMsg ? '<button type="button" class="link-btn q-msg" data-action="start-chat" ' + (isCo ? 'data-eid' : 'data-cid') + '="' + APP.h(key) + '">' + APP.icon('clip', 12) + ' Message</button>' : '';
  return '<span class="q-who">' + APP.avatarHtml(name) +
    '<span class="q-who-name">' + (href ? '<a class="q-who-link" href="' + APP.h(href) + '">' : '') + inner + (href ? '</a>' : '') + (badge ? '<span class="rep-row">' + badge + '</span>' : '') + msg + '</span></span>';
};

APP.commUpvote = function (item, action, dataAttrs) {
  let attrs = ' data-id="' + APP.h(item.id || '') + '"';
  for (const k of Object.keys(dataAttrs || {})) attrs += ' data-' + k + '="' + APP.h(dataAttrs[k]) + '"';
  return '<button type="button" class="upvote' + (APP.isUpvoted(item) ? ' upvoted' : '') + '" data-action="' + action + '"' + attrs + ' title="Upvote">' +
    APP.icon('up', 13) + '<span>' + Number(item.upvotes || 0) + '</span></button>';
};

APP.questionCard = function (q) {
  const ansCount = (q.answers || []).length;
  const solved = (q.answers || []).some(a => a.accepted);
  return '<article class="card q-card" data-card-href="#/community/q/' + q.id + '">' +
    '<div class="q-head">' +
    '<span class="pill">Question</span>' +
    APP.commTag(q) +
    (solved ? '<span class="pill accepted-pill">' + APP.icon('check', 11) + ' Solved</span>' : '') +
    '<span class="grow"></span>' +
    APP.commUpvote(q, 'q-upvote') +
    '</div>' +
    '<h3><a href="#/community/q/' + q.id + '">' + APP.h(q.title) + '</a>' + APP.samplePill(q) + '</h3>' +
    '<p class="q-body clamp2">' + APP.h(q.body) + '</p>' +
    '<div class="q-foot">' +
    APP.commAuthorHtml(q.authorId, q.anonymous) +
    '<span class="q-ans">' + APP.icon('msg', 13) + ansCount + ' answer' + (ansCount === 1 ? '' : 's') + '</span>' +
    '<span class="q-time">' + APP.timeAgo(q.createdTs) + '</span>' +
    '<span class="grow"></span>' +
    '<a class="link" href="#/community/q/' + q.id + '">Discuss →</a>' +
    '</div></article>';
};

APP.articleCard = function (a) {
  const host = a.url ? a.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : '';
  return '<article class="card q-card" data-card-href="#/community/a/' + a.id + '">' +
    '<div class="q-head">' +
    '<span class="pill">Article</span>' +
    APP.commTag(a) +
    '<span class="grow"></span>' +
    APP.commUpvote(a, 'article-upvote') +
    '</div>' +
    '<h3><a href="#/community/a/' + a.id + '">' + APP.h(a.title) + '</a>' + APP.samplePill(a) + '</h3>' +
    (a.url ? '<p class="source-link">' + APP.icon('file', 12) + ' <a href="' + APP.h(a.url) + '" target="_blank" rel="noopener">' + APP.h(host || a.url) + '</a></p>' : '') +
    '<p class="q-body clamp2">' + APP.h(a.body) + '</p>' +
    '<div class="q-foot">' +
    APP.commAuthorHtml(a.authorId) +
    '<span class="q-ans">' + APP.icon('msg', 13) + (a.comments || []).length + ' comment' + ((a.comments || []).length === 1 ? '' : 's') + '</span>' +
    '<span class="q-time">' + APP.timeAgo(a.createdTs) + '</span>' +
    '<span class="grow"></span>' +
    '<a class="link" href="#/community/a/' + a.id + '">Read →</a>' +
    '</div></article>';
};

/* ------------------------------ feed ------------------------------ */

APP.views.community = function () {
  const s = APP.db.session;
  const k = APP.userKey();
  const f = APP.state.communityFilters;
  if (f.type === 'mine' && !s) f.type = 'all';

  const qs = Object.values(APP.db.questions || {});
  const arts = Object.values(APP.db.articles || {});

  const passes = (it) => {
    if (f.product && it.productId !== f.product) return false;
    if (f.module && it.moduleId !== f.module) return false;
    if (f.topic && it.topic !== f.topic) return false;
    if (f.q) {
      const tag = it.productId ? APP.productShort(it.productId) + ' ' + (it.moduleId ? APP.skillName(it.productId, it.moduleId) : '') : APP.topicName(it.topic);
      const hay = (it.title + ' ' + it.body + ' ' + (it.url || '') + ' ' + (it.anonymous ? '' : APP.communityAuthorName(it.authorId)) + ' ' + tag).toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  };

  const lastTs = (x) => {
    let t = x.createdTs || 0;
    for (const a of x.answers || []) t = Math.max(t, a.createdTs || 0);
    for (const c of x.comments || []) t = Math.max(t, c.createdTs || 0);
    return t;
  };

  let items = [];
  const wantQ = f.type === 'all' || f.type === 'q' || f.type === 'mine' || f.type === 'open';
  const wantA = f.type === 'all' || f.type === 'a' || f.type === 'mine';
  if (wantQ) items = items.concat(qs.filter(passes).map(x => ({ kind: 'q', x, last: lastTs(x) })));
  if (wantA) items = items.concat(arts.filter(passes).map(x => ({ kind: 'a', x, last: x.createdTs || 0 })));
  if (f.type === 'mine') items = items.filter(it => it.x.authorId === k);
  const unanswered = qs.filter(q => !(q.answers || []).length).length;
  if (f.type === 'open') items = items.filter(it => it.kind === 'q' && !(it.x.answers || []).length);

  /* "Needs an answer": questions in the viewer's own products come first, then the oldest unanswered. */
  const mineP = (s && s.role === 'consultant' && APP.consultant(s.consultantId)) ? (APP.consultant(s.consultantId).skills || []).map(x => x.productId) : [];
  items.sort((a, b) => {
    if (f.type === 'open') {
      const ra = mineP.indexOf(a.x.productId) !== -1 ? 1 : 0, rb = mineP.indexOf(b.x.productId) !== -1 ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return (a.x.createdTs || 0) - (b.x.createdTs || 0);
    }
    if (f.sort === 'top') return (b.x.upvotes || 0) - (a.x.upvotes || 0);
    if (f.sort === 'newest') return (b.x.createdTs || 0) - (a.x.createdTs || 0);
    return b.last - a.last; /* active */
  });

  const head =
    '<div class="page-head comm-head">' +
    '<div class="grow"><h1 class="page-h">Community</h1><p class="muted">Where SAP people ask, answer and share — in the exact language of the ecosystem.</p></div>' +
    '<div class="btn-row">' +
    (s
      ? '<button class="btn btn-primary" data-action="go" data-href="#/community/ask">' + APP.icon('plus', 15) + ' Ask a question</button>' +
        '<button class="btn btn-outline" data-action="go" data-href="#/community/share">' + APP.icon('file', 15) + ' Share an article</button>'
      : '<a class="btn btn-primary" href="#/register">Join to participate</a>') +
    '</div></div>';

  let personalize = '';
  if (s && s.role === 'consultant' && k) {
    const cs = APP.communityStats(k);
    const bits = [];
    if (cs.questions) bits.push(cs.questions + ' question' + (cs.questions > 1 ? 's' : ''));
    if (cs.answers) bits.push(cs.answers + ' answer' + (cs.answers > 1 ? 's' : ''));
    if (cs.articles) bits.push(cs.articles + ' article' + (cs.articles > 1 ? 's' : ''));
    const rp = APP.reputation(k);
    const pct = rp.next ? Math.min(100, Math.round(((rp.points - APP.REP_LEVELS[rp.level].min) / (rp.next - APP.REP_LEVELS[rp.level].min)) * 100)) : 100;
    personalize = '<div class="card rep-card"><div class="rep-top"><strong>' + APP.icon('spark', 14) + ' Your reputation</strong> ' +
      '<span class="rep rep-' + rp.level + '">' + APP.h(rp.levelName) + '</span><span class="grow"></span><span class="muted small">' + rp.points + ' pts</span></div>' +
      '<div class="rep-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Progress to the next level"><span style="width:' + pct + '%"></span></div>' +
      '<p class="muted small">' + (rp.next ? rp.toNext + ' more point' + (rp.toNext === 1 ? '' : 's') + ' to ' + APP.h(rp.nextName) + '. ' : 'You are at the top level. ') +
      (bits.length ? APP.h(bits.join(' · ')) + '. ' : '') + 'An accepted answer is worth 15 points — <a class="link" href="#/community" data-action="comm-type" data-value="open">find questions that need an answer</a>.</p></div>';
  }

  const typeDefs = [['all', 'Everything'], ['q', 'Questions'], ['open', 'Needs an answer' + (unanswered ? ' (' + unanswered + ')' : '')], ['a', 'Articles']];
  if (s) typeDefs.push(['mine', 'My activity']);
  const typeChips = typeDefs.map(t =>
    '<button type="button" class="chip' + (f.type === t[0] ? ' chip-on' : '') + '" data-action="comm-type" data-value="' + t[0] + '">' + t[1] + '</button>'
  ).join('');

  const filterCard =
    '<div class="card filter-bar">' +
    '<div class="chip-wrap" style="margin-bottom:10px">' + typeChips + '</div>' +
    '<form data-form="community-filters" class="filter-inline">' +
    '<select name="product" class="input sm"><option value="">Any product</option>' + APP.productOptions(f.product) + '</select>' +
    '<select name="module" class="input sm">' + APP.moduleOptions(f.product || null, f.module) + '</select>' +
    '<select name="topic" class="input sm">' + APP.topicOptions(f.topic, 'Any general topic') + '</select>' +
    '<select name="sort" class="input sm">' +
    '<option value="active"' + (f.sort === 'active' ? ' selected' : '') + '>Most active</option>' +
    '<option value="top"' + (f.sort === 'top' ? ' selected' : '') + '>Top upvotes</option>' +
    '<option value="newest"' + (f.sort === 'newest' ? ' selected' : '') + '>Newest</option></select>' +
    '<input name="q" class="input sm grow" value="' + APP.h(f.q) + '" placeholder="Search questions & articles…">' +
    '<button class="btn btn-primary btn-sm" type="submit">Filter</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-action="comm-reset">Reset</button>' +
    '</form></div>';

  const list = items.map(it => it.kind === 'q' ? APP.questionCard(it.x) : APP.articleCard(it.x)).join('');

  return '<div class="narrow">' +
    head +
    APP.commTabsHtml('disc') +
    personalize +
    filterCard +
    '<p class="muted small results-count">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</p>' +
    (list || (f.type === 'open' ? '<div class="card empty">Every question has an answer right now. Nice — check back soon, or <a class="link" href="#/community/ask">ask one of your own</a>.</div>' : '<div class="card empty">Nothing matches those filters yet — clear a filter, or be the first to ask about this topic.</div>')) +
    '</div>';
};

/* ------------------------------ question detail ------------------------------ */

APP.views['community-q'] = function (ctx) {
  const q = APP.question(ctx.p[0]);
  if (!q) return '<div class="empty">Question not found.</div>';
  const s = APP.db.session;
  const k = APP.userKey();
  const solved = (q.answers || []).some(a => a.accepted);

  const main =
    '<article class="card q-card">' +
    '<div class="q-head">' +
    '<span class="pill">Question</span>' +
    APP.commTag(q) +
    (solved ? '<span class="pill accepted-pill">' + APP.icon('check', 11) + ' Solved</span>' : '') +
    '<span class="grow"></span>' +
    APP.commUpvote(q, 'q-upvote') +
    '</div>' +
    '<h2>' + APP.h(q.title) + APP.samplePill(q) + '</h2>' +
    '<p class="q-body">' + APP.h(q.body) + '</p>' +
    '<div class="q-foot">' +
    APP.commAuthorHtml(q.authorId, q.anonymous) +
    '<span class="grow"></span>' +
    '<span class="q-time">Asked ' + APP.timeAgo(q.createdTs) + '</span>' +
    (APP.modTools ? APP.modTools('question', q.id, q.mine) : '') +
    '</div></article>';

  const share = APP.shareHtml({
    title: q.title,
    text: 'SAP question: ' + q.title + ' — see the full discussion on Arnour.',
    tags: '#SAP #SAPCommunity',
    url: APP.shareUrl('#/community/q/' + q.id)
  });

  const answers = (q.answers || []).slice().sort((a, b) => {
    if (!!b.accepted !== !!a.accepted) return b.accepted ? 1 : -1;
    if ((b.upvotes || 0) !== (a.upvotes || 0)) return b.upvotes - a.upvotes;
    return (b.createdTs || 0) - (a.createdTs || 0);
  });

  const answersHtml = answers.map(a => {
    const isMine = !!k && k === a.authorId;
    return '<div class="a-item' + (a.accepted ? ' accepted' : '') + '">' +
      '<div class="a-head">' +
      APP.commAuthorHtml(a.authorId) +
      (a.accepted ? '<span class="pill accepted-pill">' + APP.icon('check', 11) + ' Accepted</span>' : '') +
      (isMine ? '<span class="pill">You</span>' : '') +
      '<span class="grow"></span>' +
      APP.commUpvote(a, 'answer-upvote', { qid: q.id, aid: a.id }) +
      '</div>' +
      '<p class="a-body">' + APP.h(a.body) + '</p>' +
      '<div class="a-actions"><span>' + APP.timeAgo(a.createdTs) + '</span>' + (APP.modTools ? APP.modTools('answer', a.id, a.mine) : '') +
      (k === q.authorId ? '<button class="link" data-action="accept-answer" data-qid="' + q.id + '" data-aid="' + a.id + '">' + (a.accepted ? 'Unmark accepted' : '✓ Mark as accepted') + '</button>' : '') +
      '</div></div>';
  }).join('');

  const answersSection =
    '<div class="feed-head mt16"><h3>' + (answers.length ? answers.length + ' answer' + (answers.length === 1 ? '' : 's') : 'No answers yet') + '</h3></div>' +
    answersHtml +
    (s
      ? '<div class="card mt16">' +
        '<span class="label">Add your answer</span>' +
        '<form data-form="community-answer" data-qid="' + q.id + '">' +
        '<textarea name="q" class="input" rows="3" placeholder="Share what you\'ve seen in practice — the specific detail is the value.">' + APP.h(((APP.commAnsDraft[q.id]) || {}).q || '') + '</textarea>' +
        '<div class="btn-row"><button type="submit" class="btn btn-primary btn-sm">' + APP.icon('check', 14) + ' Post answer</button></div>' +
        '</form></div>'
      : '<div class="card empty mt16">' + APP.icon('users', 30) +
        '<p style="margin-bottom:4px"><strong>Join the discussion.</strong></p>' +
        '<p class="muted small" style="margin-bottom:10px">Sign in or create an account to answer this question.</p>' +
        '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary btn-sm" href="#/login">Sign in</a><a class="btn btn-outline btn-sm" href="#/register">Join Arnour</a></div>' +
        '</div>');

  /* job funnel — open roles requiring exactly this product + module */
  const jobs = Object.values(APP.db.jobs)
    .filter(j => j.status === 'open' && (j.requires || []).some(r => r.productId === q.productId && r.moduleId === q.moduleId))
    .sort((a, b) => b.postedTs - a.postedTs)
    .slice(0, 3);

  let funnel = '';
  if (jobs.length) {
    const skillLabel = APP.productShort(q.productId) + (q.moduleId ? ' · ' + APP.skillName(q.productId, q.moduleId) : '');
    const fhead = '<div class="feed-head mt16"><h3>Open roles for ' + APP.h(skillLabel) + '</h3></div>';
    if (s && s.role === 'consultant') {
      funnel = fhead + jobs.map(j => {
        const co = APP.company(j.companyId);
        return '<button class="app-item" data-action="go-jobs-for-skill" data-product="' + q.productId + '" data-module="' + q.moduleId + '">' +
          (co ? APP.avatarHtml(co.name) : '') +
          '<span class="grow"><strong>' + APP.h(j.title) + '</strong><small class="muted">' + APP.h(co ? co.name : '') + ' · ' + APP.h(APP.locText(j)) + ' · ' + APP.h(APP.fmtRange(j)) + '</small></span>' +
          '<span class="muted small">View →</span></button>';
      }).join('') +
      '<button class="link" data-action="go-jobs-for-skill" data-product="' + q.productId + '" data-module="' + q.moduleId + '">See all matching roles →</button>';
    } else if (s && s.role === 'employer') {
      funnel = fhead +
        '<div class="card"><p class="muted small">The community keeps asking about ' + APP.h(skillLabel) + ' — and companies are hiring for it right now. Get this expertise to see you first.</p>' +
        '<button class="btn btn-primary btn-sm" data-action="go" data-href="#/e/jobs/new">' + APP.icon('plus', 14) + ' Post a role for this skill</button></div>';
    } else {
      funnel = fhead +
        '<div class="card"><p class="muted small">Companies are actively hiring for ' + APP.h(skillLabel) + '. Create a free account to see the roles — or ask your question first.</p>' +
        '<a class="btn btn-primary btn-sm" href="#/register">Join Arnour free</a></div>';
    }
  }

  return '<div class="narrow">' +
    APP.crumbHtml('#/community', 'Community') +
    main +
    share +
    answersSection +
    funnel +
    '</div>';
};

/* ------------------------------ article detail ------------------------------ */

APP.commentsHtml = function (a) {
  const k = APP.userKey();
  const cs = a.comments || [];
  const list = cs.map(c =>
    '<div class="a-item"><div class="a-head">' + APP.commAuthorHtml(c.authorId) + '<span class="grow"></span><span class="muted small">' + APP.timeAgo(c.createdTs) + '</span></div>' +
    '<p class="a-body">' + APP.h(c.body) + '</p>' +
    (APP.modTools ? APP.modTools('comment', c.id, c.mine, true) : '') +
    (k && k === c.authorId ? '<div class="a-actions"><button class="link" type="button" data-action="comment-delete" data-aid="' + a.id + '" data-cid="' + c.id + '">Delete</button></div>' : '') +
    '</div>').join('');
  const draft = ((APP.commCmtDraft || {})[a.id] || {}).q || '';
  const form = APP.db.session
    ? '<form data-form="community-comment" data-aid="' + a.id + '"><span class="label">Add a comment</span>' +
      '<textarea name="q" class="input" rows="3" placeholder="Share your view, a correction, or a related experience…">' + APP.h(draft) + '</textarea>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary btn-sm">' + APP.icon('check', 14) + ' Post comment</button></div></form>'
    : '<p class="muted small"><a class="link" href="#/login">Sign in</a> or <a class="link" href="#/register">join free</a> to comment.</p>';
  return '<div class="feed-head mt16"><h3>' + (cs.length ? cs.length + ' comment' + (cs.length === 1 ? '' : 's') : 'No comments yet') + '</h3></div>' + list + '<div class="card mt16">' + form + '</div>';
};

APP.views['community-a'] = function (ctx) {
  const a = APP.article(ctx.p[0]);
  if (!a) return '<div class="empty">Article not found.</div>';
  const host = a.url ? a.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : '';

  const related = !a.productId ? [] : Object.values(APP.db.questions || {})
    .filter(q => q.productId === a.productId)
    .sort((x, y) => (y.upvotes || 0) - (x.upvotes || 0))
    .slice(0, 3);

  const share = APP.shareHtml({
    title: a.title,
    text: 'SAP resource: ' + a.title + ' — read it on Arnour, the SAP talent network.',
    tags: '#SAP #SAPCommunity',
    url: APP.shareUrl('#/community/a/' + a.id)
  });

  return '<div class="narrow">' +
    APP.crumbHtml('#/community', 'Community') +
    '<article class="card q-card">' +
    '<div class="q-head">' +
    '<span class="pill">Article</span>' +
    APP.commTag(a) +
    '<span class="grow"></span>' +
    APP.commUpvote(a, 'article-upvote') +
    '</div>' +
    '<h2>' + APP.h(a.title) + APP.samplePill(a) + '</h2>' +
    (a.url ? '<p class="source-link">' + APP.icon('file', 12) + ' <a href="' + APP.h(a.url) + '" target="_blank" rel="noopener">' + APP.h(host || a.url) + '</a></p>' : '') +
    '<p class="q-body">' + APP.h(a.body) + '</p>' +
    '<div class="q-foot">' +
    APP.commAuthorHtml(a.authorId) +
    '<span class="grow"></span>' +
    '<span class="q-time">Shared ' + APP.timeAgo(a.createdTs) + '</span>' +
    (APP.modTools ? APP.modTools('article', a.id, a.mine) : '') +
    (a.url ? '<a class="btn btn-outline btn-sm" href="' + APP.h(a.url) + '" target="_blank" rel="noopener">' + APP.icon('file', 14) + ' Read the source</a>' : '') +
    '</div></article>' +
    share +
    APP.commentsHtml(a) +
    (related.length ? '<div class="feed-head mt16"><h3>Related questions on ' + APP.h(APP.productShort(a.productId)) + '</h3></div>' + related.map(q => APP.questionCard(q)).join('') : '') +
    '</div>';
};

/* ------------------------------ ask / share ------------------------------ */

APP.commSignCta = function (title, sub) {
  return '<div class="narrow">' +
    APP.crumbHtml('#/community', 'Community') +
    '<div class="card empty">' +
    APP.icon('users', 40) +
    '<p style="margin-bottom:4px;font-size:16px;font-weight:700">' + APP.h(title) + '</p>' +
    '<p class="muted small" style="margin-bottom:12px">' + APP.h(sub) + '</p>' +
    '<div class="btn-row" style="justify-content:center;margin-top:0">' +
    '<a class="btn btn-primary" href="#/login">Sign in</a>' +
    '<a class="btn btn-outline" href="#/register">Join Arnour free</a>' +
    '</div></div></div>';
};

APP.views['community-ask'] = function () {
  const s = APP.db.session;
  if (!s) {
    return APP.commSignCta('Ask a question', 'Anyone can read the community. Sign in (or create a free account) to post your own question and get answers from the network.');
  }
  const d = APP.commAskDraft || { title: '', body: '', product: '', module: '' };
  return '<div class="narrow">' +
    APP.crumbHtml('#/community', 'Community') +
    '<div class="page-head"><div class="grow"><h2>Ask a question</h2><p class="muted">Be specific — the context is what makes an answer useful.</p></div></div>' +
    '<div class="card"><div class="card-h">Post your question</div>' +
    '<form data-form="community-ask">' +
    '<label class="field"><span class="label">Title *</span><input name="title" class="input" value="' + APP.h(d.title) + '" placeholder="e.g. EWM embedded vs decentralized for three batch warehouses — what did you pick?"></label>' +
    '<label class="field"><span class="label">Describe the situation *</span><textarea name="body" class="input" rows="5" placeholder="Context, constraints, what you\'ve tried, and what outcome you\'d accept…">' + APP.h(d.body) + '</textarea></label>' +
    '<div class="form-grid">' +
    '<label class="field"><span class="label">SAP product</span><select name="product" class="input"><option value="">Not about one product — general question</option>' + APP.productOptions(d.product) + '</select></label>' +
    '<label class="field"><span class="label">Module (optional)</span><select name="module" class="input">' + APP.moduleOptions(d.product || null, d.module) + '</select></label>' +
    '</div>' +
    '<label class="field"><span class="label">General topic <span class="muted">(required when no product is chosen)</span></span><select name="topic" class="input">' + APP.topicOptions(d.topic) + '</select></label>' +
    '<p class="field-hint">' + APP.icon('spark', 14) + ' Pick a product (and a module if you can) so the people who know that corner of SAP see it. For questions like "we are thinking of adopting SAP" or "how do I find a partner", leave the product empty and choose a topic.</p>' +
    '<label class="check-row"><input type="checkbox" name="anonymous"' + (d.anonymous ? ' checked' : '') + '> <span><strong>Post anonymously</strong> — your name and profile are hidden from other members. Answers and notifications still reach you.</span></label>' +
    '<div class="btn-row"><span class="grow"></span><button type="submit" class="btn btn-primary">' + APP.icon('check', 15) + ' Post question</button></div>' +
    '</form></div></div>';
};

APP.views['community-share'] = function () {
  const s = APP.db.session;
  if (!s) {
    return APP.commSignCta('Share an article', 'Anyone can read the community. Sign in (or create a free account) to share an article or field note with your own take.');
  }
  const d = APP.commShareDraft || { title: '', url: '', body: '', product: '', module: '' };
  return '<div class="narrow">' +
    APP.crumbHtml('#/community', 'Community') +
    '<div class="page-head"><div class="grow"><h2>Share an article</h2><p class="muted">A link, a short take, and the product it belongs to.</p></div></div>' +
    '<div class="card"><div class="card-h">Share with the community</div>' +
    '<form data-form="community-share">' +
    '<label class="field"><span class="label">Title *</span><input name="title" class="input" value="' + APP.h(d.title) + '" placeholder="e.g. The six things you can\'t do in S/4HANA Public Cloud (and the workarounds)"></label>' +
    '<label class="field"><span class="label">Article link *</span><input name="url" type="url" class="input" value="' + APP.h(d.url) + '" placeholder="https://…"></label>' +
    '<label class="field"><span class="label">Your take (optional)</span><textarea name="body" class="input" rows="4" placeholder="Why is this worth reading? What would you tell a client or a junior about it?">' + APP.h(d.body) + '</textarea></label>' +
    '<div class="form-grid">' +
    '<label class="field"><span class="label">SAP product</span><select name="product" class="input"><option value="">Not about one product — general</option>' + APP.productOptions(d.product) + '</select></label>' +
    '<label class="field"><span class="label">Module (optional)</span><select name="module" class="input">' + APP.moduleOptions(d.product || null, d.module) + '</select></label>' +
    '</div>' +
    '<label class="field"><span class="label">General topic <span class="muted">(required when no product is chosen)</span></span><select name="topic" class="input">' + APP.topicOptions(d.topic) + '</select></label>' +
    '<div class="btn-row"><span class="grow"></span><button type="submit" class="btn btn-primary">' + APP.icon('check', 15) + ' Share</button></div>' +
    '</form></div></div>';
};

/* ------------------------------ People: professionals find each other ------------------------------
   Private profiles are listed anonymously and can only be found by their skills, never by name.
   No match scores, rates, availability or invitations here: those are company tools. */
APP.peopleFilterDefaults = function () { return { q: '', product: '', module: '', roleType: '', level: '', country: '', specialty: '', industry: '', language: '', sort: 'common' }; };
APP.commTabsHtml = function (active) {
  const s = APP.db.session;
  if (!s || s.role !== 'consultant') return '';
  return '<div class="seg-tabs comm-tabs" role="tablist" aria-label="Community">' +
    '<a role="tab" aria-selected="' + (active === 'disc') + '" class="seg-tab' + (active === 'disc' ? ' on' : '') + '" href="#/community">Discussions</a>' +
    '<a role="tab" aria-selected="' + (active === 'people') + '" class="seg-tab' + (active === 'people' ? ' on' : '') + '" href="#/community/people">' + APP.icon('users', 14) + ' People</a></div>';
};
APP.peopleList = function (me, f) {
  const myPairs = {}, myProds = {};
  (me.skills || []).forEach(k => { myPairs[k.productId + '|' + k.moduleId] = 1; myProds[k.productId] = 1; });
  const out = [];
  Object.values(APP.db.consultants || {}).forEach(c => {
    if (!c || c.id === me.id || c.suspended) return;
    const see = APP.canSeePerson(c);
    const a = see ? c : APP.cv(c, true);
    const sk = c.skills || [];
    if (f.product && !sk.some(k => k.productId === f.product)) return;
    if (f.module && !sk.some(k => k.productId === (f.product || k.productId) && k.moduleId === f.module)) return;
    if (f.roleType && APP.rtList(c).indexOf(f.roleType) === -1) return;
    if (f.level && c.level !== f.level) return;
    if (f.country && c.country !== f.country) return;
    if (f.specialty && (c.specialties || []).indexOf(f.specialty) === -1) return;
    if (f.industry && (c.industries || []).indexOf(f.industry) === -1) return;
    if (f.language && (c.languages || []).indexOf(f.language) === -1) return;
    if (f.q) {
      const hay = [see ? c.firstName + ' ' + c.lastName : '', see ? c.headline : a.headline, a._title || '',
        sk.map(k => APP.productShort(k.productId) + ' ' + APP.skillName(k.productId, k.moduleId)).join(' '),
        (c.specialties || []).map(id => APP.specialtyName(id)).join(' '), (c.otherSkills || []).join(' '), (c.industries || []).join(' ')].join(' ').toLowerCase();
      const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every(w => hay.indexOf(w) !== -1)) return;
    }
    let common = 0;
    sk.forEach(k => { if (myPairs[k.productId + '|' + k.moduleId]) common += 2; else if (myProds[k.productId]) common += 0.5; });
    out.push({ c: c, a: a, see: see, common: common, shared: sk.filter(k => myPairs[k.productId + '|' + k.moduleId]).length, rep: APP.reputation(c.id).points || 0 });
  });
  out.sort(f.sort === 'active' ? (x, y) => (y.rep - x.rep) || (y.common - x.common) : (x, y) => (y.common - x.common) || (y.rep - x.rep));
  return out;
};
APP.personCardHtml = function (r) {
  const c = r.c, a = r.a, E = APP.h;
  const name = r.see ? c.firstName + ' ' + c.lastName : APP.anonLabel(c);
  const top = (c.skills || []).slice().sort((x, y) => (Number(y.projects) || 0) - (Number(x.projects) || 0)).slice(0, 4);
  const rp = APP.reputation(c.id);
  const country = APP.countryName(c.country);
  return '<div class="card person-card" data-card-href="#/talent/' + c.id + '">' +
    APP.avatarHtml(name, '', !r.see) +
    '<div class="grow pc-main"><div class="pc-name"><a class="link-strong" href="#/talent/' + c.id + '">' + E(name) + '</a>' +
    (!r.see ? ' <span class="pill muted-pill" title="Name hidden until they share it">' + APP.icon('lock', 11) + ' Private</span>' : '') +
    (rp.level ? ' <span class="rep rep-' + rp.level + '">' + E(rp.levelName) + '</span>' : '') + '</div>' +
    '<p class="muted small">' + E([a.headline, country].filter(Boolean).join(' · ')) + '</p>' +
    '<div class="chip-wrap pc-skills">' + top.map(k => '<span class="chip">' + E(APP.productShort(k.productId) + ' · ' + APP.skillName(k.productId, k.moduleId)) + '</span>').join('') + '</div>' +
    (r.shared ? '<p class="small pc-common">' + APP.icon('check', 12) + ' ' + r.shared + ' module' + (r.shared > 1 ? 's' : '') + ' in common with you</p>' : '') +
    '</div>' +
    '<div class="pc-acts"><a class="btn btn-outline btn-sm" href="#/talent/' + c.id + '">View profile</a>' +
    '<button type="button" class="btn btn-primary btn-sm" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 14) + ' Message</button></div></div>';
};
APP.views['community-people'] = function () {
  const s = APP.db.session;
  if (!s || s.role !== 'consultant') {
    return '<div class="narrow"><div class="card empty">' + (s ? 'People search is for professionals. Companies can find professionals in <a class="link" href="#/e/talent">Talent</a>.' : '<a class="link" href="#/login">Sign in</a> as a professional to find and connect with other SAP professionals.') + '</div></div>';
  }
  const me = APP.consultant(s.consultantId);
  if (!me) return '<div class="empty">Profile not found.</div>';
  const f = APP.state.peopleFilters = Object.assign(APP.peopleFilterDefaults(), APP.state.peopleFilters || {});
  const all = APP.peopleList(me, f);
  const shown = APP.state.peopleShow || 30;
  const flatSpecs = [];
  (APP.specialties || []).forEach(sp => (sp.groups || []).forEach(g => (g.items || []).forEach(it => flatSpecs.push([it.id, it.name]))));
  const sel = (name, any, opts, v) => '<select name="' + name + '" class="input sm" aria-label="' + any + '"><option value="">' + any + '</option>' + APP.opt(opts, v) + '</select>';
  const filters = '<div class="card filter-bar"><form data-form="people-filters" class="people-form">' +
    '<div class="pf-search"><input name="q" class="input" value="' + APP.h(f.q) + '" placeholder="Search names, titles, modules, specialties…" aria-label="Search people">' +
    '<button class="btn btn-primary" type="submit">' + APP.icon('search', 15) + ' Search</button></div><div class="pf-grid">' +
    '<select name="product" class="input sm" aria-label="Product"><option value="">Any product</option>' + APP.productOptions(f.product) + '</select>' +
    '<select name="module" class="input sm" aria-label="Module">' + APP.moduleOptions(f.product || null, f.module).replace('>Module…<', '>Any module<') + '</select>' +
    sel('roleType', 'Any role type', APP.roleTypes.map(r => [r.id, r.name]), f.roleType) +
    sel('level', 'Any level', APP.levels.map(l => [l, l]), f.level) +
    sel('country', 'Any country', APP.countries.map(c => [c.id, c.name]), f.country) +
    sel('specialty', 'Any specialty', flatSpecs, f.specialty) +
    sel('industry', 'Any industry', APP.industries.map(i => [i, i]), f.industry) +
    sel('language', 'Any language', APP.languages.map(l => [l, l]), f.language) +
    '</div><div class="pf-foot"><label class="pf-sort"><span class="muted small">Sort by</span><select name="sort" class="input sm" aria-label="Sort"><option value="common"' + (f.sort !== 'active' ? ' selected' : '') + '>Most in common with you</option><option value="active"' + (f.sort === 'active' ? ' selected' : '') + '>Most active in the community</option></select></label><button type="button" class="btn btn-ghost btn-sm" data-action="people-reset">Reset filters</button></div>' +
    '</form></div>';
  const list = all.slice(0, shown).map(APP.personCardHtml).join('');
  return '<div class="narrow">' +
    '<div class="page-head comm-head"><div class="grow"><h1 class="page-h">Community</h1><p class="muted">Find SAP professionals with the skills you need, and message them directly.</p></div></div>' +
    APP.commTabsHtml('people') + filters +
    '<p class="muted small results-count">' + all.length + ' professional' + (all.length === 1 ? '' : 's') + '</p>' +
    (list || '<div class="card empty">No one matches those filters yet — try fewer filters.</div>') +
    (all.length > shown ? '<div class="btn-row center"><button type="button" class="btn btn-outline" data-action="people-more">Show more</button></div>' : '') +
    '<p class="muted small mt8">' + APP.icon('lock', 12) + ' Private profiles appear without names and can only be found by their skills.</p>' +
    '</div>';
};
