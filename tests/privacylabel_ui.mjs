/* Own profile page: a label says whether the profile is Hidden or Public, and tapping it opens Edit profile at Privacy. Demo mode. */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:1000}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const id=await p.evaluate(()=>{ const c=Object.values(APP.db.consultants)[0]; c.anon=true; c.headline='SAP FICO Consultant'; APP.db.session={role:'consultant',consultantId:c.id}; return c.id; });
const go=async h=>{ await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(450); };
const chip=()=>p.evaluate(()=>{ const e=document.querySelector('.priv-chip'); return e?{cls:e.className,text:e.textContent.replace(/\s+/g,' ').trim()}:null; });

await go('#/c/profile');
let c=await chip();
t('A: a hidden profile shows the Hidden label with the headline companies see',c&&/is-hidden/.test(c.cls)&&/^Hidden/.test(c.text)&&/SAP FICO Consultant/.test(c.text)&&/until you accept/.test(c.text),c);
t('A: the label sits under the headline, above the details',await p.evaluate(()=>{ const h=document.querySelector('.profile-head-card .grow'); const k=[...h.children].map(x=>x.className||x.tagName); return k.indexOf('priv-chip is-hidden')>k.indexOf('P')&&k.indexOf('priv-chip is-hidden')<k.indexOf('profile-meta mt8'); }));
await p.click('.priv-chip'); await p.waitForTimeout(400);
t('A: tapping it opens Edit profile at the Privacy section',await p.evaluate(()=>APP.state.profileEdit===true&&APP.state.profileSec==='privacy'&&!!document.querySelector('.pe-side, .pe-menu, .pe-nav, [data-action=psec]')),await p.evaluate(()=>[APP.state.profileEdit,APP.state.profileSec]));
await p.evaluate(()=>{ APP.state.profileEdit=false; APP.profileDraft=null; Object.values(APP.db.consultants)[0].anon=false; }); await go('#/c/dashboard'); await go('#/c/profile');
c=await chip();
t('B: a visible profile shows the Public label',c&&/is-public/.test(c.cls)&&/^Public/.test(c.text)&&/your name/.test(c.text),c);

/* the label is for the owner only */
await go('#/talent/'+id);
t('C: the public view of the profile has no label',(await chip())===null);
await p.evaluate(()=>{ const cid=Object.values(APP.db.companies)[0].id; APP.db.session={role:'employer',companyId:cid}; });
await go('#/e/talent/'+id);
t('C: companies do not see the label',(await chip())===null);

/* phone */
await p.evaluate(x=>{ APP.db.session={role:'consultant',consultantId:x}; Object.values(APP.db.consultants)[0].anon=true; },id);
await p.setViewportSize({width:375,height:800}); await go('#/c/profile');
t('D: on a phone the label fits the screen',await p.evaluate(()=>{ const e=document.querySelector('.priv-chip'); const r=e.getBoundingClientRect(); return r.right<=innerWidth&&r.left>=0&&document.documentElement.scrollWidth<=innerWidth; }));
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
