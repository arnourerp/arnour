/* Certifications: a professional pastes the public link of a Credly badge; this function asks Credly for that badge and saves what it says.
   Why a function and not the browser: only this function knows FEED_WORKER_SECRET (the same secret as the Job feed daily check), and the database
   (release 57: cred_save) refuses to save a badge without it. So nobody can write a "verified" badge from the browser.
   What it reads: https://www.credly.com/api/v1/public_badges/<id>, the same data the public badge page shows (no sign-in). It is not a documented Credly
   service, so it can change; when Credly does not answer or the shape changes, the person sees "could not reach Credly" and nothing is saved.
   The address is always built here from a checked badge id and a fixed host, never from the pasted text, so it cannot be pointed anywhere else.
   Settings in Netlify: FEED_WORKER_SECRET (Admin > Job feeds > "Set up the daily check" creates it). Without it GET says not configured and the
   Certifications tab hides itself.
   Limits (30 checks per person per hour, 1,500 per day for the site, 20 badges per person) live in the database: cred_begin / cred_save. */
const SB_URL = process.env.SUPABASE_URL || 'https://refardkcseixbcaauabo.supabase.co';
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6ycFGEqbq9RAc1Fi1163Hg_JY7DqefQ'; /* public key, same as config.js */
const CREDLY_API = 'https://www.credly.com/api/v1/public_badges/';
const MAX_BODY = 4000, MAX_REPLY = 300000, WAIT_MS = 9000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const J = (code, obj) => ({ statusCode: code, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) });
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/* ---------- what was pasted ---------- */
function parseLink(text) {
  let u; try { u = new URL(String(text || '').trim()); } catch (e) { return { error: 'not_credly' }; }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'not_credly' };
  if (host !== 'credly.com' && host !== 'www.credly.com') return { error: 'not_credly' };
  const m = u.pathname.match(/^\/badges\/([0-9a-f-]{36})(?:\/|$)/i);
  if (m && UUID.test(m[1])) return { id: m[1].toLowerCase() };
  if (/^\/org\//i.test(u.pathname) || /badge_templates?|\/earner\//i.test(u.pathname)) return { error: 'template' };
  return { error: 'not_credly' };
}

/* ---------- the name on the badge against the name on the profile ---------- */
const plain = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
function nameMatches(profileName, issuedTo) {
  const p = plain(profileName).split(' ').filter(Boolean), t = plain(issuedTo).split(' ').filter(Boolean);
  if (!p.length || !t.length) return null;
  return p.every((w) => t.indexOf(w) >= 0);   /* every word of the profile name is on the badge (extra middle names on the badge are fine) */
}

/* ---------- reading Credly ---------- */
let fetchBadge = async (id) => {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), WAIT_MS);
  try {
    const r = await fetch(CREDLY_API + id, { redirect: 'manual', signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'ArnourBot/1.0 (+https://arnour.com)' } });
    if (r.status === 404) return { status: 404 };
    if (!r.ok) return { status: r.status || 502 };
    const txt = await r.text(); if (txt.length > MAX_REPLY) return { status: 502 };
    let j; try { j = JSON.parse(txt); } catch (e) { return { status: 502 }; }
    return { status: 200, json: j };
  } catch (e) { return { status: 0 }; } finally { clearTimeout(timer); }
};
const day = (v, v2) => { const s = String(v || v2 || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };

/* turns Credly's answer into the few fields Arnour keeps; returns {error} when it is not a usable, public, accepted badge */
function readBadge(j) {
  const d = j && typeof j === 'object' ? (j.data && typeof j.data === 'object' && !Array.isArray(j.data) ? j.data : j) : null;
  if (!d || typeof d !== 'object') return { error: 'unreachable' };
  const tpl = d.badge_template && typeof d.badge_template === 'object' ? d.badge_template : null;
  const title = str(tpl && tpl.name, 200);
  if (!title) return { error: 'unreachable' };
  if (d.public === false || d.is_private_badge === true) return { error: 'private' };
  if (d.state && String(d.state).toLowerCase() !== 'accepted') return { error: 'not_found' };   /* pending, rejected or revoked */
  let issuer = '';
  const ents = d.issuer && Array.isArray(d.issuer.entities) ? d.issuer.entities : [];
  for (const e of ents) { const n = e && e.entity && e.entity.name; if (n) { issuer = str(n, 120); break; } }
  if (!issuer && d.issuer && d.issuer.summary) issuer = str(String(d.issuer.summary).replace(/^issued by\s+/i, ''), 120);
  const issued = day(d.issued_at_date, d.issued_at), expires = day(d.expires_at_date, d.expires_at);
  if (!issued) return { error: 'unreachable' };
  const img = typeof d.image_url === 'string' ? d.image_url.trim() : '';
  const image = /^https:\/\/images\.credly\.com\/[A-Za-z0-9\/_.%-]+$/.test(img) && img.length <= 300 ? img : '';
  return { title, issuer, kind: str(tpl.type_category, 60), issued, expires, image, issuedTo: str(d.issued_to, 200) };
}

/* ---------- the database, with the person's own login (and, for saving, the secret) ---------- */
let rpcImpl = async (auth, fn, args) => {
  const body = Object.assign({}, args || {}); if (auth.secret) body.p_secret = auth.secret;
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB_KEY, authorization: 'Bearer ' + auth.jwt, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) { const e = new Error(String((data && (data.message || data.hint)) || 'service')); e.status = r.status; throw e; }
  return data;
};
const secretOf = () => String(process.env.FEED_WORKER_SECRET || '');
let secretGet = secretOf;

function dbError(e) {
  const m = String((e && e.message) || '');
  if (/daily limit/i.test(m)) return J(429, { error: 'limit' });
  if (/busy/i.test(m)) return J(503, { error: 'busy' });
  if (/consultants only/i.test(m)) return J(403, { error: 'consultants_only' });
  if (/suspended/i.test(m)) return J(403, { error: 'suspended' });
  if (/taken/i.test(m)) return J(409, { error: 'taken' });
  if (/too many/i.test(m)) return J(409, { error: 'too_many' });
  if (e && (e.status === 401 || /not signed in|jwt/i.test(m))) return J(401, { error: 'signin' });
  return J(502, { error: 'service' });
}

async function verify(jwt, req) {
  const secret = secretGet();
  const auth = { jwt }, authS = { jwt, secret };
  let id;
  if (req && req.id) {                                   /* "Check again" on a badge that is already mine: the database gives the Credly id back to its owner only */
    if (!UUID.test(String(req.id))) return J(400, { error: 'bad_request' });
    try { id = await rpcImpl(auth, 'cred_ext', { p_id: String(req.id) }); } catch (e) { return dbError(e); }
    if (!id || !UUID.test(String(id))) return J(404, { error: 'not_found' });
  } else {
    const p = parseLink(req && req.url);
    if (p.error) return J(422, { error: p.error });
    id = p.id;
  }
  let b; try { b = await rpcImpl(auth, 'cred_begin', {}); } catch (e) { return dbError(e); }
  const got = await fetchBadge(id);
  if (got.status === 404) return J(404, { error: 'not_found' });
  if (got.status !== 200) return J(502, { error: 'unreachable' });
  const bd = readBadge(got.json);
  if (bd.error) return J(bd.error === 'unreachable' ? 502 : 422, { error: bd.error });
  const nm = nameMatches(b && b.name, bd.issuedTo);
  try {
    const cred = await rpcImpl(authS, 'cred_save', { p_data: { ext_id: id, title: bd.title, issuer: bd.issuer, kind: bd.kind, issued: bd.issued, expires: bd.expires || null, image: bd.image || '', name_ok: nm } });
    return J(200, { cred });
  } catch (e) { return dbError(e); }
}

exports.handler = async function (event) {
  /* the Certifications tab asks this first, so it only shows when the function is switched on */
  if (event.httpMethod === 'GET') return J(200, { configured: secretGet().length >= 32 });
  if (event.httpMethod !== 'POST') return J(405, { error: 'method' });
  if (secretGet().length < 32) return J(503, { error: 'not_configured' });
  const jwt = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return J(401, { error: 'signin' });
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_BODY) return J(413, { error: 'too_big' });
  let req; try { req = JSON.parse(event.body || '{}'); } catch (e) { return J(400, { error: 'bad_request' }); }
  try { return await verify(jwt, req); } catch (e) { console.log('cred-verify: ' + String((e && e.message) || e).slice(0, 200)); return J(502, { error: 'service' }); }
};

exports._run = { parseLink, nameMatches, readBadge, verify,
  setDeps: (d) => { d = d || {}; fetchBadge = d.fetchBadge || fetchBadge; rpcImpl = d.rpc || rpcImpl; secretGet = d.secret || secretGet; } };
