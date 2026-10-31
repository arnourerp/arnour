// Shared helpers for the clean-URL pages (/job/<id>, /company/<id>) and the dynamic sitemap.
// Pure functions where possible so the test suite can run them in Node without a browser.
export const SITE = 'https://arnour.com';
export const SB = 'https://refardkcseixbcaauabo.supabase.co';
export const KEY = 'sb_publishable_6ycFGEqbq9RAc1Fi1163Hg_JY7DqefQ'; // public (publishable) key, same as js/config.js
export const BOARD_NAME = 'Jobs on Arnour'; // the board that hosts external listings is never shown as the employer

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
/* safe inside a <script type="application/ld+json"> block */
export const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export const rpc = (fn, args) => fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

/* one fetch of the public feeds per warm instance per minute, so a crawler visit does not hit the database once per page */
let _cache = null;
export async function loadFeeds(call = rpc, now = Date.now()) {
  if (_cache && now - _cache.t < 60000) return _cache.v;
  const [jobs, companies] = await Promise.all([call('list_jobs'), call('list_companies')]);
  const v = { jobs: Array.isArray(jobs) ? jobs : null, companies: Array.isArray(companies) ? companies : null };
  if (v.jobs && v.companies) _cache = { t: now, v };
  return v;
}
export const resetFeedCache = () => { _cache = null; };

/* the real employer name for a role, or '' when it is not shown publicly */
export function employerName(job, companies) {
  if (job.external && job.extEmployer) return String(job.extEmployer).trim();
  const c = (companies || []).find((x) => x.id === job.companyId);
  if (!c || c.anon || !c.name || c.name === BOARD_NAME) return '';
  return String(c.name).trim();
}

/* A role is indexable only when it is open, real (not a sample), not confidential, names an employer and has a country. */
export function jobIndexable(job, companies) {
  if (!job || job.status !== 'open' || job.sample === true || job.confidential === true) return false;
  if (!job.title || !job.country) return false;
  if (job.expiresTs && Number(job.expiresTs) <= Date.now()) return false;
  return !!employerName(job, companies);
}

const EMP_TYPES = [[/full/i, 'FULL_TIME'], [/part/i, 'PART_TIME'], [/contract|freelance|consult/i, 'CONTRACTOR'], [/temp/i, 'TEMPORARY'], [/intern|trainee/i, 'INTERN']];
export function employmentTypeLd(t) { const hit = EMP_TYPES.find((e) => e[0].test(String(t || ''))); return hit ? hit[1] : undefined; }

const toParas = (text) => String(text || '').split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');

export function jobPostingLd(job, companies) {
  const emp = employerName(job, companies);
  const ld = {
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: job.title,
    description: toParas(job.description) || '<p>' + esc(job.title) + '</p>',
    identifier: { '@type': 'PropertyValue', name: 'Arnour', value: job.id },
    datePosted: new Date(Number(job.postedTs) || Date.now()).toISOString().slice(0, 10),
    hiringOrganization: { '@type': 'Organization', name: emp },
    jobLocation: { '@type': 'Place', address: Object.assign({ '@type': 'PostalAddress', addressCountry: String(job.country).toUpperCase() }, job.city ? { addressLocality: job.city } : {}) },
    directApply: false,
    url: SITE + '/job/' + job.id
  };
  if (job.expiresTs) ld.validThrough = new Date(Number(job.expiresTs)).toISOString();
  const et = employmentTypeLd(job.employmentType); if (et) ld.employmentType = et;
  if (job.remote === true || job.remote === 'remote') ld.jobLocationType = 'TELECOMMUTE';
  return ld;
}

export function jobMeta(job, companies) {
  const emp = employerName(job, companies);
  const bits = [job.level, job.employmentType, [job.city, job.country && String(job.country).toUpperCase()].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return {
    title: 'Hiring: ' + job.title + (emp ? ' — ' + emp : '') + ' | Arnour',
    desc: cut((bits ? bits + '. ' : '') + (job.description || 'Hiring on Arnour, the talent network built for the SAP ecosystem.'), 200)
  };
}

const FALLBACK_STYLE = 'max-width:860px;margin:0 auto;padding:32px 24px;font-family:Inter,system-ui,sans-serif;color:#0F172A;line-height:1.6';
export function jobFallbackHtml(job, companies) {
  const emp = employerName(job, companies);
  const where = [job.city, job.country && String(job.country).toUpperCase()].filter(Boolean).join(', ');
  return '<div class="seo-fallback" style="' + FALLBACK_STYLE + '"><h1>' + esc(job.title) + '</h1>' +
    '<p><strong>' + esc(emp) + '</strong>' + (where ? ' · ' + esc(where) : '') + (job.employmentType ? ' · ' + esc(job.employmentType) : '') + '</p>' +
    toParas(job.description) +
    '<p><a href="/sap-jobs/">More SAP jobs</a> · <a href="/#/register/c">Create a profile to apply</a> · <a href="/about/">About Arnour</a></p>' +
    '<noscript><p>Arnour needs JavaScript to run the app.</p></noscript></div>';
}

/* Turn the app shell (index.html) into the page for one clean URL. opts: { title, desc, canonical, robots, ld[], fallback, path } */
export function buildPage(shell, o) {
  let h = String(shell);
  const rep = (re, to) => { h = h.replace(re, () => to); };
  rep(/<title>[\s\S]*?<\/title>/, '<title>' + esc(o.title) + '</title>');
  h = h.replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + esc(o.desc) + b);
  h = h.replace(/(<link rel="canonical" href=")[^"]*(")/, (m, a, b) => a + esc(o.canonical) + b);
  for (const k of ['og:title', 'twitter:title']) h = h.replace(new RegExp('(<meta (?:property|name)="' + k + '" content=")[^"]*(")'), (m, a, b) => a + esc(o.title) + b);
  for (const k of ['og:description', 'twitter:description']) h = h.replace(new RegExp('(<meta (?:property|name)="' + k + '" content=")[^"]*(")'), (m, a, b) => a + esc(o.desc) + b);
  h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, (m, a, b) => a + esc(o.canonical) + b);
  /* base href makes the relative js/ and css/ links work from /job/<id>; the script puts the app on its normal #/ route without a redirect */
  const m = String(o.path || '').match(/^\/(job|company)\/([A-Za-z0-9_-]{1,40})\/?$/);
  const entry = m ? '<script>(function(){try{history.replaceState(null,"","/"+location.search+"#/' + m[1] + '/' + m[2] + '")}catch(e){}})()</script>' : '';
  h = h.replace('<head>', () => '<head><base href="/">' + entry);
  const extra = (o.robots ? '<meta name="robots" content="' + esc(o.robots) + '" />' : '') + (o.ld || []).map((x) => '<script type="application/ld+json">' + ldJson(x) + '</script>').join('');
  h = h.replace('</head>', () => extra + '</head>');
  if (o.fallback) h = h.replace(/<div id="app">[\s\S]*?<\/div><\/div>(\s*<script src="js\/config\.js">)/, (mm, tail) => '<div id="app">' + o.fallback + '</div>' + tail);
  return h;
}

export function sitemapXml(staticXml, jobs, companies) {
  const head = String(staticXml || '').match(/<urlset[^>]*>/);
  const open = head ? head[0] : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const keep = [...String(staticXml || '').matchAll(/<url>[\s\S]*?<\/url>/g)].map((x) => x[0]);
  const rows = (jobs || []).filter((j) => jobIndexable(j, companies)).sort((a, b) => (Number(b.postedTs) || 0) - (Number(a.postedTs) || 0))
    .map((j) => '  <url><loc>' + SITE + '/job/' + esc(j.id) + '</loc><lastmod>' + new Date(Number(j.postedTs) || Date.now()).toISOString().slice(0, 10) + '</lastmod></url>');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + open + '\n' + keep.map((u) => '  ' + u).join('\n') + (rows.length ? '\n' + rows.join('\n') : '') + '\n</urlset>\n';
}
