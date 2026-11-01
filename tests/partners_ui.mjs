/* SI/Partners (demo mode, no network): Find partners, the partner page, the capabilities editor and the request flow */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,400)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async(h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(450); };
const as=async(role,id)=>{ await p.evaluate(([r,i])=>{ APP.db.session=r==='consultant'?{role:r,consultantId:i}:r==='employer'?{role:r,companyId:i}:null; APP.partnerReqs=null; APP.partnerReqsFor=''; },[role,id]); };
const body=()=>p.evaluate(()=>document.getElementById('app').innerText);
const cards=()=>p.evaluate(()=>[...document.querySelectorAll('.pt-card .card-title')].map(x=>x.textContent.trim()));

/* ---- a visitor can browse ---- */
await go('#/partners'); await p.waitForSelector('.pt-grid');
let c=await cards();
t('a visitor sees the three listed partners',c.length===3&&c.includes('Orbit SAP Partners')&&c.includes('Nexus Digital India'),c);
t('the partner that hides its name shows capabilities only',c.includes('Confidential SI/Partner')&&!(await body()).includes('GulfSys')&&!(await body()).includes('Sami'),c);
t('every card carries the SI/Partner badge and no price',await p.evaluate(()=>[...document.querySelectorAll('.pt-card')].every(x=>/SI\/Partner/.test(x.textContent))&&!/\$|\bUSD\b|\brates?\b|\bprices?\b/i.test(document.querySelector('.pt-grid').textContent)));
t('the menu has a Partners link',await p.evaluate(()=>!!document.querySelector('header.nav a.nav-link[href="#/partners"]')));

/* ---- filters: product is a must, the rest ranks ---- */
await p.selectOption('[data-pt-f=product]','s4public'); await p.waitForTimeout(300);
c=await cards(); t('filtering by product keeps only partners that have it',c.length===1&&c[0]==='Nexus Digital India',c);
await p.selectOption('[data-pt-f=product]','s4onprem'); await p.waitForTimeout(300);
await p.selectOption('[data-pt-f=industry]','Utilities (Power & Water)'); await p.waitForTimeout(300);
c=await cards();
t('the best match comes first and is marked',c[0]==='Confidential SI/Partner'&&await p.evaluate(()=>/Covers 2 of 2 needs/.test(document.querySelector('.pt-card').textContent)&&/Covers 1 of 2 needs/.test(document.querySelectorAll('.pt-card')[1].textContent)),c);
await p.selectOption('[data-pt-f=module]','co'); await p.waitForTimeout(300);
t('a module narrows to partners that delivered it',(await cards()).length===2);
await p.click('[data-action=pt-clear]'); await p.waitForTimeout(300);
await p.fill('[data-pt-f=q]','bangalore'); await p.waitForTimeout(300);
t('the text search works without losing focus',(await cards()).join()==='Nexus Digital India'&&await p.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('data-pt-f')==='q'));
await p.fill('[data-pt-f=q]',''); await p.waitForTimeout(200);

/* ---- the partner page ---- */
await go('#/partner/co-orbit');
t('a named partner shows modules, projects, certified marks and what it is best at',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /Orbit SAP Partners/.test(x)&&/14 projects/.test(x)&&/certified/.test(x)&&/S\/4HANA finance and supply-chain/.test(x)&&/51-200 SAP consultants/.test(x); }));
t('a visitor is asked to sign in, no request form',await p.evaluate(()=>!document.querySelector('form[data-form=pt-send]')&&/Sign in/.test(document.querySelector('.pt-page, .narrow').innerText)));
await go('#/partner/cx:co-gulfsys');
t('a hidden partner page shows capabilities without name, text or contact',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /Confidential SI\/Partner/.test(x)&&/keeps its name private/.test(x)&&!/GulfSys|Sami|Riyadh|Public-sector S\/4HANA programmes/.test(x)&&/14|10 projects|10/.test(x); }));
await go('#/partner/co-gulfsys');
t('the real id of a hidden partner is not a back door',await p.evaluate(()=>/Confidential SI\/Partner|not available/.test(document.getElementById('app').innerText)&&!/GulfSys/.test(document.getElementById('app').innerText)));

/* ---- a professional and a non-customer cannot ask ---- */
const pid=await p.evaluate(()=>Object.keys(APP.db.consultants)[0]);
await as('consultant',pid); await go('#/partner/co-orbit');
t('a professional can browse but not ask',await p.evaluate(()=>!document.querySelector('form[data-form=pt-send]')&&/Only SAP Customers can send requests/.test(document.getElementById('app').innerText)));
await as('employer','co-crescent'); await go('#/partners'); await go('#/partner/co-orbit');
t('a company that is not marked SAP Customer is told how to change that',await p.evaluate(()=>!document.querySelector('form[data-form=pt-send]')&&/marked as SAP Customer/.test(document.getElementById('app').innerText)));

/* ---- a customer asks a hidden partner ---- */
await as('employer','co-royal'); await go('#/partner/cx:co-gulfsys');
t('a customer sees the request form',await p.evaluate(()=>!!document.querySelector('form[data-form=pt-send]')));
await p.evaluate(()=>document.querySelector('form[data-form=pt-send]').requestSubmit()); await p.waitForTimeout(300);
t('an empty note is refused',await p.evaluate(()=>!!document.querySelector('form[data-form=pt-send]')&&!(APP.db.partnerRequests||[]).length));
await p.selectOption('select[name=need]','team'); await p.fill('input[name=timing]','Q1 2027'); await p.fill('textarea[name=note]','We need an FI/CO team for a finance rollout.');
await p.evaluate(()=>document.querySelector('form[data-form=pt-send]').requestSubmit()); await p.waitForTimeout(400);
t('the request is saved and the page shows it as sent',await p.evaluate(()=>(APP.db.partnerRequests||[]).length===1&&/Request sent/.test(document.getElementById('app').innerText)&&!document.querySelector('form[data-form=pt-send]')));
await go('#/e/partner-requests');
t('the customer sees it, with the partner still confidential',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /You asked a confidential SI\/Partner/.test(x)&&/Waiting/.test(x)&&!/GulfSys/.test(x); }));

/* ---- the partner answers ---- */
await as('employer','co-gulfsys'); await go('#/e/dashboard');
t('the partner is told on the dashboard',await p.evaluate(()=>/1 request waiting for your answer/.test(document.getElementById('app').innerText)));
await go('#/e/partner-requests');
t('the partner sees who asks and what for',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /Royal Energy Group wants to connect/.test(x)&&/A project team/.test(x)&&/FI\/CO team/.test(x); }));
await p.click('[data-action=pt-accept]'); await p.waitForTimeout(400);
t('accepting shows the contact details of the customer',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /Connected/.test(x)&&/Royal Energy Group/.test(x)&&!!document.querySelector('.pt-contact a[href^="mailto:"]'); }));

/* ---- the customer now sees the name ---- */
await as('employer','co-royal'); await go('#/partners');
t('the customer now sees the partner by name; others still do not',(await cards()).includes('GulfSys Consulting'));
await go('#/e/partner-requests');
t('the contact details are shown to the customer',await p.evaluate(()=>{ const x=document.getElementById('app').innerText; return /GulfSys Consulting/.test(x)&&/Sami Al-Harbi/.test(x)&&!!document.querySelector('.pt-contact a[href^="mailto:"]'); }));
await as('employer','co-rayan'); await go('#/partners');
t('another customer still sees it as confidential',!(await cards()).includes('GulfSys Consulting')&&(await cards()).includes('Confidential SI/Partner'));
await go('#/partner/cx:co-gulfsys'); await p.fill('textarea[name=note]','Hello'); await p.evaluate(()=>document.querySelector('form[data-form=pt-send]').requestSubmit()); await p.waitForTimeout(300);
await as('employer','co-gulfsys'); await go('#/e/partner-requests'); await p.click('[data-action=pt-decline]'); await p.waitForTimeout(300);
await as('employer','co-rayan'); await go('#/partner/cx:co-gulfsys');
t('a declined request is shown plainly, with no name',await p.evaluate(()=>/did not accept your last request/.test(document.getElementById('app').innerText)&&!/GulfSys/.test(document.getElementById('app').innerText)));

/* ---- the capabilities editor on the partner's own company page ---- */
await as('employer','co-orbit'); await go('#/e/company');
t('the partner sees its capabilities and that it is listed with its name',await p.evaluate(()=>/What the team delivers/.test(document.getElementById('app').innerText)&&/Listed on Find partners with your name/.test(document.getElementById('app').innerText)));
await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(400);
t('the editor opens with the current products and the hide switch off',await p.evaluate(()=>{ const e=document.querySelector('[data-pt-edit]'); return e&&!e.hidden&&e.querySelectorAll('.prod-card').length>=2&&!e.querySelector('[data-pt-hide]').checked; }));
await p.fill('[data-pt-best]','We deliver finance programmes on S/4HANA.');
await p.click('[data-pt-edit] [data-action=chip][data-group=languages][data-value=French]'); await p.waitForTimeout(300);
t('chips toggle without losing the typed text',await p.evaluate(()=>APP.profileDraft.partner.languages.includes('French')&&document.querySelector('[data-pt-best]').value==='We deliver finance programmes on S/4HANA.'));
await p.click('[data-pt-edit] [data-action=chip][data-group=teamSize][data-value="200+"]'); await p.waitForTimeout(300);
await p.check('[data-pt-hide]');
await p.evaluate(()=>document.querySelector('form[data-form=company-edit]').requestSubmit()); await p.waitForTimeout(500);
t('saving keeps the new values',await p.evaluate(()=>{ const c=APP.company('co-orbit').partner; return c.bestAt==='We deliver finance programmes on S/4HANA.'&&c.languages.includes('French')&&c.teamSize==='200+'&&c.hideName===true; }));
t('…and the page now says the name is hidden',await p.evaluate(()=>/Your name is hidden on Find partners/.test(document.getElementById('app').innerText)));
await as(null); await go('#/partners');
t('after saving, the hidden partner is no longer shown by name',!(await cards()).includes('Orbit SAP Partners'));

/* ---- choosing another company type drops the capabilities ---- */
await as('employer','co-orbit'); await go('#/e/company'); await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300);
await p.check('input[name=companyType][value=customer]'); await p.waitForTimeout(200);
t('the editor hides itself for another type',await p.evaluate(()=>document.querySelector('[data-pt-edit]').hidden===true));
await p.evaluate(()=>document.querySelector('form[data-form=company-edit]').requestSubmit()); await p.waitForTimeout(400);
t('the capabilities are dropped',await p.evaluate(()=>APP.company('co-orbit').companyType==='customer'&&APP.company('co-orbit').partner===undefined));
await as(null); await go('#/partners');
t('a company that is no longer a partner is not listed',!(await cards()).includes('Orbit SAP Partners')&&(await cards()).length===2);

/* ---- a new partner with nothing filled in is told how to be listed ---- */
await p.evaluate(()=>{ APP.db.companies['co-new']={id:'co-new',name:'Fresh SI',companyType:'partner',country:'ae'}; }); await as('employer','co-new'); await go('#/e/company');
t('an empty partner profile explains how to be listed',await p.evaluate(()=>/cannot find you on Find partners until you add at least one product/.test(document.getElementById('app').innerText)));
await go('#/e/dashboard');
t('…and the dashboard asks for it',await p.evaluate(()=>/Describe what your team delivers/.test(document.getElementById('app').innerText)));

t('no page errors',errs.length===0,errs);
await b.close(); console.log(f?'FAILED '+f:'ALL OK'); process.exit(f?1:0);
