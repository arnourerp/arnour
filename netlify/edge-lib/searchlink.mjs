// Shared search links: https://arnour.com/jobs?country=eg&product=s4public&module=sd ...
// Pure functions (no network, no browser) so the test suite can run them in Node.
// js/core.js has the same rules for the browser (APP.searchQuery, APP.searchFilters, APP.searchPhrase);
// tests/searchlink_test.mjs proves the two agree.

export const LEVELS = ['Junior', 'Mid', 'Senior'];
export const JOB_TYPES = ['Full-time', 'Contract', 'Freelance'];
export const WORK_MODES = ['remote', 'onsite'];
export const CERTS = ['none', 'preferred', 'required'];
export const POSTED = ['1', '7', '30'];

/* the order the parts appear in a link (short, readable ones first, free text last) */
export const ORDER = ['country', 'region', 'role', 'product', 'module', 'type', 'level', 'mode', 'industry', 'cert', 'lang', 'posted', 'direct', 'q'];

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const NAME = /^[\p{L}\p{N} &,.()\/'’+-]{1,80}$/u;
const LIST_MAX = 12;

/* "?a=b&c=d" -> [[key, value (decoded)], ...]; a list value keeps its commas for the caller to split */
function pairs(search) {
  const out = [];
  String(search || '').replace(/^\?/, '').split('&').forEach((kv) => {
    if (!kv) return;
    const i = kv.indexOf('=');
    const k = i < 0 ? kv : kv.slice(0, i), raw = i < 0 ? '' : kv.slice(i + 1);
    out.push([k, raw]);
  });
  return out;
}
const dec = (s) => { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return ''; } };
const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);

/* Read the filters out of a link. Returns the filter object in the form list_jobs_page takes (only set values),
   `any` = at least one filter was understood. Unknown names and malformed values are ignored. */
export function parseSearch(search) {
  const f = {};
  const first = {};
  pairs(search).forEach(([k, raw]) => { if (ORDER.indexOf(k) >= 0 && !(k in first)) first[k] = raw; });
  const one = (k, re) => { if (!(k in first)) return ''; const v = dec(first[k]).trim(); return re.test(v) ? v : ''; };
  const list = (k, ok) => { if (!(k in first)) return []; return uniq(first[k].split(',').map((x) => dec(x).trim()).filter(ok)).slice(0, LIST_MAX); };
  const country = one('country', ID).toLowerCase(); if (country) f.country = country;
  const region = one('region', ID).toLowerCase(); if (region && region !== 'all') f.region = region;
  const role = one('role', ID).toLowerCase(); if (role) f.roleType = role;
  const product = one('product', ID).toLowerCase(); if (product) f.product = product;
  const module = one('module', ID).toLowerCase(); if (module && product) f.module = module; /* a module only means something together with its product */
  const types = list('type', (x) => JOB_TYPES.indexOf(x) >= 0); if (types.length) f.types = types;
  const levels = list('level', (x) => LEVELS.indexOf(x) >= 0); if (levels.length) f.levels = levels;
  const mode = one('mode', /^[a-z]{1,10}$/); if (WORK_MODES.indexOf(mode) >= 0) f.workMode = mode;
  const inds = list('industry', (x) => NAME.test(x)); if (inds.length) f.industries = inds;
  const cert = one('cert', /^[a-z]{1,12}$/); if (CERTS.indexOf(cert) >= 0) f.cert = cert;
  const lang = one('lang', /^[\p{L}]{2,30}$/u); if (lang) f.lang = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  const posted = one('posted', /^[0-9]{1,2}$/); if (POSTED.indexOf(posted) >= 0) f.posted = posted;
  if (one('direct', /^[a-z0-9]{1,5}$/) === '1') f.direct = 'yes';
  if ('q' in first) { const q = dec(first.q).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); if (q) f.q = q; }
  return { f, any: Object.keys(f).length > 0 };
}

/* The filters as the readable part of a link (no "?"). Same order as ORDER, empty values left out. */
export function filtersQuery(f) {
  f = f || {};
  const enc = encodeURIComponent, out = [];
  const add = (k, v) => { if (v !== '' && v != null) out.push(k + '=' + enc(v)); };
  const addList = (k, a) => { if (Array.isArray(a) && a.length) out.push(k + '=' + a.map((x) => enc(x)).join(',')); };
  add('country', f.country);
  if (f.region && f.region !== 'all') add('region', f.region);
  add('role', f.roleType);
  add('product', f.product);
  if (f.product) add('module', f.module);
  addList('type', f.types);
  addList('level', f.levels);
  add('mode', f.workMode);
  addList('industry', f.industries);
  add('cert', f.cert);
  add('lang', f.lang);
  add('posted', f.posted ? String(f.posted) : '');
  if (f.direct) add('direct', '1');
  add('q', f.q ? String(f.q).trim() : '');
  return out.join('&');
}

/* ---- the words for a search ---- */
const ROLE_WORD = { functional: 'functional', technical: 'technical', basis: 'Basis & cloud', architect: 'architect', delivery: 'project / delivery', support: 'support & AMS', keyuser: 'key user', junior: 'junior' };
/* "SD (Sales & Distribution)" -> "SD", "Sales (SD)" -> "SD", "Central Finance (cFin)" -> "Central Finance", "Fiori / UI5 Development" stays whole */
export const modShort = (n) => {
  const s = String(n || '').trim(), m = /^(.+?) \((.+)\)$/.exec(s);
  if (!m) return s;
  return /^[A-Z0-9][A-Z0-9/ +&.-]{1,9}$/.test(m[2]) && /[a-z]/.test(m[1]) ? m[2] : m[1].trim();
};
const POSTED_WORD = { 1: 'posted in the last 24 hours', 7: 'posted in the last 7 days', 30: 'posted in the last 30 days' };
const CERT_WORD = { none: 'no certification needed', preferred: 'certification preferred', required: 'certification required' };
const TAGS = { ae: '#UAE', sa: '#SaudiArabia', gb: '#UK', us: '#USA' };

/* nm = { product(id) -> short name, module(productId, moduleId) -> name, country(id), region(id) } (each may return '' when unknown).
   Returns { head, extras[], text, tags }. head: "SAP S/4HANA Public Cloud SD functional roles in Egypt". */
export function searchPhrase(f, nm) {
  f = f || {}; nm = nm || {};
  const bits = [];
  const p = f.product ? String((nm.product && nm.product(f.product)) || '').trim() : '';
  if (p) bits.push(p);
  const m = p && f.module ? modShort(nm.module && nm.module(f.product, f.module)) : '';
  if (m) bits.push(m);
  let skill = bits.join(' ');
  if (!/^SAP\b/i.test(skill)) skill = 'SAP' + (skill ? ' ' + skill : '');
  const role = f.roleType && ROLE_WORD[f.roleType] ? ' ' + ROLE_WORD[f.roleType] : '';
  let where = '';
  if (f.country) where = String((nm.country && nm.country(f.country)) || '').trim();
  else if (f.region && f.region !== 'all') where = String((nm.region && nm.region(f.region)) || '').trim();
  const head = skill + role + ' roles' + (where ? ' in ' + where : '');
  const extras = [];
  if (f.workMode === 'remote') extras.push('remote-friendly'); else if (f.workMode === 'onsite') extras.push('on-site');
  if ((f.types || []).length) extras.push(f.types.join(' / ').toLowerCase());
  if ((f.levels || []).length) extras.push(f.levels.join(' / ').toLowerCase() + ' level');
  if ((f.industries || []).length) extras.push(f.industries.slice(0, 2).join(' / ') + (f.industries.length > 2 ? ' +' + (f.industries.length - 2) : ''));
  if (f.cert && CERT_WORD[f.cert]) extras.push(CERT_WORD[f.cert]);
  if (f.lang) extras.push(f.lang);
  if (f.posted && POSTED_WORD[f.posted]) extras.push(POSTED_WORD[f.posted]);
  if (f.direct) extras.push('direct employers only');
  if (f.q) extras.push('matching “' + f.q + '”');
  const text = 'Open ' + head + (extras.length ? ' (' + extras.join(', ') + ')' : '') + ' on Arnour';
  const tags = '#SAP #SAPJobs' + (f.country && where ? ' ' + (TAGS[f.country] || '#' + where.replace(/[^A-Za-z]/g, '')) : '');
  return { head, extras, text, tags };
}

/* the card title for a link: "12 open SAP S/4HANA Public Cloud SD roles in Egypt"; without a count (unknown or zero) just the roles */
export function searchTitle(f, nm, total) {
  const ph = searchPhrase(f, nm);
  if (typeof total === 'number' && total > 0) return total + ' open ' + (total === 1 ? ph.head.replace(/ roles\b/, ' role') : ph.head);
  return ph.head;
}
