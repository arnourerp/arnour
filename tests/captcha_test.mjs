import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend();
const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[];
async function newPage(name,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}}); const page=await ctx.newPage();
  page.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(name+': '+m.text()); });
  page.on('pageerror',e=>errors.push(name+' PAGEERR: '+e.message));
  await page.exposeFunction('__sb',be.handle);
  await page.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await page.route('**/fonts.googleapis.com/**',r=>r.abort());
  return page;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(250); };
const idle=async(p)=>{ await p.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); };
const q=async(sql,params)=>(await be.db.query(sql,params)).rows;
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';

// default (local address): no bot check shown
const v=await newPage('visitor');
await v.goto(BASE); await v.waitForSelector('.hero');
await go(v,'#/register/c');
t('no bot check outside arnour.com',(await v.locator('[data-ts]').count())===0);

// forced on, with a stand-in for the Cloudflare widget
const c=await newPage('pro');
await c.addInitScript(()=>{ window.ARNOUR_FORCE_CAPTCHA=true; let n=0; window.__tsRendered=0; window.__tsHold=false;
  window.turnstile={ render(el,o){ window.__tsRendered++; const id=++n; window.__tsCb=o.callback; if(!window.__tsHold) setTimeout(()=>o.callback('tok-'+id),30); return id; },
                     reset(id){ setTimeout(()=>window.__tsCb&&window.__tsCb('tok-r'+id),30); } }; });
await c.goto(BASE); await c.waitForSelector('.hero');
await c.evaluate(()=>{ const a=APP.backend.sb.auth; window.__auth=[]; ['signUp','signInWithPassword','resetPasswordForEmail','resend'].forEach(k=>{ const f=a[k].bind(a); a[k]=function(x,y){ window.__auth.push([k,JSON.parse(JSON.stringify([x,y||null]))]); return f(x,y); }; }); });
await go(c,'#/register/c'); await c.waitForTimeout(200);
t('bot check box on sign-up',await c.evaluate(()=>document.querySelectorAll('[data-ts][data-ts-on]').length===1&&window.__tsRendered>=1));
await c.fill('input[name=email]','bot@test.com'); await c.fill('input[name=password]','longenough1'); await c.check('input[name=terms]');
await c.click('form[data-form=live-register] button[type=submit]'); await c.waitForTimeout(500);
const su=await c.evaluate(()=>window.__auth.find(x=>x[0]==='signUp'));
t('sign-up sends the bot-check token',su&&/^tok-/.test(su[1][0].options.captchaToken),su);
await go(c,'#/login'); await c.waitForTimeout(200);
t('bot check box on sign-in',await c.evaluate(()=>!!document.querySelector('form[data-form=live-login] [data-ts][data-ts-on]')));
await c.evaluate(()=>{ window.__tsHold=true; APP.backend.tsToken=null; });
await c.fill('input[name=email]','bot@test.com'); await c.fill('input[name=password]','longenough1');
await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(200);
t('sign-in waits for the check',/security check/i.test(await c.textContent('#live-err'))&&!(await c.evaluate(()=>window.__auth.some(x=>x[0]==='signInWithPassword'))));
await c.evaluate(()=>window.__tsCb('tok-late')); await c.waitForTimeout(50);
t('message clears once the check passes',!(/security check/i.test(await c.textContent('#live-err'))));
await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(400);
const si=await c.evaluate(()=>window.__auth.find(x=>x[0]==='signInWithPassword'));
t('sign-in sends the token',si&&si[1][0].options.captchaToken==='tok-late',si);
await c.evaluate(()=>{ window.__tsHold=false; }); await go(c,'#/forgot'); await c.waitForTimeout(300);
await c.fill('input[name=email]','bot@test.com'); await c.click('form[data-form=live-forgot] button[type=submit]'); await c.waitForTimeout(400);
const fr=await c.evaluate(()=>window.__auth.find(x=>x[0]==='resetPasswordForEmail'));
t('password reset sends the token',fr&&/^tok-/.test(fr[1][1].captchaToken),fr);
// the check fails on this device: one automatic retry, then a clear message (no endless retries)
async function flaky(failures){
  const f=await newPage('flaky'+failures);
  await f.addInitScript((n)=>{ window.ARNOUR_FORCE_CAPTCHA=true; window.__resets=0; window.__fail=n;
    const fire=(o)=>setTimeout(()=>{ if(window.__fail-->0) o['error-callback']('300030'); else o.callback('tok-ok'); },30);
    window.turnstile={ render(el,o){ window.__o=o; fire(o); return 7; }, reset(id){ window.__resets++; fire(window.__o); } }; },failures);
  await f.goto(BASE); await f.waitForSelector('.hero');
  await f.evaluate(()=>{ const a=APP.backend.sb.auth; window.__auth=[]; const g=a.signInWithPassword.bind(a); a.signInWithPassword=function(x){ window.__auth.push(x); return g(x); }; });
  await go(f,'#/login'); await f.waitForTimeout(1600);
  return f;
}
const f1=await flaky(1);
t('a failed check retries once by itself and then passes',await f1.evaluate(()=>window.__resets===1&&APP.backend.tsToken==='tok-ok'&&!APP.backend.tsError),await f1.evaluate(()=>[window.__resets,APP.backend.tsToken,APP.backend.tsError]));
const f2=await flaky(99);
t('a check that keeps failing is retried only once',await f2.evaluate(()=>window.__resets===1&&!APP.backend.tsToken&&APP.backend.tsError==='300030'),await f2.evaluate(()=>[window.__resets,APP.backend.tsToken,APP.backend.tsError]));
await f2.fill('input[name=email]','bot@test.com'); await f2.fill('input[name=password]','longenough1');
await f2.click('form[data-form=live-login] button[type=submit]'); await f2.waitForTimeout(200);
const msg=await f2.textContent('#live-err');
t('the person is told the check failed and what to try (not "wait a moment")',/did not pass on this device/.test(msg)&&/VPN|Private Relay/.test(msg)&&!/wait a moment/i.test(msg),msg);
t('no sign-in is sent without a passed check',await f2.evaluate(()=>window.__auth.length===0));
t('no page errors',errors.length===0,errors);
console.log(fails?'FAILS '+fails:'ALL PASSED'); await browser.close();
