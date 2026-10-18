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
t('live site does not load the demo data',await c.evaluate(()=>typeof window.SAMPLE==='undefined'));
// Word file without a type gets the right type
await c.evaluate(async()=>{ const f=new File(['x'],'My CV.docx',{type:''}); window.__cv1=await APP.backend.uploadCv(f); });
t('docx without a type is sent as a Word file',await c.evaluate(()=>window.__upTypes.slice(-1)[0]==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
// save indicator + old CV cleanup
await c.evaluate(()=>{ const me=APP.currentUser(); me.cv=window.__cv1; APP.save(); });
await c.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000});
await c.evaluate(()=>{ const sb=APP.backend.sb, r0=sb.rpc.bind(sb); sb.rpc=function(n,a){ return n==='save_profile' ? new Promise(res=>setTimeout(res,700)).then(()=>r0(n,a)) : r0(n,a); }; });
await c.evaluate(async()=>{ window.__cv2=await APP.backend.uploadCv(new File(['y'],'New.pdf',{type:'application/pdf'})); const me=APP.currentUser(); me.cv=window.__cv2; APP.save(); });
await c.waitForTimeout(800);
const ind=await c.evaluate(()=>{const e=document.getElementById('save-ind'); return e&&e.textContent;});
t('saving indicator shows',/Saving|Saved/.test(ind||''),ind);
await c.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); await c.waitForTimeout(300);
t('saved confirmation',/Saved/.test(await c.evaluate(()=>document.getElementById('save-ind').textContent)));
t('replaced CV file deleted',await c.evaluate(()=>(window.__removed||[]).includes(window.__cv1.path)));
// a CV that was sent in a chat is kept
await c.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; if(cv) cv.messages.push({id:'x',side:'c',text:'',ts:Date.now(),cv:window.__cv2}); });
await c.evaluate(async()=>{ window.__cv3=await APP.backend.uploadCv(new File(['z'],'Third.pdf',{type:'application/pdf'})); const me=APP.currentUser(); me.cv=window.__cv3; APP.save(); });
await c.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); await c.waitForTimeout(300);
const hasConv=await c.evaluate(()=>Object.keys(APP.db.conversations).length>0);
if(hasConv) t('CV sent in a chat is not deleted',await c.evaluate(()=>!(window.__removed||[]).includes(window.__cv2.path)));
// landing page companies section in live
await c.evaluate(()=>{location.hash='#/';}); await c.waitForTimeout(400);
t('landing renders',await c.evaluate(()=>!!document.querySelector('.hero, .home, #main')));
console.log(errors.slice(0,5));
console.log(fails?'FAILS '+fails:'ALL PASSED'); await browser.close();
