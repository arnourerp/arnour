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
const cc=(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H',dailyRate:900,currency:'USD',ratePeriod:'day'})]))[0].x;
const jid=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'FICO',rateMin:500,rateMax:800,currency:'USD',ratePeriod:'day',requires:[]})]))[0].x;
let l=await as('c',`select list_jobs() x`); let j=l.find(r=>r.x.id===jid);
t('professional does not receive job pay',j&&!('rateMin' in j.x)&&!('rateMax' in j.x)&&!('currency' in j.x),j);
l=await as(null,`select list_jobs() x`); j=l.find(r=>r.x.id===jid); t('visitor does not receive job pay',j&&!('rateMin' in j.x),j);
l=await as('e',`select list_jobs() x`); j=l.find(r=>r.x.id===jid); t('posting company keeps its own pay fields',j&&j.x.rateMin===500,j);
l=await as('e',`select list_consultants() x`); let c=l.find(r=>r.x.id===cc); t('company does not receive professional rate',c&&!('dailyRate' in c.x)&&!('currency' in c.x),c);
l=await as('c2',`select claim_profile('consultant','{"firstName":"Z","lastName":"Y","headline":"H"}'::jsonb) x`);
l=await as('c2',`select list_consultants() x`); c=l.find(r=>r.x.id===cc); t('other professional does not receive rate',c&&!('dailyRate' in c.x),c);
l=await as('c',`select list_consultants() x`); c=l.find(r=>r.x.id===cc); t('owner keeps own rate',c&&c.x.dailyRate===900,c);
c=(await as(null,`select get_public_profile($1) x`,[cc]))[0].x; t('public profile has no rate',c&&!('dailyRate' in c),c);
console.log(fails?'FAILS '+fails:'ALL PASSED');
