/* Google Analytics 4: same consent rules as the Ads tag; page TYPES only (never ids, names, emails); only allowlisted
   campaign parameters; a few plain events; the three landing pages send their own page view; nothing without a Measurement ID. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const CFG_REAL=fs.readFileSync(process.env.ARNOUR_ROOT+'/js/config.js','utf8');
const be=await makeBackend(); const db=be.db; const browser=await chromium.launch();
await db.exec(`alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb`);
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,600):'');}else console.log('ok  ',n); };
const ROOTURL='http://localhost:'+(process.env.PORT_LIVE||8123)+'/';
const NOADS=CFG_REAL.replace(/ads: \{[^}]*\}/,"ads: { id: '', convC: '', convE: '' }");
const GA_ONLY=NOADS.replace(/ga: \{[^}]*\}/,"ga: { id: 'G-TEST12345' }");
const NONE=NOADS.replace(/ga: \{[^}]*\}/,"ga: { id: '' }");
const BOTH=CFG_REAL.replace(/ads: \{[^}]*\}/,"ads: { id: 'AW-123456789', convC: 'AbCdEfGhIjK', convE: 'ZyXwVuTsRq1' }").replace(/ga: \{[^}]*\}/,"ga: { id: 'G-TEST12345' }");
t('the live config holds a well-formed GA4 Measurement ID',/ga: \{ id: 'G-[A-Za-z0-9]{4,20}' \}/.test(CFG_REAL));
async function open(cfg,tz,url,app=true){
  const ctx=await browser.newContext({viewport:{width:1280,height:900},timezoneId:tz});
  const p=await ctx.newPage(); p.__g=[]; p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));
  await p.exposeFunction('__sb',async(raw)=>be.handle(raw));
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/js/config.js*',r=>r.fulfill({contentType:'application/javascript',body:cfg}));
  await p.route('**/*googletagmanager.com/**',r=>{ p.__g.push(r.request().url()); r.fulfill({contentType:'application/javascript',body:'/* tag stand-in */'}); });
  await p.route(/(googleadservices|doubleclick|google-analytics)\.(com|net)|google\.com\/(pagead|ccm)/,r=>{ p.__g.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await p.goto(ROOTURL+url);
  if(app) await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  await p.waitForTimeout(500); return p;
}
const dl=(p)=>p.evaluate(()=>(window.dataLayer||[]).map(a=>Array.from(a)));
const sets=async(p)=>(await dl(p)).filter(a=>a[0]==='set').map(a=>a[1]);
const pv=async(p)=>(await dl(p)).filter(a=>a[0]==='event'&&a[1]==='page_view').map(a=>a[2]);
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(450); };

/* ---- nothing without an ID ---- */
{ const p=await open(NONE,'Asia/Dubai','');
  t('no GA ID: no Google request and no bar',p.__g.length===0&&await p.locator('#consent-bar').count()===0&&await p.evaluate(()=>ArnourConsent.on()===false)); await p.context().close(); }

/* ---- default-on visitor (Dubai), GA only ---- */
{ const p=await open(GA_ONLY,'Asia/Dubai','?utm_source=facebook&utm_medium=group&email=a%40b.com&gclid=ZZ99');
  t('Dubai: GA tag requested with the Measurement ID',p.__g.length===1&&/gtag\/js\?id=G-TEST12345$/.test(p.__g[0]),p.__g);
  const d=await dl(p);
  t('consent: all denied first, then only analytics granted (no ad storage)',d[0][1]==='default'&&d[0][2].analytics_storage==='denied'&&d[0][2].ad_storage==='denied'&&d[1][1]==='update'&&d[1][2].analytics_storage==='granted'&&d[1][2].ad_storage===undefined,d.slice(0,2));
  const cfg=d.find(a=>a[0]==='config'&&a[1]==='G-TEST12345');
  t('GA config: no automatic page view, no Google signals, no ad personalisation',cfg&&cfg[2].send_page_view===false&&cfg[2].allow_google_signals===false&&cfg[2].allow_ad_personalization_signals===false,cfg);
  t('no automatic page view from the Ads config either',(await dl(p)).every(a=>a[0]!=='config'||!/^AW-/.test(a[1])||a[2]&&a[2].send_page_view===false));
  t('no Ads config without an Ads ID',!d.some(a=>a[0]==='config'&&/^AW-/.test(a[1])));
  const st=await sets(p), idxSet=d.findIndex(a=>a[0]==='set'), idxCfg=d.findIndex(a=>a[0]==='config');
  t('the page type is set BEFORE the config calls, so Google\'s own automatic first page view carries it, not the real title or address',idxSet>=0&&idxSet<idxCfg&&st[0].page_path==='/app/landing'&&st[0].page_title==='landing',d.slice(0,6));
  t('that first view has only allowlisted campaign parameters',/utm_source=facebook&utm_medium=group&gclid=ZZ99/.test(st[0].page_location)&&!/email|a%40b|chk/.test(JSON.stringify(st)),st);
  t('no second manual page_view for the first screen',(await pv(p)).length===0,await pv(p));
  await go(p,'#/jobs'); await go(p,'#/job/abc-123-secret'); await go(p,'#/talent/some-person-id'); await go(p,'#/community/q/xyz-999');
  const v2=await pv(p);
  t('later screens are page types: jobs, job-detail, talent-public, community-q',v2.map(x=>x.page_path).join()==='/app/jobs,/app/job-detail,/app/talent-public,/app/community-q',v2.map(x=>x.page_path));
  t('no id, name or email ever reaches Google',!/abc-123|secret|some-person|xyz-999|a%40b/.test(JSON.stringify(await dl(p))));
  t('in-app referrer is the previous page type, without query',v2[0].page_referrer&&!/\?/.test(v2[0].page_referrer),v2[0]);
  await p.evaluate(()=>{ APP.gaEvent('share','','whatsapp'); APP.gaEvent('apply_click'); APP.gaEvent('profile_complete','c'); ArnourConsent.event('login','c'); ArnourConsent.event('share','x@y.com','a b'); });
  const ev=(await dl(p)).filter(a=>a[0]==='event'&&a[1]!=='page_view').map(a=>[a[1],JSON.stringify(a[2])]);
  t('events: share (channel), apply_click, profile_complete (role); unknown names and personal values are dropped',JSON.stringify(ev)===JSON.stringify([['share','{"channel":"whatsapp"}'],['apply_click','{}'],['profile_complete','{"role":"c"}'],['share','{}']]),ev);
  t('privacy page names Google Analytics and the choice',await (async()=>{ await go(p,'#/privacy'); return p.evaluate(()=>/Google Analytics/.test(document.body.innerText)&&/Measurement choice/.test(document.body.innerText)&&/never the job, name or email/.test(document.body.innerText)); })());
  await p.click('[data-action="consent-open"]'); await p.waitForTimeout(300); await p.click('#consent-bar [data-consent="no"]'); await p.waitForTimeout(300);
  const n0=(await pv(p)).length; await go(p,'#/jobs');
  t('switching off: analytics_storage denied and no more page views or events',(await dl(p)).some(a=>a[0]==='consent'&&a[1]==='update'&&a[2].analytics_storage==='denied')&&(await pv(p)).length===n0&&await p.evaluate(()=>ArnourConsent.event('share','','x')===false));
  await p.context().close(); }

/* ---- Europe: asked first ---- */
{ const p=await open(GA_ONLY,'Europe/Berlin','');
  t('Europe: bar shown, no Google request, no data layer, no page view',await p.locator('#consent-bar').count()===1&&p.__g.length===0&&await p.evaluate(()=>typeof window.gtag==='undefined'));
  await go(p,'#/jobs'); t('Europe: moving around before a choice sends nothing',p.__g.length===0&&await p.evaluate(()=>typeof window.gtag==='undefined'));
  await p.click('#consent-bar [data-consent="yes"]'); await p.waitForTimeout(600);
  const st=await sets(p);
  t('Europe: after Accept the tag loads and the current screen is the page type Google sees',p.__g.length===1&&st.length>=1&&st[0].page_path==='/app/jobs'&&(await pv(p)).length===0,{g:p.__g,st});
  await p.context().close(); }
{ const p=await open(GA_ONLY,'Europe/Berlin',''); await p.click('#consent-bar [data-consent="no"]'); await p.waitForTimeout(300); await go(p,'#/jobs');
  t('Europe: Decline keeps Google out for good',p.__g.length===0&&await p.evaluate(()=>typeof window.gtag==='undefined')); await p.context().close(); }

/* ---- both tags together ---- */
{ const p=await open(BOTH,'Asia/Dubai',''); const d=await dl(p);
  t('both IDs: one script, ads and analytics consent granted, both configured',p.__g.length===1&&d[1][2].ad_storage==='granted'&&d[1][2].analytics_storage==='granted'&&d.some(a=>a[0]==='config'&&a[1]==='AW-123456789'&&a[2]&&a[2].send_page_view===false)&&d.some(a=>a[0]==='config'&&a[1]==='G-TEST12345'));
  t('a profile still reports the Ads conversion',await p.evaluate(()=>ArnourConsent.conversion('c'))&&(await dl(p)).some(a=>a[0]==='event'&&a[1]==='conversion')); await p.context().close(); }

/* ---- the static landing pages ---- */
{ const p=await open(GA_ONLY,'Asia/Dubai','sap-jobs/?utm_source=linkedin&utm_medium=group&utm_campaign=x1&token=secret',false);
  const v=await sets(p);
  t('landing page: its own page type with the campaign, nothing else, and no bar',v.length===1&&v[0].page_path==='/sap-jobs/'&&/utm_source=linkedin&utm_medium=group&utm_campaign=x1/.test(v[0].page_location)&&!/secret/.test(JSON.stringify(v))&&await p.locator('#consent-bar').count()===0,v);
  await p.context().close(); }
{ const p=await open(GA_ONLY,'Europe/Berlin','about/',false);
  t('landing page in Europe: nothing is sent and no bar is drawn',p.__g.length===0&&await p.locator('#consent-bar').count()===0&&await p.evaluate(()=>typeof window.gtag==='undefined')); await p.context().close(); }
{ const p=await open(NONE,'Asia/Dubai','sap-consultants/',false);
  t('landing page without an ID: nothing is sent',p.__g.length===0); await p.context().close(); }

await browser.close();
console.log(fails?`FAILS ${fails}`:'all passed'); process.exit(fails?1:0);
