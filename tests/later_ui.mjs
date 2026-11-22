/* "Save and finish later": the wizard button, the finish-your-profile experience, the Talent label (offline demo copy) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch();
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,400)); if(!ok)f++;};
const errs=[];
async function fresh(vp){
  const p=await b.newPage({viewport:vp||{width:1280,height:1000}});
  p.on('pageerror',e=>errs.push(e.message)); await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
  await p.evaluate(()=>{ localStorage.clear(); window.__ev=[]; APP.trackEvent=n=>{ window.__ev.push(n); }; });
  return p;
}
const p=await fresh(); const ev=(fn,a)=>p.evaluate(fn,a);
const seed=(step,extra)=>ev(([step,extra])=>{ APP.db.session=null; APP.wizC={step:step,data:Object.assign(APP.wizCDefaults(),{firstName:'Lia',lastName:'Later',gender:'female',headline:'SAP FI Consultant',nationality:'Egypt',country:'eg',languages:['English'],roleType:'functional'},extra||{})}; APP.rtSet(APP.wizC.data,['functional']); location.hash='#/onboard'; APP._formSyncSkip=['wiz-c']; APP.render(); },[step,extra]);

/* step 1: a quiet note, no button yet */
await seed(1); await p.waitForTimeout(200);
t('step 1 tells people they can save after the next step',await ev(()=>!!document.querySelector('.wiz-later-hint')&&/save your profile and add the rest later/.test(document.querySelector('.wiz-later-hint').textContent)));
t('step 1 has no Save and finish later button',await ev(()=>!document.querySelector('[data-action=wiz-later]')));
/* Continue on step 1 is counted */
await ev(()=>{ APP.wizC.step=1; });
await ev(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(200);
t('Continue lands on Privacy (step 2 of 6) and is counted',await ev(()=>APP.wizC.step===7&&window.__ev.indexOf('wz:next:about')>-1&&/Step 2 of 6/.test(document.querySelector('.wiz-eyebrow').textContent)),await ev(()=>[APP.wizC.step,window.__ev]));
t('from step 2 the button and its note show',await ev(()=>{ const bt=document.querySelector('[data-action=wiz-later]'); return !!bt&&/Save and finish later/.test(bt.textContent)&&!!document.querySelector('.wiz-later-note'); }));
t('the old "Skip the rest" button is gone',await ev(()=>!document.querySelector('[data-action=wiz-skip]')&&!/Skip the rest/.test(document.body.textContent)));

/* save from the Privacy step */
await p.click('[data-action=wiz-later]'); await p.waitForTimeout(500);
t('the profile is created and the person is signed in on the dashboard',await ev(()=>APP.db.session&&APP.db.session.role==='consultant'&&location.hash==='#/c/dashboard'),await ev(()=>[location.hash,APP.db.session]));
t('it was counted as saved early on the Privacy step',await ev(()=>window.__ev.indexOf('wz:later:privacy')>-1),await ev(()=>window.__ev));
const me=await ev(()=>{ const c=APP.consultant(APP.db.session.consultantId); return {skills:c.skills.length,anon:c.anon,first:c.firstName,years:c.yearsExp,avail:c.availability,level:c.level,ready:APP.profileReady(c)}; });
t('saved with defaults for what was not asked yet, private, no skills, not ready',me.skills===0&&me.anon===true&&me.first==='Lia'&&me.years>=1&&!!me.avail&&!!me.level&&me.ready===false,me);
t('a toast says the profile is saved',await ev(()=>/Profile saved/.test((document.querySelector('.toast')||{}).textContent||'')));
t('the dashboard shows the Finish your profile box with the Example card instead of match cards',await ev(()=>{ const c=document.querySelector('.finish-card'); return !!c&&!!c.querySelector('.sap-example')&&/Finish your profile to see your matches/.test(c.textContent)&&!document.querySelector('.job-card'); }));
t('it shows how much of the profile is done',await ev(()=>/\d+% of your profile is complete/.test(document.querySelector('.finish-card').textContent)));
await p.click('.finish-card [data-action=finish-profile]'); await p.waitForTimeout(400);
t('its button opens Edit profile at the SAP skills section and is counted',await ev(()=>location.hash==='#/c/profile'&&APP.state.profileEdit===true&&APP.state.profileSec==='skills'&&window.__ev.indexOf('fp:go:dash')>-1),await ev(()=>[location.hash,APP.state.profileSec,window.__ev]));
await ev(()=>{ APP.state.profileEdit=false; APP.profileDraft=null; });

/* roles list: a box, grey pills, newest first */
await ev(()=>{ location.hash='#/c/jobs'; }); await p.waitForTimeout(500);
t('roles list: the finish box is at the top and there are role cards',await ev(()=>!!document.querySelector('.finish-card')&&document.querySelectorAll('.job-card').length>3));
t('roles list: every card has the grey "Add skills to see match" pill and no percentage',await ev(()=>{ const cards=[...document.querySelectorAll('.job-card')]; return cards.every(c=>c.querySelector('.match-locked'))&&!document.querySelector('.match-btn')&&!/\d+% Match/.test(document.querySelector('.job-card').textContent); }));
t('roles list: newest first',await ev(()=>{ const ids=[...document.querySelectorAll('.job-card')].map(c=>(c.dataset.cardHref||'').split('/').pop()); const ts=ids.map(i=>(APP.job(i)||{}).postedTs||0); return ts.length>3&&ts.every((x,i)=>i===0||ts[i-1]>=x); }));
await p.click('.job-card .match-locked'); await p.waitForTimeout(400);
t('the grey pill opens Edit profile at SAP skills',await ev(()=>location.hash==='#/c/profile'&&APP.state.profileSec==='skills'&&window.__ev.indexOf('fp:go:card')>-1));
await ev(()=>{ APP.state.profileEdit=false; APP.profileDraft=null; });

/* role page: the Example card replaces the match card, no tabs */
const jid=await ev(()=>Object.values(APP.db.jobs).filter(j=>j.status==='open'&&!j.external)[0].id);
await ev(j=>{ location.hash='#/job/'+j; },jid); await p.waitForTimeout(500);
t('role page: Example card and an Add my SAP skills button, no match tabs, no percentage',await ev(()=>{ const m=document.querySelector('.jd-match-incomplete'); return !!m&&!!m.querySelector('.sap-example')&&!!m.querySelector('[data-action=finish-profile]')&&!document.querySelector('.jd-tabs')&&!document.querySelector('.mb-score'); }));

/* once there is a skill everything is as before */
await ev(()=>{ const c=APP.consultant(APP.db.session.consultantId); const s=Object.values(APP.db.consultants).find(x=>x.skills&&x.skills.length).skills[0]; c.skills=[{productId:s.productId,moduleId:s.moduleId,projects:3,certified:false}]; APP.save(); location.hash='#/c/jobs'; APP.render(); }); await p.waitForTimeout(500);
t('with a skill: percentages are back, no finish box',await ev(()=>!document.querySelector('.finish-card')&&!document.querySelector('.match-locked')&&document.querySelectorAll('.match-btn').length>3));
await ev(j=>{ location.hash='#/job/'+j; },jid); await p.waitForTimeout(500);
t('with a skill: the role page has its match tabs again',await ev(()=>!!document.querySelector('.jd-tabs')&&!document.querySelector('.jd-match-incomplete')&&!!document.querySelector('.mb-score')));
await ev(()=>{ location.hash='#/c/dashboard'; }); await p.waitForTimeout(400);
t('with a skill: the dashboard has no finish box',await ev(()=>!document.querySelector('.finish-card')));

/* companies see a profile in progress, last in the list */
await ev(()=>{ const c=Object.values(APP.db.consultants)[0]; const n=APP.clone(c); n.id='cNR'; n.firstName='Nora'; n.lastName='Noskills'; n.headline='SAP Consultant'; n.skills=[]; n.anon=false; APP.db.consultants[n.id]=n; const co=Object.values(APP.db.companies)[0]; APP.login('employer',co.id); location.hash='#/e/talent'; APP.render(); }); await p.waitForTimeout(600);
t('Talent: the profile in progress shows the label',await ev(()=>{ const cards=[...document.querySelectorAll('.talent-card')]; const nr=cards.filter(c=>/Profile in progress/.test(c.textContent)); return nr.length>=1&&cards.length>3; }));
t('Talent: profiles without skills come after every profile with skills',await ev(()=>{ const flags=[...document.querySelectorAll('.talent-card')].map(c=>/Profile in progress/.test(c.textContent)); const first=flags.indexOf(true); return first>0&&flags.slice(first).every(Boolean); }));
t('Talent: an Example match card is not shown to companies',await ev(()=>!document.querySelector('.finish-card')&&!document.querySelector('.match-locked')));

/* save later from the SAP skills step with a product but no module: the incomplete row is not saved */
const p2=await fresh({width:390,height:844}); const ev2=(fn,a)=>p2.evaluate(fn,a);
await ev2(()=>{ APP.db.session=null; const o={firstName:'Mo',lastName:'Mod',gender:'male',headline:'SAP MM Consultant',nationality:'Egypt',country:'eg',languages:['English']}; APP.wizC={step:3,data:Object.assign(APP.wizCDefaults(),o)}; APP.rtSet(APP.wizC.data,['functional']); const pid=Object.keys(APP.productsById||{})[0]||'s4onprem'; APP.wizC.data.skills=[{productId:'s4onprem',moduleId:'',projects:1}]; location.hash='#/onboard'; APP._formSyncSkip=['wiz-c']; APP.render(); }); await p2.waitForTimeout(300);
t('phone: the button and note fit and nothing scrolls sideways',await ev2(()=>{ const bt=document.querySelector('[data-action=wiz-later]'); const r=bt.getBoundingClientRect(); return !!bt&&r.width>60&&document.documentElement.scrollWidth<=window.innerWidth+1; }),await ev2(()=>[document.documentElement.scrollWidth,window.innerWidth]));
await p2.click('[data-action=wiz-later]'); await p2.waitForTimeout(500);
t('a product without a module is not saved as a skill; the profile is saved without skills',await ev2(()=>{ const c=APP.consultant(APP.db.session.consultantId); return c.skills.length===0&&location.hash==='#/c/dashboard'&&window.__ev.indexOf('wz:later:skills')>-1; }),await ev2(()=>[location.hash,window.__ev]));
t('phone: the finish box fits',await ev2(()=>{ const c=document.querySelector('.finish-card'); return !!c&&c.getBoundingClientRect().right<=window.innerWidth+1&&document.documentElement.scrollWidth<=window.innerWidth+1; }));

/* a full sign-up still works and creates a ready profile */
const p3=await fresh(); const ev3=(fn,a)=>p3.evaluate(fn,a);
await ev3(()=>{ APP.db.session=null; const s=Object.values(APP.db.consultants).find(x=>x.skills&&x.skills.length).skills[0]; APP.wizC={step:6,data:Object.assign(APP.wizCDefaults(),{firstName:'Fu',lastName:'Full',gender:'male',headline:'SAP FI Consultant',nationality:'Egypt',country:'eg',languages:['English'],skills:[{productId:s.productId,moduleId:s.moduleId,projects:2,certified:false}]})}; APP.rtSet(APP.wizC.data,['functional']); location.hash='#/onboard'; APP._formSyncSkip=['wiz-c']; APP.render(); }); await p3.waitForTimeout(300);
t('the last step has no Save and finish later button',await ev3(()=>!document.querySelector('[data-action=wiz-later]')));
await ev3(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p3.waitForTimeout(500);
t('a full sign-up gives a ready profile, the normal welcome and no finish box',await ev3(()=>{ const c=APP.consultant(APP.db.session.consultantId); return APP.profileReady(c)&&!document.querySelector('.finish-card')&&!/Profile saved/.test((document.querySelector('.toast')||{}).textContent||''); }));

t('no page errors',errs.length===0,errs);
await b.close(); console.log(f?('\n'+f+' FAILED'):'\nall passed'); process.exit(f?1:0);
