import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async h=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const hash=()=>p.evaluate(()=>location.hash);
const dlg=()=>p.locator('#dlg-root .dlg').count();
const cid=await p.evaluate(()=>{ const c=Object.values(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c.id}; return c.id; });
const head0=await p.evaluate(id=>APP.consultant(id).headline,cid);
await go('#/c/profile');
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
t('edit bar with title',/Editing your profile/.test(await p.textContent('.edit-bar')));
t('Cancel and Save at the top',await p.locator('.edit-bar [data-action=edit-cancel]').count()===1&&await p.locator('.edit-bar button[type=submit][form=f-profile-edit]').count()===1);
t('Cancel next to Save at the bottom',await p.locator('.edit-foot [data-action=edit-cancel]').count()===1&&await p.locator('.edit-foot button[type=submit]').count()===1);
await p.click('.edit-bar [data-action=edit-cancel]'); await p.waitForTimeout(200);
t('no changes: Cancel closes without asking',await dlg()===0&&await p.locator('.edit-bar').count()===0);
// changed, cancel -> keep editing
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
await p.fill('form[data-form=profile-edit] input[name=headline]','Changed headline');
await p.click('.edit-foot [data-action=edit-cancel]'); await p.waitForTimeout(200);
t('changes: asks to discard',await dlg()===1&&/Discard your changes/.test(await p.textContent('.dlg')));
t('Keep editing option',(await p.textContent('.dlg-foot')).includes('Keep editing'));
await p.click('.dlg-foot [data-action=dlg-cancel]'); await p.waitForTimeout(250);
t('keep editing keeps the text',await p.inputValue('form[data-form=profile-edit] input[name=headline]')==='Changed headline');
await p.click('.edit-bar [data-action=edit-cancel]'); await p.waitForTimeout(200); await p.click('#dlg-ok'); await p.waitForTimeout(250);
t('discard closes the editor',await p.locator('.edit-bar').count()===0);
t('profile unchanged',await p.evaluate(id=>APP.consultant(id).headline,cid)===head0);
// navigate away with unsaved changes
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
await p.fill('form[data-form=profile-edit] input[name=headline]','Another change');
await go('#/c/jobs');
t('leaving asks first',await dlg()===1&&(await hash())==='#/c/profile',await hash());
await p.click('.dlg-foot [data-action=dlg-cancel]'); await p.waitForTimeout(250);
t('still editing after Keep editing',await p.inputValue('form[data-form=profile-edit] input[name=headline]')==='Another change');
await go('#/c/jobs'); await p.click('#dlg-ok'); await p.waitForTimeout(350);
t('discard continues to the new page',(await hash())==='#/c/jobs',await hash());
t('changes dropped',await p.evaluate(id=>APP.consultant(id).headline,cid)===head0);
// save goes through without asking
await go('#/c/profile'); await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
await p.fill('form[data-form=profile-edit] input[name=headline]','Saved headline');
await p.click('.edit-bar button[type=submit]'); await p.waitForTimeout(300);
t('top Save saves',await dlg()===0&&await p.evaluate(id=>APP.consultant(id).headline,cid)==='Saved headline');
await go('#/c/jobs'); t('no question after saving',await dlg()===0&&(await hash())==='#/c/jobs');
// company profile
const co=await p.evaluate(()=>{ const c=Object.values(APP.db.companies)[0]; APP.db.session={role:'employer',companyId:c.id}; return c.id; });
await go('#/e/company'); await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(200);
t('company edit bar',/Editing your company profile/.test(await p.textContent('.edit-bar')));
await p.fill('form[data-form=company-edit] input[name=name]','Renamed Co');
await go('#/e/dashboard'); t('company: leaving asks',await dlg()===1); await p.click('#dlg-ok'); await p.waitForTimeout(300);
t('company name unchanged',await p.evaluate(id=>APP.company(id).name!=='Renamed Co',co));
// job edit
const jid=await p.evaluate(co=>Object.values(APP.db.jobs).find(j=>j.companyId===co).id,co);
await go('#/e/jobs/'+jid+'/edit');
t('job edit bar names the role',/Editing role:/.test(await p.textContent('.edit-bar')));
await p.click('.edit-foot [data-action=edit-cancel]'); await p.waitForTimeout(250);
t('job: no changes cancel returns to the role',(await hash())==='#/e/jobs/'+jid&&await dlg()===0,await hash());
await go('#/e/jobs/'+jid+'/edit');
await p.fill('form[data-form=job-post] input[name=title]','New title');
await p.click('.edit-bar [data-action=edit-cancel]'); await p.waitForTimeout(200);
t('job: asks to discard',await dlg()===1); await p.click('#dlg-ok'); await p.waitForTimeout(300);
t('job: discard returns to the role',(await hash())==='#/e/jobs/'+jid,await hash());
t('job title unchanged',await p.evaluate(id=>APP.job(id).title!=='New title',jid));
// new role wizard
await go('#/e/jobs/new');
t('new role: visible Cancel',await p.locator('.publish-bar [data-action=edit-cancel].btn-outline').count()===1&&await p.locator('.edit-bar [data-action=edit-cancel]').count()===1);
// mobile: bottom bar stays visible
await p.setViewportSize({width:390,height:800}); await go('#/c/jobs');
await p.evaluate(()=>{ APP.db.session={role:'consultant',consultantId:Object.keys(APP.db.consultants)[0]}; }); await go('#/c/profile');
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
const fb=await p.evaluate(()=>{ const r=document.querySelector('.edit-foot').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,h:innerHeight}; });
t('mobile: Cancel/Save bar fixed on screen',fb.bottom<=fb.h&&fb.top<fb.h,fb);
if(process.env.SHOT){ await p.setViewportSize({width:1280,height:900}); await p.evaluate(()=>scrollTo(0,0)); await p.screenshot({path:process.env.SHOT}); }
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
