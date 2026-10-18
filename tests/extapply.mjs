import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(fn,a)=>p.evaluate(fn,a);
await ev(()=>{ window.__opened=[]; window.open=(u,t,f)=>{window.__opened.push([u,t,f]); return null;}; });
t('safeApplyUrl accepts https and adds scheme',await ev(()=>APP.safeApplyUrl({applyUrl:'careers.acme.com/j/1'})==='https://careers.acme.com/j/1'));
t('safeApplyUrl rejects javascript:/garbage',await ev(()=>!APP.safeApplyUrl({applyUrl:'javascript:alert(1)'})&&!APP.safeApplyUrl({applyUrl:'not a link'})&&!APP.safeApplyUrl({applyUrl:'ftp://x.com/a'})));
const ids=await ev(()=>{ const j=Object.values(APP.db.jobs).find(x=>x.status==='open'&&!x.confidential); return {j:j.id,co:j.companyId,c:Object.keys(APP.db.consultants)[0]}; });
await ev((i)=>{ APP.db.jobs[i.j].applyUrl='https://careers.acme.com/jobs/42'; APP.login('consultant',i.c); location.hash='#/job/'+i.j; },ids);
await p.waitForTimeout(500);
t('job page shows external apply button, no in-platform Apply now',await ev(()=>!!document.querySelector('.jd-act [data-action=ext-apply]')&&!document.querySelector('.jd-act [data-action=apply]')));
t('note shows the domain',await ev(()=>/leave Arnour to apply on careers\.acme\.com/.test(document.querySelector('.jd-act').textContent)));
await p.click('.jd-act [data-action=ext-apply]'); await p.waitForTimeout(300);
t('click opens the link in a new tab with noopener',await ev(()=>window.__opened.length===1&&window.__opened[0][0]==='https://careers.acme.com/jobs/42'&&window.__opened[0][1]==='_blank'&&/noopener/.test(window.__opened[0][2])),await ev(()=>window.__opened));
t('"I have applied" appears after the click',await ev(()=>!!document.querySelector('.ext-after [data-action=ext-applied]')));
await p.click('[data-action=ext-applied]'); await p.waitForTimeout(300);
t('self-report records an application',await ev((i)=>APP.db.jobs[i.j].applicants.includes(i.c)&&/career portal/.test((APP.db.jobs[i.j].applyNotes||{})[i.c]||''),ids),await ev(()=>1));
t('job now reads Applied',await ev(()=>/Applied/.test(document.querySelector('.jd-act').textContent)));
// confidential: domain hidden
await ev((i)=>{ APP.logout&&0; APP.db.jobs[i.j].confidential=true; APP.db.jobs[i.j].applicants=APP.db.jobs[i.j].applicants.filter(x=>x!==i.c); APP.state.extOpened={}; location.hash='#/jobs'; },ids); await p.waitForTimeout(200);
await ev((i)=>{ location.hash='#/job/'+i.j; },ids); await p.waitForTimeout(400);
t('confidential role hides the domain',await ev(()=>{const x=document.querySelector('.jd-act .ext-note'); return !!x&&/company career portal/.test(x.textContent)&&!/acme/.test(x.textContent);}),await ev(()=>document.querySelector('.jd-act').textContent));
// employer side
await ev((i)=>{ APP.db.jobs[i.j].confidential=false; APP.login('employer',i.co); location.hash='#/e/jobs'; },ids); await p.waitForTimeout(400);
t('employer list shows "Applies on your site"',await ev(()=>/Applies on your site/.test(document.body.innerText)));
await ev((i)=>{ location.hash='#/e/jobs/'+i.j; },ids); await p.waitForTimeout(400);
t('employer detail explains external apply',await ev(()=>/Candidates apply on\s*careers\.acme\.com/.test(document.body.innerText)));
// job form
await ev(()=>{ APP.jobNewDraft=null; location.hash='#/e/jobs/new'; }); await p.waitForTimeout(500);
t('post-job form has the apply-link field in step 1',await ev(()=>!!document.querySelector('.jw-step[data-step="1"] input[name=applyUrl]')));
await p.fill('input[name=title]','Test role'); await p.fill('input[name=applyUrl]','javascript:alert(1)');
await ev(()=>{ const f=document.querySelector('form[data-form=job-post]'); f.requestSubmit(); }); await p.waitForTimeout(400);
t('invalid link blocks step 1 with an inline error',await ev(()=>(APP.state.jobStep||1)===1&&!!document.querySelector('[data-for=applyUrl]')),await ev(()=>[APP.state.jobStep,APP.state.jobErr]));
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
