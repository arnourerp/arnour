/* Role page: the Status box (Live / Draft / Closed) and "Duplicate as new role". Demo mode (sample data). */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:1100}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ids=await p.evaluate(()=>{
  const js=APP.db.jobs; const live=Object.values(js).filter(x=>x.status==='open');
  const cid=live[0].companyId; const base=JSON.parse(JSON.stringify(live[0]));
  Object.keys(js).forEach(k=>{ if(js[k].companyId===cid) delete js[k]; });
  const cons=Object.values(APP.db.consultants)[0].id;
  js.r1=Object.assign(JSON.parse(JSON.stringify(base)),{id:'r1',title:'Source FICO Lead',status:'open',companyId:cid,applicants:[cons],invited:[],postedTs:Date.now()-86400000*3,applyUrl:'https://careers.example.com/job/1',description:'Scope text here',city:'Dubai',country:'ae',
    requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3,orPrev:false},{productId:'ariba',moduleId:'sourcing',minProjects:0,orPrev:false,nice:true}],languages:['English'],level:'Senior',minExp:8,roleType:'functional'});
  js.r2=Object.assign(JSON.parse(JSON.stringify(js.r1)),{id:'r2',title:'Second role',applicants:[],applyUrl:''});
  APP.db.session={role:'employer',companyId:cid}; APP.jobNewDraft=null;
  return {cid,cons}; });
const go=async h=>{ await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(400); };
const st=()=>p.evaluate(()=>APP.db.jobs.r1.status);
const on=()=>p.evaluate(()=>{ const x=document.querySelector('.st-opt.on'); return x?x.textContent.trim():''; });
const ok=async()=>{ await p.waitForSelector('#dlg-root .dlg'); await p.click('#dlg-ok'); await p.waitForTimeout(450); };

await go('#/e/jobs/r1');
t('A: the role page has a Status box and a Reuse box',await p.evaluate(()=>!!document.querySelector('.jd-status .st-switch')&&!!document.querySelector('.jd-reuse [data-action=job-duplicate]')&&/Reuse this role/.test(document.querySelector('.jd-reuse').textContent)));
t('A: the switch shows Live, Draft, Closed and Live is selected',await p.evaluate(()=>[...document.querySelectorAll('.st-opt')].map(x=>x.textContent.trim()).join()==='Live,Draft,Closed')&&await on()==='Live');
t('A: heading says Change Status, note says Current Status with the status in bold, and there is no separate Close role button',await p.evaluate(()=>document.querySelector('.jd-status .jd-side-h').textContent==='Change Status'&&/^Current Status: Live: professionals/.test(document.querySelector('.st-note').textContent)&&document.querySelector('.st-note b').textContent==='Live'&&!document.querySelector('.jd-act [data-action=close-job]')&&!document.querySelector('.jd-act [data-action=reopen-job]')));
t('A: clicking the selected status does nothing',await (async()=>{ await p.click('.st-opt.on'); await p.waitForTimeout(200); return !(await p.locator('#dlg-root .dlg').count())&&await st()==='open'; })());

/* Live -> Draft, with an applicant */
await p.click('.st-opt[data-to=draft]'); await p.waitForSelector('#dlg-root .dlg');
t('B: moving a role with applicants to Draft explains what happens to them',await p.evaluate(()=>{ const x=document.querySelector('#dlg-root .dlg').textContent; return /Move .* to drafts/.test(x)&&/1 applicant/.test(x)&&/On hold/.test(x)&&/do not send them a message/.test(x); }));
await p.click('#dlg-root .dlg-foot [data-action=dlg-cancel]'); await p.waitForTimeout(300);
t('B: Cancel changes nothing',await st()==='open');
await p.click('.st-opt[data-to=draft]'); await ok();
t('B: after confirming the role is a draft, with its applicant kept',await p.evaluate(()=>APP.db.jobs.r1.status==='draft'&&APP.db.jobs.r1.applicants.length===1));
t('B: the page now shows Draft selected, Closed unavailable and a Publish button',await on()==='Draft'&&await p.evaluate(()=>document.querySelector('.st-opt[data-to=closed]').disabled&&!!document.querySelector('[data-action=job-publish]')));

/* a professional who applied sees "On hold", never "Draft", and cannot withdraw or apply */
await p.evaluate(x=>{ APP.db.session={role:'consultant',consultantId:x.cons}; },ids); await go('#/c/applied');
t('C: the applicant sees the role marked On hold',await p.evaluate(()=>{ const x=document.body.textContent; return /Source FICO Lead/.test(x)&&/On hold/.test(x)&&!/\bDraft\b/.test(document.querySelector('.narrow').textContent); }));
await p.evaluate(x=>{ APP.db.session={role:'employer',companyId:x.cid}; },ids);

/* Draft -> Live (publishes, with its checks) */
await go('#/e/jobs/r1'); await p.click('.st-opt[data-to=open]'); await p.waitForTimeout(500);
t('D: Draft to Live publishes the role',await st()==='open'&&await on()==='Live');

/* Live -> Closed uses the close dialog */
await p.click('.st-opt[data-to=closed]'); await p.waitForSelector('#dlg-root .dlg');
t('E: Live to Closed opens the usual close dialog (hired question)',await p.evaluate(()=>/hire/i.test(document.querySelector('#dlg-root .dlg').textContent)));
await ok();
t('E: the role is closed and Closed is selected',await st()==='closed'&&await on()==='Closed');

/* Closed -> Draft */
await p.click('.st-opt[data-to=draft]'); await p.waitForSelector('#dlg-root .dlg');
t('F: Closed to Draft says it stays hidden and can be published again',await p.evaluate(()=>/stays hidden/.test(document.querySelector('#dlg-root .dlg').textContent)));
await ok();
t('F: the role is a draft',await st()==='draft'&&await on()==='Draft');
await p.click('.st-opt[data-to=open]'); await p.waitForTimeout(500);
t('F: and can be published again',await st()==='open');

/* Duplicate */
await p.click('[data-action=job-duplicate]'); await p.waitForTimeout(500);
t('G: Duplicate opens Post a role, filled in, titled "Copy of …"',await p.evaluate(()=>location.hash==='#/e/jobs/new'&&document.querySelector('input[name=title]').value==='Copy of Source FICO Lead'&&document.querySelector('input[name=title]').closest('form').dataset.form==='job-post'));
t('G: the details are copied, the applicants and the career-portal link are not',await p.evaluate(()=>{ const d=APP.jobNewDraft; return d.requires.length===2&&d.requires.some(r=>r.nice)&&d.level==='Senior'&&String(d.minExp)==='8'&&d.description==='Scope text here'&&!d.applyUrl&&!d.applicants&&!d.editId&&!d.id&&!d.postedTs; }));
t('G: nothing was saved yet',await p.evaluate(()=>Object.values(APP.db.jobs).filter(j=>j.title==='Copy of Source FICO Lead').length===0));
await p.click('button[data-action=job-draft]'); await p.waitForTimeout(700);
t('G: Save as draft creates a separate draft and leaves the original alone',await p.evaluate(()=>{ const c=Object.values(APP.db.jobs).filter(j=>j.title==='Copy of Source FICO Lead'); return c.length===1&&c[0].status==='draft'&&c[0].id!=='r1'&&(c[0].applicants||[]).length===0&&APP.db.jobs.r1.status==='open'&&APP.db.jobs.r1.applicants.length===1&&APP.db.jobs.r1.title==='Source FICO Lead'; }));

/* Duplicate while another new role is half-filled asks first */
await go('#/e/jobs/r2'); await p.evaluate(()=>{ APP.jobNewDraft=Object.assign(APP.jobNewDefaults(),{title:'Half typed new role'}); });
await p.click('[data-action=job-duplicate]'); await p.waitForSelector('#dlg-root .dlg');
t('H: duplicating while a new role is half-filled asks before replacing it',await p.evaluate(()=>/Replace the role you were starting/.test(document.querySelector('#dlg-root .dlg').textContent)&&location.hash==='#/e/jobs/r2'));
await p.click('#dlg-root .dlg-foot [data-action=dlg-cancel]'); await p.waitForTimeout(250);
t('H: Cancel keeps the half-filled role',await p.evaluate(()=>APP.jobNewDraft&&APP.jobNewDraft.title==='Half typed new role'));
await p.click('[data-action=job-duplicate]'); await ok();
t('H: Replace opens the copy',await p.evaluate(()=>location.hash==='#/e/jobs/new'&&document.querySelector('input[name=title]').value==='Copy of Second role'));
await p.evaluate(()=>{ APP.jobNewDraft=null; });

/* phone */
await p.setViewportSize({width:390,height:844}); await go('#/e/jobs/r2');
t('I: on a phone the Status switch fits and the page does not scroll sideways',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth&&document.querySelector('.st-switch').getBoundingClientRect().right<=window.innerWidth));
t('no page errors',errs.length===0,errs);
await b.close(); console.log(f?('FAILED '+f):'ALL OK'); process.exit(f?1:0);
