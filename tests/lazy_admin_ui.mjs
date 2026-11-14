/* The admin area (js/admin.js) is fetched only for an administrator; everyone else never downloads it.
   The Report button (js/report.js) still works for ordinary people, and admin actions still pass the access guard. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',two:'dddddddd-0000-0000-0000-000000000004'};
for(const k of ['adm','pro','two']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,['consultant',JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
const prof=(fn)=>({firstName:fn,lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:4}]});
await claim('pro',prof('Pia')); const twoId=await claim('two',prof('Tom'));
async function page(who){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  if(who) await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U[who],who+'@t.com']);
  const p=await ctx.newPage(); p.__req=[];
  p.on('request',r=>{ if(/\/js\/[^?]+\.js/.test(r.url())) p.__req.push(r.url()); });
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const got=(p,f)=>p.__req.filter(u=>u.includes('/js/'+f+'.js'));

/* visitor */
const V=await page(null);
await go(V,'#/jobs'); await go(V,'#/admin');
t('visitor: admin.js is never downloaded',got(V,'admin').length===0,V.__req);
t('visitor: #/admin does not open',await V.evaluate(()=>!document.querySelector('.adm-main')&&!/^#\/admin/.test(location.hash)),await V.evaluate(()=>location.hash));
t('visitor: report.js is on the page, with the version',got(V,'report').length===1&&/report\.js\?v=[a-f0-9]{10}$/.test(got(V,'report')[0]),got(V,'report'));

/* professional */
const P=await page('pro');
await go(P,'#/c/dashboard'); await go(P,'#/admin'); await go(P,'#/community');
t('professional: admin.js is never downloaded',got(P,'admin').length===0&&await P.evaluate(()=>!APP.adminLoaded),P.__req);
t('professional: #/admin sends them home',await P.evaluate(()=>!/^#\/admin/.test(location.hash)));
await go(P,'#/talent/'+twoId);
const hasReport=await P.locator('[data-action="report"]').count();
t('professional: the Report button is still there',hasReport>0,await P.evaluate(()=>location.hash));
if(hasReport){ await P.locator('[data-action="report"]').first().click(); await P.waitForTimeout(300);
  t('professional: the Report dialog opens with its reasons',await P.locator('#dlg-sel option').count()===6); }

/* administrator */
const A=await page('adm');
t('admin: admin.js downloaded once, with the version',got(A,'admin').length===1&&/admin\.js\?v=[a-f0-9]{10}$/.test(got(A,'admin')[0]),got(A,'admin'));
t('admin: it is loaded before the first page is drawn',await A.evaluate(()=>APP.adminLoaded===true));
await go(A,'#/admin'); await A.waitForSelector('.adm-main h1');
t('admin: the admin area opens',await A.locator('.adm-group').count()===5);
await go(A,'#/admin/health'); await go(A,'#/admin/people');
t('admin: moving between tabs does not download it again',got(A,'admin').length===1);
/* admin actions still go through the access guard of main.js, although the file arrived after it */
const guarded=await A.evaluate(()=>{ const seen=[]; const g=APP.guardAction; APP.guardAction=function(a,d){ seen.push(a); return g.apply(this,arguments); };
  const el=document.createElement('button'); el.dataset.action='adm-menu'; APP.onClick(el,{preventDefault(){}}); APP.guardAction=g; return seen; });
t('admin: an admin action passes the guard first',guarded.length===1&&guarded[0]==='adm-menu',guarded);
const blocked=await A.evaluate(()=>{ const g=APP.guardAction; let ran=false; const inner=APP._click; APP._click=function(){ ran=true; return inner.apply(this,arguments); };
  APP.guardAction=function(){ return false; }; const el=document.createElement('button'); el.dataset.action='adm-menu'; APP.onClick(el,{preventDefault(){}}); APP.guardAction=g; APP._click=inner; return ran; });
t('admin: a refused action never reaches the admin code',blocked===false);

/* slow or failed download: #/admin shows a note, then the area */
const ctx=await browser.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript(([id,em])=>{ localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); },[U.adm,'adm@t.com']);
const F=await ctx.newPage(); let failOnce=true;
F.on('pageerror',e=>errors.push('fail-page PAGEERR: '+e.message));
await F.exposeFunction('__sb',be.handle);
await F.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
await F.route('**/fonts.googleapis.com/**',r=>r.abort());
await F.route('**/js/admin.js*',r=>{ if(failOnce){ failOnce=false; return r.abort(); } return r.continue(); });
await F.goto(BASE+'#/admin'); await F.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
await F.waitForFunction(()=>document.querySelector('.adm-wait')||document.querySelector('.adm-main'),null,{timeout:8000});
await F.waitForSelector('.adm-main h1',{timeout:8000});
t('admin: a failed download is tried again when #/admin opens',await F.locator('.adm-group').count()===5);

t('no page errors',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
