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
const c=await newPage('pro');
await c.goto(BASE); await c.waitForSelector('.hero');
await go(c,'#/register/c');
await c.fill('input[name=email]','pro@test.com'); await c.fill('input[name=password]','short');
await c.click('form[data-form=live-register] button[type=submit]'); await c.waitForTimeout(200);
t('short password refused',(await c.textContent('#live-err')).includes('8'));
await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-register] button[type=submit]'); await c.waitForTimeout(200);
t('terms required',(await c.textContent('#live-err')).toLowerCase().includes('terms'));
await c.check('input[name=terms]'); await c.click('form[data-form=live-register] button[type=submit]');
await c.waitForFunction(()=>location.hash==='#/check-email'); t('check-email page after sign-up',true);
await go(c,'#/login'); await c.fill('input[name=email]','pro@test.com'); await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(400);
t('unconfirmed email blocked',(await c.locator('.live-note.warn').count())===1);
await c.fill('input[name=password]','wrongpass'); 
be.users['pro@test.com'].confirmed=true;
await c.fill('input[name=password]','wrongpass'); await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(400);
t('wrong password message',(await c.textContent('#live-err')).includes('incorrect'));
await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]');
await c.waitForFunction(()=>location.hash==='#/onboard',null,{timeout:6000}); t('first login goes to profile wizard',true);
await go(c,'#/c/dashboard'); t('cannot skip the wizard',await c.evaluate(()=>location.hash==='#/onboard'));
await c.evaluate(()=>{ APP.wizC={step:6,data:Object.assign(APP.wizCDefaults(),{firstName:'Real',lastName:'Person',headline:'Senior FICO Consultant',nationality:'Egypt',country:'ae',city:'Dubai',roleType:'functional',languages:['English'],level:'Senior',yearsExp:8,anon:true,skills:[{productId:'s4onprem',moduleId:'fi',projects:5}],summary:'my private summary'})}; APP._formSyncSkip=['wiz-c']; APP.render(); });
await c.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit());
await c.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:8000}); t('wizard creates profile and opens dashboard',true);

await c.waitForTimeout(800);
// count backend calls made by a quiet poll
await c.evaluate(()=>{ const sb=APP.backend.sb; window.__n=[]; const r0=sb.rpc.bind(sb), f0=sb.from.bind(sb); sb.rpc=function(n,a){window.__n.push('rpc:'+n); return r0(n,a);}; sb.from=function(t){window.__n.push('from:'+t); return f0(t);}; });
await c.evaluate(()=>{ APP.backend.pollN=1; return APP.backend.poll(); }); await c.waitForTimeout(700);
await c.evaluate(()=>{ window.__n=[]; APP.backend.pollN=2; APP.backend.poll(); }); await c.waitForTimeout(700);
const quiet=await c.evaluate(()=>window.__n.slice());
t('quiet poll makes only one small call',quiet.length===1&&quiet[0]==='rpc:my_pulse',quiet);
// a new notification for me -> the next poll reloads private data
const ent=await c.evaluate(()=>APP.backend.profile.entity_id);
await q(`insert into notifications(user_key,type,text,link) values ($1,'info','Hello from the test','')`,[ent]);
await c.evaluate(()=>{ window.__n=[]; APP.backend.pollN=3; APP.backend.poll(); }); await c.waitForTimeout(900);
const busy=await c.evaluate(()=>window.__n.slice());
t('change detected -> private data reloaded',busy.includes('rpc:my_pulse')&&busy.includes('from:notifications'),busy);
t('notification arrived',await c.evaluate(()=>(APP.db.notifications[APP.backend.profile.entity_id]||[]).some(n=>/Hello from the test/.test(n.text))));
// a role that disappears on the server is removed from the open tab
const before=await c.evaluate(()=>Object.keys(APP.db.jobs).length);
const victim=(await q(`select id from jobs where status='open' order by id limit 1`))[0].id;
t('role present before',await c.evaluate(id=>!!APP.db.jobs[id],victim));
await q(`delete from jobs where id=$1`,[victim]);
await c.evaluate(()=>APP.backend.poll(true)); await c.waitForTimeout(1200);
t('deleted role removed without reload',await c.evaluate(id=>!APP.db.jobs[id],victim)&&await c.evaluate(()=>Object.keys(APP.db.jobs).length)===before-1);
// a closed role disappears too (professionals only see open roles they did not apply to)
const v2=(await q(`select id from jobs where status='open' order by id limit 1`))[0].id;
await q(`update jobs set status='closed' where id=$1`,[v2]);
await c.evaluate(()=>{APP.backend.pollN=7; APP.backend.poll();}); await c.waitForTimeout(1200);
t('closed role removed on public refresh',await c.evaluate(id=>!APP.db.jobs[id],v2));
console.log(errors.slice(0,5));
console.log(fails?'FAILS '+fails:'ALL PASSED'); await browser.close();
