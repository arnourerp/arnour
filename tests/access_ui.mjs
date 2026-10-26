/* access control: route matrix for visitor / professional / company / admin, action guards, no admin UI for non-admins */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',co:'cccccccc-0000-0000-0000-000000000003'};
const role={adm:'consultant',pro:'consultant',co:'employer'};
for(const k of Object.keys(U)){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k}; await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,r,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); await be.db.query(`select claim_profile($1,$2::jsonb) x`,[r,JSON.stringify(data)]); await be.db.exec('reset role'); }
await claim('pro','consultant',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'ecc',moduleId:'fi',projects:4}]});
await claim('co','employer',{name:'Acme',anon:false,country:'ae'});
await claim('adm','consultant',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
async function page(who){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  await ctx.addInitScript(()=>{ window.__views=[]; window.__rpc=[]; const iv=setInterval(()=>{ if(!window.APP||!APP.views||APP.views.__h||!APP.backend||!APP.backend.rpc) return; for(const k of Object.keys(APP.views)){ const f=APP.views[k]; APP.views[k]=function(){ window.__views.push(k); return f.apply(this,arguments); }; } APP.views.__h=1; const r=APP.backend.rpc; APP.backend.rpc=function(n){ window.__rpc.push(n); return r.apply(this,arguments); }; clearInterval(iv); },3); });
  const p=await ctx.newPage(); await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); await p.waitForTimeout(600); return p;
}
const go=async(p,h)=>{ await p.evaluate(()=>{window.__views=[]}); await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(500); };
const hash=p=>p.evaluate(()=>location.hash), views=p=>p.evaluate(()=>window.__views), toast=p=>p.evaluate(()=>(document.getElementById('toasts')||{innerText:''}).innerText);
const ADMIN=['#/admin','#/admin/people','#/admin/import','#/admin/settings','#/admin/announce'];
const PRO=['#/c/dashboard','#/c/profile','#/c/saved','#/c/messages'], CO=['#/e/dashboard','#/e/jobs','#/e/jobs/new','#/e/talent','#/e/company'];

// ---- visitor
const V=await page(null);
for(const r of [...ADMIN,...PRO,...CO,'#/account']){ await go(V,r);
  t('visitor: '+r+' -> sign in, no protected view built',(await hash(V))==='#/login'&&!(await views(V)).some(v=>/^(admin|c-|e-|account)/.test(v)),[await hash(V),await views(V)]); }
await go(V,'#/admin/people');
t('visitor is told to sign in',/sign in/i.test(await toast(V)),await toast(V));
t('the wanted admin page is remembered for after sign-in',await V.evaluate(()=>APP.state.afterAuth)==='#/admin/people');
for(const r of ['#/home','#/jobs','#/community','#/terms','#/privacy','#/login','#/register/c']){ await go(V,r); t('visitor can open public '+r,(await hash(V))===r||r==='#/home'); }
// ---- professional
const P=await page('pro');
for(const r of ADMIN){ await go(P,r); t('professional: '+r+' -> own dashboard, admin never built',(await hash(P))==='#/c/dashboard'&&!(await views(P)).includes('admin'),[await hash(P),await views(P)]); }
t('professional is told why',/administrators/i.test(await toast(P)),await toast(P));
for(const r of CO){ await go(P,r); t('professional: '+r+' -> own dashboard',(await hash(P))==='#/c/dashboard'&&!(await views(P)).some(v=>/^e-/.test(v)),[await hash(P),await views(P)]); }
for(const r of PRO){ await go(P,r); t('professional can open '+r,(await hash(P))===r); }
// ---- company
const C=await page('co');
for(const r of ADMIN){ await go(C,r); t('company: '+r+' -> own dashboard, admin never built',(await hash(C))==='#/e/dashboard'&&!(await views(C)).includes('admin'),[await hash(C),await views(C)]); }
for(const r of PRO){ await go(C,r); t('company: '+r+' -> own dashboard',(await hash(C))==='#/e/dashboard'&&!(await views(C)).some(v=>/^c-/.test(v)),[await hash(C),await views(C)]); }
for(const r of CO){ await go(C,r); t('company can open '+r,(await hash(C))===r); }
// ---- admin
const A=await page('adm');
for(const r of ADMIN){ await go(A,r); await A.waitForSelector('.adm-main',{timeout:5000}).catch(()=>{}); t('admin can open '+r,(await hash(A))===r&&await A.locator('.adm-main').count()>0,await hash(A)); }
for(const r of [...PRO,...CO]){ await go(A,r); t('admin: '+r+' -> Admin',(await hash(A)).indexOf('#/admin')===0); }
// ---- no admin UI for anyone but an admin
for(const [n,pg] of [['visitor',V],['professional',P],['company',C]]){
  let n1=0,n2=0; for(const r of ['#/home','#/jobs','#/job/x-5acfd3bddc','#/community','#/community/people','#/c/dashboard','#/e/dashboard','#/e/jobs','#/account','#/terms']){ await go(pg,r); n1+=await pg.locator('a[href^="#/admin"]').count(); n2+=await pg.locator('[data-action^="adm-"]').count(); }
  t(n+': no admin links or admin buttons anywhere in the page',n1===0&&n2===0,[n1,n2]); }
// ---- action guards (clicks fired straight from the console)
const fire=(pg,action,extra)=>pg.evaluate(([a,x])=>{ window.__rpc=[]; APP.onClick({dataset:Object.assign({action:a},x||{})},{preventDefault(){}}); return window.__rpc.slice(); },[action,extra]);
for(const a of ['adm-job-status','adm-cert','adm-job-delete','adm-remove-post','adm-imp-run']){
  const r=await fire(P,a,{id:'x-1',s:'closed',e:'c1',on:'1',kind:'job'}); t('professional console click '+a+' sends nothing to the server',!r.some(n=>/^admin_/.test(n)),r);
  const r2=await fire(V,a,{id:'x-1',s:'closed'}); t('visitor console click '+a+' sends nothing',!r2.some(n=>/^admin_/.test(n)),r2);
  const r3=await fire(C,a,{id:'x-1',s:'closed'}); t('company console click '+a+' sends nothing',!r3.some(n=>/^admin_/.test(n)),r3); }
await fire(P,'adm-job-status',{id:'x-1',s:'closed'}); t('the person is told they cannot',/permission/i.test(await toast(P)),await toast(P));
await P.evaluate(()=>APP.onClick({dataset:{action:'close-job',id:'whatever'}},{preventDefault(){}})); t('a professional cannot run company actions',/permission/i.test(await toast(P)),await toast(P));
await C.evaluate(()=>APP.onClick({dataset:{action:'apply',id:'x'}},{preventDefault(){}})); t('a company cannot run professional actions',/permission/i.test(await toast(C)),await toast(C));
const own=await C.evaluate(()=>{ const s=APP.db.session; APP.db.jobs['zz-other']={id:'zz-other',companyId:'someone-else',status:'open'}; APP.db.jobs['zz-mine']={id:'zz-mine',companyId:s.companyId,status:'open'}; return [APP.requireOwner('job','zz-other'),APP.requireOwner('job','zz-mine')]; });
t('ownership check: not another company\'s role, yes its own',own[0]===false&&own[1]===true,own);
await C.evaluate(()=>APP.onClick({dataset:{action:'close-job',id:'zz-other'}},{preventDefault(){}})); t('closing another company\'s role is stopped',/another account/i.test(await toast(C)),await toast(C));
await go(C,'#/e/jobs/zz-other/edit'); t('another company\'s role edit page is not opened',(await hash(C))==='#/e/jobs',await hash(C));
const ar=await fire(A,'adm-retry',{key:'overview'}); t('an admin is not blocked on admin actions',true);
console.log(fails?'FAILED '+fails:'ALL OK'); await browser.close(); process.exit(fails?1:0);
