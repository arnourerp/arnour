import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async h=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const main=()=>p.evaluate(()=>document.getElementById('main').innerText);
const ids=await p.evaluate(()=>{ const cs=Object.values(APP.db.consultants).filter(x=>(x.skills||[]).length); const me=cs[0], o=cs[1];
  Object.assign(o,{anon:true,firstName:'Zelda',lastName:'Quinn',city:'Sharjah',summary:'SECRET SUMMARY',linkedin:'linkedin.com/in/zq',availability:'Available now',gender:'female',cv:{name:'zq.pdf',size:'1 MB'}});
  Object.keys(APP.db.conversations).forEach(k=>{ const v=APP.db.conversations[k]; if(v.c2Id&&(v.cId===o.id||v.c2Id===o.id)) delete APP.db.conversations[k]; });
  APP.db.session={role:'consultant',consultantId:me.id}; APP.save();
  return {me:me.id,o:o.id,mod:APP.skillName(o.skills[0].productId,o.skills[0].moduleId)}; });
await go('#/talent/'+ids.o);
let tx=await main();
t('professional sees the anonymous profile, not an empty card',!/This profile is private/.test(tx)&&/Private profile/.test(tx),tx.slice(0,300));
t('skills shown',tx.includes(ids.mod),ids.mod);
t('no name',!/Zelda|Quinn/.test(tx));
t('no about, city, LinkedIn, availability, CV',!/SECRET SUMMARY|Sharjah|LinkedIn|Available now|zq\.pdf/.test(tx),tx.slice(0,600));
t('Message button',await p.locator('#main [data-action=start-chat][data-cid="'+ids.o+'"]').count()===1);
t('no share links for a private profile',await p.locator('#main .share-row, #main [data-action=share]').count()===0);
// shared identity in a chat -> full profile
await p.evaluate(ids=>{ const cv=APP.createPeerConversation(ids.me,ids.o); cv.revE=true; APP.save(); },ids);
await go('#/c/dashboard'); await go('#/talent/'+ids.o);
t('after they share their identity: full profile',/Zelda/.test(await main()));
// signed-out visitor
await p.evaluate(o=>{ window.__o=o; APP.logout(); },ids.o); await p.waitForTimeout(300); await go('#/talent/'+ids.o);
tx=await main();
t('visitor still sees the private card',/This profile is private/.test(tx)&&/Sign in to see more/.test(tx)&&!/Zelda/.test(tx));
// company view unchanged
await p.evaluate(()=>{ const co=Object.values(APP.db.companies).find(x=>!APP.revealed(window.__o,x.id)); APP.db.session={role:'employer',companyId:co.id}; APP.render(); }); await p.waitForTimeout(200);
t('company still offered the anonymous company view',await p.locator('a[href="#/e/talent/'+ids.o+'"]').count()===1);
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
