/* SEO package: static pages, sitemap, robots, JSON-LD and meta tags (no browser needed) */
import fs from 'fs'; import path from 'path';
const ROOT = process.env.ARNOUR_ROOT || path.resolve(process.cwd(), '..');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } else console.log('ok  ', n); };
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SITE = 'https://arnour.com';
const idx = rd('index.html');
t('index: title with brand and SAP', /<title>Arnour — SAP Talent &amp; Consulting Network/.test(idx));
t('index: description + canonical', /<meta name="description" content="[^"]{80,}/.test(idx) && idx.includes('<link rel="canonical" href="https://arnour.com/" />'));
t('index: og + twitter tags', ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:title', 'twitter:description', 'twitter:image'].every(k => idx.includes(k)));
const ld = idx.match(/application\/ld\+json">(.*?)<\/script>/s); let g = null; try { g = JSON.parse(ld[1])['@graph']; } catch (e) {}
const org = g && g.find(x => x['@type'] === 'Organization'), web = g && g.find(x => x['@type'] === 'WebSite');
t('JSON-LD parses with Organization and WebSite', !!(org && web));
t('JSON-LD brand fields', !!org && org.name === 'Arnour' && org.url === SITE && org.alternateName.length === 2 && /SAP consultants/.test(org.description) && /^https:\/\/arnour\.com\/assets\//.test(org.logo));
t('JSON-LD has no placeholder social links', !org || !org.sameAs || org.sameAs.every(u => /^https:\/\/(www\.)?(linkedin|x|twitter|facebook)\.com\//.test(u)));
t('JSON-LD sameAs has the three official profiles', !!org && ['linkedin.com/company/arnour','x.com/xarnour','facebook.com/arnourpage'].every(x => (org.sameAs || []).some(u => u.includes(x))));
t('index: crawlable fallback inside #app with SAP products and role types', /<div id="app"><div class="seo-fallback"/.test(idx) && /SuccessFactors/.test(idx) && /Ariba/.test(idx) && /Solution &amp; Enterprise Architect/.test(idx));
t('index: first-paint splash outside #app, search-engine text hidden from people but kept, and shown again without JavaScript', /<body>\s*<div id="boot-splash" class="live-splash">[^]*?Loading Arnour/.test(idx) && /#app>\.seo-fallback\{position:absolute!important/.test(idx) && /<noscript><style>#app>\.seo-fallback\{position:static!important/.test(idx) && /#boot-splash\{display:none!important/.test(idx));
t('backend: app start removes the first-paint splash', /getElementById\('boot-splash'\)[\s\S]{0,80}\.remove\(\)/.test(rd('js/backend.js')));
const sm = rd('sitemap.xml'); const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
t('sitemap lists home + 3 landing pages, no hash routes', locs.length === 4 && locs.every(u => u.startsWith(SITE + '/') && !u.includes('#')), locs);
const rb = rd('robots.txt');
t('robots.txt points to the sitemap and blocks private folders', /Sitemap: https:\/\/arnour\.com\/sitemap\.xml/.test(rb) && /Disallow: \/supabase\//.test(rb) && !/Disallow: \/\s*$/m.test(rb));
for (const u of locs.filter(u => u !== SITE + '/')) {
  const p = u.replace(SITE, '').replace(/^\//, '') + 'index.html';
  const ok = fs.existsSync(path.join(ROOT, p)); t('page exists: ' + p, ok); if (!ok) continue;
  const h = rd(p);
  t(p + ': title, description, canonical = sitemap url', /<title>[^<]*Arnour/.test(h) && /<meta name="description" content="[^"]{60,}/.test(h) && h.includes('<link rel="canonical" href="' + u + '" />'), u);
  t(p + ': one h1 and real text', (h.match(/<h1>/g) || []).length === 1 && h.replace(/<[^>]+>/g, ' ').split(/\s+/).length > 250);
  t(p + ': call to action boots into the app', /href="\/#\/(register\/[ce]|jobs|login)"/.test(h));
  t(p + ': JSON-LD parses', (() => { try { JSON.parse(h.match(/ld\+json">(.*?)<\/script>/s)[1]); return true; } catch (e) { return false; } })());
}
t('landing.css exists', fs.existsSync(path.join(ROOT, 'css/landing.css')));
console.log(fails ? 'FAILS ' + fails : 'ALL PASSED');
