import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(fn,a)=>p.evaluate(fn,a);
const co=await ev(()=>{ const j=Object.values(APP.db.jobs)[0]; APP.login('employer',j.companyId); location.hash='#/e/company'; return j.companyId; });
await p.waitForTimeout(400);
await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(400);
t('edit form opens',await ev(()=>!!document.querySelector('form[data-form=company-edit]')),errs);
if(await ev(()=>!!document.querySelector('form[data-form=company-edit]'))){
  await p.fill('form[data-form=company-edit] [name=name]','Renamed Co'); await p.fill('form[data-form=company-edit] [name=about]','New about text');
  await p.click('form[data-form=company-edit] button[type=submit]'); await p.waitForTimeout(400);
  t('save applies the changes',await ev((c)=>APP.company(c).name==='Renamed Co'&&APP.company(c).about==='New about text'&&!APP.state.coEdit,co),await ev((c)=>[APP.company(c).name,APP.state.coEdit],co));
  t('page shows new name',await ev(()=>/Renamed Co/.test(document.body.innerText)));
}
t('no page errors',errs.filter(e=>!/ERR_FAILED/.test(e)).length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
