/* Onboarding polish (release48): clearer step counter, visual CV box, "Current location", "Hide my identity", big years,
   boxed "Add another SAP product", "Industry Knowledge" and the free-text "Other tools" (demo mode) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async(h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const setStep=async(n)=>{ await p.evaluate(s=>{ APP.wizC.step=s; APP._formSyncSkip=['wiz-c']; APP.render(); },n); await p.waitForTimeout(250); };
await go('#/onboard'); await p.waitForSelector('form[data-form=wiz-c]');

/* step 1 */
t('step counter is a percent bar that grows',await p.evaluate(()=>{ const b=document.querySelector('.wiz-pbar'); const w=document.querySelector('.wiz-pbar span').style.width; return !!b&&b.getAttribute('role')==='progressbar'&&/%$/.test(document.querySelector('.wiz-pct').textContent)&&w===document.querySelector('.wiz-pct').textContent&&getComputedStyle(b).height==='12px'; }));
t('"Step 1 of N · title" eyebrow above the title',await p.evaluate(()=>/^Step 1 of \d+$/.test(document.querySelector('.wiz-eyebrow').textContent)));
t('the old "Step x of" + minutes line is shortened',await p.evaluate(()=>!/Step \d/.test(document.querySelector('.wiz-time').textContent)&&/min left/.test(document.querySelector('.wiz-time').textContent)));
t('the CV box is a big drop zone, with a short privacy line and link',await p.evaluate(()=>{ const c=document.querySelector('.cv-import'); return !!c&&!!c.querySelector('.cv-zone')&&/Drop your CV here/.test(c.textContent)&&!/Anthropic/.test(c.textContent)&&!!c.querySelector('a[href="#/privacy"]'); }));
t('"Current location" replaces "Country"',await p.evaluate(()=>/Current location/.test(document.querySelector('[name=country]').closest('label').textContent)&&!/^Country/.test(document.querySelector('[name=country]').closest('label').textContent.trim())));

/* privacy step */
await p.evaluate(()=>{ Object.assign(APP.wizC.data,{firstName:'Dana',lastName:'Hart',headline:'SAP FICO Consultant',nationality:'Egyptian',country:'ae',languages:['English'],gender:'f',roleType:'consultant'}); });
await setStep(7);
t('privacy: "Hide my identity", no "skills first" hint',await p.evaluate(()=>{ const x=document.querySelector('.wizard-card').textContent; return /Hide my identity/.test(x)&&!/Skills first, name hidden/.test(x)&&!/names second/.test(x)&&!document.querySelector('.vis-intro'); }));

/* experience: big number follows the slider */
await setStep(2);
t('years: big number with "years"',await p.evaluate(()=>{ const o=document.querySelector('.range-row output.yrs-big'); return !!o&&parseFloat(getComputedStyle(o).fontSize)>=40&&getComputedStyle(o,'::after').content.includes('years'); }));
await p.evaluate(()=>{ const r=document.querySelector('input[data-wizard-years]'); r.value='12'; r.dispatchEvent(new Event('input',{bubbles:true})); });
t('the number follows the slider',await p.evaluate(()=>document.querySelector('.range-row output').textContent.trim()==='12'&&document.querySelector('[name=yearsExp]').value==='12'));

/* skills step: industries label, other tools, boxed add-another */
await p.evaluate(()=>{ APP.wizC.data.skills=[{productId:'s4public',moduleId:'fi',projects:3,certified:false}]; });
await setStep(3);
t('"Industry Knowledge" label',await p.evaluate(()=>/Industry Knowledge/.test(document.querySelector('form[data-form=wiz-c]').textContent)&&!/Industries you/.test(document.body.textContent)));
t('"Add another SAP product" sits in its own box',await p.evaluate(()=>{ const c=document.querySelector('.prod-add-box .prod-add-card'); return !!c&&/Add another SAP product/.test(c.textContent); }));
t('free-text box for other tools',await p.evaluate(()=>!!document.querySelector('input[name=otherTools]')));
await p.fill('input[name=otherTools]','Vertex, Blackline'); 
await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(400);
t('it is kept and listed on the final preview',await p.evaluate(()=>JSON.stringify(APP.tagList(APP.wizC.data.otherTools))===JSON.stringify(['Vertex','Blackline'])));

/* phone: bar-style steps */
await p.setViewportSize({width:390,height:800}); await setStep(2);
t('phone: the bar is still shown, full width',await p.evaluate(()=>document.querySelector('.wiz-pbar').getBoundingClientRect().width>300));
t('step 2 shows its own percent',await p.evaluate(()=>/Step 3 of/.test(document.querySelector('.wiz-eyebrow').textContent)&&document.querySelector('.wiz-pct').textContent===Math.round((APP.wizVisible().indexOf(2)+1)/APP.wizVisible().length*100)+'%'));
t('no page errors',errs.length===0,errs);
console.log(f?'FAILURES '+f:'ALL OK'); await b.close(); process.exit(f?1:0);
