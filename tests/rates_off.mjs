import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(fn,a)=>p.evaluate(fn,a);
t('switch is off',await ev(()=>APP.SHOW_RATES===false));
// wizard: 5 visible steps, rate step skipped both ways
await ev(()=>{ APP.wizC={step:4,data:Object.assign(APP.wizCDefaults(),{firstName:'A',lastName:'B',gender:'male',headline:'H',nationality:'Egypt',country:'ae',languages:['English'],roleType:'functional',roleTypes:['functional'],_rtFor:'functional',skills:[{productId:'s4onprem',moduleId:'fi',projects:2}]})}; APP._formSyncSkip=['wiz-c']; location.hash='#/onboard'; APP.render(); });
await p.waitForTimeout(300);
t('progress shows 5 steps, no rate',await ev(()=>document.querySelectorAll('.wiz-step').length===5&&!/\brate\b/i.test(document.querySelector('.wiz-progress').textContent)));
t('counter says of 5',await ev(()=>/Step 4 of 5/.test(document.querySelector('.wiz-time').textContent)));
await p.evaluate(()=>{APP._formSyncSkip=['wiz-c']; document.querySelector('form[data-form=wiz-c]').requestSubmit();}); await p.waitForTimeout(300);
t('step 4 -> final (CV) skipping rate',await ev(()=>APP.wizC.step===6&&/CV/.test(document.querySelector('.wiz-title').textContent)&&/Step 5 of 5/.test(document.querySelector('.wiz-time').textContent)&&!/\brate\b/i.test(document.querySelector('form').textContent)));
await p.click('[data-action=wiz-back]'); await p.waitForTimeout(200);
t('back from final goes to step 4',await ev(()=>APP.wizC.step===4));
// no rate text on cards/profile/job pages
await ev(()=>{ APP.wizC=null; });
const ids=await ev(()=>({c:Object.keys(APP.db.consultants)[0],j:Object.keys(APP.db.jobs)[0]}));
await ev((c)=>APP.login('consultant',c),ids.c);
for (const h of ['#/c/dashboard','#/c/profile','#/c/jobs','#/jobs/'+ids.j]) { await ev((h)=>{location.hash=h;},h); await p.waitForTimeout(300);
  t('no rate/pay text on '+h,await ev(()=>!/Rate on request|Pay not disclosed|per day|\/day|\/month|USD\s?[\d,]+|AED\s?[\d,]+/.test(document.getElementById('app')?.innerText||document.body.innerText)));}
await ev(()=>{ location.hash='#/c/profile'; }); await p.waitForTimeout(300);
await ev(()=>{ APP.state.profileEdit=true; APP.profileDraft=APP.clone(APP.currentUser()); APP.render(); }); await p.waitForTimeout(300);
t('edit profile form has headline but no rate input',await ev(()=>!!document.querySelector('form[data-form=profile-edit] [name=headline]')&&!document.querySelector('[name=dailyRate]')),await ev(()=>location.hash));
await ev(()=>{ APP.state.profileEdit=false; APP.profileDraft=null; });
// job form: no pay inputs; editing keeps saved pay
await ev(()=>APP.login('employer',Object.keys(APP.db.employers||APP.db.companies||{})[0]));
const company=await ev(()=>Object.values(APP.db.jobs)[0].companyId);
await ev((c)=>APP.login('employer',c),company);
await ev(()=>{ location.hash='#/e/jobs/new'; }); await p.waitForTimeout(400);
t('post-job form has no pay fields',await ev(()=>!document.querySelector('[name=rateMin]')&&!document.querySelector('[name=rateMax]')&&!/Pay/.test(document.querySelector('.wiz-steps').textContent)));
// flip the switch: everything returns
await ev(()=>{ APP.SHOW_RATES=true; APP.jobNewDraft=null; APP.render(); location.hash='#/e/jobs/new'; APP.render(); }); await p.waitForTimeout(400);
t('switch on restores pay fields',await ev(()=>!!document.querySelector('[name=rateMin]')));
await ev(()=>{ APP.wizC=null; APP.wizC={step:1,data:APP.wizCDefaults()}; location.hash='#/onboard'; APP.render(); });
t('switch on restores 6 steps',await ev(()=>document.querySelectorAll('.wiz-step').length===6));
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
