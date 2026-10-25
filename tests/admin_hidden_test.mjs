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
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,owner uuid);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','006_feedback','007_email','008_catalog','009_lists','010_announcements','011_admin_not_user']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/008_catalog.sql','utf8')); // runs twice
const U={a:'99999999-9999-9999-9999-999999999999',c:'22222222-2222-2222-2222-222222222222',e:'11111111-1111-1111-1111-111111111111'};
await db.query(`insert into auth.users(id,email) values ($1,'boss@arnour.test'),($2,'c@x.com'),($3,'e@x.com')`,[U.a,U.c,U.e]);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
const A2='99999999-9999-9999-9999-99999999999a'; U.a2=A2;
await db.query(`insert into auth.users(id,email) values ($1,'Boss2@Arnour.test')`,[A2]);
await db.query(`insert into admin_emails(email) values ('boss2@arnour.test')`);
await db.query(`insert into consultants(id,owner,anon,sample,data) values ('c-adm',$1,false,false,'{"firstName":"Ann","lastName":"Admin","country":"ae"}'),('c-pro',$2,false,false,'{"firstName":"Pia","lastName":"Pro","country":"ae"}')`,[U.a,U.c]);
await db.query(`insert into profiles(user_id,role,entity_id) values ($1,'consultant','c-adm'),($2,'consultant','c-pro'),($3,'employer','co-adm'),($4,'employer','co-real')`,[U.a,U.c,A2,U.e]);
await db.query(`insert into companies(id,owner,sample,data) values ('co-adm',$1,false,'{"name":"Admin Co"}'),('co-real',$2,false,'{"name":"Real Co"}')`,[A2,U.e]);
await db.query(`insert into jobs(id,company_id,owner,status,sample,data) values ('j-adm','co-adm',$1,'open',false,'{"title":"Admin role"}'),('j-real','co-real',$2,'open',false,'{"title":"Real role"}')`,[A2,U.e]);
const ids=async(who,fn)=>{ const r=await as(who,`select ${fn}() x`); return Array.isArray(r)?r.map(o=>o.x&&o.x.id):[]; };
let cs=await ids('c','list_consultants');
t('a professional sees real professionals, not the admin account',cs.includes('c-pro')&&!cs.includes('c-adm'),cs);
cs=await ids('a','list_consultants');
t('the admin still sees their own row',cs.includes('c-adm'),cs);
t('companies: the admin company is hidden',!(await ids('c','list_companies')).includes('co-adm')&&(await ids('c','list_companies')).includes('co-real'));
t('roles: the admin role is hidden (even with different email case)',!(await ids('c','list_jobs')).includes('j-adm')&&(await ids('c','list_jobs')).includes('j-real'));
t('visitors do not see them either',!(await ids(null,'list_jobs')).includes('j-adm'));
t('running the release again is harmless',await (async()=>{ await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/011_admin_not_user.sql','utf8')); return !(await ids('c','list_consultants')).includes('c-adm'); })());
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
