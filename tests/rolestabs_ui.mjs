/* My roles: tabs per status (Live / Drafts / Closed), a badge on every card, search; Edit role: side menu with one section at a time.
   Demo mode (sample data). */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const SHOTS=process.env.SHOTS_DIR||'';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:1000}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ids=await p.evaluate(()=>{
  const js=APP.db.jobs; const live=Object.values(js).filter(x=>x.status==='open');
  const cid=live[0].companyId;
  /* start from a known company: 3 live roles, 2 drafts, 1 closed */
  Object.keys(js).forEach(k=>{ if(js[k].companyId===cid) delete js[k]; });
  const base=JSON.parse(JSON.stringify(live[0]));
  const mk=(id,title,status,extra)=>{ const c=Object.assign(JSON.parse(JSON.stringify(base)),{id,title,status,companyId:cid,applicants:[],invited:[],postedTs:Date.now()-86400000*3},extra||{}); js[id]=c; return id; };
  mk('t1','Alpha FICO Lead','open'); mk('t2','Beta MM Consultant','open'); mk('t3','Gamma Basis Admin','open');
  mk('d1','Older draft role','draft',{editedTs:Date.now()-86400000*2}); mk('d2','Newest draft role','draft',{editedTs:Date.now()-3600000});
  mk('c1','Delta closed role','closed');
  APP.db.session={role:'employer',companyId:cid}; APP.state.rolesTab=undefined; APP.state.rolesQ='';
  return {cid}; });
const go=async h=>{ await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(350); };
const cards=async()=>p.evaluate(()=>[...document.querySelectorAll('.roles-list .job-card')].map(c=>({t:c.querySelector('h3').textContent.trim(),hidden:c.hidden,badge:(c.querySelector('.role-st')||{}).textContent})));

await go('#/e/jobs');
t('A: tabs show Live 3, Drafts 2, Closed 1 and Introductions',await p.evaluate(()=>{ const x=[...document.querySelectorAll('.roles-tabs .seg-tab')].map(e=>e.textContent.replace(/\s+/g,' ').trim()); return x.length===4&&/^Live 3$/.test(x[0])&&/^Drafts 2$/.test(x[1])&&/^Closed 1$/.test(x[2])&&/^Introductions/.test(x[3]); }));
t('A: Live opens first, with only the live roles, each marked Live',await (async()=>{ const c=await cards(); return c.length===3&&c.every(x=>x.badge==='Live')&&!c.some(x=>/draft|closed/i.test(x.t)); })());
t('A: the Live tab is the selected one',await p.evaluate(()=>document.querySelector('.roles-tabs .seg-tab.on').textContent.indexOf('Live')===0&&document.querySelector('.roles-tabs .seg-tab.on').getAttribute('aria-selected')==='true'));
if(SHOTS) await p.screenshot({path:SHOTS+'/roles-live.png'});

await p.click('[data-tab=drafts]'); await p.waitForTimeout(250);
{ const c=await cards();
  t('B: Drafts tab lists both drafts, newest first, each marked Draft',c.length===2&&c[0].t.indexOf('Newest draft role')===0&&c[1].t.indexOf('Older draft role')===0&&c.every(x=>x.badge==='Draft'),c);
  t('B: a draft offers Continue editing, Publish and Delete',await p.evaluate(()=>{ const x=document.querySelector('.roles-list .draft-card'); return !!x.querySelector('[data-action=job-publish]')&&!!x.querySelector('[data-action=job-delete]')&&/Continue editing/.test(x.textContent); }));
  t('B: the tab stays selected after a re-render',await p.evaluate(()=>{ APP.render(); return APP.state.rolesTab==='drafts'&&document.querySelector('.roles-tabs .seg-tab.on').textContent.indexOf('Drafts')===0; })); }

await p.click('[data-tab=closed]'); await p.waitForTimeout(250);
{ const c=await cards();
  t('C: Closed tab lists the closed role, marked Closed, with Reopen and Edit',c.length===1&&c[0].badge==='Closed'&&await p.evaluate(()=>!!document.querySelector('.roles-list [data-action=reopen-job]')&&!!document.querySelector('.roles-list [data-href$="/edit"]')),c);
  await p.click('[data-action=reopen-job]'); await p.waitForTimeout(400);
  t('C: Reopen moves it to Live (Live 4, Closed 0)',await p.evaluate(()=>{ const x=[...document.querySelectorAll('.roles-tabs .seg-tab')].map(e=>e.textContent.replace(/\s+/g,' ').trim()); return /^Live 4$/.test(x[0])&&/^Closed 0$/.test(x[2])&&APP.db.jobs.c1.status==='open'; }));
  t('C: an empty tab says so',await (async()=>{ await p.click('[data-tab=closed]'); await p.waitForTimeout(200); return /No closed roles yet/.test(await p.locator('.roles-list').innerText()); })()); }

await p.click('[data-tab=live]'); await p.waitForTimeout(250);
await p.fill('[data-roles-q]','beta'); await p.waitForTimeout(200);
{ const c=await cards();
  t('D: search hides the roles that do not match',c.filter(x=>!x.hidden).length===1&&c.find(x=>!x.hidden).t.indexOf('Beta')===0,c);
  await p.fill('[data-roles-q]','zzzz'); await p.waitForTimeout(150);
  t('D: no match shows a message',await p.evaluate(()=>!document.querySelector('.roles-nomatch').hidden));
  await p.fill('[data-roles-q]',''); await p.waitForTimeout(150);
  t('D: clearing the search shows all again',(await cards()).every(x=>!x.hidden)&&await p.evaluate(()=>document.querySelector('.roles-nomatch').hidden)); }

/* Introductions and back: the status tabs must work again */
await p.click('.roles-tabs a[href="#/e/intros"]'); await p.waitForTimeout(300);
t('I: Introductions opens its own page inside the tabs',await p.evaluate(()=>location.hash==='#/e/intros'&&!!document.querySelector('.roles-tabs')&&!document.querySelector('.roles-list')));
await p.click('[data-tab=drafts]'); await p.waitForTimeout(350);
t('I: from Introductions, Drafts opens the drafts',await p.evaluate(()=>location.hash==='#/e/jobs'&&document.querySelector('.roles-tabs .seg-tab.on').textContent.indexOf('Drafts')===0&&document.querySelectorAll('.roles-list .draft-card').length===2));
await p.click('.roles-tabs a[href="#/e/intros"]'); await p.waitForTimeout(300); await p.click('[data-tab=live]'); await p.waitForTimeout(350);
t('I: from Introductions, Live opens the live roles',await p.evaluate(()=>location.hash==='#/e/jobs'&&document.querySelector('.roles-tabs .seg-tab.on').textContent.indexOf('Live')===0&&document.querySelectorAll('.roles-list .job-card').length>=3));

/* no live roles: the page opens on the drafts */
await p.evaluate(()=>{ ['t1','t2','t3','c1'].forEach(k=>{ APP.db.jobs[k].status='closed'; }); APP.state.rolesTab=undefined; APP.state.rolesQ=''; });
await go('#/e/dashboard'); await go('#/e/jobs');
t('E: with no live role the Drafts tab opens first',await p.evaluate(()=>document.querySelector('.roles-tabs .seg-tab.on').textContent.indexOf('Drafts')===0));
await p.evaluate(()=>{ ['t1','t2','t3','c1'].forEach(k=>{ APP.db.jobs[k].status='open'; }); APP.state.rolesTab=undefined; });

/* ---- Edit role ---- */
await go('#/e/jobs/t1/edit'); await p.waitForSelector('.pe-layout');
t('F: Edit role has a side menu with the sections',await p.evaluate(()=>{ const x=[...document.querySelectorAll('.pe-nav .pe-tab .pe-tab-t')].map(e=>e.firstChild.textContent.trim()); return ['The role','Must have','Nice to have','About the candidate','Description','Preview'].every(l=>x.indexOf(l)!==-1); }));
t('F: only one section shows at a time, the first at start',await p.evaluate(()=>{ const v=[...document.querySelectorAll('.pe-pane')].filter(e=>!e.hidden); return v.length===1&&v[0].getAttribute('data-pane')==='role'&&!!v[0].querySelector('input[name=title]'); }));
t('F: every field stays in the form even when its section is hidden',await p.evaluate(()=>!!document.querySelector('#f-job-post select[name=level]')&&!!document.querySelector('#f-job-post textarea[name=description]')&&!!document.querySelector('#f-job-post input[name=title]')));
await p.fill('input[name=title]','Alpha FICO Lead Renamed');
await p.click('.pe-nav [data-s=candidate]'); await p.waitForTimeout(250);
t('F: the candidate section opens and the role section hides',await p.evaluate(()=>{ const v=[...document.querySelectorAll('.pe-pane')].filter(e=>!e.hidden); return v.length===1&&v[0].getAttribute('data-pane')==='candidate'&&!!v[0].querySelector('.crit-table'); }));
t('F: what was typed in another section is kept',await p.evaluate(()=>document.querySelector('input[name=title]').value==='Alpha FICO Lead Renamed'&&APP.jobNewDraft.title==='Alpha FICO Lead Renamed'));
await p.click('.pe-nav [data-s=preview]'); await p.waitForTimeout(300);
t('F: Preview shows the role as professionals see it, with the new title',await p.evaluate(()=>{ const v=document.querySelector('.pe-pane[data-pane=preview]'); return !v.hidden&&/Alpha FICO Lead Renamed/.test(v.querySelector('.job-preview').textContent); }));
t('F: Next and Back move between sections',await p.evaluate(()=>{ const n=document.querySelector('.pe-step [data-action=jobedit-sec]'); return !!n&&/Back/.test(n.textContent); }));
if(SHOTS) await p.screenshot({path:SHOTS+'/edit-preview.png'});
await p.click('.edit-bar [type=submit]'); await p.waitForTimeout(500);
t('F: Save changes saves the edit made in another section',await p.evaluate(()=>APP.db.jobs.t1.title==='Alpha FICO Lead Renamed'&&APP.db.jobs.t1.status==='open'));

/* a draft with no title cannot be published, and the page opens the section that needs it */
await p.evaluate(()=>{ APP.db.jobs.d1.title=''; APP.jobNewDraft=null; APP.state.jobEditSec=''; });
await go('#/e/jobs/d1/edit'); await p.waitForSelector('.pe-layout');
await p.click('.pe-nav [data-s=desc]'); await p.waitForTimeout(250);
await p.click('.edit-bar [type=submit]'); await p.waitForTimeout(500);
t('G: publishing without a title opens "The role" section',await p.evaluate(()=>{ const v=[...document.querySelectorAll('.pe-pane')].filter(e=>!e.hidden); return v.length===1&&v[0].getAttribute('data-pane')==='role'&&APP.db.jobs.d1.status==='draft'; }));
t('G: the role stays a draft',await p.evaluate(()=>APP.db.jobs.d1.status==='draft'));

await p.evaluate(()=>{ APP.jobNewDraft=null; APP.state.coEdit=false; }); await p.setViewportSize({width:390,height:844}); await go('#/e/dashboard'); await go('#/e/jobs'); await p.waitForSelector('.roles-tabs'); await p.waitForTimeout(300);
t('H: on a phone the page does not scroll sideways',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
t('H: the tabs scroll inside their own row',await p.evaluate(()=>{ const e=document.querySelector('.roles-tabs'); return e.scrollWidth>=e.clientWidth; }));
t('no page errors',errs.length===0,errs);
await b.close(); console.log(f?('FAILED '+f):'ALL OK'); process.exit(f?1:0);
