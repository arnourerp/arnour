/* Consent for ad measurement: nothing without a Google Ads ID; with one, a bar that defaults to NO (no Google script, no cookie,
   nothing sent until Accept), a remembered choice, the conversion only with consent, and the per-campaign table for the admin. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const CFG_REAL=fs.readFileSync(process.env.ARNOUR_ROOT+'/js/config.js','utf8');
const ADS_RE=/ads: \{[^}]*\}/;
/* the live config now carries the real Ads values, so every case below starts from a copy with the Ads line emptied */
const GA_RE=/ga: \{[^}]*\}/;
const CFG=CFG_REAL.replace(ADS_RE,"ads: { id: '', convC: '', convE: '' }").replace(GA_RE,"ga: { id: '' }");
const be=await makeBackend(); const db=be.db; const browser=await chromium.launch();
await db.exec(`alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb`);
for (const f of ['024_traffic','033_campaigns']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');}else console.log('ok  ',n); };
const errors=[]; const ROOTURL='http://localhost:'+(process.env.PORT_LIVE||8123)+'/';
const withAds=CFG.replace("ads: { id: '', convC: '', convE: '' }","ads: { id: 'AW-123456789', convC: 'AbCdEfGhIjK', convE: 'ZyXwVuTsRq1' }");
t('the test can switch the Ads ID on in config.js',withAds!==CFG&&ADS_RE.test(CFG_REAL));
t('the live config holds a well-formed Ads ID and two labels, or all three empty',(()=>{const m=CFG_REAL.match(/ads: \{ id: '([^']*)', convC: '([^']*)', convE: '([^']*)' \}/); if(!m) return false; if(!m[1]&&!m[2]&&!m[3]) return true; return /^AW-\d{6,}$/.test(m[1])&&/^[A-Za-z0-9_-]{10,}$/.test(m[2])&&/^[A-Za-z0-9_-]{10,}$/.test(m[3])&&m[2]!==m[3];})(),CFG_REAL.match(ADS_RE));
let TZ_ID='Europe/Berlin'; /* European visitors are asked first; the default-on cases below switch this to Dubai or Cairo */
async function page(ads,who,query,init){
  const ctx=await browser.newContext({viewport:{width:1280,height:900},timezoneId:TZ_ID});
  await ctx.addInitScript(()=>{ window.__cls=0; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value; }).observe({type:'layout-shift',buffered:true}); }catch(e){} });
  if(init) await ctx.addInitScript(init);
  if(who) await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },who);
  const p=await ctx.newPage(); p.__g=[]; p.__calls=[];
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',async(raw)=>{ try{ const op=JSON.parse(raw); if(op&&op.t==='rpc') p.__calls.push([op.fn,op.args]); }catch(e){} return be.handle(raw); });
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/js/config.js*',r=>r.fulfill({contentType:'application/javascript',body:ads?withAds:CFG}));
  await p.route('**/*googletagmanager.com/**',r=>{ p.__g.push(r.request().url()); r.fulfill({contentType:'application/javascript',body:'/* google tag stand-in */'}); });
  await p.route(/(googleadservices|doubleclick|google-analytics)\.(com|net)|google\.com\/(pagead|ccm)/,r=>{ p.__g.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await p.goto(ROOTURL+(query||'')); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); await p.waitForTimeout(300); return p;
}
const cookies=async(p)=>(await p.context().cookies()).map(c=>c.name);

/* ---- no Ads ID (today's live setting): nothing at all ---- */
{ const p=await page(false,null,'?gclid=Cj0TESTclick&utm_source=google&utm_medium=cpc&utm_campaign=eg-sap-consultants');
  t('no ID: no bar, no Google request, no cookie, no footer link',await p.locator('#consent-bar').count()===0&&p.__g.length===0&&(await cookies(p)).length===0&&await p.evaluate(()=>!document.querySelector('[data-action="consent-open"]')));
  t('no ID: a conversion call does nothing',await p.evaluate(()=>ArnourConsent.conversion('c')===false&&typeof window.gtag==='undefined'&&ArnourConsent.on()===false));
  await p.evaluate(()=>{location.hash='#/privacy'}); await p.waitForTimeout(300);
  t('no ID: the privacy page still says no advertising cookies',await p.evaluate(()=>/We do not use advertising cookies or third-party tracking/.test(document.body.innerText)));
  t('the campaign of a new visitor is counted once',p.__calls.filter(c=>c[0]==='track_usage'&&c[1].p_name==='lc:eg-sap-consultants').length===1&&p.__calls.filter(c=>c[0]==='track_usage'&&c[1].p_name==='lnd:google').length===1);
  await p.context().close(); }

/* ---- with an Ads ID ---- */
{ const p=await page(true,null,'?gclid=Cj0TESTclick&utm_source=google&utm_medium=cpc&utm_campaign=eg-sap-consultants');
  const bar=await p.evaluate(()=>{ const b=document.getElementById('consent-bar'); if(!b) return null; const bs=[...b.querySelectorAll('button')]; const r=b.getBoundingClientRect(); return {txt:b.textContent,btns:bs.map(x=>x.textContent),same:bs[0].className===bs[1].className,fixed:getComputedStyle(b).position,inView:r.bottom<=innerHeight&&r.top>0,w0:bs[0].offsetWidth,w1:bs[1].offsetWidth}; });
  t('with an ID: the bar shows, with Decline and Accept looking the same',!!bar&&bar.btns.join('|')==='Decline|Accept'&&bar.same&&Math.abs(bar.w0-bar.w1)<=2&&/Privacy/.test(bar.txt),bar);
  t('the bar floats (fixed), inside the screen, and moves nothing (layout shift 0)',bar.fixed==='fixed'&&bar.inView&&await p.evaluate(()=>window.__cls===0));
  t('before any choice: no Google request, no cookie, no gtag',p.__g.length===0&&(await cookies(p)).length===0&&await p.evaluate(()=>typeof window.gtag==='undefined'&&!window.dataLayer));
  t('before any choice: a conversion is not sent',await p.evaluate(()=>ArnourConsent.conversion('c')===false)&&p.__g.length===0);
  await p.evaluate(()=>{location.hash='#/jobs'}); await p.waitForTimeout(300);
  t('the site is fully usable with the bar open, and it stays until answered',await p.locator('#consent-bar').count()===1&&await p.locator('#tf-results').count()===1);
  await p.click('#consent-bar [data-consent="no"]'); await p.waitForTimeout(300);
  t('Decline: bar gone, choice remembered, still nothing loaded or stored for Google',await p.locator('#consent-bar').count()===0&&await p.evaluate(()=>JSON.parse(localStorage.getItem('arnour-consent')).v==='no')&&p.__g.length===0&&(await cookies(p)).length===0);
  await p.reload(); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await p.waitForTimeout(300);
  t('after Decline the bar does not come back on the next visit',await p.locator('#consent-bar').count()===0&&p.__g.length===0);
  t('the footer has a link to change the choice',await p.locator('[data-action="consent-open"]').count()===1);
  await p.click('[data-action="consent-open"]'); await p.waitForTimeout(200);
  t('the link opens the bar again',await p.locator('#consent-bar').count()===1);
  await p.click('#consent-bar [data-consent="yes"]'); await p.waitForTimeout(500);
  t('Accept: the Google tag is requested with the ID',p.__g.length===1&&/gtag\/js\?id=AW-123456789$/.test(p.__g[0]),p.__g);
  const dl=await p.evaluate(()=>window.dataLayer.map(a=>Array.from(a)));
  t('consent is set to denied first, then granted for ad measurement only (no personalisation)',dl[0][0]==='consent'&&dl[0][1]==='default'&&dl[0][2].ad_storage==='denied'&&dl[0][2].ad_personalization==='denied'&&dl[1][1]==='update'&&dl[1][2].ad_storage==='granted'&&dl[1][2].ad_user_data==='granted'&&!('ad_personalization' in dl[1][2])&&dl.some(a=>a[0]==='config'&&a[1]==='AW-123456789'),dl.slice(0,3));
  t('the ad click noted on the first visit is handed to the tag (cookie _gcl_aw)',await p.evaluate(()=>/(^|; )_gcl_aw=GCL\.\d{10}\.Cj0TESTclick/.test(document.cookie)),await p.evaluate(()=>document.cookie));
  t('a professional profile is reported with its label',await p.evaluate(()=>ArnourConsent.conversion('c'))&&await p.evaluate(()=>{ const e=window.dataLayer.map(a=>Array.from(a)).filter(a=>a[0]==='event'); return e.length===1&&e[0][1]==='conversion'&&e[0][2].send_to==='AW-123456789/AbCdEfGhIjK'; }));
  t('a company profile uses the other label',await p.evaluate(()=>ArnourConsent.conversion('e'))&&await p.evaluate(()=>window.dataLayer.map(a=>Array.from(a)).filter(a=>a[0]==='event')[1][2].send_to==='AW-123456789/ZyXwVuTsRq1'));
  await p.evaluate(()=>{location.hash='#/privacy'}); await p.waitForTimeout(300);
  t('with an ID the privacy page explains the Google measurement and the choice',await p.evaluate(()=>/send nothing unless you press Accept/.test(document.body.innerText)&&/switch this off, or on, at any time/.test(document.body.innerText)&&/Measurement choice/.test(document.body.innerText)&&!/We do not use advertising cookies or third-party tracking/.test(document.body.innerText)));
  await p.reload(); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await p.waitForTimeout(400);
  t('on the next visit the tag loads without asking again',await p.locator('#consent-bar').count()===0&&p.__g.filter(u=>/gtag\/js/.test(u)).length===2);
  await p.click('[data-action="consent-open"]'); await p.click('#consent-bar [data-consent="no"]'); await p.waitForTimeout(200);
  t('changing to Decline is remembered and conversions stop',await p.evaluate(()=>JSON.parse(localStorage.getItem('arnour-consent')).v==='no'&&ArnourConsent.conversion('c')===false));
  await p.context().close(); }
/* ---- visitors outside Europe: measured by default, no bar, anyone can switch it off ---- */
for (const tz of ['Asia/Dubai','Africa/Cairo','Asia/Riyadh']) {
  TZ_ID=tz;
  const p=await page(true,null,''); /* no campaign on these links: the per-campaign table below counts the tagged visits above and must not change */
  t(tz+': no bar, and the Google tag is requested by default with the ID',await p.locator('#consent-bar').count()===0&&p.__g.filter(u=>/gtag\/js\?id=AW-123456789$/.test(u)).length===1,p.__g);
  const dl=await p.evaluate(()=>(window.dataLayer||[]).map(a=>Array.from(a)));
  t(tz+': consent is for ad measurement only (no personalisation)',dl.length>1&&dl[0][1]==='default'&&dl[0][2].ad_personalization==='denied'&&dl[1][1]==='update'&&dl[1][2].ad_storage==='granted'&&!('ad_personalization' in dl[1][2]),dl.slice(0,3));
  t(tz+': a finished profile is reported without any choice made',await p.evaluate(()=>ArnourConsent.conversion('c'))&&await p.evaluate(()=>window.dataLayer.map(a=>Array.from(a)).filter(a=>a[0]==='event').slice(-1)[0][2].send_to==='AW-123456789/AbCdEfGhIjK'));
  t(tz+': nothing about a choice is stored until the person makes one',await p.evaluate(()=>localStorage.getItem('arnour-consent')===null));
  t(tz+': the footer link to switch it off is there',await p.locator('[data-action="consent-open"]').count()===1);
  await p.evaluate(()=>{location.hash='#/privacy'}); await p.waitForTimeout(300);
  t(tz+': the privacy page says the tag is loaded on a visit, asks first in Europe, and names the switch',await p.evaluate(()=>/tag is loaded when you visit/.test(document.body.innerText)&&/we ask first and send nothing unless you press Accept/.test(document.body.innerText)&&/Measurement choice/.test(document.body.innerText)));
  if (tz==='Asia/Dubai') {
    await p.click('[data-action="consent-open"]'); await p.waitForTimeout(200);
    t('Dubai: the footer link opens the bar so the person can switch measurement off',await p.locator('#consent-bar').count()===1);
    await p.click('#consent-bar [data-consent="no"]'); await p.waitForTimeout(300);
    t('Dubai: switching off is remembered, conversions stop and the bar is gone',await p.evaluate(()=>JSON.parse(localStorage.getItem('arnour-consent')).v==='no'&&ArnourConsent.conversion('c')===false)&&await p.locator('#consent-bar').count()===0);
    const before=p.__g.length;
    await p.reload(); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await p.waitForTimeout(400);
    t('Dubai: after switching off, the next visit loads no Google tag and shows no bar',p.__g.length===before&&await p.locator('#consent-bar').count()===0&&await p.evaluate(()=>ArnourConsent.conversion('c')===false));
  }
  await p.context().close();
}
TZ_ID='Europe/Berlin';
/* a visitor whose time zone is in Europe is asked first, in a few places */
for (const tz of ['Europe/London','Europe/Paris','Atlantic/Canary']) {
  TZ_ID=tz; const p=await page(true,null,'');
  t(tz+': asked first: bar shown, no Google request, conversion not sent',await p.locator('#consent-bar').count()===1&&p.__g.length===0&&await p.evaluate(()=>ArnourConsent.conversion('c')===false&&typeof window.gtag==='undefined'));
  await p.context().close();
}
TZ_ID='Europe/Berlin';
/* a profile completed in the app calls the conversion (accepted beforehand) */
{ const p=await page(true,null,'',()=>{ try{ localStorage.setItem('arnour-consent',JSON.stringify({v:'yes',t:Date.now()})); }catch(e){} });
  await p.evaluate(()=>{ APP.backend.noteProfileDone('consultant'); APP.backend.noteProfileDone('employer'); });
  const ev=await p.evaluate(()=>window.dataLayer.map(a=>Array.from(a)).filter(a=>a[0]==='event').map(a=>a[2].send_to));
  t('finishing a profile reports the conversion (professional, then company)',JSON.stringify(ev)==='["AW-123456789/AbCdEfGhIjK","AW-123456789/ZyXwVuTsRq1"]',ev);
  await p.context().close(); }
/* a wrong ID is ignored */
{ const ctx=await browser.newContext(); const p=await ctx.newPage(); let g=0;
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/js/config.js*',r=>r.fulfill({contentType:'application/javascript',body:CFG.replace("ads: { id: '', convC: '', convE: '' }","ads: { id: 'https://evil.test/x.js', convC: '\"><script>', convE: '' }")}));
  await p.route(/googletagmanager|googleadservices|doubleclick/,r=>{ g++; r.abort(); });
  await p.goto(ROOTURL); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  t('a value that is not a Google Ads ID switches nothing on',await p.locator('#consent-bar').count()===0&&g===0&&await p.evaluate(()=>ArnourConsent.on()===false));
  await ctx.close(); }

/* ---- the per-campaign table for the admin ---- */
{ const uid=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
  const mk=async(n,meta)=>{ be.users['u'+n+'@t.com']={id:uid(n),email:'u'+n+'@t.com',password:'x',confirmed:true,meta:{},token:'t'+n}; await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)`,[uid(n),'u'+n+'@t.com',JSON.stringify(meta)]); };
  await mk(1,{}); await db.query(`insert into admin_emails(email) values ('u1@t.com')`);
  const g={s:'google',m:'cpc',c:'eg-sap-consultants',gc:'Cj0abc',b:'google'};
  await mk(10,{role:'consultant',ft:g}); await mk(11,{role:'consultant',ft:g}); await mk(12,{role:'consultant',ft:{s:'facebook',m:'group',c:'eg-sap-jobs',b:'facebook'}});
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid(10)}',false); set role authenticated;`); await db.query(`select claim_profile('consultant','{"firstName":"A","lastName":"A"}'::jsonb)`); await db.exec('reset role');
  const p=await page(false,[uid(1),'u1@t.com']);
  await p.evaluate(()=>{location.hash='#/admin/traffic'}); await p.waitForSelector('#adm-campaigns',{timeout:8000});
  const rows=await p.evaluate(()=>[...document.querySelectorAll('#adm-campaigns tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent.trim())));
  const r=rows.find(x=>/^eg-sap-consultants/.test(x[0]));
  t('Admin > Traffic shows the campaign with visitors (the two tagged visits above), accounts and profiles',!!r&&r[1]==='2'&&r[2]==='2'&&r[3]==='1'&&r[4]===''&&r[5]==='50%'&&/google \/ cpc/.test(r[0])&&/2 from a Google ad click/.test(r[0]),rows);
  t('and the Facebook campaign without visitors counted',rows.some(x=>/^eg-sap-jobs/.test(x[0])&&x[2]==='1'&&x[5]==='—'),rows);
  await p.context().close(); }

t('no page errors',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
