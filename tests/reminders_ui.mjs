/* Release 42 in the browser: Reminders tab (waiting list, Send / Skip / Send all, wording, history, badge) */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/025_profile_reminders.sql','utf8'));
await be.db.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz; alter table auth.users add column if not exists raw_user_meta_data jsonb;`);
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001'};
be.users['adm@t.com']={id:U.adm,email:'adm@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'tadm'};
await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U.adm,'adm@t.com']);
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
const people=[['n1','consultant','facebook'],['n2','employer','direct'],['n3','consultant','linkedin'],['n4',null,'direct']];
for(const [k,role,b] of people){ await be.db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values (gen_random_uuid(),$1, now() - interval '3 hours', $2::jsonb)`,[k+'@x.com',JSON.stringify({...(role?{role}:{}),ft:{b}})]); }
await be.db.query(`select reminders_scan()`);
async function page(){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U.adm,'adm@t.com']);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(700); };
const A=await page();
await go(A,'#/admin/overview'); await A.waitForSelector('.adm-tabs');
t('the sidebar has Reminders with the number waiting',await A.evaluate(()=>{ const a=[...document.querySelectorAll('.adm-tab')].find(x=>/Reminders/.test(x.textContent)); return !!a&&/4/.test(a.textContent); }));
await go(A,'#/admin/reminders'); await A.waitForSelector('.adm-table',{timeout:10000});
t('four people are waiting, with type and source',await A.evaluate(()=>{ const rows=[...document.querySelectorAll('.adm-table')[0].querySelectorAll('tbody tr')].map(r=>r.textContent); return rows.length===4&&rows.some(r=>/n1@x.com.*Professional.*facebook/.test(r))&&rows.some(r=>/n2@x.com.*Company/.test(r))&&rows.some(r=>/Not chosen yet/.test(r)); }));
t('a warning says sending is not set up (no Resend key yet)',await A.evaluate(()=>/not set up/.test(document.querySelector('.adm-main').textContent)));
t('six wording boxes can be edited',await A.evaluate(()=>document.querySelectorAll('form[data-form=adm-rem-text]').length===6));

/* with a key and a pretend Resend */
await be.db.exec(`create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text); insert into vault.decrypted_secrets values ('resend_api_key','re_test');
 create schema net; create table net.calls(id bigserial, url text, body jsonb, headers jsonb);
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;
 create table net._http_response(id bigint primary key, status_code int, content text, error_msg text);`);
const calls=async()=>(await be.db.query(`select body->'to'->>0 as e from net.calls`)).rows.map(r=>r.e);

await A.locator('tr:has-text("n1@x.com") [data-action=adm-rem-send]').click(); await A.waitForTimeout(1000);
t('Send sends that one reminder',JSON.stringify(await calls())===JSON.stringify(['n1@x.com']),await calls());
t('it left the waiting list and the number dropped',await A.evaluate(()=>!/n1@x.com/.test(document.querySelectorAll('.adm-table')[0].textContent)));
await A.locator('tr:has-text("n3@x.com") [data-action=adm-rem-skip]').click(); await A.waitForTimeout(900);
t('Skip sends nothing',(await calls()).length===1);

await A.click('[data-action=adm-rem-all]'); await A.waitForSelector('#dlg-ok',{timeout:5000});
t('Send all asks first',await A.evaluate(()=>/Send 2 reminders/.test(document.querySelector('#dlg-title').textContent)));
await A.click('#dlg-ok'); await A.waitForTimeout(1200);
t('after confirming, the other two are sent',(await calls()).sort().join()==='n1@x.com,n2@x.com,n4@x.com',await calls());
t('nobody is waiting any more',await A.evaluate(()=>/Nobody is waiting/.test(document.querySelector('.adm-main').textContent)));
t('the history shows sent and skipped',await A.evaluate(()=>{ const m=document.querySelector('.adm-main').textContent; return /Sent/.test(m)&&/Skipped/.test(m)&&/n3@x.com/.test(m); }));

/* editing the wording */
await A.fill('form[data-key=any1] [name=subject]','Please finish your Arnour account'); await A.fill('form[data-key=any1] [name=body]','Edited body'); await A.click('form[data-key=any1] button[type=submit]'); await A.waitForTimeout(900);
t('saved wording is stored',(await be.db.query(`select subject,body from reminder_texts where key='any1'`)).rows[0].subject==='Please finish your Arnour account');
t('an empty text is not saved',await(async()=>{ await A.fill('form[data-key=any2] [name=body]',''); await A.click('form[data-key=any2] button[type=submit]'); await A.waitForTimeout(500); return (await be.db.query(`select body from reminder_texts where key='any2'`)).rows[0].body.length>0; })());
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
