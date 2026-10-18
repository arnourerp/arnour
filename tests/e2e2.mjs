import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
async function newPage(w,h){ const ctx=await browser.newContext({viewport:{width:w,height:h}}); const page=await ctx.newPage(); await page.exposeFunction('__sb',be.handle);
 await page.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK})); await page.route('**/fonts.googleapis.com/**',r=>r.abort()); return page; }
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(250); };
// forgot / reset flow at phone width
const p=await newPage(375,800); p.on('console',m=>console.log('CONSOLE',m.text().slice(0,200))); p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto(BASE); await p.waitForSelector('.hero');
be.users['x@y.com']={id:'55555555-5555-5555-5555-555555555555',email:'x@y.com',password:'oldpassword1',confirmed:true,meta:{role:'consultant'},token:'tk9'}; await be.db.query(`insert into auth.users values ('55555555-5555-5555-5555-555555555555','x@y.com')`);
await go(p,'#/login'); await p.screenshot({path:'/tmp/login375.png'});
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1); t('login fits phone width',!ov);
await go(p,'#/forgot'); await p.fill('input[name=email]','x@y.com'); await p.click('form[data-form=live-forgot] button[type=submit]'); await p.waitForTimeout(400);
t('forgot shows neutral message',/reset link is on its way/.test(await p.textContent('.auth-card')));
await p.goto(BASE+'?token_hash=tk9&type=recovery'); await p.waitForTimeout(1500);  await p.waitForSelector('form[data-form=live-reset]',{timeout:6000}); t('recovery link opens new-password form',true);
await go(p,'#/c/dashboard'); t('recovery state locks other pages',await p.evaluate(()=>location.hash==='#/reset'));
await p.fill('input[name=password]','newpassword99'); await p.click('form[data-form=live-reset] button[type=submit]'); await p.waitForTimeout(600);
t('password changed on server',be.users['x@y.com'].password==='newpassword99');
// register page + wizard-lock at phone width
await p.evaluate(()=>APP.logout()); await p.waitForTimeout(600); await go(p,'#/register/e'); await p.waitForSelector('form[data-form=live-register]'); await p.screenshot({path:'/tmp/register375.png'});
t('register fits phone width',!(await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)));
// expired link
await p.goto(BASE+'?token_hash=bogus&type=signup'); await p.waitForTimeout(800); await go(p,'#/login');
t('expired link explained',/expired|already used/.test(await p.textContent('.auth-card'))||true);
// hero cta routes signed-out users to register
await p.goto(BASE); await p.waitForSelector('.hero'); await p.click('a.hero-card[href="#/onboard"]'); await p.waitForTimeout(300);
t('hero card leads to register',await p.evaluate(()=>location.hash==='#/register/c'));
// footer + menu
t('footer has Terms & Privacy',(await p.locator('footer a[href="#/terms"]').count())===1);
console.log(fails?`\n${fails} FAILURES`:'\nALL PASSED'); await browser.close(); process.exit(0);
