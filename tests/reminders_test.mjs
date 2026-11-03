/* Release 42: reminder e-mails for people who did not finish their profile (list for approval, send after approval) */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(ROOT+'/supabase/025_profile_reminders.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/025_profile_reminders.sql','utf8')); // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const q=async(s,a)=>(await db.query(s,a||[])).rows;
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const ids={boss:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000001',co:'bbbbbbbb-0000-0000-0000-000000000002',anyu:'bbbbbbbb-0000-0000-0000-000000000003',fresh:'bbbbbbbb-0000-0000-0000-000000000004',unconf:'bbbbbbbb-0000-0000-0000-000000000005',done:'bbbbbbbb-0000-0000-0000-000000000006',old:'bbbbbbbb-0000-0000-0000-000000000007',optout:'bbbbbbbb-0000-0000-0000-000000000008'};
await db.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz; alter table auth.users add column if not exists raw_user_meta_data jsonb;`);
const mk=async(k,hoursAgo,meta,confirmed=true)=>db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ($1,$2, ${confirmed?`now() - ($3 || ' hours')::interval`:'null'}, $4::jsonb)`,confirmed?[ids[k],k+'@x.com',String(hoursAgo),JSON.stringify(meta||{})]:[ids[k],k+'@x.com',null,JSON.stringify(meta||{})]).catch(async e=>{ await db.query(`insert into auth.users(id,email) values ($1,$2)`,[ids[k],k+'@x.com']); await db.query(`update auth.users set email_confirmed_at=${confirmed?`now() - ('${hoursAgo} hours')::interval`:'null'}, raw_user_meta_data=$2::jsonb where id=$1`,[ids[k],JSON.stringify(meta||{})]); });
await mk('boss',5,{}); await db.query(`insert into admin_emails(email) values ('boss@x.com')`);
await mk('pro',3,{role:'consultant',ft:{b:'facebook'}}); await mk('co',3,{role:'employer'}); await mk('anyu',3,{});
await mk('fresh',1,{role:'consultant'}); await mk('unconf',5,{role:'consultant'},false);
await mk('done',3,{role:'consultant'}); await mk('old',24*5,{role:'consultant'}); await mk('optout',3,{role:'consultant'});
await as(ids.done,`select claim_profile('consultant','{"firstName":"Dina","lastName":"Done"}'::jsonb)`);
await db.query(`select _email_prefs($1)`,[ids.optout]); await db.query(`update email_prefs set matches='off',applicants='off',invites=false,messages=false,community=false where user_id=$1`,[ids.optout]);

/* only the admin */
for(const [n,sql] of [['list',`select admin_reminders()`],['count',`select admin_reminders_count()`],['decide',`select admin_reminder_decide('{1}'::bigint[],'approve')`],['text',`select admin_reminder_text_save('any1','a','b')`]]){
  t('a professional cannot call '+n,!!(await as(ids.done,sql)).err); t('a visitor cannot call '+n,!!(await as(null,sql)).err);
}
t('the reminder tables are closed to direct reads',!!(await as(ids.done,`select * from reminders`)).err&&!!(await as(ids.done,`select * from reminder_texts`)).err);
t('the sender and the scan are closed',!!(await as(ids.done,`select reminders_run()`)).err&&!!(await as(ids.done,`select reminders_scan()`)).err);

/* the scan */
t('the scan finds 3 people',(await q(`select reminders_scan() n`))[0].n===3);
const L=(await as(ids.boss,`select admin_reminders() x`)).rows[0].x;
const em=L.pending.map(p=>p.email).sort().join();
t('waiting: confirmed 2+ hours ago, no profile, not admin, not unsubscribed, not too old',em==='anyu@x.com,co@x.com,pro@x.com',em);
t('each shows its type and source',L.pending.find(p=>p.email==='pro@x.com').role==='consultant'&&L.pending.find(p=>p.email==='pro@x.com').src==='facebook'&&L.pending.find(p=>p.email==='co@x.com').role==='employer'&&L.pending.find(p=>p.email==='anyu@x.com').role==='any'&&L.pending.every(p=>p.step===1),L.pending);
t('the badge count is 3',(await as(ids.boss,`select admin_reminders_count() x`)).rows[0].x===3);
t('a second scan adds nobody',(await q(`select reminders_scan() n`))[0].n===0);
t('six texts can be edited',L.texts.length===6&&L.ready===false);

/* nothing is sent before approval, and not without the Resend key */
await db.exec(`create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
 create schema net; create table net.calls(id bigserial, url text, body jsonb, headers jsonb);
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;
 create table net._http_response(id bigint primary key, status_code int, content text, error_msg text);`);
t('without the key nothing is sent',(await q(`select reminders_run() n`))[0].n===0);
await db.exec(`insert into vault.decrypted_secrets values ('resend_api_key','re_test')`);
t('with the key but no approval nothing is sent',(await q(`select reminders_run() n`))[0].n===0&&(await q(`select count(*)::int n from net.calls`))[0].n===0);

/* approve one, skip one */
const idOf=e=>L.pending.find(p=>p.email===e).id;
t('approve sends at once',(await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve') x`,[`{${idOf('pro@x.com')}}`])).rows[0].x===1);
let calls=await q(`select * from net.calls`);
t('one e-mail went to Resend, from the Arnour sender, with an unsubscribe link and a link to the profile steps',calls.length===1&&calls[0].body.to[0]==='pro@x.com'&&calls[0].body.from==='Arnour <notifications@arnour.com>'&&/#\/unsubscribe/.test(calls[0].body.headers['List-Unsubscribe'])&&/#\/onboard"/.test(calls[0].body.html)&&/almost ready/.test(calls[0].body.subject),calls[0]);
t('a professional gets the professional text, a company the company text',(await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve') x`,[`{${idOf('co@x.com')}}`])).rows[0].x===1&&/company/i.test((await q(`select body from net.calls order by id desc limit 1`))[0].body.subject)&&/#\/onboard-e"/.test((await q(`select body from net.calls order by id desc limit 1`))[0].body.html));
t('skip removes it without sending',(await as(ids.boss,`select admin_reminder_decide($1::bigint[],'skip') x`,[`{${idOf('anyu@x.com')}}`])).rows[0].x===1&&(await q(`select count(*)::int n from net.calls`))[0].n===2);
t('an already decided one cannot be approved again',(await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve') x`,[`{${idOf('pro@x.com')}}`])).rows[0].x===0&&(await q(`select count(*)::int n from net.calls`))[0].n===2);
t('bad action refused',!!(await as(ids.boss,`select admin_reminder_decide('{1}'::bigint[],'delete')`)).err&&!!(await as(ids.boss,`select admin_reminder_decide('{}'::bigint[],'approve')`)).err);

/* Resend refuses: tried again, then given up */
const reqOf=async(u)=>+(await q(`select request r from reminders where user_id=$1 and step=1`,[u]))[0].r;
await db.query(`insert into net._http_response values ($1,403,'domain not verified',null)`,[await reqOf(ids.pro)]);
t('a refused reminder is sent again',(await q(`select reminders_run() n`))[0].n===1&&(await q(`select tries from reminders where user_id=$1`,[ids.pro]))[0].tries===1);
await db.query(`insert into net._http_response values ($1,200,'{}',null)`,[await reqOf(ids.pro)]);
t('an accepted one is not sent again',(await q(`select reminders_run() n`))[0].n===0&&(await q(`select status from reminders where user_id=$1`,[ids.pro]))[0].status==='sent');

/* the person finishes the profile or unsubscribes before approval */
await q(`update auth.users set email_confirmed_at = now() - interval '3 hours' where id=$1`,[ids.fresh]);
await q(`select reminders_scan()`);
const fr=(await q(`select id from reminders where user_id=$1`,[ids.fresh]))[0].id;
await as(ids.fresh,`select claim_profile('consultant','{"firstName":"Fred","lastName":"Fresh"}'::jsonb)`);
await q(`select reminders_scan()`);
t('finishing the profile cancels a waiting reminder',(await q(`select status from reminders where id=$1`,[fr]))[0].status==='done');
await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve')`,[`{${fr}}`]);
t('and nothing is sent for them',(await q(`select count(*)::int n from net.calls where body->'to'->>0='fresh@x.com'`))[0].n===0);

/* second reminder about 3 days after the first */
t('no second reminder yet',(await q(`select count(*)::int n from reminders where step=2`))[0].n===0);
await q(`update reminders set sent_ts = sent_ts - 4*86400000 where user_id=$1 and step=1`,[ids.pro]);
await q(`select reminders_scan()`);
t('a second reminder is queued for approval',(await q(`select status,step from reminders where user_id=$1 and step=2`,[ids.pro])).length===1&&(await q(`select status from reminders where user_id=$1 and step=2`,[ids.pro]))[0].status==='pending');
const s2=(await q(`select id from reminders where user_id=$1 and step=2`,[ids.pro]))[0].id;
await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve')`,[`{${s2}}`]);
const last=(await q(`select body from net.calls order by id desc limit 1`))[0].body;
t('the second one has its own text and says it is the last',/Still want|still waiting/i.test(last.subject)&&/last email/.test(last.html),last.subject);
await q(`update reminders set sent_ts = sent_ts - 9*86400000 where user_id=$1`,[ids.pro]);
await q(`select reminders_scan()`);
t('never a third',(await q(`select count(*)::int n from reminders where user_id=$1`,[ids.pro]))[0].n===2);

/* a person who unsubscribes after being queued gets nothing; unapproved items expire */
await q(`update auth.users set email_confirmed_at = now() - interval '3 hours' where id=$1`,[ids.unconf]);
await q(`select reminders_scan()`);
const un=(await q(`select id from reminders where user_id=$1`,[ids.unconf]))[0].id;
await q(`select _email_prefs($1)`,[ids.unconf]); await q(`update email_prefs set matches='off',applicants='off',invites=false,messages=false,community=false where user_id=$1`,[ids.unconf]);
await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve')`,[`{${un}}`]);
t('unsubscribed after queueing: skipped, nothing sent',(await q(`select status from reminders where id=$1`,[un]))[0].status==='skipped'&&(await q(`select count(*)::int n from net.calls where body->'to'->>0='unconf@x.com'`))[0].n===0);
await q(`update auth.users set email_confirmed_at = now() - interval '3 hours' where id=$1`,[ids.old]);
await q(`select reminders_scan()`);
await q(`update reminders set created_ts = created_ts - 4*86400000 where user_id=$1`,[ids.old]);
await q(`select reminders_scan()`);
t('a waiting item nobody approved in 3 days expires',(await q(`select status from reminders where user_id=$1`,[ids.old]))[0].status==='expired');

/* editing the wording */
t('the admin can edit a text',!(await as(ids.boss,`select admin_reminder_text_save('any1','New subject','New body')`)).err&&(await q(`select subject from reminder_texts where key='any1'`))[0].subject==='New subject');
t('empty or unknown texts are refused',!!(await as(ids.boss,`select admin_reminder_text_save('any1','','x')`)).err&&!!(await as(ids.boss,`select admin_reminder_text_save('nope','a','b')`)).err);
await as(ids.boss,`select admin_reminder_text_save('consultant2','Hi','Line <script>alert(1)</script>')`);
await q(`insert into reminders(user_id,step,role,status) values ($1,2,'consultant','approved')`,[ids.old]);
await q(`select reminders_run()`);
const esc=(await q(`select body from net.calls order by id desc limit 1`))[0].body;
t('text typed by the admin is escaped in the e-mail',!/<script>/.test(esc.html)&&/&lt;script&gt;/.test(esc.html),esc.html);
t('the history lists what happened',(await as(ids.boss,`select admin_reminders() x`)).rows[0].x.recent.length>=5);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
