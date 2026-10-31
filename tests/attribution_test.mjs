/* First-touch source: reading links, buckets, 90-day memory, account hand-off, share redirect (no browser needed) */
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { pathToFileURL } from 'url';
const ROOT = process.env.ARNOUR_ROOT || path.resolve(process.cwd(), '..');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } else console.log('ok  ', n); };
const src = fs.readFileSync(path.join(ROOT, 'js/attribution.js'), 'utf8');

/* run the real file against a fake browser */
function visit({ search = '', referrer = '', pathname = '/', entry, store = {}, broken = false, now = Date.now() } = {}) {
  const ls = { getItem: (k) => { if (broken) throw new Error('blocked'); return k in store ? store[k] : null; }, setItem: (k, v) => { if (broken) throw new Error('blocked'); store[k] = String(v); } };
  const win = { localStorage: ls, location: { search, pathname }, __arnourEntry: entry };
  const sb = { window: win, document: { referrer }, Date: { now: () => now }, JSON, Object, String, decodeURIComponent, Math };
  vm.createContext(sb); vm.runInContext(src, sb);
  return { A: win.ArnourFT, store };
}
const saved = (r) => { const raw = r.store.arnour_ft; return raw ? JSON.parse(raw) : null; };

let r = visit();
t('direct visit stores nothing', !saved(r) && r.A.bucket() === 'direct' && r.A.fresh === false && r.A.forAccount() === null);
r = visit({ search: '?utm_source=facebook&utm_medium=group&utm_campaign=EG-SAP-Jobs&utm_content=post1', pathname: '/sap-jobs/' });
let ft = saved(r);
t('tagged Facebook group link is remembered', ft && ft.s === 'facebook' && ft.b === 'facebook' && ft.m === 'group' && ft.c === 'eg-sap-jobs' && ft.ct === 'post1' && ft.l === '/sap-jobs/' && r.A.fresh === true, ft);
t('bucket and account copy', r.A.bucket() === 'facebook' && r.A.forAccount().s === 'facebook' && r.A.forAccount() !== r.A.get());
t('a new visitor is counted once, and the note is not saved on the account', r.A.takeLandingCount() === true && r.A.takeLandingCount() === false && saved(r).n === 1 && !('n' in r.A.forAccount()));
r = visit({ search: '?fbclid=IwAR123abc' }); ft = saved(r);
t('Facebook click id alone means facebook / referral', ft && ft.s === 'facebook' && ft.m === 'referral' && !ft.gc, ft);
r = visit({ search: '?gclid=Cj0KCQ_abc-123' }); ft = saved(r);
t('Google click id means google / cpc and is kept for later conversion upload', ft && ft.s === 'google' && ft.m === 'cpc' && ft.gc === 'Cj0KCQ_abc-123', ft);
r = visit({ referrer: 'https://l.facebook.com/l.php?u=x' }); t('Facebook link shim referrer', saved(r) && saved(r).b === 'facebook' && saved(r).m === 'referral', saved(r));
r = visit({ referrer: 'https://www.google.com.eg/' }); t('Google search referrer is organic', saved(r) && saved(r).b === 'google' && saved(r).m === 'organic', saved(r));
r = visit({ referrer: 'https://arnour.com/about/' }); t('own site as referrer is ignored', !saved(r));
r = visit({ referrer: 'https://blog.example.org/post' }); ft = saved(r); t('unknown site: host kept, counter bucket is other', ft && ft.s === 'blog.example.org' && ft.b === 'other' && ft.r === 'blog.example.org', ft);
r = visit({ search: '?utm_source=FB' }); t('aliases map to the right bucket', saved(r).b === 'facebook');
r = visit({ search: '?utm_source=zzz%3Cscript%3Ealert(1)%3C%2Fscript%3E' }); ft = saved(r);
t('made-up or hostile source becomes bucket other, text is cleaned', ft.b === 'other' && /^[a-z0-9._-]+$/.test(ft.s) && !/[<>()]/.test(JSON.stringify(ft)), ft);
r = visit({ search: '?utm_source=facebook&utm_campaign=' + 'x'.repeat(200) }); t('long values are cut', saved(r).c.length <= 50);

/* first touch wins, for 90 days */
const day = 86400000, t0 = Date.now();
const store = {};
visit({ search: '?utm_source=facebook&utm_campaign=first', store, now: t0 });
r = visit({ search: '?utm_source=linkedin&utm_campaign=second', store, now: t0 + 5 * day });
t('a later tagged visit does not replace the first', saved(r).s === 'facebook' && saved(r).c === 'first' && r.A.fresh === false, saved(r));
r = visit({ search: '?utm_source=linkedin&utm_campaign=second', store, now: t0 + 91 * day });
t('after 90 days a new visit starts a new first touch', saved(r).s === 'linkedin' && r.A.fresh === true, saved(r));
r = visit({ store: { arnour_ft: 'not json' } }); t('damaged saved value is ignored', r.A.get() === null);
r = visit({ search: '?utm_source=facebook', broken: true }); t('blocked browser storage never breaks the page', r.A.fresh === false && r.A.get() === null);
r = visit({ search: '?utm_source=facebook', pathname: '/', entry: '/job/x-ca01a23f43' }); t('clean job link records which job brought the visitor', saved(r).l === '/job/x-ca01a23f43', saved(r));

/* hand-off to the account (functions taken from js/backend.js) */
const be = fs.readFileSync(path.join(ROOT, 'js/backend.js'), 'utf8');
const grab = (start, end) => { const a = be.indexOf(start); const b = be.indexOf(end, a); return be.slice(a, b); };
const code = grab('  B.signUpData = function', '  B.signUp = function') + grab('  B.noteProfileDone = function', '  B.finishWizard = function');
function acct(ftObj, user) {
  const calls = { events: [], updates: [] };
  const sb = { B: { user, sb: { auth: { updateUser: (x) => { calls.updates.push(x); return Promise.resolve({}); } } } }, APP: { trackEvent: (n) => calls.events.push(n) }, window: { ArnourFT: { forAccount: () => ftObj } }, ArnourFT: { forAccount: () => ftObj } }; /* in a browser, window properties are also globals */
  vm.createContext(sb); vm.runInContext(code, sb); return { B: sb.B, calls };
}
const FT = { s: 'facebook', b: 'facebook', m: 'group', c: 'eg-sap-jobs', t: 1 };
let a = acct(FT, null);
t('sign-up data carries the role and the source', JSON.stringify(a.B.signUpData('c')) === JSON.stringify({ role: 'consultant', ft: FT }) && a.B.signUpData('e').role === 'employer');
a = acct(null, null); t('sign-up data without a source is just the role', JSON.stringify(a.B.signUpData('c')) === '{"role":"consultant"}');
a = acct(FT, { user_metadata: { role: 'consultant' } }); a.B.noteProfileDone('consultant');
t('profile completed: counted per source and saved on a Google / LinkedIn account', a.calls.events[0] === 'conv:c:facebook' && a.calls.updates.length === 1 && a.calls.updates[0].data.ft.s === 'facebook', a.calls);
a = acct(FT, { user_metadata: { role: 'consultant', ft: FT } }); a.B.noteProfileDone('employer');
t('already saved at sign-up: counted, not saved twice (employer counter)', a.calls.events[0] === 'conv:e:facebook' && a.calls.updates.length === 0, a.calls);
a = acct(null, { user_metadata: {} }); a.B.noteProfileDone('consultant');
t('no source: counted as direct, nothing saved', a.calls.events[0] === 'conv:c:direct' && a.calls.updates.length === 0, a.calls);
t('counter names fit the database rule', ['conv:c:facebook', 'conv:e:instagram', 'lnd:whatsapp', 'conv:c:other'].every((n) => /^[a-z0-9_:-]{1,40}$/.test(n)));

/* wiring */
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
t('app page loads the file right after the config', /js\/config\.js"><\/script>\s*<script src="js\/attribution\.js"><\/script>/.test(rd('index.html')));
t('landing pages remember the source too', ['about', 'sap-consultants', 'sap-jobs'].every((d) => rd(d + '/index.html').includes('<script src="/js/attribution.js" defer></script>')));
t('landing page links still go to the app page (same browser storage)', ['about', 'sap-consultants', 'sap-jobs'].every((d) => /href="\/#\//.test(rd(d + '/index.html'))));
t('privacy text explains the stored note and still says no advertising cookies', /remember which link or campaign/.test(rd('js/backend.js')) && /do not use advertising cookies/.test(rd('js/backend.js')));

/* the /share/ redirect keeps the campaign tags */
const share = (await import(pathToFileURL(path.join(ROOT, 'netlify/edge-functions/share.js')).href)).default;
const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('[]', { status: 200 });
const res = await share(new Request('https://arnour.com/share/q/q1?utm_source=facebook&utm_medium=share'), {}); const html = await res.text();
globalThis.fetch = realFetch;
t('share link redirect keeps utm tags before the #', html.includes('location.replace("https://arnour.com/?utm_source=facebook&utm_medium=share#/community/q/q1")'), html.match(/location\.replace\([^)]*\)/));
const noQ = await (async () => { globalThis.fetch = async () => new Response('[]', { status: 200 }); const x = await (await share(new Request('https://arnour.com/share/p/c1'), {})).text(); globalThis.fetch = realFetch; return x; })();
t('share link without tags still goes to /#/…', noQ.includes('location.replace("https://arnour.com/#/talent/c1")'), noQ.match(/location\.replace\([^)]*\)/));

console.log(fails ? 'FAILS ' + fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
