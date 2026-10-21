import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage();
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const BASE='http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html';
await p.goto(BASE); await p.waitForSelector('.hero');
const go=async h=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(350); };
const hash=()=>p.evaluate(()=>location.hash);
const crumb=()=>p.evaluate(()=>{const e=document.querySelector('#main .crumb a'); return e?e.textContent:'';});
const back=async()=>{ await p.click('#main .crumb a'); await p.waitForTimeout(400); };
const ids=await p.evaluate(()=>{ const c=Object.values(APP.db.consultants).find(x=>(x.skills||[]).length); APP.db.session={role:'consultant',consultantId:c.id}; APP.save(); return {me:c.id}; });
// 1. home feed -> role -> back to Home
await go('#/c/dashboard'); if(process.env.SHOT){ await p.mouse.move(700,450); await p.waitForTimeout(200); await p.screenshot({path:process.env.SHOT}); }
const jt=p.locator('#main .job-card .card-title a').first();
const col=await jt.evaluate(e=>getComputedStyle(e).color);
t('role titles look like links (blue)',col==='rgb(3, 105, 161)',col);
const coCol=await p.evaluate(()=>{const e=document.querySelector('#main .job-card a.co-link'); return e?getComputedStyle(e).color:'none';});
t('company names look like links (blue)',coCol==='rgb(3, 105, 161)'||coCol==='none',coCol);
await jt.click(); await p.waitForTimeout(400);
const jobHash=await hash();
t('opened the role',/^#\/job\//.test(jobHash),jobHash);
t('crumb says Back to Home',(await crumb())==='← Back to Home',await crumb());
await back(); t('back returns to Home feed',(await hash())==='#/c/dashboard',await hash());
// 2. whole card click
await p.evaluate(()=>{ const c=document.querySelector('#main .job-card[data-card-href]'); c.dispatchEvent(new MouseEvent('click',{bubbles:true})); }); await p.waitForTimeout(400);
t('clicking the card body opens the role',/^#\/job\//.test(await hash()),await hash());
// 3. community -> question (card click) -> back, scroll kept
await go('#/community');
await p.evaluate(()=>scrollTo(0,700)); await p.waitForTimeout(250);
const y0=await p.evaluate(()=>scrollY);
await p.evaluate(()=>{ const cards=[...document.querySelectorAll('#main .q-card[data-card-href]')]; const c=cards.find(x=>x.getBoundingClientRect().top>60)||cards[0]; (c.querySelector('.q-head')||c).dispatchEvent(new MouseEvent('click',{bubbles:true})); });
await p.waitForTimeout(400);
t('question opened from the card',/^#\/community\/(q|a)\//.test(await hash()),await hash());
t('crumb says Back to Community',(await crumb())==='← Back to Community',await crumb());
await back(); await p.waitForTimeout(200);
const y1=await p.evaluate(()=>scrollY);
t('back to Community at the same scroll position',(await hash())==='#/community'&&Math.abs(y1-y0)<40,{y0,y1});
// 4. community -> author profile -> back to the question
const qid=await p.evaluate(()=>{ const q=Object.values(APP.db.questions).find(q=>!q.anonymous&&q.authorId&&APP.consultant(q.authorId)&&q.authorId!==APP.db.session.consultantId); return q&&q.id; });
await go('#/community/q/'+qid);
const qa=p.locator('#main a.q-who-link[href^="#/talent/"]').first();
if(await qa.count()){ await qa.click(); await p.waitForTimeout(400);
  t('author profile opened',/^#\/talent\//.test(await hash()));
  t('crumb names the question',/^← Back to /.test(await crumb())&&!/Home/.test(await crumb()),await crumb());
  await back(); t('back to the question',(await hash())==='#/community/q/'+qid,await hash());
  await back(); t('then back to Community',(await hash())==='#/community',await hash()); }
else t('author link on question',false);
// 5. People -> profile -> back to People
await go('#/community/people');
await p.evaluate(()=>{ document.querySelector('#main .person-card .pc-skills').dispatchEvent(new MouseEvent('click',{bubbles:true})); }); await p.waitForTimeout(400);
t('person card opens the profile',/^#\/talent\//.test(await hash()),await hash());
t('crumb says Back to People',(await crumb())==='← Back to People',await crumb());
await back(); t('back to People',(await hash())==='#/community/people');
// 6. role -> company -> back to the role (named)
const jwc=await p.evaluate(()=>{ const j=Object.values(APP.db.jobs).find(j=>j.status==='open'&&!j.confidential&&!j.external); return j.id; });
await go('#/job/'+jwc);
const cl=p.locator('#main a.jd-co, #main a.co-link').first();
if(await cl.count()){ await cl.click(); await p.waitForTimeout(400);
  t('company page opened',/^#\/company\//.test(await hash()),await hash());
  const jtitle=await p.evaluate(id=>APP.job(id).title,jwc);
  t('crumb names the role',(await crumb()).indexOf(jtitle.slice(0,20))!==-1,await crumb());
  await back(); t('back to the role',(await hash())==='#/job/'+jwc); }
else t('company link on role page',false);
// 7. opened directly (fresh tab): natural parent
const p2=await ctx.newPage(); await p2.goto(BASE+'#/talent/'+ids.me.replace(/./,'')); await p2.waitForTimeout(100);
const other=await p.evaluate(()=>Object.keys(APP.db.consultants)[3]);
await p2.goto(BASE+'#/talent/'+other); await p2.reload(); await p2.waitForTimeout(600);
const c2=await p2.evaluate(()=>{const e=document.querySelector('#main .crumb a'); return e?e.textContent+'|'+e.getAttribute('href'):'';});
t('direct link: crumb goes to People',c2==='← People|#/community/people',c2);
await p2.close();
// 8. company: talent search -> profile -> back to Talent search
await p.evaluate(()=>{ const co=Object.values(APP.db.companies)[0]; APP.db.session={role:'employer',companyId:co.id}; APP.save(); });
await go('#/e/talent');
const tl=p.locator('#main a.person-link').first();
if(await tl.count()){ await tl.click(); await p.waitForTimeout(400);
  t('talent profile opened',/^#\/e\/talent\//.test(await hash()));
  t('crumb says Back to Talent search',(await crumb())==='← Back to Talent search',await crumb());
  await back(); t('back to Talent search',(await hash())==='#/e/talent'); }
else t('talent link',false);
// 9. browser Back button
await go('#/community'); await go('#/community/people');
await p.goBack(); await p.waitForTimeout(400);
t('browser Back works',(await hash())==='#/community',await hash());
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
