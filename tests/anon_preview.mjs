import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ids=await p.evaluate(()=>{ const j=Object.values(APP.db.jobs).find(x=>x.status==='open'); const co=APP.company(j.companyId);
  co.anon=true; co.name='SecretCo Holdings'; co.about='We are SecretCo, the hidden employer'; j.confidential=true;
  APP.db.session={role:'employer',companyId:co.id}; return {j:j.id,co:co.id}; });
const main=()=>p.evaluate(()=>document.getElementById('main').innerText);
// own normal view shows own name
await p.evaluate(id=>{location.hash='#/e/jobs/'+id;},ids.j); await p.waitForTimeout(300);
// preview as professional
await p.click('[data-action=preview-public]'); await p.waitForTimeout(400);
let tx=await main();
t('job preview hides the company name',!/SecretCo/.test(tx)&&/Confidential company/i.test(tx),tx.slice(0,400));
t('job preview shows banner',/how professionals see it/i.test(tx));
t('page title hides name',!/SecretCo/.test(await p.title()),await p.title());
await p.click('.preview-banner a'); await p.waitForTimeout(300);
t('back returns to the role',(await p.evaluate(()=>location.hash))==='#/e/jobs/'+ids.j);
// plain visit to the job page without preview = own view (allowed)
await p.evaluate(id=>{location.hash='#/job/'+id;},ids.j); await p.waitForTimeout(300);
t('no banner when not previewing',!/how professionals see it/i.test(await main()));
// company page preview
await p.evaluate(()=>{location.hash='#/e/company';}); await p.waitForTimeout(300);
const hasLink=await p.locator('[data-action=preview-public][data-href^="#/company/"]').count();
if(hasLink){ await p.click('[data-action=preview-public][data-href^="#/company/"]'); await p.waitForTimeout(400); tx=await main();
  t('company page preview hides name and about',!/SecretCo/.test(tx),tx.slice(0,400)); } else t('company preview link present',false);
// job form preview card
await p.evaluate(id=>{location.hash='#/e/jobs/'+id+'/edit';},ids.j); await p.waitForTimeout(400);
const pv=await p.evaluate(()=>{const el=document.querySelector('.job-preview'); return el?el.innerText:null;});
if(pv!==null) t('form preview card hides the company',!/SecretCo/.test(pv),pv); else {
  await p.evaluate(()=>{location.hash='#/e/jobs/new';}); await p.waitForTimeout(300);
  const pv2=await p.evaluate(()=>{ APP.jobNewDraft=Object.assign(APP.jobNewDraft||{}, {confidential:true,title:'T'}); APP.state.jobStep=3; APP.render(); const el=document.querySelector('.job-preview'); return el?el.innerText:'(none)'; });
  t('new-role preview card hides the company',!/SecretCo/.test(pv2)&&pv2!=='(none)',pv2);
}
// professional side: notification text written for them never names the company
await p.evaluate(()=>{ const co=APP.db.session.companyId; const c=Object.values(APP.db.consultants).find(x=>!APP.revealed(x.id,co)); window.__cid=c.id; });
const lbl=await p.evaluate(id=>{ const j=APP.db.jobs[id]; return APP.coLabel(APP.company(j.companyId), j, window.__cid); },ids.j);
t('notification label for professionals is anonymous',lbl==='A confidential company',lbl);
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
