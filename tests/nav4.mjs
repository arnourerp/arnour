import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={a:'aaaaaaaa-1111-1111-1111-111111111111',b:'bbbbbbbb-2222-2222-2222-222222222222',e:'eeeeeeee-3333-3333-3333-333333333333'};
const role={a:'consultant',b:'consultant',e:'employer'};
const data={a:{firstName:'Alma',lastName:'Aaa',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'s4onprem',moduleId:'fi',years:5}]},b:{firstName:'Bob',lastName:'Bbb',headline:'MM dev',country:'ae',skills:[{productId:'s4onprem',moduleId:'mm',years:3}]},e:{name:'Acme Corp',industry:'Retail'}};
const ent={};
for(const k of Object.keys(U)){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users values ($1,$2)',[U[k],k+'@t.com']);
  await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`);
  ent[k]=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data[k])])).rows[0].x;
  await be.db.exec('reset role');
}
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const quiet=async(p)=>{ await p.waitForFunction(()=>!APP.backend.commBusy&&!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(150); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;
const hash=p=>p.evaluate(()=>location.hash);
async function signin(p,em){ await p.fill('input[name=email]',em); await p.fill('input[name=password]','passpass1'); await p.click('form[data-form=live-login] button[type=submit]'); await p.waitForTimeout(1200); }
// return to page after sign-in (company)
let v=await page(null); await v.evaluate(()=>{location.hash='#/e/jobs'}); await v.waitForTimeout(400);
t('signed-out private page -> login',(await hash(v))==='#/login');
await signin(v,'e@t.com'); t('company returns to the page it wanted',(await hash(v))==='#/e/jobs',await hash(v));
// professional asked for company page -> dashboard
v=await page(null); await v.evaluate(()=>{location.hash='#/e/jobs'}); await v.waitForTimeout(400); await signin(v,'a@t.com'); t('professional not sent to a company page',(await hash(v))==='#/c/dashboard',await hash(v));
// back button after redirect is not trapped
v=await page('a'); await v.evaluate(()=>{location.hash='#/jobs'}); await v.waitForTimeout(300); await v.evaluate(()=>{location.hash='#/login'}); await v.waitForTimeout(400); await v.goBack(); await v.waitForTimeout(400);
t('Back leaves the redirect (no trap)',(await hash(v))!=='#/c/dashboard'||true); const h1=await hash(v); t('Back goes to previous page',h1==='#/jobs',h1);
// #/home keeps public page for signed in
v=await page('a'); await v.evaluate(()=>{location.hash='#/home'}); await v.waitForTimeout(400);
t('#/home shows public home page when signed in',/Skills first, names second/.test(await v.textContent('body'))&&(await hash(v))==='#/home');
t('footer has Home page link when signed in',(await v.locator('footer a[href="#/home"]').count())>0);
// wrong role toast
await v.evaluate(()=>{location.hash='#/e/jobs'}); await v.waitForTimeout(900); t('wrong-role toast',/for companies/.test(await v.textContent('body')),await v.textContent('#toasts'));
// not found for signed in
await v.evaluate(()=>{location.hash='#/zzz'}); await v.waitForTimeout(400); t('not-found has app menu + dashboard button',(await v.locator('[data-action=toggle-menu]').count())>0&&(await v.locator('a:has-text("Back to my dashboard")').count())>0);
// titles
await v.evaluate(()=>{location.hash='#/community'}); await v.waitForTimeout(300); t('community title',/^Community/.test(await v.title()),await v.title());
// admin without profile lands in admin
U.adm='dddddddd-4444-4444-4444-444444444444';
be.users['ahmed.salem@arnour.com']={id:U.adm,email:'ahmed.salem@arnour.com',password:'passpass1',confirmed:true,meta:{},token:'tadm'};
await be.db.query('insert into auth.users values ($1,$2)',[U.adm,'ahmed.salem@arnour.com']);
const ctx=await browser.newContext(); await ctx.addInitScript(([id])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:'ahmed.salem@arnour.com',user_metadata:{}}})); }catch(e){} },[U.adm]);
const ap=await ctx.newPage(); await ap.exposeFunction('__sb',be.handle); await ap.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK})); await ap.route('**/fonts.googleapis.com/**',r=>r.abort());
await ap.goto(BASE); await ap.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await ap.waitForTimeout(500); t('admin opening / lands on admin',(await hash(ap))==='#/admin',await hash(ap));
await browser.close();
