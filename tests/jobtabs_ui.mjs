/* Job page: professionals get "My match" / "Job post" tabs; the company's match breakdown lists each requirement with its status */
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
  const c=Object.values(APP.db.consultants)[0];
  Object.assign(c,{roleType:'functional',roleTypes:['functional'],languages:['English'],industries:['Banking & Financial Services'],yearsExp:6,
    skills:[{productId:'s4onprem',moduleId:'fi',projects:1,certified:false},{productId:'ecc',moduleId:'co',projects:4}]});
  const j=Object.values(APP.db.jobs).find(x=>x.status==='open'&&!x.confidential);
  Object.assign(j,{roleType:'functional',confidential:false,languages:['English','Arabic'],minExp:8,description:'Plain job text for everyone.',
    requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3},{productId:'s4onprem',moduleId:'mm'},{productId:'successfactors',moduleId:'ec'}]});
  APP.db.session={role:'consultant',consultantId:c.id};
  return {cid:c.id,jid:j.id,eid:j.companyId}; });
await p.evaluate(x=>{location.hash='#/job/'+x;},ids.jid); await p.waitForTimeout(400);
t('a professional with a profile sees two tabs',await p.locator('.jd-main .jd-tabs .seg-tab').count()===2);
t('"My match" is the default tab',/My match/.test(await p.locator('.jd-tabs .seg-tab.on').innerText()));
t('the requirements carry the traffic lights',await p.locator('.jd-reqs .st-ok, .jd-reqs .st-mid, .jd-reqs .st-no').count()>=3);
t('the match card is shown',await p.locator('#jd-match').count()===1);
if(SHOTS) await p.screenshot({path:SHOTS+'/prof-match.png'});
await p.locator('.jd-tabs .seg-tab', {hasText:'Job post'}).click(); await p.waitForTimeout(250);
t('"Job post" shows the role without any status',await p.locator('.jd-reqs .st-ok, .jd-reqs .st-mid, .jd-reqs .st-no, .jd-why').count()===0&&await p.locator('.jd-reqs li').count()>=3);
t('…with the description and the role details',/Plain job text/.test(await p.locator('.jd-main').innerText())&&await p.locator('.jd-facts').count()===1);
t('…and no match card, but Apply and Save are still there',await p.locator('#jd-match').count()===0&&await p.locator('.jd-act .jd-apply').count()===1&&await p.locator('.jd-act', {hasText:'Save'}).count()===1);
t('the Job post tab is the selected one',/Job post/.test(await p.locator('.jd-tabs .seg-tab.on').innerText()));
if(SHOTS) await p.screenshot({path:SHOTS+'/prof-post.png'});
await p.locator('.jd-tabs .seg-tab', {hasText:'My match'}).click(); await p.waitForTimeout(250);
t('back to "My match" restores the traffic lights and the match card',await p.locator('.jd-reqs .st-no').count()>=1&&await p.locator('#jd-match').count()===1);
/* visitors and people without a profile: no tabs */
await p.evaluate(()=>{APP.db.session=null; APP.render();}); await p.waitForTimeout(200);
t('a visitor sees no tabs',await p.locator('.jd-tabs').count()===0);
/* the company: requirement list in the match breakdown */
await p.evaluate(x=>{APP.db.session={role:'employer',companyId:x.eid}; APP.openMatchDrawer(x.cid,x.jid);},ids); await p.waitForTimeout(500);
const dr=await p.evaluate(()=>{const d=document.querySelector('.drawer-body'); return {txt:d?d.innerText.replace(/\s+/g,' '):'', rows:d?Array.from(d.querySelectorAll('li.jd-req')).map(li=>li.className+' | '+li.innerText.replace(/\s+/g,' ')):[]};});
t('the breakdown lists each requirement with a status',dr.rows.length>=4&&dr.rows.some(r=>/st-ok|st-mid/.test(r))&&dr.rows.some(r=>/st-no/.test(r)),dr.rows);
t('it is worded for the company ("Has …", "their profile")',/Has 1 of 3 projects|Has this/.test(dr.txt)&&/Not on their profile|but not this module/.test(dr.txt)&&!/\b(You have|You know|your profile)\b/.test(dr.txt),dr.txt.slice(0,400));
t('the score bars are still there',/how the score is built/i.test(dr.txt));
if(SHOTS) await p.screenshot({path:SHOTS+'/company-drawer.png'});
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
