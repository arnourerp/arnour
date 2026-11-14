/* Arnour file versioning.
   One version for the whole site: a hash of every file in js/ and css/. It is written as "?v=<version>" on every local
   script and stylesheet tag (index.html and the three landing pages) and as window.ARNOUR_V for files loaded later
   (admin, CV / job-ad / presentation readers, PDF reader). A browser or crawler that kept old files can then never mix
   them with new ones: after a deploy every address is new.

   Usage (from the repo root):
     node tests/stamp.mjs          write the current version into the pages
     node tests/stamp.mjs --check  only check; exit 1 when the pages are out of date (also run by tests/version_test.mjs) */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';

export const ROOT = process.env.ARNOUR_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES = ['index.html', 'about/index.html', 'sap-consultants/index.html', 'sap-jobs/index.html'];
const HASHED_DIRS = ['js', 'css'];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else if (/\.(js|mjs|css)$/.test(e.name)) out.push(f);
  }
  return out;
}

/* the version: first 10 hex characters of a SHA-256 over (relative path + file bytes) of every script and stylesheet */
export function siteVersion(root = ROOT) {
  const h = crypto.createHash('sha256');
  for (const d of HASHED_DIRS) for (const f of walk(path.join(root, d), [])) {
    h.update(path.relative(root, f).split(path.sep).join('/')); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0');
  }
  return h.digest('hex').slice(0, 10);
}

/* local = not http(s):, not protocol-relative, not data: */
const isLocal = (u) => !/^(?:[a-z]+:)?\/\//i.test(u) && !/^data:/i.test(u);

/* every src= / href= of a local .js, .mjs or .css file in the page, with the version it carries now ('' when none) */
export function localRefs(html) {
  const out = [];
  const re = /\b(src|href)=(\\?["'])([^"'\\]+?\.(?:js|mjs|css))(\?v=([A-Za-z0-9]*))?\2/g;
  let m;
  while ((m = re.exec(html))) if (isLocal(m[3])) out.push({ url: m[3], v: m[5] === undefined ? '' : m[5] });
  return out;
}

export function stampHtml(html, v) {
  let h = html.replace(/\b(src|href)=(\\?["'])([^"'\\]+?\.(?:js|mjs|css))(\?v=[A-Za-z0-9]*)?\2/g,
    (all, attr, q, url) => (isLocal(url) ? attr + '=' + q + url + '?v=' + v + q : all));
  h = h.replace(/window\.ARNOUR_V\s*=\s*(["'])[A-Za-z0-9]*\1/g, 'window.ARNOUR_V="' + v + '"');
  return h;
}

export function check(root = ROOT) {
  const v = siteVersion(root), problems = [];
  for (const p of PAGES) {
    const html = fs.readFileSync(path.join(root, p), 'utf8');
    const refs = localRefs(html);
    if (!refs.length) problems.push(p + ': no local script or stylesheet found');
    for (const r of refs) if (r.v !== v) problems.push(p + ': ' + r.url + ' carries "' + r.v + '", expected "' + v + '"');
  }
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = idx.match(/window\.ARNOUR_V\s*=\s*"([A-Za-z0-9]*)"/);
  if (!m) problems.push('index.html: window.ARNOUR_V is missing'); else if (m[1] !== v) problems.push('index.html: window.ARNOUR_V is "' + m[1] + '", expected "' + v + '"');
  return { v, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const r = check();
    if (r.problems.length) { console.log('Version stamp is out of date (run: node tests/stamp.mjs)\n' + r.problems.join('\n')); process.exit(1); }
    console.log('version ' + r.v + ' ok');
  } else {
    const v = siteVersion();
    for (const p of PAGES) {
      const f = path.join(ROOT, p), old = fs.readFileSync(f, 'utf8'), neu = stampHtml(old, v);
      if (neu !== old) fs.writeFileSync(f, neu);
    }
    const r = check();
    if (r.problems.length) { console.log(r.problems.join('\n')); process.exit(1); }
    console.log('stamped version ' + v);
  }
}
