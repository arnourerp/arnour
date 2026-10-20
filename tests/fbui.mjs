import {createRequire} from 'module'; import {execSync} from 'child_process'; import fs from 'fs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
// fake live backend before admin.js and feedback.js load
const pre=`APP.backend=APP.backend||{isAdmin:true,user:{id:'u1'},profile:{},sb:{storage:{from:function(){return {upload:function(){return Promise.resolve({data:{path:'u1/s.png'}});},createSignedUrl:function(){return Promise.resolve({data:{signedUrl:'https://x/y'}});}};}}},
 rpc:function(fn,a){window.__calls=(window.__calls||[]);window.__calls.push([fn,a]);
  if(fn==='admin_overview')return Promise.resolve({openReports:0});
  if(fn==='admin_health')return Promise.resolve({openFeedback:2,errors:[{message:'Boom',src:'core.js:1',n:4,last_ts:Date.now(),page:'#/jobs',ua:'Mozilla Chrome/120.0 Windows'}],usage:[{d:new Date().toISOString().slice(0,10),name:'v:jobs',n:7}]});
  if(fn==='admin_feedback')return Promise.resolve([{id:5,created_ts:Date.now(),category:'problem',role:'consultant',email:'a@b.com',message:'Save fails <b>x</b>',page:'#/c/profile',ua:'Mozilla Safari/17.0 iPhone',ctx:{errors:[{t:'10:00:00',m:'oops',s:'core.js:1'}],viewport:'390x800'},shot:'u1/s.png',status:'open',note:''}]);
  return Promise.resolve({});}};\n`;
for (const f of ['admin','feedback']) await p.route('**/js/'+f+'.js',async r=>{ r.fulfill({contentType:'application/javascript',body:(f==='admin'?pre:'')+fs.readFileSync(process.env.ARNOUR_DEMO+'/js/'+f+'.js','utf8')}); });
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
// feedback.js requires APP.backend at load; admin.js defines it first (both routed)
t('feedback API present',await p.evaluate(()=>typeof APP.openFeedback==='function'));
await p.evaluate(()=>APP.openFeedback()); await p.waitForSelector('#fb-text');
await p.click('[data-action=fb-send]');
t('empty text -> inline error',/describe the problem/.test(await p.locator('#fb-root').innerText()));
await p.fill('#fb-text','The save button does nothing'); await p.click('[data-action=fb-cat][data-v=suggestion]');
{ const st=await p.evaluate(()=>{ const on=document.querySelector('[data-action=fb-cat][data-v=suggestion]'), off=document.querySelector('[data-action=fb-cat][data-v=problem]');
    return {on:on.classList.contains('chip-on'), pressed:on.getAttribute('aria-pressed'), bgOn:getComputedStyle(on).backgroundColor, bgOff:getComputedStyle(off).backgroundColor, offOn:off.classList.contains('chip-on'), label:document.querySelector('#fb-root .field .label:not(:first-child), #fb-root label.field .label').textContent}; });
  t('chosen option is visibly selected',st.on&&st.pressed==='true'&&!st.offOn&&st.bgOn!==st.bgOff,st);
  t('text label follows the choice',/suggestion/i.test(st.label),st.label);
  t('typed text kept when switching',(await p.inputValue('#fb-text'))==='The save button does nothing'); }
t('category chip keeps text',await p.inputValue('#fb-text')==='The save button does nothing');
await p.click('[data-action=fb-send]'); await p.waitForTimeout(300);
const call=await p.evaluate(()=>window.__calls.find(c=>c[0]==='submit_feedback'));
t('submit sends category, text, page, ua, ctx',call&&call[1].p_category==='suggestion'&&call[1].p_message.includes('save button')&&call[1].p_ua&&call[1].p_ctx.viewport,call);
t('thank-you shown',/Thank you/.test(await p.locator('#fb-root').innerText()));
await p.click('.dlg-foot [data-action=fb-close]'); t('closed and nothing blocks the page',await p.locator('#fb-root').evaluate(e=>e.innerHTML==='' ));
// error capture
await p.evaluate(()=>{ setTimeout(()=>{ throw new Error('Test boom'); },0); }); await p.waitForTimeout(300);
t('uncaught error logged',await p.evaluate(()=>window.__calls.some(c=>c[0]==='log_client_error'&&/Test boom/.test(c[1].p_message))));
// usage
t('page view tracked',await p.evaluate(()=>window.__calls.some(c=>c[0]==='track_usage'&&/^v:/.test(c[1].p_name))));

// floating button
t('fab exists and visible',await p.locator('#fb-fab').isVisible());
await p.click('#fb-fab'); t('fab opens the form and hides itself',await p.locator('#fb-text').count()===1&&!(await p.locator('#fb-fab').isVisible()));
await p.click('.dlg-foot [data-action=fb-close]'); t('fab back after close',await p.locator('#fb-fab').isVisible());
await p.setViewportSize({width:390,height:800});
await p.evaluate(()=>{location.hash='#/jobs';}); await p.waitForTimeout(300);
t('mobile: fab visible',await p.locator('#fb-fab').isVisible());
await p.setViewportSize({width:1200,height:900});

// failure toast offers Report this, prefilled
await p.evaluate(()=>APP.toast('Could not save your profile')); await p.waitForSelector('.toast-report');
t('toast has Report this',true);
await p.evaluate(()=>APP.toast('Saved ✓')); t('plain toast has no link',await p.locator('.toast-report').count()===1);
await p.click('.toast-report'); await p.waitForSelector('#fb-text');
t('form prefilled with the message',/Could not save your profile/.test(await p.inputValue('#fb-text')),await p.inputValue('#fb-text'));
await p.click('.dlg-foot [data-action=fb-close]');
// admin tabs
await p.evaluate(()=>{location.hash='#/admin/feedback';}); await p.waitForSelector('.adm-card');
const tx=await p.locator('.adm-main').innerText();
t('feedback card shows message, escaped, with meta',/Save fails <b>x<\/b>/.test(tx)&&/Safari/.test(tx)&&/1 recent error|recent error/.test(tx),tx);
t('reply + screenshot + done buttons',await p.locator('a[href^="mailto:a@b.com"]').count()===1&&await p.locator('[data-action=adm-fb-shot]').count()===1&&await p.locator('[data-action=adm-fb-set]').count()===1);
t('tab badge shows open count',/Feedback\s*2/.test(await p.locator('.adm-tabs').innerText()),await p.locator('.adm-tabs').innerText());
await p.evaluate(()=>{location.hash='#/admin/health';}); await p.waitForSelector('.adm-table');
const hx=await p.locator('.adm-main').innerText();
t('fab hidden in admin',!(await p.locator('#fb-fab').isVisible()));
t('health shows errors and usage',/Boom/.test(hx)&&/v:jobs/.test(hx)&&/7/.test(hx),hx);
t('no page errors (other than the deliberate one)',errs.filter(e=>!/Test boom/.test(e)).length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
