/* The ad landing page (#/welcome): says what Arnour is, one main button, no role numbers, drawn before the data arrives,
   keeps the ?utm_ tags of the ad link, counted as a page view, no sideways scrolling on a phone. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const ORIGIN='http://localhost:'+(process.env.PORT_LIVE||8123);
const DELAY=2500;
const calls=[];
async function open(width){
  const ctx=await browser.newContext({viewport:{width:width||1280,height:800}});
  const p=await ctx.newPage();
  await p.exposeFunction('__sb',async(...a)=>{ calls.push(JSON.stringify(a).slice(0,400)); await new Promise(r=>setTimeout(r,DELAY)); return be.handle(...a); });
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  return p;
}
const AD='/?utm_source=facebook&utm_medium=paid_social&utm_campaign=eg-sap-consultants-fb#/welcome';
/* 1. first visit from an ad link, desktop */
{
  const p=await open(1280);
  await p.goto(ORIGIN+AD,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#app .wl-hero h1',{timeout:1500}).catch(()=>{});
  const s=await p.evaluate(()=>({splash:!!document.querySelector('#app .live-splash'),h1:(document.querySelector('.wl-hero h1')||{}).textContent||'',ready:!!(window.APP&&APP.backend&&APP.backend.ready),text:document.body.innerText}));
  t('ad page is drawn before the data has arrived, no logo screen',/exact module/.test(s.h1)&&!s.ready&&!s.splash,s);
  t('says what Arnour is in the first block',/What is Arnour\?/.test(s.text)&&/SAP-only network for the Middle East/.test(s.text)&&/match %/.test(s.text));
  t('no role numbers anywhere on the page',!/\b\d+\+?\s*(open\s+)?(SAP\s+)?roles\b/i.test(s.text)&&!/170/.test(s.text)&&!/Browse \d/.test(s.text),s.text.slice(0,400));
  t('one main button to the roles and a small profile link, both in the hero',await p.evaluate(()=>{const m=document.querySelectorAll('.wl-hero a[data-wl="roles"]'),c=document.querySelectorAll('.wl-hero a[data-wl="profile"]');return m.length===1&&m[0].getAttribute('href')==='#/jobs'&&/See roles that fit me/.test(m[0].textContent)&&c.length===1&&c[0].getAttribute('href')==='#/onboard'}));
  t('no company card on the page (professionals only)',await p.evaluate(()=>!/I'm a company/.test(document.body.innerText)&&!document.querySelector('a[href="#/onboard-e"]')));
  t('three steps, the match example (labelled Example, 86%) and a closing button',await p.evaluate(()=>document.querySelectorAll('.wl-step').length===3&&/86%/.test((document.querySelector('.wl-match .sap-ring')||{}).textContent||'')&&/Example/.test((document.querySelector('.wl-match .sap-ex-tag')||{}).textContent||'')&&!!document.querySelector('.wl-final a[data-wl="roles-bottom"]')));
  t('the page title is its own',await p.evaluate(()=>/SAP roles matched to your modules/.test(document.title)));
  await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:15000}); await p.waitForTimeout(800);
  const after=await p.evaluate(()=>({view:APP.parseRoute().view,hash:location.hash,ft:(window.ArnourFT&&ArnourFT.get())||null,text:document.body.innerText}));
  t('after the data arrives the page is still the ad page, same text',after.view==='welcome'&&/exact module/.test(after.text)&&!/\b\d+\+?\s*(open\s+)?(SAP\s+)?roles\b/i.test(after.text),after);
  t('the ad link tags are remembered (facebook, campaign)',after.ft&&after.ft.s==='facebook'&&after.ft.c==='eg-sap-consultants-fb',after.ft);
  t('the visit is counted as a page view of "welcome"',calls.some(c=>/track_usage/.test(c)&&/v:welcome/.test(c)),calls.filter(c=>/track_usage/.test(c)));
  await p.click('.wl-hero a[data-wl="roles"]'); await p.waitForTimeout(500);
  t('the main button opens the roles board',await p.evaluate(()=>location.hash==='#/jobs'&&APP.parseRoute().view==='jobs'));
  await p.context().close();
}
/* 2. phone: no sideways scrolling, button visible on the first screen */
{
  const p=await open(375);
  await p.goto(ORIGIN+AD,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#app .wl-hero h1',{timeout:3000});
  const m=await p.evaluate(()=>{const b=document.querySelector('.wl-hero a[data-wl="roles"]').getBoundingClientRect();return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,btnBottom:b.bottom,vh:innerHeight}});
  t('phone: no sideways scrolling',m.sw<=m.cw,m);
  t('phone: the main button is on the first screen',m.btnBottom<=m.vh,m);
  await p.context().close();
}
/* 3. the home page keeps its own content */
{
  const p=await open(1280);
  await p.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
  await p.waitForSelector('#app .hero h1',{timeout:3000});
  t('the home page is unchanged (company card present, not the ad page)',await p.evaluate(()=>!!document.querySelector('.hero-card-co')&&!document.querySelector('.wl-hero')));
  await p.context().close();
}
await browser.close(); be.close&&be.close();
console.log(fails?('FAILED '+fails):'ALL OK'); process.exit(fails?1:0);
