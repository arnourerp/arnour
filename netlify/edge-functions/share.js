// Share links: /share/job/<id>, /share/q/<id>, /share/a/<id>, /share/p/<id> (profile), /share/c/<id> (company)
// Social sites do not run the app, so they read the preview (title, text) from this page.
// People who open the link are sent straight on to the real page.
const SB = 'https://refardkcseixbcaauabo.supabase.co';
const KEY = 'sb_publishable_6ycFGEqbq9RAc1Fi1163Hg_JY7DqefQ';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const rpc = (fn, args) => fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/share\/(job|q|a|p|c)\/([A-Za-z0-9_-]{1,40})\/?$/);
  if (!m) return Response.redirect(url.origin + '/', 302);
  const kind = m[1], id = m[2];
  const target = url.origin + '/#/' + { job: 'job/', q: 'community/q/', a: 'community/a/', p: 'talent/', c: 'company/' }[kind] + id;
  let title = 'Arnour — The SAP Talent Network';
  let desc = 'The talent network built for the SAP ecosystem.';
  try {
    if (kind === 'job') {
      const [jobs, cos] = await Promise.all([rpc('list_jobs'), rpc('list_companies')]);
      const j = Array.isArray(jobs) ? jobs.find((x) => x.id === id && x.status === 'open') : null;
      if (j) {
        const c = Array.isArray(cos) ? cos.find((x) => x.id === j.companyId) : null;
        const co = c && c.name ? c.name : '';
        title = 'Hiring: ' + (j.title || 'SAP role') + (co ? ' — ' + co : '') + ' | Arnour';
        const bits = [j.level, j.employmentType, [j.city, j.country && String(j.country).toUpperCase()].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
        desc = cut((bits ? bits + '. ' : '') + (j.description || 'Hiring on Arnour, the talent network built for the SAP ecosystem.'), 200);
      }
    } else if (kind === 'p') {
      const x = await rpc('get_public_profile', { p_id: id });
      if (x && x.private) {
        title = 'SAP professional on Arnour';
        desc = 'This professional keeps their identity private. Companies can ask to connect through Arnour.';
      } else if (x && x.id) {
        const nm = [x.firstName, x.lastName].filter(Boolean).join(' ');
        title = (nm || 'SAP professional') + (x.headline ? ' — ' + cut(x.headline, 80) : '') + ' | Arnour';
        const bits = [x.level, x.country && String(x.country).toUpperCase(), x.availability].filter(Boolean).join(' · ');
        desc = cut((bits ? bits + '. ' : '') + (x.summary || '') || 'SAP professional profile on Arnour, the talent network for the SAP ecosystem.', 200);
      }
    } else if (kind === 'c') {
      const list = await rpc('list_companies');
      const x = Array.isArray(list) ? list.find((i) => i.id === id) : null;
      if (x) {
        title = (x.name || 'Company') + (x.industry && !x.anon ? ' — ' + cut(x.industry, 60) : '') + ' | Arnour';
        desc = cut((x.anon ? 'Company details are private. ' : '') + (x.about || x.description || 'Hiring SAP talent on Arnour, the talent network for the SAP ecosystem.'), 200);
      }
    } else {
      const c = await rpc('list_community');
      const list = c && (kind === 'q' ? c.questions : c.articles);
      const x = Array.isArray(list) ? list.find((i) => i.id === id) : null;
      if (x) {
        title = (kind === 'q' ? 'Question: ' : 'Article: ') + cut(x.title, 90) + ' | Arnour Community';
        desc = cut(x.body || x.summary || '', 200) || desc;
      }
    }
  } catch (e) { /* fall back to the general preview */ }
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Arnour"><meta property="og:url" content="' + esc(url.origin + url.pathname) + '">' +
    '<meta property="og:image" content="' + url.origin + '/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="' + esc(url.origin + url.pathname) + '"></head><body>' +
    '<script>location.replace(' + JSON.stringify(target) + ')</script>' +
    '<noscript><p><a href="' + esc(target) + '">Continue to Arnour</a></p></noscript></body></html>';
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
};

export const config = { path: '/share/*' };
