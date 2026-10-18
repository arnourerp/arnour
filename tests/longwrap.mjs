import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:800}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const LONG='S/4HANA/BTP/CPI/ABAP/Fiori/Datasphere/IntegrationSuite/'+'X'.repeat(40);
const URL='https://www.linkedin.com/in/'+'averyveryverylongprofilename'.repeat(3);
await p.evaluate(([L,U])=>{
  const cs=Object.values(APP.db.consultants); const c=cs[0]; c.headline=L; c.linkedin=U; c.summary=L+' '+U;
  const j=Object.values(APP.db.jobs)[0]; j.title=L; j.description=L+'\n'+U;
  const co=APP.company(j.companyId); co.name='Company'+'Z'.repeat(50); co.about=U;
  window.__ids={c:c.id,j:j.id,co:co.id};
},[LONG,URL]);
const over=()=>p.evaluate(()=>{ const W=innerWidth; if(document.documentElement.scrollWidth<=W+1) return null;
  const bad=[]; document.querySelectorAll('#main *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.right>W+2&&r.width>0&&!el.closest('.chip-scroll,.h-scroll,[data-scroll-x]')) bad.push((el.className||el.tagName)+'');}); return [...new Set(bad)].slice(0,5); });
const ids=await p.evaluate(()=>window.__ids);
const pages={c:['#/c/profile','#/c/dashboard','#/c/jobs','#/job/'+ids.j,'#/company/'+ids.co,'#/talent/'+ids.c],
             e:['#/e/talent','#/e/talent/'+ids.c,'#/e/jobs','#/e/jobs/'+ids.j,'#/e/dashboard','#/e/company','#/jobs','#/talent/'+ids.c]};
for (const role of ['c','e']) {
  await p.evaluate(([r,ids])=>{ if(r==='c') APP.db.session={role:'consultant',consultantId:ids.c}; else APP.db.session={role:'employer',companyId:ids.co}; },[role,ids]);
  for (const h of pages[role]) { await p.evaluate(x=>{location.hash=x;APP.render();},h); await p.waitForTimeout(250); const o=await over(); t(role+' '+h+' no sideways scroll with long text',!o,o); }
}
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
