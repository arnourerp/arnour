/* ============================================================================
   ARNOUR — CORE (state, storage, router, helpers, actions, shared UI parts)
   ============================================================================ */

const APP = window.APP = {};

/* ---------------------------- constants ---------------------------- */

APP.regions = {
  'middle-east': 'Middle East',
  'north-africa': 'North Africa',
  'india': 'India & Pakistan',
  'other': 'Other'
};

/* 22 countries (client list). Regions group them for matching & coarse filters. */
APP.countries = [
  { id: 'eg', name: 'Egypt', region: 'middle-east', cities: ['Cairo', 'Alexandria', 'Giza'] },
  { id: 'jo', name: 'Jordan', region: 'middle-east', cities: ['Amman', 'Zarqa', 'Irbid'] },
  { id: 'ps', name: 'Palestine', region: 'middle-east', cities: ['Ramallah', 'Gaza', 'Jerusalem', 'Bethlehem'] },
  { id: 'lb', name: 'Lebanon', region: 'middle-east', cities: ['Beirut', 'Tripoli', 'Sidon'] },
  { id: 'iq', name: 'Iraq', region: 'middle-east', cities: ['Baghdad', 'Basra', 'Erbil'] },
  { id: 'tr', name: 'Turkey', region: 'middle-east', cities: ['Istanbul', 'Ankara', 'Izmir'] },
  { id: 'ae', name: 'United Arab Emirates', region: 'middle-east', cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Al Ain', 'Fujairah', 'Umm Al Quwain'] },
  { id: 'sa', name: 'Saudi Arabia', region: 'middle-east', cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina'] },
  { id: 'qa', name: 'Qatar', region: 'middle-east', cities: ['Doha', 'Al Wakrah'] },
  { id: 'kw', name: 'Kuwait', region: 'middle-east', cities: ['Kuwait City', 'Al Ahmadi', 'Al Jubail'] },
  { id: 'bh', name: 'Bahrain', region: 'middle-east', cities: ['Manama', 'Muharraq'] },
  { id: 'om', name: 'Oman', region: 'middle-east', cities: ['Muscat', 'Salalah', 'Sohar'] },
  { id: 'ma', name: 'Morocco', region: 'north-africa', cities: ['Casablanca', 'Rabat', 'Marrakech'] },
  { id: 'tn', name: 'Tunisia', region: 'north-africa', cities: ['Tunis', 'Sfax', 'Sousse'] },
  { id: 'dz', name: 'Algeria', region: 'north-africa', cities: ['Algiers', 'Oran', 'Constantine'] },
  { id: 'in', name: 'India', region: 'india', cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Gurgaon', 'Kolkata'] },
  { id: 'pk', name: 'Pakistan', region: 'india', cities: ['Karachi', 'Lahore', 'Islamabad'] },
  { id: 'gb', name: 'United Kingdom', region: 'other', cities: ['London', 'Manchester', 'Birmingham'] },
  { id: 'de', name: 'Germany', region: 'other', cities: ['Munich', 'Frankfurt', 'Hamburg', 'Berlin'] },
  { id: 'us', name: 'United States', region: 'other', cities: ['New York', 'Chicago', 'Austin'] },
  { id: 'fr', name: 'France', region: 'other', cities: ['Paris', 'Lyon', 'Marseille'] },
  { id: 'other', name: 'Other', region: 'other', cities: [] }
];
APP.countriesById = Object.fromEntries(APP.countries.map(c => [c.id, c]));

/* Nationalities mirror the 22-country list (name per country, 'Other' as fallback). */
APP.nationalities = ['Egypt', 'Jordan', 'Palestine', 'Lebanon', 'Iraq', 'Turkey', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Morocco', 'Tunisia', 'Algeria', 'India', 'Pakistan', 'United Kingdom', 'Germany', 'United States', 'France', 'Other'];
APP.languages = ['English', 'Arabic', 'Hindi', 'Urdu', 'French'];
APP.levels = ['Junior', 'Mid', 'Senior'];
APP.genders = [['male', 'Male'], ['female', 'Female']];
APP.genderLabel = (g) => (APP.genders.find(x => x[0] === g) || [0, ''])[1];
APP.availability = ['Immediate', 'Within 15 days', 'Within 30 days', 'Within 60 days', 'Within 90 days'];
APP.workPrefs = ['Remote', 'Part-time', 'Hybrid'];

/* Curated SAP specialty hierarchy — 4 practice areas, 36 specialties (consultant step 4, profile, job "preferred specialties", talent search). Groups with an empty name render without a heading. */
APP.specialties = [
  { id: 'strategic', name: 'Strategic Advisory & Architecture', groups: [
    { name: 'Cloud Transformation Programs', items: [
      { id: 'rise', name: 'RISE with SAP', short: 'RISE' },
      { id: 'grow', name: 'GROW with SAP', short: 'GROW' }
    ] },
    { name: 'Enterprise & Solution Architecture', items: [
      { id: 's4cloud-arch', name: 'S/4HANA Cloud Architecture (Public / Private)', short: 'S/4HANA Cloud Architecture' },
      { id: 'clean-core', name: 'Clean Core Strategy', short: 'Clean Core' },
      { id: 'integration-arch', name: 'Integration Architecture (SAP Integration Suite / CPI)', short: 'Integration Architecture' }
    ] },
    { name: 'Business Transformation & Discovery', items: [
      { id: 'value-discovery', name: 'Value Discovery & Business Case', short: 'Value Discovery' },
      { id: 'fit-standard', name: 'Fit-to-Standard Workshops', short: 'Fit-to-Standard' },
      { id: 'process-mining', name: 'Process Transformation & Mining (SAP Signavio)', short: 'Signavio / Process Mining' },
      { id: 'presales', name: 'Presales / Proof of Concept (PoC)', short: 'Presales / PoC' }
    ] }
  ] },
  { id: 'implementation', name: 'Implementation & Transition Leadership', groups: [
    { name: 'Migration & Transition Strategies', items: [
      { id: 'greenfield', name: 'Greenfield Implementation (New Implementation)', short: 'Greenfield' },
      { id: 'brownfield', name: 'Brownfield (System Conversion)', short: 'Brownfield' },
      { id: 'sdt', name: 'Selective Data Transition / SDT (Carve-outs & Mergers)', short: 'SDT (Carve-outs & Mergers)' }
    ] },
    { name: 'Localization & Statutory', items: [
      { id: 'localization', name: 'Localization & Statutory Compliance (e-Invoicing, VAT, country versions)', short: 'Localization' }
    ] },
    { name: 'Program Governance & Methodology', items: [
      { id: 'activate', name: 'SAP Activate Methodology', short: 'SAP Activate' },
      { id: 'pmo', name: 'Project Management & Governance (PMO)', short: 'Project Mgmt & Governance (PMO)' },
      { id: 'cutover', name: 'Cutover & Go-Live', short: 'Cutover' }
    ] },
    { name: 'Data Management', items: [
      { id: 'data-migration', name: 'Data Migration & ETL (Migration Cockpit, BODS, Syniti)', short: 'Data Migration & ETL' },
      { id: 'mdg', name: 'Master Data Governance (SAP MDG)', short: 'MDG' },
      { id: 'data-cleansing', name: 'Data Cleansing & Quality', short: 'Data Cleansing' }
    ] }
  ] },
  { id: 'engineering', name: 'Engineering, Quality & Platform Operations', groups: [
    { name: 'Platform & Extensibility', items: [
      { id: 'btp', name: 'SAP BTP (Business Technology Platform)', short: 'BTP' },
      { id: 'build', name: 'SAP Build & Low-Code / No-Code Automation', short: 'SAP Build' },
      { id: 'extensibility', name: 'Extensibility (RAP / CAP / Side-by-side)', short: 'Extensibility' }
    ] },
    { name: 'Quality, Testing & ALM', items: [
      { id: 'testing', name: 'Test Management & Automation (Tricentis / Tosca)', short: 'Test Automation' },
      { id: 'alm', name: 'SAP Cloud ALM / Solution Manager', short: 'Cloud ALM / SolMan' },
      { id: 'uat', name: 'UAT Coordination', short: 'UAT Coordination' },
      { id: 'release', name: 'Release Management', short: 'Release Mgmt' },
      { id: 'upgrades', name: 'Release Upgrades (Feature & Support Packs)', short: 'Release Upgrades' }
    ] },
    { name: 'Security & Compliance', items: [
      { id: 'security', name: 'SAP Security, Authorizations & GRC', short: 'Security & GRC' }
    ] },
    { name: 'Production Operations & Hypercare', items: [
      { id: 'hypercare', name: 'Hypercare & Go-Live Transition', short: 'Hypercare' },
      { id: 'ams', name: 'AMS & Production Support (L2/L3)', short: 'AMS & Support' },
      { id: 'sla', name: 'SLA & Incident Management', short: 'SLA / Incident' },
      { id: 'hadr', name: 'High Availability & Disaster Recovery', short: 'HA/DR' },
      { id: 'perf', name: 'Performance Optimization & Health Checks', short: 'Performance' }
    ] }
  ] },
  { id: 'adoption', name: 'Adoption & Change Enablement', groups: [
    { name: '', items: [
      { id: 'ocm', name: 'Organizational Change Management (OCM)', short: 'OCM' },
      { id: 'training', name: 'User Enablement & Training', short: 'Training & Enablement' },
      { id: 'process-doc', name: 'Process Documentation', short: 'Process Docs' }
    ] }
  ] }
];
/* Ids from the previous hierarchy → the new one (applied to saved data on load so nothing is lost) */
APP.specialtyMigrate = {
  'solution-arch': 's4cloud-arch', 'poc': 'value-discovery', 'project-mgmt': 'pmo', 'eppm': 'pmo',
  'support': 'ams', 'operations': 'engineering'
};
APP.migrateSpecialties = function (db) {
  const fix = (arr) => {
    const out = [];
    (arr || []).forEach(id => { const n = APP.specialtyMigrate[id] || id; if (out.indexOf(n) < 0) out.push(n); });
    return out;
  };
  Object.values(db.consultants || {}).forEach(c => { if (c.specialties) c.specialties = fix(c.specialties); });
  Object.values(db.jobs || {}).forEach(j => { if (j.preferredSpecialties) j.preferredSpecialties = fix(j.preferredSpecialties); });
  APP.migrateCatalog(db);
};

/* v15 catalog: [oldProduct, oldModule, newProduct, newModule]. Everything not listed keeps its ids. */
APP.catalogMigrate = [
  ['s4onprem', 'bobods', 'data', 'bods'], ['s4onprem', 'po', 'ecc', 'po'],
  ['ecc', 'hanadba', 's4onprem', 'hanadba'],
  ['ecc', 'isoilgas', 'industry', 'isoilgas'], ['ecc', 'isretail', 'industry', 'isretail'], ['ecc', 'isrealestate', 'industry', 'isrealestate'],
  ['ecc', 'isautomotive-proaxia', 'industry', 'isautomotive'], ['ecc', 'isautomotive-dbm', 'industry', 'isautomotive'],
  ['sac', 'bistories', 'data', 'bistories'], ['sac', 'planning', 'data', 'planning'], ['sac', 'datasphere', 'data', 'datasphere'],
  ['sac', 'designer', 'data', 'bistories']
];
APP.migrateCatalog = function (db) {
  const map = (p, m) => {
    for (const r of APP.catalogMigrate) if (r[0] === p && r[1] === m) return [r[2], r[3]];
    if (p === 'sac') return ['data', m];
    return [p, m];
  };
  const valid = (p, m) => m === '*' || !m || !!(CAT_INDEX.mods[p + ':' + m]);
  const fixList = (list, keyProj) => {
    const out = [];
    (list || []).forEach(k => {
      const nm = map(k.productId, k.moduleId);
      k.productId = nm[0]; k.moduleId = nm[1];
      if (!CAT_INDEX.byId[k.productId]) return;
      if (k.moduleId && !valid(k.productId, k.moduleId)) k.moduleId = '';
      const dup = k.moduleId && out.find(x => x.productId === k.productId && x.moduleId === k.moduleId);
      if (dup) { dup[keyProj] = Math.max(+dup[keyProj] || 0, +k[keyProj] || 0); dup.certified = dup.certified || k.certified; return; }
      out.push(k);
    });
    return out;
  };
  Object.values(db.consultants || {}).forEach(c => { if (c.skills) c.skills = fixList(c.skills, 'projects'); });
  Object.values(db.jobs || {}).forEach(j => { if (j.requires) j.requires = fixList(j.requires, 'minProjects'); });
  const fixTag = (x) => { if (!x || !x.productId) return; const nm = map(x.productId, x.moduleId); x.productId = nm[0]; x.moduleId = nm[1]; if (x.moduleId && !valid(x.productId, x.moduleId)) x.moduleId = ''; };
  Object.values(db.questions || {}).forEach(fixTag);
  Object.values(db.articles || {}).forEach(fixTag);
  Object.values(db.companies || {}).forEach(co => {
    if (Array.isArray(co.sapSystems)) { const o = []; co.sapSystems.forEach(id => { const n = id === 'sac' ? 'data' : id; if (CAT_INDEX.byId[n] && o.indexOf(n) < 0) o.push(n); }); co.sapSystems = o; }
  });
};
APP.specialtyItems = [];
APP.SPECIAL_IDX = {};
for (const _cat of APP.specialties) {
  for (const _g of _cat.groups) {
    for (const _it of _g.items) {
      APP.specialtyItems.push(_it);
      APP.SPECIAL_IDX[_it.id] = Object.assign({}, _it, { categoryId: _cat.id, category: _cat.name });
    }
  }
}
/** Display name for a specialty (or practice-area) id — short label when available. */
APP.specialtyName = function (id) {
  if (!id) return '';
  const it = APP.SPECIAL_IDX[id];
  if (it) return it.short || it.name;
  const cat = APP.specialties.find(x => x.id === id);
  return cat ? cat.name : String(id);
};
/** Long form for tooltips: "Item · Practice area". */
APP.specialtyLabel = function (id) {
  const it = APP.SPECIAL_IDX[id];
  if (it) return it.name + ' · ' + it.category;
  const cat = APP.specialties.find(x => x.id === id);
  return cat ? cat.name : String(id || '');
};

/* ---------------------------- role types (round 10) ----------------------------
   The professional side is not only consultants — 8 role types, user-supplied.
   Used by: onboarding wizard, profile edit, Find Talent filter, displayed profiles. */
APP.roleTypes = [
  { id: 'functional', name: 'Functional Consultant', sub: 'Configures core business modules and process flows.' },
  { id: 'technical', name: 'Developer / Technical Consultant', sub: 'Builds custom applications, APIs, and integrations.' },
  { id: 'basis', name: 'Basis, Cloud & Security', sub: 'Manages system performance, security, databases, and hosting.' },
  { id: 'architect', name: 'Solution & Enterprise Architect', sub: 'Drives high-level landscape design and governance.' },
  { id: 'delivery', name: 'Project / Delivery Manager', sub: 'Directs project timelines, resources, and cutovers.' },
  { id: 'support', name: 'Support & AMS / Application Lead', sub: 'Oversees day-to-day operations and incident tickets.' },
  { id: 'keyuser', name: 'Business Expert / Key User', sub: 'In-house business specialist validating requirements.' },
  { id: 'junior', name: 'Junior / Trainee', sub: 'Early-career professional building SAP skills.' }
];
APP.roleTypeById = Object.fromEntries(APP.roleTypes.map(t => [t.id, t]));
APP.roleTypeLabel = function (id) {
  const t = APP.roleTypeById[id];
  return t ? t.name : '';
};
APP.RT_MAX = 3;
/* Which sign-up step-1 sections are complete (drives the card ticks). */
APP.wizSecDone = function (d) {
  const t = (v) => !!String(v || '').trim();
  return {
    role: APP.rtList(d).length > 0,
    who: t(d.firstName) && t(d.lastName) && (d.gender === 'male' || d.gender === 'female') && t(d.headline),
    where: t(d.nationality) && t(d.country),
    languages: (d.languages || []).length > 0
  };
};
/* A person can hold up to 3 role types; roleTypes[0] is the primary one and roleType always mirrors it (older code and cards read roleType). */
APP.rtList = function (d) {
  if (!d) return [];
  const l = Array.isArray(d.roleTypes) && d.roleTypes.length ? d.roleTypes : (d.roleType ? [d.roleType] : []);
  return l.filter((id, i) => APP.roleTypeById[id] && l.indexOf(id) === i).slice(0, APP.RT_MAX);
};
APP.rtSet = function (d, list) { d.roleTypes = list.slice(0, APP.RT_MAX); d.roleType = d.roleTypes[0] || ''; };
APP.roleTypeLine = function (c) { return APP.rtList(c).map(APP.roleTypeLabel).join(' · '); };
/* Role picker. Multi-select (max 3, first pick = primary; Junior / Trainee stands alone) — or, with opts.single (sign-up), one role only. */
APP.roleTypePicker = function (scope, d, opts) {
  opts = opts || {};
  const sel = APP.rtList(d);
  const rows = APP.roleTypes.map(function (t) {
    const on = sel.indexOf(t.id) !== -1, primary = on && sel[0] === t.id && !opts.single;
    return '<div class="rt-item' + (on ? ' on' : '') + '">' +
      '<button type="button" class="chip rt-opt' + (on ? ' chip-on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" data-action="rt-toggle" data-scope="' + scope + '" data-value="' + t.id + '"' + (opts.single ? ' data-single="1"' : '') + '>' +
      '<span class="rt-check" aria-hidden="true">' + (on ? APP.icon('check', 14) : '') + '</span>' +
      '<span class="rt-txt"><span class="rt-name">' + APP.h(t.name) + (primary ? ' <span class="rt-primary">Primary</span>' : '') + (on && opts.single ? ' <span class="rt-primary">Selected</span>' : '') + '</span><span class="rt-sub">' + APP.h(t.sub) + '</span></span></button>' +
      (on && !primary && !opts.single ? '<button type="button" class="link rt-make" data-action="rt-primary" data-scope="' + scope + '" data-value="' + t.id + '">Make primary</button>' : '') +
      '</div>';
  }).join('');
  if (opts.single) {
    return '<div class="rt-callout" role="note">' + APP.icon('spark', 18) + '<div><b>Choose your main role.</b> The next steps are tailored to it.' +
      '<div class="rt-tip">' + APP.icon('plus', 14) + '<span><b>Do more than one role?</b> You can add more later in Edit profile.</span></div></div></div>' +
      '<div class="rt-list" data-rt-list>' + rows + '</div>' +
      '<p class="rt-chosen' + (sel.length ? ' on' : '') + '" role="status" aria-live="polite">' + (sel.length ? APP.icon('check', 14) + ' Your role: <b>' + APP.h(APP.roleTypeLabel(sel[0])) + '</b>' : 'No role selected yet') + '</p>';
  }
  return '<div class="rt-list">' + rows + '</div>' +
    '<p class="field-hint rt-meta"><b>' + sel.length + ' of ' + APP.RT_MAX + '</b> selected · pick up to 3 — your first pick is your primary role. Each role you add brings the fields it needs. Companies can search by any of them.</p>';
};

/* ---- what each role is asked for (sign-up and Edit profile) ----
   skills:  full = product → module → projects · optional = same, projects optional · modules = modules only (no counts) · products = products only
   ind:     many / optional / one / '' (hidden)       lvl: ask for experience level (otherwise it is derived)       prog: label of the single "how many" number */
APP.ROLE_PROFILE = {
  functional: { skills: 'full',     ind: 'many',     lvl: 1, prog: '' },
  technical:  { skills: 'optional', ind: 'many',     lvl: 1, prog: '' },
  basis:      { skills: 'products', ind: '',         lvl: 1, prog: '' },
  architect:  { skills: 'modules',  ind: 'many',     lvl: 1, prog: 'Programs delivered' },
  delivery:   { skills: 'modules',  ind: 'many',     lvl: 1, prog: 'Projects led' },
  support:    { skills: 'modules',  ind: 'optional', lvl: 1, prog: '' },
  keyuser:    { skills: 'modules',  ind: 'one',      lvl: 0, prog: '' },
  junior:     { skills: 'products', ind: '',         lvl: 0, prog: '' }
};
/* Leadership / design roles describe themselves by specialties first; SAP products are required, modules optional. */
APP.LEAD_RTS = ['architect', 'delivery'];
APP.isLeadRole = function (d) { const rt = d && (APP.rtList(d)[0] || d.roleType); return APP.LEAD_RTS.indexOf(rt) !== -1; };
/* products with no module ticked are kept as product-level rows (moduleId '*') */
APP.normalizeLandscape = function (skills) {
  const out = [], seen = {};
  (skills || []).forEach(k => { if (k.productId && k.moduleId && k.moduleId !== '*') { out.push(k); seen[k.productId] = 1; } });
  (skills || []).forEach(k => { if (k.productId && !seen[k.productId]) { seen[k.productId] = 1; out.push(Object.assign({}, k, { moduleId: '*', projects: +k.projects || 0 })); } });
  return out;
};
APP.ROLE_SPECIALTIES = {
  functional: ['fit-standard', 'process-mining', 'greenfield', 'brownfield', 'activate', 'data-migration', 'mdg', 'cutover', 'localization', 'testing', 'hypercare', 'training'],
  technical:  ['clean-core', 'extensibility', 'integration-arch', 'greenfield', 'brownfield', 'data-migration', 'btp', 'build', 'testing', 'hypercare', 'perf'],
  basis:      ['rise', 's4cloud-arch', 'clean-core', 'brownfield', 'sdt', 'cutover', 'hadr', 'btp', 'alm', 'security', 'hypercare', 'perf'],
  architect:  ['presales', 'value-discovery', 'rise', 'grow', 's4cloud-arch', 'clean-core', 'integration-arch', 'fit-standard', 'process-mining', 'greenfield', 'brownfield', 'sdt', 'btp'],
  delivery:   ['rise', 'grow', 'greenfield', 'brownfield', 'sdt', 'activate', 'pmo', 'release', 'cutover', 'alm', 'hypercare', 'ocm'],
  support:    ['sla', 'upgrades', 'testing', 'alm', 'security', 'hypercare', 'ams', 'perf'],
  keyuser:    ['fit-standard', 'process-mining', 'activate', 'data-cleansing', 'mdg', 'build', 'uat', 'hypercare', 'ocm', 'training'],
  junior:     ['activate', 'data-migration', 'testing', 'process-doc', 'hypercare', 'training']
};
APP.SKILL_RANK = { products: 1, modules: 2, optional: 3, full: 4 };
APP.IND_RANK = { '': 0, one: 1, optional: 2, many: 3 };
/* Merged requirements of everyone's roles (a person with two roles sees the richer of each). No role yet → the full form. */
APP.roleProfile = function (d) {
  const rts = APP.rtList(d);
  if (!rts.length) return { skills: 'full', ind: 'many', lvl: 1, prog: '', rts: rts };
  const out = { skills: 'products', ind: '', lvl: 0, prog: '', rts: rts };
  rts.forEach(function (rt) {
    const p = APP.ROLE_PROFILE[rt] || APP.ROLE_PROFILE.functional;
    if (APP.SKILL_RANK[p.skills] > APP.SKILL_RANK[out.skills]) out.skills = p.skills;
    if (APP.IND_RANK[p.ind] > APP.IND_RANK[out.ind]) out.ind = p.ind;
    if (p.lvl) out.lvl = 1;
    if (!out.prog && p.prog) out.prog = p.prog;
  });
  return out;
};
/* Does this person record project counts per module? (only Functional / Technical do) */
APP.countsTracked = function (d) { const s = APP.roleProfile(d).skills; return s === 'full' || s === 'optional'; };
/* Role types whose job requirements carry a minimum project count */
APP.rtCounts = function (rt) { const p = APP.ROLE_PROFILE[rt]; return !!p && (p.skills === 'full' || p.skills === 'optional'); };
/* Specialties to suggest first: the primary role's, then the others'. */
APP.specialtiesForRoles = function (rts) {
  const out = [];
  (rts || []).forEach(rt => (APP.ROLE_SPECIALTIES[rt] || []).forEach(id => { if (out.indexOf(id) === -1 && APP.SPECIAL_IDX[id]) out.push(id); }));
  return out;
};
APP.levelFromYears = function (y) { y = +y || 0; return y <= 3 ? 'Junior' : y <= 8 ? 'Mid' : 'Senior'; };
/* The skills a fresh profile starts with, per role */
/* Sign-up starts with no product or module ticked — the person chooses their own. */
APP.defaultSkillsFor = function () { return []; };
/* Free text (or an array) → clean, deduped tag list. */
APP.tagList = function (v) {
  const src = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,，]/);
  const out = [];
  for (const x of src) {
    const t = String(x).trim();
    if (!t) continue;
    if (!out.some(y => y.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
};
APP.currencies = [
  { id: 'USD', name: 'USD — US Dollar' },
  { id: 'AED', name: 'AED — UAE Dirham' },
  { id: 'SAR', name: 'SAR — Saudi Riyal' },
  { id: 'EGP', name: 'EGP — Egyptian Pound' },
  { id: 'QAR', name: 'QAR — Qatari Riyal' },
  { id: 'KWD', name: 'KWD — Kuwaiti Dinar' },
  { id: 'BHD', name: 'BHD — Bahraini Dinar' },
  { id: 'OMR', name: 'OMR — Omani Rial' },
  { id: 'EUR', name: 'EUR — Euro' },
  { id: 'GBP', name: 'GBP — Pound Sterling' }
];
/* Rates and pay are switched off for now (professional rate, job pay). Set to true to bring every rate field, display and match note back — saved data is untouched. */
APP.SHOW_RATES = false;
APP.ratePeriods = [['day', 'per day'], ['month', 'per month'], ['year', 'per year']];

/* ---- Professional rate (v20): amount + currency + period. The amount stays in c.dailyRate (kept for saved data); c.ratePeriod is new (default day). ---- */
APP.CUR_BY_COUNTRY = { ae: 'AED', sa: 'SAR', eg: 'EGP', gb: 'GBP', de: 'EUR', fr: 'EUR', qa: 'QAR', kw: 'KWD', bh: 'BHD', om: 'OMR' }; /* country id → currency */
APP.defaultCurrency = function (country) { return APP.CUR_BY_COUNTRY[country] || 'USD'; };
APP.PERIOD_DAYS = { day: 1, month: 22, year: 264 }; /* working days, used only to compare rates across periods */
APP.periodSuffix = function (p) { return { day: '/day', month: '/month', year: '/year' }[p || 'day'] || '/day'; };
APP.rateInputHtml = function (d, chosen) {
  const cur = chosen && d.currency ? d.currency : APP.defaultCurrency(d.country);
  return '<div class="pay-row rate-row">' +
    '<select name="currency" class="input" aria-label="Currency">' + APP.opt(APP.currencies.map(c => [c.id, c.id]), cur) + '</select>' +
    '<input name="dailyRate" type="number" min="0" class="input" value="' + APP.h(d.dailyRate || '') + '" placeholder="Amount" aria-label="Rate amount">' +
    '<select name="ratePeriod" class="input" aria-label="Rate period">' + APP.opt(APP.ratePeriods, d.ratePeriod || 'day') + '</select></div>';
};
/* Inline "required" error under the role-type list (no re-render, so nothing typed is lost). */
APP.flagRoleType = function () {
  const l = document.querySelector('.rt-list'); if (!l) return;
  l.classList.add('rt-error');
  if (!document.getElementById('rt-err')) { const p = document.createElement('p'); p.id = 'rt-err'; p.className = 'field-error'; p.textContent = 'Please choose your role type — it is how companies find you.'; l.insertAdjacentElement('afterend', p); }
  l.scrollIntoView({ block: 'center', behavior: 'smooth' });
};
APP.jobTypes = ['Full-time', 'Contract', 'Freelance'];
APP.industries = ['Agriculture & Food Production', 'Automotive', 'Banking & Financial Services', 'Construction & Real Estate', 'Consulting & Professional Services', 'Defense & Military', 'Education', 'Healthcare & Pharma', 'Information Technology (IT)', 'Logistics & Supply Chain', 'Manufacturing & Industrial', 'Oil, Gas & Energy', 'Public Sector / Government', 'Retail & Consumer Goods (FMCG)', 'Telecommunications', 'Tourism & Hospitality', 'Utilities (Power & Water)'];
APP.companySizes = ['1-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];
APP.durations = ['3 months', '6 months', '9 months', '12 months', '18 months', '24+ months', 'Permanent'];

/* ---------------------------- database ---------------------------- */

APP.DB_KEY = 'arnour-prototype-v10'; /* round 14: v10 seed adds LinkedIn profile links — one-time reset for anyone on v9 */
APP.db = null;

APP.clone = (x) => JSON.parse(JSON.stringify(x));

APP.seedDb = function () {
  const db = APP.clone(SAMPLE);
  db.v = 10;
  db.session = null;
  db.consultants = Object.fromEntries(Object.values(db.consultants).map(c => [c.id, c]));
  db.companies = Object.fromEntries(Object.values(db.companies).map(c => [c.id, c]));
  db.jobs = Object.fromEntries(Object.values(db.jobs).map(j => [j.id, j]));
  db.jobs = Object.fromEntries(Object.values(SAMPLE.jobs).map(j => {
    const copy = Object.assign({}, j);
    copy.postedTs = now0() - (j.postedDaysAgo * 864e5);
    delete copy.postedDaysAgo;
    return [j.id, copy];
  }));
  db.conversations = Object.fromEntries(Object.values(SAMPLE.conversations).map(c => [c.id, c]));
  db.questions = Object.fromEntries(Object.values(SAMPLE.questions).map(x => [x.id, x]));
  db.articles = Object.fromEntries(Object.values(SAMPLE.articles).map(x => [x.id, x]));
  return db;
};

function now0() { return Date.now(); }

/* Add newer sample content (open / general questions, article comments) to data saved by an older version. Only adds what is missing. */
APP.topUpSampleQuestions = function (db) {
  if (!window.SAMPLE || !db.questions) return;
  let changed = false;
  /* Newer sample people, companies and jobs: add only the ids that are missing; nothing existing is touched. */
  const addMissing = (list, bucket, fix) => {
    db[bucket] = db[bucket] || {};
    for (const x of list || []) { if (!db[bucket][x.id]) { db[bucket][x.id] = fix ? fix(JSON.parse(JSON.stringify(x))) : JSON.parse(JSON.stringify(x)); changed = true; } }
  };
  addMissing(window.SAMPLE.consultants, 'consultants');
  addMissing(window.SAMPLE.companies, 'companies');
  addMissing(window.SAMPLE.jobs, 'jobs', j => { j.postedTs = Date.now() - (j.postedDaysAgo || 0) * 864e5; delete j.postedDaysAgo; return j; });
  for (const q of window.SAMPLE.questions) {
    if (/^qo\d/.test(q.id) && !db.questions[q.id] && (db.consultants[q.authorId] || (db.companies || {})[q.authorId])) {
      db.questions[q.id] = JSON.parse(JSON.stringify(q)); changed = true;
    }
  }
  const a1 = (db.articles || {}).a1, s1 = window.SAMPLE.articles.find(x => x.id === 'a1');
  if (a1 && s1 && s1.comments && !a1.comments) { a1.comments = JSON.parse(JSON.stringify(s1.comments)); changed = true; }
  if (changed) { try { localStorage.setItem(APP.DB_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } }
};

APP.load = function () {
  try {
    const raw = localStorage.getItem(APP.DB_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.v === 10 && db.consultants) { APP.db = db; APP.migrateSpecialties(APP.db); APP.topUpSampleQuestions(APP.db); return; }
    }
  } catch (e) { /* fall through to seed */ }
  APP.db = APP.seedDb();
  APP.migrateSpecialties(APP.db);
  APP.save();
};

APP.save = function () {
  try { localStorage.setItem(APP.DB_KEY, JSON.stringify(APP.db)); } catch (e) { /* storage full/unavailable */ }
};

APP.resetDb = function () {
  APP.db = APP.seedDb();
  APP.migrateSpecialties(APP.db);
  APP.save();
};

/* ---------------------------- session ---------------------------- */

APP.getSession = () => APP.db.session;
APP.userKey = function () {
  const s = APP.db.session;
  if (!s) return null;
  return s.role === 'consultant' ? s.consultantId : s.companyId;
};
APP.currentUser = function () {
  const s = APP.db.session;
  if (!s) return null;
  return s.role === 'consultant' ? APP.db.consultants[s.consultantId] : APP.db.companies[s.companyId];
};
APP.login = function (role, id) {
  APP.db.session = role === 'consultant' ? { role, consultantId: id } : { role, companyId: id };
  if (role === 'consultant' && APP.db.consultants && APP.db.consultants[id]) APP.db.consultants[id].lastActiveTs = Date.now();
  APP.save();
};
APP.logout = function () {
  APP.db.session = null;
  APP.save();
  location.hash = '#/';
  APP.render();
};

/* ---------------------------- lookups ---------------------------- */

APP.consultant = (id) => APP.db.consultants[id] || null;
APP.company = (id) => APP.db.companies[id] || null;
APP.job = (id) => APP.db.jobs[id] || null;
APP.conv = (id) => APP.db.conversations[id] || null;
/* company keys: 'co…' (own id) or 'cx:' / 'cj:' (confidential stand-ins) */
APP.isCoKey = (key) => !!key && (key.indexOf('co') === 0 || /^c[xj]:/.test(key));
APP.question = (id) => (APP.db.questions || {})[id] || null;
APP.article = (id) => (APP.db.articles || {})[id] || null;

/* Community author. Seeded keys are 'c-…' / 'co-…'; wizard-created keys are 'c'+ts / 'co'+ts (no hyphen). */
APP.communityAuthor = function (key) {
  if (!key) return null;
  if (APP.isCoKey(key)) return APP.company(key);
  if (key.indexOf('c') === 0) return APP.consultant(key);
  return null;
};

APP.communityAuthorName = function (key) {
  const au = APP.communityAuthor(key);
  if (!au) return 'Former member';
  return APP.isCoKey(key) ? au.name : APP.consultantFullName(au);
};

/* Context-aware link to an author's home page (what a viewer should see when clicking their name):
   company  -> their own #/e/company, otherwise #/company/:id (public)
   person   -> themselves #/c/profile, employer #/e/talent/:id (private detail), everyone else #/talent/:id (public)
   null when the author no longer resolves ("Former member"). */
APP.authorHref = function (key) {
  if (!key || !APP.communityAuthor(key)) return null;
  const me = APP.userKey();
  if (APP.isCoKey(key)) return key === me ? '#/e/company' : '#/company/' + key;
  if (key === me) return '#/c/profile';
  if (APP.db.session && APP.db.session.role === 'employer') return '#/e/talent/' + key;
  return '#/talent/' + key;
};

/* { questions, answers, articles, acceptedAnswers } for a user key */
/* General (non-product) topics for community questions and articles */
APP.commTopics = [
  ['new-to-sap', 'Choosing or starting with SAP'],
  ['hiring', 'Hiring SAP talent'],
  ['partners', 'Finding an implementation partner'],
  ['career', 'Careers, certification & freelancing'],
  ['licensing', 'Licensing, pricing & contracts'],
  ['industry', 'Industry news & trends'],
  ['other', 'Something else']
];
APP.topicName = (id) => { const t = APP.commTopics.find(x => x[0] === id); return t ? t[1] : ''; };
APP.topicOptions = (sel, blankLabel) => '<option value="">' + (blankLabel || 'Choose a topic…') + '</option>' + APP.opt(APP.commTopics, sel);

/* In-platform notifications for community activity (no email). */
APP.repLevelNotify = function (key, before) {
  if (!key || APP.isCoKey(key)) return;
  const r = APP.reputation(key);
  if (r.level > before) APP.addNotif(key, 'comm', 'You reached the ' + r.levelName + ' level in the community 🎉', '#/community');
};
APP.notifyNewQuestion = function (q) {
  const tag = q.productId ? APP.productShort(q.productId) + (q.moduleId ? ' · ' + APP.skillName(q.productId, q.moduleId) : '') : APP.topicName(q.topic);
  let pool = Object.values(APP.db.consultants).filter(c => c.id !== q.authorId);
  if (q.productId) {
    const mm = (c) => (c.skills || []).some(s => s.productId === q.productId && q.moduleId && s.moduleId === q.moduleId) ? 1 : 0;
    pool = pool.filter(c => (c.skills || []).some(s => s.productId === q.productId)).sort((a, b) => mm(b) - mm(a));
  } else {
    pool = pool.filter(c => APP.reputation(c.id).level >= 2); /* general questions go to trusted members */
  }
  if (APP.LIVE) pool = pool.filter(c => !c.sample).slice(0, 10);
  pool.slice(0, 25).forEach(c => APP.addNotif(c.id, 'comm', 'New question in ' + tag + ': "' + q.title + '"', '#/community/q/' + q.id));
};

/* ---- Reputation (v17) ----
   Points are computed from activity, never stored, so they stay correct when posts change.
   Only other people's upvotes count; answers on your own question and self-accepted answers earn nothing.
   question +1 · answer +2 · accepted answer +15 · article +5 · upvote received: answer +2, article +1, question +1 */
APP.REP_LEVELS = [
  { min: 0, name: 'New member' }, { min: 10, name: 'Contributor' }, { min: 40, name: 'Trusted' },
  { min: 100, name: 'Expert' }, { min: 250, name: 'Top expert' }
];
APP.reputation = function (key) {
  const r = { points: 0, accepted: 0, answers: 0, level: 0, levelName: 'New member', next: 10, toNext: 10, topProduct: null, topProductCount: 0 };
  if (!key || APP.isCoKey(key) || !APP.db) return r;
  const others = (item) => (item.upvotedBy || []).filter(u => u !== key).length;
  const perProduct = {};
  for (const q of Object.values(APP.db.questions || {})) {
    if (q.authorId === key && !q.anonymous) r.points += 1 + others(q);
    for (const a of q.answers || []) {
      if (a.authorId !== key || q.authorId === key) continue;
      r.answers++;
      r.points += 2 + 2 * others(a);
      if (a.accepted) { r.points += 15; r.accepted++; perProduct[q.productId] = (perProduct[q.productId] || 0) + 1; }
    }
  }
  for (const a of Object.values(APP.db.articles || {})) {
    if (a.authorId === key) r.points += 5 + others(a);
  }
  let li = 0;
  APP.REP_LEVELS.forEach((l, i) => { if (r.points >= l.min) li = i; });
  r.level = li; r.levelName = APP.REP_LEVELS[li].name;
  const nx = APP.REP_LEVELS[li + 1];
  r.next = nx ? nx.min : null; r.toNext = nx ? nx.min - r.points : 0; r.nextName = nx ? nx.name : '';
  for (const pid of Object.keys(perProduct)) if (perProduct[pid] > r.topProductCount) { r.topProduct = pid; r.topProductCount = perProduct[pid]; }
  return r;
};
/* Small level + product badge next to a name. Nothing is shown for brand-new members, to keep lists calm. */
APP.repBadgeHtml = function (key) {
  const r = APP.reputation(key);
  if (!r.level) return '';
  const tip = r.points + ' reputation points · ' + r.accepted + ' accepted answer' + (r.accepted === 1 ? '' : 's');
  return '<span class="rep rep-' + r.level + '" title="' + APP.h(tip) + '">' + APP.icon('spark', 11) + ' ' + APP.h(r.levelName) + '</span>' +
    (r.topProductCount >= 2 ? '<span class="rep rep-prod" title="' + r.topProductCount + ' accepted answers">' + APP.h(APP.productShort(r.topProduct)) + ' specialist</span>' : '');
};

APP.communityStats = function (key) {
  const st = { questions: 0, answers: 0, articles: 0, acceptedAnswers: 0 };
  if (!key || !APP.db) return st;
  for (const q of Object.values(APP.db.questions || {})) {
    if (q.authorId === key && !q.anonymous) st.questions++;
    for (const a of q.answers || []) {
      if (a.authorId === key) { st.answers++; if (a.accepted) st.acceptedAnswers++; }
    }
  }
  for (const a of Object.values(APP.db.articles || {})) {
    if (a.authorId === key) st.articles++;
  }
  return st;
};

/* Whole-network tallies for social-proof moments (dashboard cards, welcome modal) */
APP.communityNetworkStats = function () {
  const st = { questions: 0, answers: 0, articles: 0 };
  if (!APP.db) return st;
  for (const q of Object.values(APP.db.questions || {})) {
    st.questions++;
    st.answers += (q.answers || []).length;
  }
  st.articles = Object.keys(APP.db.articles || {}).length;
  return st;
};

/* Recent questions, newest first; items tagged with a product in matchProducts rank first.
   Lets a new user's dashboard card surface discussions from the corner of SAP they actually work in. */
APP.recentCommunityItems = function (matchProducts, n) {
  const items = Object.values(APP.db.questions || {});
  const score = q => (matchProducts && matchProducts.indexOf(q.productId) !== -1 ? 1 : 0);
  items.sort((a, b) => (score(b) - score(a)) || ((b.createdTs || 0) - (a.createdTs || 0)));
  return items.slice(0, n || 2);
};


/* ---- Community visibility (v18) ----
   Unanswered questions that fit the user, a non-blocking "Get started" checklist, a one-time nav pointer. */
APP.userProductIds = function () {
  const s = APP.db && APP.db.session; if (!s) return [];
  if (s.role === 'consultant') { const c = APP.consultant(s.consultantId); return c ? (c.skills || []).map(k => k.productId) : []; }
  const co = APP.company(s.companyId); return co ? (co.sapSystems || []) : [];
};
/* Unanswered questions in the user's products (module matches first, then oldest); never their own. */
APP.openQuestionsForUser = function () {
  const s = APP.db && APP.db.session; if (!s) return [];
  const k = APP.userKey(), prods = APP.userProductIds();
  const c = s.role === 'consultant' ? APP.consultant(s.consultantId) : null;
  const mod = q => c && (c.skills || []).some(x => x.productId === q.productId && x.moduleId === q.moduleId) ? 1 : 0;
  return Object.values(APP.db.questions || {})
    .filter(q => !(q.answers || []).length && q.authorId !== k && q.productId && prods.indexOf(q.productId) !== -1)
    .sort((a, b) => (mod(b) - mod(a)) || ((a.createdTs || 0) - (b.createdTs || 0)));
};
APP.communityTag = function (q) {
  return q.productId ? APP.productShort(q.productId) + (q.moduleId ? ' · ' + APP.skillName(q.productId, q.moduleId) : '') : APP.topicName(q.topic);
};
APP.communityQItem = function (q, open) {
  const ans = (q.answers || []).length;
  return '<a class="app-item" href="#/community/q/' + q.id + '"><div class="grow"><strong>' + APP.h(q.title) + '</strong>' +
    '<small class="muted">' + APP.h(APP.communityTag(q)) + ' · ' + (open ? '<span class="needs-tag">Needs an answer</span>' : ans + ' answer' + (ans === 1 ? '' : 's')) + ' · ' + APP.timeAgo(q.createdTs) + '</small></div>' +
    '<span class="btn btn-outline btn-sm">' + (open ? 'Answer' : 'Open') + '</span></a>';
};
/* Home-page Community block. Professionals: questions for you (1–2 need an answer); employers: what people discuss in their systems. */
APP.communityBlockHtml = function (role) {
  const k = APP.userKey(), prods = APP.userProductIds();
  const isC = role === 'consultant';
  const open = APP.openQuestionsForUser();
  const all = Object.values(APP.db.questions || {}).filter(q => q.authorId !== k);
  const inProd = all.filter(q => prods.indexOf(q.productId) !== -1 && (q.answers || []).length).sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
  let rows = [];
  if (isC) {
    open.slice(0, 2).forEach(q => rows.push(APP.communityQItem(q, true)));
    inProd.concat(APP.recentCommunityItems(null, 6).filter(q => q.authorId !== k)).filter((q, i, a) => a.indexOf(q) === i && !rows.some(r => r.indexOf('/q/' + q.id + '"') !== -1)).slice(0, 3 - rows.length).forEach(q => rows.push(APP.communityQItem(q, false)));
  } else {
    const pool = all.filter(q => prods.indexOf(q.productId) !== -1).sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
    (pool.length ? pool : APP.recentCommunityItems(null, 3)).slice(0, 3).forEach(q => rows.push(APP.communityQItem(q, false)));
  }
  if (!rows.length) return '';
  return '<div class="card comm-block">' +
    '<div class="card-h">' + APP.icon('users', 16) + ' ' + (isC ? 'Questions for you' : 'What SAP people are discussing') + ' <a class="link" href="#/community">Community →</a></div>' +
    (isC && open.length ? '<p class="muted small comm-block-note">An accepted answer earns <strong>15 points</strong> and builds your standing.</p>' : '') +
    rows.join('') +
    '<div class="btn-row mt16">' +
    (isC && open.length ? '<button class="btn btn-primary btn-sm" data-action="comm-open-tab">See all that need an answer (' + open.length + ')</button>' : '<a class="btn btn-primary btn-sm" href="#/community">Browse the community</a>') +
    '<a class="btn btn-outline btn-sm" href="#/community/ask">' + APP.icon('plus', 14) + ' Ask a question</a></div></div>';
};
/* "Get started" checklist: computed from real activity, so it ticks itself. Hidden once done or dismissed. */
APP.getStartedHtml = function (role) {
  const s = APP.db.session, u = APP.currentUser(); if (!u || u.getStartedDismissed) return '';
  const k = APP.userKey(), qs = Object.values(APP.db.questions || {});
  const asked = qs.some(q => q.authorId === k);
  const answered = qs.some(q => (q.answers || []).some(a => a.authorId === k));
  let tasks;
  if (role === 'consultant') {
    const c = u;
    const full = [!!c.firstName, !!c.headline, !!c.cv, (c.skills || []).length >= 3, !!c.summary, (c.languages || []).length > 0].concat(APP.SHOW_RATES ? [!!c.dailyRate] : []).every(Boolean);
    const touched = (c.savedJobIds || []).length > 0 || Object.values(APP.db.jobs || {}).some(j => (j.applicants || []).indexOf(k) !== -1);
    tasks = [
      { t: 'Complete your profile', d: 'Companies find you here', done: full, href: '#/c/profile' },
      { t: 'Apply to or save a role', d: 'Start with your best matches', done: touched, href: '#/c/jobs' },
      { t: 'Answer one question', d: 'An accepted answer earns 15 points', done: answered, href: '#/community', act: 'comm-open-tab' },
      { t: 'Ask one question', d: 'SAP people reply in your own language', done: asked, href: '#/community/ask' }
    ];
  } else {
    const co = u;
    const jobs = Object.values(APP.db.jobs || {}).filter(j => j.companyId === co.id).length;
    const chats = Object.values(APP.db.conversations || {}).some(cv => cv.eId === k);
    tasks = [
      { t: 'Add your SAP systems', d: 'So talent and discussions fit you', done: (co.sapSystems || []).length > 0, href: '#/e/company' },
      { t: 'Post your first role', d: 'We rank matching professionals for you', done: jobs > 0, href: '#/e/jobs/new' },
      { t: 'Message a professional', d: 'Search the talent pool', done: chats, href: '#/e/talent' },
      { t: 'Ask or answer in the community', d: 'See what SAP people are discussing', done: asked || answered, href: '#/community' }
    ];
  }
  const n = tasks.filter(x => x.done).length;
  if (n === tasks.length) return '';
  const pct = Math.round(n / tasks.length * 100);
  return '<div class="card gs-card">' +
    '<button type="button" class="modal-x" data-action="gs-dismiss" title="Hide">' + APP.icon('x', 16) + '</button>' +
    '<div class="gs-head"><strong>Get started</strong><span class="muted small">' + n + ' of ' + tasks.length + ' done</span></div>' +
    '<div class="strength-bar"><span style="width:' + pct + '%"></span></div>' +
    '<div class="gs-tasks">' + tasks.map(x =>
      (x.done ? '<div class="gs-task done">' : '<a class="gs-task" href="' + x.href + '"' + (x.act ? ' data-action="' + x.act + '"' : '') + '>') +
      '<span class="gs-tick">' + (x.done ? APP.icon('check', 13) : '') + '</span>' +
      '<span><strong>' + x.t + '</strong><small class="muted">' + x.d + '</small></span>' +
      (x.done ? '</div>' : '</a>')).join('') +
    '</div></div>';
};
/* Early community notification at sign-up: the biggest cluster of open questions in the user's own corner of SAP. */
APP.signupCommunityNotif = function (key) {
  const open = APP.openQuestionsForUser();
  if (!open.length) { APP.addNotif(key, 'comm', 'Welcome to the community — ask your first SAP question', '#/community'); return; }
  const g = {};
  open.forEach(q => { const t = q.productId ? APP.skillName(q.productId, q.moduleId) || APP.productShort(q.productId) : ''; g[t] = (g[t] || 0) + 1; });
  const best = Object.keys(g).sort((a, b) => g[b] - g[a])[0];
  APP.addNotif(key, 'comm', g[best] + ' question' + (g[best] === 1 ? '' : 's') + ' in ' + best + ' need' + (g[best] === 1 ? 's' : '') + ' an answer', '#/community/open');
};

APP.isUpvoted = function (item) {
  const k = APP.userKey();
  return !!(k && item && (item.upvotedBy || []).includes(k));
};

/* Toggle the current user's upvote on a question / article / answer. */
APP.toggleUpvote = function (kind, id, answerId) {
  let item = null;
  if (kind === 'q') item = APP.question(id);
  else if (kind === 'a') item = APP.article(id);
  else if (kind === 'answer') {
    const q = APP.question(id);
    item = q && (q.answers || []).find(x => x.id === answerId);
  }
  if (!item) return false;
  const k = APP.userKey();
  if (!k) { APP.toast('Sign in to upvote'); return false; }
  const arr = item.upvotedBy = item.upvotedBy || [];
  const i = arr.indexOf(k);
  const lvlBefore = item.authorId ? APP.reputation(item.authorId).level : 0;
  if (i >= 0) { arr.splice(i, 1); item.upvotes = Math.max(0, (item.upvotes || 0) - 1); }
  else {
    arr.push(k); item.upvotes = (item.upvotes || 0) + 1;
    /* tell the author when their post hits 5 / 10 / 25 upvotes (once per milestone) */
    if ([5, 10, 25].indexOf(item.upvotes) !== -1 && (item.milestone || 0) < item.upvotes && item.authorId && item.authorId !== k) {
      item.milestone = item.upvotes;
      const qq = kind === 'q' ? item : kind === 'answer' ? APP.question(id) : null;
      const link = kind === 'a' ? '#/community/a/' + id : '#/community/q/' + (qq ? qq.id : id);
      const what = kind === 'a' ? 'article' : kind === 'q' ? 'question' : 'answer';
      APP.addNotif(item.authorId, 'comm', 'Your ' + what + ' "' + ((qq || item).title || (qq && qq.title) || 'in the community').slice(0, 70) + '" reached ' + item.upvotes + ' upvotes', link);
    }
  }
  if (item.authorId && item.authorId !== k) APP.repLevelNotify(item.authorId, lvlBefore);
  APP.save();
  APP.render();
  return true;
};

APP.product = (pid) => CAT_INDEX.byId[pid] || { id: pid, name: pid, modules: [] };
APP.skillName = (pid, mid) => {
  if (mid === '*') return 'Any module';
  const m = CAT_INDEX.mods[pid + ':' + mid];
  return m ? m.name : mid;
};
APP.productShort = (id) => { const p = APP.product(id); return (p && (p.short || p.name)) || ''; };
APP.skillLabel = (k) => k.moduleId === '*' ? APP.productShort(k.productId) : APP.productShort(k.productId) + ' · ' + APP.skillName(k.productId, k.moduleId);

APP.companyJobs = (cid) => Object.values(APP.db.jobs).filter(j => j.companyId === cid);
APP.consultantConvs = (cid) => Object.values(APP.db.conversations).filter(c => c.cId === cid || c.c2Id === cid);
APP.companyConvs = (cid) => Object.values(APP.db.conversations).filter(c => c.eId === cid);
APP.convBetween = (cId, eId) => Object.values(APP.db.conversations).find(c => !c.c2Id && c.cId === cId && c.eId === eId) || null;
APP.peerConvBetween = (a, b) => Object.values(APP.db.conversations).find(c => c.c2Id && ((c.cId === a && c.c2Id === b) || (c.cId === b && c.c2Id === a))) || null;
/* my side in a conversation: 'c' (professional, or the first professional) or 'e' (company, or the second professional) */
APP.convSide = function (cv) {
  const s = APP.db.session; if (!s || !cv) return null;
  if (s.role === 'employer') return 'e';
  return (cv.c2Id && cv.c2Id === s.consultantId) ? 'e' : 'c';
};
/* the other person in a peer conversation */
APP.convPeerId = (cv) => cv && cv.c2Id ? (APP.convSide(cv) === 'c' ? cv.c2Id : cv.cId) : null;
/* a private professional who shared their identity with me in a peer chat */
APP.peerRevealed = function (cid) {
  const s = APP.db.session; if (!s || s.role !== 'consultant') return false;
  return Object.values(APP.db.conversations || {}).some(v => v.c2Id && ((v.cId === cid && v.c2Id === s.consultantId && v.revC) || (v.c2Id === cid && v.cId === s.consultantId && v.revE)));
};

/* ============================ Anonymous mode ============================
   A professional can keep their identity private ("anon"); a company can keep its name confidential (company.anon, or per role: job.confidential).
   Identity is shown only after an introduction is accepted (acceptance reveals both sides) or a conversation exists.
   NB: this prototype keeps all data in the browser, so the hiding is visual — real enforcement belongs on the server. */
APP.intros = function () { APP.db.intros = APP.db.intros || {}; return APP.db.intros; };
APP.anonId = function (id) { let h = 0; String(id || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) % 9000; }); return 1000 + h; };
APP.samplePill = (x) => (APP.LIVE && x && x.sample) ? '<span class="sample-pill" title="Example content for illustration — nobody will reply">Sample</span>' : '';
APP.anonLabel = (c) => String((c && (c._anon ? c._title : c.headline)) || '').trim() || 'SAP professional';
APP.revealed = function (cid, eid) {
  if (!cid || !eid) return false;
  if (Object.values(APP.db.conversations || {}).some(v => !v.c2Id && v.cId === cid && v.eId === eid && v.revC)) return true;
  return Object.values(APP.intros()).some(i => i.cid === cid && i.eid === eid && i.status === 'accepted');
};
APP.canSeePerson = function (c) {
  if (!c || !c.anon) return true;
  const s = APP.db && APP.db.session;
  if (!s) return false;
  if (s.role === 'consultant') return s.consultantId === c.id || APP.peerRevealed(c.id);
  if (s.role === 'employer') return APP.revealed(c.id, s.companyId);
  return false;
};
APP.consultantFullName = (c) => (c._anon || !APP.canSeePerson(c)) ? APP.anonLabel(c) : c.firstName + ' ' + c.lastName;
/* what the current viewer is allowed to see of a professional: the profile itself, or an identity-free copy */
APP.cv = function (c, force) {
  if (!c || c._anon || (!force && APP.canSeePerson(c))) return c;
  /* the headline stands in for the name; the subtitle is only what the person chose: level and role type */
  const role = APP.roleTypeLabel(APP.rtList(c)[0]) || 'SAP professional';
  return Object.assign({}, c, { _anon: true, _title: c.headline, firstName: String(c.headline || '').trim() || 'SAP professional', lastName: '', headline: [c.level, role].filter(Boolean).join(' · '), city: '', nationality: '', summary: '', linkedin: '', cv: null });
};
/* confidentiality lives on the role only: a confidential role hides its company until an introduction about that role is accepted */
APP.coHidden = (co, job) => !!co && !!job && job.confidential === true;
APP.revealedJob = function (cid, eid, jobId) {
  if (!cid || !eid || !jobId) return false;
  if (Object.values(APP.db.conversations || {}).some(v => !v.c2Id && v.cId === cid && v.eId === eid && v.jobId === jobId && v.revE)) return true;
  return Object.values(APP.intros()).some(i => i.cid === cid && i.eid === eid && i.jobId === jobId && i.status === 'accepted');
};
APP.canSeeCompany = function (co, job) {
  if (!co || !APP.coHidden(co, job)) return true;
  if (APP.asPublic) return false; /* a company previewing its own role or page sees what professionals see */
  const s = APP.db && APP.db.session;
  if (!s) return false;
  if (s.role === 'employer') return s.companyId === co.id;
  if (s.role === 'consultant') return APP.revealedJob(s.consultantId, co.id, job && job.id);
  return false;
};
APP.coFor = function (co, job) {
  if (!co || co._anon || APP.canSeeCompany(co, job)) return co;
  return Object.assign({}, co, { _anon: true, name: 'Confidential company', website: '', about: '', description: '', city: '', contactName: '', email: '', phone: '', linkedin: '' });
};
/* viewer-independent labels for notifications (they are written by one side and read by the other) */
APP.personLabel = (c, eid) => (!c.anon || APP.revealed(c.id, eid)) ? c.firstName + ' ' + c.lastName : APP.anonLabel(c);
APP.coLabel = (co, job, cid) => (!APP.coHidden(co, job) || APP.revealedJob(cid, co.id, job && job.id)) ? co.name : 'A confidential company';
APP.introFor = function (cid, eid, jobId) {
  return Object.values(APP.intros()).filter(i => i.cid === cid && i.eid === eid && (!jobId || i.jobId === jobId)).sort((a, b) => b.ts - a.ts)[0] || null;
};
APP.createIntro = function (o) {
  const id = 'in' + Date.now() + Math.floor(Math.random() * 1e3);
  const job = o.jobId ? APP.job(o.jobId) : null;
  const i = { id: id, from: o.from, cid: o.cid, eid: o.eid, jobId: o.jobId || '', note: String(o.note || '').replace(/\s+\n/g, '\n').trim().slice(0, 300), status: 'pending', ts: Date.now() };
  APP.intros()[id] = i;
  const c = APP.consultant(o.cid), co = APP.company(o.eid);
  if (o.from === 'e') APP.addNotif(o.cid, 'job', APP.coLabel(co, job, o.cid) + ' would like to connect' + (job ? ' about "' + job.title + '"' : ''), '#/c/intros');
  else APP.addNotif(o.eid, 'app', APP.personLabel(c, o.eid) + ' is interested' + (job ? ' in "' + job.title + '"' : ''), '#/e/intros');
  APP.save();
  return i;
};
/* the receiving side answers: accepting reveals both identities and opens a conversation */
APP.respondIntro = function (id, accept, opts) {
  opts = opts || {};
  const i = APP.intros()[id], s = APP.db.session;
  if (!i || !s || i.status !== 'pending') return;
  const mine = i.from === 'e' ? (s.role === 'consultant' && s.consultantId === i.cid) : (s.role === 'employer' && s.companyId === i.eid);
  if (!mine) return;
  const job = i.jobId ? APP.job(i.jobId) : null, c = APP.consultant(i.cid), co = APP.company(i.eid);
  i.status = accept ? 'accepted' : 'declined'; i.respTs = Date.now();
  const reqKey = i.from === 'e' ? i.eid : i.cid;
  if (accept) {
    const side = i.from;
    const text = i.note || (side === 'e' ? 'Hi ' + c.firstName + ', your profile looks relevant for a role we are hiring for.' : 'Hi, I am interested in ' + (job ? 'the ' + job.title + ' role' : 'opportunities with you') + '.');
    const cv = APP.createConversation(i.cid, i.eid, { side: side, text: text });
    if (i.jobId && !cv.jobId) cv.jobId = i.jobId;
    if (i.from === 'e' && opts.shareCv) APP.pushMessage(cv.id, 'c', 'Sharing my CV with you.', true);
    APP.addNotif(reqKey, i.from === 'e' ? 'msg' : 'job', (i.from === 'e' ? c.firstName + ' ' + c.lastName : co.name) + ' accepted your introduction — you can now chat', (i.from === 'e' ? '#/e/messages/' : '#/c/messages/') + cv.id);
    APP.toast('Introduction accepted — identities are now shared ✓');
  } else {
    APP.addNotif(reqKey, i.from === 'e' ? 'msg' : 'job', 'Your introduction request' + (job ? ' for "' + job.title + '"' : '') + ' was not accepted this time', i.from === 'e' ? '#/e/intros' : '#/c/intros');
    APP.toast('Request declined');
  }
  APP.save();
  APP.render();
};
/* company → anonymous professional: pick one of your open roles + a short note */
APP.confirmRequestIntro = function (cid) {
  const s = APP.db.session, c = APP.consultant(cid);
  if (!s || s.role !== 'employer' || !c) return;
  const jobs = APP.companyJobs(s.companyId).filter(j => j.status === 'open');
  if (!jobs.length) { APP.toast('Post a role first — requests are tied to one of your open roles'); APP.go('#/e/jobs/new'); return; }
  const nm = APP.consultantFullName(c);
  APP.openDialog({
    title: 'Request an introduction',
    sub: APP.h(nm) + ' keeps their identity private. If they accept, you both see each other’s details and can chat.',
    body: '<label class="field"><span class="label">Which role is this about?</span><select id="dlg-sel" class="input">' + jobs.map(j => '<option value="' + j.id + '">' + APP.h(j.title) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span class="label">Message <span class="muted">(optional)</span></span><textarea id="dlg-note" class="input" rows="3" maxlength="300" placeholder="Why you would like to talk…"></textarea><span class="muted small dlg-count" id="dlg-count">0 / 300</span></label>' +
      '<p class="muted small">If the role is confidential, your company name is shared only if they accept.</p>',
    confirmLabel: 'Send request',
    onConfirm: function (v) {
      if (!v.sel) return;
      APP.createIntro({ from: 'e', cid: cid, eid: s.companyId, jobId: v.sel, note: v.note });
      APP.toast('Introduction requested ✓');
      APP.render();
    }
  });
};
APP.confirmAcceptIntro = function (id) {
  const i = APP.intros()[id]; if (!i) return;
  const job = i.jobId ? APP.job(i.jobId) : null, c = APP.consultant(i.cid), co = APP.company(i.eid);
  const toPro = i.from === 'e';
  const who = toPro ? APP.coLabel(co, job, i.cid) : APP.personLabel(c, i.eid);
  APP.openDialog({
    title: toPro ? 'Share your profile with ' + APP.h(who) + '?' : 'Accept and reveal?',
    sub: toPro ? 'They will see your name, LinkedIn and full profile, and you will see who they are. A chat opens.'
      : APP.h(who) + ' will be able to see who you are, and you will see them. A chat opens.',
    body: (i.note ? '<div class="app-note"><span class="muted small">Their message</span><p>“' + APP.h(i.note) + '”</p></div>' : '') +
      (toPro ? '<label class="chk-line"><input type="checkbox" id="dlg-cv" checked> <span>Also share my CV</span></label>' : ''),
    confirmLabel: toPro ? 'Accept and share' : 'Accept and reveal',
    onConfirm: function (v) { APP.respondIntro(id, true, { shareCv: !!v.cv }); }
  });
};
APP.confirmDeclineIntro = function (id) {
  APP.openDialog({
    title: 'Decline this request?', sub: 'Nothing about you is revealed. They are told it was not accepted this time.', body: '',
    confirmLabel: 'Decline', danger: true, onConfirm: function () { APP.respondIntro(id, false); }
  });
};
APP.pendingIntrosFor = function () {
  const s = APP.db && APP.db.session; if (!s) return 0;
  return Object.values(APP.intros()).filter(i => i.status === 'pending' && (i.from === 'e' ? (s.role === 'consultant' && s.consultantId === i.cid) : (s.role === 'employer' && s.companyId === i.eid))).length;
};
/* open invitations to apply (company invited me, I have not applied yet, role still open) */
APP.openInvitesFor = function () {
  const s = APP.db && APP.db.session; if (!s || s.role !== 'consultant') return [];
  return Object.values(APP.db.jobs || {}).filter(j => j.status === 'open' && (j.invited || []).indexOf(s.consultantId) !== -1 && (j.applicants || []).indexOf(s.consultantId) === -1);
};
/* everything waiting for the current user's answer: introductions (both roles) + invitations (professional) */
APP.waitingForMe = function () { return APP.pendingIntrosFor() + APP.openInvitesFor().length; };
APP.introStatusPill = function (i) {
  return i.status === 'accepted' ? '<span class="pill inv">' + APP.icon('check', 12) + ' Accepted</span>'
    : i.status === 'declined' ? '<span class="pill muted-pill">Not accepted</span>' : '<span class="pill warn-pill">Awaiting reply</span>';
};
/* Privacy switch + live preview of what the other side sees */
APP.privacyCardHtml = function () {
  const s = APP.db.session, isC = s.role === 'consultant';
  if (!isC) return ''; /* companies are never anonymous as a whole: confidentiality is set on each role */
  const me = isC ? APP.consultant(s.consultantId) : APP.company(s.companyId);
  if (!me) return '';
  const on = !!me.anon;
  let preview = '';
  if (isC) {
    const v = APP.cv(me, true);
    preview = '<div class="anon-preview"><span class="muted small">' + (on ? 'Companies see you as' : 'If you turn this on, companies see you as') + '</span><div class="ap-row">' + APP.avatarHtml(APP.consultantFullName(v), 'lg', true) +
      '<div><b>' + APP.h(APP.consultantFullName(v)) + '</b><div class="muted small">' + APP.h(v.headline) + ' · ' + APP.h(APP.countryName(v.country) || '') + '</div></div></div>' +
      '<p class="muted small">Your profile title is shown as your name, so keep it free of employer names. Hidden until you accept: name, photo, LinkedIn, summary, city, nationality and CV.</p>' +
      '<a class="btn btn-outline btn-sm" href="#/c/preview">' + APP.icon('ext', 14) + ' Preview my full anonymous profile</a></div>';
  } else if (on) {
    preview = '<div class="anon-preview"><span class="muted small">Professionals see</span><div class="ap-row">' + APP.avatarHtml('Confidential company', 'lg') +
      '<div><b>Confidential company</b><div class="muted small">' + APP.h(me.industry || '') + ' · ' + APP.h(APP.countryName(me.country) || '') + '</div></div></div>' +
      '<p class="muted small">Hidden until you accept an introduction: your company name, logo, website and contact. You can also override this for each role when you post it.</p></div>';
  }
  return '<div class="card privacy-card"><div class="pc-row"><div class="grow"><div class="card-h" style="margin:0">' + APP.icon('lock', 16) + ' ' + (isC ? 'Mutual Reveal: keep my identity private' : 'Keep my company confidential') + '</div>' +
    '<p class="muted small" style="margin:4px 0 0">' + (isC ? 'Companies see your skills and experience, but not who you are. They can ask to connect; your name, photo and CV are shared only if you accept, and a reveal cannot be undone.' : 'Professionals see your roles, but not which company is hiring, until you accept their interest. A reveal cannot be undone.') + '</p></div>' +
    '<button type="button" class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" aria-label="' + (isC ? 'Keep my identity private' : 'Keep my company confidential') + '" data-action="toggle-anon"><span></span></button></div>' + preview + '</div>';
};

/* Introductions page for both roles */
APP.introsPageHtml = function (embed) {
  const s = APP.db.session, isC = s.role === 'consultant';
  const mineId = isC ? s.consultantId : s.companyId;
  const all = Object.values(APP.intros()).filter(i => (isC ? i.cid : i.eid) === mineId).sort((a, b) => b.ts - a.ts);
  const incoming = (i) => isC ? i.from === 'e' : i.from === 'c';
  const row = (i) => {
    const job = i.jobId ? APP.job(i.jobId) : null, c = APP.consultant(i.cid), co = APP.company(i.eid);
    const other = isC ? APP.coLabel(co, job, i.cid) : APP.personLabel(c, i.eid);
    const shown = (isC ? (APP.revealed(i.cid, i.eid) ? co : APP.coFor(co, job)) : APP.cv(c));
    const head = (isC ? (shown && shown.headline) : '') || (isC ? ((co && co.industry) || '') : (shown && shown.headline) || '');
    const acts = (i.status === 'pending' && incoming(i))
      ? '<div class="btn-row"><button class="btn btn-primary btn-sm" data-action="intro-accept" data-id="' + i.id + '">Accept</button><button class="btn btn-outline btn-sm" data-action="intro-decline" data-id="' + i.id + '">Decline</button></div>'
      : (i.status === 'accepted' ? '<div class="btn-row"><button class="btn btn-outline btn-sm" data-action="start-chat" data-cid="' + i.cid + '" data-eid="' + i.eid + '">Open chat</button></div>' : '');
    return '<article class="card intro-card"><div class="card-top">' + APP.avatarHtml(other, 'lg', !isC && shown && shown._anon) +
      '<div class="card-id"><p class="card-sub">' + (incoming(i) ? 'Wants to connect' : 'You asked to connect') + ' · ' + APP.timeAgo(i.ts) + '</p><h3 class="card-title">' + APP.h(other) + '</h3>' +
      '<p class="muted small">' + APP.h(head) + (job ? (head ? ' · ' : '') + 'about “' + APP.h(job.title) + '”' : '') + '</p></div>' +
      '<div class="card-side">' + ((i.status === 'pending' && incoming(i)) ? '<span class="pill warn-pill">Needs your answer</span>' : APP.introStatusPill(i)) + '</div></div>' +
      (i.note ? '<div class="app-note"><p>“' + APP.h(i.note) + '”</p></div>' : '') + acts + '</article>';
  };
  const pend = all.filter(i => i.status === 'pending' && incoming(i)), sent = all.filter(i => i.status === 'pending' && !incoming(i)), done = all.filter(i => i.status !== 'pending');
  const sec = (t, l) => l.length ? '<div class="feed-head mt16"><h3>' + t + ' (' + l.length + ')</h3></div>' + l.map(row).join('') : '';
  return (embed ? '<div>' : '<div class="narrow"><h2 class="page-title">Introductions</h2>') +
    '<p class="muted">' + (isC ? 'Companies that would like to connect, and roles where you expressed interest. Your identity stays private until you accept.' : 'Professionals you asked to connect with, and anonymous interest in your roles. Identities are revealed when an introduction is accepted.') + '</p>' +
    (all.length ? sec('Waiting for your answer', pend) + sec('Waiting for their answer', sent) + sec('Answered', done)
      : '<div class="card empty">No introductions yet.' + (isC ? ' When a company asks to connect, it appears here.' : ' Use “Request introduction” on an anonymous profile to start one.') + '</div>') +
    '</div>';
};

/* ---------------------------- formatting ---------------------------- */

APP.h = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
};

/* Normalizes a user-typed profile URL: trims, adds https:// when missing. */
/* External apply link on a role: only plain http(s) links are ever used. Returns the clean URL or ''. */
APP.safeApplyUrl = function (job) {
  const raw = job && job.applyUrl ? APP.normUrl(job.applyUrl) : '';
  if (!raw || raw.length > 500) return '';
  try { const u = new URL(raw); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.indexOf('.') > 0 ? u.href : ''; } catch (e) { return ''; }
};
/* What we show next to the button: the site's domain — but never for a confidential role, where the domain would name the company. */
APP.applyDomain = function (job) {
  const u = APP.safeApplyUrl(job); if (!u) return '';
  const hidden = job.confidential || APP.coHidden(APP.company(job.companyId), job);
  return hidden ? 'the company career portal' : new URL(u).hostname.replace(/^www\./, '');
};
APP.openExternalApply = function (jobId) {
  const job = APP.job(jobId); const u = job && APP.safeApplyUrl(job);
  if (!u) return;
  window.open(u, '_blank', 'noopener,noreferrer');
  APP.state.extOpened = APP.state.extOpened || {}; APP.state.extOpened[jobId] = true;
  APP.render();
};
APP.normUrl = function (v) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  return v;
};

APP.fmtRate = (amount, cur) => (cur || '') + ' ' + Number(amount || 0).toLocaleString() + '/day';

/* Pay is optional. Legacy jobs have no ratePeriod and were always day rates. */
APP.fmtRange = function (job) {
  const cur = job.currency || 'USD';
  const per = { day: '/day', month: '/month', year: '/year' }[job.ratePeriod || 'day'] || '/day';
  const lo = Number(job.rateMin) || 0, hi = Number(job.rateMax) || 0;
  const f = (n) => n.toLocaleString();
  if (!lo && !hi) return 'Pay not disclosed';
  if (lo && hi) return cur + ' ' + f(lo) + ' – ' + f(hi) + per;
  return lo ? 'From ' + cur + ' ' + f(lo) + per : 'Up to ' + cur + ' ' + f(hi) + per;
};

/* Experience label: "6–8 yrs", "6+ yrs", "Up to 8 yrs" (or '' when neither is set). */
APP.expLabel = function (job) {
  const lo = Number(job.minExp) || 0;
  return lo ? lo + '+ yrs' : '';
};

/* Industries: jobs may list several. Older jobs only carry a single `industry`. */
APP.jobIndustries = function (job) {
  if (job && Array.isArray(job.industries) && job.industries.length) return job.industries;
  return job && job.industry ? [job.industry] : [];
};
APP.jobIndustryLabel = function (job, max) {
  const l = APP.jobIndustries(job);
  const n = max || 2;
  return l.length > n ? l.slice(0, n).join(', ') + ' +' + (l.length - n) : l.join(', ');
};

/* Requirement rows → groups. A row flagged `orPrev` is an alternative to the row above it
   (either one satisfies the requirement); different groups must all be satisfied. */
APP.reqGroups = function (job) {
  const groups = [];
  for (const r of (job && job.requires) || []) {
    if (!r || !r.productId || !r.moduleId) continue;
    if (r.orPrev && groups.length) groups[groups.length - 1].push(r);
    else groups.push([r]);
  }
  return groups;
};
/* "FI in S/4HANA  or  FI in ECC" chips for cards and detail pages. style 'em' → "<em>3+ projects</em>", 'paren' → " (3+ projects)". */
APP.reqChipsHtml = function (job, style) {
  const one = (r) => APP.h(APP.productShort(r.productId)) + ': ' + APP.h(APP.skillName(r.productId, r.moduleId)) +
    (r.minProjects ? (style === 'em' ? ' <em>' + r.minProjects + '+ projects</em>' : style === 'paren' ? ' (' + r.minProjects + '+ projects)' : '') : '');
  return APP.reqGroups(job).map(g =>
    '<span class="chip req' + (g.length > 1 ? ' req-or' : '') + '">' + g.map(one).join(' <b class="or-sep">or</b> ') + '</span>'
  ).join('');
};
/* ---- Skill matching (v16) ----
   Credit per requirement row: 45 exact (module + project count), 25 right module but fewer projects than asked,
   up to 36 for a transferable skill (same module in ECC / S/4HANA Private / S/4HANA Public), 5 for the same product but a
   different module, 0 otherwise. */
APP.CORE_PRODUCTS = { s4onprem: 1, ecc: 1, s4public: 1 };
APP.equivWeight = function (a, b) {
  if (a === b) return 1;
  return { 's4onprem|s4public': 0.9, 'ecc|s4onprem': 0.8, 'ecc|s4public': 0.8 }[[a, b].sort().join('|')] || 0;
};
/* The Public Cloud "FICO" module covers what FI and CO do in the other two cores. */
APP.equivModules = function (m) {
  if (m === 'fico') return ['fico', 'fi', 'co'];
  if (m === 'fi' || m === 'co') return [m, 'fico'];
  return [m];
};
APP.reqMatch = function (c, r) {
  const sk = c.skills || [];
  const tracked = APP.countsTracked(c);
  const meets = (k) => !r.minProjects || !tracked || (Number(k.projects) || 0) >= r.minProjects;
  const hit = sk.filter(k => k.productId === r.productId && (r.moduleId === '*' || k.moduleId === r.moduleId));
  if (hit.length) {
    const best = Math.max.apply(null, hit.map(k => Number(k.projects) || 0));
    const ok = hit.some(meets);
    return { credit: ok ? 45 : 25, kind: ok ? 'exact' : 'projects', have: best, via: null };
  }
  if (r.moduleId !== '*' && APP.CORE_PRODUCTS[r.productId]) {
    const mods = APP.equivModules(r.moduleId);
    let bestC = 0, via = null;
    for (const k of sk) {
      if (!APP.CORE_PRODUCTS[k.productId] || k.productId === r.productId || mods.indexOf(k.moduleId) === -1) continue;
      const w = APP.equivWeight(r.productId, k.productId);
      const cr = Math.round((meets(k) ? 45 : 25) * w);
      if (cr > bestC) { bestC = cr; via = k; }
    }
    if (bestC) return { credit: bestC, kind: 'transfer', have: Number(via.projects) || 0, via: via };
  }
  return sk.some(k => k.productId === r.productId) ? { credit: 5, kind: 'product', have: 0, via: null } : { credit: 0, kind: 'none', have: 0, via: null };
};
APP.reqCredit = function (c, r) { return APP.reqMatch(c, r).credit; };
APP.reqLabel = function (r) {
  if (r.moduleId === '*') return APP.productShort(r.productId);
  const mod = CAT_INDEX.mods[r.productId + ':' + r.moduleId] || {};
  return APP.moduleShort(mod.name || r.moduleId);
};
/* Match bands used for the colour of the % pill and the label in lists. */
APP.matchBand = function (score) {
  return score >= 75 ? { cls: 'm-strong', label: 'Strong' } : score >= 50 ? { cls: 'm-mid', label: 'Good' } : { cls: 'm-low', label: 'Partial' };
};

APP.initials = function (name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

APP.avColor = function (name) {
  let h = 0;
  for (let i = 0; i < (name || 'A').length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return 'av-' + (h % 8);
};

APP.timeAgo = function (ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 6e4);
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  const d = Math.floor(hr / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return d + ' days ago';
  if (d < 30) return Math.floor(d / 7) + 'w ago';
  return Math.floor(d / 30) + 'mo ago';
};

APP.fmtSize = function (bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
};

/* ---------------------------- icons ---------------------------- */

APP.ICO = {
  msg: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  bell: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  filter: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>',
  search: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  pin: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  briefcase: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  clip: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  file: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  building: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/></svg>',
  check: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  plus: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  users: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  spark: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  home: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  up: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
  share: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  lock: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  ext: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 7h6v6"/><path d="M10 14 21 3"/></svg>'
};

/* one line of profile facts with an icon; nothing at all when every fact is empty (no lone icons, no "undefined") */
APP.metaSpan = function (icon, parts) {
  const t = (parts || []).filter(x => x !== undefined && x !== null && String(x).trim() !== '').map(x => APP.h(x)).join(' · ');
  return t ? '<span>' + APP.icon(icon, 14) + ' ' + t + '</span>' : '';
};
APP.icon = function (name, size) {
  const s = APP.ICO[name];
  if (!s) return '';
  const sz = size || 18;
  return s.replace('width="1em" height="1em"', 'width="' + sz + '" height="' + sz + '"');
};

/* ---------------------------- smart matching ---------------------------- */

/**
 * Match v18 — skills are a gate, not just another line.
 *   score = core fit × (60% + 40% × other factors) × role-fit factor, then capped:
 *     - any must-have missing entirely  → at most 65
 *     - role type unrelated / adjacent  → at most 40 / 65
 * Core fit = module-level skills for most roles; product-level for Architects and Project/Delivery Managers.
 * "Other factors" are weighted per role type (experience, seniority, industry, specialties, languages, certification, location, availability).
 */
APP.JOB_RT_KEYWORDS = [
  ['delivery', /\b(project|programme|program|delivery|pmo|scrum master)\b.*\b(manager|lead|director|head)\b|\b(manager|director)\b.*\b(project|programme|program|delivery)\b|\bpmo\b/i],
  ['architect', /\barchitect/i],
  ['basis', /\bbasis\b|\bhana (admin|dba)|\bcloud infrastructure|\bdevops\b/i],
  ['technical', /\b(abap|developer|technical|fiori developer|btp developer|integration developer|programmer)\b/i],
  ['support', /\b(support|ams|application lead|incident)\b/i],
  ['keyuser', /\b(key user|business expert|business analyst)\b/i],
  ['junior', /\b(junior|trainee|graduate|intern)\b/i]
];
/* A job's role type: the one the company chose, otherwise inferred from the title (older roles), otherwise Functional. */
APP.jobRoleType = function (job) {
  if (job && APP.roleTypeById[job.roleType]) return job.roleType;
  const t = String((job && job.title) || '');
  for (const kv of APP.JOB_RT_KEYWORDS) if (kv[1].test(t)) return kv[0];
  return 'functional';
};
/* Product-level types: the SAP product matters, not each module */
APP.rtProductLevel = function (rt) { return rt === 'architect' || rt === 'delivery' || rt === 'basis' || rt === 'junior'; };
APP.MATCH_WEIGHTS = {
  /*            exp lvl ind spec lang cert loc avail */
  functional: { exp: 3, lvl: 1, ind: 3, spec: 2, lang: 2, cert: 2, loc: 2, avail: 1 },
  technical:  { exp: 3, lvl: 1, ind: 1, spec: 3, lang: 1, cert: 1, loc: 1, avail: 2 },
  basis:      { exp: 3, lvl: 1, ind: 1, spec: 4, lang: 1, cert: 3, loc: 1, avail: 2 },
  support:    { exp: 2, lvl: 1, ind: 2, spec: 2, lang: 3, cert: 1, loc: 3, avail: 3 },
  architect:  { exp: 4, lvl: 4, ind: 4, spec: 3, lang: 1, cert: 1, loc: 1, avail: 1 , prog: 3 },
  delivery:   { exp: 5, lvl: 3, ind: 4, spec: 4, lang: 3, cert: 1, loc: 2, avail: 2 , prog: 3 },
  keyuser:    { exp: 2, lvl: 1, ind: 5, spec: 4, lang: 2, cert: 1, loc: 3, avail: 1 },
  junior:     { exp: 0, lvl: 0, ind: 1, spec: 3, lang: 2, cert: 0, loc: 3, avail: 4 }
};
APP.RT_ADJACENT = { functional: ['keyuser', 'support', 'junior'], keyuser: ['functional'], support: ['functional', 'technical', 'basis'], technical: ['basis', 'support', 'architect'], basis: ['technical', 'support'], architect: ['delivery', 'functional', 'technical'], delivery: ['architect'], junior: ['functional', 'technical'] };
/* Role-type fit of a person for a job role type: { f: factor, cap, note } */
APP.roleFit = function (c, rt) {
  const mine = APP.rtList(c);
  const nm = APP.roleTypeLabel(rt);
  if (!mine.length) return { f: 0.9, cap: null, note: 'Role type not set on the profile' };
  if (mine[0] === rt) return { f: 1, cap: null, note: nm + ' — your primary role type' };
  if (mine.indexOf(rt) !== -1) return { f: 0.92, cap: null, note: nm + ' — one of your role types' };
  if (mine.some(m => (APP.RT_ADJACENT[m] || []).indexOf(rt) !== -1 || (APP.RT_ADJACENT[rt] || []).indexOf(m) !== -1)) return { f: 0.8, cap: 65, note: 'Role is ' + nm + '; you are ' + APP.roleTypeLabel(mine[0]) };
  return { f: 0.6, cap: 40, note: 'Role is ' + nm + '; you are ' + APP.roleTypeLabel(mine[0]) };
};
/* Credit (0–45) of one requirement row for product-level roles */
APP.reqMatchProduct = function (c, r, rt) {
  const sk = c.skills || [];
  const hasProd = sk.some(k => k.productId === r.productId);
  if (hasProd) {
    const modHit = r.moduleId === '*' || sk.some(k => k.productId === r.productId && k.moduleId === r.moduleId);
    return { credit: (rt === 'architect' && !modHit) ? 36 : 45, kind: modHit ? 'exact' : 'product-ok', have: 0, via: null };
  }
  if (APP.CORE_PRODUCTS[r.productId]) {
    let best = 0, via = null;
    for (const k of sk) { if (!APP.CORE_PRODUCTS[k.productId]) continue; const w = APP.equivWeight(r.productId, k.productId); if (w > best) { best = w; via = k; } }
    if (best) return { credit: Math.round(45 * best * (rt === 'architect' ? 0.75 : 0.85)), kind: 'transfer', have: 0, via: via };
  }
  return { credit: 0, kind: 'none', have: 0, via: null };
};
APP.matchDetail = function (c, job) {
  const parts = [], gaps = [];
  const rt = APP.jobRoleType(job);
  const wts = APP.MATCH_WEIGHTS[rt] || APP.MATCH_WEIGHTS.functional;
  const prodLevel = APP.rtProductLevel(rt);
  const pct = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100);

  /* ---- stage 1: role fit ---- */
  const rf = APP.roleFit(c, rt);
  parts.push({ stage: 'role', label: 'Role type', pct: pct(rf.f / 1), note: rf.note });
  if (rf.cap) gaps.push('Role type: ' + rf.note.toLowerCase());

  /* ---- stage 2: core fit ---- */
  let core = 1, missing = [];
  const groups = APP.reqGroups(job);
  if (groups.length) {
    let acc = 0;
    for (const g of groups) {
      const ms = g.map(r => ({ r: r, m: prodLevel ? APP.reqMatchProduct(c, r, rt) : APP.reqMatch(c, r) }));
      const best = ms.reduce((x, y) => (y.m.credit > x.m.credit ? y : x));
      acc += best.m.credit;
      if (best.m.kind === 'none' || (!prodLevel && best.m.kind === 'product')) { missing.push(g.map(APP.reqLabel).join(' / ')); gaps.push('Missing: ' + g.map(APP.reqLabel).join(' / ')); }
      else if (best.m.kind === 'projects') gaps.push(APP.reqLabel(best.r) + ': ' + best.m.have + ' of ' + best.r.minProjects + '+ projects');
    }
    core = acc / (45 * groups.length);
    parts.push({ stage: 'core', label: prodLevel ? 'SAP product experience' : 'Required skills', pct: pct(core), note: missing.length ? 'Missing ' + missing.join(', ') : (core >= 0.99 ? 'All required skills covered' : 'Partly covered') });
  }

  /* ---- stage 3: other factors (weighted; only the ones this role actually asks for) ---- */
  const ctx = [];
  const addCtx = (key, label, f, note) => { if (wts[key] > 0 && f != null) ctx.push({ key: key, label: label, f: f, w: wts[key], note: note }); };
  const langs = c.languages || [];
  const ro = [];
  if (job.languages && job.languages.length) ro.push(job.languages.every(l => langs.includes(l)) ? 1 : 0);
  if (job.preferredLangs && job.preferredLangs.length) {
    const ok = job.preferredLangs.some(l => langs.includes(l));
    ro.push(ok ? 1 : (ro.length ? 0 : 0.3));
    if (!ok) gaps.push('Preferred language: ' + job.preferredLangs.join(' / '));
  }
  if (ro.length) addCtx('lang', 'Languages', ro.reduce((a, b) => a + b, 0) / ro.length);
  const minExp = job.minExp || 0;
  if (minExp) {
    addCtx('exp', 'Experience', c.yearsExp >= minExp ? 1 : Math.max(0, 1 - (minExp - (c.yearsExp || 0)) * 0.25));
    if (c.yearsExp < minExp) gaps.push('Experience: ' + c.yearsExp + ' yrs, role wants ' + minExp + '+');
  }
  if (+job.minPrograms > 0) {
    const need = +job.minPrograms, have = +c.programs || 0, lbl = APP.ROLE_PROFILE[APP.jobRoleType(job)] && APP.ROLE_PROFILE[APP.jobRoleType(job)].prog || 'Programs delivered';
    addCtx('prog', lbl, have >= need ? 1 : have > 0 ? have / need : 0.3, have ? have + ' vs ' + need + '+ wanted' : 'Not on the profile');
  }
  if (job.level) { const i = APP.levels.indexOf(c.level), j = APP.levels.indexOf(job.level); addCtx('lvl', 'Seniority', (i < 0 || j < 0) ? (c.level === job.level ? 1 : 0) : Math.max(0, 1 - 0.5 * Math.abs(i - j))); }
  if (APP.jobIndustries(job).length) addCtx('ind', 'Industry', APP.jobIndustries(job).some(i => (c.industries || []).indexOf(i) !== -1) ? 1 : 0);
  if (job.preferredSpecialties && job.preferredSpecialties.length) {
    const mine = c.specialties || [];
    addCtx('spec', 'Specialties', job.preferredSpecialties.some(id => mine.indexOf(id) !== -1 || mine.some(x => ((APP.SPECIAL_IDX[x] || {}).categoryId) === id)) ? 1 : 0);
  }
  if (job.preferredGender === 'male' || job.preferredGender === 'female') {
    const gg = c.gender; /* soft preference: ranks higher, never hides; unknown stays neutral */
    ctx.push({ key: 'gen', label: 'Gender preference', f: gg ? (gg === job.preferredGender ? 1 : 0) : 0.5, w: 2, note: 'Employer prefers ' + APP.genderLabel(job.preferredGender).toLowerCase() });
  }
  if (job.certification) {
    const ok = APP.consultantCertInJob(c, job);
    addCtx('cert', 'Certification', ok ? 1 : (job.certification === 'required' ? 0 : 0.2));
    if (!ok) gaps.push('Not certified in the required modules');
  }
  if (job.remote) addCtx('loc', 'Location', 1, 'Remote-friendly');
  else {
    const cc = APP.countriesById[c.country], jc = APP.countriesById[job.country];
    if (jc) {
      let l = 0;
      if (!cc) l = 0.4;
      else if (job.city && c.city === job.city) l = 1;
      else if (cc.id === jc.id) l = 0.75;
      else if (cc.region === jc.region) l = 0.5;
      addCtx('loc', 'Location', l);
      if (cc && l < 0.75) gaps.push('Based in ' + (c.city || cc.name) + ', role is in ' + (job.city || jc.name));
    }
  }
  const av = { 'Immediate': 1, 'Within 15 days': 0.75, 'Within 30 days': 0.5 }[c.availability];
  addCtx('avail', 'Availability', av != null ? av : 0.2);
  if (av == null && c.availability) gaps.push('Available: ' + c.availability.toLowerCase());
  const wSum = ctx.reduce((a, x) => a + x.w, 0);
  const other = wSum ? ctx.reduce((a, x) => a + x.f * x.w, 0) / wSum : 1;
  ctx.sort((a, b) => b.w - a.w).forEach(x => parts.push({ stage: 'other', label: x.label, pct: pct(x.f), note: x.note || '', weight: x.w }));

  /* Rate fit (info only, no score) */
  if (APP.SHOW_RATES && job.rateMax && c.dailyRate && (c.currency || 'USD') === (job.currency || 'USD')) {
    const jp = job.ratePeriod || 'day', cp = c.ratePeriod || 'day';
    const inJobPeriod = Math.round(c.dailyRate / APP.PERIOD_DAYS[cp] * APP.PERIOD_DAYS[jp]);
    if (inJobPeriod > job.rateMax * 1.001) {
      gaps.push((cp === jp ? 'Rate ' + c.dailyRate.toLocaleString() + APP.periodSuffix(cp) : 'Rate ≈ ' + inJobPeriod.toLocaleString() + APP.periodSuffix(jp)) + ' is above the ' + job.rateMax.toLocaleString() + APP.periodSuffix(jp) + ' budget');
    }
  }

  /* ---- combine ---- */
  let raw = core * (0.6 + 0.4 * other) * rf.f * 100;
  let cap = null;
  const lower = (v, why) => { if (v < raw && (!cap || v < cap.value)) cap = { value: v, reason: why }; };
  if (missing.length) lower(65, 'Missing ' + missing.join(', '));
  if (rf.cap) lower(rf.cap, 'Role type does not match');
  const score = Math.max(0, Math.min(100, Math.round(cap ? Math.min(raw, cap.value) : raw)));
  return { score: score, parts: parts, gaps: gaps, cap: cap, coreFit: Math.round(core * 100), otherFit: Math.round(other * 100), roleType: rt };
};
APP.matchScore = function (c, job) { return APP.matchDetail(c, job).score; };

/** Compact label for a module name: "FI (Financial Accounting)" → "FI", "ABAP" → "ABAP". */
/* Full module name for the projects list: "PS (Project System)" → "Project System". Names without a leading abbreviation stay as they are. */
APP.moduleFull = function (name) {
  const n = String(name || '').trim();
  const m = /^([A-Z0-9&/+ -]{2,12}?)\s\((.+)\)$/.exec(n);
  return m && !/^formerly/i.test(m[2]) ? m[2] : n;
};
APP.moduleShort = function (name) {
  /* compact label for chips: "FI (Financial Accounting)" → "FI", "SAP Analytics Cloud (SAC) - Planning (FP&A)" → "Planning" */
  let n = String(name || '').trim();
  if (n.indexOf(' - ') > 0 && !/^IS-|^[A-Z]{2,}-/.test(n)) n = n.slice(n.lastIndexOf(' - ') + 3);
  n = n.replace(/^SAP\s+/, '');
  const abbr = /^([A-Z0-9&/+ -]{2,12}?)\s\(/.exec(n);
  let out = abbr ? abbr[1].trim() : n.split(/\s+\(/)[0];
  out = out.trim() || n;
  return out.length > 28 ? out.slice(0, 27) + '…' : out;
};

/**
 * Human "why it fits" drivers for a consultant + job pair — surfaced under the
 * match % so users can trust the number. Deduped, capped at 5 chips.
 */
APP.fitReasons = function (c, job) {
  if (!c || !job) return [];
  const out = [];
  const push = (t) => { if (t && out.indexOf(t) === -1) out.push(t); };
  for (const r of (job.requires || [])) {
    const m = APP.reqMatch(c, r);
    if (m.kind === 'none' || m.kind === 'product') continue;
    let label = APP.reqLabel(r);
    if (m.kind === 'transfer') label += ' (' + APP.productShort(m.via.productId) + ')';
    else if (m.kind === 'exact' && r.minProjects) label += ' ✓';
    push(label);
  }
  if (job.languages && job.languages.length && job.languages.every(l => (c.languages || []).indexOf(l) !== -1)) {
    push(job.languages.join(' · '));
  }
  if (job.minExp && c.yearsExp >= job.minExp && true) push(c.yearsExp + ' yrs');
  if (job.level && c.level === job.level) push(c.level);
  const cc = APP.countriesById[c.country];
  const jc = APP.countriesById[job.country];
  if (job.remote && (c.workPrefs || []).indexOf('Remote') !== -1) {
    push('Remote ok');
  } else if (cc && jc) {
    if (job.city && c.city === job.city) push(job.city);
    else if (cc.id === jc.id) push(cc.name);
  }
  { const ind = APP.jobIndustries(job).find(i => (c.industries || []).indexOf(i) !== -1); if (ind) push(ind); }
  if (job.certification && APP.consultantCertInJob(c, job)) push('Certified');
  for (const id of (job.preferredSpecialties || [])) {
    if ((c.specialties || []).indexOf(id) !== -1) push(APP.specialtyName(id));
  }
  return out.slice(0, 5);
};

/** Certified in at least one of the job's required modules — or in any module if the job lists none. */
APP.consultantCertInJob = function (c, job) {
  const reqs = (job.requires || []).filter(r => r.productId && r.moduleId);
  if (reqs.length) return reqs.some(r => (c.skills || []).some(k => k.productId === r.productId && (r.moduleId === '*' || k.moduleId === r.moduleId) && k.certified));
  return (c.skills || []).some(k => k.certified);
};
/** Hard gate for "required" certification; vacuously true otherwise. */
APP.certOkForJob = function (c, job) {
  if (!job || job.certification !== 'required') return true;
  return APP.consultantCertInJob(c, job);
};
/** Hard gate for "required" languages: consultant must speak every one listed. */
APP.langOkForJob = function (c, job) {
  if (!(c.languages || []).length) return true; /* no languages declared yet: show the role rather than hiding every job */
  return (job && job.languages ? job.languages : []).every(l => (c.languages || []).indexOf(l) !== -1);
};
/** Should the job appear in this consultant's feed? Applied jobs always stay visible; otherwise gated on cert + required languages. */
APP.jobVisibleToConsultant = function (c, job) {
  if ((job.applicants || []).indexOf(c.id) !== -1) return true;
  return APP.certOkForJob(c, job) && APP.langOkForJob(c, job);
};
/** Top-N consultants for a job (employer "Recommended talent"). Excludes current applicants; gated on cert + required languages; min score 50 unless minScore says otherwise. */
APP.consultantsForJob = function (job, n, minScore) {
  if (!job) return [];
  const min = typeof minScore === 'number' ? minScore : 50;
  return Object.values(APP.db.consultants)
    .filter(c => (job.applicants || []).indexOf(c.id) === -1 && APP.certOkForJob(c, job) && APP.langOkForJob(c, job))
    .map(c => ({ c: c, score: APP.matchScore(c, job) }))
    .filter(x => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, n || 5);
};
/* Professionals with a strong match who should hear about a freshly posted role. */
APP.notifyMatches = function (job, before) {
  const co = APP.company(job.companyId);
  let n = 0;
  for (const c of Object.values(APP.db.consultants)) {
    if (APP.LIVE && c.sample) continue; /* sample people have no inbox */
    if (!APP.jobVisibleToConsultant(c, job)) continue;
    const sc = APP.matchScore(c, job);
    /* after an edit, only people who did not already match the earlier version hear about it */
    if (before && APP.jobVisibleToConsultant(c, before) && APP.matchScore(c, before) >= 70) continue;
    if (sc >= 70) { APP.addNotif(c.id, 'job', (before ? 'Updated role now matches your profile at ' : 'New role matches your profile at ') + sc + '%: ' + job.title + (co ? ' — ' + APP.coLabel(co, job, c.id).replace('A confidential company', 'Confidential company') : ''), '#/job/' + job.id); n++; }
  }
  return n;
};

/* Open roles this professional can't see (certification or required language missing) — shown as a note so an empty feed is never a mystery. */
APP.hiddenJobsInfo = function (c) {
  const open = Object.values(APP.db.jobs).filter(j => j.status === 'open' && !APP.jobVisibleToConsultant(c, j));
  const lang = open.filter(j => !APP.langOkForJob(c, j)).length, cert = open.filter(j => !APP.certOkForJob(c, j)).length;
  return { n: open.length, lang: lang, cert: cert };
};
APP.jobsForConsultant = function (c) {
  return Object.values(APP.db.jobs)
    .filter(j => j.status === 'open' && APP.jobVisibleToConsultant(c, j))
    .map(j => ({ job: j, score: APP.matchScore(c, j) }))
    .sort((a, b) => b.score - a.score);
};

/* ---------------------------- state (ui) ---------------------------- */

APP.TF_DEFAULTS = function () {
  return { q: '', product: '', module: '', region: 'all', country: '', nationality: '', roleType: '', levels: [], langs: [], industries: [], specialties: [], workPref: '', cert: '', availability: '', minYears: 0, minProjects: 0, gender: '', sort: 'best' };
};

APP.JF_DEFAULTS = function () {
  return { types: [], region: 'all', sort: 'match', q: '', product: '', module: '', country: '', roleType: '', levels: [], workMode: '', industries: [], cert: '', lang: '', posted: '' };
};

APP.state = {
  jobFilters: APP.JF_DEFAULTS(),
  talentFilters: APP.TF_DEFAULTS(),
  communityFilters: { type: 'all', product: '', module: '', q: '', sort: 'active' },
  profileEdit: false,
  coEdit: false,
  pendingCv: false
};

APP.wizC = null; // consultant wizard draft
APP.wizE = null; // employer wizard draft
APP.profileDraft = null;
APP.jobNewDraft = null;
APP.chatDraft = {};   // in-progress message, keyed by conversation id (survives re-renders)
APP.commAskDraft = null;   // ask-a-question form-in-progress (survives navigation)
APP.commShareDraft = null; // share-an-article form-in-progress
APP.commAnsDraft = {};     // in-progress answer, keyed by question id
APP.commCmtDraft = {};     // in-progress article comment, keyed by article id
APP._formSyncSkip = [];    // form names to exclude from the next DOM→draft sync (resets / just-posted forms)

APP.getScope = function (scope) {
  switch (scope) {
    case 'jobFilters': return APP.state.jobFilters;
    case 'talentFilters': return APP.state.talentFilters;
    case 'wizC': return APP.wizC ? APP.wizC.data : null;
    case 'wizE': return APP.wizE ? APP.wizE.data : null;
    case 'profile': return APP.profileDraft;
    case 'jobNew': return APP.jobNewDraft;
    default: return null;
  }
};

/* Job posts store their skill rows under `requires`; wizards/profiles use `skills`. */
APP.scopeSkillKey = function (scope) {
  if (!scope) return 'skills';
  return Array.isArray(scope.requires) ? 'requires' : 'skills';
};

/* ---------------------------- toasts ---------------------------- */

APP.toast = function (msg) {
  /* the toast area lives outside #app, so a re-render never wipes a message the user has not read yet */
  let slot = document.getElementById('toasts');
  if (slot && slot.closest('#app')) { slot.remove(); slot = null; }
  if (!slot) {
    if (!document.body) return;
    slot = document.createElement('div'); slot.id = 'toasts'; slot.setAttribute('role', 'status'); slot.setAttribute('aria-live', 'polite');
    document.body.appendChild(slot);
  }
  const long = /could not|couldn.t|not allowed|problem|failed|undone|try again/i.test(String(msg));
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = APP.h(msg);
  slot.appendChild(el);
  setTimeout(() => { el.classList.add('show'); }, 20);
  if (long) el.classList.add('toast-warn');
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, long ? 6000 : 2600);
};

/* ---------------------------- shared card builders (v2: 3-level hierarchy) ----------------------------
   L1 anchor: avatar · name/title · match pill + rate.  L2 context: one meta bar (max 3 facts) + top-4 pills.
   L3 deep dive: footer with the main action and a "Match breakdown" side drawer (no inline score maths). */

APP.metaBarHtml = function (items) {
  const list = (items || []).filter(Boolean).slice(0, 3);
  return list.length ? '<div class="card-meta"><div class="mrow">' + list.map(function (x) { return '<span class="mi">' + x + '</span>'; }).join('') + '</div></div>' : '';
};
APP.availInfo = function (a) {
  if (!a) return null;
  const m = /^Within (\d+) days$/.exec(a);
  if (a === 'Immediate') return { text: 'Available immediately', tone: 'on' };
  if (m) return { text: 'Available in ' + m[1] + ' days', tone: +m[1] <= 30 ? 'soon' : 'later' };
  return { text: 'Available: ' + a, tone: 'later' };
};
APP.availHtml = function (a) {
  const i = APP.availInfo(a);
  return i ? '<span class="avail avail-' + i.tone + '"><i aria-hidden="true"></i>' + APP.h(i.text) + '</span>' : '';
};
/* Certified in at least one module. There is no identity verification yet, so the badge says so rather than "verified". */
APP.certBadgeHtml = function (c) {
  return !c.certRevoked && (c.skills || []).some(k => k.certified)
    ? '<span class="vbadge" title="' + (APP.LIVE ? 'Certified (self-declared) in at least one SAP module' : 'SAP-certified in at least one module') + '" aria-label="' + (APP.LIVE ? 'Certified, self-declared' : 'SAP-certified') + '">' + APP.icon('check', 11) + '</span>'
    : '';
};
APP.matchPillHtml = function (score) {
  if (typeof score !== 'number') return '';
  const b = APP.matchBand(score);
  return '<span class="match ' + b.cls + '" title="' + b.label + ' match">' + score + '% Match</span>';
};
/* Top-N pills (neutral style) + a quiet "+N more" that opens the full page. */
APP.pillsHtml = function (labels, n, href) {
  if (!labels.length) return '<span class="muted small">No skills tagged yet</span>';
  const top = labels.slice(0, n || 4), rest = labels.length - top.length;
  return top.map(l => '<span class="chip" title="' + APP.h(l.title || l.text) + '">' + APP.h(l.text) + '</span>').join('') +
    (rest > 0 ? (href ? '<button type="button" class="more-link" data-action="go" data-href="' + APP.h(href) + '">+' + rest + ' more</button>' : '<span class="more-link">+' + rest + ' more</span>') : '');
};
APP.productTiny = function (id) {
  return APP.productShort(id).replace(/^S\/4HANA Private Cloud.*$/, 'S/4 Private').replace(/^S\/4HANA Public Cloud.*$/, 'S/4 Public').replace(/ \/ On-Prem$/, '');
};
APP.skillPillLabels = function (skills, job) {
  const rel = (k) => (job && (job.requires || []).some(r => r.productId === k.productId && (r.moduleId === '*' || r.moduleId === k.moduleId))) ? 0 : 1;
  return (skills || []).slice().sort((a, b) => rel(a) - rel(b) || (Number(b.projects) || 0) - (Number(a.projects) || 0)).map(k => ({
    text: APP.moduleShort(APP.skillName(k.productId, k.moduleId)) + ' · ' + APP.productTiny(k.productId) + (k.certified ? ' ✓' : ''),
    title: APP.skillLabel(k) + ' — ' + (Number(k.projects) || 0) + ' project' + ((Number(k.projects) || 0) === 1 ? '' : 's') + (k.certified ? ', certified' : '')
  }));
};

APP.avatarHtml = function (name, size, anon) {
  if (anon || name === 'Confidential company' || name === 'A confidential company') return '<span class="avatar anon' + (size ? ' ' + size : '') + '" title="Identity private">' + APP.icon('lock', size === 'xl' ? 26 : size === 'lg' ? 20 : 15) + '</span>';
  return '<span class="avatar ' + APP.avColor(name) + (size ? ' ' + size : '') + '">' + APP.h(APP.initials(name)) + '</span>';
};

APP.skillChipsHtml = function (skills, n) {
  const top = (skills || []).slice(0, n || 4);
  if (!top.length) return '<span class="muted small">No skills tagged yet</span>';
  return top.map(k =>
    '<span class="chip" title="' + APP.h(APP.skillLabel(k)) + (Number(k.projects) > 0 ? ' — ' + Number(k.projects) + ' project' + (Number(k.projects) === 1 ? '' : 's') : ' — no projects yet') + '">' +
    APP.h(APP.productShort(k.productId)) + ': ' + APP.h(APP.skillName(k.productId, k.moduleId)) +
    ((k.certified || Number(k.projects) > 0) ? '<em>' + (k.certified ? '✓ ' : '') + (Number(k.projects) > 0 ? Number(k.projects) + '×' : '') + '</em>' : '') + '</span>'
  ).join('');
};

APP.countryName = (id) => (APP.countriesById[id] || {}).name || '';
/* "Dubai, United Arab Emirates" / "United Arab Emirates" / "Dubai" / "Location not specified" */
APP.locText = function (o, fallback) {
  const parts = [o && o.city, o && APP.countryName(o.country)].filter(Boolean);
  return parts.length ? parts.join(', ') : (fallback === undefined ? 'Location not specified' : fallback);
};

APP.jobCard = function (job, score, actionsHtml, link) {
  const co = APP.coFor(APP.company(job.companyId), job);
  const isExt = !!job.external;
  const coName = isExt ? (job.extEmployer || '') : (co ? co.name : '');
  const coHref = (!isExt && co && !co._anon) ? APP.authorHref(co.id) : null;
  if (!link) {
    const s = APP.db.session;
    link = (s && s.role === 'employer' && s.companyId === job.companyId) ? '#/e/jobs/' + job.id : '#/job/' + job.id;
  }
  const fitC = APP.db.session && APP.db.session.role === 'consultant' ? APP.consultant(APP.db.session.consultantId) : null;
  const invited = fitC && (job.invited || []).indexOf(fitC.id) !== -1;
  const canBreak = typeof score === 'number' && fitC;
  const reqLabels = APP.reqGroups(job).map(g => {
    const byP = []; g.forEach(r => { let b = byP.find(x => x.p === r.productId); if (!b) { b = { p: r.productId, r: [] }; byP.push(b); } b.r.push(r); });
    const t = byP.map(b => b.r.some(r => r.moduleId === '*') ? APP.productTiny(b.p) : b.r.map(r => APP.reqLabel(r)).join(' / ') + ' · ' + APP.productTiny(b.p)).join(' or ');
    return { text: t, title: g.map(r => APP.productShort(r.productId) + ': ' + APP.skillName(r.productId, r.moduleId) + (r.minProjects ? ' (' + r.minProjects + '+ projects)' : '')).join(' or ') };
  });
  const loc = APP.locText(job, job.remote ? 'Remote' : undefined) + (job.remote && (job.city || job.country) ? ' (remote ok)' : '');
  const meta = APP.metaBarHtml([APP.h(loc), APP.h(job.employmentType || ''), APP.expLabel(job) ? APP.h(APP.expLabel(job)) + ' exp' : (job.level ? APP.h(job.level) + ' level' : '')]);
  return '<article class="card job-card">' +
    '<div class="card-top">' +
    (isExt ? APP.avatarHtml(coName || 'Jobs', 'lg') : (co ? APP.avatarHtml(co.name, 'lg') : '')) +
    '<div class="card-id">' +
    '<p class="card-sub">' + (coHref ? '<a class="co-link" href="' + APP.h(coHref) + '">' + APP.h(coName) + '</a>' : APP.h(coName)) + '</p>' +
    '<h3 class="card-title">' + (link ? '<a href="' + APP.h(link) + '">' : '') + APP.h(job.title) + (link ? '</a>' : '') + APP.samplePill(job) +
    (job.status !== 'open' ? ' <span class="pill muted-pill">Closed</span>' : '') +
    (isExt ? ' <span class="pill ext-badge" title="Listed by Arnour. You apply on the employer\'s own site.">External listing</span>' : '') +
    (!isExt && co && co._anon ? ' <span class="pill anon-pill">' + APP.icon('lock', 11) + ' Confidential</span>' : '') +
    (invited ? ' <span class="pill inv">' + APP.icon('check', 12) + ' Invited</span>' : '') + '</h3>' +
    '</div>' +
    '<div class="card-side">' + APP.matchPillHtml(score) + (APP.SHOW_RATES ? '<span class="card-rate">' + APP.h(APP.fmtRange(job)) + '</span>' : '') + '</div>' +
    '</div>' +
    meta +
    '<div class="card-pills">' + APP.pillsHtml(reqLabels, 4, link) + '</div>' +
    '<div class="card-foot"><span class="muted small">Posted ' + APP.timeAgo(job.postedTs) + '</span><span class="grow"></span>' +
    (job.status === 'open' ? APP.shareIconBtn({ title: job.title, url: APP.shareUrl('#/job/' + job.id), text: job.title + (isExt ? (coName ? ' at ' + coName : '') : co && !co._anon ? ' at ' + co.name : '') + ' — hiring on Arnour, the SAP talent network.', tags: '#SAP #SAPJobs #Hiring' }) : '') +
    (canBreak ? '<button type="button" class="link" data-action="match-drawer" data-cid="' + fitC.id + '" data-jid="' + job.id + '">Match breakdown</button>' : '') +
    (actionsHtml || '') + '</div>' +
    '</article>';
};

/* Compact person row (level 1 + 2 only) for dashboards: avatar, name, headline, meta bar, actions. opts: { sub, actions } */
APP.personRowHtml = function (c, opts) {
  opts = opts || {};
  c = APP.cv(c);
  const name = APP.consultantFullName(c);
  const profile = '#/e/talent/' + c.id;
  return '<div class="person-row">' + APP.avatarHtml(name, '', c._anon) +
    '<div class="card-id"><p class="card-name">' + APP.h(name) + APP.certBadgeHtml(c) + APP.samplePill(c) + '</p>' +
    '<p class="person-title">' + APP.h(c.headline || '') + '</p>' +
    APP.metaBarHtml([APP.h(APP.locText(c)), c.yearsExp != null ? APP.h(c.yearsExp) + ' yrs' : '', APP.availHtml(c.availability)]) +
    (opts.sub ? '<p class="person-sub">' + opts.sub + '</p>' : '') + '</div>' +
    '<div class="person-actions"><button class="btn btn-ghost btn-sm" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', 14) + ' Message</button>' +
    '<button class="btn btn-primary btn-sm" data-action="go" data-href="' + profile + '">View Profile</button></div></div>';
};

/* opts: { score, job, extra, note } — score + job enable the match pill and drawer (job context only); extra = more footer actions. */
/* Message button for a revealed profile; for an anonymous one: request / status / answer buttons */
APP.talentContactHtml = function (c, size) {
  const s = APP.db.session, sm = size === 'sm';
  const msg = '<button class="btn ' + (sm ? 'btn-ghost btn-sm' : 'btn-primary jd-apply') + '" data-action="start-chat" data-cid="' + c.id + '">' + APP.icon('clip', sm ? 14 : 15) + ' Message' + (sm || c._anon ? '' : ' ' + APP.h(c.firstName)) + '</button>';
  if (!c._anon || !s || s.role !== 'employer') return msg;
  const i = APP.introFor(c.id, s.companyId);
  if (i && i.status === 'pending' && i.from === 'c') return '<button class="btn btn-primary btn-sm" data-action="intro-accept" data-id="' + i.id + '">Accept and reveal</button>' + msg;
  return msg;
};
APP.talentCard = function (c, opts) {
  opts = opts || {};
  c = APP.cv(c);
  const name = APP.consultantFullName(c);
  const hasScore = typeof opts.score === 'number' && opts.job;
  const profile = '#/e/talent/' + c.id;
  const meta = APP.metaBarHtml([
    APP.h(APP.locText(c)),
    c.yearsExp != null ? APP.h(c.yearsExp) + ' yrs experience' : '',
    APP.availHtml(c.availability)
  ]);
  return '<article class="card talent-card">' +
    '<div class="card-top">' +
    APP.avatarHtml(name, 'lg', c._anon) +
    '<div class="card-id">' +
    '<p class="card-name">' + APP.h(name) + APP.certBadgeHtml(c) + APP.samplePill(c) + (c._anon ? ' <span class="pill anon-pill">' + APP.icon('lock', 11) + ' Anonymous</span>' : '') + (opts.note || '') + '</p>' +
    '<h3 class="card-title">' + APP.h(c.headline || APP.roleTypeLabel(c.roleType) || c.level || '') + '</h3>' +
    '</div>' +
    '<div class="card-side">' + (hasScore ? APP.matchPillHtml(opts.score) : '') + (APP.SHOW_RATES ? '<span class="card-rate">' + APP.rateHtml(c) + '</span>' : '') + '</div>' +
    '</div>' +
    meta +
    '<div class="card-pills">' + APP.pillsHtml(APP.skillPillLabels(c.skills, opts.job), 4, profile) + '</div>' +
    (opts.quote || '') +
    '<div class="card-foot"><span class="grow"></span>' +
    (hasScore ? '<button type="button" class="link" data-action="match-drawer" data-cid="' + c.id + '" data-jid="' + opts.job.id + '">Match breakdown</button>' : '') +
    APP.talentContactHtml(c, 'sm') +
    (opts.extra || '') +
    '<button class="btn btn-primary btn-sm" data-action="go" data-href="' + profile + '">View Profile</button>' +
    '</div>' +
    '</article>';
};

/* ---------------------------- skeletons + empty states ---------------------------- */

/* Placeholder that mirrors the talent card's skeleton: avatar, name/title, meta bar, pills, footer. */
APP.skeletonCardHtml = function () {
  return '<div class="card skel-card" aria-hidden="true">' +
    '<div class="card-top"><span class="skeleton skel-avatar"></span><div class="card-id"><span class="skeleton skel-line" style="width:38%"></span><span class="skeleton skel-line" style="width:66%;height:16px"></span></div><span class="skeleton skel-line" style="width:88px"></span></div>' +
    '<span class="skeleton skel-line" style="width:72%;margin-top:14px"></span>' +
    '<div class="card-pills"><span class="skeleton skel-pill"></span><span class="skeleton skel-pill"></span><span class="skeleton skel-pill" style="width:64px"></span></div>' +
    '<div class="card-foot"><span class="grow"></span><span class="skeleton skel-btn"></span><span class="skeleton skel-btn" style="width:110px"></span></div></div>';
};
APP.skeletonCards = function (n) {
  let h = '';
  for (let i = 0; i < (n || 3); i++) h += APP.skeletonCardHtml();
  return h;
};
/* Briefly swaps a results container for skeletons, then restores the real HTML. Skipped for reduced-motion users. */
APP.showSkeleton = function (sel, n, ms) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.querySelector(sel);
  if (!el) return;
  const real = el.innerHTML;
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = APP.skeletonCards(n);
  setTimeout(() => {
    if (!document.contains(el)) return;
    el.innerHTML = real;
    el.removeAttribute('aria-busy');
  }, ms || 160);
};

/* opts: { icon, title, text, actionLabel, action (data-action), extra (html) } */
APP.emptyStateHtml = function (o) {
  o = o || {};
  return '<div class="card empty-state" role="status">' +
    '<span class="es-icon" aria-hidden="true">' + APP.icon(o.icon || 'search', 26) + '</span>' +
    '<h3>' + APP.h(o.title || 'Nothing here yet') + '</h3>' +
    (o.text ? '<p>' + APP.h(o.text) + '</p>' : '') +
    ((o.action || o.extra) ? '<div class="btn-row es-actions">' + (o.action ? '<button type="button" class="btn btn-primary" data-action="' + APP.h(o.action) + '">' + APP.h(o.actionLabel || 'Reset') + '</button>' : '') + (o.extra || '') + '</div>' : '') +
    '</div>';
};

/* ---------------------------- match breakdown drawer ---------------------------- */

/* "How the score is built": role fit, then skills (the ceiling), then the other factors; shared by the drawer and the job page */
APP.matchPartsHtml = function (d) {
  const row = (p, cls) => '<li class="' + (cls || '') + '"><div class="mb-row"><span>' + APP.h(p.label) + (p.note ? ' <em>' + APP.h(p.note) + '</em>' : '') + '</span><b>' + p.pct + '%</b></div>' +
    '<div class="mb-bar"><span class="' + (p.pct >= 75 ? 'hi' : p.pct >= 40 ? 'mid' : 'lo') + '" style="width:' + p.pct + '%"></span></div></li>';
  const by = (st) => d.parts.filter(p => p.stage === st);
  const role = by('role'), core = by('core'), other = by('other');
  return (d.cap ? '<p class="mb-cap">' + APP.icon('spark', 13) + ' Capped at ' + d.cap.value + '%: ' + APP.h(d.cap.reason) + '</p>' : '') +
    '<ul class="mb-parts">' + role.map(p => row(p)).join('') + core.map(p => row(p)).join('') + '</ul>' +
    (other.length ? '<h5 class="mb-sub">Other factors <span>' + d.otherFit + '%</span></h5><ul class="mb-parts mb-other">' + other.map(p => row(p)).join('') + '</ul>' : '') +
    '<p class="muted small mb-how">Skills set the ceiling: the other factors can lift a match, but cannot make up for missing skills. Required certification and languages still hide roles from people who don’t meet them.</p>';
};

APP.matchDrawerHtml = function (c, job) {
  const d = APP.matchDetail(c, job);
  const b = APP.matchBand(d.score);
  const why = APP.fitReasons(c, job);
  return '<div class="drawer-back" data-action="close-drawer"></div>' +
    '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">' +
    '<header class="drawer-head"><div><h2 id="drawer-title">Match breakdown</h2>' +
    '<p class="muted small">' + APP.h(APP.consultantFullName(c)) + ' · ' + APP.h(job.title) + '</p></div>' +
    '<button type="button" class="icon-btn" data-action="close-drawer" aria-label="Close">' + APP.icon('x', 16) + '</button></header>' +
    '<div class="drawer-body">' +
    '<div class="mb-score"><strong>' + d.score + '%</strong><span class="match ' + b.cls + '">' + b.label + ' match</span></div>' +
    (why.length ? '<h4>Why it fits</h4><div class="chip-wrap">' + why.map(t => '<span class="chip">' + APP.h(t) + '</span>').join('') + '</div>' : '') +
    (d.gaps.length ? '<h4>To check</h4><ul class="mb-gaps">' + d.gaps.slice(0, 5).map(t => '<li>' + APP.h(t) + '</li>').join('') + '</ul>' : '') +
    '<h4>How the score is built</h4>' + APP.matchPartsHtml(d) +
    '</div></aside>';
};
APP.openMatchDrawer = function (cid, jid) {
  const c = APP.consultant(cid), job = APP.job(jid);
  if (!c || !job) return;
  APP.closeMatchDrawer(true);
  APP._drawerFrom = document.activeElement;
  const root = document.createElement('div');
  root.id = 'drawer-root';
  root.innerHTML = APP.matchDrawerHtml(c, job);
  document.body.appendChild(root);
  { const sbw = window.innerWidth - document.documentElement.clientWidth; document.body.style.paddingRight = sbw > 0 ? sbw + 'px' : ''; }
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.classList.add('open'));
  const x = root.querySelector('.drawer .icon-btn'); if (x) x.focus();
  if (!APP._drawerKeys) {
    APP._drawerKeys = true;
    document.addEventListener('keydown', (e) => {
      const r = document.getElementById('drawer-root'); if (!r) return;
      if (e.key === 'Escape') { APP.closeMatchDrawer(); return; }
      if (e.key === 'Tab') {
        const f = r.querySelectorAll('.drawer button, .drawer a[href]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
};
APP.closeMatchDrawer = function (quick) {
  const r = document.getElementById('drawer-root');
  if (!r) return;
  r.id = 'drawer-closing';
  r.classList.remove('open');
  document.body.classList.remove('no-scroll');
  document.body.style.paddingRight = '';
  setTimeout(() => r.remove(), quick ? 0 : 220);
  if (!quick && APP._drawerFrom && document.contains(APP._drawerFrom)) { try { APP._drawerFrom.focus(); } catch (e) {} }
};

/* ---------------------------- messaging actions ---------------------------- */

APP.addNotif = function (key, type, text, link) {
  if (!key) return;
  const list = APP.db.notifications[key] = APP.db.notifications[key] || [];
  list.unshift({ id: 'n' + Date.now() + Math.floor(Math.random() * 1e4), type, text, ts: Date.now(), read: false, link: link || null });
};

APP.unreadMsgs = function () {
  const k = APP.userKey();
  const s = APP.db.session;
  if (!k || !s) return 0;
  return Object.values(APP.db.conversations).reduce((n, cv) => {
    const mineConv = s.role === 'consultant' ? (cv.cId === k || cv.c2Id === k) : cv.eId === k;
    return n + (mineConv ? (cv.unread[APP.convSide(cv)] || 0) : 0);
  }, 0);
};

APP.unreadNotifs = function () {
  const k = APP.userKey();
  return k ? (APP.db.notifications[k] || []).filter(n => !n.read).length : 0;
};

APP.openConversation = function (convId) {
  const cv = APP.conv(convId);
  if (!cv) return;
  cv.unread[APP.convSide(cv)] = 0;
  APP.save();
};

APP.createConversation = function (cId, eId, firstMsg, jobId) {
  let cv = APP.convBetween(cId, eId);
  if (!cv) {
    cv = { id: 'cv' + Date.now() + Math.floor(Math.random() * 1e3), cId, eId, jobId: jobId || '', botReplyUsed: false, messages: [], unread: { c: 0, e: 0 }, lastTs: Date.now(), mine: true };
    APP.db.conversations[cv.id] = cv;
  }
  if (firstMsg) APP.pushMessage(cv.id, firstMsg.side, firstMsg.text, firstMsg.cv);
  return cv;
};

APP.createPeerConversation = function (meId, otherId) {
  let cv = APP.peerConvBetween(meId, otherId);
  if (!cv) {
    cv = { id: 'cv' + Date.now() + Math.floor(Math.random() * 1e3), cId: meId, eId: null, c2Id: otherId, jobId: '', botReplyUsed: true, messages: [], unread: { c: 0, e: 0 }, lastTs: Date.now(), mine: true };
    APP.db.conversations[cv.id] = cv;
  }
  return cv;
};
/* the starter of a conversation may send 2 messages until the other side replies */
APP.convWaiting = function (cv) {
  if (!cv || !cv.mine) return false;
  const sd = APP.convSide(cv);
  if (cv.messages.some(m => m.side !== sd)) return false;
  return cv.messages.length >= 2;
};
APP.pushMessage = function (convId, side, text, cvAttached, extra) {
  const cv = APP.conv(convId);
  if (!cv) return;
  const other = side === 'c' ? 'e' : 'c';
  const myCv = cvAttached && APP.LIVE && APP.currentUser() && APP.currentUser().cv && APP.currentUser().cv.path ? Object.assign({}, APP.currentUser().cv) : !!cvAttached;
  if (text || extra || cvAttached) cv.messages.push(Object.assign({ side, text: text || '', ts: Date.now(), cv: myCv }, extra || {}));
  cv.lastTs = Date.now();
  cv.unread[other] = (cv.unread[other] || 0) + 1;
  if (cv.c2Id) { /* professional to professional */
    const fromId = side === 'c' ? cv.cId : cv.c2Id, toId = side === 'c' ? cv.c2Id : cv.cId, fromP = APP.consultant(fromId);
    if (fromP) APP.addNotif(toId, 'msg', ((!fromP.anon || (side === 'c' ? cv.revC : cv.revE)) ? fromP.firstName + ' ' + fromP.lastName : APP.anonLabel(fromP)) + ' sent you a message', '#/c/messages/' + cv.id);
    APP.save();
    return;
  }
  const otherKey = side === 'c' ? cv.eId : cv.cId;
  const from = side === 'c' ? APP.consultant(cv.cId) : APP.company(cv.eId);
  if (from) {
    const jb = cv.jobId ? APP.job(cv.jobId) : null;
    const who = side === 'c' ? APP.personLabel(from, cv.eId) : (APP.coHidden(from, jb) && !APP.revealed(cv.cId, cv.eId) ? 'A confidential company' : (from.name + (from.contactName ? ' — ' + from.contactName : '')));
    APP.addNotif(otherKey, 'msg', who + (extra && extra.call ? ' proposed a call' : ' sent you a message'), (side === 'c' ? '#/e/messages/' : '#/c/messages/') + cv.id);
  }
  APP.save();

  /* Demo liveliness: canned reply from companies when a consultant writes */
  if (!APP.LIVE && side === 'c' && !cv.botReplyUsed && APP.db.session && APP.db.session.role === 'consultant') {
    cv.botReplyUsed = true;
    APP.save();
    setTimeout(() => {
      const replies = [
        'Thanks! I\'ve shared your CV with the project lead — expect a call from us this week.',
        'Noted. Could you tell me a bit about the most recent rollout you worked on?',
        'Great — let\'s find a slot for a quick call. I\'ll send an invite shortly.'
      ];
      const cv2 = APP.conv(convId);
      if (!cv2) return;
      cv2.messages.push({ side: 'e', text: replies[cv2.messages.length % replies.length], ts: Date.now() });
      cv2.lastTs = Date.now();
      cv2.unread.c = (cv2.unread.c || 0) + 1;
      APP.addNotif(APP.userKey(), 'msg', (APP.company(cv2.eId) || {}).name + ' replied to your message', '#/c/messages/' + cv2.id);
      APP.save();
      APP.render();
    }, 900);
  }
};

/* ---------------------------- job actions ---------------------------- */

APP.applyToJob = function (jobId, note) {
  const job = APP.job(jobId);
  const k = APP.userKey();
  const c = APP.currentUser();
  if (!job || !k || !c || job.status !== 'open' || job.applicants.includes(k)) return;
  job.applicants.push(k);
  job.appliedTs = job.appliedTs || {}; job.appliedTs[k] = Date.now();
  const n = String(note || '').replace(/\s+\n/g, '\n').trim().slice(0, 300);
  if (n) { job.applyNotes = job.applyNotes || {}; job.applyNotes[k] = n; }
  const coA = APP.company(job.companyId);
  /* anonymity on either side: the application doubles as an introduction request, answered by the company */
  if ((c.anon || APP.coHidden(coA, job)) && !APP.revealed(c.id, job.companyId)) {
    APP.createIntro({ from: 'c', cid: c.id, eid: job.companyId, jobId: job.id, note: n });
  }
  APP.addNotif(job.companyId, 'app', APP.personLabel(c, job.companyId) + ' applied to "' + job.title + '"' + (n ? ' — with a note' : ''), '#/e/jobs/' + job.id);
  APP.save();
  APP.render();
  APP.toast('Application sent to ' + APP.coLabel(coA, job, c.id) + ' ✓');
};
APP.applyQuoteHtml = function (job, cid) {
  const ts = job.appliedTs && job.appliedTs[cid], note = job.applyNotes && job.applyNotes[cid];
  if (!ts && !note) return '';
  return '<div class="app-note">' + (ts ? '<span class="muted small">Applied ' + APP.timeAgo(ts) + '</span>' : '') +
    (note ? '<p>“' + APP.h(note).replace(/\n/g, '<br>') + '”</p>' : '') + '</div>';
};
APP.withdrawApplication = function (jobId) {
  const job = APP.job(jobId);
  const k = APP.userKey();
  const c = APP.currentUser();
  if (!job || !k || !c || !job.applicants.includes(k)) return;
  job.applicants = job.applicants.filter(x => x !== k);
  if (job.appliedTs) delete job.appliedTs[k];
  if (job.applyNotes) delete job.applyNotes[k];
  Object.values(APP.intros()).forEach(i => { if (i.cid === c.id && i.jobId === job.id && i.from === 'c' && i.status === 'pending') delete APP.intros()[i.id]; });
  APP.addNotif(job.companyId, 'app', APP.personLabel(c, job.companyId) + ' withdrew their application for "' + job.title + '"', '#/e/jobs/' + job.id);
  APP.save();
  APP.render();
  APP.toast('Application withdrawn');
};
/* what the person confirms before anything is sent */
APP.confirmApply = function (jobId) {
  const job = APP.job(jobId), c = APP.currentUser();
  if (!job || !c || !APP.userKey() || job.applicants.includes(APP.userKey())) return;
  const co = APP.coFor(APP.company(job.companyId), job) || {};
  const name = (c.firstName || '') + ' ' + (c.lastName || '');
  const score = APP.matchScore(c, job);
  APP.openDialog({
    title: 'Apply to ' + APP.h(job.title) + '?',
    sub: APP.h(co.name || 'The employer') + ' will receive your application right away.',
    body:
      '<div class="dlg-who">' + APP.avatarHtml(name) + '<div class="dlg-who-t"><b>' + APP.h(name.trim()) + '</b><span class="muted small">' + APP.h(c.headline || '') + '</span></div>' +
      (typeof score === 'number' ? '<span class="dlg-match">' + score + '% match</span>' : '') + '</div>' +
      '<label class="field"><span class="label">Note to ' + APP.h(co.name || 'the employer') + ' <span class="muted">(optional)</span></span>' +
      '<textarea id="dlg-note" class="input" rows="3" maxlength="300" placeholder="Why you are a good fit, your availability, anything useful…"></textarea>' +
      '<span class="muted small dlg-count" id="dlg-count">0 / 300</span></label>' +
      '<p class="muted small">' + (c.anon ? 'Your identity stays private until they accept — they see your skills and experience only.' : 'They see your profile.') + (co._anon ? ' The company is confidential: it is revealed to you when it accepts.' : '') + ' Your CV is only shared if you send it in a message.</p>',
    confirmLabel: 'Send application',
    onConfirm: function (v) { APP.applyToJob(jobId, v.note); }
  });
};
APP.confirmWithdraw = function (jobId) {
  const job = APP.job(jobId); if (!job) return;
  const co = APP.coFor(APP.company(job.companyId), job) || {};
  APP.openDialog({
    title: 'Withdraw your application?',
    sub: APP.h(job.title) + ' at ' + APP.h(co.name || 'the company') + ' will be removed from their applicant list, and they are told you withdrew. You can apply again while the role is open.',
    body: '',
    confirmLabel: 'Withdraw application', danger: true,
    onConfirm: function () { APP.withdrawApplication(jobId); }
  });
};
/* generic confirm dialog: { title, sub, body, confirmLabel, danger, onConfirm(values) } — Esc / backdrop / Cancel close it */
APP.openDialog = function (o) {
  APP.closeDialog(true);
  APP._dlgFrom = document.activeElement; APP._dlgConfirm = o.onConfirm || null;
  const root = document.createElement('div');
  root.id = 'dlg-root';
  root.innerHTML = '<div class="dlg-back" data-action="dlg-cancel"></div>' +
    '<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">' +
    '<h2 id="dlg-title">' + o.title + '</h2>' + (o.sub ? '<p class="dlg-sub">' + o.sub + '</p>' : '') +
    (o.body ? '<div class="dlg-body">' + o.body + '</div>' : '') +
    '<div class="dlg-foot"><button type="button" class="btn btn-ghost" data-action="dlg-cancel">Cancel</button>' +
    '<button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-action="dlg-ok" id="dlg-ok">' + APP.h(o.confirmLabel || 'Confirm') + '</button></div></div>';
  document.body.appendChild(root);
  { const sbw = window.innerWidth - document.documentElement.clientWidth; document.body.style.paddingRight = sbw > 0 ? sbw + 'px' : ''; }
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.classList.add('open'));
  const ok = document.getElementById('dlg-ok'); if (ok) ok.focus();
  if (!APP._dlgKeys) {
    APP._dlgKeys = true;
    document.addEventListener('keydown', (e) => {
      const r = document.getElementById('dlg-root'); if (!r) return;
      if (e.key === 'Escape') { e.preventDefault(); APP.closeDialog(); return; }
      if (e.key === 'Tab') {
        const f = r.querySelectorAll('.dlg button, .dlg textarea, .dlg input, .dlg a[href]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'dlg-note') { const c = document.getElementById('dlg-count'); if (c) c.textContent = e.target.value.length + ' / 300'; }
    });
  }
};
APP.closeDialog = function (quick) {
  const r = document.getElementById('dlg-root');
  if (!r) return;
  r.id = 'dlg-closing';
  r.classList.remove('open');
  document.body.classList.remove('no-scroll');
  document.body.style.paddingRight = '';
  setTimeout(() => r.remove(), quick ? 0 : 160);
  if (!quick && APP._dlgFrom && document.contains(APP._dlgFrom)) { try { APP._dlgFrom.focus(); } catch (e) {} }
};

APP.toggleSaveJob = function (jobId) {
  const c = APP.currentUser();
  if (!c || c.role !== undefined && c.role !== 'consultant') { /* only consultants */ }
  const user = APP.db.session && APP.db.session.role === 'consultant' ? APP.consultant(APP.db.session.consultantId) : null;
  if (!user) return;
  const arr = user.savedJobIds = user.savedJobIds || [];
  const i = arr.indexOf(jobId);
  if (i >= 0) arr.splice(i, 1); else arr.push(jobId);
  APP.save();
  APP.render();
  APP.toast(i >= 0 ? 'Removed from saved jobs' : 'Job saved ✓');
};

APP.isSavedJob = function (jobId) {
  const user = APP.db.session && APP.db.session.role === 'consultant' ? APP.consultant(APP.db.session.consultantId) : null;
  return user ? (user.savedJobIds || []).includes(jobId) : false;
};

APP.jobActionButtons = function (job, kind) {
  const isC = APP.db.session && APP.db.session.role === 'consultant';
  const isE = APP.db.session && APP.db.session.role === 'employer';
  const viewer = kind || (isC ? 'consultant' : (isE ? 'employer' : 'anon'));
  let html = '';
  if (viewer === 'employer') return '';
  if (viewer === 'anon') {
    /* anonymous visitor on a public job page — applying, saving and messaging all need an account */
    html += job.status === 'open'
      ? '<a class="btn btn-primary btn-sm" href="#/register" data-action="remember-job" data-id="' + job.id + '">Sign up to apply</a>'
      : '<button class="btn btn-outline btn-sm" disabled>' + APP.icon('check', 14) + ' Closed</button>';
    html += '<a class="btn btn-ghost btn-sm" href="#/login" data-action="remember-job" data-id="' + job.id + '">Sign in</a>';
    return html;
  }
  const applied = APP.userKey() && (job.applicants || []).includes(APP.userKey());
  if (!applied) html += APP.safeApplyUrl(job) ? '<button class="btn btn-primary btn-sm" data-action="ext-apply" data-id="' + job.id + '">Apply on company site ' + APP.icon('ext', 13) + '</button>' + (!job.external && APP.state.extOpened && APP.state.extOpened[job.id] ? '<button class="btn btn-outline btn-sm" data-action="ext-applied" data-id="' + job.id + '">I have applied</button>' : '') : '<button class="btn btn-primary btn-sm" data-action="apply" data-id="' + job.id + '">Apply</button>';
  else html += '<button class="btn btn-outline btn-sm" disabled>' + APP.icon('check', 14) + ' Applied</button>';
  html += '<button class="btn btn-ghost btn-sm" data-action="toggle-save" data-id="' + job.id + '">' + (APP.isSavedJob(job.id) ? '★ Saved' : '☆ Save') + '</button>';
  if (!job.external && APP.company(job.companyId)) html += '<button class="btn btn-outline btn-sm" data-action="start-chat" data-eid="' + job.companyId + '" data-jid="' + job.id + '">' + APP.icon('clip', 14) + ' Message</button>';
  return html;
};

/* ---------------------------- external sharing ---------------------------- */

/* Brand glyphs (simple, single-colour, inline so there is nothing to download) */
APP.SHARE_ICO = {
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8.3c.2 3 2.6 5.6 5.7 6.1l1.3-1.5-2.1-1-.9.8c-1-.4-1.8-1.2-2.3-2.2l.8-.9-1-2.1z" fill="currentColor"/>',
  linkedin: '<rect x="3" y="9" width="4" height="12" rx=".6" fill="currentColor"/><circle cx="5" cy="5" r="2.2" fill="currentColor"/><path d="M10 9h3.8v1.8c.8-1.4 2.2-2.1 3.9-2.1 3.1 0 4.3 2 4.3 5.1V21h-4v-6.2c0-1.4-.6-2.3-1.9-2.3-1.4 0-2.1 1-2.1 2.4V21h-4z" fill="currentColor"/>',
  telegram: '<path d="M21.5 3.5 2.5 10.8l6 2.3 2.3 6.4 3.3-4.1 5 3.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8.5 13.1 8.6-6.3-6.3 8.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  x: '<path d="M4 4l16 16M20 4 4 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  facebook: '<path d="M14 8.5h3V4.5h-3.2A4.3 4.3 0 0 0 9.5 8.8V11H7v4h2.5v6.5h4V15H16.8l.7-4h-4V9c0-.3.2-.5.5-.5z" fill="currentColor"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.5 7 8.5 6.5L20.5 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9h8M8 12.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  post: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  native: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
};
/* Icon channels, in the order SAP professionals in the region use them. */
APP.shareChannels = [
  ['whatsapp', 'WhatsApp'],
  ['linkedin', 'LinkedIn'],
  ['telegram', 'Telegram'],
  ['x', 'X'],
  ['facebook', 'Facebook'],
  ['email', 'Email'],
  ['sms', 'SMS']
];
APP.isMobileUA = () => /iPhone|iPad|iPod|Android/i.test((typeof navigator !== 'undefined' && navigator.userAgent) || '');
APP.canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
APP.shareIcon = (name, size) => '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (APP.SHARE_ICO[name] || '') + '</svg>';

/* Absolute URL for a given hash route, e.g. '#/job/j11' -> https://site/#/job/j11 */
APP.shareUrl = function (hash) {
  /* live site: roles and community posts are shared through /share/… so social sites can show a real preview */
  if (APP.LIVE) {
    const sm = hash.replace(/^#?\/?/, '').match(/^(job|community\/q|community\/a|talent|company)\/([A-Za-z0-9_-]+)$/);
    if (sm) return (location.origin || '') + '/share/' + { job: 'job', 'community/q': 'q', 'community/a': 'a', talent: 'p', company: 'c' }[sm[1]] + '/' + sm[2];
  }
  let base = (location.origin || '') + (location.pathname || '');
  if (/index\.html$/i.test(base)) base = base.replace(/index\.html.*$/i, '');
  if (!/\/$/.test(base)) base += '/';
  return base + '#' + (hash.charAt(0) === '#' ? hash.slice(1) : hash);
};
/* Tag a shared link with where it was shared, so visits can be attributed (…/?utm_source=whatsapp&utm_medium=share#/job/j1). */
APP.tagUrl = function (url, channel) {
  if (!url || !channel) return url;
  const hi = url.indexOf('#');
  const base = hi >= 0 ? url.slice(0, hi) : url, hash = hi >= 0 ? url.slice(hi) : '';
  if (/[?&]utm_source=/.test(base)) return url;
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'utm_source=' + channel + '&utm_medium=share' + hash;
};

/* item: { title, text, url, tags? }. Native share button first (phones), then the icon row, then copy buttons. */
APP.shareHtml = function (item) {
  const attrs = ' data-share-url="' + APP.h(item.url) + '" data-share-title="' + APP.h(item.title || '') + '" data-share-text="' + APP.h(item.text || '') + '" data-share-tags="' + APP.h(item.tags || '') + '"';
  const mobile = APP.isMobileUA();
  const icons = APP.shareChannels.filter(ch => ch[0] !== 'sms' || mobile).map(ch =>
    '<button type="button" class="share-ic share-' + ch[0] + '" data-action="share" data-channel="' + ch[0] + '"' + attrs + ' aria-label="Share on ' + ch[1] + '" title="' + ch[1] + '">' + APP.shareIcon(ch[0]) + '</button>'
  ).join('');
  return '<div class="share-row" role="group" aria-label="Share">' +
    '<span class="share-label">' + APP.icon('share', 13) + ' Share</span>' +
    (APP.canNativeShare() ? '<button type="button" class="share-pill share-native" data-action="share" data-channel="native"' + attrs + '>' + APP.shareIcon('native', 16) + ' Share…</button>' : '') +
    icons +
    '<button type="button" class="share-pill" data-action="share" data-channel="copy"' + attrs + '>' + APP.shareIcon('link', 16) + ' <span class="share-pill-t">Copy link</span></button>' +
    '<button type="button" class="share-pill" data-action="share" data-channel="post"' + attrs + ' title="Copies a ready-to-paste post with hashtags">' + APP.shareIcon('post', 16) + ' <span class="share-pill-t">Copy post text</span></button>' +
    '</div>';
};

/* Short "icon only" share button for list cards: phone share sheet when available, otherwise copies the link. */
APP.shareIconBtn = function (item) {
  return '<button type="button" class="share-ic share-mini" data-action="share" data-channel="' + (APP.canNativeShare() ? 'native' : 'copy') + '" data-share-url="' + APP.h(item.url) + '" data-share-title="' + APP.h(item.title || '') + '" data-share-text="' + APP.h(item.text || '') + '" data-share-tags="' + APP.h(item.tags || '') + '" aria-label="Share ' + APP.h(item.title || 'this') + '" title="Share">' + APP.shareIcon('native', 16) + '</button>';
};

APP._flashBtn = function (el, label) {
  if (!el || !el.querySelector) return;
  const t = el.querySelector('.share-pill-t');
  if (!t) { el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 1600); return; }
  const old = t.textContent;
  t.textContent = label; el.classList.add('done');
  setTimeout(() => { t.textContent = old; el.classList.remove('done'); }, 1800);
};

APP.doShare = function (channel, item, el) {
  const enc = encodeURIComponent;
  const url = APP.tagUrl(item.url, channel === 'copy' || channel === 'post' ? 'copy' : channel);
  const hashtags = item.tags || '#SAP';
  const postText = (item.text ? item.text + '\n\n' : (item.title ? item.title + '\n\n' : '')) + url + '\n\n' + hashtags;
  if (channel === 'copy') {
    APP._copyText(url);
    APP._flashBtn(el, 'Copied ✓');
    APP.toast('Link copied — paste it anywhere ✓');
    return;
  }
  if (channel === 'post') {
    APP._copyText(postText);
    APP._flashBtn(el, 'Copied ✓');
    APP.toast('Post text copied — paste it into LinkedIn, WhatsApp or anywhere ✓');
    return;
  }
  if (channel === 'native') {
    if (!APP.canNativeShare()) { APP._copyText(url); APP.toast('Link copied ✓'); return; }
    navigator.share({ title: item.title || 'Arnour', text: item.text || '', url: APP.tagUrl(item.url, 'native') }).catch(function () { /* cancelled */ });
    return;
  }
  let href = null;
  if (channel === 'whatsapp') {
    href = 'https://wa.me/?text=' + enc((item.text ? item.text + ' ' : '') + url);
  } else if (channel === 'linkedin') {
    href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url);
  } else if (channel === 'telegram') {
    href = 'https://t.me/share/url?url=' + enc(url) + '&text=' + enc(item.text || item.title || '');
  } else if (channel === 'x') {
    href = 'https://x.com/intent/post?text=' + enc(item.text || item.title || '') + '&url=' + enc(url);
  } else if (channel === 'facebook') {
    href = 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url);
  } else if (channel === 'email') {
    href = 'mailto:?subject=' + enc(item.title || 'Arnour') + '&body=' + enc((item.text ? item.text + '\n\n' : '') + url);
  } else if (channel === 'sms') {
    href = 'sms:?&body=' + enc((item.text ? item.text + ' ' : '') + url);
  }
  if (!href) return;
  if (channel === 'email' || channel === 'sms') { location.href = href; return; }
  if (window.open) window.open(href, '_blank', 'noopener');
  else location.href = href;
};

APP._copyText = function (text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function () { APP._copyFallback(text); });
  } else {
    APP._copyFallback(text);
  }
};

APP._copyFallback = function (text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  if (document.body && document.body.appendChild) document.body.appendChild(ta);
  if (ta.select) ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unavailable */ }
  if (document.body && document.body.removeChild) document.body.removeChild(ta);
};

/* ---------------------------- notifications panel ---------------------------- */

APP.notifPanelHtml = function () {
  const k = APP.userKey();
  const list = (k ? APP.db.notifications[k] : null) || [];
  const rows = list.slice(0, 12).map(n => {
    const inner =
    '<span class="notif-ico n-' + n.type + '">' + APP.icon(n.type === 'msg' ? 'msg' : n.type === 'comm' ? 'spark' : 'briefcase') + '</span>' +
    '<div class="notif-tt"><p>' + APP.h(n.text) + '</p><small>' + APP.timeAgo(n.ts) + '</small></div>' +
    (n.read ? '' : '<span class="dot"></span>');
    return (n.link ? '<button type="button" class="notif ' + (n.read ? '' : 'unread') + '" data-action="notif-open" data-nid="' + n.id + '" data-href="' + APP.h(n.link) + '">' + inner + '</button>' : '<div class="notif ' + (n.read ? '' : 'unread') + '">' + inner + '</div>');
  }).join('');
  return '<div class="notif-panel" id="notif-panel">' +
    '<div class="card-h">Notifications <button class="link" data-action="notif-all">Mark all read</button></div>' +
    (rows || '<div class="empty small">No notifications yet</div>') +
    '</div>';
};

/* ---------------------------- navbar / chrome ---------------------------- */


/* ---- Header shortcuts (v21): counts that mean something ---- */
/* Strong matches (75%+) posted since the professional last opened Jobs. */
APP.newStrongMatches = function (c) {
  const seen = c.jobsSeenTs || 0;
  return APP.jobsForConsultant(c).filter(m => m.score >= 75 && (m.job.postedTs || 0) > seen && (m.job.applicants || []).indexOf(c.id) === -1).length;
};
/* Applicants a company has not looked at yet (per-role count since the role page was last opened). */
APP.newApplicants = function (co) {
  const seen = co.seenApplicants || {};
  return Object.values(APP.db.jobs || {}).filter(j => j.companyId === co.id).reduce((n, j) => n + Math.max(0, (j.applicants || []).length - (seen[j.id] || 0)), 0);
};
APP.countBadge = function (n, title) { return n ? '<span class="nav-count" title="' + APP.h(title) + '">' + (n > 9 ? '9+' : n) + '</span>' : ''; };
/* Phone-only bottom tab bar for the signed-in app. */
APP.tabbarHtml = function () {
  const s = APP.db.session, u = APP.currentUser(); if (!s || !u) return '';
  const h = location.hash || '';
  if (/^#\/[ce]\/messages\/./.test(h)) return ''; /* an open conversation has its own composer */
  const isC = s.role === 'consultant';
  const m = APP.unreadMsgs();
  const nq = APP.openQuestionsForUser().length;
  const tabs = isC ? [
    ['#/c/dashboard', 'home', 'Home', 0], ['#/c/jobs', 'briefcase', 'Jobs', APP.newStrongMatches(u) + APP.waitingForMe()],
    ['#/community', 'users', 'Community', nq], ['#/c/messages', 'msg', 'Messages', m], ['#/c/profile', 'clip', 'Profile', 0]
  ] : [
    ['#/e/dashboard', 'home', 'Home', 0], ['#/e/talent', 'search', 'Talent', 0],
    ['#/e/jobs', 'briefcase', 'Roles', APP.newApplicants(u) + APP.waitingForMe()], ['#/community', 'users', 'Community', nq], ['#/e/messages', 'msg', 'Messages', m]
  ];
  return '<nav class="tabbar" aria-label="Main">' + tabs.map(t =>
    '<a class="tab' + (h === t[0] || (t[0] !== '#/c/dashboard' && t[0] !== '#/e/dashboard' && h.indexOf(t[0]) === 0) || (t[0] === '#/c/jobs' && /^#\/c\/(applied|saved|intros)/.test(h)) || (t[0] === '#/e/jobs' && h === '#/e/intros') ? ' active' : '') + '" href="' + t[0] + '">' +
    '<span class="tab-ico">' + APP.icon(t[1], 22) + (t[3] ? '<span class="nav-count">' + (t[3] > 9 ? '9+' : t[3]) + '</span>' : '') + '</span><span class="tab-lbl">' + t[2] + '</span></a>'
  ).join('') + '</nav>';
};

APP.navbar = function () {
  const s = APP.db.session;
  const u = APP.currentUser();
  if (!s || !u) return '';
  const isC = s.role === 'consultant';
  const name = isC ? APP.consultantFullName(u) : u.name;
  const m = APP.unreadMsgs();
  const n = APP.unreadNotifs();
  const ncount = APP.openQuestionsForUser().length;
  const home = isC ? '#/c/dashboard' : '#/e/dashboard';
  const searchTarget = isC ? '#/c/jobs' : '#/e/talent';
  const ph = isC ? 'Search SAP roles, e.g. S/4HANA FICO' : 'Search SAP talent, e.g. SuccessFactors Recruiting';
  return '<header class="nav">' +
    '<div class="nav-inner">' +
    '<a class="brand" href="' + home + '"><span class="brand-logo">A</span>Arnour</a>' +
    '<form data-form="nav-search" data-target="' + searchTarget + '" class="nav-search"><span class="nav-search-ico">' + APP.icon('search') + '</span><input name="q" value="' + APP.h(isC ? APP.state.jobFilters.q : APP.state.talentFilters.q) + '" placeholder="' + ph + '"></form>' +
    '<nav class="nav-actions">' +
    (isC
      ? '<a class="nav-link' + (/^#\/c\/(jobs|applied|saved|intros)/.test(location.hash) ? ' active' : '') + '" href="#/c/jobs">' + APP.icon('briefcase', 16) + ' Jobs' + APP.countBadge(APP.newStrongMatches(u) + APP.waitingForMe(), 'New strong matches (75%+), invitations and introductions waiting for your answer') + '</a>'
      : '<a class="nav-link' + (location.hash.indexOf('#/e/talent') === 0 ? ' active' : '') + '" href="#/e/talent">' + APP.icon('search', 16) + ' Talent</a>' +
        '<a class="nav-link' + ((location.hash.indexOf('#/e/jobs') === 0 && location.hash !== '#/e/jobs/new') || location.hash === '#/e/intros' ? ' active' : '') + '" href="#/e/jobs">' + APP.icon('briefcase', 16) + ' My roles' + APP.countBadge(APP.newApplicants(u) + APP.waitingForMe(), 'New applicants and introductions waiting for your answer') + '</a>') +
    '<a class="nav-link' + (location.hash.indexOf('#/community') === 0 ? ' active' : '') + '" href="#/community">' + APP.icon('users', 16) + ' Community' + (ncount ? '<span class="nav-count" title="Questions in your SAP areas that need an answer">' + ncount + '</span>' : '') + (u.communitySeen ? '' : '<span class="new-dot" title="New — the community is where SAP people ask and answer"></span>') + (u.communitySeen || u.pointerGone ? '' : '<span class="nav-pointer" id="nav-pointer">New: ask and answer SAP questions</span>') + '</a>' +
    (isC ? '' : '<a class="btn btn-primary btn-sm nav-post" href="#/e/jobs/new">' + APP.icon('plus', 14) + ' Post a job</a>') +
    '<button class="nav-ico" data-action="go" data-href="' + (isC ? '#/c/messages' : '#/e/messages') + '" title="Messages">' + APP.icon('msg', 20) + (m ? '<span class="badge">' + m + '</span>' : '') + '</button>' +
    '<button class="nav-ico" data-action="toggle-notif" title="Notifications">' + APP.icon('bell', 20) + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>' +
    '<div class="nav-user">' +
    '<button class="avatar ' + APP.avColor(name) + '" data-action="toggle-menu" title="' + APP.h(name) + '">' + APP.h(APP.initials(name)) + '</button>' +
    '<div class="menu" id="user-menu">' +
    '<div class="menu-head"><strong>' + APP.h(name) + '</strong><small>' + APP.h(isC ? u.headline : (u.industry || 'Company')) + '</small></div>' +
    '<a class="menu-item" href="' + (isC ? '#/c/profile' : '#/e/company') + '">' + (isC ? 'View my profile' : 'Company profile') + '</a>' +
    (isC
      ? '<a class="menu-item" href="' + (APP.waitingForMe() ? '#/c/intros' : '#/c/applied') + '">My jobs' + (APP.waitingForMe() ? ' <span class="count-pill">' + APP.waitingForMe() + '</span>' : '') + '</a>'
      : '<a class="menu-item" href="' + (APP.pendingIntrosFor() ? '#/e/intros' : '#/e/jobs') + '">My roles' + ((APP.pendingIntrosFor() + APP.newApplicants(u)) ? ' <span class="count-pill">' + (APP.pendingIntrosFor() + APP.newApplicants(u)) + '</span>' : '') + '</a>') +
    '<button class="menu-item" data-action="sign-out">Sign out</button>' +
    (APP.LIVE && APP.backend && APP.backend.isAdmin ? '<a class="menu-item" href="#/admin">Admin</a>' : '') +
    (APP.LIVE ? '<button class="menu-item" data-action="fb-open">Report a problem</button><a class="menu-item" href="#/account">Account</a>' : '<button class="menu-item danger" data-action="reset-demo">Reset demo data</button>') +
    '</div></div>' +
    '</nav></div>' +
    APP.notifPanelHtml() +
    '</header>' + APP.tabbarHtml();
};

APP.pubHeader = function () {
  return '<header class="nav pub">' +
    '<div class="nav-inner pub-inner">' +
    '<a class="brand" href="#/"><span class="brand-logo">A</span>Arnour</a>' +
    '<nav class="nav-actions">' +
    '<a class="nav-link' + (location.hash.indexOf('#/jobs') === 0 ? ' active' : '') + '" href="#/jobs">' + APP.icon('briefcase', 16) + ' Jobs</a>' +
    '<a class="nav-link' + (location.hash.indexOf('#/community') === 0 ? ' active' : '') + '" href="#/community">' + APP.icon('users', 16) + ' Community</a>' +
    '<a class="btn btn-ghost" href="#/login">Sign in</a>' +
    '<a class="btn btn-primary" href="#/register">Join Arnour</a>' +
    '</nav></div>' +
    '</header>';
};

/* ---------------------------- shared UI bits ---------------------------- */

APP.opt = function (pairs, sel) {
  return pairs.map(p =>
    '<option value="' + APP.h(p[0]) + '"' + (p[0] === sel ? ' selected' : '') + '>' + APP.h(p[1]) + '</option>'
  ).join('');
};

/* Country is required in every form; the city is optional and only makes sense inside a country. */
APP.countryOptions = (sel, noBlank) => (noBlank ? '' : '<option value=""' + (sel ? '' : ' selected') + '>Select a country…</option>') + APP.opt(APP.countries.map(c => [c.id, c.name]), sel);
APP.cityOptions = function (countryId, sel) {
  const cities = ((APP.countriesById[countryId] || {}).cities || []);
  const keep = sel && cities.indexOf(sel) === -1 ? [sel] : []; /* an older saved city that is not in the list stays selectable */
  return '<option value=""' + (sel ? '' : ' selected') + '>' + (countryId ? 'Not specified' : 'Choose a country first') + '</option>' +
    APP.opt(keep.concat(cities).map(x => [x, x]), sel);
};
/* Free-text city input for company / job forms, with the chosen country's cities as suggestions. */
APP.cityInputHtml = function (countryId, city) {
  const cities = ((APP.countriesById[countryId] || {}).cities || []);
  return '<label class="field"><span class="label">City <span class="muted">(optional)</span></span>' +
    '<input name="city" class="input" list="city-list" autocomplete="off" value="' + APP.h(city || '') + '" placeholder="' + (cities[0] ? 'e.g. ' + APP.h(cities[0]) : 'City') + '">' +
    '<datalist id="city-list">' + cities.map(x => '<option value="' + APP.h(x) + '"></option>').join('') + '</datalist></label>';
};
APP.productOptions = (sel) => APP.opt(CATALOG.products.map(p => [p.id, p.name]), sel);

APP.moduleOptions = function (productId, sel, allowAny) {
  const p = CAT_INDEX.byId[productId];
  const list = p ? p.modules : [];
  return '<option value="">Module…</option>' +
    (allowAny ? '<option value="*"' + (sel === '*' ? ' selected' : '') + '>Any module (general)</option>' : '') +
    APP.opt(list.map(m => [m.id, m.name]), sel);
};

APP.chipGroup = function (scope, group, options, selected, single) {
  selected = selected || [];
  const isOn = (v) => single ? selected === v : selected.includes(v);
  return options.map(o => {
    const val = typeof o === 'string' ? o : o.id;
    const label = typeof o === 'string' ? o : o.name;
    const on = isOn(val);
    return '<button type="button" class="chip ' + (on ? 'chip-on' : '') + '" data-action="chip" data-scope="' + scope + '" data-group="' + group + '"' + (single ? ' data-single="1"' : '') + ' data-value="' + APP.h(val) + '">' + APP.h(label) + '</button>';
  }).join('');
};

/* Grouped specialty picker — one collapsible panel per practice area (open state survives re-renders), a "Selected (n)" strip on top
   so choices stay visible while panels are closed. Reused by the consultant wizard, profile edit, Find Talent and job posting. */
APP.specialtyChipsHtml = function (scope, selected, group, opts) {
  selected = selected || [];
  opts = opts || {};
  const g = group || 'specialties';
  const sel = (id) => selected.indexOf(id) !== -1;
  const sug = (opts.roles && opts.roles.length) ? APP.specialtiesForRoles(opts.roles) : [];
  const roleMode = sug.length > 0;
  const chip = (val, label, on, title) =>
    '<button type="button" class="chip' + (on ? ' chip-on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (title ? ' title="' + APP.h(title) + '"' : '') +
    ' data-action="chip" data-scope="' + scope + '" data-group="' + g + '" data-value="' + APP.h(val) + '">' + APP.h(label) + '</button>';
  const known = selected.filter(id => APP.SPECIAL_IDX[id] || APP.specialties.some(c => c.id === id));
  const warn = opts.softMax && known.length > opts.softMax
    ? '<span class="spec-warn">' + opts.softMax + ' or fewer reads strongest</span>' : '';
  const strip = '<div class="spec-selected" role="status" aria-live="polite"><span class="spec-selected-label">Selected (' + known.length + (opts.softMax ? ' of ' + opts.softMax : '') + ')</span>' +
    (known.length
      ? known.map(id => chip(id, APP.specialtyName(id) + ' ×', true, 'Remove ' + APP.specialtyLabel(id))).join('')
      : '<span class="muted small">' + (roleMode ? 'None yet. Select what applies below.' : 'None yet. Open an area below and select what applies.') + '</span>') + warn + '</div>';
  const open = APP.state.specOpen || (APP.state.specOpen = {});
  const none = known.length === 0;
  const panels = APP.specialties.map((cat, ci) => {
    const ids = [];
    cat.groups.forEach(gr => gr.items.forEach(it => ids.push(it.id)));
    const n = ids.filter(sel).length;
    const key = scope + ':' + g + ':' + cat.id;
    const isOpen = key in open ? open[key] : (n > 0 || (none && ci === 0 && !roleMode));
    return '<details class="spec-cat" data-spec-key="' + key + '"' + (isOpen ? ' open' : '') + '>' +
      '<summary><span class="spec-cat-name">' + APP.h(cat.name) + '</span>' +
      '<span class="spec-count' + (n ? ' on' : '') + '">' + (n ? n + ' selected' : ids.length + ' options') + '</span></summary>' +
      cat.groups.map(gr =>
        '<div class="spec-group">' + (gr.name ? '<span class="spec-group-name">' + APP.h(gr.name) + '</span>' : '') +
        '<div class="chip-wrap">' + gr.items.map(it => chip(it.id, it.short || it.name, sel(it.id), it.name)).join('') + '</div></div>'
      ).join('') + '</details>';
  }).join('');
  if (!roleMode) return strip + panels;
  /* Role-aware: the role's own specialties first; the full grouped list sits behind "Add other specialties". */
  const outside = known.filter(id => sug.indexOf(id) === -1).length;
  const mkey = scope + ':' + g + ':more';
  const mOpen = mkey in open ? open[mkey] : false;
  const suggested = '<div class="spec-suggest"><span class="spec-group-name">' + (opts.sugLabel || ('Suggested for your role' + (opts.roles.length > 1 ? 's' : ''))) + '</span>' +
    '<div class="chip-wrap">' + sug.map(id => { const it = APP.SPECIAL_IDX[id]; return chip(id, it.short || it.name, sel(id), it.name); }).join('') + '</div></div>';
  return strip + suggested +
    '<details class="spec-more" data-spec-key="' + mkey + '"' + (mOpen ? ' open' : '') + '><summary>Add other specialties' + (outside ? ' <span class="spec-count on">' + outside + ' selected</span>' : '') + '</summary>' + panels + '</details>';
};

/* Select rows for "skill pairs" (product + module + count) */
APP.skillRowsHtml = function (target, skills, withMin, withCert) {
  return (skills || []).map((k, i) =>
    '<div class="skill-row' + (withCert ? ' with-cert' : '') + (withMin ? ' with-or' : '') + '" data-skill-row="' + i + '" data-target="' + target + '">' +
    '<select data-skill-field="productId">' + APP.productOptions(k.productId) + '</select>' +
    '<select data-skill-field="moduleId">' + APP.moduleOptions(k.productId, k.moduleId, withMin) + '</select>' +
    (withMin
      ? '<input type="number" class="narrow" min="0" max="99" data-skill-field="minProjects" value="' + Number(k.minProjects || 0) + '" title="Minimum projects" placeholder="min">'
      : '<input type="number" class="narrow" min="0" max="99" data-skill-field="projects" value="' + Number(k.projects || 0) + '" title="Projects done" placeholder="×">') +
    (withMin ? (i === 0
      ? '<span class="skill-or skill-or-off" title="Add a second requirement to make it an alternative">—</span>'
      : '<label class="skill-or" title="Tick if this is an alternative to the row above — either one is enough"><input type="checkbox" data-skill-field="orPrev"' + (k.orPrev ? ' checked' : '') + '> or</label>') : '') +
    (withCert ? '<label class="skill-cert" title="SAP certified in this module (shown to recruiters)"><input type="checkbox" data-skill-field="certified"' + (k.certified ? ' checked' : '') + '></label>' : '') +
    '<button type="button" class="icon-btn" data-action="rm-skill" data-idx="' + i + '" data-target="' + target + '" title="Remove">' + APP.icon('x', 15) + '</button>' +
    '</div>'
  ).join('') +
  '<p class="muted small" style="margin-top:4px">Pick a product first — the module list updates to that product’s modules. Switch products and any module that exists in both is kept.</p>';
};


/* ---------------------------- job post: requirement rows, summary, wizard helpers ---------------------------- */
/* ---- module chips (shared by job requirement cards and professional skill cards) ---- */
APP.moduleChipsHtml = function (pid, selected, attrs, qKey, allowAny) {
  const mods = (CAT_INDEX.byId[pid] ? CAT_INDEX.byId[pid].modules : []);
  const q = ((APP.state.modQ || {})[qKey] || '').toLowerCase();
  const one = function (id, name, title) {
    const on = selected.indexOf(id) !== -1;
    const hide = q && !on && (name + ' ' + title).toLowerCase().indexOf(q) === -1;
    return '<button type="button" class="mchip' + (on ? ' on' : '') + '" data-action="mod-toggle" ' + attrs + ' data-mid="' + APP.h(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" title="' + APP.h(title) + '"' + (hide ? ' hidden' : '') + '>' + (on ? APP.icon('check', 12) + ' ' : '') + APP.h(name) + '</button>';
  };
  return '<div class="mod-wrap">' +
    (allowAny && mods.length > 12 ? '<input type="search" class="input mod-q" data-mod-q="' + APP.h(qKey) + '" value="' + APP.h((APP.state.modQ || {})[qKey] || '') + '" placeholder="Filter ' + mods.length + ' modules…" aria-label="Filter modules">' : '') +
    '<div class="chip-wrap mod-chips">' +
    (allowAny ? one('*', 'Any module', 'Any module (general) — the product is what matters') : '') +
    mods.map(m => one(m.id, APP.moduleShort(m.name), m.name)).join('') +
    '</div></div>';
};
/* run a skills mutation safely: harvest the DOM first (indexes still match), mutate, then stop the next render re-harvesting a stale DOM */
APP.skillMutate = function (el, fn) {
  const f = el && el.closest ? el.closest('form[data-form]') : null;
  APP.syncFormsToDrafts([]);
  fn();
  if (f) APP._formSyncSkip = [f.dataset.form];
  APP.renderKeep();
};

/* ---- job requirement cards: one card = one product + one or more modules (any one is enough) ---- */
APP.jobReqNormalize = function (rows) {
  let mx = 0; rows.forEach(r => { if (r.cid != null && r.cid > mx) mx = r.cid; });
  rows.forEach(function (r, i) {
    if (r.cid != null) return;
    const prev = rows[i - 1];
    if (i > 0 && r.orPrev && prev && prev.productId === r.productId) r.cid = prev.cid; /* legacy: same-product "or" rows read as one card */
    else r.cid = ++mx;
    if (r.cid == null) r.cid = ++mx;
  });
  if (rows[0]) rows[0].orPrev = false;
  return rows;
};
APP.jobReqCards = function (rows) {
  APP.jobReqNormalize(rows);
  const cards = [];
  rows.forEach(function (r, i) {
    const last = cards[cards.length - 1];
    if (last && rows[i - 1].cid === r.cid) last.end = i; else cards.push({ start: i, end: i, cid: r.cid });
  });
  return cards.map(c => ({ start: c.start, end: c.end, cid: c.cid, rows: rows.slice(c.start, c.end + 1), productId: rows[c.start].productId, alt: c.start > 0 && !!rows[c.start].orPrev, min: rows[c.start].minProjects || 0 }));
};
APP.jobReqRowsHtml = function (rows) {
  rows = rows || [];
  const bad = (APP.state.jobErr && APP.state.jobErr.rows) || [];
  const cards = APP.jobReqCards(rows);
  let g = 0;
  return cards.map(function (c, ci) {
    if (!c.alt) g++;
    const sel = c.rows.map(r => r.moduleId).filter(Boolean);
    const err = bad.some(i => i >= c.start && i <= c.end);
    const join = ci === 0 ? '' :
      '<div class="req-join" role="group" aria-label="How this relates to the requirement above">' +
      '<button type="button" class="seg' + (c.alt ? '' : ' on') + '" data-action="req-mode" data-idx="' + c.start + '" data-mode="and" aria-pressed="' + (c.alt ? 'false' : 'true') + '">And also</button>' +
      '<button type="button" class="seg' + (c.alt ? ' on' : '') + '" data-action="req-mode" data-idx="' + c.start + '" data-mode="or" aria-pressed="' + (c.alt ? 'true' : 'false') + '">Or instead</button></div>';
    return join +
      '<div class="req-card' + (c.alt ? ' is-alt' : '') + (err ? ' has-err' : '') + '" data-req-card="' + c.cid + '">' +
      '<div class="req-card-h"><span class="req-n">' + (c.alt ? 'Alternative' : 'Requirement ' + g) + '</span>' +
      (cards.length > 1 ? '<button type="button" class="icon-btn" data-action="req-rm" data-idx="' + c.start + '" title="Remove this requirement" aria-label="Remove this requirement">' + APP.icon('x', 15) + '</button>' : '') + '</div>' +
      '<div class="req-fields">' +
      '<label class="field"><span class="label">SAP product</span><select class="input" data-prod-sel data-target="jobNew" data-idx="' + c.start + '">' + APP.productOptions(c.productId) + '</select></label>' +
      (APP.rtCounts(APP.jobNewDraft && APP.jobNewDraft.roleType) || !(APP.jobNewDraft && APP.jobNewDraft.roleType) ? '<label class="field req-min"><span class="label">Min. projects <span class="muted">(optional)</span></span><input type="number" min="0" max="99" class="input" data-req-min data-idx="' + c.start + '" value="' + (c.min ? Number(c.min) : '') + '" placeholder="Any"></label>' : '') +
      '</div>' +
      '<div class="field"><span class="label">Modules <span class="muted">— tick one or more; any of them is enough</span></span>' +
      APP.moduleChipsHtml(c.productId, sel, 'data-target="jobNew" data-idx="' + c.start + '"', 'jobNew:' + c.cid, true) + '</div>' +
      '</div>';
  }).join('');
};
/* ---- professional skills: one card per product, tick modules, then projects + certified per module ---- */
APP.skillCardsHtml = function (target, skills, mode) {
  skills = skills || [];
  mode = mode || 'full';
  if (mode === 'products') return APP.productChipsHtml(target, skills);
  const real = (k) => k.moduleId && k.moduleId !== '*';
  const order = []; skills.forEach(k => { if (k.productId && order.indexOf(k.productId) === -1) order.push(k.productId); });
  const unused = CATALOG.products.filter(p => order.indexOf(p.id) === -1);
  let nMods = 0;
  const leadT = APP.isLeadRole(target === 'wizC' ? (APP.wizC && APP.wizC.data) : APP.profileDraft); /* leadership: modules optional */
  const cards = order.map(function (pid) {
    const idxs = []; skills.forEach((k, i) => { if (k.productId === pid) idxs.push(i); });
    const sel = idxs.filter(i => real(skills[i])).map(i => skills[i].moduleId); nMods += sel.length;
    const opts = APP.opt(CATALOG.products.filter(p => p.id === pid || order.indexOf(p.id) === -1).map(p => [p.id, p.name]), pid);
    const lines = mode === 'modules' ? '' : idxs.filter(i => real(skills[i])).map(function (i) {
      const k = skills[i]; const m = (CAT_INDEX.byId[pid] ? CAT_INDEX.byId[pid].modules : []).find(x => x.id === k.moduleId);
      return '<div class="skill-row mod-line" data-skill-row="' + i + '" data-target="' + target + '">' +
        '<span class="ml-n" title="' + APP.h(m ? m.name : k.moduleId) + '">' + APP.h(m ? APP.moduleFull(m.name) : k.moduleId) + '</span>' +
        '<label class="ml-f"><span class="muted small">Projects' + (mode === 'optional' ? ' (optional)' : '') + '</span><input type="number" min="0" max="99" class="input" data-skill-field="projects" value="' + Number(k.projects || 0) + '"></label></div>';
    }).join('');
    const certChips = sel.map(function (mid) {
      const k = skills.find(x => x.productId === pid && x.moduleId === mid) || {};
      const m = (CAT_INDEX.byId[pid] ? CAT_INDEX.byId[pid].modules : []).find(x => x.id === mid);
      return '<button type="button" class="mchip cert-chip' + (k.certified ? ' on' : '') + '" data-action="cert-toggle" data-target="' + target + '" data-pid="' + APP.h(pid) + '" data-mid="' + APP.h(mid) + '" aria-pressed="' + (k.certified ? 'true' : 'false') + '" title="' + APP.h(m ? m.name : mid) + '">' + (k.certified ? APP.icon('check', 12) + ' ' : '') + APP.h(m ? APP.moduleShort(m.name) : mid) + '</button>';
    }).join('');
    return '<div class="prod-card" data-prod="' + APP.h(pid) + '">' +
      '<div class="req-card-h"><label class="field prod-sel"><span class="label">SAP product</span><select class="input" data-prod-sel data-target="' + target + '" data-pid="' + APP.h(pid) + '">' + opts + '</select></label>' +
      '<button type="button" class="icon-btn" data-action="prod-rm" data-target="' + target + '" data-pid="' + APP.h(pid) + '" title="Remove this product" aria-label="Remove this product">' + APP.icon('x', 15) + '</button></div>' +
      '<div class="field"><span class="label">Modules ' + (mode === 'modules' ? 'you work with' : 'you have delivered') + ' <span class="muted">— ' + (leadT ? 'optional' : 'tick all that apply') + '</span></span>' +
      APP.moduleChipsHtml(pid, sel, 'data-target="' + target + '" data-pid="' + APP.h(pid) + '"', target + ':' + pid, false) + '</div>' +
      (lines ? '<div class="mod-lines"><div class="mod-lines-h">' + (mode === 'optional' ? 'How many projects? <span class="muted">(optional)</span>' : 'How many projects?') + '</div>' + lines + '</div>' : '') +
      (sel.length ? '<div class="cert-box"><div class="mod-lines-h"><b>SAP certification</b> <span class="muted">(optional)</span> <span class="muted small">— select the modules you\'re certified in</span></div><div class="chip-wrap">' + certChips + '</div></div>' : '') +
      '</div>';
  }).join('');
  const emptyCard = order.length ? '' :
    '<div class="prod-card prod-empty"><div class="req-card-h"><label class="field prod-sel"><span class="label">SAP product</span><select class="input" data-prod-sel data-target="' + target + '" data-pid="">' +
    '<option value="">Choose your SAP product…</option>' + APP.opt(CATALOG.products.map(p => [p.id, p.name]), '') + '</select></label></div>' +
    '<p class="muted small prod-empty-h">Pick a product to see its modules.</p></div>';
  return '<div class="prod-cards">' + cards + emptyCard + '</div>' +
    (unused.length && (nMods || (leadT && order.length)) ? '<button type="button" class="prod-add-card" data-action="prod-add" data-target="' + target + '"><span class="pa-ico">' + APP.icon('plus', 18) + '</span><span class="pa-t"><b>Add another SAP product</b><small>e.g. BTP, SuccessFactors, Ariba</small></span></button>' : '') +
    (nMods ? '<p class="muted small prod-count">' + nMods + ' module' + (nMods === 1 ? '' : 's') + ' across ' + order.length + ' product' + (order.length === 1 ? '' : 's') + '</p>' : '');
};
/* Products only (Basis, Project / Delivery Manager, Junior): tick the SAP products you work with — no modules, no counts. */
APP.productChipsHtml = function (target, skills) {
  skills = skills || [];
  const on = (pid) => skills.some(k => k.productId === pid && k.moduleId);
  const chips = CATALOG.products.map(p =>
    '<button type="button" class="chip' + (on(p.id) ? ' chip-on' : '') + '" aria-pressed="' + (on(p.id) ? 'true' : 'false') + '" data-action="prod-chip" data-target="' + target + '" data-pid="' + APP.h(p.id) + '">' + APP.h(p.name) + '</button>'
  ).join('');
  const certs = skills.map((k, i) => ({ k: k, i: i })).filter(x => x.k.moduleId && x.k.productId).map(x =>
    '<div class="skill-row mod-line" data-skill-row="' + x.i + '" data-target="' + target + '"><span class="ml-n">' + APP.h(APP.productShort(x.k.productId)) + (x.k.moduleId !== '*' ? ' · ' + APP.h(APP.moduleShort(APP.skillName(x.k.productId, x.k.moduleId))) : '') + '</span>' +
    '<label class="ml-c"><input type="checkbox" data-skill-field="certified"' + (x.k.certified ? ' checked' : '') + '> <span>SAP-certified</span></label></div>'
  ).join('');
  return '<div class="chip-wrap">' + chips + '</div>' +
    (certs ? '<div class="mod-lines"><div class="mod-lines-h muted small">Are you SAP-certified?</div>' + certs + '</div>' : '');
};
APP.jobPreviewObj = function (d, co) {
  const rows = (d.requires || []).filter(r => r.productId && (r.moduleId || APP.rtProductLevel(d.roleType))).map(r => Object.assign({}, r, { moduleId: r.moduleId || '*' }));
  return Object.assign({}, d, { requires: rows, id: 'preview', companyId: (co && co.id) || (APP.db.session && APP.db.session.companyId), applicants: [], invited: [], postedTs: Date.now(), status: 'open', title: d.title || 'Untitled role' });
};
APP.jobMatchCount = function (d) {
  const job = APP.jobPreviewObj(d);
  if (!job.requires.length) return null;
  let n = 0;
  try {
    for (const c of Object.values(APP.db.consultants)) if (APP.jobVisibleToConsultant(c, job) && APP.matchScore(c, job) >= 50) n++;
  } catch (e) { return null; }
  return n;
};
APP.jobReqSummary = function (d, short) {
  const groups = APP.reqGroups(d);
  if (!groups.length) return short ? '' : '<p class="field-hint req-sum">Pick a product and module to see who matches.</p>';
  const part = function (g) {
    const byP = []; g.forEach(r => { let b = byP.find(x => x.p === r.productId); if (!b) { b = { p: r.productId, r: [] }; byP.push(b); } b.r.push(r); });
    return byP.map(b => {
      const any = b.r.some(r => r.moduleId === '*');
      const mods = any ? 'any module' : b.r.map(r => APP.h(APP.moduleShort(APP.skillName(r.productId, r.moduleId)))).join(' or ');
      const min = Math.max.apply(null, b.r.map(r => +r.minProjects || 0));
      return '<b>' + APP.h(APP.productShort(b.p)) + ' · ' + mods + '</b>' + (min ? ' (' + min + '+ projects)' : '');
    }).join(' or ');
  };
  const txt = groups.map(part).join(' <span class="and-w">and</span> ');
  const n = APP.jobMatchCount(d);
  const cnt = n == null ? '' : n === 0
    ? '<span class="rs-warn">No strong matches yet</span> — try “Any module”, or add an alternative.'
    : '<b>' + n + '</b> professional' + (n === 1 ? '' : 's') + ' on Arnour already look like a good fit (50%+ match).';
  return short
    ? '<p class="muted small">' + cnt + '</p>'
    : '<div class="req-sum">' + APP.icon('spark', 14) + '<div><p>Looking for ' + txt + '</p><p class="muted small">' + cnt + '</p></div></div>';
};
/* Architect / Project Manager roles: a product alone is a valid requirement ("any module") */
APP.jobRowsAnyModule = function (d) {
  if (!d || !APP.rtProductLevel(d.roleType)) return d;
  (d.requires || []).forEach(r => { if (r.productId && !r.moduleId) r.moduleId = '*'; });
  return d;
};
APP.jobStepErrors = function (d, step) {
  const e = {};
  APP.jobRowsAnyModule(d);
  if (step === 1) {
    if (!String(d.title || '').trim()) e.title = 'Add a job title';
    if (!APP.roleTypeById[d.roleType]) e.roleType = 'Choose the type of role — it decides how professionals are ranked';
    if (!d.country) e.country = 'Select the country for this role';
    if (d.applyUrl && String(d.applyUrl).trim() && !APP.safeApplyUrl(d)) e.applyUrl = 'Enter a full link such as https://careers.yourcompany.com/job/123';
    if (APP.SHOW_RATES && d.rateMin && d.rateMax && +d.rateMin > +d.rateMax) e.pay = 'Pay minimum should be lower than the maximum';
  }
  if (step === 2) {
    const rows = d.requires || [];
    if (!rows.some(r => r.productId && r.moduleId)) { e.req = 'Pick a SAP product and a module for at least one requirement'; e.rows = rows.map((r, i) => i); }
    else {
      const half = []; rows.forEach((r, i) => { if ((r.productId && !r.moduleId) || (!r.productId && r.moduleId)) half.push(i); });
      if (half.length) { e.req = 'Finish or remove the requirement with no module selected'; e.rows = half; }
    }
  }
  return e;
};
APP.jobGoStep = function (n) {
  const d = APP.jobNewDraft;
  if (!d || d.editId) return;
  APP.syncFormsToDrafts([]);
  const cur = APP.state.jobStep || 1;
  n = Math.min(3, Math.max(1, n));
  if (n > cur) {
    for (let s = cur; s < n; s++) {
      const er = APP.jobStepErrors(d, s);
      if (Object.keys(er).length) { APP.state.jobStep = s; APP.state.jobErr = er; APP.render(); APP.jobFocusError(); return false; }
    }
  }
  APP.state.jobErr = null; APP.state.jobStep = n;
  APP.render();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  const h = document.querySelector('.job-wizard .jw-step:not([hidden]) input:not([type=hidden]), .job-wizard .jw-step:not([hidden]) select');
  if (h && n < 3) h.focus({ preventScroll: true });
  return true;
};
APP.jobFocusError = function () {
  const el = document.querySelector('.job-wizard [aria-invalid="true"], .job-wizard .has-err select, .job-wizard select[name="country"]');
  const first = document.querySelector('.job-wizard .field-error');
  if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'instant' });
  if (el && APP.state.jobErr) { if (APP.state.jobErr.title) { const t = document.querySelector('.job-wizard [name="title"]'); if (t) t.focus({ preventScroll: true }); } else if (APP.state.jobErr.country) { const c = document.querySelector('.job-wizard [name="country"]'); if (c) c.focus({ preventScroll: true }); } else if (el.focus) el.focus({ preventScroll: true }); }
};
APP.jobSummaryRefresh = function () {
  const d = APP.jobNewDraft; if (!d) return;
  const a = document.getElementById('req-summary'); if (a) a.innerHTML = APP.jobReqSummary(d);
  const b = document.getElementById('req-summary-2'); if (b) b.innerHTML = APP.jobReqSummary(d, true);
};

/* ---------------------------- routing ---------------------------- */

APP.views = {};

APP.routes = [
  { re: /^#?\/?$/, view: 'landing', auth: null },
  { re: /^#\/home$/, view: 'landing', auth: null },
  { re: /^#\/login$/, view: 'login', auth: null },
  { re: /^#\/register(?:\/([ce]))?$/, view: 'register', auth: null },
  { re: /^#\/forgot$/, view: 'forgot', auth: null },
  { re: /^#\/reset$/, view: 'reset', auth: null },
  { re: /^#\/check-email$/, view: 'check-email', auth: null },
  { re: /^#\/account$/, view: 'account', auth: null },
  { re: /^#\/suspended$/, view: 'suspended', auth: null },
  { re: /^#\/admin(?:\/([a-z]+)(?:\/(.+))?)?$/, view: 'admin', auth: null },
  { re: /^#\/terms$/, view: 'terms', auth: null },
  { re: /^#\/privacy$/, view: 'privacy', auth: null },
  { re: /^#\/onboard$/, view: 'wiz-c', auth: null },
  { re: /^#\/onboard-e$/, view: 'wiz-e', auth: null },
  { re: /^#\/community$/, view: 'community', auth: null },
  { re: /^#\/community\/q\/([A-Za-z0-9-]+)$/, view: 'community-q', auth: null },
  { re: /^#\/community\/a\/([A-Za-z0-9-]+)$/, view: 'community-a', auth: null },
  { re: /^#\/community\/ask$/, view: 'community-ask', auth: null },
  { re: /^#\/community\/share$/, view: 'community-share', auth: null },
  { re: /^#\/jobs$/, view: 'jobs', auth: null },
  { re: /^#\/job\/([A-Za-z0-9-]+)$/, view: 'job-detail', auth: null },
  { re: /^#\/talent\/([A-Za-z0-9-]+)$/, view: 'talent-public', auth: null },
  { re: /^#\/company\/([A-Za-z0-9-]+)$/, view: 'company-public', auth: null },
  { re: /^#\/c\/dashboard$/, view: 'c-dash', auth: 'consultant' },
  { re: /^#\/c\/profile$/, view: 'c-profile', auth: 'consultant' },
  { re: /^#\/c\/jobs$/, view: 'c-jobs', auth: 'consultant' },
  { re: /^#\/c\/saved$/, view: 'c-saved', auth: 'consultant' },
  { re: /^#\/c\/applied$/, view: 'c-saved', auth: 'consultant' },
  { re: /^#\/c\/intros$/, view: 'c-saved', auth: 'consultant' },
  { re: /^#\/c\/preview$/, view: 'c-preview', auth: 'consultant' },
  { re: /^#\/e\/intros$/, view: 'e-jobs', auth: 'employer' },
  { re: /^#\/c\/messages$/, view: 'c-msgs', auth: 'consultant' },
  { re: /^#\/c\/messages\/(.+)$/, view: 'c-msg', auth: 'consultant' },
  { re: /^#\/e\/dashboard$/, view: 'e-dash', auth: 'employer' },
  { re: /^#\/e\/company$/, view: 'e-company', auth: 'employer' },
  { re: /^#\/e\/talent$/, view: 'e-talent', auth: 'employer' },
  { re: /^#\/e\/talent\/(.+)$/, view: 'e-talent-detail', auth: 'employer' },
  { re: /^#\/e\/jobs$/, view: 'e-jobs', auth: 'employer' },
  { re: /^#\/e\/jobs\/new$/, view: 'e-job-new', auth: 'employer' },
  { re: /^#\/e\/jobs\/([^/]+)\/edit$/, view: 'e-job-edit', auth: 'employer' },
  { re: /^#\/e\/jobs\/(.+)$/, view: 'e-job-detail', auth: 'employer' },
  { re: /^#\/e\/messages$/, view: 'e-msgs', auth: 'employer' },
  { re: /^#\/e\/messages\/(.+)$/, view: 'e-msg', auth: 'employer' }
];

APP.parseRoute = function () {
  const hash = location.hash || '#/';
  for (const r of APP.routes) {
    const m = hash.match(r.re);
    if (m) return { view: r.view, auth: r.auth, p: m.slice(1) };
  }
  return { view: 'notfound', auth: null, p: [] };
};

APP.go = function (path) {
  const target = path.startsWith('#') ? path : '#' + path;
  if (location.hash === target) APP.render();
  else location.hash = target;
};

/* ---------------------------- DOM → draft sync ----------------------------
   Typed values live in the DOM until written back. Any action that triggers a
   re-render (chips, buttons, navigation) must first harvest the open forms into
   their drafts, or whatever the user typed is silently lost on the rebuild. */

APP.formDraftTarget = function (f) {
  const name = f.dataset.form;
  switch (name) {
    case 'wiz-c': return APP.wizC ? APP.wizC.data : null;
    case 'wiz-e': return APP.wizE ? APP.wizE.data : null;
    case 'profile-edit':
    case 'company-edit': return APP.profileDraft;
    case 'job-post': return APP.jobNewDraft;
    case 'talent-search':
    case 'talent-q': return APP.state.talentFilters;
    case 'job-filters':
    case 'job-q': return APP.state.jobFilters;
    case 'community-filters': return APP.state.communityFilters;
    case 'nav-search':
      return (f.dataset.target || '').indexOf('jobs') >= 0 ? APP.state.jobFilters : APP.state.talentFilters;
    case 'chat':
      if (f.dataset.convId) {
        if (!APP.chatDraft[f.dataset.convId]) APP.chatDraft[f.dataset.convId] = {};
        return APP.chatDraft[f.dataset.convId];
      }
      return null;
    case 'community-ask': return APP.commAskDraft;
    case 'community-share': return APP.commShareDraft;
    case 'community-comment':
      if (f.dataset.aid) {
        if (!APP.commCmtDraft[f.dataset.aid]) APP.commCmtDraft[f.dataset.aid] = {};
        return APP.commCmtDraft[f.dataset.aid];
      }
      return null;
    case 'community-answer':
      if (f.dataset.qid) {
        if (!APP.commAnsDraft[f.dataset.qid]) APP.commAnsDraft[f.dataset.qid] = {};
        return APP.commAnsDraft[f.dataset.qid];
      }
      return null;
    default: return null;
  }
};

APP.syncFormsToDrafts = function (skip) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const app = document.getElementById('app');
  if (!app) return;
  const forms = app.querySelectorAll('form[data-form]');
  Array.prototype.forEach.call(forms, function (f) {
    if (skip && skip.indexOf(f.dataset.form) !== -1) return;
    const target = APP.formDraftTarget(f);
    if (!target) return;
    /* named fields (file inputs carry no name and are set in their change handler) */
    const els = f.querySelectorAll('input[name], select[name], textarea[name]');
    Array.prototype.forEach.call(els, function (el) {
      const n = el.name;
      if (!n || el.type === 'file') return;
      if (el.type === 'range' && el.hasAttribute('data-wizard-years')) return; /* live-synced to the hidden yearsExp input */
      if (el.type === 'hidden' && el.hasAttribute('data-chip-echo')) return; /* chip-driven: the click already updated the draft; re-harvesting the stale DOM value would silently revert the selection */
      if (el.type === 'checkbox') { target[n] = el.checked; return; }
      if (el.type === 'radio') { if (el.checked) target[n] = el.value; return; }
      if (el.type === 'number' || el.type === 'range') { target[n] = el.value === '' ? '' : Number(el.value); return; }
      target[n] = el.value; /* text, hidden, textarea, select, … */
    });
    /* skill rows (product / module / count) — resolve the array key per scope */
    const key = APP.scopeSkillKey(target);
    if (!Array.isArray(target[key])) return;
    const rows = f.querySelectorAll('.skill-row');
    Array.prototype.forEach.call(rows, function (row) {
      const k = target[key][+row.dataset.skillRow];
      if (!k) return;
      const pid = row.querySelector('[data-skill-field="productId"]');
      const mid = row.querySelector('[data-skill-field="moduleId"]');
      const num = row.querySelector('input[data-skill-field="projects"], input[data-skill-field="minProjects"]');
      if (pid) k.productId = pid.value;
      if (mid) k.moduleId = mid.value;
      if (num) {
        const v = num.value === '' ? 0 : Number(num.value);
        if (num.dataset.skillField === 'projects') k.projects = v; else k.minProjects = v;
      }
      const cert = row.querySelector('input[data-skill-field="certified"]');
      if (cert) k.certified = cert.checked;
      const orp = row.querySelector('input[data-skill-field="orPrev"]');
      if (orp) k.orPrev = orp.checked;
    });
    if (key === 'requires') {
      Array.prototype.forEach.call(f.querySelectorAll('input[data-req-min]'), function (el) {
        const c = APP.jobReqCards(target.requires).find(x => x.start === +el.dataset.idx);
        if (c) { const v = el.value === '' ? 0 : Number(el.value); c.rows.forEach(r => { r.minProjects = v; }); }
      });
    }
  });
};

APP.pageTitle = function (view) {
  const T = { landing: 'Arnour — The SAP Talent Network', login: 'Sign in', register: 'Join Arnour', forgot: 'Reset your password', reset: 'Choose a new password', 'check-email': 'Check your email', account: 'Account',
    community: 'Community', 'community-q': 'Question', 'community-a': 'Article', 'community-ask': 'Ask a question', 'community-share': 'Share an article', jobs: 'Open SAP roles', 'job-detail': 'Role', 'talent-public': 'Professional profile', 'company-public': 'Company',
    'wiz-c': 'Create your profile', 'wiz-e': 'Create your company profile', 'c-dash': 'Home', 'c-profile': 'My profile', 'c-jobs': 'Jobs', 'c-saved': 'My jobs', 'c-preview': 'Profile preview', 'c-msgs': 'Messages', 'c-msg': 'Messages',
    'e-dash': 'Home', 'e-company': 'Company profile', 'e-talent': 'Talent', 'e-talent-detail': 'Talent', 'e-jobs': 'My roles', 'e-job-new': 'Post a job', 'e-job-edit': 'Edit role', 'e-job-detail': 'Role', 'e-msgs': 'Messages', 'e-msg': 'Messages', terms: 'Terms of Use', privacy: 'Privacy Policy', admin: 'Admin', suspended: 'Account suspended' };
  const t = T[view];
  return !t ? 'Arnour' : (view === 'landing' ? t : t + ' — Arnour');
};
APP.render = function () {
  const skip = APP._formSyncSkip;
  APP._formSyncSkip = [];
  APP.syncFormsToDrafts(skip);
  const route = APP.parseRoute();
  /* redirects replace the current history entry, so the Back button never bounces */
  const redirect = (h) => { try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { location.hash = h; } APP.render(); };
  const home = (ss) => ss.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard';
  if (APP.LIVE && APP.backend && APP.backend.guard) {
    const gh = APP.backend.guard(route);
    if (gh && gh !== location.hash) { redirect(gh); return; }
  }
  /* a signed-in person opening the bare address lands on their own page; #/home is the public page */
  if (route.view === 'landing' && !/^#\/home/.test(location.hash)) {
    const ls = APP.db.session;
    if (ls) { redirect(home(ls)); return; }
    if (APP.LIVE && APP.backend && APP.backend.user && APP.backend.isAdmin) { redirect('#/admin'); return; }
  }
  if (route.auth) {
    const s = APP.db.session;
    if (!s) {
      APP.state.afterAuth = location.hash; /* come back here after signing in */
      redirect('#/login');
      return;
    }
    if (s.role !== route.auth) {
      redirect(home(s));
      setTimeout(() => APP.toast(route.auth === 'employer' ? 'That page is for companies. Here is your dashboard.' : 'That page is for professionals. Here is your dashboard.'), 300);
      return;
    }
  }
  document.title = APP.pageTitle(route.view);
  /* one-time markers for discoverability: visiting the community retires the nav "new" dot */
  if (location.hash.indexOf('#/community') === 0 && APP.db.session) {
    const su = APP.currentUser();
    if (su && !su.communitySeen) { su.communitySeen = true; APP.save(); }
  }
  /* header counts reset when the user opens the page they point to */
  if (APP.db.session) {
    const hu = APP.currentUser(), hh = location.hash;
    if (hu && APP.db.session.role === 'consultant' && hh.indexOf('#/c/jobs') === 0) { hu.jobsSeenTs = Date.now(); APP.save(); }
    const hm = hh.match(/^#\/e\/jobs\/(?!new)([^/?]+)/);
    if (hu && APP.db.session.role === 'employer' && hm && APP.db.jobs[hm[1]]) {
      hu.seenApplicants = hu.seenApplicants || {};
      hu.seenApplicants[hm[1]] = (APP.db.jobs[hm[1]].applicants || []).length; APP.save();
    }
  }
  const view = APP.views[route.view] || APP.views.landing;
  const body = view({ p: route.p });
  const noChrome = ['landing', 'login', 'register', 'forgot', 'reset', 'check-email', 'wiz-c', 'wiz-e', 'notfound', 'admin', 'suspended'];
  const bare = route.view === 'admin';
  const chrome = bare ? '' : route.auth || (APP.db.session && (noChrome.indexOf(route.view) < 0 || route.view === 'notfound')) ? APP.navbar() : APP.pubHeader();
  const footer = route.auth || bare ? '' : APP.footerHtml();
  const keepY = bare && APP._lastRoute === location.hash.split('?')[0] ? window.scrollY : 0;
  document.getElementById('app').innerHTML =
    chrome + '<main class="main" id="main">' + body + '</main>' + footer;
  APP.a11yPass();
  window.scrollTo(0, keepY);
  { /* fade the page in on navigation only — not on in-page re-renders (chips, sort) */
    const key = location.hash.split('?')[0];
    const m = document.getElementById('main');
    if (m && key !== APP._lastRoute) m.classList.add('page-in');
    APP._lastRoute = key;
  }
  if (APP._skel) { APP._skel = false; APP.showSkeleton('#tf-results', 3, 160); }
  if (route.view === 'c-msg' || route.view === 'e-msg') {
    const sc = document.querySelector('.chat-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }
  document.querySelectorAll('.menu.open, .notif-panel.open').forEach(el => el.classList.remove('open'));
};

/* Accessibility pass: runs after every render. Adds names to icon-only controls and roles to dialogs. */
APP.a11yPass = function () {
  const root = document.getElementById('app');
  if (!root) return;
  root.querySelectorAll('button[title], a[title]').forEach(el => {
    if (!el.hasAttribute('aria-label') && !el.textContent.trim().replace(/\d+/g, '')) el.setAttribute('aria-label', el.getAttribute('title'));
  });
  root.querySelectorAll('.brand-logo').forEach(el => { if (el.textContent.trim().length === 1) el.setAttribute('aria-hidden', 'true'); });
  root.querySelectorAll('.modal').forEach(el => {
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    const h = el.querySelector('h1, h2, h3');
    if (h) { if (!h.id) h.id = 'modal-title'; el.setAttribute('aria-labelledby', h.id); }
  });
  const t = document.getElementById('toasts');
  if (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
  root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea').forEach(el => {
    if (el.getAttribute('aria-label') || el.closest('label') || (el.id && root.querySelector('label[for="' + el.id + '"]'))) return;
    let name = el.getAttribute('placeholder') || '';
    if (!name && el.tagName === 'SELECT' && el.options.length) name = el.options[0].text.replace(/…$/, '') || el.name;
    el.setAttribute('aria-label', name || el.name || 'Field');
  });
  root.querySelectorAll('select[name=module]').forEach(el => { if (!el.getAttribute('aria-label') || el.getAttribute('aria-label') === 'Module') el.setAttribute('aria-label', 'SAP module'); });
  root.querySelectorAll('.nav-link').forEach(el => { if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.trim()); });
  const n = root.querySelector('.nav'); if (n) n.setAttribute('role', 'navigation');
};

APP.rateHtml = function (c) {
  return c && +c.dailyRate > 0
    ? APP.h(c.currency || 'USD') + ' ' + Number(c.dailyRate).toLocaleString() + '<small>' + APP.periodSuffix(c.ratePeriod) + '</small>'
    : 'Rate on request';
};

APP.footerHtml = function () {
  return '<footer class="site-footer"><div class="site-footer-inner">' +
    '<span class="brand sm"><span class="brand-logo" aria-hidden="true">A</span>Arnour</span>' +
    '<nav aria-label="Footer">' + (APP.db.session ? '<a href="#/home">Home page</a>' : '') + '<a href="#/jobs">Open roles</a><a href="#/community">Community</a><a href="#/login">Sign in</a><a href="#/register">Join</a><a href="mailto:contact@arnour.com">Contact</a>' + (APP.LIVE ? '<a href="#" data-action="fb-open">Report a problem</a>' : '') + '</nav>' +
    '<small>Prototype for customer validation — all companies, profiles and roles shown are sample data.</small>' +
    '</div></footer>';
};

/* Re-render after an in-page interaction (chip, add/remove row) without jumping to the top or dropping keyboard focus */
APP.renderKeep = function (focusSel) {
  const y = window.scrollY;
  APP.render();
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  if (focusSel) { const el = document.querySelector(focusSel); if (el) el.focus({ preventScroll: true }); }
};

APP.start = function () {
  APP.load();
  window.addEventListener('hashchange', () => { APP.closeMatchDrawer(true); APP.closeDialog(true); APP.render(); });
  APP.bindGlobal();
  APP.render();
};

/* ---------------------------- global event handling ---------------------------- */

APP.bindGlobal = function () {
  /* remember which optional sections of a form the user opened (toggle does not bubble, so capture it) */
  document.addEventListener('toggle', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.det) { APP.state.jobDet = APP.state.jobDet || {}; APP.state.jobDet[t.dataset.det] = t.open; }
  }, true);
  document.addEventListener('click', (e) => {
    APP.retirePointer();
    if (e.target.closest('.rt-list')) { const l = document.querySelector('.rt-list.rt-error'); if (l) l.classList.remove('rt-error'); const er = document.getElementById('rt-err'); if (er) er.remove(); }
    const t = e.target.closest('[data-action]');
    if (t) APP.onClick(t, e);
    /* close menus on outside click */
    if (!e.target.closest('.nav-user') && !e.target.closest('.notif-panel') && !e.target.closest('[data-action="toggle-notif"]')) {
      document.querySelectorAll('.menu.open, .notif-panel.open').forEach(el => el.classList.remove('open'));
    }
  });

  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (el && el.matches && el.matches('details[data-spec-key]')) (APP.state.specOpen || (APP.state.specOpen = {}))[el.dataset.specKey] = el.open;
  }, true);

  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (!(f instanceof HTMLFormElement) || !f.dataset.form) return;
    e.preventDefault();
    APP.onSubmit(f);
  });

  const clearJobErr = (e) => {
    const t = e.target;
    if (!t || !t.name || !t.closest || !t.closest('.job-wizard') || !APP.state.jobErr) return;
    const k = t.name === 'rateMin' || t.name === 'rateMax' ? 'pay' : t.name;
    const er = document.querySelector('.job-wizard .field-error[data-for="' + k + '"]');
    if (er) er.remove();
    t.removeAttribute('aria-invalid');
    delete APP.state.jobErr[k];
  };
  document.addEventListener('input', function (e) {
    const q = e.target && e.target.getAttribute && e.target.getAttribute('data-mod-q');
    if (q == null) return;
    APP.state.modQ = APP.state.modQ || {};
    APP.state.modQ[q] = e.target.value;
    const v = e.target.value.toLowerCase();
    Array.prototype.forEach.call(e.target.closest('.mod-wrap').querySelectorAll('.mchip'), function (c) {
      const on = c.classList.contains('on');
      c.hidden = !!v && !on && ((c.textContent + ' ' + (c.title || '')).toLowerCase().indexOf(v) === -1);
    });
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-prod-sel')) {
      const scope = APP.getScope(t.dataset.target);
      if (!scope) return;
      const key = APP.scopeSkillKey(scope);
      const rows = scope[key];
      if (!Array.isArray(rows)) return;
      APP.skillMutate(t, function () {
        const np = CAT_INDEX.byId[t.value]; const ids = np ? np.modules.map(m => m.id) : [];
        const fix = function (r) { r.productId = t.value; if (r.moduleId && r.moduleId !== '*' && ids.indexOf(r.moduleId) === -1) r.moduleId = ''; };
        if (key === 'requires') {
          const c = APP.jobReqCards(rows).find(x => x.start === +t.dataset.idx);
          if (!c) return;
          c.rows.forEach(fix);
          /* keep one row per distinct module; blank rows collapse into one placeholder */
          const seen = {}; let keepBlank = false;
          for (let i = c.end; i >= c.start; i--) {
            const r = rows[i];
            if (!r.moduleId) { if (keepBlank) { rows.splice(i, 1); } keepBlank = true; }
            else if (seen[r.moduleId]) rows.splice(i, 1); else seen[r.moduleId] = true;
          }
          const left = APP.jobReqCards(rows).find(x => x.cid === c.cid);
          if (left && left.rows.length > 1) { const blank = left.rows.findIndex(r => !r.moduleId); if (blank !== -1) rows.splice(left.start + blank, 1); }
          APP.jobReqNormalize(rows);
          if (rows[0]) rows[0].orPrev = false;
          APP.jobReqCards(rows).forEach(cc => { if (cc.rows.length > 1) cc.rows.forEach((r, j) => { if (j > 0) r.orPrev = true; }); });
        } else if (t.dataset.pid === '') {
          if (t.value && !rows.some(r => r.productId === t.value)) rows.push({ productId: t.value, moduleId: '', projects: 0, certified: false });
        } else {
          rows.forEach(r => { if (r.productId === t.dataset.pid) fix(r); });
          const seen = {}; let blank = false;
          for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i]; if (r.productId !== t.value) continue;
            if (!r.moduleId) { if (blank) rows.splice(i, 1); blank = true; }
            else if (seen[r.moduleId]) rows.splice(i, 1); else seen[r.moduleId] = true;
          }
          const mine = rows.filter(r => r.productId === t.value);
          if (mine.length > 1) { const bi = rows.findIndex(r => r.productId === t.value && !r.moduleId); if (bi !== -1) rows.splice(bi, 1); }
        }
      });
      return;
    }
    if (t.hasAttribute('data-req-min')) {
      const dr = APP.jobNewDraft;
      if (!dr || !dr.requires) return;
      const c = APP.jobReqCards(dr.requires).find(x => x.start === +t.dataset.idx);
      if (c) { const v = +t.value || 0; c.rows.forEach(r => { r.minProjects = v; }); APP.jobSummaryRefresh(); }
    }
  });
  const wizLive = (e) => {
    const f = e.target.closest && e.target.closest('form[data-form="wiz-c"][data-step="1"]');
    if (!f || !APP.wizC) return;
    const v = (n) => { const x = f.elements[n]; return x ? x.value : ''; };
    const d = Object.assign({}, APP.wizC.data, { firstName: v('firstName'), lastName: v('lastName'), headline: v('headline'), nationality: v('nationality'), country: v('country'), gender: v('gender') || APP.wizC.data.gender });
    const dn = APP.wizSecDone(d);
    Object.keys(dn).forEach(k => {
      const sec = document.querySelector('.wiz-sec[data-sec="' + k + '"]'); if (sec) sec.classList.toggle('done', dn[k]);
    });
  };
  document.addEventListener('input', wizLive);
  document.addEventListener('change', wizLive);
  document.addEventListener('input', clearJobErr);
  document.addEventListener('change', clearJobErr);

  document.addEventListener('change', (e) => {
    const t = e.target;
    const sf = t.getAttribute && t.getAttribute('data-skill-field');
    if (sf && t.tagName === 'SELECT') {
      const row = t.closest('[data-skill-row]');
      if (!row) return;
      const idx = +row.dataset.skillRow;
      const scope = APP.getScope(row.dataset.target);
      if (!scope) return;
      const arr = scope[APP.scopeSkillKey(scope)];
      if (!arr) return;
      const k = arr[idx];
      if (!k) return;
      if (sf === 'productId') {
        k.productId = t.value;
        /* Keep the module if the new product also has a module with the same id — only reset when it truly doesn't exist there. */
        const np = CAT_INDEX.byId[t.value];
        const jobRow = !!row.querySelector('[data-skill-field="minProjects"]');
        if (!(k.moduleId === '*' && jobRow) && !(np && k.moduleId && np.modules.some((m) => m.id === k.moduleId))) k.moduleId = '';
        row.querySelector('[data-skill-field="moduleId"]').innerHTML = APP.moduleOptions(t.value, k.moduleId, jobRow);
      } else if (sf === 'moduleId') {
        k.moduleId = t.value;
      }
      if (row.dataset.target === 'jobNew') { APP.jobSummaryRefresh(); const er = document.querySelector('.job-wizard .field-error[data-for="req"]'); if (er) er.remove(); const rl = document.querySelector('.job-wizard .req-list'); if (rl) rl.classList.remove('has-err'); row.classList.remove('has-err'); if (APP.state.jobErr) { delete APP.state.jobErr.req; delete APP.state.jobErr.rows; } }
      return;
    }
    if (t.getAttribute && t.getAttribute('data-skill-field') === 'projects') {
      const row = t.closest('[data-skill-row]');
      if (!row) return;
      const scope = APP.getScope(row.dataset.target);
      const arr = scope && scope[APP.scopeSkillKey(scope)];
      const k = arr && arr[+row.dataset.skillRow];
      if (k) k.projects = +t.value || 0;
      return;
    }
    if (t.getAttribute && t.getAttribute('data-skill-field') === 'orPrev') {
      const row = t.closest('[data-skill-row]');
      if (!row) return;
      const scope = APP.getScope(row.dataset.target);
      const arr = scope && scope[APP.scopeSkillKey(scope)];
      const k = arr && arr[+row.dataset.skillRow];
      if (k) k.orPrev = t.checked;
      return;
    }
    if (t.getAttribute && t.getAttribute('data-skill-field') === 'minProjects') {
      const row = t.closest('[data-skill-row]');
      if (!row) return;
      const scope = APP.getScope(row.dataset.target);
      const arr = scope && scope[APP.scopeSkillKey(scope)];
      const k = arr && arr[+row.dataset.skillRow];
      if (k) { k.minProjects = +t.value || 0; if (row.dataset.target === 'jobNew') APP.jobSummaryRefresh(); }
      return;
    }
    /* CV file uploads */
    if (t.getAttribute('data-wiz-cv')) {
      const file = t.files && t.files[0];
      if (file && APP.wizC) {
        if (APP.LIVE) APP.backend.uploadCv(file).then(cv => { if (cv && APP.wizC) { APP.wizC.data.cv = cv; APP._formSyncSkip = []; APP.render(); } });
        else { APP.wizC.data.cv = { name: file.name, size: APP.fmtSize(file.size) }; APP.render(); }
      }
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-profile-cv')) {
      const file = t.files && t.files[0];
      if (file && APP.profileDraft) {
        if (APP.LIVE) APP.backend.uploadCv(file).then(cv => { if (cv && APP.profileDraft) { APP.profileDraft.cv = cv; APP.render(); } });
        else { APP.profileDraft.cv = { name: file.name, size: APP.fmtSize(file.size) }; APP.render(); }
      }
      return;
    }

    /* country → city cascade in wizard */
    /* country → city cascade (select for professionals; suggestions + free text for company / job) */
    if (t.name === 'country' && t.form && t.form.querySelector('[name="city"]')) {
      const fm = t.form.dataset.form || '';
      const cityEl = t.form.querySelector('[name="city"]');
      const cities = ((APP.countriesById[t.value] || {}).cities || []);
      if (cityEl.tagName === 'SELECT') {
        cityEl.innerHTML = APP.cityOptions(t.value, '');
      } else {
        if (cities.indexOf(cityEl.value) === -1) cityEl.value = '';
        const dl = t.form.querySelector('#city-list');
        if (dl) dl.innerHTML = cities.map(x => '<option value="' + APP.h(x) + '"></option>').join('');
        cityEl.placeholder = cities[0] ? 'e.g. ' + cities[0] : 'City';
      }
      if (APP.wizC && t.dataset.wizard === 'c') APP.wizC.data.city = '';
      if (APP.wizE && fm.indexOf('wiz') === 0 && APP.wizE.data) APP.wizE.data.city = '';
      if (APP.jobNewDraft && fm === 'job-post') APP.jobNewDraft.city = '';
    }
    /* product → module cascade in talent search filters (keep module if it exists in the new product) */
    if (t.name === 'product' && t.form && t.form.dataset.form === 'talent-search') {
      APP.state.talentFilters.product = t.value;
      const np = CAT_INDEX.byId[t.value];
      if (!(np && APP.state.talentFilters.module && np.modules.some((m) => m.id === APP.state.talentFilters.module))) APP.state.talentFilters.module = '';
      const modSel = t.form.querySelector('[name="module"]');
      if (modSel) modSel.innerHTML = APP.moduleOptions(t.value || null, APP.state.talentFilters.module);
    }
    /* faceted search: selects and sliders apply immediately (no Apply button) */
    if (t.form && t.form.dataset.form === 'talent-search' && (t.tagName === 'SELECT' || t.type === 'range')) { APP._tfKeep = '#app [name="' + t.name + '"]'; APP.onSubmit(t.form); return; }
    if (t.form && t.form.dataset.form === 'talent-q' && t.name === 'sort') { APP._tfKeep = '#app [name="sort"]'; APP.onSubmit(t.form); return; }
    /* product → module cascade in consultant job search filters (keep module if it exists in the new product) */
    if (t.name === 'product' && t.form && t.form.dataset.form === 'job-filters') {
      APP.state.jobFilters.product = t.value;
      const np2 = CAT_INDEX.byId[t.value];
      if (!(np2 && APP.state.jobFilters.module && np2.modules.some((m) => m.id === APP.state.jobFilters.module))) APP.state.jobFilters.module = '';
      const modSel2 = t.form.querySelector('[name="module"]');
      if (modSel2) modSel2.innerHTML = APP.moduleOptions(t.value || null, APP.state.jobFilters.module);
    }
    /* job search: selects apply immediately, like the talent search */
    if (t.form && t.form.dataset.form === 'job-filters' && t.tagName === 'SELECT') { APP._tfKeep = '#app [name="' + t.name + '"]'; APP.onSubmit(t.form); return; }
    if (t.form && t.form.dataset.form === 'job-q' && t.name === 'sort') { APP._tfKeep = '#app [name="sort"]'; APP.onSubmit(t.form); return; }
    /* product → module cascade in community feed filters (keep module if it exists in the new product) */
    if (t.name === 'product' && t.form && t.form.dataset.form === 'community-filters') {
      const cf = APP.state.communityFilters;
      cf.product = t.value;
      const npx = CAT_INDEX.byId[t.value];
      if (!(npx && cf.module && npx.modules.some((m) => m.id === cf.module))) cf.module = '';
      const modSelC = t.form.querySelector('[name="module"]');
      if (modSelC) modSelC.innerHTML = APP.moduleOptions(t.value || null, cf.module);
    }
    /* product → module cascade in community ask/share forms (keep-if-valid; no re-render so typed fields survive) */
    if (t.name === 'product' && t.form && (t.form.dataset.form === 'community-ask' || t.form.dataset.form === 'community-share')) {
      const modSelD = t.form.querySelector('[name="module"]');
      if (modSelD) {
        const selOpt = modSelD.querySelector('option:checked');
        let keep = selOpt ? selOpt.value : '';
        const npx2 = CAT_INDEX.byId[t.value];
        if (!(npx2 && keep && npx2.modules.some((m) => m.id === keep))) keep = '';
        modSelD.innerHTML = APP.moduleOptions(t.value || null, keep);
      }
    }
    /* employment type → duration on the job form: Full-time locks to Permanent; others pick months (no re-render — typed fields survive) */
    if (t.name === 'employmentType' && t.form && t.form.dataset.form === 'job-post') {
      const durSel = t.form.querySelector('[name="duration"]');
      if (durSel) {
        const isFT = t.value === 'Full-time';
        const opts = isFT ? ['Permanent'] : APP.durations.filter(x => x !== 'Permanent');
        const cur = durSel.value;
        const val = opts.indexOf(cur) !== -1 ? cur : (isFT ? 'Permanent' : '6 months');
        durSel.innerHTML = APP.opt(opts.map(x => [x, x]), val);
        if (APP.jobNewDraft) APP.jobNewDraft.duration = val;
      }
      /* Full-time roles are usually quoted per month, contracts per day */
      const perSel = t.form.querySelector('[name="ratePeriod"]');
      if (perSel) { perSel.value = t.value === 'Full-time' ? 'month' : 'day'; if (APP.jobNewDraft) APP.jobNewDraft.ratePeriod = perSel.value; }
    }
  });

  /* jobs filters apply as soon as a dropdown changes (registered after the main change handler so the product → module cascade has already run) */
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.tagName === 'SELECT' && t.form && t.form.dataset.form === 'job-filters') t.form.requestSubmit();
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('input[data-slider-out]')) {
      const row = t.closest('.range-row');
      const out = row ? row.querySelector('output') : null;
      if (out) out.textContent = t.value + (t.getAttribute('data-suffix') || '');
    }
    /* wizard years sync */
    if (t.matches('input[data-wizard-years]')) {
      const num = t.form ? t.form.querySelector('[name="yearsExp"]') : null;
      if (num) num.value = t.value;
    }
  });
};

APP.retirePointer = function () {
  const p = document.getElementById('nav-pointer');
  if (!p) return;
  p.remove();
  const u = APP.db && APP.db.session ? APP.currentUser() : null;
  if (u && !u.pointerGone) { u.pointerGone = true; APP.save(); }
};
APP.onClick = function (el, e) {
  const a = el.dataset.action;
  const d = el.dataset;
  switch (a) {
    case 'go':
      APP.go(d.href);
      break;

    case 'match-drawer':
      APP.openMatchDrawer(d.cid, d.jid);
      break;

    case 'close-drawer':
      APP.closeMatchDrawer();
      break;

    case 'share':
      APP.doShare(d.channel, { title: d.shareTitle || '', text: d.shareText || '', url: d.shareUrl || location.href, tags: d.shareTags || '' }, el);
      break;

    case 'login': {
      APP.login(d.role, d.id);
      { const back = (d.role === 'consultant' && APP.state.afterAuth) || ''; APP.state.afterAuth = ''; APP.go(back || (d.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard')); }
      break;
    }

    case 'sign-out':
      APP.logout();
      break;

    case 'reset-demo':
      APP.resetDb();
      APP.go('#/');
      APP.toast('Demo data reset');
      break;

    case 'gs-dismiss': {
      const u = APP.db.session ? APP.currentUser() : null;
      if (u) { u.getStartedDismissed = true; APP.save(); }
      APP.render();
      break;
    }

    case 'comm-open-tab': {
      e && e.preventDefault && e.preventDefault();
      APP.state.communityFilters = { type: 'open', product: '', module: '', topic: '', q: '', sort: 'active' };
      APP.go('#/community');
      APP.render();
      break;
    }

    case 'toggle-menu': {
      const m = document.getElementById('user-menu');
      if (m) m.classList.toggle('open');
      break;
    }

    case 'toggle-notif': {
      const p = document.getElementById('notif-panel');
      if (p) p.classList.toggle('open');
      break;
    }

    case 'notif-all': {
      const k = APP.userKey();
      (APP.db.notifications[k] || []).forEach(n => n.read = true);
      APP.save();
      APP.render();
      break;
    }

    case 'notif-open': {
      const k = APP.userKey();
      const n = k ? (APP.db.notifications[k] || []).find(x => x.id === d.nid) : null;
      if (n) {
        if (!n.read) { n.read = true; APP.save(); }
        if (d.href === '#/community/open') { APP.state.communityFilters = { type: 'open', product: '', module: '', topic: '', q: '', sort: 'active' }; APP.go('#/community'); APP.render(); }
        else if (d.href) APP.go(d.href);
      }
      break;
    }

    case 'chip': {
      const scope = APP.getScope(d.scope);
      if (!scope) break;
      const grp = scope[d.group];
      if (d.scope === 'talentFilters') APP._skel = true;
      if (d.single) {
        scope[d.group] = (scope[d.group] === d.value) ? '' : d.value;
        APP.renderKeep('[data-action="chip"][data-scope="' + d.scope + '"][data-group="' + d.group + '"][data-value="' + String(d.value).replace(/"/g, '\\"') + '"]');
      } else if (Array.isArray(grp)) {
        const i = grp.indexOf(d.value);
        if (i >= 0) grp.splice(i, 1); else grp.push(d.value);
        APP.renderKeep('[data-action="chip"][data-scope="' + d.scope + '"][data-group="' + d.group + '"][data-value="' + String(d.value).replace(/"/g, '\\"') + '"]');
      }
      break;
    }

    case 'rt-toggle': {
      const sc = APP.getScope(d.scope);
      if (!sc) break;
      let l = APP.rtList(sc);
      const i = l.indexOf(d.value);
      if (d.single) l = [d.value];
      else if (i !== -1) l.splice(i, 1);
      else if (d.value === 'junior') l = ['junior'];
      else {
        l = l.filter(x => x !== 'junior');
        if (l.length >= APP.RT_MAX) { APP.toast('You can pick up to ' + APP.RT_MAX + ' role types — untick one first'); break; }
        l.push(d.value);
      }
      APP.rtSet(sc, l);
      if (d.single && d.scope === 'wizC' && APP.wizC) APP.wizC.roleOpen = false;
      if (d.scope === 'wizC' && APP.wizC && APP.wizC.err) { delete APP.wizC.err.role; if (!Object.keys(APP.wizC.err).length) APP.wizC.err = null; }
      APP.renderKeep('[data-action="rt-toggle"][data-scope="' + d.scope + '"][data-value="' + d.value + '"]');
      break;
    }

    case 'role-change': {
      if (APP.wizC) { APP.wizC.roleOpen = true; APP.render(); }
      break;
    }

    case 'rt-primary': {
      const sc = APP.getScope(d.scope);
      if (!sc) break;
      const l = APP.rtList(sc).filter(x => x !== d.value);
      l.unshift(d.value);
      APP.rtSet(sc, l);
      APP.renderKeep('[data-action="rt-toggle"][data-scope="' + d.scope + '"][data-value="' + d.value + '"]');
      break;
    }

    case 'add-skill': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const skey = APP.scopeSkillKey(scope);
      if (!Array.isArray(scope[skey])) scope[skey] = [];
      const last = scope[skey][scope[skey].length - 1] || { productId: 's4onprem', moduleId: '', projects: 0 };
      scope[skey].push({ productId: last.productId || 's4onprem', moduleId: '', projects: 1, minProjects: 0, certified: false, orPrev: false });
      APP.renderKeep();
      break;
    }

    case 'job-step': {
      APP.jobGoStep(+d.step);
      break;
    }

    case 'req-mode': {
      const dr = APP.jobNewDraft;
      if (!dr || !dr.requires || !dr.requires[+d.idx]) break;
      APP.skillMutate(el, function () { dr.requires[+d.idx].orPrev = d.mode === 'or'; });
      break;
    }

    case 'req-rm': {
      const dr = APP.jobNewDraft;
      if (!dr || !dr.requires) break;
      APP.skillMutate(el, function () {
        const cards = APP.jobReqCards(dr.requires); const c = cards.find(x => x.start === +d.idx);
        if (!c || cards.length < 2) return;
        dr.requires.splice(c.start, c.end - c.start + 1);
        APP.jobReqNormalize(dr.requires);
      });
      break;
    }

    case 'mod-toggle': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const key = APP.scopeSkillKey(scope);
      const rows = scope[key];
      if (!Array.isArray(rows)) break;
      APP.skillMutate(el, function () {
        if (key === 'requires') {
          const cards = APP.jobReqCards(rows); const c = cards.find(x => x.start === +d.idx);
          if (!c) return;
          const has = c.rows.findIndex(r => r.moduleId === d.mid);
          if (has !== -1) {
            const at = c.start + has;
            if (c.rows.length === 1) rows[at].moduleId = '';
            else { const gone = rows.splice(at, 1)[0]; if (has === 0) rows[c.start].orPrev = gone.orPrev; }
          } else {
            if (d.mid === '*') { /* "any module" replaces specific ones */
              rows.splice(c.start + 1, c.end - c.start); rows[c.start].moduleId = '*';
            } else {
              const star = c.rows.findIndex(r => r.moduleId === '*');
              if (star !== -1) { rows[c.start + star].moduleId = d.mid; }
              else {
                const ph = c.rows.findIndex(r => !r.moduleId);
                if (ph !== -1) rows[c.start + ph].moduleId = d.mid;
                else rows.splice(c.end + 1, 0, { productId: c.productId, moduleId: d.mid, minProjects: c.min, orPrev: true, cid: c.cid, projects: 0 });
              }
            }
          }
        } else {
          const i = rows.findIndex(r => r.productId === d.pid && r.moduleId === d.mid);
          if (i !== -1) {
            rows.splice(i, 1);
            if (!rows.some(r => r.productId === d.pid)) rows.push({ productId: d.pid, moduleId: '', projects: 0, certified: false });
          } else {
            const ph = rows.findIndex(r => r.productId === d.pid && !r.moduleId);
            if (ph !== -1) { rows[ph].moduleId = d.mid; rows[ph].projects = APP.countsTracked(scope) ? 1 : 0; rows[ph].certified = false; }
            else {
              let last = -1; rows.forEach((r, j) => { if (r.productId === d.pid) last = j; });
              rows.splice(last + 1, 0, { productId: d.pid, moduleId: d.mid, projects: APP.countsTracked(scope) ? 1 : 0, certified: false });
            }
          }
        }
      });
      break;
    }

    case 'prod-add': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const key = APP.scopeSkillKey(scope);
      if (!Array.isArray(scope[key])) scope[key] = [];
      APP.skillMutate(el, function () {
        const used = scope[key].map(r => r.productId);
        const p = CATALOG.products.find(x => used.indexOf(x.id) === -1);
        if (p) scope[key].push({ productId: p.id, moduleId: '', projects: 0, certified: false });
      });
      break;
    }

    case 'cert-toggle': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const rows = scope[APP.scopeSkillKey(scope)];
      if (!Array.isArray(rows)) break;
      APP.skillMutate(el, function () {
        const k = rows.find(r => r.productId === d.pid && r.moduleId === d.mid);
        if (k) k.certified = !k.certified;
      });
      break;
    }

    case 'prod-chip': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const key = APP.scopeSkillKey(scope);
      if (!Array.isArray(scope[key])) scope[key] = [];
      APP.skillMutate(el, function () {
        const rows = scope[key];
        if (rows.some(r => r.productId === d.pid && r.moduleId)) scope[key] = rows.filter(r => r.productId !== d.pid);
        else scope[key] = rows.filter(r => !(r.productId === d.pid && !r.moduleId)).concat([{ productId: d.pid, moduleId: '*', projects: 0, certified: false }]);
      });
      break;
    }

    case 'prod-rm': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const key = APP.scopeSkillKey(scope);
      if (!Array.isArray(scope[key])) break;
      APP.skillMutate(el, function () { scope[key] = scope[key].filter(r => r.productId !== d.pid); });
      break;
    }

    case 'add-req': {
      const dr = APP.jobNewDraft;
      if (!dr) break;
      APP.skillMutate(el, function () {
        const rows = dr.requires = dr.requires || [];
        APP.jobReqNormalize(rows);
        const last = rows[rows.length - 1];
        let mx = 0; rows.forEach(r => { if (r.cid > mx) mx = r.cid; });
        rows.push({ productId: (last && last.productId) || 's4onprem', moduleId: '', minProjects: 0, orPrev: false, cid: mx + 1, projects: 0 });
      });
      break;
    }

    case 'rm-skill': {
      const scope = APP.getScope(d.target);
      if (!scope) break;
      const rkey = APP.scopeSkillKey(scope);
      if (!Array.isArray(scope[rkey])) break;
      scope[rkey].splice(+d.idx, 1);
      APP.renderKeep();
      break;
    }

    case 'comment-delete': {
      const a = APP.article(d.aid);
      const k = APP.userKey();
      if (!a || !k) break;
      const c = (a.comments || []).find(x => x.id === d.cid);
      if (!c || c.authorId !== k) break;
      a.comments = a.comments.filter(x => x.id !== d.cid);
      APP.save();
      APP.renderKeep();
      break;
    }

    case 'invite': {
      const s0 = APP.db.session, job = APP.job(d.jid), c = APP.consultant(d.cid);
      if (!s0 || s0.role !== 'employer' || !job || !c || job.companyId !== s0.companyId) break;
      job.invited = job.invited || [];
      if (job.invited.indexOf(c.id) === -1) {
        job.invited.push(c.id);
        const co = APP.company(s0.companyId);
        APP.addNotif(c.id, 'job', (co ? APP.coLabel(co, job, c.id) : 'A company') + ' invited you to apply for "' + job.title + '"', '#/job/' + job.id);
        APP.save();
        APP.toast('Invitation sent to ' + c.firstName + ' ✓');
      }
      APP.renderKeep();
      break;
    }

    case 'toggle-weak':
      APP.state.showWeak = APP.state.showWeak || {};
      APP.state.showWeak[d.jid] = !APP.state.showWeak[d.jid];
      APP.renderKeep();
      break;

    case 'apply':
      APP.confirmApply(d.id);
      break;

    case 'ext-apply':
      APP.openExternalApply(d.id);
      break;

    case 'ext-applied':
      APP.applyToJob(d.id, 'Applied on the company career portal');
      break;

    case 'withdraw':
      APP.confirmWithdraw(d.id);
      break;

    case 'dlg-cancel':
      APP.closeDialog();
      break;

    case 'dlg-ok': {
      const fn = APP._dlgConfirm;
      const nEl = document.getElementById('dlg-note');
      const selEl = document.getElementById('dlg-sel'), cvEl = document.getElementById('dlg-cv');
      const v = { note: nEl ? nEl.value : '', sel: selEl ? selEl.value : '', cv: cvEl ? cvEl.checked : false };
      APP._dlgConfirm = null;
      APP.closeDialog(true);
      if (fn) fn(v);
      break;
    }

    case 'long-toggle': {
      const box = el.closest('.long-text'); if (!box) break;
      const open = box.classList.toggle('is-open');
      el.textContent = open ? 'Show less' : 'Show more'; el.setAttribute('aria-expanded', open ? 'true' : 'false');
      break;
    }

    case 'toggle-save':
      APP.toggleSaveJob(d.id);
      break;

    case 'intro-request': APP.confirmRequestIntro(d.cid); break;
    case 'intro-accept': APP.confirmAcceptIntro(d.id); break;
    case 'intro-decline': APP.confirmDeclineIntro(d.id); break;
    case 'toggle-anon': {
      const s0 = APP.db.session; if (!s0) break;
      const tgt = s0.role === 'consultant' ? APP.consultant(s0.consultantId) : APP.company(s0.companyId);
      if (!tgt) break;
      tgt.anon = !tgt.anon;
      APP.save(); APP.render();
      APP.toast(tgt.anon ? (s0.role === 'consultant' ? 'Your profile is now anonymous' : 'Your company is now confidential') : 'Your identity is visible again');
      break;
    }

    case 'start-chat': {
      /* open messaging: anyone can start a conversation; private people and confidential roles stay anonymous inside it */
      const s = APP.db.session;
      if (!s) { APP.go('#/login'); break; }
      const jid = d.jid || '';
      if (s.role === 'employer') {
        const c = APP.consultant(d.cid);
        if (!c) break;
        const ex0 = APP.convBetween(c.id, s.companyId); if (ex0) { APP.go('#/e/messages/' + ex0.id); break; }
        const cv = APP.createConversation(c.id, s.companyId, null, jid);
        APP.chatDraft[cv.id] = { q: 'Hi' + (APP.canSeePerson(c) && c.firstName ? ' ' + c.firstName : '') + ', your profile looks relevant for a role we are hiring for. Are you available for a quick call?' };
        APP.go('#/e/messages/' + cv.id);
      } else if (d.cid) {
        if (d.cid === s.consultantId) break;
        const p2 = APP.consultant(d.cid); if (!p2) break;
        const exP = APP.peerConvBetween(s.consultantId, p2.id); if (exP) { APP.go('#/c/messages/' + exP.id); break; }
        const cvP = APP.createPeerConversation(s.consultantId, p2.id);
        APP.chatDraft[cvP.id] = { q: 'Hi, I saw your profile on Arnour and would like to connect.' };
        APP.go('#/c/messages/' + cvP.id);
      } else {
        const co = APP.company(d.eid);
        if (!co) break;
        const ex = Object.values(APP.db.conversations).find(c0 => !c0.c2Id && c0.cId === s.consultantId && c0.eId === co.id && (c0.jobId || '') === jid) || (!jid ? APP.convBetween(s.consultantId, co.id) : null);
        if (ex) { APP.go('#/c/messages/' + ex.id); break; }
        const job = jid ? APP.job(jid) : null;
        const cv = APP.createConversation(s.consultantId, co.id, null, jid);
        APP.chatDraft[cv.id] = { q: job ? 'Hi, I am interested in the role "' + job.title + '". Could we talk?' : 'Hi, I am interested in roles at ' + (co._anon ? 'your company' : co.name) + '. Do you have openings that match my profile?' };
        APP.go('#/c/messages/' + cv.id);
      }
      break;
    }

    case 'share-identity': {
      const cv = APP.conv(d.conv); if (!cv) break;
      const sd = APP.convSide(cv);
      APP.openDialog({
        title: 'Share your identity?',
        sub: cv.c2Id ? 'This professional will see your name, photo, LinkedIn and full profile.' : (APP.db.session.role === 'employer' ? 'The professional will see your company name for this role.' : 'The company will see your name, photo, LinkedIn, CV and full profile.'),
        confirmLabel: 'Share my identity',
        onConfirm: function () {
          const done = function () { if (sd === 'c') cv.revC = true; else cv.revE = true; APP.toast('Identity shared ✓'); APP.render(); };
          if (APP.LIVE && APP.backend) APP.backend.rpc('reveal_in_conversation', { p_conv: cv.id }).then(function () { done(); if (APP.backend.poll) APP.backend.poll(true); }, function () { APP.toast('Could not share your identity. Please try again.'); });
          else { done(); APP.save(); }
        }
      });
      break;
    }

    case 'conv-block': {
      const cv = APP.conv(d.conv); if (!cv) break;
      const on = d.on === '1';
      const apply = function () { cv.blockedByMe = on; APP.toast(on ? 'Blocked — they can no longer message you' : 'Unblocked'); APP.render(); };
      const run = function () {
        if (APP.LIVE && APP.backend) APP.backend.rpc('set_block', { p_conv: cv.id, p_on: on }).then(apply, function () { APP.toast('Could not do that. Please try again.'); });
        else { apply(); APP.save(); }
      };
      if (on) APP.openDialog({ title: 'Block this person?', sub: 'They will not be able to message you, and you will not receive messages from them. You can unblock later.', confirmLabel: 'Block', danger: true, onConfirm: run });
      else run();
      break;
    }

    case 'inbox-filter': {
      APP.state.inbox.f = d.f || 'all';
      APP.inboxRefresh();
      break;
    }

    case 'inbox-clear': {
      APP.state.inbox = { q: '', f: 'all', role: '' };
      APP.render();
      break;
    }

    case 'chat-insert': {
      const ta = document.querySelector('.chat-ta');
      if (!ta) break;
      const me = APP.currentUser();
      let t = '';
      if (d.kind === 'avail') {
        const i = me && APP.availInfo(me.availability);
        t = i ? 'I\'m ' + i.text.toLowerCase().replace(':', '') + '. Happy to talk whenever suits you.' : 'I\'m available to talk whenever suits you.';
      } else t = 'Could you please share your latest CV? It will help us move forward.';
      ta.value = (ta.value ? ta.value.replace(/\s*$/, '') + ' ' : '') + t;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
      break;
    }

    case 'chat-invite': {
      const s0 = APP.db.session, cand = APP.consultant(d.cid);
      if (!s0 || s0.role !== 'employer' || !cand) break;
      const open = APP.companyJobs(s0.companyId).filter(j => j.status === 'open' && (j.applicants || []).indexOf(cand.id) === -1 && (j.invited || []).indexOf(cand.id) === -1);
      if (!open.length) { APP.toast('No open roles left to invite ' + (cand.firstName || 'them') + ' to'); break; }
      APP.openDialog({
        title: 'Invite to apply',
        sub: 'Choose the role to invite ' + APP.h(APP.consultantFullName(cand)) + ' to.',
        body: '<label class="field"><span class="label">Role</span><select id="dlg-sel" class="input">' + open.map(j => '<option value="' + j.id + '">' + APP.h(j.title) + '</option>').join('') + '</select></label>',
        confirmLabel: 'Send invitation',
        onConfirm: (v) => { APP.onClick({ dataset: { action: 'invite', cid: cand.id, jid: v.sel } }); }
      });
      break;
    }

    case 'call-propose': {
      const cv = APP.conv(d.conv);
      if (!cv) break;
      const dt = new Date(Date.now() + 864e5), pad = (n) => String(n).padStart(2, '0');
      const today = new Date(), min = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
      const def = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
      const times = []; for (let h = 8; h <= 20; h++) { times.push(pad(h) + ':00'); if (h < 20) times.push(pad(h) + ':30'); }
      APP.openDialog({
        title: 'Propose a call',
        sub: 'Times are shown in each person’s own time zone. They can accept or decline from the chat.',
        body: '<div class="form-grid"><label class="field"><span class="label">Date</span><input id="dlg-date" type="date" class="input" min="' + min + '" value="' + def + '"></label>' +
          '<label class="field"><span class="label">Time</span><select id="dlg-time" class="input">' + times.map(t => '<option' + (t === '10:00' ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
          '<label class="field"><span class="label">Length</span><select id="dlg-dur" class="input"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label></div>' +
          '<label class="field"><span class="label">Note <span class="muted">(optional)</span></span><textarea id="dlg-note" class="input" rows="2" maxlength="300" placeholder="Agenda, meeting link, anything useful…"></textarea></label>',
        confirmLabel: 'Send proposal',
        onConfirm: (v) => {
          const dEl = document.getElementById('dlg-date'), tEl = document.getElementById('dlg-time'), uEl = document.getElementById('dlg-dur');
          const ts = new Date((dEl && dEl.value) + 'T' + (tEl ? tEl.value : '10:00')).getTime();
          if (!ts || ts < Date.now()) { APP.toast('Pick a time in the future'); return; }
          const side = APP.convSide(cv);
          APP.pushMessage(cv.id, side, '', false, { call: { ts: ts, dur: +(uEl ? uEl.value : 30) || 30, note: String(v.note || '').trim().slice(0, 300), status: 'proposed' } });
          APP.toast('Call proposed ✓');
          APP.render();
        }
      });
      break;
    }

    case 'call-reply': {
      const cv = APP.conv(d.conv), m = cv && cv.messages[+d.i];
      if (!m || !m.call || m.call.status !== 'proposed') break;
      m.call.status = d.ans === 'accepted' ? 'accepted' : 'declined';
      const side = APP.convSide(cv);
      APP.pushMessage(cv.id, side, m.call.status === 'accepted' ? 'Confirmed — talk on ' + APP.callWhen(m.call) + ' ✓' : 'That time doesn’t work for me — could you suggest another?');
      APP.render();
      break;
    }

    case 'open-conv': {
      APP.openConversation(d.id);
      APP.go((APP.db.session.role === 'consultant' ? '#/c/messages/' : '#/e/messages/') + d.id);
      break;
    }

    case 'attach-cv': {
      APP.state.pendingCv = true;
      APP.render();
      break;
    }

    case 'clear-cv': {
      APP.state.pendingCv = false;
      APP.render();
      break;
    }

    case 'cv-clear': {
      if (d.scope === 'wizC' && APP.wizC) { APP.wizC.data.cv = null; APP.render(); }
      break;
    }

    case 'reopen-job': {
      const j = APP.job(d.id);
      if (j && j.companyId === APP.db.session.companyId) { j.status = 'open'; APP.save(); APP.render(); APP.toast('Role reopened ✓'); }
      break;
    }

    case 'close-job': {
      const j = APP.job(d.id);
      if (!j) break;
      const nApp = (j.applicants || []).length;
      APP.openDialog({
        title: 'Close ' + APP.h(j.title) + '?',
        sub: 'It disappears from the job feed and professionals can no longer apply.' + (nApp ? ' Your ' + nApp + ' applicant' + (nApp === 1 ? '' : 's') + ' stay on the role.' : '') + ' You can reopen it any time.',
        body: '', confirmLabel: 'Close role', danger: true,
        onConfirm: function () { j.status = 'closed'; APP.save(); APP.render(); APP.toast('Role closed'); }
      });
      break;
    }
    case 'job-tab':
      APP.state.jobTab = APP.state.jobTab || {};
      APP.state.jobTab[d.jid] = d.tab;
      APP.renderKeep();
      break;
    case 'app-filter':
      APP.state.appFilter = APP.state.appFilter || {};
      APP.state.appFilter[d.jid] = d.f;
      APP.renderKeep();
      break;

    case 'reset-filters':
    case 'talent-reset': {
      { const keepSort = APP.state.talentFilters.sort; APP.state.talentFilters = APP.TF_DEFAULTS(); APP.state.talentFilters.sort = keepSort || 'best'; }
      APP._formSyncSkip = ['talent-search', 'talent-q', 'nav-search']; APP._skel = true;
      APP.render();
      break;
    }

    case 'tf-remove': {
      const tf = APP.state.talentFilters, k = d.key;
      if (Array.isArray(tf[k])) { const i = tf[k].indexOf(d.value); if (i >= 0) tf[k].splice(i, 1); }
      else if (k === 'product') { tf.product = ''; tf.module = ''; if (tf.cert === 'in-module') tf.cert = ''; }
      else if (k === 'region') tf.region = 'all';
      else if (k === 'minYears' || k === 'minProjects') tf[k] = 0;
      else if (k) tf[k] = '';
      APP._formSyncSkip = ['talent-search', 'talent-q', 'nav-search']; APP._skel = true;
      APP.renderKeep();
      break;
    }

    case 'tf-toggle':
      APP.state.tfMobile = !APP.state.tfMobile;
      APP.renderKeep();
      break;

    case 'wiz-back': {
      if (d.target === 'wizC' && APP.wizC) { APP.wizC.step = APP.wizPrevStep(APP.wizC.step); APP.render(); }
      if (d.target === 'wizE' && APP.wizE) { APP.wizE.step = Math.max(1, APP.wizE.step - 1); APP.render(); }
      break;
    }

    case 'profile-edit-on':
      APP.state.profileEdit = true;
      APP.profileDraft = APP.clone(APP.currentUser());
      APP.render();
      break;

    case 'profile-edit-off':
      APP.state.profileEdit = false;
      APP.profileDraft = null;
      APP.render();
      break;

    case 'co-edit-on':
      APP.state.coEdit = true;
      APP.profileDraft = APP.clone(APP.currentUser());
      APP.render();
      break;

    case 'co-edit-off':
      APP.state.coEdit = false;
      APP.profileDraft = null;
      APP.render();
      break;

    case 'q-upvote':
      APP.toggleUpvote('q', d.id);
      break;

    case 'article-upvote':
      APP.toggleUpvote('a', d.id);
      break;

    case 'answer-upvote':
      APP.toggleUpvote('answer', d.qid, d.aid);
      break;

    case 'accept-answer': {
      const q = APP.question(d.qid);
      const k = APP.userKey();
      if (!q || !k) break;
      if (q.authorId !== k) { APP.toast('Only the question author can accept an answer'); break; }
      const acc = (q.answers || []).find(x => x.id === d.aid);
      if (!acc) break;
      if (acc.authorId === k) { APP.toast('You can\'t accept your own answer'); break; }
      acc.accepted = !acc.accepted;
      if (acc.accepted) (q.answers || []).forEach(x => { if (x.id !== acc.id) x.accepted = false; });
      const lvlB = APP.reputation(acc.authorId).level;
      if (acc.accepted) APP.addNotif(acc.authorId, 'comm', 'Your answer on "' + q.title + '" was marked accepted', '#/community/q/' + q.id);
      if (acc.accepted) APP.repLevelNotify(acc.authorId, lvlB);
      APP.save();
      APP.render();
      break;
    }

    case 'go-jobs-for-skill': {
      APP.state.jobFilters = Object.assign(APP.JF_DEFAULTS(), { product: d.product || '', module: d.module || '' });
      APP._formSyncSkip = ['nav-search'];
      APP.go('#/c/jobs');
      break;
    }

    case 'comm-type': {
      const f = APP.state.communityFilters;
      f.type = f.type === d.value ? 'all' : d.value;
      APP.render();
      break;
    }

    case 'comm-reset': {
      APP.state.communityFilters = { type: 'all', product: '', module: '', topic: '', q: '', sort: 'active' };
      APP._formSyncSkip = ['community-filters'];
      APP.render();
      break;
    }

    case 'wiz-anon': {
      const w = d.r === 'c' ? APP.wizC : APP.wizE;
      if (!w) break;
      APP.syncFormsToDrafts(null);
      w.data.anon = !w.data.anon;
      APP.renderKeep();
      break;
    }

    case 'wiz-skip': {
      /* finish early from step 3 on: validate the skills, then submit the last step with whatever is filled in */
      if (!APP.wizC) return;
      APP.syncFormsToDrafts(null);
      const w0 = APP.wizC.data, lead0 = APP.isLeadRole(w0);
      if (lead0) w0.skills = APP.normalizeLandscape(w0.skills);
      const back = (st, key, msg) => { APP.wizC.step = st; APP.wizC.err = { [key]: msg }; APP.toast(msg); APP._formSyncSkip = ['wiz-c']; APP.render(); };
      if (lead0 && (w0.specialties || []).length < 2) { back(4, 'spec', 'Pick at least 2 specialties first'); return; }
      const okSk = (w0.skills || []).some(k => k.productId && k.moduleId);
      if (!okSk) { if (lead0) back(3, 'skills', 'Pick at least one SAP product first'); else APP.toast('Add at least one complete skill (product + module) first'); return; }
      APP.wizC.step = 6;
      APP.render();
      const fin = document.querySelector('form[data-form="wiz-c"]');
      if (fin) fin.requestSubmit();
      break;
    }

    case 'remember-job':
      APP.state.afterAuth = '#/job/' + d.id;
      break;

    case 'filter-remove': {
      const jf = APP.state.jobFilters, k = d.key;
      if (Array.isArray(jf[k])) { const i = jf[k].indexOf(d.value); if (i >= 0) jf[k].splice(i, 1); }
      else if (k === 'product') { jf.product = ''; jf.module = ''; }
      else if (k === 'region') jf.region = 'all';
      else if (k) jf[k] = '';
      APP._formSyncSkip = ['job-filters', 'job-q', 'nav-search'];
      APP.renderKeep();
      break;
    }

    case 'filters-reset': {
      APP.state.jobFilters = APP.JF_DEFAULTS();
      APP._formSyncSkip = ['job-filters', 'job-q', 'nav-search'];
      APP.render();
      break;
    }
  }
};

APP.onSubmit = function (f) {
  APP.syncFormsToDrafts(null);
  const type = f.dataset.form;
  const fd = new FormData(f);
  const g = (n) => { const v = fd.get(n); return v == null ? '' : String(v).trim(); };

  switch (type) {
    case 'nav-search': {
      const q = g('q');
      const target = f.dataset.target || '';
      if (target.indexOf('jobs') >= 0) {
        APP.state.jobFilters.q = q;
        APP._formSyncSkip = ['job-q', 'job-filters'];
        APP.go('#/c/jobs');
      } else {
        APP.state.talentFilters.q = q;
        APP._formSyncSkip = ['talent-q', 'talent-search'];
        APP.go('#/e/talent');
      }
      break;
    }

    case 'wiz-c': {
      if (!APP.wizC) return;
      const step = +f.dataset.step;
      const d = APP.wizC.data;
      if (step === 1) {
        d.firstName = g('firstName'); d.lastName = g('lastName');
        d.headline = g('headline'); d.nationality = g('nationality');
        d.linkedin = g('linkedin'); /* optional — shown on the public profile */
        d.country = g('country'); d.city = d.country ? g('city') : '';
        d.gender = g('gender') || d.gender || '';
        APP.rtSet(d, APP.rtList(d));
        const er = {};
        if (!d.roleType) er.role = 'Choose your main role. Everything after this is tailored to it.';
        if (!d.firstName) er.firstName = 'Add your first name';
        if (!d.lastName) er.lastName = 'Add your last name';
        if (!d.headline) er.headline = 'Add your title or headline';
        if (!APP.genders.some(x => x[0] === d.gender)) er.gender = 'Select Male or Female';
        if (!d.nationality) er.nationality = 'Select your nationality';
        if (!d.country) er.country = 'Select your country';
        if (!(d.languages || []).length) er.languages = 'Choose at least one language you speak';
        if (Object.keys(er).length) {
          APP.wizC.err = er;
          APP.toast('Please complete the highlighted fields');
          APP._formSyncSkip = ['wiz-c']; APP.render();
          setTimeout(function () { const first = document.querySelector('.wiz-sec.has-err'); if (first) first.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30);
          return;
        }
        APP.wizC.err = null;
        d._rtFor = d.roleType; /* changing role reorders the steps; nothing already entered is dropped */
        if (d.roleType === 'junior') d.level = 'Junior';
      } else if (step === 2) {
        d.yearsExp = Math.max(1, +g('yearsExp') || 1);
        d.level = APP.roleProfile(d).lvl ? (g('level') || 'Mid') : (d.roleType === 'junior' ? 'Junior' : APP.levelFromYears(d.yearsExp));
        d.availability = g('availability') || APP.availability[0];
      } else if (step === 3) {
        const pm = APP.roleProfile(d).skills, lead = APP.isLeadRole(d);
        if (lead) d.skills = APP.normalizeLandscape(d.skills);
        const ok = (d.skills || []).some(k => k.productId && k.moduleId && (+k.projects || 0) >= 0);
        if (!ok) {
          const msg = (pm === 'products' || lead) ? 'Pick at least one SAP product you work with' : 'Add at least one complete skill (product + module)';
          APP.wizC.err = { skills: msg }; APP.toast(msg); APP._formSyncSkip = ['wiz-c']; APP.render();
          const el = document.querySelector('.wiz-sec.has-err'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (f.querySelector('[name="programs"]')) d.programs = Math.max(0, +g('programs') || 0);
      } else if (step === 4) {
        if (f.querySelector('[name="programs"]')) d.programs = Math.max(0, +g('programs') || 0);
        if (f.querySelector('[name="otherSkills"]')) d.otherSkills = g('otherSkills');
        if (APP.isLeadRole(d) && (d.specialties || []).length < 2) {
          const msg = 'Pick at least 2 specialties — for your role they matter most to companies';
          APP.wizC.err = { spec: msg }; APP.toast(msg); APP._formSyncSkip = ['wiz-c']; APP.render();
          const el = document.querySelector('.wiz-sec.has-err'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      } else if (step === 5 && APP.SHOW_RATES) {
        d.currency = g('currency') || APP.defaultCurrency(d.country); d.currencyChosen = true;
        d.ratePeriod = g('ratePeriod') || 'day';
        d.dailyRate = +g('dailyRate') || 0; /* optional — profiles without a rate read "Rate on request" and the dashboard nudges to add one */
      } else if (step === 6) {
        d.summary = g('summary');
        const c = Object.assign({}, d);
        c.id = 'c' + Date.now();
        delete c._rtFor;
        if (!(c.programs > 0)) delete c.programs;
        c.skills = (d.skills || []).filter(k => k.productId && k.moduleId).map(k => ({ productId: k.productId, moduleId: k.moduleId, projects: +k.projects || 0, certified: !!k.certified }));
        c.industries = d.industries || [];
        c.workPrefs = (Array.isArray(d.workPrefs) ? d.workPrefs : APP.tagList(d.workPrefs)).filter(Boolean);
        c.specialties = (Array.isArray(d.specialties) ? d.specialties : APP.tagList(d.specialties)).filter(Boolean);
        c.otherSkills = APP.tagList(d.otherSkills);
        c.savedJobIds = [];
        if (APP.LIVE) { APP.backend.finishWizard('consultant', c); return; }
        APP.db.consultants[c.id] = c;
        APP.addNotif(c.id, 'job', 'Welcome to Arnour — your smart job feed is ready', '#/c/jobs');
        APP.login('consultant', c.id);
        APP.signupCommunityNotif(c.id);
        APP.wizC = null;
        APP.save();
        { const back = APP.state.afterAuth || ''; APP.state.afterAuth = ''; APP.go(back || '#/c/dashboard'); }
        APP.toast(c.anon ? 'Welcome to Arnour — your identity is private 🔒' : 'Welcome to Arnour, ' + c.firstName + ' 🎉');
        return;
      }
      APP.wizC.err = null;
      APP.wizC.step = APP.wizNextStep(step);
      APP.render();
      break;
    }

    case 'wiz-e': {
      if (!APP.wizE) return;
      const step = +f.dataset.step;
      const d = APP.wizE.data;
      if (step === 1) {
        d.name = g('name'); d.industry = g('industry'); d.size = g('size');
        d.country = g('country'); d.city = d.country ? g('city') : ''; d.website = g('website');
        if (!d.name || !d.country) { APP.toast(!d.name ? 'Please enter your company name' : 'Please select the headquarters country'); return; }
      } else if (step === 2) {
        if (f.querySelector('[name="about"]')) d.about = g('about'); /* About lives on step 1 — never clobber it here */
        d.contactName = g('contactName'); d.contactTitle = g('contactTitle');
        if (!d.contactName) { APP.toast('Add a contact name so professionals know who they\'re talking to'); return; }
      } else if (step === 3) {
        d.sapSystems = d.sapSystems || [];
        const co = Object.assign({}, d);
        co.id = 'co' + Date.now();
        if (APP.LIVE) { APP.backend.finishWizard('employer', co); return; }
        APP.db.companies[co.id] = co;
        APP.login('employer', co.id);
        APP.signupCommunityNotif(co.id);
        APP.wizE = null;
        APP.save();
        APP.go('#/e/dashboard');
        APP.toast('Company profile created 🎉');
        return;
      }
      APP.wizE.step = step + 1;
      APP.render();
      break;
    }

    case 'profile-edit': {
      const user = APP.db.session.role === 'consultant' ? APP.consultant(APP.db.session.consultantId) : null;
      if (!user) return;
      const d = APP.profileDraft || {};
      d.firstName = g('firstName'); d.lastName = g('lastName');
      d.headline = g('headline'); d.nationality = g('nationality');
      d.linkedin = g('linkedin'); /* optional — plain assignment so it can be cleared */
      d.country = g('country'); d.city = d.country ? g('city') : '';
      if (!d.country) { APP.toast('Please select your country'); return; }
      d.yearsExp = +g('yearsExp') || user.yearsExp;
      d.gender = g('gender') || user.gender || '';
      if (!d.gender) delete d.gender;
      APP.rtSet(d, APP.rtList(APP.profileDraft ? d : user));
      d.level = APP.roleProfile(d).lvl ? (g('level') || user.level) : (d.roleType === 'junior' ? 'Junior' : (g('level') || APP.levelFromYears(d.yearsExp)));
      if (f.querySelector('[name="programs"]')) { d.programs = Math.max(0, +g('programs') || 0); }
      if (!d.roleType) { APP.toast('Please choose your role type'); APP.flagRoleType(); return; }
      if (APP.profileDraft && !(APP.profileDraft.languages || user.languages || []).length) { APP.toast('Please choose at least one language you speak'); return; }
      d.availability = g('availability') || user.availability;
      if (APP.SHOW_RATES) {
        d.currency = g('currency') || user.currency;
        d.ratePeriod = g('ratePeriod') || user.ratePeriod || 'day';
        d.dailyRate = +g('dailyRate') || user.dailyRate;
      }
      d.summary = g('summary') || user.summary;
      if (APP.profileDraft) { d.skills = (APP.isLeadRole(d) ? APP.normalizeLandscape(APP.profileDraft.skills) : (APP.profileDraft.skills || [])).filter(k => k.productId && k.moduleId); d.industries = APP.profileDraft.industries || []; }
      if (APP.isLeadRole(d) && !(d.skills || []).length) { APP.toast('Pick at least one SAP product you work with'); return; }
      d.workPrefs = (APP.profileDraft && Array.isArray(APP.profileDraft.workPrefs) ? APP.profileDraft.workPrefs : user.workPrefs) || [];
      d.specialties = (APP.profileDraft && Array.isArray(APP.profileDraft.specialties) ? APP.profileDraft.specialties : user.specialties) || [];
      d.otherSkills = APP.tagList(g('otherSkills') || ((APP.profileDraft || user).otherSkills || ''));
      Object.assign(user, d);
      APP.state.profileEdit = false;
      APP.profileDraft = null;
      APP.save();
      APP.render();
      APP.toast('Profile updated ✓');
      break;
    }

    case 'company-edit': {
      const co = APP.db.session.role === 'employer' ? APP.company(APP.db.session.companyId) : null;
      if (!co) return;
      const d = APP.profileDraft || {};
      d.name = g('name'); d.industry = g('industry'); d.size = g('size');
      d.country = g('country'); d.city = d.country ? g('city') : '';
      if (!d.country) { APP.toast('Please select the headquarters country'); return; }
      d.website = g('website'); d.about = g('about');
      d.contactName = g('contactName'); d.contactTitle = g('contactTitle');
      if (APP.profileDraft) d.sapSystems = APP.profileDraft.sapSystems;
      Object.assign(co, d);
      APP.state.coEdit = false;
      APP.profileDraft = null;
      APP.save();
      APP.render();
      APP.toast('Company profile updated ✓');
      break;
    }

    case 'talent-search': {
      const f2 = APP.state.talentFilters;
      f2.product = g('product');
      f2.module = g('module');
      /* region is driven by chips, not this form — only overwrite if the form carries a region input */
      if (f.querySelectorAll('[name="region"]').length) f2.region = g('region') || 'all';
      f2.country = g('country');
      f2.nationality = g('nationality');
      f2.gender = g('gender');
      f2.roleType = g('roleType');
      f2.availability = g('availability');
      f2.workPref = g('workPref'); /* specialties are chip-driven, not form fields — keep the draft array */
      f2.minYears = +g('minYears') || 0;
      f2.minProjects = +g('minProjects') || 0;
      APP._formSyncSkip = ['nav-search']; APP._skel = true;
      if (APP._tfKeep) { const k = APP._tfKeep; APP._tfKeep = null; APP.renderKeep(k); } else APP.render();
      break;
    }

    case 'talent-q': {
      APP.state.talentFilters.q = g('q');
      APP.state.talentFilters.sort = g('sort') || 'best';
      APP._formSyncSkip = ['nav-search']; APP._skel = true;
      if (APP._tfKeep) { const k = APP._tfKeep; APP._tfKeep = null; APP.renderKeep(k); } else APP.render();
      break;
    }

    case 'job-filters': {
      const f2 = APP.state.jobFilters;
      ['product', 'module', 'country', 'roleType', 'lang', 'posted'].forEach(n => { if (f.querySelector('[name="' + n + '"]')) f2[n] = g(n); });
      if (!f2.product) f2.module = '';
      APP._formSyncSkip = ['nav-search', 'job-q'];
      if (APP._tfKeep) { const k = APP._tfKeep; APP._tfKeep = null; APP.renderKeep(k); } else APP.render();
      break;
    }

    case 'job-q': {
      const f2 = APP.state.jobFilters;
      f2.q = g('q');
      if (f.querySelector('[name="sort"]')) f2.sort = g('sort') || 'match';
      APP._formSyncSkip = ['nav-search', 'job-filters'];
      if (APP._tfKeep) { const k = APP._tfKeep; APP._tfKeep = null; APP.renderKeep(k); } else APP.render();
      break;
    }

    case 'job-post': {
      if (!APP.jobNewDraft) return;
      const d = APP.jobNewDraft;
      /* wizard: Enter / Continue on steps 1–2 moves forward; only step 3 publishes */
      if (!d.editId && (APP.state.jobStep || 1) < 3) { APP.jobGoStep((APP.state.jobStep || 1) + 1); return; }
      d.title = g('title');
      d.roleType = g('roleType') || d.roleType;
      APP.jobRowsAnyModule(d);
      d.country = g('country'); d.city = d.country ? g('city') : '';
      d.remote = fd.get('remote') === 'on';
      d.confidential = fd.get('confidential') === 'on';
      d.employmentType = g('employmentType') || 'Contract';
      d.duration = g('duration') || '';
      if (fd.has('rateMin')) { /* pay fields are hidden while APP.SHOW_RATES is off — keep whatever is saved */
        d.currency = g('currency') || 'USD';
        d.ratePeriod = g('ratePeriod') || (d.employmentType === 'Full-time' ? 'month' : 'day');
        d.rateMin = +g('rateMin') || 0;
        d.rateMax = +g('rateMax') || 0;
      }
      d.applyUrl = APP.normUrl(g('applyUrl'));
      if (d.applyUrl && !APP.safeApplyUrl(d)) { APP.toast('The apply link looks invalid — use a full link such as https://careers.yourcompany.com/job/123'); return; }
      if (!d.applyUrl) delete d.applyUrl;
      d.minExp = +g('minExp') || 0;
      delete d.maxExp;
      if (fd.has('minPrograms')) { d.minPrograms = Math.max(0, +g('minPrograms') || 0); if (!d.minPrograms || !APP.LEAD_RTS.includes(d.roleType)) delete d.minPrograms; }
      d.level = g('level');
      d.industries = (d.industries || []).filter(Boolean);
      d.industry = d.industries[0] || ''; /* kept for older code paths and saved data */
      d.certification = g('certification');
      if (fd.has('preferredGender')) { d.preferredGender = g('preferredGender'); if (!d.preferredGender) delete d.preferredGender; }
      /* keep the poster's line breaks, but tidy pasted text: unify newlines, cap blank lines, trim */
      d.description = g('description').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      d.languages = (d.languages || []).filter(Boolean);
      d.preferredLangs = (d.preferredLangs || []).filter(l => l && (d.languages || []).indexOf(l) === -1);
      d.preferredSpecialties = (d.preferredSpecialties || []).filter(Boolean);
      if (!d.editId) {
        for (let st = 1; st <= 2; st++) {
          const er = APP.jobStepErrors(d, st);
          if (Object.keys(er).length) { APP.state.jobStep = st; APP.state.jobErr = er; APP.render(); APP.jobFocusError(); return; }
        }
      }
      if (!d.title) { APP.toast('Please add a job title'); return; }
      if (!APP.roleTypeById[d.roleType]) { APP.toast('Please choose the role type'); return; }
      if (!d.country) { APP.toast('Please select the country for this role'); return; }
      if (APP.SHOW_RATES && d.rateMin && d.rateMax && d.rateMin > d.rateMax) { APP.toast('Pay minimum should be lower than maximum'); return; }
      /* Don't strip incomplete rows from the draft itself — otherwise a failed publish silently deletes the rows the poster is still filling in. */
      const reqRows = (d.requires || []).filter(r => r.productId && r.moduleId);
      if (!reqRows.length) { APP.toast('Add at least one required SAP skill — pick a product and a module'); return; }
      if (d.editId) {
        const orig = APP.db.jobs[d.editId];
        if (!orig || orig.companyId !== APP.db.session.companyId) { APP.toast('Role not found'); return; }
        const before = JSON.parse(JSON.stringify(orig));
        const sig = j => JSON.stringify([(j.requires || []).map(r => [r.productId, r.moduleId, r.minProjects, !!r.orPrev]), j.country, j.city, !!j.remote, j.languages, j.certification]);
        const keep = { id: orig.id, companyId: orig.companyId, applicants: orig.applicants || [], invited: orig.invited || [], postedTs: orig.postedTs, status: orig.status };
        const upd = Object.assign({}, d, { requires: reqRows.map(r => Object.assign({}, r)) }, keep, { editedTs: Date.now() });
        delete upd.editId; delete upd.maxExp;
        APP.db.jobs[orig.id] = upd;
        let msg = 'Role updated ✓';
        if (upd.status === 'open' && sig(before) !== sig(upd)) {
          const nn = APP.notifyMatches(upd, before);
          if (nn) msg += ' · ' + nn + ' new match' + (nn > 1 ? 'es' : '') + ' notified';
        }
        APP.jobNewDraft = null;
        APP.save();
        APP.toast(msg);
        APP.go('#/e/jobs/' + orig.id);
        break;
      }
      const job = Object.assign({}, d, {
        requires: reqRows.map(r => Object.assign({}, r)),
        id: 'j' + Date.now(),
        companyId: APP.db.session.companyId,
        applicants: [],
        postedTs: Date.now(),
        status: 'open'
      });
      APP.db.jobs[job.id] = job;
      const nStrong = APP.notifyMatches(job);
      if (nStrong) APP.addNotif(job.companyId, 'app', nStrong + ' professional' + (nStrong > 1 ? 's' : '') + ' match "' + job.title + '" at 70%+ and ' + (nStrong > 1 ? 'have' : 'has') + ' been notified', '#/e/jobs/' + job.id);
      APP.jobNewDraft = null; /* the next "Post a job" starts from a clean form */
      APP.save();
      APP.toast('Job posted ✓');
      APP.go('#/e/jobs/' + job.id);
      break;
    }

    case 'chat': {
      const cv = APP.conv(f.dataset.convId);
      if (!cv) return;
      const text = g('q');
      const cvAttached = APP.state.pendingCv;
      if (!text && !cvAttached) return;
      if (cv.blockedByMe || cv.blockedMe) { APP.toast('This conversation is closed'); return; }
      if (APP.convWaiting(cv)) { APP.toast('You can send 2 messages until they reply'); return; }
      const side = APP.convSide(cv);
      APP.pushMessage(cv.id, side, text, cvAttached);
      APP.state.pendingCv = false;
      APP.chatDraft[cv.id] = null;
      APP._formSyncSkip = ['chat'];
      APP.render();
      { const ta = document.querySelector('.chat-ta'); if (ta) ta.focus({ preventScroll: true }); }
      break;
    }

    case 'community-filters': {
      const f2 = APP.state.communityFilters;
      f2.q = g('q');
      f2.product = g('product');
      f2.module = g('module');
      f2.topic = g('topic');
      f2.sort = g('sort') || 'active';
      if (f2.type === 'mine' && !APP.db.session) f2.type = 'all';
      APP.render();
      break;
    }

    case 'community-answer': {
      const q = APP.question(f.dataset.qid);
      const k = APP.userKey();
      if (!q || !k) return;
      const text = g('q');
      if (!text) { APP.toast('Write an answer first'); return; }
      q.answers = q.answers || [];
      const lvlA = APP.reputation(k).level;
      const others = Array.from(new Set(q.answers.map(a => a.authorId))).filter(x => x !== k && x !== q.authorId);
      q.answers.push({ id: 'ca' + Date.now(), authorId: k, body: text, createdTs: Date.now(), upvotes: 0, upvotedBy: [], accepted: false });
      if (q.authorId !== k) APP.addNotif(q.authorId, 'comm', APP.communityAuthorName(k) + ' answered your question "' + q.title + '"', '#/community/q/' + q.id);
      others.forEach(o => APP.addNotif(o, 'comm', 'Another answer was posted on "' + q.title + '", which you answered', '#/community/q/' + q.id));
      APP.repLevelNotify(k, lvlA);
      APP.save();
      APP.commAnsDraft[q.id] = null;
      APP._formSyncSkip = ['community-answer'];
      APP.render();
      APP.toast('Answer posted ✓');
      break;
    }

    case 'community-ask': {
      const k = APP.userKey();
      if (!k) return;
      const title = g('title');
      const body = g('body');
      const pid = g('product');
      const mid = pid ? g('module') : '';
      const topic = pid ? '' : g('topic');
      if (!title || !body) { APP.toast('Add a title and describe your question'); return; }
      if (!pid && !topic) { APP.toast('Choose an SAP product, or a general topic'); return; }
      const q = {
        id: 'q' + Date.now(),
        authorId: k,
        title, body,
        productId: pid, moduleId: mid, topic: topic,
        anonymous: fd.get('anonymous') === 'on',
        createdTs: Date.now(),
        upvotes: 0, upvotedBy: [],
        answers: []
      };
      APP.db.questions[q.id] = q;
      APP.notifyNewQuestion(q);
      APP.save();
      APP.commAskDraft = null;
      APP._formSyncSkip = ['community-ask'];
      APP.go('#/community/q/' + q.id);
      APP.toast('Question posted ✓');
      /* Demo liveliness: a consultant with that product chimes in shortly (once per question). */
      if (!APP.LIVE) setTimeout(() => {
        const q2 = APP.question(q.id);
        if (!q2 || q2.botAnswered) return;
        q2.botAnswered = true;
        const cands = Object.values(APP.db.consultants).filter(c => c.id !== q.authorId && q.productId && (c.skills || []).some(s => s.productId === q.productId));
        const pool = cands.length ? cands : Object.values(APP.db.consultants).filter(c => c.id !== q.authorId);
        const bot = pool[Math.floor(Math.random() * pool.length)];
        if (!bot) return;
        const replies = [
          'Good one. We ran into this on a recent rollout — happy to share the pattern that worked. Reach out and I\'ll go deeper.',
          'The short answer: it depends on how much custom code you\'re carrying. The details are worth a quick call — my profile has the context.',
          'Interesting. The approach shifts a lot by product line — from what we\'ve seen, the "obvious" answer is usually the wrong one. DM and I\'ll walk you through it.'
        ];
        q2.answers = q2.answers || [];
        q2.answers.push({ id: 'ca' + Date.now(), authorId: bot.id, body: replies[q2.answers.length % replies.length], createdTs: Date.now(), upvotes: 0, upvotedBy: [], accepted: false });
        APP.addNotif(q.authorId, 'comm', APP.consultantFullName(bot) + ' answered your question "' + q2.title + '"', '#/community/q/' + q2.id);
        APP.save();
        APP.render();
      }, 1200);
      break;
    }

    case 'community-comment': {
      const a = APP.article(f.dataset.aid);
      const k = APP.userKey();
      if (!a || !k) return;
      const text = g('q');
      if (!text) { APP.toast('Write a comment first'); return; }
      a.comments = a.comments || [];
      const before = Array.from(new Set(a.comments.map(c => c.authorId))).filter(x => x !== k && x !== a.authorId);
      a.comments.push({ id: 'cm' + Date.now(), authorId: k, body: text, createdTs: Date.now() });
      const who = APP.communityAuthorName(k);
      if (a.authorId !== k) APP.addNotif(a.authorId, 'comm', who + ' commented on your article "' + a.title + '"', '#/community/a/' + a.id);
      before.forEach(o => APP.addNotif(o, 'comm', who + ' also commented on "' + a.title + '"', '#/community/a/' + a.id));
      APP.save();
      APP.commCmtDraft[a.id] = null;
      APP._formSyncSkip = ['community-comment'];
      APP.render();
      APP.toast('Comment posted ✓');
      break;
    }

    case 'community-share': {
      const k = APP.userKey();
      if (!k) return;
      const title = g('title');
      const url = g('url');
      const body = g('body');
      const pid = g('product');
      const mid = pid ? g('module') : '';
      const topic = pid ? '' : g('topic');
      if (!title || !url) { APP.toast('Add a title and the article link'); return; }
      if (!pid && !topic) { APP.toast('Choose an SAP product, or a general topic'); return; }
      const lvlS = APP.reputation(k).level;
      const a = {
        id: 'art' + Date.now(),
        authorId: k,
        title, url, body,
        productId: pid, moduleId: mid, topic: topic,
        createdTs: Date.now(),
        upvotes: 0, upvotedBy: [], comments: []
      };
      APP.db.articles[a.id] = a;
      APP.repLevelNotify(k, lvlS);
      APP.save();
      APP.commShareDraft = null;
      APP._formSyncSkip = ['community-share'];
      APP.go('#/community/a/' + a.id);
      APP.toast('Shared with the community ✓');
      break;
    }
  }
};
