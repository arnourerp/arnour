/* Contact email field, partner's own page and messages after acceptance (demo mode) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async(h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const submit=async(sel)=>{ await p.evaluate(s=>document.querySelector(s).requestSubmit(),sel); await p.waitForTimeout(300); };

/* ---- sign-up: contact email on the contact step, checked when typed ---- */
await go('#/onboard-e'); await p.waitForSelector('form[data-form=wiz-e]');
await p.fill('input[name=name]','Beta Retail'); await p.selectOption('select[name=country]','ae'); await p.check('input[name=companyType][value=customer]');
await submit('form[data-form=wiz-e]'); await submit('form[data-form=wiz-e]');
t('step 3 asks for a contact email',await p.evaluate(()=>APP.wizE.step===3&&!!document.querySelector('input[name=contactEmail]')));
await p.fill('input[name=contactName]','Dana'); await p.fill('input[name=contactEmail]','nonsense');
await submit('form[data-form=wiz-e]');
t('a wrong email stops the step',await p.evaluate(()=>APP.wizE.step===3));
await p.fill('input[name=contactEmail]','Hello@Beta.com'); await submit('form[data-form=wiz-e]');
t('a good email moves on',await p.evaluate(()=>APP.wizE.step===4&&APP.wizE.data.contactEmail==='Hello@Beta.com'));
await submit('form[data-form=wiz-e]'); await p.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:5000});
t('the company keeps it',await p.evaluate(()=>APP.company(APP.db.session.companyId).contactEmail==='Hello@Beta.com'));
await go('#/e/company'); await p.click('[data-action=co-edit-on]'); await p.click('.pe-tab[data-s=contact]'); await p.waitForTimeout(200);
t('Edit profile has the field with the value',await p.evaluate(()=>document.querySelector('.pe-pane[data-pane=contact] input[name=contactEmail]').value==='Hello@Beta.com'));

/* ---- a partner's own page is the page customers see, plus tools ---- */
const pid=await p.evaluate(()=>{ const c=Object.values(APP.db.companies).find(c=>c.companyType==='partner'&&c.partner&&c.partner.skills.length&&!c.partner.hideName); APP.state.coEdit=false; APP.profileDraft=null; APP.login('employer',c.id); return c.id; });
await go('#/e/dashboard'); await go('#/e/company');
t('own page: hero with facts strip, product cards, side column and Edit button',await p.evaluate(()=>!!document.querySelector('.pt-hero .pt-facts-strip')&&document.querySelectorAll('.pt-prod-card').length>0&&!!document.querySelector('.pt-own-side')&&!!document.querySelector('.pt-hero [data-action=co-edit-on]')&&!document.querySelector('.co-banner')));
t('own page: link to see it as a customer does',await p.evaluate((id)=>!!document.querySelector('a[href="#/partner/'+id+'"]'),pid));
t('own page: logo does not overlap the name',await p.evaluate(()=>{ const l=document.querySelector('.pt-hero .brand-logo').getBoundingClientRect(), n=document.querySelector('.pt-h1').getBoundingClientRect(); return l.right<=n.left+1; }));

/* ---- messages: only after acceptance, both sides ---- */
const ids=await p.evaluate((pid)=>{ const cu=Object.values(APP.db.companies).find(c=>c.companyType==='customer'&&c.id!==pid); APP.db.partnerRequests=[{id:'prx',from:cu.id,to:pid,need:'team',timing:'',note:'Need FI',share:true,toShare:true,status:'pending',ts:Date.now(),respTs:null}]; APP.db.partnerMessages=[]; return cu.id; },pid);
await go('#/e/partner-requests');
t('pending: no message box yet',await p.evaluate(()=>!document.querySelector('form[data-form=pt-msg]')));
await p.evaluate(()=>{ APP.db.partnerRequests[0].status='accepted'; APP.ptLoadReqs(true); APP.render(); }); await p.waitForTimeout(300);
t('accepted: the message box is there',await p.evaluate(()=>!!document.querySelector('form[data-form=pt-msg]')));
await p.fill('form[data-form=pt-msg] textarea','Hello from the partner'); await submit('form[data-form=pt-msg]');
t('the partner message shows as its own',await p.evaluate(()=>!!document.querySelector('.pt-msg.mine .pt-bub')&&/Hello from the partner/.test(document.querySelector('.pt-msg.mine').textContent)));
await p.evaluate((cu)=>{ APP.login('employer',cu); },ids); await go('#/e/dashboard'); await go('#/e/partner-requests');
t('the customer sees it as theirs-not-mine and can answer',await p.evaluate(()=>!!document.querySelector('.pt-msg.theirs')&&!!document.querySelector('form[data-form=pt-msg]')));
await p.fill('form[data-form=pt-msg] textarea','Thanks, let us talk'); await submit('form[data-form=pt-msg]');
t('both messages are in the thread',await p.evaluate(()=>document.querySelectorAll('.pt-msg').length===2));
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
