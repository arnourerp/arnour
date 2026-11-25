/* "← Back to …" links and the browser Back button after saving or leaving a form. Demo mode (sample data). */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch();
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[];
async function open(role){
  const p=await b.newPage({viewport:{width:1200,height:1100}});
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
  const jid=await p.evaluate(r=>{ const j=Object.values(APP.db.jobs).find(x=>x.status==='open');
    APP.db.session=r==='e'?{role:'employer',companyId:j.companyId}:{role:'consultant',consultantId:Object.values(APP.db.consultants)[0].id}; APP.jobNewDraft=null; return j.id; },role);
  return {p,jid};
}
const hash=p=>p.evaluate(()=>location.hash);
const nav=async(p,h)=>{ await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(350); };
const crumb=p=>p.evaluate(()=>{ const a=document.querySelector('.crumb a[data-action=nav-back]'); return a?{href:a.dataset.href,text:a.textContent.trim()}:null; });
const clickCrumb=async p=>{ const c=await crumb(p); await p.click('.crumb a[data-action=nav-back]'); await p.waitForTimeout(500); return c; };
const save=async p=>{ await p.evaluate(()=>{ const f=[...document.querySelectorAll('form')].filter(x=>x.querySelector('[name=title]')).pop(); f.requestSubmit(); }); await p.waitForTimeout(700); };

/* A: the reported bug: My roles > role > Edit > Save > "Back to My roles" */
{ const {p,jid}=await open('e');
  await nav(p,'#/e/jobs'); await nav(p,'#/e/jobs/'+jid); await nav(p,'#/e/jobs/'+jid+'/edit');
  await save(p);
  t('A: Save returns to the role page',await hash(p)==='#/e/jobs/'+jid,await hash(p));
  const c=await clickCrumb(p);
  t('A: the link says My roles and goes to My roles, not back to the edit form',c&&/My roles/.test(c.text)&&await hash(p)==='#/e/jobs',{c,h:await hash(p)});
  await p.close(); }

/* B: after Save the browser's own Back skips the edit form */
{ const {p,jid}=await open('e');
  await nav(p,'#/e/jobs'); await nav(p,'#/e/jobs/'+jid); await nav(p,'#/e/jobs/'+jid+'/edit');
  await save(p); await p.goBack(); await p.waitForTimeout(450);
  t('B: browser Back after Save goes to My roles, not the edit form',await hash(p)==='#/e/jobs',await hash(p));
  await p.close(); }

/* C: Cancel on the edit form leaves no edit entry behind */
{ const {p,jid}=await open('e');
  await nav(p,'#/e/jobs'); await nav(p,'#/e/jobs/'+jid); await nav(p,'#/e/jobs/'+jid+'/edit');
  await p.click('.edit-bar [data-action=edit-cancel], [data-action=edit-cancel]'); await p.waitForTimeout(500);
  t('C: Cancel returns to the role page',await hash(p)==='#/e/jobs/'+jid,await hash(p));
  const c=await clickCrumb(p);
  t('C: then the Back link goes to My roles',await hash(p)==='#/e/jobs'&&c&&/My roles/.test(c.text),{c,h:await hash(p)});
  await p.close(); }

/* D: posting a new role: the new-role form is not left in the history */
{ const {p,jid}=await open('e');
  await nav(p,'#/e/jobs'); await nav(p,'#/e/jobs/new');
  await p.fill('[name=title]','Nav test role');
  await p.evaluate(()=>{ APP.state.draftSave=true; const f=[...document.querySelectorAll('form')].filter(x=>x.querySelector('[name=title]')).pop(); f.requestSubmit(); }); await p.waitForTimeout(700);
  const h=await hash(p);
  t('D: Save as draft opens the new role page',/^#\/e\/jobs\/(?!new)[^/]+$/.test(h),h);
  await p.goBack(); await p.waitForTimeout(450);
  t('D: browser Back from it goes to My roles, not the new-role form',await hash(p)==='#/e/jobs',await hash(p));
  await p.close(); }

/* E: coming back to a page by a link must not make the Back link jump to the page we just left */
const cases=[
  ['E: company: role > dashboard > same role',  'e',['#/e/jobs','#/e/jobs/JID','#/e/dashboard','#/e/jobs/JID'],'#/e/jobs'],
  ['E: company: role > new role form > role',    'e',['#/e/jobs','#/e/jobs/JID','#/e/jobs/new','#/e/jobs/JID'],'#/e/jobs'],
  ['E: company: list > role > list > role',      'e',['#/e/dashboard','#/e/jobs','#/e/jobs/JID','#/e/jobs','#/e/jobs/JID'],'#/e/jobs'],
  ['E: professional: job > dashboard > same job','c',['#/c/jobs','#/job/JID','#/c/dashboard','#/job/JID'],'#/c/jobs'],
  ['E: professional: job > profile > list > job', 'c',['#/c/jobs','#/job/JID','#/c/profile','#/c/jobs','#/job/JID'],'#/c/jobs'],
];
for(const [n,role,seq,want] of cases){ const {p,jid}=await open(role); for(const h of seq) await nav(p,h.replace('JID',jid)); await clickCrumb(p); t(n+' -> Back link lands on '+want,await hash(p)===want,await hash(p)); await p.close(); }

/* F: a real browser Back still works and the link then follows it */
{ const {p,jid}=await open('c');
  await nav(p,'#/c/dashboard'); await nav(p,'#/c/jobs'); await nav(p,'#/job/'+jid);
  await p.goBack(); await p.waitForTimeout(400); await p.goForward(); await p.waitForTimeout(400);
  const c=await clickCrumb(p);
  t('F: after a real Back and Forward the link still goes where it says',await hash(p)==='#/c/jobs'&&c&&/job search/.test(c.text),{c,h:await hash(p)});
  await p.close(); }

t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
