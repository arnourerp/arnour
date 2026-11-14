/* Returning, signed-in visitors: the top bar and a page outline show at once (no logo screen), the real page replaces them
   when the data arrives, and nothing on screen moves (layout shift 0). First-time visitors, the admin, people without a
   profile and sign-in links keep the old behaviour. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',co:'cccccccc-0000-0000-0000-000000000003',np:'dddddddd-0000-0000-0000-000000000004'};
const role={adm:'consultant',pro:'consultant',co:'employer',np:'consultant'};
for(const k of Object.keys(U)){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:4}]});
await claim('co',{name:'Crescent Test',industry:'Retail',country:'ae',city:'Dubai',size:'51-200',about:'We run SAP.',companyType:'customer'});

/* one browser context per person; "hold" keeps every data call waiting so the outline can be looked at */
async function ctxFor(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  await ctx.addInitScript(()=>{ window.__cls=0; window.__shifts=[]; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(!e.hadRecentInput){ window.__cls+=e.value; window.__shifts.push(e.value); } }).observe({type:'layout-shift',buffered:true}); }catch(e){} });
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')&&!sessionStorage.getItem('signed-out')) { localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); localStorage.setItem('sb-mock-auth-token','1'); } }catch(e){} },[U[who],who+'@t.com',role[who]]);
  ctx.__who=who||'visitor'; ctx.__hold=null;
  return ctx;
}
async function open(ctx,url,{hold=false,wait=true}={}){
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(ctx.__who+': '+m.text()); });
  p.on('pageerror',e=>errors.push(ctx.__who+' PAGEERR: '+e.message));
  let release; const gate=hold?new Promise(r=>{release=r;}):null; p.__release=()=>release&&release();
  await p.exposeFunction('__sb',async(...a)=>{ if(gate) await gate; return be.handle(...a); });
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(url||BASE);
  if(wait&&!hold) await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  return p;
}
const ready=(p)=>p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready&&!document.querySelector('.sk-main'),null,{timeout:10000});
const hint=(p)=>p.evaluate(()=>localStorage.getItem('arnour-shell'));
const shellOn=(p)=>p.evaluate(()=>({nav:!!document.querySelector('#app .sk-nav'),main:!!document.querySelector('#app main.sk-main[aria-busy="true"]'),cards:document.querySelectorAll('#app .sk-main .skel-card').length,splash:!!document.querySelector('#app .live-splash'),flag:!!(window.APP&&APP.backend&&APP.backend.shell),navH:(document.querySelector('#app .nav')||{offsetHeight:0}).offsetHeight,status:(document.querySelector('#app [role="status"]')||{textContent:''}).textContent}));

/* ---- first-time visitor: unchanged ---- */
{ const c=await ctxFor(null); const p=await open(c);
  t('visitor: no outline, no hint stored',!(await shellOn(p)).nav&&(await hint(p))===null);
  await c.close(); }

/* ---- professional ---- */
const PC=await ctxFor('pro');
{ const p=await open(PC,BASE,{hold:true});
  await p.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app').children.length>0);
  const s=await shellOn(p);
  t('professional, first visit on this browser: logo screen as before (no hint yet)',s.splash&&!s.nav,s);
  p.__release(); await ready(p);
  t('after loading, the kind of account is remembered (c)',(await hint(p))==='c');
  t('nothing personal is stored for it',await p.evaluate(()=>localStorage.getItem('arnour-shell').length===1));
  await p.close(); }
let realNavH=0;
{ const p=await open(PC,BASE+'#/c/dashboard',{hold:true});
  await p.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app .sk-nav'),null,{timeout:8000});
  const s=await shellOn(p);
  t('professional, returning: top bar and page outline at once, no logo screen',s.nav&&s.main&&s.cards===3&&!s.splash&&s.flag,s);
  t('the outline says it is loading (for screen readers)',/Loading Arnour/.test(s.status));
  t('professional outline has two menu placeholders',await p.locator('#app .sk-nav .sk-link').count()===2);
  t('the data has not arrived yet',await p.evaluate(()=>!APP.backend.ready));
  const before=await p.evaluate(()=>window.__cls);
  p.__release(); await ready(p); await p.waitForTimeout(600);
  const after=await p.evaluate(()=>({cls:window.__cls,shifts:window.__shifts,nav:!!document.querySelector('#app header.nav:not(.sk-nav)'),navH:document.querySelector('#app header.nav').offsetHeight,dash:location.hash,flag:APP.backend.shell}));
  realNavH=after.navH;
  t('the real page replaces the outline',after.nav&&after.dash==='#/c/dashboard'&&after.flag===false,after);
  t('top bar keeps its height ('+s.navH+' px outline, '+after.navH+' px real)',s.navH===after.navH&&s.navH>0);
  t('layout shift from first paint to the real page is 0',before===0&&after.cls===0,after);
  await p.close(); }

/* the outline is painted by index.html itself, before the app scripts have loaded */
{ const p=await PC.newPage(); let letGo; const wait=new Promise(r=>{letGo=r;});
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/js/core.js*',async r=>{ await wait; r.continue(); });
  p.goto(BASE+'#/c/jobs').catch(()=>{});
  await p.waitForSelector('#boot-splash.boot-shell .sk-nav',{timeout:8000});
  t('before the scripts load: the outline is already on screen',await p.evaluate(()=>typeof window.APP==='undefined'&&!!document.querySelector('#boot-splash .sk-main')&&!document.querySelector('#boot-splash .brand-logo.lg')));
  letGo(); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready&&!document.querySelector('.sk-main'),null,{timeout:10000}); await p.waitForTimeout(500);
  t('then the real page, still with layout shift 0',await p.evaluate(()=>window.__cls===0&&!document.getElementById('boot-splash')&&!!document.querySelector('#app header.nav:not(.sk-nav)')),await p.evaluate(()=>window.__shifts));
  await p.close(); }

/* phone */
{ const c=await ctxFor('pro',390,800); const p0=await open(c); await p0.close();
  const p=await open(c,BASE+'#/c/jobs',{hold:true});
  await p.waitForSelector('#app .sk-nav',{timeout:8000});
  const s=await p.evaluate(()=>({w:document.documentElement.scrollWidth,vw:innerWidth,links:[...document.querySelectorAll('#app .sk-link')].filter(e=>e.offsetParent).length}));
  t('phone: outline fits the screen (no sideways scroll), menu placeholders hidden like the real menu',s.w<=s.vw&&s.links===0,s);
  p.__release(); await ready(p); await p.waitForTimeout(500);
  t('phone: layout shift 0',await p.evaluate(()=>window.__cls===0),await p.evaluate(()=>window.__shifts));
  await c.close(); }

/* sign-in links and pages without the top bar keep the logo screen */
{ const p=await open(PC,BASE.replace('index.html','')+'?code=abc',{hold:true});
  await p.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app').children.length>0);
  t('a sign-in link (?code=) never shows the outline',!(await shellOn(p)).nav);
  await p.close();
  const q=await open(PC,BASE+'#/reset',{hold:true});
  await q.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app').children.length>0);
  t('#/reset never shows the outline',!(await shellOn(q)).nav);
  await q.close(); }

/* sign-out forgets the hint */
{ const p=await open(PC,BASE+'#/c/dashboard');
  await p.evaluate(()=>{ sessionStorage.setItem('signed-out','1'); return APP.backend.signOut(); });
  t('sign-out removes the hint',(await hint(p))===null);
  await p.close(); }

/* company */
{ const c=await ctxFor('co'); const p0=await open(c);
  t('company: remembered as e',(await hint(p0))==='e'); await p0.close();
  const p=await open(c,BASE+'#/e/dashboard',{hold:true});
  await p.waitForSelector('#app .sk-nav',{timeout:8000});
  t('company outline has three menu placeholders',await p.locator('#app .sk-nav .sk-link').count()===3);
  p.__release(); await ready(p); await p.waitForTimeout(500);
  t('company: real page, layout shift 0',await p.evaluate(()=>window.__cls===0&&!!document.querySelector('#app header.nav:not(.sk-nav)')),await p.evaluate(()=>window.__shifts));
  await c.close(); }

/* admin and people without a profile: no hint, logo screen */
for (const [who,label] of [['adm','admin'],['np','account without a profile']]) {
  const c=await ctxFor(who); const p0=await open(c);
  t(label+': no hint stored',(await hint(p0))===null); await p0.close();
  const p=await open(c,BASE,{hold:true});
  await p.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app').children.length>0);
  t(label+': logo screen, no outline',!(await shellOn(p)).nav);
  p.__release(); await c.close(); }

/* a stale hint with a sign-in that no longer works: outline, then the public page, hint removed, no errors */
{ const c=await browser.newContext({viewport:{width:1280,height:900}});
  await c.addInitScript(()=>{ if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1'); localStorage.setItem('arnour-shell','c'); localStorage.setItem('sb-mock-auth-token','stale'); } });
  c.__who='stale'; const p=await open(c,BASE+'#/c/dashboard',{hold:true});
  await p.waitForSelector('#app .sk-nav',{timeout:8000});
  p.__release(); await ready(p); await p.waitForTimeout(400);
  const s=await p.evaluate(()=>({hint:localStorage.getItem('arnour-shell'),sk:!!document.querySelector('.sk-main'),hash:location.hash,ses:!!APP.db.session}));
  t('stale sign-in: ends on a public page and forgets the hint',s.hint===null&&!s.sk&&!s.ses,s);
  await c.close(); }

/* a damaged hint is ignored */
{ const c=await ctxFor('pro'); await c.addInitScript(()=>{ try{ localStorage.setItem('arnour-shell','<img src=x onerror=alert(1)>'); }catch(e){} });
  const p=await open(c,BASE+'#/c/dashboard',{hold:true});
  await p.waitForFunction(()=>window.APP&&APP.backend&&document.querySelector('#app').children.length>0);
  t('a damaged hint is ignored (logo screen, nothing injected)',!(await shellOn(p)).nav&&await p.evaluate(()=>!document.querySelector('#app img[src="x"]')));
  p.__release(); await c.close(); }

t('no page errors',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
