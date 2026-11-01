/* Visibility ("Skills first, names second"): own step in the professional sign-up, tab in Edit profile,
   company default for new roles, partner name choice and the redesigned partner page (demo mode) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async(h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const submit=async(sel)=>{ await p.evaluate(s=>document.querySelector(s).requestSubmit(),sel||'form'); await p.waitForTimeout(300); };

/* ---- professional sign-up: privacy is its own step right after "About you" ---- */
await go('#/onboard'); await p.waitForSelector('form[data-form=wiz-c]');
t('the steps list has Privacy second',await p.evaluate(()=>{ const v=APP.wizVisible(); return v[0]===1&&v[1]===7&&/Privacy/.test(document.querySelector('.wiz-progress').textContent); }));
await p.evaluate(()=>{ Object.assign(APP.wizC.data,{firstName:'Dana',lastName:'Hart',headline:'SAP FICO Consultant',nationality:'Egyptian',country:'ae',languages:['English'],gender:'f',roleType:'consultant'}); APP.wizC.step=7; APP._formSyncSkip=['wiz-c']; APP.render(); });
t('two big choices, private selected and recommended',await p.evaluate(()=>{ const t=[...document.querySelectorAll('.vis-tile')]; return t.length===2&&t[0].classList.contains('on')&&/Recommended/.test(t[0].textContent); }));
t('the preview hides the name',await p.evaluate(()=>!/Dana/.test(document.querySelector('.vis-preview').textContent)));
await p.click('.vis-tile[data-v=public]'); await p.waitForTimeout(200);
t('"Show my name" is stored and the preview shows the name',await p.evaluate(()=>APP.wizC.data.anon===false&&/Dana/.test(document.querySelector('.vis-preview').textContent)));
await p.click('.vis-tile[data-v=private]'); await p.waitForTimeout(200);
t('private again',await p.evaluate(()=>APP.wizC.data.anon===true));
t('the last step no longer carries the privacy card',await p.evaluate(()=>{ APP.wizC.step=6; APP.render(); return !document.querySelector('.vis-card')&&!document.querySelector('.privacy-card'); }));
await p.evaluate(()=>{ APP.wizC.step=7; APP.render(); });
await submit('form[data-form=wiz-c]');
t('Continue goes to Experience',await p.evaluate(()=>APP.wizC.step===2));
await p.evaluate(()=>{ APP.wizC.step=2; APP._formSyncSkip=['wiz-c']; APP.render(); });
await p.click('[data-action=wiz-back]'); await p.waitForTimeout(200);
t('Back from Experience returns to Privacy',await p.evaluate(()=>APP.wizC.step===7));

/* ---- an existing professional: Privacy tab in Edit profile and the card on the profile page ---- */
await p.evaluate(()=>{ const id=Object.keys(APP.db.consultants)[0]; APP.login('consultant',id); APP.db.consultants[id].anon=true; });
await go('#/c/profile');
t('the profile page shows the same card',await p.evaluate(()=>!!document.querySelector('.vis-card')));
await p.click('.vis-tile[data-v=public]'); await p.waitForTimeout(250);
t('a click saves at once',await p.evaluate(()=>APP.consultant(APP.db.session.consultantId).anon===false));
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(300);
t('Edit profile has a Privacy tab',await p.evaluate(()=>[...document.querySelectorAll('.pe-tab')].some(x=>/Privacy/.test(x.textContent))));
await p.click('.pe-tab[data-s=privacy]'); await p.waitForTimeout(250);
await p.click('.vis-tile[data-v=private]'); await p.waitForTimeout(250);
t('in the editor the choice waits for Save',await p.evaluate(()=>APP.consultant(APP.db.session.consultantId).anon===false&&APP.profileDraft.anon===true));
await p.evaluate(()=>{ document.querySelector('form[data-form=profile-edit]').requestSubmit(); }); await p.waitForTimeout(400);
t('Save stores it',await p.evaluate(()=>APP.consultant(APP.db.session.consultantId).anon===true));

/* ---- company: step 2 of sign-up, default for new roles ---- */
await p.evaluate(()=>{ APP.logout&&APP.logout(); APP.wizE=null; }); await go('#/onboard-e'); await p.waitForSelector('form[data-form=wiz-e]');
t('the progress has four steps with Privacy second',await p.evaluate(()=>APP.wizStepsEFor(APP.wizE.data).join()==='Company,Privacy,SAP footprint,Finish'));
await p.fill('input[name=name]','Delta Systems'); await p.selectOption('select[name=country]','ae'); await p.check('input[name=companyType][value=customer]');
await submit('form[data-form=wiz-e]');
t('step 2 is the visibility card (company wording)',await p.evaluate(()=>APP.wizE.step===2&&/company name show/i.test(document.querySelector('.vis-card').textContent)));
await p.click('.vis-tile[data-v=private]'); await p.waitForTimeout(200);
t('confidential default stored in the draft',await p.evaluate(()=>APP.wizE.data.confidentialDefault===true));
await submit('form[data-form=wiz-e]');
await p.fill('input[name=contactName]','Dana'); await submit('form[data-form=wiz-e]');
t('step 4 is the finish step',await p.evaluate(()=>APP.wizE.step===4));
await submit('form[data-form=wiz-e]'); await p.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:5000});
t('the company keeps the choice',await p.evaluate(()=>APP.company(APP.db.session.companyId).confidentialDefault===true));
await go('#/e/jobs/new'); await p.waitForTimeout(300);
t('a new role starts confidential',await p.evaluate(()=>APP.jobNewDraft&&APP.jobNewDraft.confidential===true&&!!document.querySelector('input[name=confidential]:checked')));
await go('#/e/company'); await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300);
t('company editor has a Privacy tab',await p.evaluate(()=>[...document.querySelectorAll('.pe-tab')].some(x=>/Privacy/.test(x.textContent))));

/* ---- partner page: no overlapping logo, request panel, best-at first ---- */
await go('#/partners'); await p.waitForSelector('.pt-card'); await p.click('.pt-card'); await p.waitForSelector('.pt-hero');
t('header, facts strip and request panel exist',await p.evaluate(()=>!!document.querySelector('.pt-hero .pt-facts-strip')&&!!document.querySelector('#pt-req')&&!document.querySelector('.co-banner')));
t('product cards use module chips',await p.evaluate(()=>document.querySelectorAll('.pt-prod-card .pt-mod').length>0));
t('the logo does not overlap the name',await p.evaluate(()=>{ const l=document.querySelector('.pt-hero .brand-logo').getBoundingClientRect(), n=document.querySelector('.pt-h1').getBoundingClientRect(); return l.right<=n.left+1; }));
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
