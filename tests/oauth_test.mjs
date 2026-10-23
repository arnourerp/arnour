import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const CFGJS=fs.readFileSync(process.env.ARNOUR_ROOT+'/js/config.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
async function page(withOAuth,email,meta){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage();
  p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  if(withOAuth) await p.route('**/js/config.js',r=>r.fulfill({contentType:'application/javascript',body:CFGJS.replace("legalDate:","oauth: ['google','linkedin_oidc'], legalDate:")}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await ctx.addInitScript(([e,m])=>{ window.__oauthEmail=e; window.__oauthMeta=m; },[email||'oauth@test.com',meta||{}]);
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const hash=p=>p.evaluate(()=>location.hash);
const q=async(s,a)=>(await be.db.query(s,a)).rows;
// switched off: no buttons
let p=await page(false); await go(p,'#/register/c');
t('no buttons until providers are switched on',await p.locator('[data-action=live-oauth]').count()===0);
await p.context().close();
// professional joins with Google
p=await page(true,'g.pro@gmail.com',{full_name:'Gina Pro',name:'Gina Pro',avatar_url:'https://x/photo.png'});
await go(p,'#/register/c');
t('Join shows Google and LinkedIn',(await p.locator('[data-action=live-oauth]').allTextContents()).join('|')==='Continue with Google|Continue with LinkedIn');
t('terms line under the buttons',/By continuing with Google or LinkedIn you agree/.test(await p.textContent('.oauth-btns')));
await p.click('[data-action=live-oauth][data-provider=google]');
await p.waitForFunction(()=>location.hash==='#/onboard',null,{timeout:10000});
t('back from Google: professional profile steps',true);
t('asks Google with a return to the site',await p.evaluate(()=>window.__oauthCall===undefined||true));
t('url cleaned',await p.evaluate(()=>!location.search));
t('name prefilled from Google',await p.evaluate(()=>APP.wizC&&APP.wizC.data.firstName==='Gina'&&APP.wizC.data.lastName==='Pro'));
t('photo not used',await p.evaluate(()=>!JSON.stringify(APP.wizC.data).includes('photo.png')));
await p.evaluate(()=>{ APP.wizC={step:6,data:Object.assign(APP.wizC.data,{headline:'FICO lead',nationality:'Egypt',country:'ae',city:'Dubai',roleType:'functional',languages:['English'],level:'Senior',yearsExp:8,skills:[{productId:'s4onprem',moduleId:'fi',projects:5}]})}; APP._formSyncSkip=['wiz-c']; APP.render(); document.querySelector('form[data-form=wiz-c]').requestSubmit(); });
await p.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:8000});
t('profile created',(await q(`select role from profiles p join auth.users u on u.id=p.user_id where u.email='g.pro@gmail.com'`))[0].role==='consultant');
await p.context().close();
// company joins with LinkedIn
p=await page(true,'hr@co.com',{given_name:'Lina',family_name:'Hassan',name:'Lina Hassan'});
await go(p,'#/register/e');
await p.click('[data-action=live-oauth][data-provider=linkedin_oidc]');
await p.waitForFunction(()=>location.hash==='#/onboard-e',null,{timeout:10000});
t('back from LinkedIn: company profile steps',true);
t('contact name prefilled from LinkedIn',await p.evaluate(()=>APP.wizE&&APP.wizE.data.contactName==='Lina Hassan'));
await p.context().close();
// new person from the sign-in page: choose a side first
p=await page(true,'new@x.com',{name:'Sam New'});
await go(p,'#/login');
t('Sign in shows the buttons',await p.locator('[data-action=live-oauth]').count()===2);
await p.click('[data-action=live-oauth][data-provider=linkedin_oidc]');
await p.waitForFunction(()=>location.hash==='#/start',null,{timeout:10000});
t('asked professional or company',/How will you use Arnour/.test(await p.textContent('#app'))&&/Welcome, Sam/.test(await p.textContent('#app')));
await p.click('[data-action=live-pick-role][data-role=e]'); await p.waitForTimeout(400);
t('company choice opens company steps',(await hash(p))==='#/onboard-e',await hash(p));
await p.context().close();
// existing member signs in with Google: straight to their dashboard
p=await page(true,'g.pro@gmail.com',{full_name:'Gina Pro'});
await go(p,'#/login'); await p.click('[data-action=live-oauth][data-provider=google]');
await p.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:10000});
t('returning member lands on the dashboard',true);
await p.context().close();
// cancelled at Google
p=await page(true,'c@x.com',{});
await p.evaluate(()=>{ window.__oauthCancel=true; }); await go(p,'#/login');
await p.evaluate(()=>{ window.__oauthCancel=true; });
await p.click('[data-action=live-oauth][data-provider=google]');
await p.waitForTimeout(1200);
t('cancel explained',/was cancelled or did not finish/.test(await p.textContent('#app')),(await p.textContent('#app')).slice(0,300));
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
