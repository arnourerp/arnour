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
U.adm='dddddddd-4444-4444-4444-444444444444';
be.users['ahmed.salem@arnour.com']={id:U.adm,email:'ahmed.salem@arnour.com',password:'passpass1',confirmed:true,meta:{},token:'tadm'};
await be.db.query('insert into auth.users values ($1,$2)',[U.adm,'ahmed.salem@arnour.com']);
const ctxA=await browser.newContext({viewport:{width:1280,height:900}});
await ctxA.addInitScript(([id])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:'ahmed.salem@arnour.com',user_metadata:{}}})); }catch(e){} },[U.adm]);
const ad=await ctxA.newPage(); ad.on('pageerror',e=>errors.push('adm PAGEERR: '+e.message));
await ad.exposeFunction('__sb',be.handle); await ad.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK})); await ad.route('**/fonts.googleapis.com/**',r=>r.abort());
await ad.goto(BASE); await ad.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready);
// a real professional upvotes a sample question (their votes list sample authors as "people")
await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U.a}',false); set role authenticated;`);
await be.db.query(`select set_vote('q','q1',true)`);
await be.db.exec('reset role');
t('vote recorded',(await be.db.query('select count(*)::int n from votes')).rows[0].n>=1);
const counts=(p)=>p.evaluate(()=>({jobs:Object.values(APP.db.jobs).filter(j=>j.sample).length, cos:Object.values(APP.db.companies).filter(c=>c.sample).length,
  qs:Object.values(APP.db.questions||{}).filter(q=>q.sample).length, arts:Object.values(APP.db.articles||{}).filter(q=>q.sample).length, people:Object.values(APP.db.consultants).filter(c=>c.sample).length}));
let c0=await counts(ad);
t('samples showing at first',c0.jobs>0&&c0.qs>0,c0);
await go(ad,'#/admin/settings'); await ad.waitForTimeout(400);
await ad.click('[data-action=adm-samples][data-on="1"]'); await ad.waitForTimeout(1200);
let c1=await counts(ad);
t('admin: all sample content gone right away (no reload)',c1.jobs===0&&c1.cos===0&&c1.qs===0&&c1.arts===0&&c1.people===0,c1);
await go(ad,'#/community'); t('admin: community has no Sample labels',await ad.locator('#main .sample-pill').count()===0);
await go(ad,'#/jobs'); t('admin: roles have no Sample labels',await ad.locator('#main .sample-pill').count()===0);
// professional signed in
const A=await page('a');
let ca=await counts(A);
t('professional: no sample jobs, companies, posts or people',ca.jobs===0&&ca.cos===0&&ca.qs===0&&ca.arts===0&&ca.people===0,ca);
await go(A,'#/community/people'); t('professional: People has no samples',await A.locator('#main .sample-pill').count()===0&&!/Vikram|Priya/.test(await A.textContent('#main')));
const E=await page('e');
let ce=await counts(E);
t('company: no sample professionals or roles',ce.jobs===0&&ce.people===0,ce);
const V=await page(null);
let cv=await counts(V);
t('visitor: no samples',cv.jobs===0&&cv.cos===0&&cv.qs===0&&cv.people===0,cv);
// switch back on
await go(ad,'#/admin/settings'); await ad.waitForTimeout(300);
await ad.click('[data-action=adm-samples][data-on="0"]'); await ad.waitForTimeout(1200);
let c2=await counts(ad);
t('admin: samples back when switched on',c2.jobs>0&&c2.qs>0,c2);
// a signed-in professional picks it up on the next refresh
await A.evaluate(()=>APP.backend.poll(true)); await A.waitForTimeout(900);
t('professional sees samples again after refresh',(await counts(A)).jobs>0);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
