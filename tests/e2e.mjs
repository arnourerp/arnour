import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend();
const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[];
async function newPage(name,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}}); const page=await ctx.newPage();
  page.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(name+': '+m.text()); });
  page.on('pageerror',e=>errors.push(name+' PAGEERR: '+e.message));
  await page.exposeFunction('__sb',be.handle);
  await page.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await page.route('**/fonts.googleapis.com/**',r=>r.abort());
  return page;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(250); };
const idle=async(p)=>{ await p.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); };
const q=async(sql,params)=>(await be.db.query(sql,params)).rows;
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';

// ---------- signed-out visitor
const v=await newPage('visitor');
await v.goto(BASE); await v.waitForSelector('.hero',{timeout:8000});
t('live mode on',await v.evaluate(()=>APP.LIVE===true));
t('no prototype banner',(await v.locator('.proto-banner').count())===0);
t('visitor sees sample jobs',await v.evaluate(()=>Object.keys(APP.db.jobs).length>=20));
await go(v,'#/jobs'); t('jobs page has Sample pills',(await v.locator('.sample-pill').count())>0);
await go(v,'#/login'); t('login has no demo accounts',(await v.locator('.demo-acct').count())===0&&(await v.locator('form[data-form=live-login]').count())===1);
await go(v,'#/onboard'); t('wizard redirects signed-out to register',await v.evaluate(()=>location.hash.startsWith('#/register')));
await go(v,'#/c/dashboard'); t('private page redirects to login',await v.evaluate(()=>location.hash==='#/login'));
await go(v,'#/privacy'); t('privacy page',(await v.locator('.legal').count())===1);
await go(v,'#/terms'); t('terms page',(await v.locator('.legal').count())===1);

// ---------- professional registers (private mode)
const c=await newPage('pro');
await c.goto(BASE); await c.waitForSelector('.hero');
await go(c,'#/register/c');
await c.fill('input[name=email]','pro@test.com'); await c.fill('input[name=password]','short');
await c.click('form[data-form=live-register] button[type=submit]'); await c.waitForTimeout(200);
t('short password refused',(await c.textContent('#live-err')).includes('8'));
await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-register] button[type=submit]'); await c.waitForTimeout(200);
t('terms required',(await c.textContent('#live-err')).toLowerCase().includes('terms'));
await c.check('input[name=terms]'); await c.click('form[data-form=live-register] button[type=submit]');
await c.waitForFunction(()=>location.hash==='#/check-email'); t('check-email page after sign-up',true);
await go(c,'#/login'); await c.fill('input[name=email]','pro@test.com'); await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(400);
t('unconfirmed email blocked',(await c.locator('.live-note.warn').count())===1);
await c.fill('input[name=password]','wrongpass'); 
be.users['pro@test.com'].confirmed=true;
await c.fill('input[name=password]','wrongpass'); await c.click('form[data-form=live-login] button[type=submit]'); await c.waitForTimeout(400);
t('wrong password message',(await c.textContent('#live-err')).includes('incorrect'));
await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]');
await c.waitForFunction(()=>location.hash==='#/onboard',null,{timeout:6000}); t('first login goes to profile wizard',true);
await go(c,'#/c/dashboard'); t('cannot skip the wizard',await c.evaluate(()=>location.hash==='#/onboard'));
await c.evaluate(()=>{ APP.wizC={step:6,data:Object.assign(APP.wizCDefaults(),{firstName:'Real',lastName:'Person',headline:'Senior FICO Consultant',nationality:'Egypt',country:'ae',city:'Dubai',roleType:'functional',languages:['English'],level:'Senior',yearsExp:8,anon:true,skills:[{productId:'s4onprem',moduleId:'fi',projects:5}],summary:'my private summary'})}; APP._formSyncSkip=['wiz-c']; APP.render(); });
await c.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit());
await c.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:8000}); t('wizard creates profile and opens dashboard',true);
const cid=await c.evaluate(()=>APP.db.session.consultantId); t('server id assigned',/^c-/.test(cid),cid);
t('profile saved on server (anon)',(await q(`select anon, data->>'firstName' fn from consultants where id=$1`,[cid]))[0].anon===true);

// ---------- employer registers
const e=await newPage('employer');
await e.goto(BASE); await e.waitForSelector('.hero'); await go(e,'#/register/e');
await e.fill('input[name=email]','hr@acme.com'); await e.fill('input[name=password]','longenough1'); await e.check('input[name=terms]');
await e.click('form[data-form=live-register] button[type=submit]'); await e.waitForFunction(()=>location.hash==='#/check-email');
const u=be.users['hr@acme.com']; 
await e.goto(BASE+'?token_hash='+u.token+'&type=signup'); 
await e.waitForFunction(()=>location.hash==='#/onboard-e',null,{timeout:8000}); t('email link confirms and opens company wizard',true);
t('url cleaned',await e.evaluate(()=>!location.search));
await e.evaluate(()=>{ APP.wizE={step:3,data:Object.assign({},APP.wizE&&APP.wizE.data,{name:'Acme Retail',industry:'Retail & Consumer Goods (FMCG)',size:'201-500',country:'ae',city:'Dubai',website:'acme.example',about:'We sell things',contactName:'Hana HR',contactTitle:'Talent',sapSystems:['s4onprem'],anon:false})}; APP._formSyncSkip=['wiz-e']; APP.render(); });
await e.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit());
await e.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:8000}); t('company created',true);
const eid=await e.evaluate(()=>APP.db.session.companyId);

// employer posts a public role + a confidential role
await e.evaluate((eid)=>{ const base={companyId:eid,requires:[{productId:'s4onprem',moduleId:'fi',minProjects:1}],industry:'Retail & Consumer Goods (FMCG)',certification:'none',employmentType:'Contract',duration:'6 months',city:'Dubai',country:'ae',remote:false,currency:'USD',rateMin:400,rateMax:600,minExp:3,languages:['English'],description:'desc',applicants:[],invited:[],postedTs:Date.now(),status:'open'};
 APP.db.jobs['jpub1']=Object.assign({id:'jpub1',title:'Public FICO role'},base);
 APP.db.jobs['jsec1']=Object.assign({id:'jsec1',title:'Secret FICO role',confidential:true},base); APP.save(); },eid);
await idle(e);
t('jobs saved on server',(await q(`select id,confidential from jobs where owner is not null order by id`)).length===2);

// professional sees roles; confidential company hidden
await c.evaluate(()=>APP.backend.refresh()); await c.waitForTimeout(600);
const seen=await c.evaluate(()=>({pub:APP.db.jobs.jpub1&&APP.db.jobs.jpub1.companyId,sec:APP.db.jobs.jsec1&&APP.db.jobs.jsec1.companyId,names:JSON.stringify(APP.db.companies)}));
t('professional sees public role with company',seen.pub&&!seen.pub.startsWith('c')===false&&seen.pub.startsWith('co-'),seen);
t('confidential role company is an alias',seen.sec&&seen.sec.startsWith('cj:'),seen.sec);
t('real name of confidential employer not exposed for that role',(await c.evaluate(()=>APP.company(APP.db.jobs.jsec1.companyId)))._anon===true);
// apply
await c.evaluate(()=>{ APP.applyToJob('jpub1','I am a fit'); }); await idle(c);
t('application stored',(await q(`select * from applications where job_id='jpub1' and consultant_id=$1`,[cid])).length===1);
// employer sees the applicant, anonymised
await e.evaluate(()=>APP.backend.refresh()); await e.waitForTimeout(600);
const app=await e.evaluate((cid)=>{ const j=APP.db.jobs.jpub1; const cc=APP.db.consultants[cid]; return {n:j.applicants.length, note:j.applyNotes[cid], fn:cc.firstName, name:APP.consultantFullName(cc), summary:cc.summary, raw:JSON.stringify(cc).slice(0,400), notif:(APP.db.notifications[APP.db.session.companyId]||[]).map(n=>n.text)}; },cid);
t('employer sees applicant',app.n===1&&app.note==='I am a fit',app);
t('applicant identity hidden from employer',app.fn===''&&!app.summary&&!/Real/.test(app.name)&&app.name==='Senior FICO Consultant',app);
t('notification does not leak the name',app.notif.length>=1&&!app.notif.some(x=>/Real|Person/.test(x))&&app.notif.some(x=>/applied/.test(x)),app.notif);
await go(e,'#/e/talent/'+cid); t('employer talent page shows no real name',!/Real Person/.test(await e.content())&&!/my private summary/.test(await e.content()));
// an anonymous applicant is an introduction request: the employer accepts it
await e.evaluate(()=>APP.backend.poll()); await e.waitForTimeout(500);
const intro=await e.evaluate(()=>Object.values(APP.intros()).map(i=>({id:i.id,from:i.from,status:i.status})));
t('employer sees pending introduction from the applicant',intro.length===1&&intro[0].from==='c'&&intro[0].status==='pending',intro);
await e.evaluate((id)=>{ APP.respondIntro(id,true,{}); },intro[0].id); await idle(e);
t('intro accepted on server',(await q(`select status from intros`))[0].status==='accepted');
t('conversation exists after accept',(await q(`select * from conversations`)).length===1);
await e.evaluate(()=>APP.backend.refresh()); await e.waitForTimeout(600);
const rev=await e.evaluate((cid)=>({fn:APP.db.consultants[cid].firstName,sum:APP.db.consultants[cid].summary,msgs:Object.values(APP.db.conversations).map(c=>c.messages.length)}),cid);
t('identity revealed to employer after accept',rev.fn==='Real'&&rev.sum==='my private summary'&&rev.msgs.length===1,rev);
await c.evaluate(()=>APP.backend.poll()); await c.waitForTimeout(600);
t('professional sees the accepted chat',await c.evaluate(()=>Object.values(APP.db.conversations).length===1));
// messaging both ways
await e.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; APP.pushMessage(cv.id,'e','Hello from Acme'); }); await idle(e);
await c.evaluate(()=>APP.backend.poll()); await c.waitForTimeout(700);
const m1=await c.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; return {texts:cv.messages.map(m=>m.text),unread:cv.unread.c,badge:APP.unreadMsgs()}; });
t('professional receives message with unread count',m1.texts.includes('Hello from Acme')&&m1.unread>=1,m1);
await go(c,'#/c/messages/'+await c.evaluate(()=>Object.keys(APP.db.conversations)[0])); await c.waitForTimeout(400); await idle(c);
t('read state saved',(await q(`select c_read from conversations`))[0].c_read>0);
await c.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; APP.pushMessage(cv.id,'c','Reply from pro'); }); await idle(c);
await e.evaluate(()=>APP.backend.poll()); await e.waitForTimeout(700);
t('employer receives reply',await e.evaluate(()=>Object.values(APP.db.conversations)[0].messages.some(m=>m.text==='Reply from pro')));
t('message count on server',(await q(`select count(*)::int n from messages`))[0].n>=3);
// CV-only message and download
await c.evaluate((cid)=>{ const me=APP.currentUser(); me.cv={name:'MyCV.pdf',size:'1 MB',path:APP.backend.user.id+'/1-cv.pdf'}; APP.save(); },cid); await idle(c);
await c.evaluate(()=>{ location.hash='#/c/messages/'+Object.keys(APP.db.conversations)[0]; APP.render(); }); await c.waitForTimeout(500);
await c.click('[data-action=attach-cv]'); await c.waitForTimeout(200);
await c.evaluate(()=>document.querySelector('form[data-form=chat]').requestSubmit()); await c.waitForTimeout(300); await idle(c);
t('CV can be sent without a message',(await q(`select cv->>'name' n from messages where cv->>'path' is not null`)).length===1);
t('CV bubble has a download button',(await c.locator('.msg-cv .cv-dl').count())===1);
await e.evaluate(()=>APP.backend.poll()); await e.waitForTimeout(600);
await e.evaluate(()=>{ location.hash='#/e/messages/'+Object.keys(APP.db.conversations)[0]; APP.render(); }); await e.waitForTimeout(500);
t('company sees the CV with Download',(await e.locator('.msg-cv .cv-dl').count())===1);
await e.click('.msg-cv .cv-dl'); await e.waitForTimeout(400);
t('download asks for a signed link',await e.evaluate(()=>window.__signed&&/1-cv\.pdf$/.test(window.__signed)));
// call proposal
await e.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; APP.pushMessage(cv.id,'e','',false,{call:{ts:Date.now()+864e5,dur:30,note:'quick',status:'proposed'}}); }); await idle(e);
await c.evaluate(()=>APP.backend.poll()); await c.waitForTimeout(700);
const callMsg=await c.evaluate(()=>{ const cv=Object.values(APP.db.conversations)[0]; const i=cv.messages.findIndex(m=>m.call); const m=cv.messages[i]; m.call.status='accepted'; APP.save(); return {i,id:m.id}; });
await idle(c);
t('call answer synced',(await q(`select call->>'status' s from messages where call is not null`))[0].s==='accepted',callMsg);
// logout
await c.evaluate(()=>APP.logout()); await c.waitForTimeout(800);
t('logout returns to public home',await c.evaluate(()=>!APP.db.session&&!APP.backend.profile));
await go(c,'#/c/messages'); t('private page blocked after logout',await c.evaluate(()=>location.hash==='#/login'));
// returning sign-in restores everything
await c.fill('input[name=email]','pro@test.com'); await c.fill('input[name=password]','longenough1'); await c.click('form[data-form=live-login] button[type=submit]');
await c.waitForFunction(()=>location.hash==='#/c/messages',null,{timeout:6000}); t('sign-in again returns to the page that was wanted',true);
t('data restored after sign-in',await c.evaluate(()=>Object.values(APP.db.conversations).length===1&&APP.db.jobs.jpub1.applicants.length===1),await c.evaluate(()=>[Object.values(APP.db.conversations).length,APP.db.jobs.jpub1&&APP.db.jobs.jpub1.applicants]));
// profile edit saves
await c.evaluate(()=>{ const me=APP.currentUser(); me.headline='Principal FICO Consultant'; APP.save(); }); await idle(c);
t('profile edit saved',(await q(`select data->>'headline' h from consultants where id=$1`,[cid]))[0].h==='Principal FICO Consultant');
// account deletion
await go(c,'#/account'); t('account page',(await c.locator('[data-action=live-delete]').count())===1);
await c.evaluate(()=>APP.backend.sb.rpc('delete_my_account')); await c.waitForTimeout(300);
t('account deletion removes data',(await q(`select * from consultants where id=$1`,[cid])).length===0&&(await q(`select * from messages`)).length===0);

console.log('page errors:',errors.length?errors:'none');
console.log(fails?`\n${fails} FAILURES`:'\nALL PASSED'); await browser.close(); process.exit(0);
