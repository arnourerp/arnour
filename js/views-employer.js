/* ============================================================================
   ARNOUR — EMPLOYER VIEWS (dashboard, company, find talent, jobs, inbox)
   ============================================================================ */

/* ------------------------------ dashboard ------------------------------ */

APP.views['e-dash'] = function () {
  const co = APP.company(APP.db.session.companyId);
  if (!co) return '<div class="empty">Company not found.</div>';

  const jobs = APP.companyJobs(co.id);
  const open = jobs.filter(j => j.status === 'open');
  const applicants = [...new Set(jobs.reduce((a, j) => a.concat(j.applicants || []), []))].map(id => APP.consultant(id)).filter(Boolean);
  const unread = APP.unreadMsgs();
  const systems = (co.sapSystems || []).map(id => APP.productShort(id));

  const stats = [
    [open.length, 'Open roles', '#/e/jobs'],
    [applicants.length, 'Total applicants', '#/e/jobs'],
    [unread, 'Unread messages', '#/e/messages'],
    [systems.length, 'SAP systems', '#/e/company']
  ].map(s =>
    '<a class="card stat-card" href="' + s[2] + '"><strong>' + s[0] + '</strong><small>' + APP.h(s[1]) + '</small></a>'
  ).join('');

  const recentApps = applicants.map(c => ({ c, ts: 0 }))
    .map(x => ({ ...x, ts: Math.max(...jobs.filter(j => (j.applicants || []).includes(x.c.id)).map(j => j.postedTs), 0) }))
    .sort((a, b) => b.ts - a.ts).slice(0, 5);

  const appList = recentApps.length
    ? recentApps.map(x => {
      const applied = jobs.filter(j => (j.applicants || []).includes(x.c.id)).map(j => j.title);
      return APP.personRowHtml(x.c, { sub: applied.length ? 'Applied to ' + APP.h(applied[0]) + (applied.length > 1 ? ' +' + (applied.length - 1) + ' more' : '') : '' });
    }).join('')
    : '<div class="empty small">No applications yet.</div>';

  const jobsMini = jobs.slice(0, 5).map(j =>
    '<a class="app-item" href="#/e/jobs/' + j.id + '">' +
    '<div class="grow"><strong>' + APP.h(j.title) + '</strong><small class="muted">' + (j.applicants || []).length + ' applicant(s) · ' + j.employmentType + ' · ' + APP.h(APP.locText(j)) + (j.status !== 'open' ? ' · Closed' : '') + '</small></div>' +
    APP.icon('check', 16) + '</a>'
  ).join('');

  const pulse = Object.values(APP.db.questions || {})
    .filter(q => (co.sapSystems || []).includes(q.productId))
    .sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0))
    .slice(0, 3);
  /* shared item renderer for the pulse card (own-system items and network fallback) */
  const pulseItem = q => {
    const ans = (q.answers || []).length;
    const tag = APP.productShort(q.productId) + (q.moduleId ? ' · ' + APP.skillName(q.productId, q.moduleId) : '');
    return '<a class="app-item" href="#/community/q/' + q.id + '"><div class="grow"><strong>' + APP.h(q.title) + '</strong><small class="muted">' + APP.h(tag) + ' · ' + ans + ' answer' + (ans === 1 ? '' : 's') + ' · ' + APP.timeAgo(q.createdTs) + '</small></div></a>';
  };
  const enstats = APP.communityNetworkStats();
  const commPulse =
    '<div class="card"><div class="card-h">' + APP.icon('spark', 16) + ' Community pulse <a class="link" href="#/community">Browse →</a></div>' +
    (pulse.length
      ? pulse.map(pulseItem).join('')
      /* A brand-new company has no own-system chatter: fall back to the wider network so the card shows vitality, not emptiness. */
      : '<p class="muted small">No chatter on your systems yet — meanwhile across the community: ' + enstats.questions + ' questions · ' + enstats.answers + ' answers.</p>' +
        APP.recentCommunityItems(null, 2).map(pulseItem).join('')) +
    '</div>';

  return '<div>' + APP.getStartedHtml('employer') +
    '<div class="page-head"><h2>' + APP.h(co.name) + '</h2><p class="muted">Here\'s what\'s moving in your talent pipeline.</p>' +
    '<button class="btn btn-primary" data-action="go" data-href="#/e/jobs/new">' + APP.icon('plus', 15) + ' Post a job</button></div>' +
    '<div class="stat-row">' + stats + '</div>' +
    '<div class="dash-grid dash-grid-main mt16">' +
    '<section>' +
    '<div class="feed-head"><h2>Recent applicants</h2><a class="link" href="#/e/talent">Search all talent →</a></div>' +
    appList +
    APP.communityBlockHtml('employer') +
    '</section>' +
    '<aside>' +
    '<div class="card"><div class="card-h">Your roles</div>' +
    (jobsMini || '<div class="empty small">No roles posted yet.</div>') +
    '<a class="btn btn-outline btn-sm mt16" href="#/e/jobs">Manage all roles</a>' +
    '</div>' +
    '<div class="card tip-card">' + APP.icon('spark', 18) + '<div><strong>Talent tip</strong><p class="muted small">Use the Find Talent search with the projects slider to find professionals who\'ve shipped similar work before.</p></div></div>' +
    '</aside>' +
    '</div></div>';
};

/* ------------------------------ company profile ------------------------------ */

APP.views['e-company'] = function () {
  const co = APP.company(APP.db.session.companyId);
  if (!co) return '<div class="empty">Company not found.</div>';
  const editing = APP.state.coEdit && APP.profileDraft;
  const d = editing ? APP.profileDraft : co;
  const jobs = APP.companyJobs(co.id);

  let body;
  if (!editing) {
    body = APP.privacyCardHtml() +
      '<div class="card co-banner-card">' +
      '<div class="co-banner"><span class="brand-logo xl">' + APP.h(APP.initials(co.name)) + '</span></div>' +
      '<div class="co-banner-body">' +
      '<div class="co-id"><h2>' + APP.h(co.name) + '</h2>' +
      '<p class="muted">' + APP.h(co.industry) + ' · ' + APP.h(co.size) + ' · ' + APP.icon('pin', 13) + ' ' + APP.h(APP.locText(co)) + (co.website ? ' · ' + APP.h(co.website) : '') + '</p></div>' +
      (co.contactName ? '<div class="co-contact muted small">' + APP.icon('users', 13) + ' ' + APP.h(co.contactName) + (co.contactTitle ? ' · ' + APP.h(co.contactTitle) : '') + '</div>' : '') +
      '<button class="btn btn-outline btn-sm" data-action="co-edit-on">Edit profile</button>' +
      '</div></div>' +

      (co.about ? '<div class="card"><div class="card-h">About</div><p>' + APP.h(co.about) + '</p></div>' : '') +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-h">SAP systems in use</div><div class="chip-wrap">' +
      ((co.sapSystems || []).length ? co.sapSystems.map(id => '<span class="chip">' + APP.h(APP.productShort(id)) + '</span>').join('') : '<span class="muted small">Not listed yet.</span>') +
      '</div></div>' +
      '<div class="card"><div class="card-h">Open roles</div>' +
      (jobs.filter(j => j.status === 'open').length
        ? jobs.filter(j => j.status === 'open').map(j => '<a class="app-item" href="#/e/jobs/' + j.id + '"><div class="grow"><strong>' + APP.h(j.title) + '</strong><small class="muted">' + (j.applicants || []).length + ' applicant(s)</small></div></a>').join('')
        : '<div class="empty small">None open right now.</div>') +
      '</div></div>' +
      '<div class="mt16">' + APP.shareHtml({
        title: co.name,
        text: co.name + (co.industry ? ' (' + co.industry + ')' : '') + ' is hiring for SAP roles on Arnour.',
        tags: '#SAP #Hiring',
        url: APP.shareUrl('#/company/' + co.id)
      }) + '</div>' +
      '<p class="muted small mt8">Anyone with this link can view your public company page — <a class="link" href="#/company/' + co.id + '" data-action="preview-public" data-href="#/company/' + co.id + '" data-back="#/e/company">open it to preview →</a></p>';
  } else {
    body =
      APP.editBarHtml('Editing your company profile', 'f-company-edit') +
      '<div class="card">' +
      '<form data-form="company-edit" id="f-company-edit">' +
      '<label class="field"><span class="label">Company name</span><input name="name" class="input" value="' + APP.h(d.name) + '"></label>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Industry</span><select name="industry" class="input">' + APP.opt(APP.industries.map(i => [i, i]), d.industry) + '</select></label>' +
      '<label class="field"><span class="label">Size</span><select name="size" class="input">' + APP.opt(APP.companySizes.map(s => [s, s]), d.size) + '</select></label>' +
      '<label class="field"><span class="label">Country *</span><select name="country" class="input">' + APP.countryOptions(d.country) + '</select>' + '</label>' +
      APP.cityInputHtml(d.country, d.city) +
      '<label class="field"><span class="label">Website</span><input name="website" class="input" value="' + APP.h(d.website) + '"></label>' +
      '</div>' +
      '<label class="field"><span class="label">About</span><textarea name="about" class="input" rows="4" placeholder="What does the company do, and what SAP systems does it run?">' + APP.h(d.about) + '</textarea></label>' +
      '<div class="field"><span class="label">SAP systems in use</span><div class="chip-wrap">' + APP.chipGroup('profile', 'sapSystems', CATALOG.products, d.sapSystems || []) + '</div></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Contact name</span><input name="contactName" class="input" value="' + APP.h(d.contactName) + '"></label>' +
      '<label class="field"><span class="label">Contact title</span><input name="contactTitle" class="input" value="' + APP.h(d.contactTitle) + '"></label>' +
      '</div>' +
      APP.editFootHtml() +
      '</form></div>';
  }

  return '<div class="narrow">' +
    '<div class="crumb"><a class="link" href="#/e/dashboard">← Dashboard</a>' + (editing ? '<span class="pill">Editing</span>' : '') + '</div>' +
    body + '</div>';
};

/* ------------------------------ find talent ------------------------------ */

APP.applyTalentFilters = function (list) {
  const f = APP.state.talentFilters;
  return list.filter(c0 => {
    const c = APP.cv(c0);
    if (f.q) {
      const hay = (APP.consultantFullName(c) + ' ' + c.headline + ' ' + (c.summary || '') + ' ' + APP.roleTypeLine(c) + ' ' + (c.skills || []).map(k => APP.productShort(k.productId) + ' ' + APP.skillName(k.productId, k.moduleId)).join(' ') + ' ' + APP.tagList(c.otherSkills || '').join(' ') + ' ' + (c.specialties || []).map(id => { const x = APP.SPECIAL_IDX[id] || {}; return APP.specialtyName(id) + ' ' + (x.name || '') + ' ' + (x.category || ''); }).join(' ')).toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    if (f.product && !(c.skills || []).some(k => k.productId === f.product)) return false;
    if (f.module && !(c.skills || []).some(k => k.productId === f.product && k.moduleId === f.module)) return false;
    if (f.region && f.region !== 'all') {
      const cc = APP.countriesById[c.country];
      if (!cc || cc.region !== f.region) return false;
    }
    if (f.country && c.country !== f.country) return false;
    if (f.nationality && c.nationality !== f.nationality) return false;
    if (f.gender && c.gender !== f.gender) return false;
    if (f.roleType && APP.rtList(c).indexOf(f.roleType) === -1) return false;
    if (f.levels && f.levels.length && !f.levels.includes(c.level)) return false;
    if (f.langs && f.langs.length && !f.langs.some(l => (c.languages || []).includes(l))) return false;
    if (f.availability && c.availability !== f.availability) return false;
    if (f.minYears && c.yearsExp < f.minYears) return false;
    if (f.minProjects) {
      /* roles that don't record per-module counts (PM, Basis, Architect, Support, Key User, Junior) are judged on their single "projects led / programs" number, or not at all */
      const maxProjects = Math.max(0, +c.programs || 0, ...(c.skills || []).map(k => k.projects || 0));
      if (maxProjects < f.minProjects && (APP.countsTracked(c) || +c.programs > 0)) return false;
    }
    if (f.industries && f.industries.length) {
      if (!((c.industries || []).some(x => f.industries.indexOf(x) !== -1))) return false;
    }
    if (f.specialties && f.specialties.length) {
      const mine = c.specialties || [];
      const hit = f.specialties.some(id =>
        mine.indexOf(id) !== -1 ||
        mine.some(x => ((APP.SPECIAL_IDX[x] || {}).categoryId) === id || ((APP.SPECIAL_IDX[id] || {}).categoryId) === x)
      );
      if (!hit) return false;
    }
    if (f.workPref) { if ((c.workPrefs || []).indexOf(f.workPref) === -1) return false; }
    if (f.cert === 'any-module') {
      if (!(c.skills || []).some(k => k.certified)) return false;
    } else if (f.cert === 'in-module') {
      const inModule = f.product && f.module && (c.skills || []).some(k => k.productId === f.product && k.moduleId === f.module && k.certified);
      if (!inModule && f.product && f.module) return false;
      if (!inModule && !(c.skills || []).some(k => k.certified)) return false;
    }
    return true;
  });
};

/* ---- Find Talent: faceted search (v2) ---- */
APP.TF_REGION_LABEL = (r) => (r === 'all' ? 'All' : APP.regionName(r));

/* Every active filter as [key, value, label] — drives the dismissible chips and the per-section counters. */
APP.talentActiveFilters = function (f) {
  const out = [];
  if (f.q) out.push(['q', '', '“' + f.q + '”']);
  if (f.roleType) out.push(['roleType', '', APP.roleTypeLabel(f.roleType) || f.roleType]);
  (f.levels || []).forEach(v => out.push(['levels', v, v]));
  if (f.product) out.push(['product', '', APP.productShort(f.product)]);
  if (f.module) out.push(['module', '', APP.skillName(f.product, f.module)]);
  if (f.cert) out.push(['cert', '', f.cert === 'any-module' ? 'Certified (any module)' : 'Certified in that module']);
  (f.specialties || []).forEach(v => out.push(['specialties', v, APP.specialtyName(v)]));
  if (f.minYears) out.push(['minYears', '', f.minYears + '+ yrs experience']);
  if (f.minProjects) out.push(['minProjects', '', f.minProjects + '+ projects']);
  (f.industries || []).forEach(v => out.push(['industries', v, v]));
  if (f.country) out.push(['country', '', APP.countryName(f.country)]);
  if (f.region && f.region !== 'all') out.push(['region', '', APP.TF_REGION_LABEL(f.region)]);
  if (f.workPref) out.push(['workPref', '', 'Open to ' + f.workPref]);
  if (f.availability) out.push(['availability', '', f.availability]);
  (f.langs || []).forEach(v => out.push(['langs', v, v]));
  if (f.nationality) out.push(['nationality', '', f.nationality]);
  if (f.gender) out.push(['gender', '', APP.genderLabel(f.gender)]);
  return out;
};
APP.TF_SECTION_KEYS = {
  role: ['roleType'], products: ['product', 'module', 'cert'], specialties: ['specialties'],
  experience: ['levels', 'minYears', 'minProjects'], industry: ['industries'], availability: ['availability'],
  location: ['country', 'region', 'workPref'], people: ['langs', 'nationality', 'gender']
};
APP.tfCount = function (active, section) {
  const keys = APP.TF_SECTION_KEYS[section];
  return active.filter(a => keys.indexOf(a[0]) !== -1).length;
};
APP.tfSection = function (key, title, count, openByDefault, body) {
  const st = APP.state.jobDet || {};
  const open = st['tf-' + key] === undefined ? openByDefault : st['tf-' + key];
  return '<details class="tf-sec" data-det="tf-' + key + '"' + (open ? ' open' : '') + '><summary><span class="tf-title">' + APP.h(title) + '</span>' +
    (count ? '<span class="count-pill" title="' + count + ' active">' + count + '</span>' : '') + '</summary><div class="tf-body">' + body + '</div></details>';
};

/* Deterministic "last active" for sample data that carries no timestamp; real activity (sign-in) overrides it. */
APP.lastActive = function (c) {
  if (c.lastActiveTs) return c.lastActiveTs;
  let h = 0; const id = String(c.id || '');
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return Date.now() - (h % 21) * 864e5 - (h % 7) * 36e5;
};
/* "Best match" for a search with no job attached: keyword hits, depth in the chosen product/module, certification. */
APP.talentRelevance = function (c, f) {
  c = APP.cv(c);
  let s = 0;
  const q = (f.q || '').toLowerCase().trim();
  if (q) {
    if (APP.consultantFullName(c).toLowerCase().indexOf(q) !== -1) s += 5;
    if ((c.headline || '').toLowerCase().indexOf(q) !== -1) s += 3;
    if ((c.skills || []).some(k => (APP.productShort(k.productId) + ' ' + APP.skillName(k.productId, k.moduleId)).toLowerCase().indexOf(q) !== -1)) s += 2;
  }
  if (f.product) {
    const hit = (c.skills || []).filter(k => k.productId === f.product && (!f.module || k.moduleId === f.module));
    s += Math.min(20, Math.max(0, ...hit.map(k => Number(k.projects) || 0))) + (hit.some(k => k.certified) ? 5 : 0);
  }
  if ((c.skills || []).some(k => k.certified)) s += 1;
  return s;
};
APP.sortTalent = function (list, f) {
  const mode = f.sort || 'best';
  const idx = new Map(list.map((c, i) => [c.id, i]));
  const key = mode === 'years' ? (c => Number(c.yearsExp) || 0) : mode === 'active' ? (c => APP.lastActive(c)) : (c => APP.talentRelevance(c, f));
  return list.slice().sort((a, b) => key(b) - key(a) || idx.get(a.id) - idx.get(b.id));
};
APP.TF_SORTS = [['best', 'Best match'], ['years', 'Years of experience'], ['active', 'Recently active']];

APP.activeFilterBarHtml = function (active) {
  if (!active.length) return '';
  return '<div class="af-bar" role="region" aria-label="Active filters"><span class="af-label">Active filters</span>' +
    active.map(a => '<button type="button" class="chip chip-on af-chip" data-action="tf-remove" data-key="' + a[0] + '" data-value="' + APP.h(a[1]) + '" aria-label="Remove filter ' + APP.h(a[2]) + '">' + APP.h(a[2]) + ' <span aria-hidden="true">✕</span></button>').join('') +
    '<button type="button" class="link af-clear" data-action="talent-reset">Clear all</button></div>';
};

APP.talentFilterPanelHtml = function (f, active) {
  const cnt = (s) => APP.tfCount(active, s);
  const sel = (name, opts, cur, any) => '<select name="' + name + '" class="input" aria-label="' + APP.h(any) + '"><option value="">' + APP.h(any) + '</option>' + opts + '</select>';
  const roleBody = '<select name="roleType" class="input" aria-label="Role type"><option value="">Any role type</option>' + APP.roleTypes.map(t => '<option value="' + t.id + '"' + (f.roleType === t.id ? ' selected' : '') + '>' + APP.h(t.name) + '</option>').join('') + '</select>';
  const prodBody =
    '<label class="field"><span class="label">SAP product</span><select name="product" class="input"><option value="">Any product</option>' + APP.productOptions(f.product) + '</select></label>' +
    '<label class="field"><span class="label">Module</span><select name="module" class="input">' + APP.moduleOptions(f.product || null, f.module) + '</select></label>' +
    '<div class="field"><span class="label">Certification</span><div class="chip-wrap">' + APP.chipGroup('talentFilters', 'cert', [{ id: '', name: 'Any' }, { id: 'any-module', name: 'Certified (any module)' }, { id: 'in-module', name: 'Certified in that module' }], f.cert, true) + '</div></div>';
  const specBody = '<div class="spec-panel">' + APP.specialtyChipsHtml('talentFilters', f.specialties || []) + '</div><p class="field-hint">Shows professionals with any of the specialties you pick.</p>';
  const expBody =
    '<div class="field"><span class="label">Level</span><div class="chip-wrap">' + APP.chipGroup('talentFilters', 'levels', APP.levels, f.levels) + '</div></div>' +
    '<div class="range-row"><span class="label">Min experience</span><output>' + f.minYears + ' yrs</output><input type="range" class="range" min="0" max="20" value="' + f.minYears + '" name="minYears" data-slider-out data-suffix=" yrs"></div>' +
    '<div class="range-row"><span class="label">Min projects (any skill)</span><output>' + f.minProjects + '</output><input type="range" class="range" min="0" max="15" value="' + f.minProjects + '" name="minProjects" data-slider-out></div>';
  const indBody = '<div class="chip-wrap">' + APP.chipGroup('talentFilters', 'industries', APP.industries, f.industries) + '</div>';
  const availBody = '<label class="field"><span class="label">Can start</span><select name="availability" class="input"><option value="">Any</option>' + APP.opt(APP.availability.map(a => [a, a]), f.availability) + '</select></label>';
  const locBody =
    '<label class="field"><span class="label">Country</span><select name="country" class="input"><option value="">Any country</option>' + APP.countryOptions(f.country, true) + '</select></label>' +
    '<div class="field"><span class="label">Region</span><div class="chip-wrap">' + ['all'].concat(Object.keys(APP.regions)).map(r =>
      '<button type="button" class="chip ' + (f.region === r ? 'chip-on' : '') + '" data-action="chip" data-scope="talentFilters" data-group="region" data-single="1" data-value="' + r + '">' + APP.TF_REGION_LABEL(r) + '</button>').join('') + '</div></div>' +
    '<label class="field"><span class="label">Work preference</span><select name="workPref" class="input"><option value="">Any</option>' + APP.opt(APP.workPrefs.map(w => [w, w]), f.workPref) + '</select></label>';
  const peopleBody =
    '<div class="field"><span class="label">Languages</span><div class="chip-wrap">' + APP.chipGroup('talentFilters', 'langs', APP.languages, f.langs) + '</div></div>' +
    '<label class="field"><span class="label">Nationality</span><select name="nationality" class="input"><option value="">Any</option>' + APP.opt(APP.nationalities.map(n => [n, n]), f.nationality) + '</select></label>' +
    '<label class="field"><span class="label">Gender</span><select name="gender" class="input"><option value="">Any</option>' + APP.opt(APP.genders, f.gender) + '</select></label>';
  return '<form data-form="talent-search" class="filters card' + (APP.state.tfMobile ? ' tf-open' : '') + '" id="tf-panel">' +
    '<div class="card-h">Filters' + (active.length ? ' <span class="count-pill">' + active.length + '</span>' : '') + ' <button type="button" class="link" data-action="talent-reset">Reset</button></div>' +
    APP.tfSection('role', 'Role type', cnt('role'), true, roleBody) +
    APP.tfSection('products', 'SAP products & modules', cnt('products'), true, prodBody) +
    APP.tfSection('specialties', 'Specialties', cnt('specialties'), false, specBody) +
    APP.tfSection('experience', 'Experience', cnt('experience'), false, expBody) +
    APP.tfSection('industry', 'Industry solutions', cnt('industry'), false, indBody) +
    APP.tfSection('availability', 'Availability', cnt('availability'), false, availBody) +
    APP.tfSection('location', 'Location & work style', cnt('location'), false, locBody) +
    APP.tfSection('people', 'Language, nationality & gender', cnt('people'), false, peopleBody) +
    '</form>';
};

APP.views['e-talent'] = function () {
  const f = APP.state.talentFilters;
  const all = Object.values(APP.db.consultants);
  const results = APP.sortTalent(APP.applyTalentFilters(all), f);
  const active = APP.talentActiveFilters(f);
  const list = results.map(c => APP.talentCard(c)).join('');
  const sortSel = '<select name="sort" class="input rb-sort-sel" aria-label="Sort professionals">' + APP.TF_SORTS.map(s => '<option value="' + s[0] + '"' + ((f.sort || 'best') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select>';
  const bar =
    '<form data-form="talent-q" class="results-bar">' +
    '<div class="rb-search"><span class="nav-search-ico">' + APP.icon('search') + '</span><input name="q" value="' + APP.h(f.q) + '" placeholder="Search name, headline or skill…" aria-label="Search professionals"><button type="submit" class="btn btn-primary btn-sm">Search</button></div>' +
    '<div class="rb-row"><button type="button" class="btn btn-outline btn-sm tf-mobile-btn" data-action="tf-toggle" aria-controls="tf-panel" aria-expanded="' + (APP.state.tfMobile ? 'true' : 'false') + '">Filters' + (active.length ? ' (' + active.length + ')' : '') + '</button>' +
    '<span class="rb-count" role="status" aria-live="polite">Showing <strong>' + results.length + '</strong>' + (results.length !== all.length ? ' of ' + all.length : '') + ' SAP professional' + (results.length === 1 ? '' : 's') + '</span>' +
    '<span class="grow"></span><label class="rb-sort"><span>Sort</span>' + sortSel + '</label></div>' +
    '</form>';
  return '<div class="search-layout">' +
    APP.talentFilterPanelHtml(f, active) +
    '<section>' + bar + APP.activeFilterBarHtml(active) +
    '<div id="tf-results">' + (list || APP.emptyStateHtml({ icon: 'filter', title: 'No SAP professionals match these criteria', text: 'Try removing module filters or widening your location search.', action: 'reset-filters', actionLabel: 'Reset all filters' })) + '</div>' +
    '</section></div>';
};

/* ------------------------------ talent detail ------------------------------ */

APP.views['e-talent-detail'] = function (ctx) {
  const c0 = APP.consultant(ctx.p[0]);
  if (!c0) return '<div class="empty">Professional not found.</div>';
  const pv = !!ctx.preview;
  const c = APP.cv(c0, pv);
  const name = APP.consultantFullName(c);
  const E = APP.h;
  const sess = APP.db.session;

  /* ---- community footprint ---- */
  const tcs = APP.communityStats(c.id);
  const tbits = [];
  if (tcs.questions) tbits.push(tcs.questions + ' question' + (tcs.questions > 1 ? 's' : ''));
  if (tcs.answers) tbits.push(tcs.answers + ' answer' + (tcs.answers > 1 ? 's' : ''));
  if (tcs.articles) tbits.push(tcs.articles + ' article' + (tcs.articles > 1 ? 's' : ''));
  if (tcs.acceptedAnswers) tbits.push(tcs.acceptedAnswers + ' marked accepted');
  { const rp = APP.reputation(c.id); if (rp.level) tbits.unshift(rp.levelName + ' · ' + rp.points + ' pts'); }
  const commSec = tbits.length
    ? '<section class="jd-sec"><h2>' + APP.icon('spark', 16) + ' In the community</h2><p class="muted">' + E(tbits.join(' · ')) + ' — an active community footprint is a strong delivery signal.</p></section>' : '';

  /* ---- SAP experience: one block per product ---- */
  const byProd = {};
  (c.skills || []).forEach(k => { (byProd[k.productId] = byProd[k.productId] || []).push(k); });
  const prodHtml = Object.keys(byProd).map(pid => {
    const list = byProd[pid].slice().sort((a, b) => (Number(b.projects) || 0) - (Number(a.projects) || 0));
    const tot = list.reduce((n, k) => n + (Number(k.projects) || 0), 0);
    return '<div class="td-prod"><div class="td-prod-h"><strong>' + E(APP.productShort(pid)) + '</strong><span class="muted small">' + tot + ' project' + (tot === 1 ? '' : 's') + '</span></div>' +
      '<ul class="td-mods">' + list.map(k => '<li><span>' + E(APP.skillName(k.productId, k.moduleId)) + (k.certified ? ' <span class="td-cert" title="Certified">' + APP.icon('check', 12) + ' Certified</span>' : '') + '</span><b>' + (Number(k.projects) || 0) + '</b></li>').join('') + '</ul></div>';
  }).join('');
  const expSec = '<section class="jd-sec"><h2>SAP experience</h2>' +
    (prodHtml ? '<p class="muted small td-hint">Projects delivered per module</p><div class="td-prods">' + prodHtml + '</div>' : '<p class="muted">No skills tagged.</p>') + '</section>';

  const chips = (arr) => arr.map(x => '<span class="chip">' + E(x) + '</span>').join('');
  const specs = (c.specialties || []).map(id => '<span class="chip" title="' + E(APP.specialtyLabel(id)) + '">' + E(APP.specialtyName(id)) + '</span>').join('') + chips(c.otherSkills || []);
  const detail = (title, body) => body ? '<div class="td-det"><h3>' + title + '</h3><div class="chip-wrap">' + body + '</div></div>' : '';
  const detSec = (c.industries || []).length || specs || (c.languages || []).length
    ? '<section class="jd-sec"><h2>Profile details</h2>' +
      detail('Industries', chips(c.industries || [])) + detail('Specialties', specs) + detail('Languages', chips(c.languages || [])) + '</section>' : '';

  const aboutSec = c.summary ? '<section class="jd-sec"><h2>About</h2><div class="job-desc-full">' + E(c.summary) + '</div></section>' : '';

  /* ---- side panel: actions + fit with this company's open roles ---- */
  const myJobs = sess && sess.companyId ? APP.companyJobs(sess.companyId).filter(j => j.status === 'open') : [];
  const fits = myJobs
    .filter(j => (j.applicants || []).indexOf(c.id) !== -1 || (APP.certOkForJob(c, j) && APP.langOkForJob(c, j)))
    .map(j => ({ j: j, score: APP.matchScore(c, j) }))
    .sort((a, b) => b.score - a.score).slice(0, 5);
  const fitRows = fits.map(x => {
    const b = APP.matchBand(x.score);
    const applied = (x.j.applicants || []).indexOf(c.id) !== -1;
    const invited = (x.j.invited || []).indexOf(c.id) !== -1;
    const why = APP.fitReasons(c, x.j).slice(0, 3);
    const act = applied ? '<span class="pill inv">' + APP.icon('check', 12) + ' Applied</span>'
      : invited ? '<span class="pill inv">' + APP.icon('check', 12) + ' Invited</span>'
      : '<button class="btn btn-outline btn-sm" data-action="invite" data-cid="' + c.id + '" data-jid="' + x.j.id + '">Invite to apply</button>';
    return '<li class="td-fit"><div class="td-fit-top"><a class="td-fit-t" href="#/e/jobs/' + x.j.id + '">' + E(x.j.title) + '</a><span class="match ' + b.cls + '">' + x.score + '%</span></div>' +
      (why.length ? '<p class="muted small">' + E(why.join(' · ')) + '</p>' : '') + '<div class="td-fit-a">' + act + '</div></li>';
  }).join('');

  const side = pv
    ? '<aside class="jd-side"><div class="card jd-act"><button class="btn btn-primary jd-apply" disabled>' + APP.icon('lock', 15) + ' Request introduction</button><p class="muted small td-cvnote">Companies see this button. If you accept, they get your name, photo and CV (your choice).</p></div></aside>'
    : '<aside class="jd-side"><div class="card jd-act">' +
    (c._anon
      ? APP.talentContactHtml(c) + '<p class="muted small td-cvnote">' + APP.icon('lock', 12) + ' This professional is anonymous. Name, photo and CV are shared if they accept your introduction.</p></div>'
      : '<button class="btn btn-primary jd-apply" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 15) + ' Message ' + E(c.firstName || name) + '</button>' +
        '<button class="btn btn-outline btn-sm td-cv" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('file', 13) + ' Request CV</button>' +
        '<p class="muted small td-cvnote">CVs are shared in the inbox when the professional chooses to.</p></div>') +
    (fitRows ? '<div class="card jd-match"><h2>Fit with your open roles</h2><ul class="td-fits">' + fitRows + '</ul></div>' : '') +
    '</aside>';

  const similar = pv ? [] : Object.values(APP.db.consultants)
    .filter(x => x.id !== c.id && (x.skills || []).some(k => c.skills.some(s => s.productId === k.productId)))
    .slice(0, 3);

  const facts = [
    ['pin', APP.locText(c)],
    ['users', [c.nationality, c.level, c.yearsExp ? c.yearsExp + ' yrs exp' : ''].filter(Boolean).join(' · ')],
    ['briefcase', c.roleType ? APP.roleTypeLine(c) : ''],
    ['check', c.availability],
    ['home', c.workPrefs && c.workPrefs.length ? 'Open to ' + c.workPrefs.join(' / ') : '']
  ].filter(f => f[1]).map(f => '<span>' + APP.icon(f[0], 14) + ' ' + E(f[1]) + '</span>').join('');

  return '<div class="jd">' +
    (pv ? '<div class="crumb"><a class="link" href="#/c/profile">← Back to my profile</a></div><div class="card preview-banner">' + APP.icon('lock', 16) + '<div><b>This is how companies see you in anonymous mode</b><div class="muted small">' + (c0.anon ? 'Anonymous mode is on.' : 'Anonymous mode is currently off — companies see your full profile. Turn it on from your profile.') + '</div></div></div>' : APP.crumbHtml('#/e/talent', 'Talent search')) +
    '<header class="jd-head card td-head">' + APP.avatarHtml(name, 'xl', c._anon) +
    '<div class="grow"><h1 class="jd-title">' + E(name) + APP.samplePill(c) + (c._anon ? ' <span class="pill anon-pill">' + APP.icon('lock', 12) + ' Anonymous</span>' : '') + '</h1>' +
    (APP.LIVE && c.sample ? '<p class="sample-note">Sample profile, for illustration. Messages to sample profiles are not answered.</p>' : '') +
    (c.headline ? '<p class="muted td-headline">' + E(c.headline) + '</p>' : '') +
    '<div class="job-meta">' + facts + '</div>' +
    '<div class="td-keys">' + (APP.SHOW_RATES ? '<span class="td-key"><small>Rate</small><b>' + APP.rateHtml(c) + '</b></span>' : '') +
    (c.linkedin ? '<a class="ext-link" href="' + E(APP.normUrl(c.linkedin)) + '" target="_blank" rel="noopener">' + APP.icon('ext', 14) + ' LinkedIn</a>' : '') +
    '</div></div></header>' +
    '<div class="jd-grid"><div class="jd-main card">' + aboutSec + (APP.isLeadRole(c) ? detSec + expSec : expSec + detSec) + commSec + '</div>' + side + '</div>' +
    (similar.length ? '<div class="feed-head mt16"><h3>Similar talent</h3></div><div>' + similar.map(x => APP.talentCard(x)).join('') + '</div>' : '') +
    '</div>';
};

/* ------------------------------ jobs list / post / detail ------------------------------ */

APP.views['e-jobs'] = function () {
  const co = APP.company(APP.db.session.companyId);
  if (!co) return '<div class="empty">Company not found.</div>';
  const jobs = APP.companyJobs(co.id).sort((a, b) => b.postedTs - a.postedTs);
  const list = jobs.map(j =>
    '<div class="card job-card" data-action="go" data-href="#/e/jobs/' + j.id + '" style="cursor:pointer">' +
    '<div class="job-top"><div class="job-tt"><h3>' + APP.h(j.title) + (j.status !== 'open' ? ' <span class="pill muted-pill">Closed</span>' : '') + '</h3>' +
    '<p class="muted">' + APP.h(APP.locText(j)) + (j.remote ? ' · Remote-friendly' : '') + ' · Posted ' + APP.timeAgo(j.postedTs) + '</p></div>' +
    '<span class="match m-mid">' + (j.applicants || []).length + ' applicant(s)</span>' + (APP.newApplicants1(co, j) ? '<span class="pill new-pill">' + APP.newApplicants1(co, j) + ' new</span>' : '') + (APP.safeApplyUrl(j) ? '<span class="pill ext-pill" title="Candidates apply on your career portal">' + APP.icon('ext', 12) + ' Applies on your site</span>' : '') + '</div>' +
    '<div class="job-reqs">' + APP.reqChipsHtml(j, '') + (APP.jobIndustries(j).length ? '<span class="chip" title="' + APP.h(APP.jobIndustries(j).join(', ')) + '">' + APP.h(APP.jobIndustryLabel(j, 2)) + '</span>' : '') + (j.certification ? '<span class="chip">' + APP.h('Cert: ' + (j.certification === 'required' ? 'required' : 'preferred')) + '</span>' : '') + (j.preferredLangs && j.preferredLangs.length ? '<span class="chip">' + APP.h('Preferred: ' + j.preferredLangs.join(', ')) + '</span>' : '') + (j.preferredSpecialties && j.preferredSpecialties.length ? '<span class="chip">' + APP.h('Preferred: ' + j.preferredSpecialties.map(id => APP.specialtyName(id)).join(', ')) + '</span>' : '') + '</div>' +
    '<div class="job-foot"><span class="muted small">' + (j.editedTs ? 'Edited ' + APP.timeAgo(j.editedTs) : '') + '</span><button class="btn btn-outline btn-sm" data-action="go" data-href="#/e/jobs/' + j.id + '/edit">Edit</button></div>' +
    '</div>'
  ).join('');

  const tab = location.hash === '#/e/intros' ? 'intros' : 'roles';
  const nIntro = APP.pendingIntrosFor();
  const tabs = '<div class="seg-tabs" role="tablist" aria-label="My roles">' +
    '<a role="tab" aria-selected="' + (tab === 'roles') + '" class="seg-tab' + (tab === 'roles' ? ' on' : '') + '" href="#/e/jobs">Roles <span class="seg-n">' + jobs.length + '</span></a>' +
    '<a role="tab" aria-selected="' + (tab === 'intros') + '" class="seg-tab' + (tab === 'intros' ? ' on' : '') + '" href="#/e/intros">Introductions' + (nIntro ? ' <span class="seg-n seg-alert">' + nIntro + '</span>' : '') + '</a></div>';
  const nNewA = APP.newApplicants(co);
  const attn = APP.attnLineHtml([
    nNewA ? '<strong>' + nNewA + ' new applicant' + (nNewA > 1 ? 's' : '') + '</strong> — marked “new” on the roles below' : '',
    nIntro ? '<a class="link" href="#/e/intros">' + nIntro + ' introduction request' + (nIntro > 1 ? 's' : '') + ' waiting for your answer</a>' : ''
  ]);
  return '<div class="narrow">' +
    '<div class="page-head"><h2>My roles</h2>' +
    '<button class="btn btn-primary" data-action="go" data-href="#/e/jobs/new">' + APP.icon('plus', 15) + ' Post a job</button></div>' + tabs + attn +
    (tab === 'intros' ? APP.introsPageHtml(true)
      : (list || '<div class="card empty">No roles posted yet — your first job takes about a minute.</div>')) +
    '</div>';
};

APP.jobNewDefaults = function () {
  return {
    title: '', roleType: '', city: '', country: '', remote: false, employmentType: 'Contract',
    duration: '6 months', currency: 'USD', ratePeriod: 'day', rateMin: '', rateMax: '',
    minExp: '', level: '', industries: [], industry: '', certification: '',
    languages: [], preferredLangs: [], preferredSpecialties: [], requires: [{ productId: 's4onprem', moduleId: '', minProjects: 0, orPrev: false }], description: ''
  };
};

/* One form for posting and editing a role. mode 'edit' pre-fills from the saved role (draft.editId). */
APP.jobFormView = function (mode) {
  const co = APP.company(APP.db.session.companyId);
  if (!co) return '<div class="empty">Company not found.</div>';
  const editing = mode === 'edit';
  if (!editing && (!APP.jobNewDraft || APP.jobNewDraft.editId)) { APP.jobNewDraft = Object.assign(APP.jobNewDefaults(), { country: co.country, city: co.city, confidential: false }); APP.state.jobStep = 1; APP.state.jobErr = null; }
  const d = APP.jobNewDraft;

  const st = APP.state.jobDet || {};
  const nSpec = (d.preferredSpecialties || []).length;
  const nMore = (d.industries || []).length + (d.preferredLangs || []).length;
  const openSpec = st.spec !== undefined ? st.spec : nSpec > 0;
  const openMore = st.more !== undefined ? st.more : editing;
  const sec = (n, title, sub, body) =>
    '<section class="card form-sec"><div class="sec-h"><span class="sec-n">' + n + '</span><div><h3>' + title + '</h3>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div></div>' + body + '</section>';

  const err = (k) => (!editing && APP.state.jobErr && APP.state.jobErr[k]) ? '<p class="field-error" role="alert" data-for="' + k + '">' + APP.h(APP.state.jobErr[k]) + '</p>' : '';
  const basics =
    '<label class="field"><span class="label">Job title *</span><input name="title" class="input" value="' + APP.h(d.title) + '" placeholder="S/4HANA FICO Consultant"' + (!editing && APP.state.jobErr && APP.state.jobErr.title ? ' aria-invalid="true"' : '') + '>' + err('title') + '</label>' +
    '<label class="field"><span class="label">Role type *</span><select name="roleType" class="input"' + (!editing && APP.state.jobErr && APP.state.jobErr.roleType ? ' aria-invalid="true"' : '') + '>' +
    APP.opt([['', 'Select the type of role…']].concat(APP.roleTypes.map(t => [t.id, t.name])), d.roleType) + '</select>' +
    '<p class="field-hint">' + (d.roleType && APP.roleTypeById[d.roleType] ? APP.h(APP.roleTypeById[d.roleType].sub) + ' ' : '') + 'It decides how professionals are ranked — for example, project managers are matched on delivery experience, not on every SAP module.</p>' + err('roleType') + '</label>' +
    '<div class="form-grid">' +
    '<label class="field"><span class="label">Country *</span><select name="country" class="input">' + APP.countryOptions(d.country) + '</select></label>' +
    APP.cityInputHtml(d.country, d.city) +
    '<label class="field"><span class="label">Type</span><select name="employmentType" class="input">' + APP.opt(APP.jobTypes.map(t => [t, t]), d.employmentType) + '</select></label>' +
    '<label class="field"><span class="label">Duration</span><select name="duration" class="input">' + APP.opt(((d.employmentType === 'Full-time') ? ['Permanent'] : APP.durations.filter(x => x !== 'Permanent')).map(x => [x, x]), d.duration) + '</select></label>' +
    '</div>' +
    '<label class="field"><span class="label">Apply on your own career portal <span class="muted">(optional)</span></span><input name="applyUrl" type="url" inputmode="url" class="input" value="' + APP.h(d.applyUrl || '') + '" placeholder="https://careers.yourcompany.com/job/123"' + (!editing && APP.state.jobErr && APP.state.jobErr.applyUrl ? ' aria-invalid="true"' : '') + '>' + err('applyUrl') +
      '<p class="field-hint">Add a link and candidates apply on your site instead of on Arnour. Leave it empty to receive applications here.</p></label>' +
    '<label class="field checkbox-field"><input type="checkbox" name="remote" ' + (d.remote ? 'checked' : '') + '> Remote-friendly</label>' +
    '<label class="field checkbox-field chk-line"><input type="checkbox" name="confidential" ' + (APP.coHidden(co, d) ? 'checked' : '') + '> <span>Keep my company confidential for this role<small class="muted"> — professionals see “Confidential company” on this role until an introduction about it is accepted. Your other roles and company page are not affected.</small></span></label>';

  const reqPart =
    '<div class="skill-rows req-list' + ((!editing && APP.state.jobErr && APP.state.jobErr.req) ? ' has-err' : '') + '">' + APP.jobReqRowsHtml(d.requires) + '</div>' +
    err('req') +
    '<button type="button" class="btn btn-outline btn-sm" data-action="add-req">' + APP.icon('plus', 14) + ' Add another requirement</button>' +
    '<div id="req-summary">' + APP.jobReqSummary(d) + '</div>';
  const specPart =
    '<details class="opt-box" data-det="spec"' + (openSpec ? ' open' : '') + '><summary>Preferred specialties <span class="muted">(optional)</span>' + (nSpec ? ' <span class="count-pill">' + nSpec + ' selected</span>' : '') + '</summary>' +
    '<p class="field-hint">Ranks the role higher for professionals with these — never hides it.</p>' +
    '<div class="spec-panel">' + APP.specialtyChipsHtml('jobNew', d.preferredSpecialties || [], 'preferredSpecialties', { roles: d.roleType ? [d.roleType] : [], sugLabel: 'Common for this role type' }) + '</div></details>';
  const leadJ = APP.LEAD_RTS.includes(d.roleType);
  const progLbl = leadJ ? ((APP.ROLE_PROFILE[d.roleType] || {}).prog || 'Programs delivered') : '';
  const expertise =
    '<p class="field-hint">' + APP.icon('spark', 14) + ' For this role, expertise matters most. Preferred specialties rank the role higher for professionals who have them — they never hide it.</p>' +
    '<div class="spec-panel">' + APP.specialtyChipsHtml('jobNew', d.preferredSpecialties || [], 'preferredSpecialties', { roles: d.roleType ? [d.roleType] : [], sugLabel: 'Common for this role type' }) + '</div>' +
    '<label class="field"><span class="label">Minimum ' + APP.h(progLbl.toLowerCase()) + ' <span class="muted">(optional)</span></span><input name="minPrograms" type="number" min="0" max="100" class="input narrow-in" value="' + (d.minPrograms ? Number(d.minPrograms) : '') + '" placeholder="e.g. 3"></label>' +
    '<div class="field"><span class="label">Industries <span class="muted">(optional)</span></span><div class="chip-wrap">' + APP.chipGroup('jobNew', 'industries', APP.industries, d.industries) + '</div></div>';
  const skills = '<p class="field-hint">' + APP.icon('spark', 14) + ' These drive matching — professionals whose product + module fits rank at the top of their feed.</p>' + reqPart + (leadJ ? '' : specPart);

  const candidate =
    '<div class="form-grid">' +
    '<label class="field"><span class="label">Seniority</span><select name="level" class="input">' + APP.opt([['', 'Any level']].concat(APP.levels.map(l => [l, l])), d.level) + '</select></label>' +
    '<label class="field"><span class="label">SAP certification</span><select name="certification" class="input">' + APP.opt([['', 'Not required'], ['preferred', 'Preferred'], ['required', 'Required']], d.certification) + '</select></label>' +
    '<label class="field"><span class="label">Min experience (yrs)</span><input name="minExp" type="number" min="0" max="40" class="input" value="' + APP.h(d.minExp) + '" placeholder="5"></label>' +
    '</div>' +
    '<div class="field"><span class="label">Required languages</span><div class="chip-wrap">' + APP.chipGroup('jobNew', 'languages', APP.withSelected(APP.languages, d.languages), d.languages) + '</div><p class="field-hint">Professionals who don\'t speak every required language won\'t see this role in their feed.</p></div>' +
    '<details class="opt-box" data-det="more"' + (openMore ? ' open' : '') + '><summary>More ranking preferences <span class="muted">(optional)</span>' + (nMore ? ' <span class="count-pill">' + nMore + ' selected</span>' : '') + '</summary>' +
    '<div class="field"><span class="label">Preferred languages</span><div class="chip-wrap">' + APP.chipGroup('jobNew', 'preferredLangs', APP.languages.filter(l => (d.languages || []).indexOf(l) === -1), d.preferredLangs) + '</div><p class="field-hint">Ranks the role higher for professionals who speak them — never hides it.</p></div>' +
    (leadJ ? '' : '<div class="field"><span class="label">Industries</span><div class="chip-wrap">' + APP.chipGroup('jobNew', 'industries', APP.industries, d.industries) + '</div><p class="field-hint">Ranks the role higher for professionals with that background — never hides it.</p></div>') +
    '</details>';

  const pay =
    '<div class="pay-row">' +
    '<select name="currency" class="input" aria-label="Currency">' + APP.opt(APP.currencies.map(c => [c.id, c.id]), d.currency) + '</select>' +
    '<input name="rateMin" type="number" min="0" class="input" value="' + APP.h(d.rateMin) + '" placeholder="Min" aria-label="Pay minimum">' +
    '<input name="rateMax" type="number" min="0" class="input" value="' + APP.h(d.rateMax) + '" placeholder="Max" aria-label="Pay maximum">' +
    '<select name="ratePeriod" class="input" aria-label="Pay period">' + APP.opt(APP.ratePeriods, d.ratePeriod) + '</select>' +
    '</div><p class="field-hint">Leave both blank and the role shows “Pay not disclosed”. One figure alone shows as “From” or “Up to”.</p>' + err('pay');

  const desc =
    '<label class="field"><textarea name="description" class="input" rows="12" maxlength="8000" aria-label="Description" placeholder="Scope, team, duration, what success looks like… Paste a full job ad if you have one — line breaks are kept.">' + APP.h(d.description) + '</textarea></label>';

  const crumb = '<div class="crumb"><a class="link" href="' + (editing ? '#/e/jobs/' + d.editId : '#/e/jobs') + '">' + (editing ? '← Back to the role' : '← Your roles') + '</a></div>';

  if (editing) {
    return '<div class="narrow job-form">' + crumb +
      APP.editBarHtml('Editing role: ' + (d.title || 'Untitled'), 'f-job-post') +
      '<p class="muted">Changes are visible to professionals right away. Applicants stay on the role.</p>' +
      '<form data-form="job-post" id="f-job-post">' +
      sec(1, 'The role', 'What it is and where.', basics) +
      (leadJ ? sec(2, 'Expertise', 'Specialties, programmes and industries.', expertise) + sec(3, 'SAP products <span class="req-star">*</span>', 'At least one product; modules only if essential.', skills)
        : sec(2, 'Required SAP skills <span class="req-star">*</span>', 'The most important part — it decides who sees your role.', skills)) +
      sec(leadJ ? 4 : 3, 'Candidate requirements', 'Seniority, experience, certification and languages.', candidate) +
      (APP.SHOW_RATES ? sec(leadJ ? 5 : 4, 'Pay <span class="muted">(optional)</span>', '', pay) : '') +
      sec((APP.SHOW_RATES ? 5 : 4) + (leadJ ? 1 : 0), 'Description', 'Optional — scope, team and what success looks like.', desc) +
      APP.editFootHtml() +
      '</form></div>';
  }

  /* ---- posting: 3-step wizard. All steps stay in the DOM (hidden) so every field is always submitted and drafts never lose data. ---- */
  const step = Math.min(3, Math.max(1, APP.state.jobStep || 1));
  const labels = [APP.SHOW_RATES ? 'Role & pay' : 'The role', leadJ ? 'Expertise & SAP' : 'SAP skills', 'Review & publish'];
  const stepper = '<ol class="wiz-steps" aria-label="Progress">' + labels.map((l, i) => {
    const n = i + 1;
    return '<li class="' + (n === step ? 'cur' : n < step ? 'done' : '') + '"' + (n === step ? ' aria-current="step"' : '') + '>' +
      '<button type="button" data-action="job-step" data-step="' + n + '"><span class="wn">' + (n < step ? APP.icon('check', 13) : n) + '</span><span class="wl">' + l + '</span></button></li>';
  }).join('') + '</ol>';
  const card = (title, sub, body) => '<section class="card form-sec"><div class="sec-h"><div><h3>' + title + '</h3>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div></div>' + body + '</section>';
  const pl = APP.rtProductLevel(d.roleType);
  const pv = APP.jobPreviewObj(d, co);
  const s1 = card('The role', 'What it is and where.', basics) + (!APP.SHOW_RATES ? '' : card('Pay <span class="muted">(optional)</span>', 'Roles with a pay range get noticeably more applications.', pay));
  const s2 = (leadJ ? card('What expertise do you need?', 'Specialties, programmes and industries — what sets a strong candidate apart for this role.', expertise) : '') + card(pl ? 'Which SAP products should they know?' : 'What SAP experience do they need?', pl ? 'For this role the product matters more than individual modules — pick modules only if they are essential. Start with one product.' : 'The most important part — it decides who sees your role. Start with one; add more only if you need them.', reqPart) +
    card('Nice to have <span class="muted">(optional)</span>', leadJ ? 'Seniority, certification and languages. Skip this if you are unsure.' : 'Seniority, certification, languages and specialties. Skip this if you are unsure.', candidate + (leadJ ? '' : specPart));
  const s3 = card('Description <span class="muted">(optional)</span>', 'Scope, team and what success looks like.', desc) +
    '<div class="preview-h"><h3>This is how professionals will see your role</h3><div id="req-summary-2">' + APP.jobReqSummary(d, true) + '</div></div>' +
    '<div class="job-preview" aria-label="Role preview" tabindex="-1">' + APP.asPublicHtml(() => APP.jobCard(pv, null, '', '')) + '</div>' +
    '<p class="muted small preview-edit">Something off? <button type="button" class="link" data-action="job-step" data-step="1">Edit role' + (APP.SHOW_RATES ? ' &amp; pay' : '') + '</button> · <button type="button" class="link" data-action="job-step" data-step="2">Edit skills</button></p>';
  const steps = [s1, s2, s3].map((h, i) => '<div class="jw-step" data-step="' + (i + 1) + '"' + (i + 1 === step ? '' : ' hidden') + '>' + h + '</div>').join('');
  const bar = '<div class="publish-bar">' +
    (step === 1 ? '<button type="button" class="btn btn-outline" data-action="edit-cancel">Cancel</button>' : '<button type="button" class="btn btn-ghost" data-action="job-step" data-step="' + (step - 1) + '">← Back</button>') +
    '<span class="muted small wiz-count">Step ' + step + ' of 3</span>' +
    (step < 3 ? '<button type="submit" class="btn btn-primary">Continue →</button>' : '<button type="submit" class="btn btn-primary">' + APP.icon('check', 15) + ' Publish role</button>') + '</div>';

  return '<div class="narrow job-form job-wizard">' + crumb +
    APP.editBarHtml('Post a new role', null) +
    '<p class="muted">' + APP.h(co.name) + ' is hiring — three quick steps. Only the title, country and one SAP skill are required.</p>' +
    stepper + '<form data-form="job-post" novalidate>' + steps + bar + '</form></div>';
};

APP.views['e-job-new'] = function () { return APP.jobFormView('new'); };

APP.views['e-job-edit'] = function (ctx) {
  const job = APP.job(ctx.p[0]);
  const co = APP.company(APP.db.session.companyId);
  if (!job || !co || job.companyId !== co.id) return '<div class="empty">Role not found.</div>';
  if (!APP.jobNewDraft || APP.jobNewDraft.editId !== job.id) {
    const copy = JSON.parse(JSON.stringify(job));
    delete copy.maxExp;
    copy.editId = job.id;
    copy.roleType = APP.jobRoleType(job);
    copy.requires = (copy.requires || []).map(r => Object.assign({ minProjects: 0, orPrev: false }, r));
    copy.industries = copy.industries && copy.industries.length ? copy.industries : (copy.industry ? [copy.industry] : []);
    copy.languages = copy.languages || []; copy.preferredLangs = copy.preferredLangs || []; copy.preferredSpecialties = copy.preferredSpecialties || [];
    copy.rateMin = copy.rateMin || ''; copy.rateMax = copy.rateMax || ''; copy.minExp = copy.minExp || '';
    copy.ratePeriod = copy.ratePeriod || 'day'; copy.currency = copy.currency || 'USD';
    APP.jobNewDraft = copy;
    APP.state.jobDet = undefined;
  }
  return APP.jobFormView('edit');
};

APP.views['e-job-detail'] = function (ctx) {
  const job = APP.job(ctx.p[0]);
  if (!job) return '<div class="empty">Job not found.</div>';
  const co = APP.company(job.companyId);
  const E = APP.h;
  const open = job.status === 'open';
  const applicants = (job.applicants || []).map(id => APP.consultant(id)).filter(Boolean);
  const unmet = (c) => !(APP.jobVisibleToConsultant(c, job) && APP.langOkForJob(c, job) && APP.certOkForJob(c, job));
  const scored = applicants.map(c => ({ c: c, score: APP.matchScore(c, job), unmet: unmet(c) })).sort((a, b) => b.score - a.score);

  /* ---- recommendations ---- */
  const showWeak = !!(APP.state.showWeak && APP.state.showWeak[job.id]);
  const strongRecs = APP.consultantsForJob(job, 5, 50);
  const allRecs = APP.consultantsForJob(job, 8, 0);
  const recs = showWeak ? allRecs : strongRecs;
  const nWeakExtra = allRecs.filter(x => x.score < 50).length;
  const invited = job.invited || [];
  const nStrong = strongRecs.filter(x => x.score >= 75).length;
  const recList = recs.length
    ? recs.map(x => {
      const isInv = invited.indexOf(x.c.id) !== -1;
      return APP.talentCard(x.c, { score: x.score, job: job, extra: isInv
        ? '<span class="pill inv">' + APP.icon('check', 12) + ' Invited</span>'
        : '<button class="btn btn-outline btn-sm" data-action="invite" data-cid="' + x.c.id + '" data-jid="' + job.id + '">Invite to apply</button>' });
    }).join('')
    : '<div class="empty small">' + (job.certification === 'required' ? 'No certified professionals match 50%+ beyond the current applicants. Try setting certification to "Preferred" to widen the pool.' : 'No other professionals reach a 50% match yet. We\'ll notify you when a new profile fits — or search all talent.') + '</div>';
  const weakToggle = nWeakExtra
    ? '<button class="link" type="button" data-action="toggle-weak" data-jid="' + job.id + '">' + (showWeak ? 'Hide weaker matches' : 'Show ' + nWeakExtra + ' weaker match' + (nWeakExtra > 1 ? 'es' : '') + ' (under 50%)') + '</button>' : '';

  /* ---- tabs ---- */
  APP.state.jobTab = APP.state.jobTab || {};
  APP.state.appFilter = APP.state.appFilter || {};
  const tab = APP.state.jobTab[job.id] || 'applicants';
  const flt = APP.state.appFilter[job.id] || 'all';
  const tabBtn = (id, label, n) => '<button type="button" role="tab" aria-selected="' + (tab === id) + '" class="seg-tab' + (tab === id ? ' on' : '') + '" data-action="job-tab" data-jid="' + job.id + '" data-tab="' + id + '">' + label + (n != null ? ' <span class="seg-n">' + n + '</span>' : '') + '</button>';
  const tabs = '<div class="seg-tabs jd-tabs" role="tablist" aria-label="Role sections">' +
    tabBtn('applicants', 'Applicants', applicants.length) + tabBtn('talent', 'Recommended', strongRecs.length) + tabBtn('details', 'Role details') + '</div>';

  let body;
  if (tab === 'applicants') {
    const stg = (x) => APP.appStage(job, x.c.id);
    const nS = scored.filter(x => x.score >= 75).length, nU = scored.filter(x => x.unmet).length;
    const nNew = scored.filter(x => stg(x) === 'new').length, nSh = scored.filter(x => stg(x) === 'shortlisted').length, nDe = scored.filter(x => stg(x) === 'declined').length;
    const shown = scored.filter(x => flt === 'strong' ? x.score >= 75 : flt === 'unmet' ? x.unmet : flt === 'new' || flt === 'shortlisted' || flt === 'declined' ? stg(x) === flt : true);
    const fbtn = (id, label) => '<button type="button" class="chip' + (flt === id ? ' chip-on' : '') + '" aria-pressed="' + (flt === id) + '" data-action="app-filter" data-jid="' + job.id + '" data-f="' + id + '">' + label + '</button>';
    const filters = applicants.length
      ? '<div class="jd-filters"><span class="muted small">Ranked by match</span><span class="grow"></span>' + fbtn('all', 'All (' + scored.length + ')') + fbtn('new', 'New (' + nNew + ')') + fbtn('shortlisted', 'Shortlisted (' + nSh + ')') + fbtn('declined', 'Not selected (' + nDe + ')') +
        (applicants.length > 1 ? fbtn('strong', 'Strong 75%+ (' + nS + ')') : '') + (nU ? fbtn('unmet', 'Doesn’t meet a requirement (' + nU + ')') : '') + '</div>' : '';
    /* opening the applicant list marks applications as viewed (the professional sees "Viewed") */
    if (applicants.some(c => !(job.appViewed || {})[c.id])) {
      job.appViewed = job.appViewed || {}; applicants.forEach(c => { if (!job.appViewed[c.id]) job.appViewed[c.id] = Date.now(); });
      if (APP.LIVE && APP.backend) APP.backend.rpc('mark_applications_viewed', { p_job: job.id }).then(null, function () { /* best effort */ }); else APP.save();
    }
    body = filters + (shown.length ? shown.map(x => APP.talentCard(x.c, {
      score: x.score, job: job, quote: APP.applyQuoteHtml(job, x.c.id), extra: open ? APP.appStageHtml(job, x.c.id) : (job.hiredId === x.c.id ? '<span class="pill inv">Hired through Arnour</span>' : ''),
      note: x.unmet ? ' <span class="pill warn-pill" title="Since the role was edited, this applicant no longer meets a required language or certification">Doesn’t meet a requirement</span>' : ''
    })).join('') : applicants.length ? '<div class="card empty small">No applicants in this filter.</div>'
      : '<div class="card empty">No applications yet — it can take a day or two. Meanwhile, <button type="button" class="link" data-action="job-tab" data-jid="' + job.id + '" data-tab="talent">invite recommended professionals</button>.</div>');
  } else if (tab === 'talent') {
    body = (strongRecs.length ? '<p class="muted small jd-note">' + nStrong + ' strong (75%+) · ' + (strongRecs.length - nStrong) + ' good (50–74%). Ranked by skills, experience, location, availability and more. <a class="link" href="#/e/talent">Search all talent →</a></p>' : '') +
      recList + (weakToggle ? '<p class="mt8">' + weakToggle + '</p>' : '');
  } else {
    const secs = APP.jobSections(job, null);
    body = '<div class="card jd-main">' + (secs.desc || '') + (secs.req || '') + (secs.facts ? '<section class="jd-sec"><h2>Role details</h2><dl class="jd-facts">' + secs.facts + '</dl></section>' : '') +
      ((secs.desc || secs.req || secs.facts) ? '' : '<p class="muted">No details yet.</p>') +
      '</div>';
  }

  /* ---- side panel ---- */
  const days = job.postedTs ? Math.max(1, Math.ceil((Date.now() - job.postedTs) / 864e5)) : null;
  const stat = (n, l) => '<div class="jd-stat"><b>' + n + '</b><span>' + l + '</span></div>';
  const side = '<aside class="jd-side"><div class="card jd-act">' +
    '<a class="btn btn-primary jd-apply" href="#/e/jobs/' + job.id + '/edit">' + APP.icon('plus', 14) + ' Edit role</a>' +
    '<a class="btn btn-outline btn-sm" href="#/job/' + job.id + '" data-action="preview-public" data-href="#/job/' + job.id + '" data-back="#/e/jobs/' + job.id + '">' + APP.icon('ext', 14) + ' Preview as professional</a>' +
    (open ? '<button type="button" class="btn btn-outline btn-sm jd-close" data-action="close-job" data-id="' + job.id + '">Close role</button>'
      : '<button type="button" class="btn btn-outline btn-sm" data-action="reopen-job" data-id="' + job.id + '">Reopen role</button>') +
    '</div>' +
    '<div class="card"><h2 class="jd-side-h">At a glance</h2><div class="jd-stats">' +
    stat(applicants.length, 'Applicants') + stat(scored.filter(x => APP.appStage(job, x.c.id) === 'shortlisted').length, 'Shortlisted') + stat(nStrongApp(scored), 'Strong matches') + stat(invited.length, 'Invited') + stat(days != null ? days : '–', open ? 'Days open' : 'Days since posted') + '</div></div>' +
    '<div class="card"><h2 class="jd-side-h">Share this role</h2>' + APP.shareHtml({
      title: job.title + (co ? ' — ' + co.name : ''),
      text: job.title + (co ? ' at ' + co.name : '') + ' · ' + APP.locText(job, job.remote ? 'Remote' : '') + (job.remote && (job.city || job.country) ? ' (remote ok)' : '') + ' — now hiring on Arnour, the SAP talent network.',
      tags: '#SAP #SAPJobs #Hiring',
      url: APP.shareUrl('#/job/' + job.id)
    }) + '</div></aside>';
  function nStrongApp(list) { return list.filter(x => x.score >= 75).length; }

  return '<div class="jd">' +
    APP.crumbHtml('#/e/jobs', 'Your roles') +
    '<header class="jd-head card"><h1 class="jd-title">' + E(job.title) + ' <span class="pill ' + (open ? 'inv' : 'muted-pill') + '">' + (open ? 'Open' : 'Closed') + '</span>' + (APP.coHidden(co, job) ? ' <span class="pill anon-pill">' + APP.icon('lock', 12) + ' Confidential</span>' : '') + '</h1>' +
    '<div class="job-meta">' +
    '<span>' + APP.icon('briefcase') + E(job.employmentType) + '</span>' +
    '<span>' + APP.icon('pin') + E(APP.locText(job)) + (job.remote ? ' · Remote-friendly' : '') + '</span>' +
    (APP.SHOW_RATES ? '<span>' + APP.icon('file') + E(APP.fmtRange(job)) + '</span>' : '') +
    (job.duration ? '<span>' + APP.icon('check') + E(job.duration) + '</span>' : '') +
    '</div>' +
    '<p class="muted small jd-posted">Posted ' + APP.timeAgo(job.postedTs) + (job.editedTs ? ' · Edited ' + APP.timeAgo(job.editedTs) : '') + '</p>' +
    (APP.safeApplyUrl(job) ? '<p class="ext-note-e">' + APP.icon('ext', 14) + '<span>Candidates apply on <a class="ext-link" href="' + E(APP.safeApplyUrl(job)) + '" target="_blank" rel="noopener noreferrer">' + E(new URL(APP.safeApplyUrl(job)).hostname.replace(/^www\./, '')) + '</a>. Professionals who tell us they applied there appear below as applicants.</span></p>' : '') + '</header>' +
    '<div class="jd-grid"><div class="jd-left">' + tabs + body + '</div>' + side + '</div></div>';
};

/* ------------------------------ messaging ------------------------------ */

APP.views['e-msgs'] = function () { return APP.msgLayout(null); };
APP.views['e-msg'] = function (ctx) {
  const cv = APP.conv(ctx.p[0]);
  if (!cv) return '<div class="empty">Conversation not found.</div>';
  APP.openConversation(cv.id);
  return APP.msgLayout(cv.id);
};

/* ------------------------------ introductions ------------------------------ */

APP.views['c-preview'] = function () {
  const s = APP.db.session;
  return APP.views['e-talent-detail']({ p: [s.consultantId], preview: true });
};

/* ---- "preview as professional": the company sees its own role / page exactly as professionals do ---- */
APP.asPublicHtml = function (fn) { const was = APP.asPublic; APP.asPublic = true; try { return fn(); } finally { APP.asPublic = was; } };
['job-detail', 'company-public'].forEach(function (v) {
  const orig = APP.views[v];
  if (!orig) return;
  APP.views[v] = function (ctx) {
    const pp = APP.state.previewPublic, s = APP.db.session;
    if (!pp || !s || s.role !== 'employer' || pp.href !== location.hash) return orig(ctx);
    const banner = '<div class="card preview-banner">' + APP.icon('lock', 16) + '<div><b>Preview: this is how professionals see it</b>' +
      '<div class="muted small">On confidential roles your company stays hidden until an introduction about that role is accepted.</div></div>' +
      '<a class="btn btn-outline btn-sm" href="' + APP.h(pp.back) + '" style="margin-left:auto">Back</a></div>';
    return APP.asPublicHtml(() => banner + orig(ctx));
  };
});
window.addEventListener('hashchange', function () { const pp = APP.state.previewPublic; if (pp && pp.href !== location.hash) APP.state.previewPublic = null; });
(function () {
  const prev = APP.onClick;
  APP.onClick = function (el, e) {
    if (el.dataset && el.dataset.action === 'preview-public') {
      if (e && e.preventDefault) e.preventDefault();
      APP.state.previewPublic = { href: el.dataset.href, back: el.dataset.back || '#/e/dashboard' };
      if (location.hash === el.dataset.href) APP.render(); else location.hash = el.dataset.href;
      return;
    }
    return prev.apply(this, arguments);
  };
})();
