// Clean entry URLs: /job/<id> and /company/<id>.
// Search engines and social sites get a real page (title, text, JobPosting data). People get the normal app,
// opened on its usual #/ route with no redirect, and any ?utm_… / gclid in the link is kept.
import { SITE, loadFeeds, jobIndexable, jobPostingLd, jobMeta, jobFallbackHtml, buildPage, esc, cut } from '../edge-lib/seo.mjs';

const DEFAULT_TITLE = 'Arnour — SAP Talent & Consulting Network (MENA & Global)';
const DEFAULT_DESC = 'Arnour is the SAP talent network for consultants, architects and employers: anonymous until both sides say yes, matched on exact SAP product and module expertise.';
/* Company pages stay out of search results until real employers (not the Jobs on Arnour board) have public pages. */
const INDEX_COMPANIES = false;

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(job|company)\/([A-Za-z0-9_-]{1,40})\/?$/);
  if (!m) return Response.redirect(url.origin + '/', 302);
  const kind = m[1], id = m[2];
  const hashTarget = url.origin + '/' + url.search + '#/' + kind + '/' + id;

  let shell;
  try {
    const r = await fetch(url.origin + '/', { headers: { 'x-arnour-shell': '1' } });
    shell = r.ok ? await r.text() : null;
  } catch (e) { shell = null; }
  if (!shell) return Response.redirect(hashTarget, 302); // could not load the app page: send the visitor to the normal address

  const canonicalSelf = SITE + '/' + kind + '/' + id;
  let page = { title: DEFAULT_TITLE, desc: DEFAULT_DESC, canonical: SITE + '/', robots: 'noindex,follow', ld: [], fallback: null, path: url.pathname };
  try {
    const { jobs, companies } = await loadFeeds();
    if (kind === 'job' && jobs && companies) {
      const j = jobs.find((x) => x.id === id);
      if (j && jobIndexable(j, companies)) {
        const meta = jobMeta(j, companies);
        page = { title: meta.title, desc: meta.desc, canonical: canonicalSelf, robots: null, ld: [jobPostingLd(j, companies)], fallback: jobFallbackHtml(j, companies), path: url.pathname };
      }
    } else if (kind === 'company' && companies) {
      const c = companies.find((x) => x.id === id);
      if (c && c.name) {
        page = {
          title: c.name + (c.industry && !c.anon ? ' — ' + cut(c.industry, 60) : '') + ' | Arnour',
          desc: cut((c.anon ? 'Company details are private until an introduction is accepted. ' : '') + (c.about || c.description || 'Hiring SAP talent on Arnour, the talent network for the SAP ecosystem.'), 200),
          canonical: INDEX_COMPANIES && !c.anon ? canonicalSelf : SITE + '/', robots: INDEX_COMPANIES && !c.anon ? null : 'noindex,follow', ld: [], fallback: null, path: url.pathname
        };
      }
    }
  } catch (e) { /* any failure: serve the plain app page, not indexed */ }

  return new Response(buildPage(shell, page), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
    }
  });
};

export const config = { path: ['/job/*', '/company/*'] };
