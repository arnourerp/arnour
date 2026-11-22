/* Job feed (release 56): reads a company's careers page, lists its SAP roles, reads them one at a time into DRAFT roles of that company.
   Two ways in, the same code:
   - the admin screen (Admin > Job feeds) calls this function with the admin's own login: action "check" (look at the page) and action "read" (read one role);
   - the schedule (job-feed-cron.js, every 5 minutes) calls tick() with the secret FEED_WORKER_SECRET: it checks a feed that is due and reads waiting roles.
   Everything that touches the database goes through the feed_* functions (release 56), which check the admin or the secret. Nothing is published here:
   roles only ever become drafts, and the company is told in the app (and by e-mail through the normal notification settings).
   Pages are opened with the same safe reader as the single-job link (jd-parse.js): https only, public internet only, size and time limited.
   Settings in Netlify: ANTHROPIC_API_KEY (already there), FEED_WORKER_SECRET (only for the daily run; Admin > Job feeds shows how to create it). */
const jd = require('./jd-parse.js')._shared;

const SB_URL = process.env.SUPABASE_URL || 'https://refardkcseixbcaauabo.supabase.co';
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6ycFGEqbq9RAc1Fi1163Hg_JY7DqefQ'; /* public key, same as config.js */
const MAX_BODY = 300000;                 /* bytes of an admin request (it carries the option lists) */
const MAX_ITEMS = 400;                   /* jobs taken from one careers page */
const FEED_TYPES = /text\/html|application\/xhtml|text\/plain|xml|json/;
const FEED_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.6';

const J = (code, obj) => ({ statusCode: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) });
const arr = (v) => Array.isArray(v) ? v : [];
const one = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the three things the tests replace: the page reader, the AI reader and the database calls */
let fetcher = (u) => jd.fetchPage(u, { types: FEED_TYPES, accept: FEED_ACCEPT });
let jobPage = (u) => jd.fetchPage(u);
let modelRead = (text, L, key, ms) => jd.readWithModel(text, L, key, ms);
const defaultRpc = async (auth, fn, args) => {
  const body = Object.assign({ p_secret: auth.secret || null }, args || {});
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST', headers: { apikey: SB_KEY, authorization: 'Bearer ' + (auth.jwt || SB_KEY), 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  let data = null; try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) { const e = new Error(String((data && (data.message || data.hint)) || 'service')); e.status = r.status; throw e; }
  return data;
};
let rpcImpl = defaultRpc;
const rpc = (auth, fn, args) => rpcImpl(auth, fn, args);

/* ---------- is this job about SAP? (a cheap look at the title and the start of the text, before any AI is paid for) ---------- */
const SAP_RE = /\bSAP\b|\bS\/?4\s?HANA\b|\bS4\b|\bHANA\b|\bABAP\b|\bFiori\b|\bBTP\b|\bAriba\b|SuccessFactors|\bConcur\b|\bFI\s?\/?\s?CO\b|\bFICO\b|\bEWM\b|\bIBP\b|\bBW\/4\b|\bMDG\b|\bBODS\b|\bCPI\b|\bGRC\b/i;
const looksSap = (s) => SAP_RE.test(String(s || ''));

/* ---------- reading the page: a list of jobs ---------- */
const JOBISH = /(\/jobs?\/|\/jobs?(\?|$)|\/careers?\/|vacanc|position|opening|requisition|posting|\/roles?\/|jobid|job_id|reqid|[?&]id=\d|\/j\/|\/p\/|\/apply|myworkdayjobs|lever\.co|greenhouse\.io|smartrecruiters|successfactors|taleo|oraclecloud|workable|ashbyhq|bamboohr|teamtailor|recruitee|personio|jobvite|icims)/i;
const NOT_A_JOB_LINK = /^(apply( now)?|read more|learn more|view( all)?( jobs?| roles?| openings?| positions?)?|see (all|more)|search( jobs)?|home|log ?in|sign ?(in|up)|careers?|jobs?|next|previous|back|share|details?|more|menu|contact( us)?|about( us)?|privacy( policy)?|terms|cookies?)$/i;
const ASSET = /\.(pdf|jpe?g|png|gif|svg|webp|css|js|zip|docx?|xlsx?|pptx?|ico|mp4)(\?|$)/i;

function normKey(u) {
  try {
    const x = new URL(u); x.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'source', 'src', 'ref', 'lang'].forEach((k) => x.searchParams.delete(k));
    let s = x.protocol + '//' + x.hostname.toLowerCase() + x.pathname.replace(/\/+$/, '') + (x.searchParams.toString() ? '?' + x.searchParams.toString() : '');
    return s.slice(0, 500);
  } catch (e) { return ''; }
}
const absUrl = (href, base) => { try { const u = new URL(String(href || '').trim(), base); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch (e) { return ''; } };

function inlineBody(title, body) {
  const b = jd.noContactKeep(jd.str2(body)).replace(/\bhttps?:\/\/\S+/gi, ' ');
  if (b.length < 150) return '';
  return jd.str2('Job title: ' + title + '\n\n' + b).slice(0, 20000);
}

/* xml: every <name> ... </name> block, and one tag's text inside a block */
function xmlBlocks(xml, name) {
  const low = xml.toLowerCase(), open = '<' + name, close = '</' + name + '>'; const out = []; let i = 0;
  while (out.length < 2000) {
    const a = low.indexOf(open, i); if (a < 0) break;
    const nx = low.charCodeAt(a + open.length);
    if (!(nx === 62 || nx === 32 || nx === 47 || nx === 10 || nx === 13 || nx === 9)) { i = a + open.length; continue; }
    const s = low.indexOf('>', a); if (s < 0) break;
    if (low.charCodeAt(s - 1) === 47) { out.push(''); i = s + 1; continue; }
    const e = low.indexOf(close, s); if (e < 0) break;
    out.push(xml.slice(s + 1, e)); i = e + close.length;
  }
  return out;
}
function xmlText(block, name) {
  const b = xmlBlocks(block, name)[0]; if (b == null) return '';
  return jd.decodeEnt(b.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '')).trim();
}
function atomHref(block) {
  const m = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block); return m ? jd.decodeEnt(m[1]) : '';
}

function fromXml(xml, base) {
  const items = [];
  const kinds = ['item', 'entry', 'job', 'position', 'vacancy'];
  for (const k of kinds) {
    const bl = xmlBlocks(xml, k); if (!bl.length) continue;
    bl.forEach((b) => {
      const title = jd.htmlToText(xmlText(b, 'title') || xmlText(b, 'jobtitle') || xmlText(b, 'name')).replace(/\s+/g, ' ');
      const url = absUrl(xmlText(b, 'link') || atomHref(b) || xmlText(b, 'url') || xmlText(b, 'applyurl') || xmlText(b, 'guid'), base);
      const descr = jd.htmlToText(jd.decodeEnt(xmlText(b, 'description') || xmlText(b, 'content') || xmlText(b, 'summary')));
      if (title && url) items.push({ url, title, body: inlineBody(title, descr) });
    });
    if (items.length) return items;
  }
  /* a sitemap: only the addresses that look like jobs, on the same site */
  const host = (() => { try { return new URL(base).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
  xmlBlocks(xml, 'url').forEach((b) => {
    const u = absUrl(xmlText(b, 'loc'), base); if (!u) return;
    let h = ''; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return; }
    if (h !== host || !JOBISH.test(u) || ASSET.test(u)) return;
    const slug = decodeURIComponent((new URL(u).pathname.split('/').filter(Boolean).pop() || '').replace(/\.[a-z]+$/i, '')).replace(/[-_+]+/g, ' ').replace(/\b\d{4,}\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (slug.length >= 4) items.push({ url: u, title: slug.replace(/\b\w/g, (c) => c.toUpperCase()), body: '' });
  });
  return items;
}

const T_KEYS = ['title', 'name', 'jobTitle', 'job_title', 'position', 'text'];
const U_KEYS = ['url', 'absolute_url', 'hostedUrl', 'applyUrl', 'apply_url', 'link', 'jobUrl', 'job_url', 'canonicalUrl', 'externalPath'];
const B_KEYS = ['description', 'descriptionPlain', 'content', 'jobDescription', 'body'];
function fromJson(node, base, out, depth) {
  if (!node || typeof node !== 'object' || depth > 5 || out.length >= MAX_ITEMS) return;
  if (Array.isArray(node)) {
    const objs = node.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (objs.length) {
      const rows = [];
      objs.slice(0, 1000).forEach((o) => {
        const tk = T_KEYS.find((k) => typeof o[k] === 'string' && o[k].length > 2), uk = U_KEYS.find((k) => typeof o[k] === 'string' && o[k].length > 3);
        if (!tk || !uk) return;
        const url = absUrl(o[uk], base); if (!url) return;
        const bk = B_KEYS.find((k) => typeof o[k] === 'string' && o[k].length > 150);
        const title = one(o[tk]);
        rows.push({ url, title, body: bk ? inlineBody(title, jd.htmlToText(jd.decodeEnt(o[bk]).replace(/&lt;/g, '<').replace(/&gt;/g, '>'))) : '' });
      });
      if (rows.length) { rows.forEach((r) => out.push(r)); return; }
    }
    node.slice(0, 50).forEach((x) => fromJson(x, base, out, depth + 1));
    return;
  }
  Object.keys(node).slice(0, 60).forEach((k) => fromJson(node[k], base, out, depth + 1));
}

function anchors(html, base) {
  const low = html.toLowerCase(), out = []; let i = 0, guard = 0;
  while (out.length < 3000 && guard++ < 20000) {
    const a = low.indexOf('<a', i); if (a < 0) break;
    const nx = low.charCodeAt(a + 2);
    if (!(nx === 32 || nx === 10 || nx === 13 || nx === 9)) { i = a + 2; continue; }
    const gt = low.indexOf('>', a); if (gt < 0) break;
    const close = low.indexOf('</a', gt); if (close < 0) break;
    const tag = html.slice(a, gt), m = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const text = jd.htmlToText(html.slice(gt + 1, Math.min(close, gt + 1 + 2000))).replace(/\s+/g, ' ').trim();
    const raw = m ? jd.decodeEnt(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : '';
    i = close + 3;
    if (!raw || /^(#|mailto:|tel:|javascript:)/i.test(raw)) continue;
    const url = absUrl(raw, base); if (!url) continue;
    out.push({ url, text });
  }
  return out;
}

function fromHtml(html, base) {
  const items = [];
  /* 1. the page's own structured job data (what Google reads) */
  const posts = [];
  jd.ldBlocks(html).forEach((b) => { try { jd.collectPostings(JSON.parse(b), posts, 0); } catch (e) { /* not valid JSON: skipped */ } });
  const seen = {};
  posts.forEach((p) => {
    const title = one(jd.tx(p.title || p.name)); if (!title) return;
    const url = absUrl(jd.tx(p.url) || jd.tx(p.sameAs) || '', base) || (base + '#' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80));
    const k = normKey(url) || url; if (seen[k]) return; seen[k] = 1;
    const r = jd.postingToText(p);
    items.push({ url, title, body: inlineBody(title, r.body) });
  });
  if (items.length > 1) return items;
  /* 2. links on the page that look like jobs */
  const host = (() => { try { return new URL(base).hostname; } catch (e) { return ''; } })();
  const self = normKey(base), byKey = {};
  anchors(html, base).forEach((a) => {
    const c = jd.checkLink(a.url); if (c.error) return;                 /* https only, no LinkedIn / Indeed / Glassdoor, no private names */
    const k = normKey(a.url); if (!k || k === self || ASSET.test(a.url)) return;
    const t = one(a.text).slice(0, 200);
    if (t.length < 4 || NOT_A_JOB_LINK.test(t)) return;
    if (!JOBISH.test(a.url) && !(a.url.indexOf(host) !== -1 && /\/[^/]+\/[^/]+/.test(new URL(a.url).pathname) && looksSap(t))) return;
    if (!byKey[k] || byKey[k].title.length < t.length) byKey[k] = { url: a.url, title: t, body: '' };
  });
  Object.keys(byKey).forEach((k) => items.push(byKey[k]));
  return items;
}

/* the whole page, whatever it is (a job list, an RSS or JSON feed, a sitemap): items = [{ key, url, title, sap, body }] */
function parseFeed(page, base) {
  const raw = String(page || ''), head = raw.slice(0, 600).trim().toLowerCase();
  let items = [];
  if (/^(<\?xml|<rss|<feed|<urlset|<jobs|<source|<root)/.test(head) && head.indexOf('<html') === -1) items = fromXml(raw, base);
  else if (/^[\[{]/.test(head)) { try { fromJson(JSON.parse(raw), base, items, 0); } catch (e) { items = []; } }
  else items = fromHtml(raw, base);
  const out = [], seen = {};
  items.forEach((it) => {
    const key = normKey(it.url) || it.url; if (!key || seen[key] || out.length >= MAX_ITEMS) return; seen[key] = 1;
    const title = one(it.title).slice(0, 200); if (!title) return;
    out.push({ key, url: it.url.slice(0, 500), title, sap: looksSap(title + ' ' + it.url + ' ' + String(it.body || '').slice(0, 2500)), body: it.body || '' });
  });
  if (!out.length) { const e = new Error('no_jobs'); e.code = 'no_jobs'; throw e; }
  return out;
}

/* ---------- one look at a careers page ---------- */
async function checkFeed(auth, feedId) {
  const feed = await rpc(auth, 'feed_get', { p_id: feedId || null });
  if (!feed) return { status: 'none' };
  const fail = async (code) => { await rpc(auth, 'feed_store', { p_id: feed.id, p_items: null, p_error: code }); return { status: 'failed', error: code, feedId: feed.id }; };
  const c = jd.checkLink(feed.url); if (c.error) return fail(c.error);
  let page;
  try { page = await fetcher(c.url); } catch (e) { return fail(e && e.code ? e.code : 'link_unreachable'); }
  let items;
  try { items = parseFeed(page.html, page.url || feed.url); } catch (e) { return fail(e && e.code === 'no_jobs' ? 'no_jobs' : 'unreadable'); }
  const res = await rpc(auth, 'feed_store', { p_id: feed.id, p_items: items, p_error: '' });
  return Object.assign({ feedId: feed.id }, res);
}

/* ---------- reading one role into a draft ---------- */
function mapJob(p, description) {
  const d = { title: p.title, roleType: p.roleType || '', country: p.country || '', remote: !!p.remote, description: description || '' };
  d.employmentType = p.employmentType || 'Full-time';
  d.duration = d.employmentType === 'Full-time' ? 'Permanent' : (p.duration || '6 months');
  const counts = p.roleType === 'functional' || p.roleType === 'technical';
  d.requires = p.requires.map((r, i) => { const o = { productId: r.productId, moduleId: r.moduleId, minProjects: counts ? r.minProjects : 0, orPrev: i > 0 && !!r.orPrev }; if (r.nice) o.nice = true; return o; });
  let cid = 0;
  for (let a = 0; a < d.requires.length;) {
    let b = a + 1;
    while (b < d.requires.length && d.requires[b].productId === d.requires[a].productId && !!d.requires[b].nice === !!d.requires[a].nice && !d.requires[b].orPrev && !d.requires[a].orPrev) b++;
    cid++;
    if (b - a > 1) for (let z = a; z < b; z++) d.requires[z].cid = cid;
    a = b;
  }
  if (p.level) { d.level = p.level; if (p.mustLevel) d.mustLevel = true; }
  if (p.minExp) { d.minExp = p.minExp; if (p.mustExp) d.mustExp = true; }
  if (p.certification) d.certification = p.certification;
  if (arr(p.languages).length) { d.languages = p.languages.slice(); d.langMust = true; }
  else if (arr(p.preferredLangs).length) d.preferredLangs = p.preferredLangs.slice();
  if (arr(p.industries).length) { d.industries = p.industries.slice(); d.industry = p.industries[0]; if (p.mustInd) d.mustInd = true; }
  if (arr(p.specialties).length) { d.preferredSpecialties = p.specialties.slice(0, 8); if (p.mustSpec) d.mustSpec = true; }
  if (p.minPrograms && (p.roleType === 'architect' || p.roleType === 'delivery')) d.minPrograms = p.minPrograms;
  return d;
}

const RETRY = ['link_unreachable', 'ai'];
async function readNext(auth, feedId, L, key, opts) {
  opts = opts || {};
  let begin;
  try { begin = await rpc(auth, 'feed_read_begin', {}); }
  catch (e) { return { done: true, stopped: /daily limit/i.test(e.message) ? 'limit' : /busy/i.test(e.message) ? 'busy' : 'service' }; }
  const end = (st) => rpc(auth, 'feed_read_done', { p_id: begin, p_status: st }).catch(() => {});
  const it = await rpc(auth, 'feed_next', { p_id: feedId || null });
  if (!it) { await end('failed'); const n = await rpc(auth, 'feed_notify', { p_id: feedId || null }).catch(() => 0); return { done: true, notified: n || 0 }; }
  const finish = async (status, code, job) => {
    await rpc(auth, 'feed_item_done', { p_item: it.itemId, p_status: status, p_error: code || '', p_job: job || null });
    await end(status === 'drafted' ? 'ok' : 'failed');
    const n = await rpc(auth, 'feed_notify', { p_id: it.feedId }).catch(() => 0);
    return { done: false, title: it.title, status, error: code || '', notified: n || 0 };
  };
  try {
    let text = it.body || '', desc = '';
    if (text) { desc = text.replace(/^Job title:[^\n]*\n\n/, ''); }
    else {
      const c = jd.checkLink(it.url); if (c.error) return finish('failed', c.error);
      let page;
      try { page = jd.extractJob((await jobPage(c.url)).html); }
      catch (e) { const code = e && e.code ? e.code : 'link_unreachable'; return code === 'many_jobs' ? finish('ignored', 'many_jobs') : RETRY.indexOf(code) !== -1 ? finish('retry', code) : finish('failed', code); }
      text = jd.noContactKeep(jd.str2((page.head ? page.head + '\n\n' : '') + page.body));
      desc = jd.noContactKeep(jd.str2(page.body)).replace(/\bhttps?:\/\/\S+/gi, ' ');
      if (text.length < 150) return finish('failed', 'unreadable');
    }
    const res = await modelRead(text, L, key, opts.modelMs);
    if (res.error === 'ai') return finish('retry', 'ai');
    if (res.error) return finish('ignored', res.error);
    if (!res.job.requires.length) return finish('ignored', 'no_sap_skills');
    return finish('drafted', '', mapJob(res.job, desc));
  } catch (e) {
    console.log('job-feed: read failed (' + (e && e.name) + ')');
    return finish('retry', 'ai');
  }
}

/* ---------- the schedule: one tick = check a feed that is due, then read waiting roles while there is time ---------- */
async function tick(secret, key, opts) {
  opts = opts || {}; const auth = { secret }, t0 = Date.now(), out = { checked: null, read: 0, drafted: 0 };
  await rpc(auth, 'feed_tick', {});
  const due = await rpc(auth, 'feed_get', {});
  if (due) { const r = await checkFeed(auth, due.id); out.checked = { status: r.status, error: r.error || '', found: r.found || 0, new: r.new || 0, closed: r.closed || 0 }; }
  const lists = await rpc(auth, 'feed_lists', {});
  const L = jd.readLists(lists);
  if (!L.products.length || !L.roleTypes.length || !L.countries.length) { out.note = 'no_lists'; return out; }
  while (Date.now() - t0 < (opts.budgetMs || 9000)) {
    const r = await readNext(auth, null, L, key, { modelMs: opts.modelMs || 14000 });
    if (r.done) break;
    out.read++; if (r.status === 'drafted') out.drafted++;
  }
  return out;
}

/* ---------- the admin screen's calls ---------- */
exports.handler = async function (event) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (event.httpMethod === 'GET') return J(200, { configured: !!key });
  if (event.httpMethod !== 'POST') return J(405, { error: 'method' });
  const jwt = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return J(401, { error: 'signin' });
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY) return J(413, { error: 'too_big' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad_request' }); }
  const action = req.action === 'read' ? 'read' : req.action === 'check' ? 'check' : '';
  if (!action || !UUID.test(String(req.feedId || ''))) return J(400, { error: 'bad_request' });
  const auth = { jwt };
  const lift = (e) => {
    const m = String((e && e.message) || '');
    if (/not allowed|not signed in|jwt/i.test(m) || (e && (e.status === 401 || e.status === 403))) return J(403, { error: 'not_allowed' });
    return J(502, { error: 'service' });
  };
  try {
    if (action === 'check') return J(200, await checkFeed(auth, req.feedId));
    if (!key) return J(503, { error: 'not_configured' });
    let L = jd.readLists(req.lists);
    if (!L.products.length || !L.roleTypes.length || !L.countries.length) L = jd.readLists(await rpc(auth, 'feed_lists', {}));
    if (!L.products.length || !L.roleTypes.length || !L.countries.length) return J(400, { error: 'bad_request' });
    return J(200, await readNext(auth, req.feedId, L, key, { modelMs: 40000 }));
  } catch (e) { console.log('job-feed: ' + action + ' failed (' + (e && e.name) + ')'); return lift(e); }
};

exports._run = { tick, checkFeed, readNext, parseFeed, mapJob, looksSap, normKey,
  setDeps: (d) => { d = d || {}; fetcher = d.fetcher || ((u) => jd.fetchPage(u, { types: FEED_TYPES, accept: FEED_ACCEPT })); jobPage = d.jobPage || ((u) => jd.fetchPage(u)); modelRead = d.model || ((t, L, k, ms) => jd.readWithModel(t, L, k, ms)); rpcImpl = d.rpc || defaultRpc; } };
