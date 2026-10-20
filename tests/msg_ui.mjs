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
// ---- professional -> another professional (peer)
const ids=await p.evaluate(()=>{ const cs=Object.values(APP.db.consultants); const a=cs[0], o=cs.find(x=>x.id!==a.id&&x.anon)||cs[1]; o.anon=true; a.anon=true;
  Object.keys(APP.db.conversations).forEach(k=>{ const v=APP.db.conversations[k]; if(v.cId===a.id||v.c2Id===a.id) delete APP.db.conversations[k]; });
  APP.db.session={role:'consultant',consultantId:a.id}; return {a:a.id,o:o.id,on:o.firstName+' '+o.lastName}; });
await go('#/talent/'+ids.o);
t('Message button on another professional profile',await p.locator('#main [data-action=start-chat][data-cid="'+ids.o+'"]').count()>0);
await p.locator('#main [data-action=start-chat][data-cid="'+ids.o+'"]').first().click(); await p.waitForTimeout(400);
const h1=await p.evaluate(()=>location.hash);
t('opens a chat',/^#\/c\/messages\/cv/.test(h1),h1);
const cvId=h1.split('/').pop();
t('peer conversation created',await p.evaluate(id=>{const v=APP.db.conversations[id]; return !!v&&!!v.c2Id;},cvId));
t('draft prefilled',(await p.inputValue('form[data-form=chat] textarea, form[data-form=chat] input[name=q]').catch(()=>''))!=='');
let tx=await main();
t('other professional stays anonymous',!tx.includes(ids.on),tx.slice(0,300));
t('Share my identity button',await p.locator('[data-action=share-identity]').count()===1);
t('Block button',await p.locator('[data-action=conv-block][data-on="1"]').count()===1);
t('no CV attach in peer chat',await p.locator('#main [data-action=attach-cv], #main .chat-cv').count()===0);
// send twice, then waiting
await p.evaluate(id=>{ APP.pushMessage(id,'c','one'); APP.pushMessage(id,'c','two'); APP.render(); },cvId); await p.waitForTimeout(200);
t('waiting banner after 2 messages',/once they reply/.test(await main()));
t('message box hidden while waiting',await p.locator('form[data-form=chat]').count()===0);
await p.evaluate(id=>{ APP.pushMessage(id,'e','reply'); APP.render(); },cvId); await p.waitForTimeout(200);
t('can write after reply',await p.locator('form[data-form=chat]').count()===1);
// block via dialog
await p.click('[data-action=conv-block][data-on="1"]'); await p.waitForTimeout(200);
const dlg=p.locator('#dlg-ok');
if(await dlg.count()){ await dlg.click(); await p.waitForTimeout(300); }
t('blocked: closed banner + Unblock',/You blocked/.test(await main())&&await p.locator('[data-action=conv-block][data-on="0"]').count()===1);
// share identity via dialog
await p.click('[data-action=share-identity]'); await p.waitForTimeout(200);
const d2=p.locator('#dlg-ok'); if(await d2.count()){ await d2.click(); await p.waitForTimeout(300); }
t('share sets the flag',await p.evaluate(id=>{const v=APP.db.conversations[id]; return APP.convSide(v)==='c'?v.revC===true:v.revE===true;},cvId));
// ---- professional -> company
const co=await p.evaluate(()=>{ const c=Object.values(APP.db.companies)[0]; return c.id; });
await go('#/company/'+co);
t('Message button on company page',await p.locator('#main [data-action=start-chat][data-eid="'+co+'"]').count()>0);
// ---- confidential job -> message button
const jc=await p.evaluate(()=>{ const j=Object.values(APP.db.jobs).find(x=>x.status==='open'); j.confidential=true; return j.id; });
await go('#/job/'+jc);
t('Message on confidential role',await p.locator('#main [data-action=start-chat][data-jid="'+jc+'"]').count()>0);
// ---- company -> private professional without intro
const e1=await p.evaluate(o=>{ const co=Object.values(APP.db.companies)[0]; Object.keys(APP.db.conversations).forEach(k=>{ const v=APP.db.conversations[k]; if(v.cId===o&&v.eId===co.id) delete APP.db.conversations[k]; });
  Object.keys(APP.intros()).forEach(k=>{ const i=APP.intros()[k]; if(i.cid===o&&i.eid===co.id) delete APP.intros()[k]; });
  APP.db.session={role:'employer',companyId:co.id}; return co.id; },ids.o);
await go('#/e/talent/'+ids.o);
const mb=p.locator('#main [data-action=start-chat][data-cid="'+ids.o+'"]');
t('company sees Message without introduction',await mb.count()>0);
await mb.first().click(); await p.waitForTimeout(400);
t('company chat opens',/^#\/e\/messages\/cv/.test(await p.evaluate(()=>location.hash)));
tx=await main(); t('private professional still anonymous for company',!tx.includes(ids.on));
t('public company has nothing to share',await p.locator('[data-action=share-identity]').count()===0);
// ---- community author Message link
await p.evaluate(a=>{APP.db.session={role:'consultant',consultantId:a};},ids.a);
await go('#/community');
const q=await p.evaluate(()=>{ const q=Object.values(APP.db.questions||{})[0]; return q&&q.id; });
if(q){ await go('#/community/q/'+q); t('community page renders',true); t('Message link on community authors (not self)',await p.locator('.q-msg').count()>0); }
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
