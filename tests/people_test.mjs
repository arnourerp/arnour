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
const ids=await p.evaluate(()=>{ const cs=Object.values(APP.db.consultants).filter(x=>(x.skills||[]).length>0); const me=cs[0], pub=cs[1], priv=cs[2];
  pub.anon=false; pub.firstName='Omar'; pub.lastName='Publico';
  Object.assign(priv,{anon:true,firstName:'Hidden',lastName:'Person',headline:'Secret Headline Words',availability:'Available now'});
  priv.skills=[{productId:me.skills[0].productId,moduleId:me.skills[0].moduleId,projects:9}];
  Object.keys(APP.db.conversations).forEach(k=>{ const v=APP.db.conversations[k]; if(v.c2Id) delete APP.db.conversations[k]; });
  APP.db.session={role:'consultant',consultantId:me.id}; APP.state.peopleFilters=null; APP.save();
  return {me:me.id,pub:pub.id,priv:priv.id,mod:APP.skillName(me.skills[0].productId,me.skills[0].moduleId),prod:me.skills[0].productId}; });
await go('#/community');
t('People tab in Community',await p.locator('.comm-tabs a[href="#/community/people"]').count()===1);
await p.click('.comm-tabs a[href="#/community/people"]'); await p.waitForTimeout(300);
let tx=await main();
t('people page lists professionals',await p.locator('.person-card').count()>3);
t('not myself',await p.locator('.person-card [data-cid="'+ids.me+'"]').count()===0);
t('private shown anonymously',!/Hidden Person/.test(tx)&&await p.locator('.person-card [data-cid="'+ids.priv+'"]').count()===1);
t('no availability or match %',!/Available now|% match/.test(tx));
t('shared module first by default',await p.evaluate(()=>!!document.querySelector('.person-card .pc-common')));
// search by name: public found, private not
await p.fill('form[data-form=people-filters] input[name=q]','Publico'); await p.click('form[data-form=people-filters] button[type=submit]'); await p.waitForTimeout(250);
t('public found by name',await p.locator('.person-card').count()===1&&/Omar Publico/.test(await main()));
await p.fill('form[data-form=people-filters] input[name=q]','Hidden'); await p.click('form[data-form=people-filters] button[type=submit]'); await p.waitForTimeout(250);
t('private never found by name',await p.locator('.person-card [data-cid="'+ids.priv+'"]').count()===0);
await p.fill('form[data-form=people-filters] input[name=q]',ids.mod); await p.click('form[data-form=people-filters] button[type=submit]'); await p.waitForTimeout(250);
t('private found by skill',await p.locator('.person-card [data-cid="'+ids.priv+'"]').count()===1);
// filters
await p.click('[data-action=people-reset]'); await p.waitForTimeout(200);
await p.selectOption('form[data-form=people-filters] select[name=product]',ids.prod); await p.waitForTimeout(300);
const n1=await p.locator('.person-card').count();
t('product filter applies on change',n1>0&&await p.evaluate(prod=>APP.state.peopleFilters.product===prod,ids.prod));
await p.selectOption('form[data-form=people-filters] select[name=level]','Senior'); await p.waitForTimeout(300);
t('level filter',await p.evaluate(()=>APP.state.peopleFilters.level==='Senior'));
await p.click('[data-action=people-reset]'); await p.waitForTimeout(200);
await p.selectOption('form[data-form=people-filters] select[name=sort]','active'); await p.waitForTimeout(300);
t('sort by community activity',await p.evaluate(()=>APP.state.peopleFilters.sort==='active'));
// message from a card
await p.click('.person-card [data-action=start-chat][data-cid="'+ids.priv+'"]'); await p.waitForTimeout(300);
t('Message opens a peer chat',/^#\/c\/messages\/cv/.test(await p.evaluate(()=>location.hash)));
// companies and visitors
await p.evaluate(()=>{ const co=Object.values(APP.db.companies)[0]; APP.db.session={role:'employer',companyId:co.id}; }); await go('#/community/people');
t('company pointed to Talent',/Talent/.test(await main())&&await p.locator('.person-card').count()===0);
await go('#/community'); t('no People tab for companies',await p.locator('.comm-tabs').count()===0);
await p.setViewportSize({width:390,height:800}); await p.evaluate(ids=>{APP.db.session={role:'consultant',consultantId:ids.me};},ids); await go('#/community/people');
t('mobile: no horizontal scroll',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
if(process.env.SHOT){ await p.setViewportSize({width:1280,height:900}); await p.evaluate(()=>{APP.render(); scrollTo(0,0);}); await p.screenshot({path:process.env.SHOT}); }
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
