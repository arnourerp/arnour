import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
const R=process.env.ARNOUR_ROOT;
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','003_community','005_admin','006_feedback','007_email','007_email']) await db.exec(fs.readFileSync(R+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333'};
for(const k in U) await db.query(`insert into auth.users values ($1,$2)`,[U[k],k+'@x.com']);
let fails=0;
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const val=(r,f)=>Array.isArray(r)?r[0][f]:null;
const q=async(s,p)=>(await db.query(s,p)).rows;
const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',anon:true})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Two'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp'})]),'x');
const notify=(key,text,link)=>db.query(`insert into notifications(user_key,type,text,link) values ($1,'x',$2,$3)`,[key,text,link]);
const now=Date.now();
await notify(ce,'New role matches your profile: SAP FICO Lead — A confidential company','#/job/j1');
let qq=await q(`select * from email_queue where user_id=$1`,[U.c]);
t('match queued for the daily summary',qq.length===1&&qq[0].kind==='matches'&&+qq[0].send_after>now&&+qq[0].send_after<=now+86400000+60000,qq);
t('summary at 04:00 UTC (08:00 UAE)',new Date(+qq[0].send_after).getUTCHours()===4&&new Date(+qq[0].send_after).getUTCMinutes()===0);
await notify(ce,'A confidential company invited you to apply for "SAP FICO Lead"','#/job/j1');
await notify(ce,'Acme Corp sent you a message','#/c/messages/cv1');
await notify(ce,'Acme Corp sent you a message','#/c/messages/cv1');
await notify(ce,'Your post on "x" is getting upvotes','#/community/q/q1');
await notify(ce,'Welcome to Arnour','');
qq=await q(`select kind, send_after from email_queue where user_id=$1 order by id`,[U.c]);
t('invite queued right away',qq.some(r=>r.kind==='invites'&&+r.send_after<=Date.now()));
t('message waits 15 minutes',qq.filter(r=>r.kind==='messages').length===1&&+qq.find(r=>r.kind==='messages').send_after>=now+14*60000);
t('one email per chat per hour',qq.filter(r=>r.kind==='messages').length===1);
t('upvotes and self-notes are not emailed',qq.length===3,qq);
// build: only the invite is due
let b=(await q(`select email_build_batch() x`))[0].x;
t('one email built',b.length===1&&b[0].to==='c@x.com',b);
t('subject is the notification',b[0].subject==='A confidential company invited you to apply for "SAP FICO Lead"',b[0].subject);
t('email never names the confidential company',!/Acme/.test(b[0].html));
t('email has unsubscribe + settings links',/#\/unsubscribe\?t=[0-9a-f-]{36}&amp;k=invites/.test(b[0].html)&&/#\/account/.test(b[0].html)&&/k=all/.test(b[0].html),b[0].html.slice(-500));
t('not sent twice',(await q(`select email_build_batch() x`))[0].x.length===0);
// message read meanwhile -> dropped
await db.query(`insert into conversations(id,c_id,e_id,last_ts,c_read) values ('cv1',$1,$2,$3,$3)`,[ce,ee,Date.now()+1000]);
await db.query(`update email_queue set send_after=0 where kind='messages'`);
b=(await q(`select email_build_batch() x`))[0].x;
t('read message: no email',b.length===0&&(await q(`select dropped from email_queue where kind='messages'`))[0].dropped===true,b);
// unread message after 15 min -> email
await db.query(`delete from email_queue where kind='messages'`);
await notify(ce,'Acme Corp sent you a message','#/c/messages/cv2');
await db.query(`insert into conversations(id,c_id,c2_id,last_ts,e_read) values ('cv2',$1,$2,$3,0)`,[ce2,ce,Date.now()]);
await db.query(`update email_queue set send_after=0 where kind='messages'`);
b=(await q(`select email_build_batch() x`))[0].x;
t('unread message emailed with Open chat',b.length===1&&/Open chat/.test(b[0].html),b);
// several due items -> one email
await notify(ce,'Acme Corp would like to connect','#/c/intros');
await notify(ce,'Two Person answered your question "How to X"','#/community/q/q1');
b=(await q(`select email_build_batch() x`))[0].x;
t('two updates in one email',b.length===1&&b[0].subject==='You have 2 updates on Arnour'&&b[0].items===2,b.map(x=>x.subject));
// digest of matches
await notify(ce,'New role matches your profile: Role B — Acme Corp','#/job/j2');
await db.query(`update email_queue set send_after=0 where kind='matches'`);
b=(await q(`select email_build_batch() x`))[0].x;
t('daily summary groups matches',b.length===1&&b[0].subject==='2 new roles match your profile'&&/View roles/.test(b[0].html),b.map(x=>x.subject));
// settings
let pr=val(await as('c','select my_email_prefs() x'),'x');
t('default settings',pr.matches==='daily'&&pr.invites&&pr.messages&&pr.applicants==='instant'&&pr.community&&pr.email==='c@x.com',pr);
await notify(ce,'New role matches your profile: Role C — Acme Corp','#/job/j3');
t('turn off matches',!(await as('c',`select set_email_prefs('{"matches":"off","messages":false}'::jsonb)`)).err);
t('waiting matches cancelled',(await q(`select * from email_queue where kind='matches' and sent_ts is null`)).length===0);
await notify(ce,'New role matches your profile: Role D — Acme Corp','#/job/j4');
t('no new match emails after off',(await q(`select * from email_queue where kind='matches' and sent_ts is null`)).length===0);
await as('c',`select set_email_prefs('{"matches":"weekly"}'::jsonb)`);
await notify(ce,'New role matches your profile: Role E — Acme Corp','#/job/j5');
const wk=(await q(`select send_after from email_queue where kind='matches' and sent_ts is null`))[0];
t('weekly summary on Monday 08:00 UAE',wk&&new Date(+wk.send_after).getUTCDay()===1&&new Date(+wk.send_after).getUTCHours()===4,wk);
t('bad values ignored',!(await as('c',`select set_email_prefs('{"matches":"hourly","invites":"yes"}'::jsonb)`)).err&&val(await as('c','select my_email_prefs() x'),'x').matches==='weekly');
// company applicants daily
await as('e',`select set_email_prefs('{"applicants":"daily"}'::jsonb)`);
await notify(ee,'Senior · Functional Consultant applied to "SAP FICO Lead"','#/e/jobs/j1');
const ap=(await q(`select send_after from email_queue where user_id=$1 and kind='applicants'`,[U.e]))[0];
t('applicants daily for company',ap&&+ap.send_after>Date.now(),ap);
// unsubscribe link
const tok=(await q(`select token from email_prefs where user_id=$1`,[U.c]))[0].token;
t('unsubscribe works without sign-in',val(await as(null,`select email_unsubscribe('${tok}','invites') x`),'x')==='invites'&&(await q(`select invites from email_prefs where user_id=$1`,[U.c]))[0].invites===false);
t('bad token refused',val(await as(null,`select email_unsubscribe('00000000-0000-0000-0000-000000000000','all') x`),'x')==='invalid');
t('unsubscribe all',val(await as(null,`select email_unsubscribe('${tok}','all') x`),'x')==='all'&&(await q(`select matches,community from email_prefs where user_id=$1`,[U.c]))[0].community===false);
// security
t('members cannot read the queue',!!(await as('c','select * from email_queue')).err||(await as('c','select * from email_queue')).length===0);
t('members cannot read prefs table',!!(await as('c','select * from email_prefs')).err||(await as('c','select * from email_prefs')).length===0);
t('members cannot build emails',!!(await as('c','select email_build_batch()')).err);
t('anon cannot run sender',!!(await as(null,'select email_run()')).err);
// suspended
await notify(ce2,'Acme Corp would like to connect','#/c/intros');
await db.query(`update profiles set suspended=true where user_id=$1`,[U.c2]);
b=(await q(`select email_build_batch() x`))[0].x;
t('suspended account gets nothing',!b.some(x=>x.to==='c2@x.com'),b);
// sender: no key -> nothing
t('without the Resend key nothing is sent',(await q(`select email_run() n`))[0].n===0);
// sender with a stub vault + net
await db.exec(`create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text); insert into vault.decrypted_secrets values ('resend_api_key','re_test');
 create schema net; create table net.calls(id bigserial, url text, body jsonb, headers jsonb);
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;`);
await db.query(`update profiles set suspended=false where user_id=$1`,[U.c2]);
await notify(ce2,'Acme Corp invited you to apply for "Role X"','#/job/jx');
t('email_run sends due emails',(await q(`select email_run() n`))[0].n===1);
const call=(await q(`select * from net.calls`))[0];
t('sent to Resend with the key',call.url==='https://api.resend.com/emails'&&call.headers.Authorization==='Bearer re_test'&&call.body.to[0]==='c2@x.com'&&call.body.from==='Arnour <notifications@arnour.com>'&&/unsubscribe/.test(call.body.headers['List-Unsubscribe']),call);
t('logged',(await q(`select * from email_log`)).length===1);
// account deletion removes everything
await db.query(`delete from auth.users where id=$1`,[U.c2]);
t('deleted account: prefs and queue removed',(await q(`select * from email_prefs where user_id=$1`,[U.c2])).length===0&&(await q(`select * from email_queue where user_id=$1`,[U.c2])).length===0);
console.log(fails?fails+' FAILURES':'ALL PASS'); process.exit(fails?1:0);
