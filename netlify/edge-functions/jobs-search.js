// Shared search links: /jobs?country=eg&product=s4public&module=sd ...
// Social sites and crawlers get a real preview ("12 open SAP S/4HANA Public Cloud SD roles in Egypt | Arnour", the count read live
// from list_jobs_page). People get the normal app on its #/jobs route with no redirect; the app reads the filters from the address once.
// These pages are never indexed (there is one for every combination of filters).
import { SITE, rpc, buildPage, cut } from '../edge-lib/seo.mjs';
import { parseSearch, filtersQuery, searchPhrase, searchTitle } from '../edge-lib/searchlink.mjs';

const DEFAULT_TITLE = 'Open SAP roles | Arnour';
const DEFAULT_DESC = 'Browse open SAP roles on Arnour, the SAP talent network: matched on exact SAP product and module, anonymous until both sides say yes.';

/* the names a title needs, from the same public lists the site loads (catalog and lists); any of them may be missing */
export function namesFrom(catalog, lists) {
  const prods = (catalog && Array.isArray(catalog.products)) ? catalog.products : [];
  const countries = (lists && Array.isArray(lists.countries)) ? lists.countries : [];
  const regions = (lists && Array.isArray(lists.regions)) ? lists.regions : [];
  return {
    product: (id) => { const p = prods.find((x) => x.id === id); return p ? (p.short || p.name || '') : ''; },
    module: (pid, mid) => { const p = prods.find((x) => x.id === pid); const m = p && (p.modules || []).find((x) => x.id === mid); return m ? m.name || '' : ''; },
    country: (id) => { const c = countries.find((x) => x.id === id); return c ? c.name || '' : ''; },
    region: (id) => { const r = regions.find((x) => x.id === id); return r ? r.name || '' : ''; }
  };
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (!/^\/jobs\/?$/.test(url.pathname)) return Response.redirect(url.origin + '/', 302);
  const hashTarget = url.origin + '/' + url.search + '#/jobs';

  let shell;
  try {
    const r = await fetch(url.origin + '/', { headers: { 'x-arnour-shell': '1' } });
    shell = r.ok ? await r.text() : null;
  } catch (e) { shell = null; }
  if (!shell) return Response.redirect(hashTarget, 302); // could not load the app page: send the visitor to the normal address

  const { f, any } = parseSearch(url.search);
  const q = filtersQuery(f);
  const self = SITE + '/jobs' + (q ? '?' + q : '');
  let page = { title: DEFAULT_TITLE, desc: DEFAULT_DESC, canonical: self, robots: 'noindex,follow', ld: [], fallback: null, path: url.pathname };
  try {
    if (any) {
      const [res, catalog, lists] = await Promise.all([
        rpc('list_jobs_page', { p_f: f, p_sort: 'newest', p_limit: 1, p_offset: 0 }),
        rpc('get_catalog'),
        rpc('get_lists')
      ]);
      const total = res && typeof res.total === 'number' ? res.total : null;
      const nm = namesFrom(catalog, lists);
      const ph = searchPhrase(f, nm);
      const title = searchTitle(f, nm, total);
      const lead = (total ? total + ' open: ' : '') + ph.text.replace(/^Open /, '').replace(/ on Arnour$/, '');
      page = {
        title: cut(title, 90) + ' | Arnour',
        desc: cut(lead + '. Arnour matches SAP professionals and roles on exact product and module, anonymous until both sides say yes.', 200),
        canonical: self, robots: 'noindex,follow', ld: [], fallback: null, path: url.pathname
      };
    }
  } catch (e) { /* any failure: the generic preview */ }

  return new Response(buildPage(shell, page), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, s-maxage=300, stale-while-revalidate=3600'
    }
  });
};

export const config = { path: ['/jobs', '/jobs/'] };
