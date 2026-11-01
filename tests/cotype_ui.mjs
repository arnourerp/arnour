/* Company type: asked at sign-up and in the profile, a one-time question for existing companies, badge on roles and company pages,
   and the "Direct employers only" filter (demo mode, no network) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async(h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };

/* ---- sign-up: the question is on step 1 and is required ---- */
await go('#/onboard-e'); await p.waitForSelector('form[data-form=wiz-e]');
t('the three choices are on step 1 with the agreed names',await p.evaluate(()=>{ const o=[...document.querySelectorAll('.co-type-opt')].map(x=>x.textContent.replace(/\s+/g,' ').trim()); return o.length===3&&/SAP Customer.*A company using SAP \(our own project\)/.test(o[0])&&/SI\/Partner.*A partner \/ consultancy/.test(o[1])&&/Recruiter.*A recruiter \/ staffing agency/.test(o[2]); }));
t('nothing is pre-selected',await p.evaluate(()=>!document.querySelector('input[name=companyType]:checked')));
await p.fill('input[name=name]','Delta Systems'); await p.selectOption('select[name=country]','ae');
await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(300);
t('without a choice it stays on step 1',await p.evaluate(()=>APP.wizE.step===1));
await p.check('input[name=companyType][value=partner]');
await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(300);
t('with a choice it moves on and remembers it',await p.evaluate(()=>APP.wizE.step===2&&APP.wizE.data.companyType==='partner'));
await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(300);
t('a partner cannot continue without team skills',await p.evaluate(()=>APP.wizE.step===2));
await p.evaluate(()=>{ const pr=CATALOG.products.find(x=>x.modules.length); APP.wizE.data.partner.skills.push({productId:pr.id,moduleId:pr.modules[0].id,projects:2,certified:false}); APP.render(); }); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(300);
await p.fill('input[name=contactName]','Dana'); await p.evaluate(()=>{ Object.assign(APP.wizE.data.partner,{countries:['ae'],languages:['English'],delivery:['onsite'],engagement:['team'],teamSize:'11-50',bestAt:'Finance rollouts'}); }); await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:5000});
const cid=await p.evaluate(()=>APP.db.session.companyId);
t('the company was created with its type and no question is asked again',await p.evaluate(()=>APP.company(APP.db.session.companyId).companyType==='partner'&&!document.querySelector('.co-type-prompt')));
await go('#/e/company'); await p.waitForTimeout(300);
t('the company page shows the badge',await p.evaluate(()=>/SI\/Partner/.test(document.querySelector('.co-id h2').textContent)));
await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300);
t('the profile editor has the choice with the current value',await p.evaluate(()=>document.querySelector('input[name=companyType]:checked').value==='partner'));
await p.check('input[name=companyType][value=recruiter]'); await p.evaluate(()=>document.querySelector('form[data-form=company-edit]').requestSubmit()); await p.waitForTimeout(400);
t('it can be changed',await p.evaluate((c)=>APP.company(c).companyType==='recruiter',cid));

/* ---- an existing company without a type is asked once ---- */
await p.evaluate(()=>{ const id=Object.keys(APP.db.companies).find(i=>APP.db.companies[i].name&&!APP.db.companies[i].companyType&&i!==APP.db.session.companyId); APP.db.companies[id].companyType=''; APP.db.session={role:'employer',companyId:id}; window.__old=id; });
await go('#/e/dashboard');
t('the question shows on the dashboard',await p.evaluate(()=>!!document.querySelector('form.co-type-prompt')&&/One quick question/.test(document.body.textContent)));
await go('#/e/jobs/new');
t('…and on Post a role, without blocking the form',await p.evaluate(()=>!!document.querySelector('form.co-type-prompt')&&!!document.querySelector('input[name=title]')));
await p.evaluate(()=>document.querySelector('form.co-type-prompt').requestSubmit()); await p.waitForTimeout(300);
t('saving with no choice is refused',await p.evaluate(()=>!APP.company(window.__old).companyType&&!!document.querySelector('form.co-type-prompt')));
await p.check('form.co-type-prompt input[value=customer]'); await p.evaluate(()=>document.querySelector('form.co-type-prompt').requestSubmit()); await p.waitForTimeout(400);
t('after choosing it is saved and the question is gone',await p.evaluate(()=>APP.company(window.__old).companyType==='customer'&&!document.querySelector('form.co-type-prompt')));

/* ---- badge on roles + the filter ---- */
const ids=await p.evaluate((c)=>{
  const base=Object.values(APP.db.jobs).find(j=>j.status==='open'&&!j.external);
  const mk=(id,type,extra)=>{ const co='cx-'+id; APP.db.companies[co]={id:co,name:'Co '+id,companyType:type,country:'ae'}; APP.db.jobs['jt-'+id]=Object.assign({},base,{id:'jt-'+id,title:'Role '+id,companyId:co,status:'open',confidential:false,applicants:[],invited:[]},extra||{}); return 'jt-'+id; };
  const a=mk('cust','customer'), b=mk('part','partner'), r=mk('recr','recruiter'), n=mk('none','');
  APP.db.jobs['jt-ext']=Object.assign({},base,{id:'jt-ext',title:'Role ext',external:true,extEmployer:'Some Agency',extSource:'Recruiter / agency posting',status:'open',applicants:[],invited:[]});
  APP.db.jobs['jt-ext2']=Object.assign({},base,{id:'jt-ext2',title:'Role ext2',external:true,extEmployer:'Some Corp',extSource:'Company career page',status:'open',applicants:[],invited:[]});
  return [a,b,r,n,'jt-ext','jt-ext2'];
}, cid);
await p.evaluate(()=>{ APP.db.session=null; }); await go('#/jobs'); await p.waitForTimeout(400);
const badge=(title)=>p.evaluate((ti)=>{ const c=[...document.querySelectorAll('.job-card')].find(x=>x.querySelector('.card-title').textContent.includes(ti)); return c?(c.querySelector('.co-type')||{}).textContent||'':null; },title);
t('role cards show SAP Customer, SI/Partner, Recruiter, and nothing when unknown',await badge('Role cust')==='SAP Customer'&&await badge('Role part')==='SI/Partner'&&await badge('Role recr')==='Recruiter'&&await badge('Role none')==='');
t('an imported role from a recruiter shows Recruiter, a company career page shows nothing',await badge('Role ext')==='Recruiter'&&await badge('Role ext2')==='');
const shown=()=>p.evaluate(()=>[...document.querySelectorAll('.job-card .card-title')].map(x=>x.textContent.trim()));
await p.evaluate(()=>{ APP.state.jobFilters=APP.JF_DEFAULTS(); APP.state.jobFilters.q='Role'; APP.render(); }); await p.waitForTimeout(300);
const all=await shown();
t('before filtering all test roles are listed',['Role cust','Role part','Role recr','Role none','Role ext','Role ext2'].every(x=>all.some(y=>y.includes(x))),all);
await p.evaluate(()=>{ APP.state.jobFilters.direct='yes'; APP.render(); }); await p.waitForTimeout(300);
const only=await shown();
t('"Direct employers only" hides partners and recruiters (incl. imported recruiter roles), keeps customers and unknown',only.some(x=>x.includes('Role cust'))&&only.some(x=>x.includes('Role none'))&&only.some(x=>x.includes('Role ext2'))&&!only.some(x=>x.includes('Role part'))&&!only.some(x=>x.includes('Role recr'))&&!only.some(x=>/Role ext(?!2)/.test(x)),only);
t('the filter is a removable chip and has its own section',await p.evaluate(()=>/Direct employers only/.test(document.body.textContent)&&!!document.querySelector('[data-action=filter-remove][data-key=direct]')));
await p.click('[data-action=filter-remove][data-key=direct]'); await p.waitForTimeout(300);
t('removing the chip brings them back',(await shown()).some(x=>x.includes('Role part')));
await go('#/job/jt-part'); await p.waitForTimeout(300);
t('the role page shows who posted it',await p.evaluate(()=>/SI\/Partner/.test((document.querySelector('.jd-poster')||{}).textContent||'')&&/client projects/.test(document.querySelector('.jd-poster').textContent)));
await go('#/company/cx-recr'); await p.waitForTimeout(300);
t('the public company page shows the badge',await p.evaluate(()=>/Recruiter/.test(document.querySelector('.co-id h2').textContent)));
t('no page errors',errs.length===0,errs);
console.log(f?'FAILED '+f:'ALL OK'); await b.close(); process.exit(f?1:0);
