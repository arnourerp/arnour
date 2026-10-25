import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',v:'cccccccc-0000-0000-0000-000000000003'};
const role={adm:'consultant',pro:'consultant'};
for(const k of ['adm','pro']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'ecc',moduleId:'po',projects:4}],specialties:['rise']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

const A=await page('adm'); const P=await page('pro'); const V=await page(null);
t('nobody has a banner yet',await P.evaluate(()=>!document.querySelector('.ann-banner')));
await go(A,'#/admin/announce'); await A.waitForSelector('.adm-main h1');
t('Announcements tab exists',await A.locator('a.adm-tab:has-text("Announcements")').count()===1);

// validation shows before review
await A.fill('form[data-form=adm-ann] [name=title]','New: AI skills'); await A.fill('form[data-form=adm-ann] [name=link]','https://evil.com');
await A.click('form[data-form=adm-ann] button[type=submit]'); await A.waitForTimeout(500);
t('a bad link is caught before the review step',await A.evaluate(()=>/page on Arnour/.test(document.body.textContent))&&await A.locator('form[data-form=adm-ann]').count()===1);

// fill and review
await A.fill('form[data-form=adm-ann] [name=body]','Add AI skills to your profile.'); await A.fill('form[data-form=adm-ann] [name=link]','#/c/profile');
await A.check('form[data-form=adm-ann] [name=ch_email]'); await A.selectOption('form[data-form=adm-ann] [name=who]','pros');
t('preview shows banner, bell and email',await A.evaluate(()=>/Banner/.test(document.body.textContent)&&/Bell notification/.test(document.body.textContent)&&/subject/.test(document.body.textContent)));
t('role type is selectable for professionals',await A.locator('form[data-form=adm-ann] [name=role_type]').isEnabled());
await A.click('form[data-form=adm-ann] button[type=submit]'); await A.waitForTimeout(600);
t('review step shows who is reached',/Ready to send/.test(await A.textContent('.adm-main'))&&/2 people/.test(await A.textContent('.adm-main')),(await A.textContent('.adm-main')).slice(0,400));
t('nothing sent before confirming',(await sql(`select count(*)::int n from announcements`))[0].n===0);
await A.click('[data-action=adm-ann-send]'); await A.waitForTimeout(800);
t('sent: record, bell for both, emails queued',(await sql(`select count(*)::int n from announcements`))[0].n===1&&(await sql(`select count(*)::int n from notifications where type='announcement'`))[0].n===2&&(await sql(`select count(*)::int n from email_queue where kind='announcements'`))[0].n===2);
t('history shows it with the live banner',/Banner live/.test(await A.textContent('.adm-main'))&&/Professionals/.test(await A.textContent('.adm-main')));

// the professional sees the banner after the next refresh, can close it, and it stays closed
await P.evaluate(()=>APP.backend.poll(true)); await P.waitForTimeout(900);
t('banner appears for the professional',await P.evaluate(()=>!!document.querySelector('.ann-banner')&&/New: AI skills/.test(document.querySelector('.ann-banner').textContent)&&document.querySelector('.ann-banner a').getAttribute('href')==='#/c/profile'));
t('bell notification arrived',await P.evaluate(()=>APP.unreadNotifs()>=1&&/AI skills/.test(document.querySelector('.notif-panel')?document.querySelector('.notif-panel').textContent:'AI skills')));
await P.click('[data-action=ann-dismiss]'); await P.waitForTimeout(300);
t('closing hides it',await P.evaluate(()=>!document.querySelector('.ann-banner')));
await P.reload(); await P.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await P.waitForTimeout(600);
t('and it stays closed after a reload',await P.evaluate(()=>!document.querySelector('.ann-banner')));
await V.evaluate(()=>APP.backend.poll(true)); await V.waitForTimeout(500);
t('visitors never see it',await V.evaluate(()=>!document.querySelector('.ann-banner')));

// test send + settings switch
await go(A,'#/admin/announce'); await A.waitForSelector('form[data-form=adm-ann]');
await A.fill('form[data-form=adm-ann] [name=title]','Trial run'); await A.click('[data-action=adm-ann-test]'); await A.waitForTimeout(700);
t('test goes to the admin only',(await sql(`select count(*)::int n from notifications where type='announcement' and text like '[Test]%'`))[0].n===1&&(await sql(`select count(*)::int n from announcements`))[0].n===1);
await go(P,'#/account'); await P.waitForTimeout(800);
t('account page has the announcements switch',await P.locator('input[name=ep_announcements]').count()===1);

// withdraw
await go(A,'#/admin/announce'); await A.waitForSelector('[data-action=adm-ann-withdraw]');
await A.click('[data-action=adm-ann-withdraw]'); await A.click('[data-action=adm-ann-withdraw][data-yes="1"]'); await A.waitForTimeout(700);
t('withdraw ends the banner and cancels waiting emails',(await sql(`select withdrawn from announcements`))[0].withdrawn===true&&(await sql(`select count(*)::int n from email_queue where kind='announcements' and sent_ts is null`))[0].n===0);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
