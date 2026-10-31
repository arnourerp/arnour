/* First visit: the home page is drawn at once, before the data arrives; the database numbers fill in later.
   Returning (signed-in), email-link and other-page visits keep the logo screen until the data is here. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import path from 'path'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const ORIGIN='http://localhost:'+(process.env.PORT_LIVE||8123);
const DELAY=2500;
async function open(init){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  const p=await ctx.newPage();
  await p.exposeFunction('__sb',async(...a)=>{ await new Promise(r=>setTimeout(r,DELAY)); return be.handle(...a); });
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  if(init) await p.addInitScript(init);
  return p;
}
const state=(p)=>p.evaluate(()=>({splash:!!document.querySelector('#app .live-splash'),hero:!!document.querySelector('#app .hero h1'),proof:(document.querySelector('.hero-proof')||{}).textContent||'',link:(document.querySelector('.hero-jobs-link')||{}).textContent||'',ready:!!(window.APP&&APP.backend&&APP.backend.ready),y:window.scrollY}));

/* 1. first visit */
{
  const p=await open();
  await p.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#app .hero h1',{timeout:1500}).catch(()=>{});
  const s1=await state(p);
  t('first visit: the home page is drawn before the data has arrived',s1.hero&&!s1.ready,s1);
  t('first visit: no logo screen is covering the home page',!s1.splash,s1);
  t('first visit: no database numbers shown yet (no "0 open roles")',!/open roles ·|professionals/.test(s1.proof)&&!/\d/.test(s1.link)&&/SAP products/.test(s1.proof),[s1.proof,s1.link]);
  await p.evaluate(()=>window.scrollTo(0,500)); const y0=(await state(p)).y;
  t('the page can be scrolled before the data arrives',y0>200,y0);
  await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:15000}); await p.waitForTimeout(500);
  const s2=await state(p);
  t('after the data arrives the numbers appear',/\d+ open roles · \d+ professionals/.test(s2.proof)&&/Browse \d+ open roles first/.test(s2.link),[s2.proof,s2.link]);
  t('the scroll position is kept when the data fills in',Math.abs(s2.y-y0)<40,[y0,s2.y]);
  await p.context().close();
}
/* 2. went to another page before the data arrived */
{
  const p=await open();
  await p.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#app .hero h1',{timeout:1500}).catch(()=>{});
  await p.evaluate(()=>{location.hash='#/jobs'}); await p.waitForTimeout(300);
  const s=await state(p);
  t('opening another page early shows the logo screen until the data is here',s.splash&&!s.ready,s);
  await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:15000}); await p.waitForTimeout(500);
  const h=await p.evaluate(()=>({hash:location.hash,splash:!!document.querySelector('#app .live-splash'),text:document.querySelector('#main')?document.querySelector('#main').innerText.slice(0,200):''}));
  t('then that page is shown, with the data',h.hash==='#/jobs'&&!h.splash&&h.text.length>20,h);
  await p.context().close();
}
/* 3. a saved sign-in keeps the logo screen */
{
  const p=await open(()=>{ localStorage.setItem('sb-test-auth-token','{"x":1}'); });
  await p.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  const s=await state(p);
  t('a saved sign-in keeps the logo screen (not the public home page)',s.splash&&!s.hero&&!s.ready,s);
  await p.context().close();
}
/* 4. a link from an email keeps the logo screen */
{
  const p=await open();
  await p.goto(ORIGIN+'/?code=abc123',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  const s=await state(p);
  t('an email or sign-in link keeps the logo screen',s.splash&&!s.hero&&!s.ready,s);
  await p.context().close();
}
/* 5. any other page keeps the logo screen */
{
  const p=await open();
  await p.goto(ORIGIN+'/#/jobs',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  const s=await state(p);
  t('opening a page other than the home page keeps the logo screen',s.splash&&!s.hero&&!s.ready,s);
  await p.context().close();
}
await browser.close();
console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
