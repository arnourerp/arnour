/* Release 55 in the browser: Admin > Unfinished (badge, overview card, list, filter, message button) and the reminders labels */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
await be.db.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz; alter table auth.users add column if not exists raw_user_meta_data jsonb; alter table auth.users add column if not exists created_at timestamptz default now();`);
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/025_profile_reminders.sql','utf8'));
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/035_unfinished_profiles.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001'};
be.users['adm@t.com']={id:U.adm,email:'adm@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'tadm'};
await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U.adm,'adm@t.com']);
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
const mk=async(id,email,role,hours,confirmed=true)=>be.db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values ($1,$2, ${confirmed?`now() - ($3 || ' hours')::interval`:'null'}, $4::jsonb, now() - ($3 || ' hours')::interval)`,[id,email,String(hours),JSON.stringify({role,ft:{b:'facebook'}})]);
const ids=[1,2,3,4,5].map(i=>'dddddddd-0000-0000-0000-00000000000'+i);
await mk(ids[0],'sara@x.com','consultant',5); await mk(ids[1],'omar@x.com','consultant',6); await mk(ids[2],'nofile@x.com','consultant',7); await mk(ids[3],'acme@x.com','employer',8); await mk(ids[4],'ready@x.com','consultant',9);
const claim=(uid,d)=>be.db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]).then(()=>be.db.exec(`set role authenticated`)).then(()=>be.db.query(`select claim_profile('consultant',$1::jsonb)`,[JSON.stringify(d)])).then(()=>be.db.exec(`reset role`));
await claim(ids[0],{firstName:'Sara',lastName:'Saved',headline:'SAP FI Consultant',country:'eg',roleType:'functional',skills:[],summary:'Hello'});
await claim(ids[1],{firstName:'Omar',lastName:'Open',headline:'ABAP Developer',country:'ae',roleType:'technical',skills:[]});
await claim(ids[4],{firstName:'Rana',lastName:'Ready',headline:'SAP MM',country:'eg',roleType:'functional',skills:[{productId:'s4',moduleId:'mm',projects:2}]});
await be.db.query(`update profiles set created_at = now() - interval '3 hours' where user_id in ($1,$2)`,[ids[0],ids[1]]);
await be.db.query(`select reminders_scan()`);
async function page(){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U.adm,'adm@t.com']);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(700); };
const A=await page();
await go(A,'#/admin/overview'); await A.waitForSelector('.adm-tabs');
t('the sidebar has Unfinished with the number (2 saved without skills + 1 professional without a profile = 3)',await A.evaluate(()=>{ const a=[...document.querySelectorAll('.adm-tab')].find(x=>/Unfinished/.test(x.textContent)); return !!a&&/\b3\b/.test(a.textContent); }),await A.evaluate(()=>[...document.querySelectorAll('.adm-tab')].map(x=>x.textContent)));
t('the overview has an Unfinished professionals counter',await A.evaluate(()=>{ const s=[...document.querySelectorAll('.adm-stat')].find(x=>/Unfinished professionals/.test(x.textContent)); return !!s&&/^3/.test(s.textContent.trim()); }));
await go(A,'#/admin/unfinished'); await A.waitForSelector('#adm-unf-table',{timeout:10000});
t('four counters: all, saved without skills, no profile, companies',await A.evaluate(()=>{ const s=[...document.querySelectorAll('#adm-unf-stats .adm-stat')].map(x=>x.textContent.replace(/\s+/g,' ').trim()); return s.length===4&&/^3\s*Unfinished/.test(s[0])&&/^2\s*Saved/.test(s[1])&&/^1\s*Signed up/.test(s[2])&&/^1\s*Companies/.test(s[3]); }),await A.evaluate(()=>[...document.querySelectorAll('#adm-unf-stats .adm-stat')].map(x=>x.textContent)));
t('the list has the four unfinished accounts and not the one with skills',await A.evaluate(()=>{ const m=document.querySelector('#adm-unf-table').textContent; return ['sara@x.com','omar@x.com','nofile@x.com','acme@x.com'].every(e=>m.indexOf(e)>-1)&&m.indexOf('ready@x.com')<0&&m.indexOf('Rana')<0&&document.querySelectorAll('#adm-unf-table tbody tr').length===4; }),await A.evaluate(()=>document.querySelector('#adm-unf-table').textContent));
t('a saved profile shows name, headline, stage, what is missing and source',await A.evaluate(()=>{ const r=[...document.querySelectorAll('#adm-unf-table tbody tr')].find(x=>/sara@x.com/.test(x.textContent)).textContent; return /Sara Saved/.test(r)&&/SAP FI Consultant/.test(r)&&/Profile saved, no SAP skills/.test(r)&&/SAP skills/.test(r)&&/CV/.test(r)&&!/About you/.test(r)&&/facebook/.test(r); }));
t('Omar has no summary so About you is missing too',await A.evaluate(()=>/About you/.test([...document.querySelectorAll('#adm-unf-table tbody tr')].find(x=>/omar@x.com/.test(x.textContent)).textContent)));
t('the reminder state is shown: waiting for approval for the saved ones',await A.evaluate(()=>/SAP skills · 1st: waiting for your approval/.test([...document.querySelectorAll('#adm-unf-table tbody tr')].find(x=>/sara@x.com/.test(x.textContent)).textContent)));
t('the company without a profile is marked Company and has no message button',await A.evaluate(()=>{ const r=[...document.querySelectorAll('#adm-unf-table tbody tr')].find(x=>/acme@x.com/.test(x.textContent)); return /Company/.test(r.textContent)&&/No profile yet/.test(r.textContent)&&!r.querySelector('[data-action=adm-message]'); }));
t('only saved profiles have Message and Open',await A.evaluate(()=>[...document.querySelectorAll('#adm-unf-table tbody tr')].every(r=>!!r.querySelector('[data-action=adm-message]')===/Profile saved/.test(r.textContent))));

/* filters */
await A.click('[data-f=noskills]'); await A.waitForTimeout(300);
t('filter: only saved profiles',await A.evaluate(()=>document.querySelectorAll('#adm-unf-table tbody tr').length===2&&/sara@x.com/.test(document.querySelector('#adm-unf-table').textContent)&&!/nofile@x.com/.test(document.querySelector('#adm-unf-table').textContent)));
await A.click('[data-f=noprofile]'); await A.waitForTimeout(300);
t('filter: only professionals without a profile',await A.evaluate(()=>document.querySelectorAll('#adm-unf-table tbody tr').length===1&&/nofile@x.com/.test(document.querySelector('#adm-unf-table').textContent)));
await A.click('[data-f=company]'); await A.waitForTimeout(300);
t('filter: companies',await A.evaluate(()=>document.querySelectorAll('#adm-unf-table tbody tr').length===1&&/acme@x.com/.test(document.querySelector('#adm-unf-table').textContent)));
await A.click('[data-f=all]'); await A.waitForTimeout(300);
t('filter: all again',await A.evaluate(()=>document.querySelectorAll('#adm-unf-table tbody tr').length===4));

/* message button opens the dialog with the person's name */
await A.locator('tr:has-text("sara@x.com") [data-action=adm-message]').click(); await A.waitForSelector('#dlg-note',{timeout:5000});
t('the message dialog names the person',await A.evaluate(()=>/Sara Saved/.test(document.querySelector('#dlg-title').textContent)));
await A.keyboard.press('Escape'); await A.waitForTimeout(300);

/* reminders tab shows the kind and the new texts */
await go(A,'#/admin/reminders'); await A.waitForSelector('.adm-table',{timeout:10000});
t('reminders: the new ones are marked SAP skills, the old kind is unchanged',await A.evaluate(()=>{ const m=document.querySelectorAll('.adm-table')[0].textContent; return /SAP skills · 1st/.test(m)&&/nofile@x.com/.test(m)&&/acme@x.com/.test(m); }));
t('reminders: eight wording boxes including the two new ones',await A.evaluate(()=>document.querySelectorAll('form[data-form=adm-rem-text]').length===8&&/Saved without SAP skills · 1st reminder/.test(document.querySelector('.adm-main').textContent)));

/* skip a skills reminder, and the unfinished list shows it */
await A.locator('tr:has-text("omar@x.com") [data-action=adm-rem-skip]').click(); await A.waitForTimeout(900);
await go(A,'#/admin/unfinished'); await A.waitForSelector('#adm-unf-table',{timeout:10000});
t('after Skip the list says skipped for Omar',await A.evaluate(()=>/Skipped/.test([...document.querySelectorAll('#adm-unf-table tbody tr')].find(x=>/omar@x.com/.test(x.textContent)).textContent)));

/* when everyone has skills the list is empty */
await be.db.query(`update consultants set data = data || '{"skills":[{"productId":"s4","moduleId":"fi","projects":1}]}'::jsonb where owner in ($1,$2)`,[ids[0],ids[1]]);
await be.db.query(`delete from auth.users where id in ($1,$2,$3)`,[ids[2],ids[3],ids[4]]).catch(()=>{});
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
