/* ============================================================================
   ARNOUR — PUBLIC VIEWS (landing, login, register, onboarding wizards)
   ============================================================================ */

/* ------------------------------ landing ------------------------------ */

APP.views.landing = function () {
  const prods = CATALOG.products.length;
  const mods = CAT_INDEX.totalModules;
  const stats = [
    [prods, 'SAP products'],
    [mods, 'modules to filter on'],
    [APP.countries.length, 'countries across ' + Object.keys(APP.regions).length + ' regions'],
    ['0', 'general noise']
  ].map(s => '<div class="stat-tile"><strong>' + APP.h(s[0]) + '</strong><small>' + APP.h(s[1]) + '</small></div>').join('');

  const why = [
    ['Skills are the identity', 'Every profile and job is tagged by SAP product, module and projects delivered. That is enough to judge fit, so the name can wait.', 'spark'],
    ['A direct line', 'Built-in inbox with unread badges and one-click CV sharing. No email ping-pong, no middlemen.', 'msg'],
    ['Your feed, smart', 'Professionals land on roles that already match their skills. Employers see talent that already fits the brief.', 'check']
  ].map(w =>
    '<div class="why-card card"><span class="why-ico">' + APP.icon(w[2], 22) + '</span><h3>' + APP.h(w[0]) + '</h3><p class="muted">' + APP.h(w[1]) + '</p></div>'
  ).join('');

  const cSteps = [
    ['Build your SAP portfolio', 'A guided wizard captures your products, modules, projects, languages and CV.'],
    ['Get matched, instantly', 'Your feed is ranked against every open role — you only see work that fits your stack.'],
    ['Reveal only when you choose', 'Companies see your skills, not your name. Share your name and CV in one click, after you accept an introduction.']
  ].map((s, i) => '<div class="step"><span class="step-num">' + (i + 1) + '</span><div><h4>' + APP.h(s[0]) + '</h4><p class="muted">' + APP.h(s[1]) + '</p></div></div>').join('');

  const eSteps = [
    ['Post a precise brief', 'Require exact product + module combinations, locations and experience bands. Keep your company confidential if you wish.'],
    ['Headhunt with a real search', 'Filter the talent database by products, modules, role type, location, nationality, availability and projects delivered.'],
    ['Hire without the noise', 'Shortlist in minutes — every result already speaks your SAP language.']
  ].map((s, i) => '<div class="step"><span class="step-num">' + (i + 1) + '</span><div><h4>' + APP.h(s[0]) + '</h4><p class="muted">' + APP.h(s[1]) + '</p></div></div>').join('');

  /* live: the companies the server actually returns (sample ones carry a Sample pill); demo: the bundled examples */
  const coList = APP.LIVE ? Object.values(APP.db.companies || {}).filter(c => c && c.name && !c.anon && !c._anon && !c.private).slice(0, 12)
    : (window.SAMPLE ? Object.values(SAMPLE.companies) : []);
  const companies = coList.map(c =>
    '<div class="logo-tile">' + APP.h(c.name) + APP.samplePill(c) + '</div>'
  ).join('');

  const fresh = Object.values(APP.db.questions || {})
    .sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0))
    .slice(0, 3)
    .map(q => {
      const tag = q.moduleId
        ? APP.productShort(q.productId) + ' · ' + APP.skillName(q.productId, q.moduleId)
        : APP.productShort(q.productId);
      const ans = (q.answers || []).length;
      return '<div class="why-card card"><a href="#/community/q/' + q.id + '"><span class="why-ico">' + APP.icon('msg', 22) + '</span>' +
        '<h3 class="clamp3">' + APP.h(q.title) + '</h3>' +
        '<p class="muted small">' + APP.h(APP.communityAuthorName(q.authorId)) + ' · ' + APP.h(tag) + ' · ' + ans + ' answer' + (ans === 1 ? '' : 's') + '</p></a></div>';
    }).join('');

  const stage = (n, ttl, pro, co, cls) =>
    '<div class="mr-stage ' + cls + '"><span class="mr-n">' + n + '</span><h3>' + ttl + '</h3>' +
    '<div class="mr-row"><span class="mr-who">' + APP.icon('users', 14) + ' Professional sees</span><p>' + pro + '</p></div>' +
    '<div class="mr-row"><span class="mr-who">' + APP.icon('building', 14) + ' Company sees</span><p>' + co + '</p></div></div>';
  const reveal =
    '<section class="section mr-section" id="mutual-reveal"><div class="section-head center"><span class="mr-kicker">' + APP.icon('lock', 14) + ' Mutual Reveal</span>' +
    '<h2>Hidden until you both say yes</h2>' +
    '<p class="muted">Because every profile and role is described by exact product, module and projects, nobody needs a name to judge fit. Names are shared only when both sides agree.</p></div>' +
    '<div class="mr-flow">' +
    stage(1, 'Hidden', 'The role, with a “Confidential company” label.', 'Skills, projects and headline. No name, photo or CV.', 'm1') +
    stage(2, 'Introduction', 'Companies can ask to connect, and you can show interest in a role. Neither side is named yet.', 'You can ask a professional to connect and receive interest in your role. Still no names.', 'm2') +
    stage(3, 'Mutual Reveal', 'Accepting an introduction reveals both sides at once. You see the company name, website and contact.', 'Name, photo, LinkedIn and CV.', 'm3') +
    '</div>' +
    '<div class="mr-both">' +
    '<div class="card mr-card"><h3>' + APP.icon('users', 18) + ' For SAP professionals</h3><p class="muted">Look for your next role discreetly. Companies find you by what you do, not by your name. You decide who gets your name and CV, and only after you accept.</p></div>' +
    '<div class="card mr-card"><h3>' + APP.icon('building', 18) + ' For companies</h3><p class="muted">Open a role without telling the market who is hiring or why. Post it as confidential, receive matched interest, and reveal your name only to the people you accept.</p></div>' +
    '</div>' +
    '<p class="mr-note">A reveal cannot be undone, so it only ever happens when you accept. Free to use, and you can switch it on or off any time in your profile.</p></section>';
  /* on a first visit the page is drawn before the data arrives: leave out the numbers that come from the database until then */
  const dataReady = !(APP.backend && APP.backend.earlyHome);
  const liveRoles = Object.values(APP.db.jobs).filter(j => j.status === 'open').length;
  const livePros = Object.keys(APP.db.consultants || {}).length;
  return (APP.LIVE ? '' : '<div class="proto-banner" role="note">Prototype for customer validation: every company, profile and role is sample data.</div>') +
    '<section class="hero">' +
    '<div class="hero-inner">' +
    '<h1>Skills first, <span class="hl">names second.</span></h1>' +
    '<p class="hero-sub">The SAP network where professionals and companies stay anonymous until both say yes. Search by exact product and module, like “S/4HANA FICO”, and reveal who you are only when it is mutual.</p>' +
    '<div class="hero-split">' +
    '<a class="hero-card" href="#/onboard-e"><strong>I\'m hiring</strong><span>Post a precise role in about 3 minutes. Your company stays confidential until you accept an introduction.</span><span class="btn btn-light btn-lg">Post a role →</span></a>' +
    '<a class="hero-card" href="#/onboard"><strong>I\'m an SAP professional</strong><span>Tag your products and modules and get roles ranked by fit, while you stay discreet.</span><span class="btn btn-outline-light btn-lg">Create my profile →</span></a>' +
    '</div>' +
    '<a class="hero-jobs-link" href="#/jobs">Browse ' + (dataReady ? liveRoles + ' open roles' : 'open roles') + ' first →</a>' +
    '<p class="hero-proof">' + (dataReady ? liveRoles + ' open roles · ' + livePros + ' professionals · ' : '') + prods + ' SAP products · ' + mods + ' modules</p>' +
    '</div></section>' +

    reveal +
    '<section class="section alt"><div class="section-head"><h2>Why SAP people choose Arnour</h2></div><div class="why-grid">' + why + '</div></section>' +

    '<section class="section"><div class="section-head"><h2>How it works</h2></div>' +
    '<div class="how-grid">' +
    '<div class="card how-card"><div class="how-title">' + APP.icon('users', 18) + ' For SAP professionals</div>' + cSteps + '</div>' +
    '<div class="card how-card"><div class="how-title">' + APP.icon('building', 18) + ' For companies & recruiters</div>' + eSteps + '</div>' +
    '</div></section>' +

    (companies ? '<section class="section hide-m"><div class="section-head center"><h2>' + (APP.LIVE ? 'Companies on Arnour' : 'Companies in this prototype') + '</h2><p class="muted">' + (APP.LIVE ? 'Examples are marked Sample. Real employers appear here as they join.' : 'Sample data. Real employers appear here once they join.') + '</p></div>' +
    '<div class="logo-row">' + companies + '</div></section>' : '') +

    '<section class="section alt"><div class="section-head"><h2>Fresh from the community</h2><p class="muted">Open questions from SAP people — in their own words, with real answers.</p></div>' +
    '<div class="why-grid fresh-grid">' + fresh + '</div>' +
    '<p class="center mt16"><a class="btn btn-primary" href="#/community">Browse the community</a></p></section>' +

    '<section class="cta-band"><div class="cta-inner">' +
    '<h2>Be found for your skills. Be known when you choose.</h2>' +
    '<a class="btn btn-light btn-lg" href="#/register">Join Arnour free →</a>' +
    '</div></section>';
};

APP.views.notfound = function () {
  document.title = 'Page not found — Arnour';
  return '<div class="auth-wrap"><div class="card auth-card"><h1>We can\'t find that page</h1>' +
    '<p class="muted center">The link may be old or mistyped. Here is where most people go next:</p>' +
    '<a class="btn btn-primary btn-block" href="#/jobs">Browse open roles</a>' +
    '<a class="btn btn-outline btn-block" href="#/community">Visit the community</a>' +
    (APP.db.session ? '<a class="btn btn-ghost btn-block" href="' + (APP.db.session.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard') + '">Back to my dashboard</a>' : '<a class="btn btn-ghost btn-block" href="#/">Back to the home page</a>') +
    '<p class="muted small center">Still stuck? <a href="mailto:contact@arnour.com">contact@arnour.com</a></p></div></div>';
};

/* ------------------------------ login ------------------------------ */

APP.views.login = function () {
  const ahmed = APP.consultant('c-ahmed');
  const vikram = APP.consultant('c-vikram');
  const crescent = APP.company('co-crescent');
  return '<div class="auth-wrap">' +
    '<div class="card auth-card">' +
    '<div class="brand-logo lg">A</div>' +
    '<h1>Sign in to Arnour</h1>' +
    '<a class="btn btn-primary btn-block" href="#/register">Create a new account</a>' +
    '<p class="muted small center">Takes about 2 minutes. You can edit everything later.</p>' +
    '<div class="or"><span>or try a demo account</span></div>' +
    (ahmed ?
      '<button class="demo-acct" data-action="login" data-role="consultant" data-id="' + ahmed.id + '">' +
      APP.avatarHtml(APP.consultantFullName(ahmed)) +
      '<span><strong>' + APP.h(APP.consultantFullName(ahmed)) + '</strong><small>' + APP.h(ahmed.headline) + ' · Professional demo</small></span>' +
      '<span class="demo-arrow">→</span></button>' : '') +
    (vikram ?
      '<button class="demo-acct" data-action="login" data-role="consultant" data-id="' + vikram.id + '">' +
      APP.avatarHtml(APP.consultantFullName(vikram)) +
      '<span><strong>' + APP.h(APP.consultantFullName(vikram)) + '</strong><small>' + APP.h(vikram.headline) + ' · Professional demo</small></span>' +
      '<span class="demo-arrow">→</span></button>' : '') +
    (crescent ?
      '<button class="demo-acct" data-action="login" data-role="employer" data-id="' + crescent.id + '">' +
      '<span class="avatar av-2">' + APP.h(APP.initials(crescent.name)) + '</span>' +
      '<span><strong>' + APP.h(crescent.name) + '</strong><small>Hiring S/4HANA & GRC · Employer demo</small></span>' +
      '<span class="demo-arrow">→</span></button>' : '') +
    '<p class="muted small center">Demo accounts use sample data. Nothing you do here is sent anywhere.</p>' +
    '</div></div>';
};

/* ------------------------------ register ------------------------------ */

APP.views.register = function () {
  return '<div class="auth-wrap wide">' +
    '<div class="section-head center"><h1>Join Arnour</h1><p class="muted">Choose your side of the marketplace.</p></div>' +
    '<div class="role-grid">' +
    '<button class="card role-card" data-action="go" data-href="#/onboard">' +
    '<span class="role-ico">' + APP.icon('users', 26) + '</span>' +
    '<h3>I\'m an SAP professional</h3>' +
    '<p class="muted">Build a detailed SAP portfolio, get a smart job feed, and chat with companies directly.</p>' +
    '<span class="role-cta">Create your profile →</span></button>' +
    '<button class="card role-card" data-action="go" data-href="#/onboard-e">' +
    '<span class="role-ico">' + APP.icon('building', 26) + '</span>' +
    '<h3>I\'m a company / recruiter</h3>' +
    '<p class="muted">Create your company profile, headhunt with a powerful talent search, and post precise SAP roles.</p>' +
    '<span class="role-cta">Create company profile →</span></button>' +
    '</div></div>';
};

/* Privacy choice shown on the last step of both sign-up wizards: switch + live preview of what the other side will see */
APP.wizPrivacyHtml = function (role, d) {
  const on = !!d.anon, isC = role === 'c';
  let prev;
  if (isC) {
    let nm = 'SAP professional', sub = '';
    try { const x = APP.cv(Object.assign({ id: 'preview' }, d), true); nm = APP.consultantFullName(x); sub = x.headline; } catch (e) {}
    prev = APP.avatarHtml(nm, 'lg', true) + '<div><b>' + APP.h(nm) + '</b><div class="muted small">' + APP.h(sub) + (d.country ? ' · ' + APP.h(APP.countryName(d.country) || '') : '') + '</div></div>';
  } else {
    prev = APP.avatarHtml('Confidential company', 'lg') + '<div><b>Confidential company</b><div class="muted small">' + APP.h(d.industry || '') + (d.country ? ' · ' + APP.h(APP.countryName(d.country) || '') : '') + '</div></div>';
  }
  return '<div class="card privacy-card wiz-privacy"><div class="pc-row"><div class="grow"><div class="card-h" style="margin:0">' + APP.icon('lock', 16) + ' ' + (isC ? 'Mutual Reveal: stay private until you say yes' : 'Stay confidential until you say yes') + ' <span class="muted small">' + (isC ? '(recommended)' : '(optional)') + '</span></div>' +
    '<p class="muted small" style="margin:4px 0 0">' + (isC
      ? 'Companies find you by your skills (product, module and projects), not your name. They can ask to connect, and your name, photo and CV are shared only if you accept.'
      : 'Professionals see your roles, not which company is hiring, until you accept their interest. You can also choose this for each role.') + '</p></div>' +
    '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" aria-label="' + (isC ? 'Keep my identity private' : 'Keep my company confidential') + '" data-action="wiz-anon" data-r="' + role + '"><span></span></button></div>' +
    '<div class="anon-preview"><span class="muted small">' + (on ? (isC ? 'Companies will see you as' : 'Professionals will see you as') : (isC ? 'If you turn this on, companies see you as' : 'If you turn this on, professionals see you as')) + '</span><div class="ap-row">' + prev + '</div>' +
    '<p class="muted small">' + (isC ? 'Hidden until you accept: name, photo, LinkedIn, summary, city, nationality and CV. ' : 'Hidden until you accept: company name, logo, website and contact. ') + 'A reveal cannot be undone, so it only happens when you accept. You can change this any time in your profile.</p></div></div>';
};

/* ------------------------------ professional wizard ------------------------------ */

APP.wizCDefaults = function () {
  return {
    firstName: '', lastName: '', headline: '', linkedin: '', nationality: '', country: '', city: '',
    roleType: '', languages: [], yearsExp: 5, level: 'Mid', availability: 'Immediate',
    workPrefs: [],
    currency: 'USD', dailyRate: '', summary: '', cv: null,
    skills: [], /* no product preselected: the person chooses their own */
    industries: [], specialties: [], otherSkills: '',
    anon: true /* private by default: Mutual Reveal */
  };
};

APP.wizStepsC = ['About you', 'Experience', 'SAP skills', 'Specialties', 'Your rate', 'CV & finish'];
/* Steps people actually see: the rate step (5) is skipped while APP.SHOW_RATES is off. */
APP.wizVisible = () => {
  const d = APP.wizC && APP.wizC.data;
  const base = d && APP.isLeadRole(d) ? [1, 2, 4, 3, 5, 6] : [1, 2, 3, 4, 5, 6]; /* leadership roles: expertise before the SAP landscape */
  return APP.SHOW_RATES ? base : base.filter(n => n !== 5);
};
APP.wizStepTitle = (n, d) => (d && APP.isLeadRole(d) && { 3: 'SAP landscape', 4: 'Your expertise' }[n]) || APP.wizStepsC[n - 1];
APP.wizNextStep = (st) => { const v = APP.wizVisible(); return v[Math.min(v.length - 1, v.indexOf(st) + 1)] || st; };
APP.wizPrevStep = (st) => { const v = APP.wizVisible(); return v[Math.max(0, v.indexOf(st) - 1)] || 1; };

APP.views['wiz-c'] = function () {
  if (!APP.wizC) APP.wizC = { step: 1, data: APP.wizCDefaults() };
  const d = APP.wizC.data;
  const step = APP.wizC.step;
  const rp = APP.roleProfile(d);
  const vis = APP.wizVisible();
  const progress = vis.map((n, i) =>
    '<div class="wiz-step ' + (n === step ? 'active' : '') + (i < vis.indexOf(step) ? 'done' : '') + '"><span class="wiz-dot">' + (i < vis.indexOf(step) ? APP.icon('check', 11) : (i + 1)) + '</span><small>' + APP.wizStepTitle(n, d) + '</small></div>'
  ).join('');

  let body = '';
  const er = APP.wizC.err || {};
  const sec = (key, ico, title, inner, extra) =>
    '<section class="wiz-sec' + (extra || '') + (er[key] || (key === 'who' && (er.firstName || er.lastName || er.headline || er.gender)) || (key === 'where' && (er.nationality || er.country)) ? ' has-err' : '') + (step === 1 && APP.wizSecDone(d)[key] ? ' done' : '') + '" data-sec="' + key + '">' +
    '<div class="wiz-sec-h"><span class="wiz-sec-ico">' + APP.icon(ico, 18) + '</span><h2>' + title + '</h2>' + (step === 1 ? '<span class="wiz-sec-tick" aria-hidden="true">' + APP.icon('check', 13) + '</span>' : '') + '</div>' + inner + '</section>';
  if (step === 1) {
    const E = (k) => er[k] ? '<p class="field-error" role="alert">' + APP.h(er[k]) + '</p>' : '';
    const inv = (k) => er[k] ? ' aria-invalid="true"' : '';
    const genderSeg = '<div class="seg gender-seg" role="group" aria-label="Gender">' +
      APP.genders.map(x => '<button type="button" class="seg-item ' + (d.gender === x[0] ? 'active' : '') + '" data-action="chip" data-scope="wizC" data-group="gender" data-single="1" data-value="' + x[0] + '"' + inv('gender') + '>' + x[1] + '</button>').join('') +
      '<input type="hidden" name="gender" value="' + APP.h(d.gender || '') + '" data-chip-echo="1"></div>';
    const selRole = APP.rtList(d)[0];
    const collapsed = !!selRole && !APP.wizC.roleOpen;
    const roleInner = collapsed
      ? '<div class="rt-collapsed"><span class="rt-check on" aria-hidden="true">' + APP.icon('check', 14) + '</span><div class="rt-collapsed-txt"><b>' + APP.h(APP.roleTypeLabel(selRole)) + '</b><span class="rt-tip rt-tip-sm">' + APP.icon('plus', 13) + '<span><b>Do more than one role?</b> You can add more later in Edit profile.</span></span></div><button type="button" class="btn btn-outline btn-sm" data-action="role-change">Change</button></div>'
      : APP.roleTypePicker('wizC', d, { single: true }) + E('role');
    body = '<form data-form="wiz-c" data-step="1" novalidate>' +
      sec('role', 'briefcase', 'Your main role <span class="req-star">*</span>', '<div class="field" id="wiz-role">' + roleInner + '</div>') +
      sec('who', 'users', 'Who you are',
        '<div class="form-grid g3">' +
        '<label class="field"><span class="label">First name <span class="req-star">*</span></span><input name="firstName" class="input" value="' + APP.h(d.firstName) + '" placeholder="Ahmed"' + inv('firstName') + '>' + E('firstName') + '</label>' +
        '<label class="field"><span class="label">Last name <span class="req-star">*</span></span><input name="lastName" class="input" value="' + APP.h(d.lastName) + '" placeholder="Said"' + inv('lastName') + '>' + E('lastName') + '</label>' +
        '<div class="field"><span class="label">Gender <span class="req-star">*</span></span>' + genderSeg + E('gender') + '</div>' +
        '</div>' +
        '<label class="field"><span class="label">Your Title/Headline <span class="req-star">*</span></span><input name="headline" class="input" value="' + APP.h(d.headline) + '" placeholder="Senior SAP S/4HANA FICO Consultant"' + inv('headline') + '>' + E('headline') + '<p class="field-hint">Used as your name if you stay private, so keep employer names out.</p></label>' +
        '<details class="opt-more"' + (d.linkedin ? ' open' : '') + '><summary>+ Add LinkedIn <span class="muted">(optional)</span></summary>' +
        '<label class="field"><input name="linkedin" class="input" value="' + APP.h(d.linkedin) + '" placeholder="linkedin.com/in/your-profile" aria-label="LinkedIn profile"></label></details>') +
      sec('where', 'pin', 'Where you are',
        '<div class="form-grid g3">' +
        '<label class="field"><span class="label">Nationality <span class="req-star">*</span></span><select name="nationality" class="input"' + inv('nationality') + '><option value=""' + (d.nationality ? '' : ' selected') + '>Select your nationality…</option>' + APP.opt(APP.withSelected(APP.nationalities, d.nationality).map(n => [n, n]), d.nationality) + '</select>' + E('nationality') + '</label>' +
        '<label class="field"><span class="label">Country <span class="req-star">*</span></span><select name="country" data-wizard="c" class="input" id="wiz-country"' + inv('country') + '>' + APP.countryOptions(d.country) + '</select>' + E('country') + '</label>' +
        '<label class="field"><span class="label">City <span class="muted">(optional)</span></span><select name="city" class="input">' + APP.cityOptions(d.country, d.city) + '</select></label>' +
        '</div>') +
      sec('languages', 'msg', 'Languages <span class="req-star">*</span>',
        '<div class="field field-langs"><div class="chip-wrap">' + APP.chipGroup('wizC', 'languages', APP.withSelected(APP.languages, d.languages), d.languages) + '</div>' + E('languages') + '</div>') +
      APP.wizNav(1, 6) +
      '</form>';
  } else if (step === 2) {
    body = '<form data-form="wiz-c" data-step="2">' +
      sec('exp', 'briefcase', 'Your experience',
        '<div class="range-row"><span class="label">Years of experience</span><output>' + d.yearsExp + '</output>' +
        '<input type="range" class="range" min="1" max="30" value="' + d.yearsExp + '" data-slider-out data-wizard-years name="yearsExpR">' +
        '</div>' +
        '<input type="hidden" name="yearsExp" value="' + d.yearsExp + '">' +
        (rp.lvl ? '<div class="field"><span class="label">Experience level</span><div class="seg">' +
        APP.levels.map(l => '<button type="button" class="seg-item ' + (d.level === l ? 'active' : '') + '" data-action="chip" data-scope="wizC" data-group="level" data-single="1" data-value="' + l + '">' + l + '</button>').join('') +
        '<input type="hidden" name="level" value="' + APP.h(d.level) + '" data-chip-echo="1"></div></div>' : '')) +
      sec('avail', 'bell', 'Availability & how you work',
        '<label class="field"><span class="label">Availability</span><select name="availability" class="input">' + APP.opt(APP.availability.map(a => [a, a]), d.availability) + '</select></label>' +
        '<div class="field"><span class="label">Open to</span><div class="chip-wrap">' + APP.chipGroup('wizC', 'workPrefs', APP.workPrefs, d.workPrefs || []) + '</div></div>') +
      APP.wizNav(2, 6) +
      '</form>';
  } else if (step === 3) {
    const hint = {
      full: 'This is the heart of Arnour: tag every SAP product and module you\'ve delivered, with how many projects. This powers your smart matches.',
      optional: 'Tag the SAP products and modules you build for. Project counts are optional — add them if you can.',
      modules: 'Tag the SAP products and modules you work with. No project counts needed.',
      products: 'Tick the SAP products you work with. No modules or project counts needed.'
    }[rp.skills];
    const lead = APP.isLeadRole(d);
    const hint3 = lead ? 'Pick the SAP products you have worked across. Ticking modules is optional — add them only where they matter. Companies search by product, so at least one is needed.' : hint;
    const indLabel = { many: 'Industries you\'ve worked in', optional: 'Industries you\'ve worked in (optional)', one: 'Your industry' }[rp.ind];
    body = '<form data-form="wiz-c" data-step="3">' +
      sec('skills', 'spark', lead ? 'SAP products you have worked across' : 'Your SAP skills',
        '<p class="field-hint">' + APP.icon('spark', 15) + ' ' + hint3 + '</p>' +
        '<div class="skill-rows" id="wiz-skills">' + APP.skillCardsHtml('wizC', d.skills, rp.skills) + '</div>' +
        (er.skills ? '<p class="field-error" role="alert">' + APP.h(er.skills) + '</p>' : '')) +
      (rp.prog && !lead ? sec('prog', 'up', APP.h(rp.prog) + ' <span class="muted">(optional)</span>',
        '<label class="field"><input name="programs" type="number" min="0" max="200" class="input narrow-in" value="' + (d.programs ? Number(d.programs) : '') + '" placeholder="e.g. 8" aria-label="' + APP.h(rp.prog) + '"></label>') : '') +
      (rp.ind ? sec('ind', 'building', indLabel,
        '<div class="chip-wrap">' + APP.chipGroup('wizC', 'industries', APP.industries, d.industries) + '</div>') : '') +
      APP.wizNav(3, 6) +
      '</form>';
  } else if (step === 4) {
    const lead4 = APP.isLeadRole(d);
    body = '<form data-form="wiz-c" data-step="4">' +
      sec('spec', 'spark', lead4 ? 'What you are known for' : 'SAP specialties',
        '<p class="field-hint">' + APP.icon('spark', 15) + (lead4 ? ' This is the heart of your profile: pick at least 2 specialties (up to 6 reads strongest)' : ' Pick the specialties you\'re known for' + (rp.rts[0] === 'junior' ? ' — optional for now' : ' (up to 6 reads strongest)')) + '. They sharpen matching and appear on your profile.</p>' +
        '<div class="spec-panel">' + APP.specialtyChipsHtml('wizC', d.specialties || [], null, { softMax: 6, roles: rp.rts }) + '</div>' +
        (er.spec ? '<p class="field-error" role="alert">' + APP.h(er.spec) + '</p>' : '')) +
      (lead4 && rp.prog ? sec('prog', 'up', APP.h(rp.prog) + ' <span class="muted">(optional)</span>',
        '<label class="field"><input name="programs" type="number" min="0" max="200" class="input narrow-in" value="' + (d.programs ? Number(d.programs) : '') + '" placeholder="e.g. 8" aria-label="' + APP.h(rp.prog) + '"></label>') : '') +
      sec('own', 'plus', 'Your own specialties <span class="muted">(optional)</span>',
        '<label class="field"><input name="otherSkills" class="input" value="' + APP.h(Array.isArray(d.otherSkills) ? d.otherSkills.join(', ') : (d.otherSkills || '')) + '" placeholder="e.g. ECC to S/4HANA conversion, HGB to IFRS, MDG rollout — comma separated" aria-label="Your own specialties"><p class="field-hint">Anything not on the list above — written your way, still searchable by companies.</p></label>') +
      APP.wizNav(4, 6) +
      '</form>';
  } else if (step === 5) {
    body = '<form data-form="wiz-c" data-step="5">' +
      sec('rate', 'briefcase', 'Your rate <span class="muted">(optional)</span>',
        '<div class="field">' + APP.rateInputHtml(d, d.currencyChosen) + '</div>' +
        '<p class="muted small">Shown to companies as your opening number — in the currency and period you choose. You can negotiate in the inbox. Leave it blank and your profile will read “Rate on request”.</p>') +
      APP.wizNav(5, 6) +
      '</form>';
  } else {
    body = '<form data-form="wiz-c" data-step="6">' +
      sec('cv', 'file', 'Your CV',
        '<div class="field"><span class="label">CV (PDF recommended)</span>' +
        '<div class="cv-box">' +
        (d.cv
          ? '<span class="cv-item">' + APP.icon('file', 16) + ' ' + APP.h(d.cv.name) + ' <em class="muted">' + APP.h(d.cv.size) + '</em><button type="button" class="icon-btn" data-action="cv-clear" data-scope="wizC">' + APP.icon('x', 13) + '</button></span>'
          : '<label class="cv-drop">' + APP.icon('file', 18) + '<span>Upload your CV</span><input type="file" accept=".pdf,.doc,.docx" data-wiz-cv="c" hidden></label>') +
        '</div></div>' +
        '<label class="field"><span class="label">Short summary (optional)</span><textarea name="summary" class="input" rows="3" placeholder="e.g. Led FI/CO on a full S/4HANA greenfield rollout for a regional bank…">' + APP.h(d.summary) + '</textarea></label>') +
      sec('preview', 'users', 'Profile preview',
        '<div class="review-box">' +
        '<div class="muted small">' + APP.h((d.firstName || '—') + ' ' + (d.lastName || '')) + ' · ' + APP.h(d.headline || '—') + ' · ' + APP.h(APP.locText(d)) + '<br>' +
        (d.level || '—') + ' · ' + d.yearsExp + ' yrs · ' + APP.h((d.languages || []).join(', ') || '—') + '<br>' +
        (d.industries && d.industries.length ? APP.h(d.industries.join(', ')) + '<br>' : '') +
        (d.specialties && d.specialties.length ? 'Specialties: ' + APP.h(d.specialties.map(id => APP.specialtyName(id)).join(', ')) + '<br>' : '') +
        (APP.tagList(d.otherSkills).length ? 'Your own specialties: ' + APP.h(APP.tagList(d.otherSkills).join(', ')) + '<br>' : '') +
        (d.workPrefs && d.workPrefs.length ? 'Open to: ' + APP.h(d.workPrefs.join(', ')) + '<br>' : '') +
        (APP.SHOW_RATES ? APP.rateHtml({ currency: d.currencyChosen ? d.currency : APP.defaultCurrency(d.country), dailyRate: d.dailyRate, ratePeriod: d.ratePeriod }) : '') +
        '</div></div>') +
      APP.wizPrivacyHtml('c', d) +
      APP.wizNav(6, 6, true) +
      '</form>';
  }

  /* handle cv-clear (non-submit) here too */
  return '<div class="wizard-wrap wizard-wide">' +
    '<div class="wizard-top"><a class="link" href="#/login">← Back to sign in</a><span class="brand sm">A Arnour</span></div>' +
    '<div class="card wizard-card wiz-flat">' +
    '<div class="wiz-progress">' + progress + '</div>' +
    '<h1 class="wiz-title">' + APP.wizStepTitle(step, d) + '</h1>' +
    '<p class="muted small wiz-time">Step ' + (vis.indexOf(step) + 1) + ' of ' + vis.length + ' · about ' + Math.max(1, Math.ceil((vis.length - vis.indexOf(step)) * 0.4)) + ' min left · you can edit everything later</p>' +
    (step === 1 ? APP.cvSlotHtml() : '') + APP.cvBannerHtml(step) +
    body +
    '</div></div>';
};

/* "Start from your CV": the code (js/cv-import.js) is fetched only when the wizard opens on the live site.
   Until it has loaded, and whenever the feature is switched off, nothing shows. */
APP.cvSlotHtml = function () {
  if (!APP.LIVE || !APP.wizC) return '';
  if (!APP.cvImpLoaded) {
    if (!APP.cvImpLoading) {
      APP.cvImpLoading = true;
      const s = document.createElement('script');
      s.src = '/js/cv-import.js';
      s.onload = () => { APP.cvImpLoaded = true; APP.cvImpInit(); };
      s.onerror = () => { /* the wizard works without it */ };
      document.head.appendChild(s);
    }
    return '<div id="cv-slot"></div>';
  }
  return '<div id="cv-slot">' + APP.cvCardHtml() + '</div>';
};
/* after a CV was read: a reminder on every later step that the answers still need checking */
APP.cvBannerHtml = function (step) {
  const i = APP.wizC && APP.wizC.cvImp;
  if (!i || !i.done || step === 1) return '';
  return '<p class="live-note cv-banner">' + APP.icon('check', 14) + ' Filled in from your CV. ' + (step === 6 ? 'Please check everything before you create your profile.' : 'Please check it.') + '</p>' +
    (step === 3 && i.found && i.found.estimated ? '<p class="muted small cv-est">Project counts are our best estimate from the projects your CV lists, and “SAP-certified” is only ticked where your CV says so. Please correct anything that looks wrong.</p>' : '');
};

APP.wizNav = function (step, total, last) {
  return '<div class="wiz-nav">' +
    (step > 1 ? '<button type="button" class="btn btn-ghost" data-action="wiz-back" data-target="wizC">← Back</button>' : '') +
    '<span class="grow"></span>' +
    (!last && APP.wizVisible().indexOf(step) >= (APP.wizC && APP.isLeadRole(APP.wizC.data) ? 3 : 2) ? '<button type="button" class="btn btn-outline" data-action="wiz-skip">Skip the rest and create my profile</button>' : '') +
    (last
      ? '<button type="submit" class="btn btn-primary btn-lg">' + APP.icon('check', 16) + ' Create my profile</button>'
      : '<button type="submit" class="btn btn-primary btn-lg">Continue →</button>') +
    '</div>';
};

/* ------------------------------ employer wizard ------------------------------ */

APP.wizEDefaults = function () {
  return {
    name: '', industry: 'Information Technology (IT)', size: '51-200', country: '', city: '',
    website: '', about: '', contactName: '', contactTitle: '', sapSystems: []
  };
};

APP.wizStepsE = ['Company', 'SAP footprint', 'Finish'];

APP.views['wiz-e'] = function () {
  if (!APP.wizE) APP.wizE = { step: 1, data: APP.wizEDefaults() };
  const d = APP.wizE.data;
  const step = APP.wizE.step;
  const progress = APP.wizStepsE.map((label, i) =>
    '<div class="wiz-step ' + (i + 1 === step ? 'active' : '') + (i + 1 < step ? 'done' : '') + '"><span class="wiz-dot">' + (i + 1 < step ? APP.icon('check', 11) : (i + 1)) + '</span><small>' + label + '</small></div>'
  ).join('');

  let body = '';
  if (step === 1) {
    body = '<form data-form="wiz-e" data-step="1">' +
      '<label class="field"><span class="label">Company name *</span><input name="name" class="input" value="' + APP.h(d.name) + '" placeholder="Crescent Bank"></label>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Industry</span><select name="industry" class="input">' + APP.opt(APP.industries.map(i => [i, i]), d.industry) + '</select></label>' +
      '<label class="field"><span class="label">Company size</span><select name="size" class="input">' + APP.opt(APP.companySizes.map(s => [s, s]), d.size) + '</select></label>' +
      '<label class="field"><span class="label">Headquarters country *</span><select name="country" class="input">' + APP.countryOptions(d.country) + '</select></label>' +
      APP.cityInputHtml(d.country, d.city) +
      '<label class="field"><span class="label">Website</span><input name="website" class="input" value="' + APP.h(d.website) + '" placeholder="company.com"></label>' +
      '</div>' +
      '<label class="field"><span class="label">About</span><textarea name="about" class="input" rows="5" placeholder="What does the company do, and what SAP systems does it run? Professionals read this before they apply.">' + APP.h(d.about) + '</textarea></label>' +
      APP.wizNav2(1, 3) +
      '</form>';
  } else if (step === 2) {
    body = '<form data-form="wiz-e" data-step="2">' +
      '<div class="field"><span class="label">SAP systems your company runs</span>' +
      '<p class="field-hint">Professionals use this to self-select. Pick all that apply.</p>' +
      '<div class="chip-wrap">' + APP.chipGroup('wizE', 'sapSystems', CATALOG.products, d.sapSystems) + '</div></div>' +
      '<div class="form-grid">' +
      '<label class="field"><span class="label">Contact name *</span><input name="contactName" class="input" value="' + APP.h(d.contactName) + '" placeholder="Hala Al Suwaidi"></label>' +
      '<label class="field"><span class="label">Contact title</span><input name="contactTitle" class="input" value="' + APP.h(d.contactTitle) + '" placeholder="Talent Partner"></label>' +
      '</div>' +
      APP.wizNav2(2, 3) +
      '</form>';
  } else {
    body = '<form data-form="wiz-e" data-step="3">' +
      '<div class="review-box">' +
      '<strong>' + APP.h(d.name || 'Your company') + '</strong>' +
      '<div class="muted small">' + APP.h(d.industry) + ' · ' + APP.h(d.size) + ' · ' + APP.h(APP.locText(d)) +
      '<br>Systems: ' + APP.h((d.sapSystems || []).map(id => APP.productShort(id)).join(', ') || '—') +
      '<br>Contact: ' + APP.h(d.contactName || '—') + (d.contactTitle ? ' (' + APP.h(d.contactTitle) + ')' : '') + '</div></div>' +
      '<p class="muted small">After creating your profile you can post your first job and start searching talent.</p>' +
      APP.wizNav2(3, 3, true) +
      '</form>';
  }

  return '<div class="wizard-wrap">' +
    '<div class="wizard-top"><a class="link" href="#/login">← Back to sign in</a><span class="brand sm">A Arnour</span></div>' +
    '<div class="card wizard-card">' +
    '<div class="wiz-progress">' + progress + '</div>' +
    '<h1 class="wiz-title">' + APP.wizStepsE[step - 1] + '</h1>' +
    body +
    '</div></div>';
};

APP.wizNav2 = function (step, total, last) {
  return '<div class="wiz-nav">' +
    (step > 1 ? '<button type="button" class="btn btn-ghost" data-action="wiz-back" data-target="wizE">← Back</button>' : '') +
    '<span class="grow"></span>' +
    (last
      ? '<button type="submit" class="btn btn-primary btn-lg">' + APP.icon('check', 16) + ' Create company profile</button>'
      : '<button type="submit" class="btn btn-primary btn-lg">Continue →</button>') +
    '</div>';
};

/* ============================================================================
   PUBLIC, SHAREABLE PAGES (round 9)
   No login required. Each page carries a share row that publishes its URL to
   WhatsApp / LinkedIn / Facebook / Messenger / email, or copies the link.
   ============================================================================ */

/* ------------------------------ public jobs board ------------------------------ */

APP.views['jobs'] = function () {
  document.title = 'Open SAP roles — Arnour';
  const s = APP.db.session;
  const c = s && s.role === 'consultant' ? APP.consultant(s.consultantId) : null;
  const f = APP.state.jobFilters;

  let list = APP.applyJobFilters(null, Object.values(APP.db.jobs).filter(j => j.status === 'open'));
  if (f.sort === 'newest' || !c) list = list.slice().sort((a, b) => b.postedTs - a.postedTs);
  else list = list.slice().sort((a, b) => APP.matchScore(c, b) - APP.matchScore(c, a));

  const isAnon = !s;
  const viewBtn = (j) => '<a class="btn btn-outline btn-sm" href="#/job/' + j.id + '">View role</a>';
  const cards = list.map(j => APP.jobCard(j, c ? APP.matchScore(c, j) : undefined, c ? APP.jobActionButtons(j, 'consultant') : viewBtn(j), '#/job/' + j.id)).join('');
  return APP.jobSearchHtml({
    items: list, canSort: !!c, ranked: !!c, cards: cards,
    emptyExtra: isAnon ? '<a class="btn btn-outline" href="#/register">Get matched when one is posted</a>' : '',
    head: APP.crumbHtml('#/', 'Home') +
      '<h1 class="page-title">Open SAP roles</h1>' +
      '<p class="muted small" style="margin:2px 0 12px">Browse every open role on Arnour — no login needed.</p>' +
      (isAnon ? '<div class="signup-strip"><span>Sign up free to apply, save roles and message companies.</span><a class="btn btn-primary btn-sm" href="#/register">Join Arnour</a><a class="btn btn-ghost btn-sm" href="#/login">Sign in</a></div>' : '')
  });
};

/* ------------------------------ public job detail ------------------------------ */

/* Sections shared by the professional's job page and the company's role page. `me` (a consultant or null) adds personal status tags. */
/* Long text: paragraphs + bullet lists, collapsed to ~8 lines with Show more */
APP.longTextHtml = function (text) {
  const E = APP.h, lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let out = '', list = false, para = [];
  const flush = () => { if (para.length) { out += '<p>' + para.map(E).join('<br>') + '</p>'; para = []; } };
  const close = () => { if (list) { out += '</ul>'; list = false; } };
  lines.forEach(raw => {
    const l = raw.trim(), m = /^(?:[-*\u2022\u00b7\u25aa])\s+(.*)$/.exec(l);
    if (!l) { flush(); close(); return; }
    if (m) { flush(); if (!list) { out += '<ul>'; list = true; } out += '<li>' + E(m[1]) + '</li>'; return; }
    close(); para.push(l);
  });
  flush(); close();
  const est = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 95)), 0);
  const long = est > 9;
  return '<div class="long-text' + (long ? ' is-clamped' : '') + '"><div class="long-body job-desc-full">' + out + '</div>' +
    (long ? '<button type="button" class="link-btn long-toggle" data-action="long-toggle" aria-expanded="false">Show more</button>' : '') + '</div>';
};
APP.jobSections = function (job, me) {
  const E = APP.h;
  /* ---- requirement rows with the viewer's own status: green = met, orange = partly (with the reason), red = missing.
     Missing "nice to have" items are grey, not red: they are not required. One line per option. ---- */
  const ICO = { ok: '✓', mid: '!', no: '✕', na: '–' };
  const lineHtml = (inner, st) => '<li class="jd-req st-' + (st ? st.cls : 'none') + '">' +
    '<span class="jd-ico" aria-hidden="true">' + (st ? ICO[st.cls] : '•') + '</span>' +
    '<span class="jd-req-t">' + inner + (st ? '<span class="jd-why">' + E(st.t) + '</span>' : '') + '</span></li>';
  const stSkill = (r) => {
    if (!me) return null;
    const m0 = APP.reqFit(me, r, APP.jobRoleType(job));
    const m = { kind: (m0.kind === 'direct' || m0.kind === 'wildcard') ? 'exact' : m0.kind === 'depth' ? 'projects' : m0.kind === 'adjacent' ? 'product' : m0.kind, have: m0.have, via: m0.via };
    if (m.kind === 'exact') return { cls: 'ok', t: 'You have this' + (m.have ? ' · ' + m.have + ' project' + (m.have === 1 ? '' : 's') : '') };
    if (m.kind === 'projects') return { cls: 'mid', t: 'You have ' + m.have + ' of ' + r.minProjects + ' projects' };
    if (m.kind === 'transfer') return { cls: 'mid', t: 'Transferable from ' + APP.productShort(m.via.productId) + ' ' + APP.skillName(m.via.productId, m.via.moduleId) };
    if (m.kind === 'product') return { cls: 'mid', t: 'You know ' + APP.productShort(r.productId) + ', other modules only' };
    if ((me.skills || []).some(k => k.productId === r.productId)) return { cls: 'no', t: 'You know ' + APP.productShort(r.productId) + ', but not this module' };
    return { cls: 'no', t: 'Not on your profile' };
  };
  const skillTxt = (r) => '<b>' + E(APP.productShort(r.productId)) + '</b> ' + E(APP.skillName(r.productId, r.moduleId)) + (r.minProjects ? ' <em>' + r.minProjects + '+ projects</em>' : '');
  const RANKC = { ok: 3, mid: 2, no: 1 };
  const reqLine = (g) => {
    if (g.length === 1) return lineHtml(skillTxt(g[0]), stSkill(g[0]));
    const sts = g.map(stSkill);
    let best = -1; sts.forEach((x, i) => { if (x && (best < 0 || RANKC[x.cls] > RANKC[sts[best].cls])) best = i; });
    const top = best >= 0 ? sts[best] : null;
    const head = top ? (top.cls === 'ok' ? { cls: 'ok', t: 'You meet this (option ' + (best + 1) + ')' } : top.cls === 'mid' ? { cls: 'mid', t: 'Partly met' } : { cls: 'no', t: 'Not met' }) : null;
    return '<li class="jd-group"><div class="jd-group-h st-' + (head ? head.cls : 'none') + '"><span class="jd-ico" aria-hidden="true">' + (head ? ICO[head.cls] : '•') + '</span>' +
      '<span><b>Any one of these</b>' + (head ? '<span class="jd-why">' + E(head.t) + '</span>' : '') + '</span></div>' +
      '<ul class="jd-opts">' + g.map((r, i) => (i ? '<li class="jd-or">or</li>' : '') + lineHtml(skillTxt(r), sts[i])).join('') + '</ul></li>';
  };
  const groups = APP.reqGroups(job);
  const plainLine = lineHtml;
  const myLangs = me ? (me.languages || []) : [];
  const certAny = me ? (me.skills || []).some(k => k.certified) : false;
  const must = groups.map(reqLine);
  (job.languages || []).forEach(l => must.push(lineHtml('<b>Language</b> ' + E(l), me ? (myLangs.includes(l) ? { cls: 'ok', t: 'You speak it' } : { cls: 'no', t: 'Not on your profile' }) : null)));
  if (job.certification === 'required') must.push(lineHtml('<b>SAP certification</b> required', me ? (certAny ? { cls: 'ok', t: 'You are SAP-certified' } : { cls: 'no', t: 'No certification on your profile' }) : null));
  if (job.minExp) must.push(lineHtml('<b>Experience</b> ' + E(APP.expLabel(job) || (job.minExp + '+ years')), me ? ((me.yearsExp || 0) >= job.minExp ? { cls: 'ok', t: 'You have ' + me.yearsExp + ' yrs' } : { cls: (me.yearsExp || 0) >= job.minExp - 2 ? 'mid' : 'no', t: 'You have ' + (me.yearsExp || 0) + ' yrs' }) : null));
  const nice = [];
  if (job.certification && job.certification !== 'required') nice.push(lineHtml('<b>SAP certification</b> preferred', me ? (certAny ? { cls: 'ok', t: 'You are SAP-certified' } : { cls: 'na', t: 'Not on your profile' }) : null));
  (job.preferredLangs || []).forEach(l => nice.push(lineHtml('<b>Language</b> ' + E(l), me ? (myLangs.includes(l) ? { cls: 'ok', t: 'You speak it' } : { cls: 'na', t: 'Not on your profile' }) : null)));
  if (+job.minPrograms > 0) {
    const pl0 = (APP.ROLE_PROFILE[APP.jobRoleType(job)] || {}).prog || 'Programs delivered';
    const have = me ? (+me.programs || 0) : 0;
    nice.push(lineHtml('<b>' + E(pl0) + '</b> ' + Number(job.minPrograms) + '+', me ? (have >= +job.minPrograms ? { cls: 'ok', t: 'You have ' + have } : have > 0 ? { cls: 'mid', t: 'You have ' + have + ' of ' + job.minPrograms } : { cls: 'na', t: 'Not on your profile' }) : null));
  }
  const mySpec = me ? (me.specialties || []) : [];
  (job.preferredSpecialties || []).forEach(id => {
    const has = mySpec.indexOf(id) !== -1 || mySpec.some(x => ((APP.SPECIAL_IDX[x] || {}).categoryId) === id);
    nice.push(lineHtml('<b>Specialty</b> ' + E(APP.specialtyName(id)), me ? (has ? { cls: 'ok', t: 'On your profile' } : { cls: 'na', t: 'Not on your profile' }) : null));
  });
  APP.jobIndustries(job).forEach(i => nice.push(lineHtml('<b>Industry</b> ' + E(i), me ? ((me.industries || []).includes(i) ? { cls: 'ok', t: 'In your industries' } : { cls: 'na', t: 'Not on your profile' }) : null)));

  const reqSection = (must.length || nice.length)
    ? '<section class="jd-sec"><h2>Requirements</h2>' +
      (must.length ? '<h3>Must have</h3><ul class="jd-reqs">' + must.join('') + '</ul>' : '') +
      (nice.length ? '<h3>Nice to have</h3><ul class="jd-reqs">' + nice.join('') + '</ul>' : '') + '</section>'
    : '';

  /* ---- role details grid ---- */
  const facts = [
    ['Role type', APP.roleTypeLabel(APP.jobRoleType(job))],
    ['Employment', job.employmentType],
    ['Location', APP.locText(job) + (job.remote ? ' · Remote-friendly' : '')],
    APP.SHOW_RATES ? ['Rate', APP.fmtRange(job)] : ['', ''],
    ['Duration', job.duration],
    ['Level', job.level],
    ['Experience', APP.expLabel(job) ? APP.expLabel(job) + ' exp' : ''],
    ['Posted', job.postedTs ? APP.timeAgo(job.postedTs) : '']
  ].filter(f => f[1] && String(f[1]).trim());
  const factsHtml = facts.map(f => '<div class="jd-fact"><dt>' + f[0] + '</dt><dd>' + E(f[1]) + '</dd></div>').join('');

  /* ---- description: keep paragraphs ---- */
  const descHtml = job.description
    ? '<section class="jd-sec"><h2>About the role</h2>' + APP.longTextHtml(job.description) + '</section>' : '';

  return { desc: descHtml, req: reqSection, facts: factsHtml };
};

APP.views['job-detail'] = function (ctx) {
  const job = APP.job(ctx.p[0]);
  if (!job) {
    /* a role posted moments ago may not be in this tab yet (the role list refreshes every few minutes): fetch once before giving up */
    const id = ctx && ctx.p && ctx.p[0], B = APP.backend;
    APP.state.jobTried = APP.state.jobTried || {};
    if (APP.LIVE && B && B.refreshPublicNow && id && !APP.state.jobTried[id]) {
      APP.state.jobTried[id] = true;
      B.refreshPublicNow().then(function () { if (location.hash === '#/job/' + id) APP.render(); });
      return '<div class="empty">Loading the role…</div>';
    }
    return '<div class="empty">Job not found — this role may no longer be listed.</div>';
  }
  const co = APP.coFor(APP.company(job.companyId), job);
  const sess = APP.db.session;
  const isC = sess && sess.role === 'consultant';
  const me = isC ? APP.consultant(sess.consultantId) : null;
  const open = job.status === 'open';
  document.title = job.title + (co ? ' at ' + co.name : '') + ' — Arnour';
  const E = APP.h;

  const secs = APP.jobSections(job, me);
  const descHtml = secs.desc, reqSection = secs.req, factsHtml = secs.facts;
  const coHref = co && !co._anon ? (APP.authorHref(co.id) || ('#/company/' + co.id)) : '';
  const isExt = !!job.external;
  const extSec = '<section class="jd-sec"><h2>About this listing</h2><div class="job-co job-co-flat">' + APP.avatarHtml(job.extEmployer || 'Jobs', 'lg') +
    '<div class="grow"><strong>' + E(job.extEmployer || 'The employer') + '</strong><small class="muted">External listing' + (job.extSource ? ' · via ' + E(job.extSource) : '') + '</small></div></div>' +
    '<p class="muted small" style="margin:10px 0 0">Arnour lists this role to help you find it. ' + E(job.extEmployer || 'The employer') + ' is not an Arnour member, and you apply on their own site.</p></section>';
  const coSec = isExt ? extSec : !co ? '' : co._anon
    ? '<section class="jd-sec"><h2>About the company</h2><div class="job-co job-co-flat">' + APP.avatarHtml(co.name, 'lg') +
      '<div class="grow"><strong>Confidential company</strong><small class="muted">' + E(co.industry) + ' · ' + E(APP.countryName(co.country) || APP.locText(co)) + '</small></div></div>' +
      '<p class="muted small" style="margin:10px 0 0">' + APP.icon('lock', 12) + ' The company name is shared with you once it accepts your application' + (sess ? '.' : ' — sign up to apply.') + '</p></section>'
    : '<section class="jd-sec"><h2>About the company</h2><div class="job-co job-co-flat">' + APP.avatarHtml(co.name, 'lg') +
      '<div class="grow"><a class="co-link" href="' + E(coHref) + '"><strong>' + E(co.name) + '</strong></a><small class="muted">' + E(co.industry) + ' · ' + E(APP.locText(co)) + '</small></div>' +
      '<a class="link" href="#/company/' + co.id + '">View company →</a></div></section>';

  const share = APP.shareHtml({
    title: job.title + (co && !co._anon ? ' — ' + co.name : ''),
    text: job.title + (co && !co._anon ? ' at ' + co.name : '') + ' · ' + APP.locText(job, job.remote ? 'Remote' : '') + (job.remote && (job.city || job.country) ? ' (remote ok)' : '') + ' — now hiring on Arnour, the SAP talent network.',
    tags: '#SAP #SAPJobs #Hiring',
    url: APP.shareUrl('#/job/' + job.id)
  });

  /* ---- side panel: actions + always-open match ---- */
  const applied = isC && APP.userKey() && (job.applicants || []).includes(APP.userKey());
  let side = '';
  if (isC && me) {
    const d = APP.matchDetail(me, job);
    const b = APP.matchBand(d.score);
    const why = APP.fitReasons(me, job);
    let act;
    if (applied) {
      const ts = job.appliedTs && job.appliedTs[me.id];
      act = '<div class="jd-applied">' + APP.icon('check', 14) + ' Applied' + (ts ? ' · ' + APP.timeAgo(ts) : '') + '</div>' +
        '<div class="btn-row"><button class="btn btn-outline btn-sm" data-action="withdraw" data-id="' + job.id + '">Withdraw</button>' +
        '<button class="btn btn-outline btn-sm" data-action="start-chat" data-eid="' + job.companyId + '" data-jid="' + job.id + '">' + APP.icon('clip', 14) + ' Message</button></div>';
    } else if (!open) {
      act = '<div class="jd-applied closed">This role is closed</div><div class="btn-row"><button class="btn btn-ghost btn-sm" data-action="toggle-save" data-id="' + job.id + '">' + (APP.isSavedJob(job.id) ? '★ Saved' : '☆ Save') + '</button></div>';
    } else {
      const ext = APP.safeApplyUrl(job), opened = !!(APP.state.extOpened && APP.state.extOpened[job.id]);
      act = (ext
        ? '<button class="btn btn-primary jd-apply" data-action="ext-apply" data-id="' + job.id + '">Apply on company site ' + APP.icon('ext', 15) + '</button>' +
          '<p class="muted small ext-note">You will leave Arnour to apply on ' + E(APP.applyDomain(job)) + '.</p>' +
          (opened && !isExt ? '<div class="ext-after"><span>Finished applying?</span><button class="btn btn-outline btn-sm" data-action="ext-applied" data-id="' + job.id + '">I have applied</button></div>' : '')
        : '<button class="btn btn-primary jd-apply" data-action="apply" data-id="' + job.id + '">Apply now</button>') +
        '<div class="btn-row"><button class="btn btn-outline btn-sm" data-action="toggle-save" data-id="' + job.id + '">' + (APP.isSavedJob(job.id) ? '★ Saved' : '☆ Save') + '</button>' +
        (isExt ? '' : '<button class="btn btn-outline btn-sm" data-action="start-chat" data-eid="' + job.companyId + '" data-jid="' + job.id + '">' + APP.icon('clip', 14) + ' Message</button>') + '</div>';
    }
    side = '<aside class="jd-side"><div class="card jd-act">' + act + '</div>' +
      '<div class="card jd-match" id="jd-match"><h2>Your match</h2>' +
      '<div class="mb-score"><strong>' + d.score + '%</strong><span class="match ' + b.cls + '">' + b.label + ' match</span></div>' +
      '<div class="jd-big-bar"><span class="' + b.cls + '" style="width:' + Math.max(2, Math.min(100, d.score)) + '%"></span></div>' +
      (why.length ? '<h4>Why it fits</h4><div class="chip-wrap">' + why.map(t => '<span class="chip">' + E(t) + '</span>').join('') + '</div>' : '') +
      (d.gaps.length ? '<h4>To check</h4><ul class="mb-gaps">' + d.gaps.slice(0, 5).map(t => '<li>' + E(t) + '</li>').join('') + '</ul>' : '') +
      '<h4>How the score is built</h4>' + APP.matchPartsHtml(d) +
      '<p class="muted small">Based on your profile, so keep it up to date. <a class="link" href="#/c/profile">Edit profile</a></p>' +
      '</div></aside>';
  } else if (!sess) {
    side = '<aside class="jd-side"><div class="card jd-act">' +
      (open ? '<a class="btn btn-primary jd-apply" href="#/register" data-action="remember-job" data-id="' + job.id + '">Sign up to apply</a>' : '<div class="jd-applied closed">This role is closed</div>') +
      '<div class="btn-row"><a class="btn btn-ghost btn-sm" href="#/login" data-action="remember-job" data-id="' + job.id + '">Sign in</a></div></div>' +
      '<div class="card jd-match jd-match-anon"><h2>Your match</h2><p class="muted">Create a free profile to see how well you match this role, what fits and what to check, before you apply.</p>' +
      '<a class="btn btn-outline btn-sm" href="#/register" data-action="remember-job" data-id="' + job.id + '">Join Arnour</a></div></aside>';
  }

  return '<div class="jd' + (side ? '' : ' jd-one') + '">' +
    APP.crumbHtml(APP.db.session && APP.db.session.role === 'consultant' ? '#/c/jobs' : '#/jobs', 'All open roles') +
    '<header class="jd-head card">' +
    (isExt ? '<span class="jd-co">' + APP.avatarHtml(job.extEmployer || 'Jobs', 'sm') + '<span>' + E(job.extEmployer || '') + '</span><span class="pill ext-badge">External listing' + (job.extSource ? ' · via ' + E(job.extSource) : '') + '</span></span>' : co ? (co._anon ? '<span class="jd-co">' + APP.avatarHtml(co.name, 'sm') + '<span>Confidential company</span></span>' : '<a class="jd-co" href="' + E(coHref) + '">' + APP.avatarHtml(co.name, 'sm') + '<span>' + E(co.name) + '</span></a>') : '') +
    '<h1 class="jd-title">' + E(job.title) + APP.samplePill(job) + (!open ? ' <span class="pill muted-pill">Closed</span>' : '') + '</h1>' +
    (APP.LIVE && job.sample ? '<p class="sample-note">Sample role, for illustration. Applications to sample roles are not sent to a real company.</p>' : '') +
    (APP.modTools ? APP.modTools('job', job.id, !!(job.mine || (APP.db.session && job.companyId === APP.db.session.companyId)), true) : '') +
    '<div class="job-meta">' +
    '<span>' + APP.icon('briefcase') + E(job.employmentType) + '</span>' +
    '<span>' + APP.icon('pin') + E(APP.locText(job)) + (job.remote ? ' · Remote-friendly' : '') + '</span>' +
    (APP.SHOW_RATES ? '<span>' + APP.icon('file') + E(APP.fmtRange(job)) + '</span>' : '') +
    (job.duration ? '<span>' + APP.icon('check') + E(job.duration) + '</span>' : '') +
    '</div></header>' +
    '<div class="jd-grid"><div class="jd-main card">' +
    descHtml + reqSection +
    (factsHtml ? '<section class="jd-sec"><h2>Role details</h2><dl class="jd-facts">' + factsHtml + '</dl></section>' : '') +
    coSec + share +
    '</div>' + side + '</div></div>';
};

/* ------------------------------ public consultant profile ------------------------------ */

APP.peopleCrumb = function () {
  const s = APP.db.session;
  return s && s.role === 'consultant' ? APP.crumbHtml('#/community/people', 'People') : s && s.role === 'employer' ? APP.crumbHtml('#/e/talent', 'Talent search') : APP.crumbHtml('#/', 'Home');
};
APP.views['talent-public'] = function (ctx) {
  const c = APP.consultant(ctx.p[0]);
  if (!c) return '<div class="empty">Profile not found — this professional may no longer be on Arnour.</div>';
  if (!APP.canSeePerson(c)) {
    document.title = 'Private profile · Arnour';
    const sx = APP.db.session;
    /* another professional: the anonymous profile (skills first, name second) — no name, photo, LinkedIn, CV, about, city or availability */
    if (sx && sx.role === 'consultant' && sx.consultantId !== c.id) {
      const a = Object.assign({}, APP.cv(c, true), { availability: '', gender: '' });
      return '<div class="narrow">' + APP.peopleCrumb() + '' +
        '<div class="card anon-note">' + APP.icon('lock', 16) + '<span><b>Private profile</b> — name and contact details are hidden until they choose to share them. You can still send a message.</span></div>' +
        APP.consultantProfileHtml(a, { public: true, headActions: '<button class="btn btn-primary btn-sm" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 14) + ' Message</button>' + (APP.modTools ? APP.modTools('profile', c.id, false) : '') }) +
        '</div>';
    }
    return '<div class="narrow">' + APP.peopleCrumb() + '<div class="card empty anon-empty">' + APP.icon('lock', 28) +
      '<h3>This profile is private</h3><p class="muted">This professional uses Mutual Reveal: skills first, name second. Their identity is shared only when they choose to share it.</p>' +
      (!sx ? '<div class="btn-row" style="justify-content:center"><a class="btn btn-primary btn-sm" href="#/login">Sign in to see more</a><a class="btn btn-outline btn-sm" href="#/register">Join free</a></div>'
        : sx.role === 'employer' ? '<a class="btn btn-primary btn-sm" href="#/e/talent/' + c.id + '">View anonymous profile</a>'
        : '<a class="btn btn-outline btn-sm" href="#/">Back to home</a>') + '</div></div>';
  }
  const name = APP.consultantFullName(c);
  document.title = name + ' — SAP Professional · Arnour';
  const s = APP.db.session;

  let headActions;
  if (s && s.role === 'employer') {
    headActions = '<button class="btn btn-primary btn-sm" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 14) + ' Message ' + APP.h(c.firstName || name) + '</button>';
  } else if (!s) {
    headActions = '<a class="btn btn-primary btn-sm" href="#/login">Sign in to contact</a><a class="btn btn-outline btn-sm" href="#/register">Join free</a>';
  } else if (s.consultantId !== c.id) {
    headActions = '<button class="btn btn-primary btn-sm" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 14) + ' Message</button>';
  } else {
    headActions = '<a class="btn btn-outline btn-sm" href="#/community">' + APP.icon('users', 14) + ' Meet in the community</a>';
  }

  const share = APP.shareHtml({
    title: name + ' — SAP professional',
    text: name + ' · ' + (c.headline || 'SAP professional') + ' — profile on Arnour, the SAP talent network.',
    tags: '#SAP #SAPConsultant',
    url: APP.shareUrl('#/talent/' + c.id)
  });

  return '<div class="narrow">' +
    APP.peopleCrumb() +
    APP.consultantProfileHtml(c, { public: true, headActions: headActions + (APP.modTools ? APP.modTools('profile', c.id, !!(s && s.consultantId === c.id)) : '') }) +
    share +
    '</div>';
};

/* ------------------------------ public company page ------------------------------ */

APP.views['company-public'] = function (ctx) {
  const co = APP.company(ctx.p[0]);
  if (!co) return '<div class="empty">Company not found.</div>';
  if (co.anon && !APP.canSeeCompany(co)) {
    document.title = 'Confidential company · Arnour';
    return '<div class="narrow">' + APP.crumbHtml(APP.db.session && APP.db.session.role === 'consultant' ? '#/c/jobs' : '#/jobs', 'Open roles') + '<div class="card empty anon-empty">' + APP.icon('lock', 28) +
      '<h3>This company is confidential</h3><p class="muted">This company uses Mutual Reveal: its name is shared only after it accepts an introduction with a professional.</p><a class="btn btn-outline btn-sm" href="#/jobs">Browse open roles</a></div></div>';
  }
  document.title = co.name + ' — hiring on Arnour';
  const jobs = APP.companyJobs(co.id).filter(j => j.status === 'open' && APP.canSeeCompany(co, j)).sort((a, b) => b.postedTs - a.postedTs);
  const s = APP.db.session;

  const share = APP.shareHtml({
    title: co.name,
    text: co.name + (co.industry ? ' (' + co.industry + ')' : '') + ' is hiring for SAP roles on Arnour.',
    tags: '#SAP #Hiring',
    url: APP.shareUrl('#/company/' + co.id)
  });

  const cta = s && s.role === 'consultant'
    ? '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="start-chat" data-eid="' + co.id + '">' + APP.icon('clip', 14) + ' Message</button><a class="btn btn-outline btn-sm" href="#/jobs">' + APP.icon('briefcase', 14) + ' Browse open roles</a></div>'
    : s && s.role === 'employer'
      ? '<span class="muted small">You are viewing a company page as an employer — switch to a professional account to apply for roles.</span>'
      : '<div class="btn-row"><a class="btn btn-primary btn-sm" href="#/login">Sign in</a><a class="btn btn-outline btn-sm" href="#/register">Create a free account to apply</a></div>';

  return '<div class="narrow">' +
    APP.crumbHtml(APP.db.session && APP.db.session.role === 'consultant' ? '#/c/jobs' : '#/jobs', 'Open roles') +
    '<div class="card co-banner-card">' +
    '<div class="co-banner"><span class="brand-logo xl">' + APP.h(APP.initials(co.name)) + '</span></div>' +
    '<div class="co-banner-body">' +
    '<div class="co-id"><h2>' + APP.h(co.name) + APP.samplePill(co) + '</h2>' +
    '<p class="muted">' + APP.h(co.industry) + ' · ' + APP.h(co.size) + ' · ' + APP.icon('pin', 13) + ' ' + APP.h(APP.locText(co)) + (co.website ? ' · ' + APP.h(co.website) : '') + '</p></div>' +
    (co.contactName ? '<div class="co-contact muted small">' + APP.icon('users', 13) + ' ' + APP.h(co.contactName) + (co.contactTitle ? ' · ' + APP.h(co.contactTitle) : '') + '</div>' : '') +
    (APP.modTools ? APP.modTools('company', co.id, !!(APP.db.session && APP.db.session.companyId === co.id), true) : '') +
    '</div></div>' +

    (co.about ? '<div class="card"><div class="card-h">About</div><p>' + APP.h(co.about) + '</p></div>' : '') +

    '<div class="grid-2">' +
    '<div class="card"><div class="card-h">SAP systems in use</div><div class="chip-wrap">' +
    ((co.sapSystems || []).length ? co.sapSystems.map(id => '<span class="chip">' + APP.h(APP.productShort(id)) + '</span>').join('') : '<span class="muted small">Not listed yet.</span>') +
    '</div></div>' +
    '<div class="card"><div class="card-h">Open roles (' + jobs.length + ')</div>' +
    (jobs.length
      ? jobs.map(j => '<a class="app-item" href="#/job/' + j.id + '"><div class="grow"><strong>' + APP.h(j.title) + '</strong><small class="muted">' + APP.h(APP.locText(j)) + ' · posted ' + APP.timeAgo(j.postedTs) + '</small></div><span class="muted small">View →</span></a>').join('')
      : '<div class="empty small">None open right now.</div>') +
    '</div></div>' +

    '<div class="btn-row mt16">' + cta + '</div>' +
    share +
    '</div>';
};
