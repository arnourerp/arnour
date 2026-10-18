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
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',c3:'55555555-5555-5555-5555-555555555555'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,300));} else console.log('ok  ',n); };

const ee=(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme',anon:false})]))[0].x;
const cc=(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]))[0].x;
const jid=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'FICO',applyUrl:'https://careers.acme.com/j/1',requires:[]})]))[0].x;
let l=await as('c',`select list_jobs() x`);
t('signed-in professional receives the apply link',Array.isArray(l)&&l.some(r=>r.x.id===jid&&r.x.applyUrl==='https://careers.acme.com/j/1'),l);
l=await as(null,`select list_jobs() x`);
t('signed-out visitor does NOT receive the apply link',Array.isArray(l)&&l.some(r=>r.x.id===jid)&&!l.some(r=>'applyUrl' in r.x),l);
l=await as('e',`select list_jobs() x`);
t('the company keeps its own link',Array.isArray(l)&&l.some(r=>r.x.id===jid&&r.x.applyUrl),l);
console.log(fails?'FAILS '+fails:'ALL PASSED');
