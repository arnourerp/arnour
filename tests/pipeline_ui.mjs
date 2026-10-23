import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async h=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(350); };
const ids=await p.evaluate(()=>{
  const co=Object.values(APP.db.companies)[0]; const j=Object.values(APP.db.jobs).find(x=>x.companyId===co.id&&x.status==='open');
  const cs=Object.values(APP.db.consultants).slice(0,3);
  j.applicants=cs.map(c=>c.id); j.appliedTs={}; cs.forEach(c=>{ j.appliedTs[c.id]=Date.now()-86400000; }); j.appStage={}; j.appViewed={};
  APP.db.session={role:'consultant',consultantId:cs[0].id}; APP.save();
  return {co:co.id,j:j.id,a:cs[0].id,b:cs[1].id,c:cs[2].id,title:j.title};
});
// professional: applied, not viewed yet
await go('#/c/applied');
let steps=await p.evaluate(id=>{ const card=[...document.querySelectorAll('.job-card')].find(x=>x.dataset.cardHref&&x.dataset.cardHref.endsWith(id)); return card?[...card.querySelectorAll('.app-steps li')].map(l=>l.className+':'+l.textContent.trim().split(' ')[0]):null; },ids.j);
t('professional sees Applied → Viewed → Shortlisted steps',steps&&steps.length===3&&steps[0].startsWith('done')&&!steps[1].startsWith('done'),steps);
// company opens the role: applicants become viewed, tabs show counts
await p.evaluate(co=>{APP.db.session={role:'employer',companyId:co};},ids.co);
await go('#/e/jobs/'+ids.j);
t('stage filters with counts',/New \(3\)/.test(await p.textContent('.jd-filters'))&&/Shortlisted \(0\)/.test(await p.textContent('.jd-filters')),await p.textContent('.jd-filters'));
t('opening the list marks them viewed',await p.evaluate(id=>Object.keys(APP.job(id).appViewed||{}).length===3,ids.j));
await p.click('[data-action=app-stage][data-cid="'+ids.a+'"][data-stage=shortlisted]'); await p.waitForTimeout(250);
t('shortlisted pill',await p.locator('.talent-card .pill.inv:has-text("Shortlisted")').count()===1);
t('professional told',await p.evaluate(a=>(APP.db.notifications[a]||[]).some(n=>/shortlisted you for/.test(n.text)),ids.a));
await p.click('[data-action=app-stage][data-cid="'+ids.b+'"][data-stage=declined]'); await p.waitForTimeout(250);
t('not selected: not told yet',!(await p.evaluate(b=>(APP.db.notifications[b]||[]).some(n=>/not move forward/.test(n.text)),ids.b)));
t('counts update',/Shortlisted \(1\)/.test(await p.textContent('.jd-filters'))&&/Not selected \(1\)/.test(await p.textContent('.jd-filters')));
await p.click('[data-action=app-filter][data-f=shortlisted]'); await p.waitForTimeout(200);
t('filter by stage',await p.locator('.talent-card').count()===1);
await p.click('[data-action=app-filter][data-f=all]'); await p.waitForTimeout(200);
t('Shortlisted in the side stats',/Shortlisted/.test(await p.textContent('.jd-stats')));
// close with a hire
await p.click('[data-action=close-job]'); await p.waitForTimeout(200);
t('close asks who was hired (optional)',/Did you hire someone through Arnour/.test(await p.textContent('.dlg')));
await p.selectOption('#dlg-hired',ids.a); await p.click('#dlg-ok'); await p.waitForTimeout(300);
t('role closed with the hire',await p.evaluate(id=>APP.job(id).status==='closed'&&APP.job(id).hiredId,ids.j)===true||await p.evaluate(id=>APP.job(id).status==='closed'&&!!APP.job(id).hiredId,ids.j));
t('others told politely',await p.evaluate(x=>[x.b,x.c].every(c=>(APP.db.notifications[c]||[]).some(n=>/is now closed\. Thank you for applying/.test(n.text))),ids));
t('the hire is not told',!(await p.evaluate(a=>(APP.db.notifications[a]||[]).some(n=>/not move forward/.test(n.text)),ids.a)));
// professional view after close
await p.evaluate(b=>{APP.db.session={role:'consultant',consultantId:b};},ids.b); await go('#/c/applied');
t('closed role shown to the professional',/Role closed · the company is not moving forward/.test(await p.textContent('#main')));
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
