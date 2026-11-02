/* Release 39 in the browser: the admin writes as "Arnour team", people read and reply, the admin reads the replies */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/022_staff_messages.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',co:'cccccccc-0000-0000-0000-000000000003'};
const role={adm:'consultant',pro:'consultant',co:'employer'};
for(const k of Object.keys(U)){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
const proId=await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello there, I am a finance consultant with a lot of experience.',skills:[]});
const coId=await claim('co',{name:'Gulf Retail',companyType:'customer',country:'ae',city:'Dubai',industry:'Retail',size:'51-200',about:'We sell things and run SAP.'});
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(who+': '+m.text()); });
  p.on('pageerror',e=>{ errors.push(who+' PAGEERR: '+e.message); console.log('PAGEERR',who,e.message); });
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(500); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

/* 1. the admin presses Message on a professional's page: a dialog, not the sign-in page */
let A=await page('adm');
t('the admin is an admin and has no marketplace profile',await A.evaluate(()=>APP.backend.isAdmin===true&&!APP.db.session));
await go(A,'#/talent/'+proId); await A.waitForSelector('[data-action=adm-message]',{timeout:10000});
await A.locator('[data-action=adm-message]').first().click(); await A.waitForSelector('#dlg-root',{timeout:5000});
t('a dialog opens, not the sign-in page',await A.evaluate(()=>/as Arnour team/.test(document.querySelector('#dlg-title').textContent)&&location.hash.indexOf('#/login')!==0),await A.evaluate(()=>location.hash));
t('the dialog names the recipient and says the admin stays hidden',await A.evaluate(()=>/Pia Pro/.test(document.querySelector('#dlg-title').textContent)&&/not your name/.test(document.querySelector('.dlg-sub').textContent)));
await A.click('#dlg-ok'); await A.waitForTimeout(300);
t('an empty message is not sent',(await sql(`select count(*)::int n from conversations where staff`))[0].n===0&&await A.locator('#dlg-root').count()===0||(await sql(`select count(*)::int n from conversations where staff`))[0].n===0);
await go(A,'#/talent/'+proId); await A.waitForSelector('[data-action=adm-message]'); await A.locator('[data-action=adm-message]').first().click(); await A.waitForSelector('#dlg-note');
await A.fill('#dlg-note','Hi Pia, welcome to Arnour!'); await A.click('#dlg-ok'); await A.waitForTimeout(800);
const rows=await sql(`select v.id,v.c_id,v.staff,m.side,m.text from conversations v join messages m on m.conv_id=v.id where v.staff`);
t('the message is stored as a team conversation for that professional',rows.length===1&&rows[0].c_id===proId&&rows[0].side==='e'&&rows[0].text==='Hi Pia, welcome to Arnour!',rows);
const cv=rows[0]&&rows[0].id;

/* 2. the professional reads it and replies */
const P=await page('pro');
await go(P,'#/c/messages'); await P.waitForSelector('.conv-item',{timeout:10000});
t('the inbox shows "Arnour team" with a new-message badge',await P.evaluate(()=>{ const i=document.querySelector('.conv-item'); return /Arnour team/.test(i.textContent)&&!!i.querySelector('.ci-badge')&&!!i.querySelector('.avatar.team'); }));
t('the unread counter in the menu counts it',await P.evaluate(()=>APP.unreadMsgs()===1));
await P.click('.conv-item'); await P.waitForSelector('.chat-head',{timeout:5000}); await P.waitForTimeout(300);
t('the chat shows the team as the other side and the text',await P.evaluate(()=>/Arnour team/.test(document.querySelector('.chat-head').textContent)&&/welcome to Arnour/.test(document.querySelector('#chat-scroll').textContent)));
t('the chat has no Block, Report, share-identity or CV buttons',await P.evaluate(()=>!document.querySelector('[data-action=conv-block]')&&!document.querySelector('.report-btn')&&!document.querySelector('.chat-share')&&!document.querySelector('.chat-actions .chip')&&!document.querySelector('[data-action=send-cv]')));
t('a note says these are official messages',await P.evaluate(()=>/Official messages from the Arnour team/.test(document.querySelector('.chat').textContent)));
t('the name is not a link to a profile',await P.evaluate(()=>!document.querySelector('.chat-who-link')));
t('opening it clears the unread count',await P.evaluate(()=>APP.unreadMsgs()===0));
await P.fill('textarea.chat-ta','Thank you! Happy to be here.'); await P.press('textarea.chat-ta','Enter'); await P.waitForTimeout(1500);
const rep=await sql(`select side,text from messages where conv_id=$1 and side='c'`,[cv]);
t('the reply reaches the database on the professional side',rep.length===1&&rep[0].text==='Thank you! Happy to be here.',rep);

/* 3. a message to a company */
await go(A,'#/company/'+coId); await A.waitForSelector('[data-action=adm-message]',{timeout:10000});
await A.locator('[data-action=adm-message]').first().click(); await A.waitForSelector('#dlg-note'); await A.fill('#dlg-note','Hello Gulf Retail'); await A.click('#dlg-ok'); await A.waitForTimeout(800);
const crow=await sql(`select v.id,v.e_id,v.c_id,m.side from conversations v join messages m on m.conv_id=v.id where v.staff and v.e_id=$1`,[coId]);
t('a company can be messaged too, team on the c side',crow.length===1&&crow[0].c_id===null&&crow[0].side==='c',crow);
const C=await page('co');
await go(C,'#/e/messages'); await C.waitForSelector('.conv-item',{timeout:10000});
t('the company sees "Arnour team" in its inbox',await C.evaluate(()=>/Arnour team/.test(document.querySelector('.conv-item').textContent)));
await C.click('.conv-item'); await C.waitForSelector('.chat-head'); await C.waitForTimeout(300);
t('the company chat has no invite, CV request, block or report buttons',await C.evaluate(()=>!document.querySelector('.chat-actions .chip')&&!document.querySelector('[data-action=conv-block]')&&!document.querySelector('.report-btn')&&/Hello Gulf Retail/.test(document.querySelector('#chat-scroll').textContent)));
await C.fill('textarea.chat-ta','Received, thanks'); await C.press('textarea.chat-ta','Enter'); await C.waitForTimeout(1500);
t('the company reply is stored',(await sql(`select count(*)::int n from messages where conv_id=$1 and side='e'`,[crow[0].id]))[0].n===1);

/* 4. the admin reads the replies */
A=await page('adm');
await go(A,'#/admin'); await A.waitForSelector('.adm-main h1');
t('the sidebar has Messages with the number of conversations waiting',await A.evaluate(()=>{ const a=[...document.querySelectorAll('a.adm-tab')].find(x=>/^Messages/.test(x.textContent.trim())); return !!a&&/2/.test(a.textContent); }),await A.evaluate(()=>[...document.querySelectorAll('a.adm-tab')].map(x=>x.textContent.trim()).join('|')));
t('there are still five groups in the sidebar',await A.locator('.adm-group').count()===5);
await A.click('a.adm-tab:has-text("Messages")'); await A.waitForFunction(()=>document.querySelectorAll('.adm-msg-row').length>0,null,{timeout:10000});
t('both conversations are listed, with the unread ones marked',await A.evaluate(()=>document.querySelectorAll('.adm-msg-row').length===2&&document.querySelectorAll('.adm-msg-row.unread').length===2));
t('the list shows the person and what they wrote',await A.evaluate(()=>/Pia Pro/.test(document.querySelector('.adm-main').textContent)&&/Gulf Retail/.test(document.querySelector('.adm-main').textContent)&&/Thank you! Happy to be here\./.test(document.querySelector('.adm-main').textContent)));
await A.click('.adm-msg-row:has-text("Pia Pro") [data-action=adm-msg-open]'); await A.waitForSelector('#adm-thread .adm-bub',{timeout:10000});
t('the thread shows both sides in order',await A.evaluate(()=>{ const b=[...document.querySelectorAll('.adm-bub')]; return b.length===2&&b[0].classList.contains('me')&&b[1].classList.contains('them')&&/Happy to be here/.test(b[1].textContent); }));
await A.fill('form[data-form=adm-msg-send] textarea','Great, speak soon.'); await A.click('form[data-form=adm-msg-send] button[type=submit]'); await A.waitForTimeout(1200);
t('the reply is added to the thread',await A.evaluate(()=>document.querySelectorAll('.adm-bub').length===3&&/speak soon/.test(document.querySelector('#adm-thread').textContent)));
t('the reply is in the database as the team side',(await sql(`select count(*)::int n from messages where conv_id=$1 and side='e'`,[cv]))[0].n===2);
await A.click('[data-action=adm-msg-back]'); await A.waitForSelector('.adm-msg-row');
t('after reading, only the company conversation is still marked unread',await A.evaluate(()=>document.querySelectorAll('.adm-msg-row.unread').length===1));

/* 5. the professional sees the new reply */
await P.evaluate(()=>APP.backend.poll(true)); await P.waitForTimeout(1200);
t('the professional gets the team reply without reloading',await P.evaluate(()=>{ const cv=Object.values(APP.db.conversations).find(c=>c.staff); return !!cv&&cv.messages.some(m=>/speak soon/.test(m.text)); }));

/* 6. a normal person cannot reach the team functions from the page */
const denied=await P.evaluate(()=>APP.backend.rpc('admin_staff_send',{p_target:'x',p_text:'hi'}).then(()=>'allowed',()=>'denied'));
t('a professional cannot use the team functions',denied==='denied');
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
