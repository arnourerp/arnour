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


const notes=async(who)=>{ const ent=(await db.query(`select entity_id from profiles where user_id=$1`,[U[who]])).rows[0].entity_id; return (await db.query(`select text from notifications where user_key=$1 order by ts`,[ent])).rows.map(r=>r.text); };
const ee=(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'SecretCo',anon:true})]))[0].x;
const cc=(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]))[0].x;
// 1) anonymous company, confidential role -> match notification must not name the company
const j1=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'Secret FICO',confidential:true,requires:[]})]))[0].x;
await as('e',`select send_notification($1,'job','New role matches your profile at 90%: Secret FICO at SecretCo','#/job/'||$2)`,[cc,j1]);
let n=await notes('c'); t('match notification hides an anonymous company',n.length===1&&!/SecretCo/.test(n[0])&&/confidential company/i.test(n[0]),n);
// 2) public company, confidential role
await db.query(`update companies set anon=false where id=$1`,[ee]);
const j2=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'Quiet MM',confidential:true,requires:[]})]))[0].x;
await as('e',`select send_notification($1,'job','x','#/job/'||$2)`,[cc,j2]);
n=await notes('c'); t('match notification hides the company of a confidential role',!/SecretCo/.test(n[1]||'SecretCo'),n);
// 3) public role of a public company -> name shown
const j3=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'Open SD',confidential:false,requires:[]})]))[0].x;
await as('e',`select send_notification($1,'job','x','#/job/'||$2)`,[cc,j3]);
n=await notes('c'); t('public role names the company',/SecretCo/.test(n[2]||''),n);
// 4) introduction about the confidential role
await db.query(`update companies set anon=true where id=$1`,[ee]);
const iid=(await as('e',`select create_intro('e',$1,$2,$3,'hello') x`,[cc,ee,j1]));
await as('e',`select send_notification($1,'job','x','#/c/intros')`,[cc]);
n=await notes('c'); t('introduction request hides the company',n.length>=4&&!/SecretCo/.test(n[3]),n);
// the job page and the notification agree
const lj=(await as('c',`select list_jobs() x`)).map(r=>r.x).find(x=>x.title==='Secret FICO');
t('job list hides the company id too',lj&&lj.companyId!==ee,lj);

// per-role reveal: an accepted introduction about one role does not reveal the company on another confidential role
await db.query(`update companies set anon=false where id=$1`,[ee]);
const jOpen=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'Public BW',confidential:false,requires:[]})]))[0].x;
const iA=(await as('e',`select create_intro('e',$1,$2,$3,'about public role') x`,[cc,ee,jOpen]))[0].x;
let rr=await as('c',`select respond_intro($1,true) x`,[iA]); t('introduction about the public role accepted',!rr.err,rr);
const jNew=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'Hush Basis',confidential:true,requires:[]})]))[0].x;
let L=(await as('c',`select list_jobs() x`)).map(r=>r.x);
t('another confidential role stays hidden after an earlier introduction',L.find(x=>x.id===jNew).companyId!==ee,L.find(x=>x.id===jNew));
t('the public role shows the company',L.find(x=>x.id===jOpen).companyId===ee);
await as('e',`select send_notification($1,'job','x','#/job/'||$2)`,[cc,jNew]);
n=await notes('c'); t('its notification stays anonymous too',/confidential company/i.test(n[n.length-1])&&!/SecretCo/.test(n[n.length-1]),n.slice(-2));
const iB=(await as('e',`select create_intro('e',$1,$2,$3,'about the hush role') x`,[cc,ee,jNew]))[0].x;
rr=await as('c',`select respond_intro($1,true) x`,[iB]); t('introduction about that role accepted',!rr.err,rr);
L=(await as('c',`select list_jobs() x`)).map(r=>r.x);
t('after an introduction about that role, it shows the company',L.find(x=>x.id===jNew).companyId===ee,L.find(x=>x.id===jNew));
console.log(fails?'FAILS '+fails:'ALL PASSED');
