import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(fn,a)=>p.evaluate(fn,a);
await ev(()=>{ const j=Object.values(APP.db.jobs)[0]; APP.db.session={role:'employer',companyId:j.companyId}; APP.jobNewDraft=null; location.hash='#/e/jobs/new'; }); await p.waitForTimeout(400);
// functional first: no expertise card, no programmes field
await p.fill('[name=title]','FICO Lead'); await p.selectOption('[name=roleType]','functional'); await p.waitForTimeout(200);
await ev(()=>APP.jobGoStep(2)); await p.waitForTimeout(200);
t('functional: no expertise card',await ev(()=>!/What expertise do you need/.test(document.getElementById('main').innerText)&&!document.querySelector('[name=minPrograms]')));
t('functional: stepper says SAP skills',/SAP skills/.test(await ev(()=>document.querySelector('.wiz-steps').innerText)));
// switch to architect
await ev(()=>APP.jobGoStep(1)); await p.waitForTimeout(150);
await p.selectOption('[name=roleType]','architect'); await p.waitForTimeout(200);
await ev(()=>APP.jobGoStep(2)); await p.waitForTimeout(200);
const txt=await ev(()=>document.getElementById('main').innerText);
t('architect: expertise card comes first',txt.indexOf('What expertise do you need')>-1&&txt.indexOf('What expertise do you need')<txt.indexOf('Which SAP products'),txt.slice(0,300));
t('architect: stepper says Expertise & SAP',/Expertise & SAP/.test(await ev(()=>document.querySelector('.wiz-steps').innerText)));
t('architect: minimum programs field',await ev(()=>!!document.querySelector('[name=minPrograms]')));
t('architect: specialties shown once only',await ev(()=>document.querySelectorAll('.job-form .spec-panel, form[data-form=job-post] .spec-panel').length===1));
// fill and publish
await ev(()=>{ APP.jobNewDraft.preferredSpecialties=APP.ROLE_SPECIALTIES.architect.slice(0,2); APP.jobNewDraft.requires=[{productId:'s4onprem',moduleId:''}]; APP._formSyncSkip=[]; APP.render(); }); await p.waitForTimeout(200);
await p.fill('[name=minPrograms]','3');
await ev(()=>APP.jobGoStep(3)); await p.waitForTimeout(200);
await ev(()=>document.querySelector('form[data-form=job-post]').requestSubmit()); await p.waitForTimeout(500);
const job=await ev(()=>Object.values(APP.db.jobs).sort((a,b)=>(b.postedTs||0)-(a.postedTs||0))[0]);
t('saved with minimum programs and product-level requirement',job.title==='FICO Lead'&&job.minPrograms===3&&job.requires.length===1&&job.requires[0].moduleId==='*',{mp:job.minPrograms,req:job.requires,t:job.title});
t('preferred specialties kept',(job.preferredSpecialties||[]).length===2);
// matching: more programmes ranks higher
const sc=await ev(id=>{ const j=APP.db.jobs[id]; const base=Object.values(APP.db.consultants).find(c=>c.roleType==='architect')||Object.values(APP.db.consultants)[0];
  const a=Object.assign({},base,{roleType:'architect',roleTypes:['architect'],programs:5,skills:[{productId:'s4onprem',moduleId:'*',projects:3}]}), z=Object.assign({},base,{roleType:'architect',roleTypes:['architect'],programs:0,skills:[{productId:'s4onprem',moduleId:'*',projects:3}]});
  return [APP.matchScore(a,j),APP.matchScore(z,j)]; },job.id);
t('more programmes delivered ranks higher',sc[0]>sc[1],sc);
// job page shows it under nice to have
await ev(id=>{ const c=Object.keys(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c}; location.hash='#/job/'+id; },job.id); await p.waitForTimeout(300);
t('job page lists the programmes preference',/Programs delivered\s*3\+/.test(await ev(()=>document.getElementById('main').innerText)));
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
