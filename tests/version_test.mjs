/* File versioning: every local script and stylesheet address carries the version of this deploy, and that version
   matches the files. Fails when someone changes a JS or CSS file and forgets to run "node tests/stamp.mjs". */
import fs from 'fs'; import path from 'path';
import { ROOT, PAGES, siteVersion, localRefs, stampHtml, check } from './stamp.mjs';
let fails = 0;
const t = (name, ok, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || !extra ? '' : ' :: ' + extra)); if (!ok) fails++; };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const r = check();
t('pages carry the current version (' + r.v + ')', r.problems.length === 0, r.problems.join(' | '));
t('version is 10 hex characters', /^[a-f0-9]{10}$/.test(r.v));

/* the pages */
const idx = rd('index.html');
const refs = localRefs(idx).map((x) => x.url);
for (const f of ['css/styles.css', 'js/config.js', 'js/attribution.js', 'js/vendor/supabase.js', 'js/catalog.js', 'js/sample-data.js', 'js/core.js', 'js/views-public.js', 'js/views-consultant.js', 'js/views-employer.js', 'js/community.js', 'js/search.js', 'js/partners.js', 'js/backend.js', 'js/feedback.js', 'js/main.js'])
  t('index.html: ' + f + ' is versioned', refs.includes(f));
t('index.html sets window.ARNOUR_V before any local file', idx.indexOf('window.ARNOUR_V="' + r.v + '"') > 0 && idx.indexOf('window.ARNOUR_V=') < idx.indexOf('css/styles.css'));
t('no local script or stylesheet tag without a version', PAGES.every((p) => !/\b(?:src|href)=\\?["'](?![a-z]+:|\/\/)[^"'\\]+\.(?:js|mjs|css)\\?["']/i.test(rd(p))));
t('outside addresses are left alone', /href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*"/.test(idx) && !/fonts\.googleapis\.com[^"]*\?v=/.test(idx));
for (const p of PAGES.slice(1)) {
  const u = localRefs(rd(p)).map((x) => x.url);
  t(p + ': landing.css and attribution.js versioned', u.includes('/css/landing.css') && u.includes('/js/attribution.js'));
}

/* files loaded later use the same version */
const core = rd('js/core.js');
t('APP.vq exists', /APP\.vq = function/.test(core));
const later = [['js/views-public.js', "'/js/cv-import.js' + APP.vq()"], ['js/views-employer.js', "'/js/jd-import.js' + APP.vq()"], ['js/partners.js', "'/js/partner-import.js' + APP.vq()"],
  ['js/cv-import.js', "pdf.min.mjs' + APP.vq()"], ['js/cv-import.js', "pdf.worker.min.mjs' + APP.vq()"], ['js/partner-import.js', "pdf.min.mjs' + APP.vq()"], ['js/partner-import.js', "pdf.worker.min.mjs' + APP.vq()"]];
for (const [f, needle] of later) t(f + ' loads ' + needle.split("'")[1 - (needle[0] === "'" ? 0 : 1)].replace(/^\//, '') + ' with the version', rd(f).includes(needle));
/* guard: any script made in code from a local address must add the version */
for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((x) => x.endsWith('.js'))) {
  const bad = rd('js/' + f).split('\n').filter((l) => /\.src\s*=\s*['"]\/?js\/[^'"]+\.m?js['"]\s*;/.test(l) || /import\(\s*['"]\/js\/[^'"]+['"]\s*\)/.test(l));
  t('js/' + f + ': no unversioned script made in code', bad.length === 0, bad.join(' | ').slice(0, 200));
}

/* the version changes with the files, and only with them */
const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'arnour-ver-'));
fs.mkdirSync(path.join(tmp, 'js')); fs.mkdirSync(path.join(tmp, 'css'));
fs.writeFileSync(path.join(tmp, 'js/a.js'), 'one'); fs.writeFileSync(path.join(tmp, 'css/a.css'), 'x');
const v1 = siteVersion(tmp);
t('same files, same version', siteVersion(tmp) === v1);
fs.writeFileSync(path.join(tmp, 'js/a.js'), 'two');
const v2 = siteVersion(tmp);
t('a changed script changes the version', v2 !== v1);
fs.writeFileSync(path.join(tmp, 'css/a.css'), 'y');
t('a changed stylesheet changes the version', siteVersion(tmp) !== v2);
fs.writeFileSync(path.join(tmp, 'readme.txt'), 'z'); const v3 = siteVersion(tmp);
fs.writeFileSync(path.join(tmp, 'readme.txt'), 'zz');
t('other files do not change the version', siteVersion(tmp) === v3);
fs.rmSync(tmp, { recursive: true, force: true });

/* stamping twice gives the same page; an old stamp is replaced, not doubled */
const once = stampHtml('<script>window.ARNOUR_V=""</script><link rel="stylesheet" href="css/styles.css" /><script src="js/core.js?v=old123"></script><script src="https://x.test/a.js"></script><script>document.write(\'<script src="js/sample-data.js"><\\/script>\')</script>', 'abc');
t('stamp: adds, replaces, skips outside files', once.includes('href="css/styles.css?v=abc"') && once.includes('src="js/core.js?v=abc"') && once.includes('src="https://x.test/a.js"') && once.includes('src="js/sample-data.js?v=abc"') && once.includes('window.ARNOUR_V="abc"'));
t('stamp: running it again changes nothing', stampHtml(once, 'abc') === once);

/* the job-page edge code still finds the app scripts after stamping */
const seo = rd('netlify/edge-lib/seo.mjs');
t('seo.mjs accepts the versioned config.js tag', seo.includes('config\\.js(?:\\?v=[A-Za-z0-9]*)?">'));

console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
