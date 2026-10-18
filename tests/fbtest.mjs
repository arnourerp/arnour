import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','006_feedback']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',c3:'55555555-5555-5555-5555-555555555555'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,300));} else console.log('ok  ',n); };


await db.query(`insert into auth.users(id,email) values ('99999999-9999-9999-9999-999999999999','boss@arnour.test')`);
U.a='99999999-9999-9999-9999-999999999999'; await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
const ee=(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme',anon:false})]))[0].x;
let r=await as(null,`select submit_feedback('problem','Save button does nothing','v@x.com','#/jobs','UA','{"errors":[]}'::jsonb,null) x`);
t('visitor can report',typeof r[0].x==='string'||typeof r[0].x==='number',r);
r=await as(null,`select submit_feedback('problem','x','','#/','UA','{}'::jsonb,null) x`); t('too short rejected',r.err,r);
r=await as(null,`select submit_feedback('problem','Long enough text','not-an-email','#/','UA','{}'::jsonb,null) x`); t('bad email rejected',r.err&&/email/.test(r.err),r);
r=await as('e',`select submit_feedback('suggestion','Add dark mode please','','#/e/jobs','UA','{}'::jsonb,'11111111-1111-1111-1111-111111111111/a.png') x`); t('signed-in report ok',!r.err,r);
r=await as('e',`select submit_feedback('problem','Another one here','','#/e/jobs','UA','{}'::jsonb,'someone-else/a.png') x`);
const rows=(await db.query(`select user_id,email,role,shot,category from feedback order by id`)).rows;
t('email + role filled from account',rows[1].email==='e@x.com'&&rows[1].role==='employer',rows);
t('own-folder screenshot kept, foreign path dropped',rows[1].shot&&rows[2].shot===null,rows);
for(let i=0;i<5;i++) await as('e',`select submit_feedback('problem','flood number ${'$'}{i}','','#/','UA','{}'::jsonb,null)`.replace('${'+'$'+'}','').replace('$'+'{i}',String(i)));
r=await as('e',`select submit_feedback('problem','one more flood','','#/','UA','{}'::jsonb,null) x`); t('flood guard per person',r.err&&/too many/.test(r.err),r);
r=await as('c',`select admin_feedback('open',50) x`); t('non-admin cannot read',r.err&&/not allowed/.test(r.err),r);
r=await as('a',`select admin_feedback('open',50) x`); t('admin reads reports',r[0].x.length>=3&&r[0].x[0].message,r);
const fid=r[0].x[0].id; const q=await as('a',`select admin_feedback_set($1,'done','ok') x`,[fid]); t('set ok',!q.err,q);
r=await as('a',`select admin_feedback('done',50) x`); t('mark done',r[0].x.length===1,r);
// errors
for(let i=0;i<3;i++) await as(null,`select log_client_error('Cannot read properties of undefined','core.js:10','#/jobs','UA')`);
await as(null,`select log_client_error('','x','','')`);
r=await as('a',`select admin_health() x`); t('errors grouped',r[0].x.errors.length===1&&r[0].x.errors[0].n===3,r[0].x.errors);
t('open feedback counted',r[0].x.openFeedback>=2,r[0].x);
// usage
await as(null,`select track_usage('v:jobs')`); await as(null,`select track_usage('v:jobs')`); await as(null,`select track_usage('Bad Name!')`); await as(null,`select track_usage('x'||repeat('y',60))`);
r=await as('a',`select admin_health() x`); const u=r[0].x.usage; t('usage counted, bad names ignored',u.length===1&&u[0].name==='v:jobs'&&u[0].n===2,u);
r=await as(null,`select admin_health() x`); t('anon cannot read health',r.err,r);
r=await as(null,`select * from feedback`); t('table closed to direct reads',r.err,r);
await as('a',`select admin_clear_errors()`); r=await as('a',`select admin_health() x`); t('clear errors',r[0].x.errors.length===0,r);

// visitors: per network address limit
await db.exec(`select set_config('request.headers','{"x-forwarded-for":"9.9.9.9, 10.0.0.1"}',false)`);
for(let i=0;i<5;i++){ const rr=await as(null,`select submit_feedback('problem','visitor flood ${'$'}{i}','','#/','UA','{"_ip":"spoof"}'::jsonb,null) x`.replace('${'+'$'+'}{i}',String(i))); if(rr.err) console.log('unexpected',rr.err); }
r=await as(null,`select submit_feedback('problem','sixth from same address','','#/','UA','{}'::jsonb,null) x`); t('visitor limit per address',r.err&&/too many/.test(r.err),r);
await db.exec(`select set_config('request.headers','{"x-forwarded-for":"8.8.8.8"}',false)`);
r=await as(null,`select submit_feedback('problem','someone else entirely','','#/','UA','{}'::jsonb,null) x`); t('other visitors not blocked',!r.err,r);
const ipr=(await db.query(`select ctx->>'_ip' ip from feedback where message='someone else entirely'`)).rows[0];
t('address stored only scrambled',ipr.ip&&ipr.ip!=='8.8.8.8'&&ipr.ip.length===32,ipr);
await db.exec(`select set_config('request.headers','',false)`);
console.log(fails?'FAILS '+fails:'ALL PASSED');
