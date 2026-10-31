/* Facebook-group link -> sign-up -> profile completed: the source is remembered, saved on the account and counted; direct visitors are not tagged */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const q=async(sql,params)=>(await be.db.query(sql,params)).rows;
async function newPage(){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}); const page=await ctx.newPage();
  page.on('pageerror',e=>{ fails++; console.log('FAIL PAGEERR',e.message); });
  await page.exposeFunction('__sb',be.handle);
  await page.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await page.route('**/fonts.googleapis.com/**',r=>r.abort());
  return page;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(250); };
async function signUpAndFinish(c,email){
  await go(c,'#/register/c');
  await c.fill('input[name=email]',email); await c.fill('input[name=password]','longenough1'); await c.check('input[name=terms]');
  await c.click('form[data-form=live-register] button[type=submit]');
  await c.waitForFunction(()=>location.hash==='#/check-email');
  be.users[email].confirmed=true;
  await go(c,'#/login'); await c.fill('input[name=email]',email); await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]');
  await c.waitForFunction(()=>location.hash==='#/onboard',null,{timeout:6000});
  await c.evaluate(()=>{ APP.wizC={step:6,data:Object.assign(APP.wizCDefaults(),{firstName:'Real',lastName:'Person',headline:'Senior FICO Consultant',nationality:'Egypt',country:'eg',city:'Cairo',roleType:'functional',languages:['English'],level:'Senior',yearsExp:8,anon:true,skills:[{productId:'s4onprem',moduleId:'fi',projects:5}],summary:'my summary'})}; APP._formSyncSkip=['wiz-c']; APP.render(); });
  await c.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit());
  await c.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:8000});
  await c.waitForTimeout(700);
}
const usage=async()=>Object.fromEntries((await q(`select name, sum(n)::int n from usage_counts group by 1`)).map(r=>[r.name,r.n]));

/* ---- from a Facebook group post, through the landing page and a non-tagged click on its button ---- */
const f=await newPage();
await f.goto('http://localhost:'+(process.env.PORT_LIVE||8123)+'/sap-jobs/?utm_source=facebook&utm_medium=group&utm_campaign=eg-sap-jobs&fbclid=IwAR1');
await f.waitForTimeout(400);
t('landing page saved the first touch',await f.evaluate(()=>{ try{ const o=JSON.parse(localStorage.getItem('arnour_ft')); return o.s==='facebook'&&o.m==='group'&&o.c==='eg-sap-jobs'&&o.l==='/sap-jobs/'; }catch(e){ return false; } }));
await f.goto(BASE); await f.waitForSelector('.hero',{timeout:8000});
t('still remembered after moving to the app (no tags on that address)',await f.evaluate(()=>ArnourFT.get()&&ArnourFT.get().s==='facebook'&&!location.search));
await signUpAndFinish(f,'fbuser@test.com');
const meta=be.users['fbuser@test.com'].meta;
t('source saved on the account at sign-up',meta&&meta.ft&&meta.ft.s==='facebook'&&meta.ft.c==='eg-sap-jobs'&&meta.role==='consultant',meta);
const u=await usage();
t('visitor from facebook counted once',u['lnd:facebook']===1,u);
t('completed profile counted against facebook',u['conv:c:facebook']===1,u);

/* ---- a visitor with no tags ---- */
const d=await newPage(); await d.goto(BASE); await d.waitForSelector('.hero',{timeout:8000});
t('direct visitor: nothing remembered',await d.evaluate(()=>localStorage.getItem('arnour_ft')===null));
await signUpAndFinish(d,'direct@test.com');
const m2=be.users['direct@test.com'].meta;
t('direct sign-up has no source on the account',m2&&!('ft' in m2),m2);
const u2=await usage();
t('direct profile counted as direct',u2['conv:c:direct']===1&&u2['lnd:facebook']===1,u2);
t('direct user can still sign in afterwards (password untouched)',be.users['direct@test.com'].password==='longenough1');

/* ---- a clean job link shared in a Facebook group ---- */
const j=await newPage();
await j.goto('http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html?utm_source=facebook&utm_medium=share');
await j.waitForSelector('.hero',{timeout:8000});
t('share-button tags (facebook / share) are read',await j.evaluate(()=>ArnourFT.get().s==='facebook'&&ArnourFT.get().m==='share'));

await browser.close();
console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
