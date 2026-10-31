// Dynamic sitemap: the static pages from sitemap.xml plus every open, public job.
// If the database cannot be reached, the static sitemap is served unchanged.
import { loadFeeds, sitemapXml } from '../edge-lib/seo.mjs';

export default async (request, context) => {
  const staticRes = await context.next();
  try {
    const { jobs, companies } = await loadFeeds();
    if (!jobs || !companies) return staticRes;
    const xml = sitemapXml(await staticRes.clone().text(), jobs, companies);
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', 'netlify-cdn-cache-control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
  } catch (e) { return staticRes; }
};

export const config = { path: '/sitemap.xml' };
