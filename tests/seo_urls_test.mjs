/* Clean entry URLs (/job/<id>, /company/<id>) and the dynamic sitemap: page building, JobPosting data, indexing rules, fallbacks (no browser needed) */
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { pathToFileURL } from 'url';
const ROOT = process.env.ARNOUR_ROOT || path.resolve(process.cwd(), '..');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } else console.log('ok  ', n); };
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const lib = await imp('netlify/edge-lib/seo.mjs');
const pages = await imp('netlify/edge-functions/seo-pages.js');
const sitemap = await imp('netlify/edge-functions/sitemap.js');
const shell = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const staticSitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const NOW = Date.now(), DAY = 86400000;

const cos = [{ id: 'co-board', name: 'Jobs on Arnour' }, { id: 'co-real', name: 'Real Employer LLC', industry: 'Energy' }, { id: 'co-anon', name: 'Hidden Co', anon: true }];
const J = (o) => Object.assign({ id: 'x-1', status: 'open', sample: false, confidential: false, title: 'SAP SD Consultant', country: 'eg', city: 'Giza', employmentType: 'Full-time', external: true, extEmployer: 'DXC Technology', companyId: 'co-board', postedTs: NOW - 2 * DAY, expiresTs: String(NOW + 30 * DAY), description: 'Own the SD module.\n\nSecond paragraph with <b>tags</b> & ampersand.', remote: false }, o || {});
const jobs = [J(), J({ id: 'x-2', extEmployer: '' }), J({ id: 'x-3', sample: true }), J({ id: 'x-4', confidential: true }), J({ id: 'x-5', status: 'closed' }), J({ id: 'x-6', country: '' }), J({ id: 'x-7', expiresTs: String(NOW - DAY) }),
  J({ id: 'j-8', external: false, extEmployer: undefined, companyId: 'co-real', employmentType: 'Contract', remote: true }), J({ id: 'j-9', external: false, extEmployer: undefined, companyId: 'co-anon' }), J({ id: 'j-10', external: false, extEmployer: undefined, companyId: 'co-board' })];

/* ---- indexing rules ---- */
const ix = (id) => lib.jobIndexable(jobs.find((j) => j.id === id), cos);
t('open real job with employer + country is indexable', ix('x-1'));
t('no employer name: not indexable', !ix('x-2'));
t('sample job: not indexable', !ix('x-3'));
t('confidential job: not indexable', !ix('x-4'));
t('closed job: not indexable', !ix('x-5'));
t('no country: not indexable', !ix('x-6'));
t('expired job: not indexable', !ix('x-7'));
t('native job of a real, named company: indexable', ix('j-8'));
t('native job of an anonymous company: not indexable', !ix('j-9'));
t('the Jobs on Arnour board is never named as employer: not indexable', !ix('j-10'));

/* ---- JobPosting data ---- */
const ld = lib.jobPostingLd(jobs[0], cos);
t('JobPosting basics', ld['@type'] === 'JobPosting' && ld.title === 'SAP SD Consultant' && ld.hiringOrganization.name === 'DXC Technology' && ld.url === 'https://arnour.com/job/x-1', ld);
t('JobPosting location + dates', ld.jobLocation.address.addressCountry === 'EG' && ld.jobLocation.address.addressLocality === 'Giza' && /^\d{4}-\d{2}-\d{2}$/.test(ld.datePosted) && /^\d{4}-\d{2}-\d{2}T/.test(ld.validThrough), ld);
t('JobPosting employment type + no pay fields', ld.employmentType === 'FULL_TIME' && !('baseSalary' in ld));
t('JobPosting description is escaped HTML paragraphs', ld.description === '<p>Own the SD module.</p><p>Second paragraph with &lt;b&gt;tags&lt;/b&gt; &amp; ampersand.</p>', ld.description);
t('contract + remote map correctly', (() => { const l = lib.jobPostingLd(jobs.find((j) => j.id === 'j-8'), cos); return l.employmentType === 'CONTRACTOR' && l.jobLocationType === 'TELECOMMUTE' && l.hiringOrganization.name === 'Real Employer LLC'; })());
t('JSON-LD output cannot close the script tag', !lib.ldJson({ a: '</script><script>alert(1)</script>' }).includes('<'));

/* ---- page building from the real index.html ---- */
const meta = lib.jobMeta(jobs[0], cos);
const html = lib.buildPage(shell, { title: meta.title, desc: meta.desc, canonical: 'https://arnour.com/job/x-1', robots: null, ld: [ld], fallback: lib.jobFallbackHtml(jobs[0], cos), path: '/job/x-1' });
t('page: title, canonical, og:url, description replaced', html.includes('<title>Hiring: SAP SD Consultant — DXC Technology | Arnour</title>') && html.includes('<link rel="canonical" href="https://arnour.com/job/x-1" />') && html.includes('<meta property="og:url" content="https://arnour.com/job/x-1" />') && /<meta name="description" content="[^"]*Own the SD module/.test(html));
t('page: og/twitter title match, only one title tag', html.includes('<meta property="og:title" content="Hiring: SAP SD Consultant') && html.includes('<meta name="twitter:title" content="Hiring: SAP SD Consultant') && (html.match(/<title>/g) || []).length === 1);
t('page: base href first, entry script sets the app route and keeps the query string', /<head><base href="\/"><script>\(function\(\)\{try\{history\.replaceState\(null,"","\/"\+location\.search\+"#\/job\/x-1"\)/.test(html));
t('page: Organization/WebSite data kept, JobPosting added, all parse', (() => { const all = [...html.matchAll(/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1])); return all.length === 2 && all.some((x) => x['@graph']) && all.some((x) => x['@type'] === 'JobPosting'); })());
t('page: crawlable text replaces the generic fallback; app scripts untouched', html.includes('<h1>SAP SD Consultant</h1>') && !html.includes('SAP role types') && html.includes('<script src="js/config.js"></script>') && html.includes('<script src="js/main.js"></script>') && html.indexOf('<div id="app">') < html.indexOf('js/config.js'));
t('page: no robots tag for an indexable job', !/name="robots"/.test(html));
const noidx = lib.buildPage(shell, { title: 'T', desc: 'D', canonical: 'https://arnour.com/', robots: 'noindex,follow', ld: [], fallback: null, path: '/job/zzz' });
t('noindex page: robots tag, home canonical, generic fallback kept', noidx.includes('<meta name="robots" content="noindex,follow" />') && noidx.includes('<link rel="canonical" href="https://arnour.com/" />') && noidx.includes('SAP role types'));
t('entry script only for /job and /company paths', !lib.buildPage(shell, { title: 'T', desc: 'D', canonical: 'x', path: '/other/x' }).includes('replaceState'));

/* ---- the edge functions, with a fake network ---- */
const realFetch = globalThis.fetch;
const feeds = { list_jobs: jobs, list_companies: cos };
let shellOk = true, feedOk = true;
globalThis.fetch = async (u, init) => {
  const s = String(u);
  if (s.includes('/rest/v1/rpc/')) { if (!feedOk) return new Response('x', { status: 500 }); return new Response(JSON.stringify(feeds[s.split('/rpc/')[1]]), { status: 200, headers: { 'content-type': 'application/json' } }); }
  if (s === 'https://arnour.com/') return shellOk ? new Response(shell, { status: 200 }) : new Response('x', { status: 500 });
  return new Response('?', { status: 404 });
};
const call = async (p) => pages.default(new Request('https://arnour.com' + p), {});
let r = await call('/job/x-1?utm_source=whatsapp'); let body = await r.text();
t('GET /job/<open job>: 200 html with JobPosting, self canonical', r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && body.includes('"@type":"JobPosting"') && body.includes('rel="canonical" href="https://arnour.com/job/x-1"') && !/name="robots"/.test(body));
t('cached at the edge, never stale in the browser', /s-maxage=300/.test(r.headers.get('netlify-cdn-cache-control')) && /must-revalidate/.test(r.headers.get('cache-control')));
lib.resetFeedCache();
for (const id of ['x-3', 'x-4', 'x-5', 'x-2', 'nope']) { r = await call('/job/' + id); body = await r.text(); t('GET /job/' + id + ': app page, noindex, home canonical, no JobPosting', r.status === 200 && body.includes('content="noindex,follow"') && body.includes('rel="canonical" href="https://arnour.com/"') && !body.includes('JobPosting')); }
r = await call('/company/co-real'); body = await r.text();
t('GET /company/<id>: app page with company preview, noindex for now', r.status === 200 && body.includes('Real Employer LLC — Energy | Arnour') && body.includes('noindex,follow') && body.includes('replaceState') && body.includes('#/company/co-real'));
r = await call('/job/bad%20id'); t('bad id: redirected home', r.status === 302 && r.headers.get('location') === 'https://arnour.com/');
shellOk = false; r = await call('/job/x-1?gclid=abc'); t('app page unreachable: redirect to the normal address, query kept', r.status === 302 && r.headers.get('location') === 'https://arnour.com/?gclid=abc#/job/x-1', r.headers.get('location')); shellOk = true;
lib.resetFeedCache(); feedOk = false; r = await call('/job/x-1'); body = await r.text();
t('database down: still serves the app, not indexed, no JobPosting', r.status === 200 && body.includes('noindex,follow') && !body.includes('JobPosting')); feedOk = true; lib.resetFeedCache();

const smCtx = () => ({ next: async () => new Response(staticSitemap, { headers: { 'content-type': 'application/xml' } }) });
r = await sitemap.default(new Request('https://arnour.com/sitemap.xml'), smCtx()); body = await r.text();
const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
t('sitemap: 4 static pages + only indexable jobs', locs.length === 4 + 2 && locs.includes('https://arnour.com/job/x-1') && locs.includes('https://arnour.com/job/j-8') && locs.slice(0, 4).every((u) => !u.includes('/job/')), locs);
t('sitemap: no samples, confidential, closed, expired, anonymous or hash links', !locs.some((u) => /x-[2-7]|j-9|j-10|#/.test(u)));
t('sitemap: valid xml wrapper and lastmod dates', body.startsWith('<?xml') && body.includes('</urlset>') && [...body.matchAll(/<lastmod>([^<]+)</g)].every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m[1])));
lib.resetFeedCache(); feedOk = false; r = await sitemap.default(new Request('https://arnour.com/sitemap.xml'), smCtx()); body = await r.text();
t('sitemap: database down falls back to the static file', [...body.matchAll(/<loc>/g)].length === 4);
feedOk = true; lib.resetFeedCache();
t('edge routes are declared', JSON.stringify(pages.config.path) === '["/job/*","/company/*"]' && sitemap.config.path === '/sitemap.xml');
globalThis.fetch = realFetch;

/* ---- share links in the app ---- */
const core = fs.readFileSync(path.join(ROOT, 'js/core.js'), 'utf8');
const start = core.indexOf('APP.shareUrl = function'), end = core.indexOf('\n};', start) + 3;
const sandbox = { APP: { LIVE: true }, location: { origin: 'https://arnour.com', pathname: '/' } }; vm.createContext(sandbox); vm.runInContext(core.slice(start, end), sandbox);
const su = (h) => sandbox.APP.shareUrl(h);
t('share link for a job is the clean URL', su('#/job/x-1') === 'https://arnour.com/job/x-1', su('#/job/x-1'));
t('share link for a company is the clean URL', su('#/company/co-real') === 'https://arnour.com/company/co-real');
t('share links for profiles and community still use /share/', su('#/talent/c1') === 'https://arnour.com/share/p/c1' && su('#/community/q/q1') === 'https://arnour.com/share/q/q1' && su('#/community/a/a1') === 'https://arnour.com/share/a/a1');
sandbox.APP.LIVE = false; t('demo mode keeps hash links', su('#/job/j1') === 'https://arnour.com/#/job/j1', su('#/job/j1'));

/* ---- project files ---- */
const sm = staticSitemap;
t('static sitemap kept as the fallback (4 pages)', [...sm.matchAll(/<loc>/g)].length === 4);
t('robots.txt still points to the sitemap', /Sitemap: https:\/\/arnour\.com\/sitemap\.xml/.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')));
console.log(fails ? 'FAILS ' + fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
