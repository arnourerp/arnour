/* ============================================================================
   ARNOUR — CONSULTANT VIEWS (dashboard, profile, jobs, saved, inbox)
   ============================================================================ */

/* ------------------------------ dashboard ------------------------------ */

APP.views['c-dash'] = function () {
  const c = APP.consultant(APP.db.session.consultantId);
  if (!c) return '<div class="empty">Profile not found.</div>';
  const name = APP.consultantFullName(c);

  const complete = [
    !!c.firstName, !!c.headline, !!c.cv, (c.skills || []).length >= 3,
    !!c.summary, (c.languages || []).length > 0, !!c.dailyRate
  ].filter(Boolean).length;
  const strength = Math.round((complete / 7) * 100);

  const topSkills = (c.skills || []).slice(0, 5).map(k => APP.skillLabel(k));

  const isInv = (m) => (m.job.invited || []).indexOf(c.id) !== -1;
  const matches = APP.jobsForConsultant(c).filter(m => m.score >= 40 || isInv(m)).sort((a, b) => (isInv(b) - isInv(a)) || (b.score - a.score)).slice(0, 5);
  const feed = matches.length
    ? matches.map(m => APP.jobCard(m.job, m.score, APP.jobActionButtons(m.job))).join('')
    : '<div class="card empty">No roles reach a 40% match yet. Add more SAP skills and projects to your profile, or <a class="link" href="#/c/jobs">browse all open roles</a>.</div>';

  const feedCards = matches.map(m => APP.jobCard(m.job, m.score, APP.jobActionButtons(m.job)));
  const cblock = APP.communityBlockHtml('consultant');
  const feedWithBlock = feedCards.length ? feedCards.slice(0, 2).join('') + cblock + feedCards.slice(2).join('') : feed + cblock;

  const recentNotifs = (APP.db.notifications[c.id] || []).slice(0, 3).map(n => {
    const inner =
      '<span class="notif-ico n-' + n.type + '">' + APP.icon(n.type === 'msg' ? 'msg' : n.type === 'comm' ? 'spark' : 'briefcase') + '</span>' +
      '<div class="notif-tt"><p>' + APP.h(n.text) + '</p><small>' + APP.timeAgo(n.ts) + '</small></div>' +
      (n.read ? '' : '<span class="dot"></span>');
    return n.link
      ? '<button type="button" class="notif mini' + (n.read ? '' : ' unread') + '" data-action="notif-open" data-nid="' + n.id + '" data-href="' + APP.h(n.link) + '">' + inner + '</button>'
      : '<div class="notif mini' + (n.read ? '' : ' unread') + '">' + inner + '</div>';
  }).join('');

  const commRecs = [];
  for (const q of Object.values(APP.db.questions || {})) {
    if (q.authorId === c.id) commRecs.push({ ts: q.createdTs || 0, text: 'Asked: ' + q.title, href: '#/community/q/' + q.id });
    for (const a of q.answers || []) {
      if (a.authorId === c.id) commRecs.push({ ts: a.createdTs || 0, text: (a.accepted ? 'Accepted answer: ' : 'Answered: ') + q.title, href: '#/community/q/' + q.id });
    }
  }
  commRecs.sort((x, y) => y.ts - x.ts);
  const nstats = APP.communityNetworkStats();
  const askBtn = '<div class="btn-row mt16"><a class="btn btn-primary btn-sm" href="#/community/ask">' + APP.icon('plus', 14) + ' Ask a question</a></div>';
  const commCard =
    '<div class="card"><div class="card-h">' + APP.icon('spark', 16) + ' Community <a class="link" href="#/community">Browse →</a></div>' +
    (commRecs.length
      ? commRecs.slice(0, 2).map(r => '<a class="app-item" href="' + r.href + '"><div class="grow"><strong>' + APP.h(r.text) + '</strong><small class="muted">' + APP.timeAgo(r.ts) + '</small></div></a>').join('') + askBtn
      /* Social proof for a user with no activity yet: show the network's vitality (not their emptiness),
         preferring discussions from the SAP products they actually work in. */
      : '<p class="muted small">' + nstats.questions + ' questions · ' + nstats.answers + " answers from SAP people — in the ecosystem's own language.</p>" +
        APP.recentCommunityItems((c.skills || []).map(k => k.productId), 2).map(q => {
          const ans = (q.answers || []).length;
          const tag = APP.productShort(q.productId) + (q.moduleId ? ' · ' + APP.skillName(q.productId, q.moduleId) : '');
          return '<a class="app-item" href="#/community/q/' + q.id + '"><div class="grow"><strong>' + APP.h(q.title) + '</strong><small class="muted">' + APP.h(tag) + ' · ' + ans + ' answer' + (ans === 1 ? '' : 's') + '</small></div></a>';
        }).join('') + askBtn) +
    '</div>';

  return APP.getStartedHtml('consultant') + '<div class="dash-grid">' +
    '<aside>' +
    '<div class="card profile-card">' +
    '<div class="profile-card-top">' +
    APP.avatarHtml(name, 'xl') +
    '<div><h2 class="profile-name">' + APP.h(name) + '</h2>' +
    '<p class="muted">' + APP.h(c.headline) + '</p></div></div>' +
    '<div class="profile-meta">' +
    '<span>' + APP.icon('pin', 14) + ' ' + APP.h(APP.locText(c)) + '</span>' +
    '<span>' + APP.icon('users', 14) + ' ' + APP.h(c.nationality) + ' · ' + APP.h(c.level) + '</span>' +
    '<span>' + APP.icon('check', 14) + ' ' + APP.h(c.availability) + '</span>' +
    (c.workPrefs && c.workPrefs.length ? '<span>' + APP.icon('home', 14) + ' Open to ' + APP.h(c.workPrefs.join(' / ')) + '</span>' : '') +
    '<span>' + APP.icon('file', 14) + ' ' + APP.rateHtml(c) + '</span>' +
    '</div>' +
    '<div class="field" style="margin-top:14px"><span class="label">SAP skills</span><div class="chip-wrap">' + APP.skillChipsHtml(c.skills, 6) + '</div></div>' +
    (!c.roleType ? '<p class="muted small mt8">' + APP.icon('spark', 13) + ' <a class="link" href="#/c/profile">Add your role type</a> so companies can find you.</p>' : '') +
    '<div class="strength"><div class="strength-row muted small">Profile strength <strong>' + strength + '%</strong></div>' +
    '<div class="strength-bar"><span style="width:' + strength + '%"></span></div></div>' +
    '<div class="btn-row mt16">' +
    '<a class="btn btn-primary btn-sm" href="#/c/profile">' + APP.icon('plus', 14) + ' Edit profile</a>' +
    '<a class="btn btn-outline btn-sm" href="#/c/jobs">Browse all jobs</a></div>' +
    '</div>' +
    commCard +
    (recentNotifs ? '<div class="card"><div class="card-h">Recent activity <button class="link" data-action="toggle-notif">All →</button></div>' + recentNotifs + '</div>' : '') +
    '</aside>' +
    '<section>' +
    '<div class="feed-head"><h2>Your smart feed</h2><a class="link" href="#/c/jobs">See all roles →</a></div>' +
    '<p class="muted small feed-note">' + APP.icon('spark', 13) + ' Auto-ranked against your skills' + (topSkills.length ? ' — ' + APP.h(topSkills.slice(0, 3).join(', ')) + (topSkills.length > 3 ? ' +' + (topSkills.length - 3) + ' more' : '') : '') + '. Roles that don\'t fit rank to the bottom.</p>' +
    feedWithBlock +
    '</section></div>';
};

/* ------------------------------ profile ------------------------------ */

/* Read-only profile body, shared by the consultant's own page (c-profile) and the
   public, shareable talent page (#/talent/:id). o.public hides the rate + CV card and
   switches to neutral copy; o.headActions replaces the "Edit profile" button. */
APP.consultantProfileHtml = function (c, o) {
  o = o || {};
  const pub = !!o.public;
  const name = APP.consultantFullName(c);

  const pcs = APP.communityStats(c.id);
  const pcBits = [];
  if (pcs.questions) pcBits.push(pcs.questions + ' question' + (pcs.questions > 1 ? 's' : ''));
  if (pcs.answers) pcBits.push(pcs.answers + ' answer' + (pcs.answers > 1 ? 's' : ''));
  if (pcs.articles) pcBits.push(pcs.articles + ' article' + (pcs.articles > 1 ? 's' : ''));
  if (pcs.acceptedAnswers) pcBits.push(pcs.acceptedAnswers + ' marked accepted');
  { const rp = APP.reputation(c.id); if (rp.level) pcBits.unshift(rp.levelName + ' · ' + rp.points + ' pts'); }
  const commProfileCard =
    '<div class="card"><div class="card-h">' + APP.icon('spark', 16) + ' In the community</div>' +
    (pcBits.length
      ? '<p class="muted">' + APP.h(pcBits.join(' · ')) + (pub ? ' — visible to anyone who views this profile.' : ' — visible on your profile. Keep it growing.') + '</p>'
      : '<p class="muted">' + (pub ? 'No community activity yet.' : 'No community activity yet — ask a question or answer one to start building your public footprint.') + '</p>') +
    '<div class="btn-row"><a class="btn btn-outline btn-sm" href="#/community">Visit the community</a></div>' +
    '</div>';

  const rateLine = pub
    ? '<span>' + APP.icon('file', 14) + ' Rate: on request</span>'
    : '<span>' + APP.icon('file', 14) + ' ' + APP.rateHtml(c) + '</span>';

  return '<div class="card profile-head-card">' +
    APP.avatarHtml(name, 'xl') +
    '<div class="grow"><h2>' + APP.h(name) + '</h2>' +
    '<p class="muted">' + APP.h(c.headline) + '</p>' +
    '<div class="profile-meta mt8">' +
    '<span>' + APP.icon('pin', 14) + ' ' + APP.h(APP.locText(c)) + '</span>' +
    '<span>' + APP.icon('users', 14) + ' ' + APP.h(c.nationality) + ' · ' + APP.h(c.level) + ' · ' + c.yearsExp + ' yrs exp</span>' +
    (c.roleType ? '<span>' + APP.icon('briefcase', 14) + ' ' + APP.h(APP.roleTypeLine(c)) + '</span>' : '') +
    '<span>' + APP.icon('check', 14) + ' ' + APP.h(c.availability) + '</span>' +
    (c.workPrefs && c.workPrefs.length ? '<span>' + APP.icon('home', 14) + ' Open to ' + APP.h(c.workPrefs.join(' / ')) + '</span>' : '') +
    rateLine +
    (c.linkedin ? '<a class="ext-link" href="' + APP.h(APP.normUrl(c.linkedin)) + '" target="_blank" rel="noopener">' + APP.icon('ext', 14) + ' LinkedIn</a>' : '') +
    '</div></div>' +
    (o.headActions || '') +
    '</div>' +

    (c.summary ? '<div class="card"><div class="card-h">About</div><p>' + APP.h(c.summary) + '</p></div>' : '') +

    '<div class="card"><div class="card-h">SAP experience</div>' +
    (c.skills && c.skills.length
      ? '<table class="skill-table"><thead><tr><th>Product</th><th>Module</th><th>Projects delivered</th><th>Certified</th></tr></thead><tbody>' +
        c.skills.map(k => '<tr><td>' + APP.h(APP.productShort(k.productId)) + '</td><td>' + APP.h(APP.skillName(k.productId, k.moduleId)) + '</td><td>' + Number(k.projects || 0) + '</td><td>' + (k.certified ? APP.icon('check', 13) + ' Yes' : '<span class="muted">—</span>') + '</td></tr>').join('') +
        '</tbody></table>'
      : '<div class="empty small">No skills tagged yet.</div>') +
    '</div>' +

    '<div class="card"><div class="card-h">Industries</div><div class="chip-wrap">' + ((c.industries || []).length ? (c.industries || []).map(i => '<span class="chip">' + APP.h(i) + '</span>').join('') : '<span class="muted small">None listed' + (pub ? '.' : ' — add them in Edit profile.') + '</span>') + '</div></div>' +
    ((c.specialties && c.specialties.length) || (c.otherSkills && c.otherSkills.length) ? '<div class="card"><div class="card-h">Specialties</div><div class="chip-wrap">' + (c.specialties || []).map(id => '<span class="chip" title="' + APP.h(APP.specialtyLabel(id)) + '">' + APP.h(APP.specialtyName(id)) + '</span>').join('') + (c.otherSkills || []).map(t => '<span class="chip">' + APP.h(t) + '</span>').join('') + '</div></div>' : '') +

    '<div class="grid-2">' +
    '<div class="card"><div class="card-h">Languages</div><div class="chip-wrap">' + ((c.languages || []).length ? (c.languages || []).map(l => '<span class="chip">' + APP.h(l) + '</span>').join('') : '<span class="muted small">None listed</span>') + '</div></div>' +
    (pub ? '' :
    '<div class="card"><div class="card-h">CV</div>' +
    (c.cv
      ? '<span class="cv-item big">' + APP.icon('file', 18) + ' ' + APP.h(c.cv.name) + ' <em class="muted">' + APP.h(c.cv.size) + '</em></span>'
      : '<div class="empty small">No CV uploaded yet.</div>') +
    '</div>') +
    '</div>' +
    commProfileCard;
};

APP.views['c-profile'] = function () {
  const c = APP.consultant(APP.db.session.consultantId);
  if (!c) return '<div class="empty">Profile not found.</div>';
  const name = APP.consultantFullName(c);
  const editing = APP.state.profileEdit && APP.profileDraft;
  const d = editing ? APP.profileDraft : c;

  let body;
  if (!editing) {
    body = APP.privacyCardHtml() + APP.consultantProfileHtml(c, {
      public: false,
      headActions: '<button class="btn btn-outline btn-sm" data-action="profile-edit-on">Edit profile</button>'
    }) +
      '<div class="mt16">' + APP.shareHtml({
        title: name + ' — SAP professional',
        text: name + ' · ' + (c.headline || 'SAP professional') + ' — profile on Arnour, the SAP talent network.',
        tags: '#SAP #SAPConsultant',
        url: APP.shareUrl('#/talent/' + c.id)
      }) + '</div>' +
      '<p class="muted small mt8">This is your public page — <a class="link" href="#/talent/' + c.id + '">open it to see exactly what companies see when they open a shared link →</a></p>';
  } else {
    body =
      '<div class="card"><div class="card-h">Edit your profile <button class="link" data-action="profile-edit-off">Cancel</button></div>' +
      '<form data-form="profile-edit">' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">First name</span><input name="firstName" class="input" value="' + APP.h(d.firstName) + '"></label>' +
      '<label class="field"><span class="label">Last name</span><input name="lastName" class="input" value="' + APP.h(d.lastName) + '"></label>' +
      '</div>' +
      '<label class="field"><span class="label">Headline</span><input name="headline" class="input" value="' + APP.h(d.headline) + '"></label>' +
      '<label class="field"><span class="label">LinkedIn profile</span><input name="linkedin" class="input" value="' + APP.h(d.linkedin || '') + '" placeholder="linkedin.com/in/your-profile"><p class="field-hint">Shown on your public page so companies can verify you — leave empty to remove it.</p></label>' +
      '<div class="field"><span class="label">Role type(s) <span class="req-star">*</span></span>' + APP.roleTypePicker('profile', d) + '</div>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Nationality</span><select name="nationality" class="input">' + APP.opt(APP.nationalities.map(n => [n, n]), d.nationality) + '</select></label>' +
      '<label class="field"><span class="label">Country *</span><select name="country" class="input">' + APP.countryOptions(d.country) + '</select></label>' +
      '<label class="field"><span class="label">City <span class="muted">(optional)</span></span><select name="city" class="input">' + APP.cityOptions(d.country, d.city) + '</select></label>' +
      '</div>' +
      '<div class="field"><span class="label">Languages <span class="req-star">*</span></span><div class="chip-wrap">' + APP.chipGroup('profile', 'languages', APP.languages, d.languages || []) + '</div></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Years of experience</span><input name="yearsExp" type="number" min="1" max="40" class="input" value="' + APP.h(d.yearsExp) + '"></label>' +
      '<label class="field"><span class="label">Level</span><select name="level" class="input">' + APP.opt(APP.levels.map(l => [l, l]), d.level) + '</select></label>' +
      '<label class="field"><span class="label">Availability</span><select name="availability" class="input">' + APP.opt(APP.availability.map(x => [x, x]), d.availability) + '</select></label>' +
      '</div>' +
      '<div class="field"><span class="label">SAP skills</span>' +
      '<div class="skill-rows">' + APP.skillCardsHtml('profile', d.skills || []) + '</div></div>' +
      '<div class="field"><span class="label">Industries</span><div class="chip-wrap">' + APP.chipGroup('profile', 'industries', APP.industries, d.industries || []) + '</div></div>' +
      '<div class="field"><span class="label">SAP specialties</span><div class="spec-panel">' + APP.specialtyChipsHtml('profile', d.specialties || [], null, { softMax: 6 }) + '</div></div>' +
      '<div class="field"><span class="label">Open to</span><div class="chip-wrap">' + APP.chipGroup('profile', 'workPrefs', APP.workPrefs, d.workPrefs || []) + '</div></div>' +
      '<label class="field"><span class="label">Your own specialties (free text)</span><input name="otherSkills" class="input" value="' + APP.h(Array.isArray(d.otherSkills) ? d.otherSkills.join(', ') : (d.otherSkills || '')) + '" placeholder="e.g. ECC to S/4HANA conversion, HGB to IFRS — comma separated"><p class="field-hint">Anything not on the list above — written your way, still searchable by companies.</p></label>' +
      '<div class="form-grid">' +
      '<div class="field"><span class="label">Your rate</span>' + APP.rateInputHtml(d, true) + '</div>' +
      '</div>' +
      '<div class="field"><span class="label">Summary</span><textarea name="summary" class="input" rows="3">' + APP.h(d.summary) + '</textarea></div>' +
      '<div class="field"><span class="label">CV</span><div class="cv-box">' +
      (d.cv
        ? '<span class="cv-item">' + APP.icon('file', 16) + ' ' + APP.h(d.cv.name) + ' <em class="muted">' + APP.h(d.cv.size) + '</em></span>'
        : '') +
      '<label class="cv-drop small-drop">' + APP.icon('file', 16) + '<span>' + (d.cv ? 'Replace CV' : 'Upload CV') + '</span><input type="file" accept=".pdf,.doc,.docx" data-profile-cv hidden></label></div></div>' +
      '<div class="btn-row"><span class="grow"></span><button type="submit" class="btn btn-primary">' + APP.icon('check', 15) + ' Save changes</button></div>' +
      '</form></div>';
  }

  return '<div class="narrow">' +
    '<div class="crumb"><a class="link" href="#/c/dashboard">← Dashboard</a>' + (editing ? '<span class="pill">Editing</span>' : '') + '</div>' +
    body +
    '</div>';
};

/* ------------------------------ jobs ------------------------------ */

APP.applyJobFilters = function (c, jobs) {
  const f = APP.state.jobFilters;
  let out = jobs;
  if (f.types && f.types.length) out = out.filter(j => f.types.includes(j.employmentType));
  if (f.region && f.region !== 'all') {
    out = out.filter(j => {
      const cc = APP.countriesById[j.country];
      return cc && cc.region === f.region;
    });
  }
  if (f.roleType) out = out.filter(j => APP.jobRoleType(j) === f.roleType);
  if (f.product) out = out.filter(j => (j.requires || []).some(r => r.productId === f.product));
  if (f.module) out = out.filter(j => (j.requires || []).some(r => r.productId === f.product && (r.moduleId === f.module || r.moduleId === '*')));
  if (f.country) out = out.filter(j => j.country === f.country);
  if (f.levels && f.levels.length) out = out.filter(j => !j.level || f.levels.includes(j.level)); /* no seniority set = open to any level */
  if (f.workMode === 'remote') out = out.filter(j => !!j.remote);
  else if (f.workMode === 'onsite') out = out.filter(j => !j.remote);
  if (f.industries && f.industries.length) out = out.filter(j => APP.jobIndustries(j).some(i => f.industries.includes(i)));
  if (f.cert === 'none') out = out.filter(j => !j.certification);
  else if (f.cert) out = out.filter(j => j.certification === f.cert);
  if (f.lang) out = out.filter(j => (j.languages || []).includes(f.lang) || (j.preferredLangs || []).includes(f.lang));
  if (f.posted) out = out.filter(j => Date.now() - (j.postedTs || 0) <= Number(f.posted) * 864e5);
  if (f.q) {
    const q = f.q.toLowerCase();
    out = out.filter(j => {
      const co = APP.coFor(APP.company(j.companyId), j);
      const hay = (j.title + ' ' + (co ? co.name : '') + ' ' + (j.requires || []).map(r => APP.productShort(r.productId) + ' ' + APP.skillName(r.productId, r.moduleId)).join(' ') + ' ' + (j.city || '')).toLowerCase();
      return hay.includes(q);
    });
  }
  if (f.sort === 'newest') out = out.slice().sort((a, b) => b.postedTs - a.postedTs);
  return out;
};

/* Every active job filter as [key, value, label] — drives the removable chips and the per-section counters */
APP.jobActiveFilters = function (f) {
  const out = [];
  if (f.q) out.push(['q', '', '“' + f.q + '”']);
  if (f.roleType) out.push(['roleType', '', APP.roleTypeLabel(f.roleType) || f.roleType]);
  if (f.product) out.push(['product', '', APP.productShort(f.product)]);
  if (f.module) out.push(['module', '', APP.skillName(f.product, f.module)]);
  (f.types || []).forEach(v => out.push(['types', v, v]));
  (f.levels || []).forEach(v => out.push(['levels', v, v]));
  if (f.country) out.push(['country', '', APP.countryName(f.country)]);
  if (f.region && f.region !== 'all') out.push(['region', '', APP.regions[f.region]]);
  if (f.workMode) out.push(['workMode', '', f.workMode === 'remote' ? 'Remote-friendly' : 'On-site']);
  (f.industries || []).forEach(v => out.push(['industries', v, v]));
  if (f.cert) out.push(['cert', '', { none: 'No certification needed', preferred: 'Certification preferred', required: 'Certification required' }[f.cert]]);
  if (f.lang) out.push(['lang', '', f.lang]);
  if (f.posted) out.push(['posted', '', { 1: 'Last 24 hours', 7: 'Last 7 days', 30: 'Last 30 days' }[f.posted]]);
  return out;
};
APP.JF_SECTION_KEYS = {
  jrole: ['roleType'], jskills: ['product', 'module'], jtype: ['types'], jlevel: ['levels'],
  jloc: ['country', 'region', 'workMode'], jind: ['industries'], jreq: ['cert', 'lang'], jposted: ['posted']
};
APP.jfCount = function (active, section) { const k = APP.JF_SECTION_KEYS[section]; return active.filter(a => k.indexOf(a[0]) !== -1).length; };

APP.jobFilterPanelHtml = function (f, active, nShown) {
  const cnt = (s) => APP.jfCount(active, s);
  const chips = (group, opts, single) => '<div class="chip-wrap">' + APP.chipGroup('jobFilters', group, opts, single ? f[group] : f[group], single) + '</div>';
  const roleBody = '<select name="roleType" class="input" aria-label="Role type"><option value="">Any role type</option>' + APP.roleTypes.map(t => '<option value="' + t.id + '"' + (f.roleType === t.id ? ' selected' : '') + '>' + APP.h(t.name) + '</option>').join('') + '</select>';
  const skillBody =
    '<label class="field"><span class="label">SAP product</span><select name="product" class="input"><option value="">Any product</option>' + APP.productOptions(f.product) + '</select></label>' +
    '<label class="field"><span class="label">Module</span><select name="module" class="input">' + APP.moduleOptions(f.product || null, f.module) + '</select></label>';
  const locBody =
    '<label class="field"><span class="label">Country</span><select name="country" class="input"><option value="">Any country</option>' + APP.countryOptions(f.country, true) + '</select></label>' +
    '<div class="field"><span class="label">Region</span><div class="chip-wrap">' + ['all'].concat(Object.keys(APP.regions)).map(r =>
      '<button type="button" class="chip ' + (f.region === r ? 'chip-on' : '') + '" data-action="chip" data-scope="jobFilters" data-group="region" data-single="1" data-value="' + r + '">' + APP.TF_REGION_LABEL(r) + '</button>').join('') + '</div></div>' +
    '<div class="field"><span class="label">Work style</span>' + chips('workMode', [{ id: 'remote', name: 'Remote-friendly' }, { id: 'onsite', name: 'On-site' }], true) + '</div>';
  const reqBody =
    '<div class="field"><span class="label">SAP certification</span>' + chips('cert', [{ id: 'none', name: 'Not needed' }, { id: 'preferred', name: 'Preferred' }, { id: 'required', name: 'Required' }], true) + '</div>' +
    '<label class="field"><span class="label">Language</span><select name="lang" class="input"><option value="">Any</option>' + APP.opt(APP.languages.map(l => [l, l]), f.lang) + '</select></label>';
  const postedBody = '<label class="field"><span class="label">Posted</span><select name="posted" class="input"><option value="">Any time</option>' + APP.opt([['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days']], String(f.posted || '')) + '</select></label>';
  return '<form data-form="job-filters" class="filters card' + (APP.state.tfMobile ? ' tf-open' : '') + '" id="tf-panel">' +
    '<div class="card-h">Filters' + (active.length ? ' <span class="count-pill">' + active.length + '</span>' : '') + ' <button type="button" class="link" data-action="filters-reset">Reset</button></div>' +
    APP.tfSection('jrole', 'Role type', cnt('jrole'), true, roleBody) +
    APP.tfSection('jskills', 'SAP products & modules', cnt('jskills'), true, skillBody) +
    APP.tfSection('jtype', 'Job type', cnt('jtype'), true, chips('types', APP.jobTypes)) +
    APP.tfSection('jlevel', 'Seniority', cnt('jlevel'), false, chips('levels', APP.levels)) +
    APP.tfSection('jloc', 'Location & work style', cnt('jloc'), false, locBody) +
    APP.tfSection('jind', 'Industry', cnt('jind'), false, chips('industries', APP.industries)) +
    APP.tfSection('jreq', 'Certification & language', cnt('jreq'), false, reqBody) +
    APP.tfSection('jposted', 'Date posted', cnt('jposted'), false, postedBody) +
    '<button type="button" class="btn btn-primary btn-block tf-show" data-action="tf-toggle">Show ' + nShown + ' role' + (nShown === 1 ? '' : 's') + '</button>' +
    '</form>';
};

/* Shared job search page for professionals (#/c/jobs) and visitors (#/jobs): filter sidebar + results */
APP.jobSearchHtml = function (o) {
  const f = APP.state.jobFilters;
  const active = APP.jobActiveFilters(f);
  const n = o.items.length;
  const sortSel = o.canSort
    ? '<label class="rb-sort"><span>Sort</span><select name="sort" class="input rb-sort-sel" aria-label="Sort roles"><option value="match"' + (f.sort !== 'newest' ? ' selected' : '') + '>Best match</option><option value="newest"' + (f.sort === 'newest' ? ' selected' : '') + '>Newest</option></select></label>' : '';
  const bar =
    '<form data-form="job-q" class="results-bar">' +
    '<div class="rb-search"><span class="nav-search-ico">' + APP.icon('search') + '</span><input name="q" type="search" value="' + APP.h(f.q) + '" placeholder="Search title, company or SAP module…" aria-label="Search roles"><button type="submit" class="btn btn-primary btn-sm">Search</button></div>' +
    '<div class="rb-row"><button type="button" class="btn btn-outline btn-sm tf-mobile-btn" data-action="tf-toggle" aria-controls="tf-panel" aria-expanded="' + (APP.state.tfMobile ? 'true' : 'false') + '">Filters' + (active.length ? ' (' + active.length + ')' : '') + '</button>' +
    '<span class="rb-count" role="status" aria-live="polite"><strong>' + n + '</strong> open role' + (n === 1 ? '' : 's') + (o.ranked ? ' · ranked by fit with your profile' : '') + '</span>' +
    '<span class="grow"></span>' + sortSel + '</div></form>';
  const chipsBar = active.length
    ? '<div class="af-bar" role="region" aria-label="Active filters"><span class="af-label">Active filters</span>' +
      active.map(a => '<button type="button" class="chip chip-on af-chip" data-action="filter-remove" data-key="' + a[0] + '" data-value="' + APP.h(a[1]) + '" aria-label="Remove filter ' + APP.h(a[2]) + '">' + APP.h(a[2]) + ' <span aria-hidden="true">✕</span></button>').join('') +
      '<button type="button" class="link af-clear" data-action="filters-reset">Clear all</button></div>' : '';
  return (o.head || '') +
    '<div class="search-layout">' + APP.jobFilterPanelHtml(f, active, n) +
    '<section>' + bar + chipsBar + (o.notice || '') +
    '<div id="tf-results">' + (o.cards || APP.emptyStateHtml({ icon: 'search', title: 'No SAP roles match these criteria', text: 'Try removing a filter or widening the region.', action: 'filters-reset', actionLabel: 'Reset all filters', extra: o.emptyExtra || '' })) + '</div>' +
    '</section></div>';
};

/* Find roles · Applied · Saved · Invitations — one switch shared by the job search and My jobs */
APP.jobsSwitchHtml = function (active) {
  const c = APP.consultant(APP.db.session.consultantId);
  const nApplied = Object.values(APP.db.jobs).filter(j => (j.applicants || []).indexOf(c.id) !== -1).length;
  const nSaved = (c.savedJobIds || []).filter(id => APP.job(id)).length;
  const w = APP.waitingForMe();
  const t = (id, href, label, n, alert) => '<a role="tab" aria-selected="' + (active === id) + '" class="seg-tab' + (active === id ? ' on' : '') + '" href="' + href + '">' + label + (n ? ' <span class="seg-n' + (alert ? ' seg-alert' : '') + '">' + n + '</span>' : '') + '</a>';
  return '<div class="seg-tabs jobs-switch" role="tablist" aria-label="Jobs">' + t('find', '#/c/jobs', 'Find roles') + t('applied', '#/c/applied', 'Applied', nApplied) + t('saved', '#/c/saved', 'Saved', nSaved) + t('intros', '#/c/intros', 'Invitations', w, true) + '</div>';
};

APP.views['c-jobs'] = function () {
  const c = APP.consultant(APP.db.session.consultantId);
  if (!c) return '<div class="empty">Profile not found.</div>';
  const f = APP.state.jobFilters;
  const open = APP.applyJobFilters(c, Object.values(APP.db.jobs).filter(j => j.status === 'open' && APP.jobVisibleToConsultant(c, j)));
  const items = open.map(j => ({ job: j, score: APP.matchScore(c, j) }));
  items.sort(f.sort === 'newest' ? (a, b) => b.job.postedTs - a.job.postedTs : (a, b) => b.score - a.score);
  const hid = APP.hiddenJobsInfo(c);
  const nApplied = Object.values(APP.db.jobs).filter(j => (j.applicants || []).indexOf(c.id) !== -1).length;
  const notice = hid.n ? '<div class="card hidden-note">' + APP.icon('spark', 14) + ' <span><strong>' + hid.n + ' more role' + (hid.n === 1 ? ' is' : 's are') + ' hidden</strong> because ' + (hid.lang ? 'they require a language that isn’t on your profile' : '') + (hid.lang && hid.cert ? ' or ' : '') + (hid.cert ? 'they require an SAP certification you haven’t added' : '') + '. <a class="link" href="#/c/profile">Update your profile</a> to see them.</span></div>' : '';
  return APP.jobSearchHtml({
    items: items, canSort: true, ranked: true, notice: notice,
    head: APP.jobsSwitchHtml('find'),
    cards: items.map(m => APP.jobCard(m.job, m.score, APP.jobActionButtons(m.job))).join('')
  });
};

/* ------------------------------ saved ------------------------------ */

APP.views['c-saved'] = function () {
  const c = APP.consultant(APP.db.session.consultantId);
  if (!c) return '<div class="empty">Profile not found.</div>';
  const tab = /\/applied$/.test(location.hash) ? 'applied' : /\/intros$/.test(location.hash) ? 'intros' : 'saved';
  const saved = (c.savedJobIds || []).map(id => APP.job(id)).filter(Boolean);
  const applied = Object.values(APP.db.jobs).filter(j => (j.applicants || []).indexOf(c.id) !== -1)
    .sort((a, b) => ((b.appliedTs || {})[c.id] || 0) - ((a.appliedTs || {})[c.id] || 0));
  const tabs = APP.jobsSwitchHtml(tab);
  let body;
  if (tab === 'intros') {
    const inv = APP.openInvitesFor();
    body = (inv.length ? '<div class="feed-head"><h3>Invited to apply (' + inv.length + ')</h3></div><p class="muted small">Companies that invited you. Apply when the role looks right.</p>' + inv.map(j => APP.jobCard(j, APP.matchScore(c, j), APP.jobActionButtons(j))).join('') +
      '<div class="feed-head mt16"><h3>Introductions</h3></div>' : '') + APP.introsPageHtml(true);
  } else if (tab === 'saved') {
    body = saved.length ? saved.map(j => APP.jobCard(j, APP.matchScore(c, j), APP.jobActionButtons(j))).join('')
      : '<div class="card empty">Nothing saved yet — tap “☆ Save” on any role to park it here.</div>';
  } else {
    body = applied.length ? applied.map(j => {
      const ts = (j.appliedTs || {})[c.id];
      const st = '<span class="app-status">' + APP.icon('check', 14) + ' ' + (ts ? 'Applied ' + APP.timeAgo(ts) : 'Applied') + (j.status !== 'open' ? ' · Role closed' : '') + '</span>';
      return APP.jobCard(j, APP.matchScore(c, j), st + '<button class="btn btn-outline btn-sm" data-action="withdraw" data-id="' + j.id + '">Withdraw</button>');
    }).join('')
      : '<div class="card empty">No applications yet — your best matches are waiting. <a class="link" href="#/c/jobs">Browse roles</a></div>';
  }
  return '<div class="narrow">' +
    '<div class="crumb"><a class="link" href="#/c/dashboard">← Dashboard</a></div>' +
    '<h2 class="page-title">My jobs</h2>' + tabs + body + '</div>';
};

/* ------------------------------ messaging ------------------------------ */

APP.state.inbox = APP.state.inbox || { q: '', f: 'all', role: '' };

/* ---- helpers: role context, day labels ---- */
APP.convRole = function (cv) {
  const jobs = Object.values(APP.db.jobs).filter(j => j.companyId === cv.eId);
  const newest = (arr) => arr.slice().sort((a, b) => (b.postedTs || 0) - (a.postedTs || 0))[0];
  let j = cv.jobId ? APP.job(cv.jobId) : null;
  if (!j) j = newest(jobs.filter(x => (x.applicants || []).indexOf(cv.cId) !== -1));
  if (!j) j = newest(jobs.filter(x => (x.invited || []).indexOf(cv.cId) !== -1));
  if (!j) { const i = Object.values(APP.intros()).filter(x => x.cid === cv.cId && x.eid === cv.eId && x.jobId).sort((a, b) => b.ts - a.ts)[0]; if (i) j = APP.job(i.jobId); }
  if (!j) return null;
  const applied = (j.applicants || []).indexOf(cv.cId) !== -1, invited = (j.invited || []).indexOf(cv.cId) !== -1;
  const isC = APP.db.session.role === 'consultant';
  return { job: j, applied: applied, invited: invited, closed: j.status !== 'open',
    state: applied ? (isC ? 'Applied' : 'Applicant') : invited ? 'Invited' : 'In discussion' };
};
APP.dayStart = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
APP.dayLabel = function (ts) {
  const diff = Math.round((APP.dayStart(Date.now()) - APP.dayStart(ts)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(ts), y = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: y ? 'numeric' : undefined });
};
APP.clockTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
APP.shortTime = function (ts) {
  const l = APP.dayLabel(ts);
  return l === 'Today' ? APP.clockTime(ts) : l === 'Yesterday' ? 'Yesterday' : new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
APP.callWhen = (c) => new Date(c.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + APP.clockTime(c.ts) + ' · ' + c.dur + ' min';

/* who is on the other end of a conversation, as the current viewer sees them */
APP.convCounterparty = function (cv) {
  const isC = APP.db.session.role === 'consultant';
  if (isC) {
    const co = APP.company(cv.eId);
    return co ? { name: co.name, sub: co.industry || 'Company', avatar: APP.avatarHtml(co.name), href: APP.authorHref(co.id) } : null;
  }
  const c = APP.consultant(cv.cId);
  if (!c) return null;
  const v = APP.cv(c), nm = APP.consultantFullName(v);
  return { name: nm, sub: v.headline || 'Professional', avatar: APP.avatarHtml(nm, '', v._anon), href: APP.authorHref(c.id) };
};
APP.convPreview = function (cv, isC) {
  const last = cv.messages[cv.messages.length - 1];
  if (!last) return 'New conversation';
  const mine = (isC && last.side === 'c') || (!isC && last.side === 'e');
  let t;
  if (last.call) t = '📅 Call ' + ({ proposed: 'proposed', accepted: 'confirmed', declined: 'declined' }[last.call.status] || 'proposed');
  else if (last.cv) t = '📄 CV shared';
  else t = last.text || '';
  return (mine ? 'You: ' : '') + t;
};

/* ---- the conversation list (search, filters, introductions, grouped rows) ---- */
APP.inboxPanelHtml = function (activeId) {
  const s = APP.db.session, isC = s.role === 'consultant', k = APP.userKey(), st = APP.state.inbox;
  const all = (isC ? APP.consultantConvs(k) : APP.companyConvs(k)).sort((a, b) => b.lastTs - a.lastTs);
  const unreadOf = (cv) => (isC ? cv.unread.c : cv.unread.e) || 0;
  const withRole = all.map(cv => ({ cv: cv, cp: APP.convCounterparty(cv), role: APP.convRole(cv) })).filter(x => x.cp);
  const roleOpts = [];
  withRole.forEach(x => { if (x.role && !roleOpts.some(r => r.id === x.role.job.id)) roleOpts.push({ id: x.role.job.id, title: x.role.job.title }); });
  if (st.role && !roleOpts.some(r => r.id === st.role)) st.role = '';
  const q = (st.q || '').trim().toLowerCase();
  const rows = withRole.filter(x => {
    if (st.f === 'unread' && !unreadOf(x.cv)) return false;
    if (st.role && !(x.role && x.role.job.id === st.role)) return false;
    if (q) {
      const hay = (x.cp.name + ' ' + (x.role ? x.role.job.title : '') + ' ' + x.cv.messages.map(m => m.text || '').join(' ')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  const nUnread = withRole.filter(x => unreadOf(x.cv)).length;

  /* introductions waiting for an answer */
  const pend = Object.values(APP.intros()).filter(i => i.status === 'pending' && (isC ? (i.from === 'e' && i.cid === k) : (i.from === 'c' && i.eid === k))).sort((a, b) => b.ts - a.ts);
  const introHtml = (!q && st.f === 'all' && !st.role && pend.length)
    ? '<div class="ci-group ci-intros">Waiting for your answer <span class="count-pill">' + pend.length + '</span></div>' + pend.map(i => {
      const job = i.jobId ? APP.job(i.jobId) : null, c = APP.consultant(i.cid), co = APP.company(i.eid);
      const other = isC ? APP.coLabel(co, job, i.cid) : APP.personLabel(c, i.eid);
      const shown = isC ? null : APP.cv(c);
      return '<div class="conv-intro"><div class="ci-ihead">' + APP.avatarHtml(other, '', isC ? !APP.revealed(i.cid, i.eid) && APP.coHidden(co, job) : (shown && shown._anon)) +
        '<div class="ci-body"><b class="ci-name">' + APP.h(other) + '</b><span class="ci-role">Wants to connect' + (job ? ' · ' + APP.h(job.title) : '') + '</span></div></div>' +
        '<div class="ci-acts"><button type="button" class="btn btn-primary btn-sm" data-action="intro-accept" data-id="' + i.id + '">Accept</button><button type="button" class="btn btn-ghost btn-sm" data-action="intro-decline" data-id="' + i.id + '">Decline</button></div></div>';
    }).join('') + '<a class="ci-more" href="' + (isC ? '#/c/intros' : '#/e/intros') + '">All introductions →</a>'
    : '';

  const groupOf = (ts) => { const l = APP.dayLabel(ts); return l === 'Today' || l === 'Yesterday' ? l : 'Earlier'; };
  let lastG = '';
  const listHtml = rows.map(x => {
    const cv = x.cv, un = unreadOf(cv), g = groupOf(cv.lastTs);
    const head = g !== lastG ? '<div class="ci-group">' + g + '</div>' : '';
    lastG = g;
    const roleLine = x.role ? '<span class="ci-role">' + APP.h(x.role.job.title) + ' · ' + (x.role.closed ? 'Role closed' : x.role.state) + '</span>' : '';
    return head + '<button type="button" class="conv-item' + (activeId === cv.id ? ' active' : '') + (un ? ' unread' : '') + '" data-action="open-conv" data-id="' + cv.id + '">' +
      x.cp.avatar +
      '<span class="ci-body"><span class="ci-top"><b class="ci-name">' + APP.h(x.cp.name) + '</b><time>' + (cv.lastTs ? APP.shortTime(cv.lastTs) : '') + '</time></span>' +
      roleLine + '<span class="ci-prev' + (un ? ' unread-txt' : '') + '">' + APP.h(APP.convPreview(cv, isC).slice(0, 80)) + '</span></span>' +
      (un ? '<span class="ci-badge" aria-label="' + un + ' unread">' + un + '</span>' : '') + '</button>';
  }).join('');

  const empty = !all.length && !pend.length
    ? '<div class="empty small">No conversations yet — ' + (isC ? 'apply to a role and the company can reply here.' : 'message a professional or invite one to apply.') + '</div>'
    : (!rows.length && !introHtml ? '<div class="empty small">Nothing matches' + (q ? ' “' + APP.h(st.q) + '”' : ' this filter') + '. <button type="button" class="link" data-action="inbox-clear">Clear filters</button></div>' : '');

  const chip = (id, label) => '<button type="button" class="chip' + (st.f === id ? ' chip-on' : '') + '" aria-pressed="' + (st.f === id) + '" data-action="inbox-filter" data-f="' + id + '">' + label + '</button>';
  const tools = '<div class="conv-tools"><div class="search-box">' + APP.icon('search', 15) + '<input type="search" class="input" data-inbox-q placeholder="Search people, roles, messages" aria-label="Search messages" value="' + APP.h(st.q || '') + '"></div>' +
    '<div class="conv-chips">' + chip('all', 'All') + chip('unread', 'Unread' + (nUnread ? ' (' + nUnread + ')' : '')) +
    (roleOpts.length > 1 ? '<select class="input" data-inbox-role aria-label="Filter by role"><option value="">All roles</option>' + roleOpts.map(r => '<option value="' + r.id + '"' + (st.role === r.id ? ' selected' : '') + '>' + APP.h(r.title) + '</option>').join('') + '</select>' : '') + '</div></div>';
  return { tools: tools, body: introHtml + listHtml + empty, count: all.length };
};
APP.inboxRefresh = function () {
  const act = document.querySelector('.conv-item.active');
  const p = APP.inboxPanelHtml(act ? act.dataset.id : null);
  const items = document.getElementById('conv-items');
  if (items) items.innerHTML = p.body;
  const fresh = document.querySelector('.conv-chips'); const t = document.createElement('div'); t.innerHTML = p.tools;
  if (fresh) { fresh.replaceWith(t.querySelector('.conv-chips')); }
};

/* ---- message bubbles grouped by day ---- */
APP.chatMessagesHtml = function (cv, isC) {
  const otherSide = isC ? 'e' : 'c';
  const cvName = ((APP.consultant(cv.cId) || {}).cv && APP.consultant(cv.cId).cv.name) || 'CV.pdf';
  let day = '', html = '';
  cv.messages.forEach((m, i) => {
    const dl = APP.dayLabel(m.ts);
    if (dl !== day) { html += '<div class="day-sep"><span>' + dl + '</span></div>'; day = dl; }
    const mine = (isC && m.side === 'c') || (!isC && m.side === 'e');
    const nx = cv.messages[i + 1];
    const end = !nx || nx.side !== m.side || APP.dayLabel(nx.ts) !== dl || nx.ts - m.ts > 5 * 6e4;
    let body;
    if (m.call) {
      const c = m.call, canAnswer = !mine && c.status === 'proposed';
      body = '<div class="msg msg-call">' + APP.icon('spark', 18) + '<div class="mc-body"><strong>' + (mine ? 'You proposed a call' : 'Call proposed') + '</strong><span>' + APP.h(APP.callWhen(c)) + '</span>' +
        (c.note ? '<small class="muted">“' + APP.h(c.note) + '”</small>' : '') +
        (canAnswer ? '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-action="call-reply" data-conv="' + cv.id + '" data-i="' + i + '" data-ans="accepted">Accept</button><button type="button" class="btn btn-ghost btn-sm" data-action="call-reply" data-conv="' + cv.id + '" data-i="' + i + '" data-ans="declined">Decline</button></div>'
          : '<span class="pill ' + (c.status === 'accepted' ? 'inv' : c.status === 'declined' ? 'muted-pill' : 'warn-pill') + '">' + ({ proposed: 'Awaiting reply', accepted: 'Confirmed', declined: 'Declined' }[c.status]) + '</span>') +
        '</div></div>';
    } else if (m.cv) {
      const ref = typeof m.cv === 'object' ? m.cv : null;
      body = '<div class="msg msg-bubble msg-cv">' + APP.icon('file', 18) + '<span><strong>' + APP.h((ref && ref.name) || cvName) + '</strong><small>CV' + (mine ? ' · attached by you' : '') + (ref && ref.size ? ' · ' + APP.h(ref.size) : '') + '</small></span>' +
        (ref && ref.path ? '<button type="button" class="btn btn-outline btn-sm cv-dl" data-action="cv-download" data-path="' + APP.h(ref.path) + '" data-name="' + APP.h(ref.name || 'CV') + '">Download</button>' : '') + '</div>';
    } else body = '<div class="msg msg-bubble">' + APP.h(m.text) + '</div>';
    const isLast = i === cv.messages.length - 1;
    const status = (mine && isLast) ? ' · ' + ((cv.unread[otherSide] || 0) > 0 ? 'Delivered' : 'Seen') : '';
    html += '<div class="msg-row ' + (mine ? 'me' : 'them') + (end ? ' cl-end' : '') + '">' + body + (end ? '<small class="msg-ts">' + APP.clockTime(m.ts) + status + '</small>' : '') + '</div>';
  });
  return html;
};

APP.msgLayout = function (convId) {
  const s = APP.db.session;
  const isC = s.role === 'consultant';
  const k = APP.userKey();
  const active = convId ? APP.conv(convId) : null;
  const back = isC ? '#/c/messages' : '#/e/messages';
  const panel = APP.inboxPanelHtml(active ? active.id : null);

  let chatHtml;
  if (!active) {
    chatHtml = '<div class="chat-empty">' + APP.icon('msg', 40) + '<p>Select a conversation to start chatting.</p></div>';
  } else {
    const cp = APP.convCounterparty(active);
    const role = APP.convRole(active);
    const cand = APP.consultant(active.cId);
    const myCv = isC ? cand.cv : null;
    let roleBar = '';
    if (role) {
      const j = role.job, score = !isC ? APP.matchScore(cand, j) : null, b = score != null ? APP.matchBand(score) : null;
      const canInvite = !isC && !role.applied && !role.invited && !role.closed;
      roleBar = '<div class="chat-role"><div class="cr-main"><small class="muted">About</small><a class="cr-title" href="' + (isC ? '#/job/' : '#/e/jobs/') + j.id + '">' + APP.h(j.title) + '</a>' +
        '<span class="pill ' + (role.closed ? 'muted-pill' : 'inv') + '">' + (role.closed ? 'Role closed' : role.state) + '</span></div>' +
        '<div class="cr-acts">' + (b ? '<span class="match ' + b.cls + '" title="Match with this role">' + score + '% match</span>' : '') +
        (canInvite ? '<button type="button" class="btn btn-outline btn-sm" data-action="invite" data-cid="' + cand.id + '" data-jid="' + j.id + '">Invite to apply</button>' : '') + '</div></div>';
    }
    const chips = isC
      ? '<button type="button" class="chip" data-action="chat-insert" data-kind="avail">Share availability</button><button type="button" class="chip" data-action="call-propose" data-conv="' + active.id + '">' + APP.icon('spark', 13) + ' Propose a call</button>'
      : '<button type="button" class="chip" data-action="chat-insert" data-kind="cv">Request CV</button>' +
        (role && !role.applied && !role.invited && !role.closed ? '' : '<button type="button" class="chip" data-action="chat-invite" data-cid="' + cand.id + '">Invite to apply</button>') +
        '<button type="button" class="chip" data-action="call-propose" data-conv="' + active.id + '">' + APP.icon('spark', 13) + ' Propose a call</button>';
    chatHtml =
      '<div class="chat-head"><button type="button" class="icon-btn chat-back" data-action="go" data-href="' + back + '" aria-label="Back to inbox">←</button>' +
      (cp ? cp.avatar + '<div>' + (cp.href ? '<a class="chat-who-link" href="' + APP.h(cp.href) + '">' + APP.h(cp.name) + '</a>' : '<strong>' + APP.h(cp.name) + '</strong>') + '<small class="muted">' + APP.h(cp.sub || '') + '</small></div>' : '') +
      '<button type="button" class="icon-btn chat-x" data-action="go" data-href="' + back + '" title="Close" aria-label="Close conversation">' + APP.icon('x', 18) + '</button></div>' +
      roleBar +
      '<div class="chat-scroll" id="chat-scroll">' + APP.chatMessagesHtml(active, isC) + '</div>' +
      '<div class="chat-actions">' + chips + '</div>' +
      '<form data-form="chat" data-conv-id="' + active.id + '" class="chat-input">' +
      (APP.state.pendingCv && myCv
        ? '<span class="cv-item pending">' + APP.icon('clip', 14) + ' ' + APP.h(myCv.name) + ' <button type="button" class="icon-btn" data-action="clear-cv" aria-label="Remove CV">' + APP.icon('x', 12) + '</button></span>'
        : '') +
      '<textarea name="q" class="input chat-ta" rows="1" aria-label="Message" placeholder="Write a message…" title="Enter to send, Shift+Enter for a new line">' + APP.h(((APP.chatDraft[active.id]) || {}).q || '') + '</textarea>' +
      (isC ? '<button type="button" class="icon-btn" data-action="attach-cv" title="Attach your CV" aria-label="Attach your CV" ' + (myCv ? '' : 'disabled') + '>' + APP.icon('clip', 18) + '</button>' : '') +
      '<button type="submit" class="btn btn-primary btn-sm send">Send</button></form>';
  }

  return '<div class="inbox' + (active ? ' has-active' : '') + '">' +
    '<div class="conv-list card">' +
    '<div class="card-h">Inbox <span class="muted small">(' + panel.count + ')</span></div>' + panel.tools +
    '<div class="conv-items" id="conv-items">' + panel.body + '</div></div>' +
    '<div class="chat card">' + chatHtml + '</div>' +
    '</div>';
};

/* one-time listeners: Enter sends, textarea grows, live inbox search */
if (!APP._inboxBound) {
  APP._inboxBound = true;
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('chat-ta') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (t.form) t.form.requestSubmit();
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('.chat-ta')) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 130) + 'px'; }
    if (t.matches('[data-inbox-q]')) { APP.state.inbox.q = t.value; const it = document.getElementById('conv-items'); const act = document.querySelector('.conv-item.active'); const p = APP.inboxPanelHtml(act ? act.dataset.id : null); if (it) it.innerHTML = p.body; }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-inbox-role]')) { APP.state.inbox.role = t.value; APP.inboxRefresh(); }
  });
}

APP.views['c-msgs'] = function () { return APP.msgLayout(null); };
APP.views['c-msg'] = function (ctx) {
  const cv = APP.conv(ctx.p[0]);
  if (!cv) return '<div class="empty">Conversation not found.</div>';
  APP.openConversation(cv.id);
  return APP.msgLayout(cv.id);
};

/* ------------------------------ introductions ------------------------------ */
