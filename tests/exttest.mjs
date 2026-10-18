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


await db.query(`insert into auth.users(id,email) values ('99999999-9999-9999-9999-999999999999','boss@arnour.test'),('88888888-8888-8888-8888-888888888888','jobs@arnour.com')`);
U.a='99999999-9999-9999-9999-999999999999'; U.b='88888888-8888-8888-8888-888888888888';
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
const cc=(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]))[0].x;
let r=await as('a',`select admin_import_external_jobs('[]'::jsonb) x`); t('no board company yet -> clear error',r.err&&/Jobs on Arnour/.test(r.err),r);
await as('b',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Jobs on Arnour',anon:false})]);
const J=(o)=>Object.assign({title:'SAP FICO Lead',extEmployer:'Acme Corp',extSource:'Company career page',applyUrl:'https://careers.acme.com/j/1',country:'ae',roleType:'functional',requires:[{productId:'s4',moduleId:'FI'}],description:'Own words.'},o||{});
r=await as('e',`select admin_import_external_jobs($1::jsonb) x`,[JSON.stringify([J()])]); t('non-admin blocked',r.err&&/not allowed/.test(r.err),r);
r=await as('a',`select admin_import_external_jobs($1::jsonb) x`,[JSON.stringify([J(),J({applyUrl:'https://careers.acme.com/j/1/'}),J({title:''}),J({applyUrl:'http://x.com/a'}),J({applyUrl:'https://c.com/2',requires:[]}),J({title:'Basis',applyUrl:'https://c.com/3',injected:1,external:false,sample:true})])]);
t('1+1 imported, 4 skipped',r[0]&&r[0].x.imported===2&&r[0].x.skipped.length===4,r);
let l=await as('c',`select list_jobs() x`); const ex=l.filter(q=>q.x.external);
t('professional sees both external jobs',ex.length===2&&ex.every(q=>q.x.extEmployer==='Acme Corp'&&q.x.applyUrl&&q.x.expiresTs>Date.now()+59*864e5),ex.map(q=>q.x));
t('sample flag not injectable',ex.every(q=>q.x.sample===false),ex);
l=await as(null,`select list_jobs() x`); t('anon: no link',l.filter(q=>q.x.external).length===2&&!l.some(q=>'applyUrl' in q.x),0);
const id=ex[0].x.id;
r=await as('c',`select apply_to_job($1,'hi') x`,[id]); t('apply on platform blocked',r.err&&/employer site/.test(r.err),r);
// employer cannot fake the label
const jid=(await as('e',`select claim_profile('employer','{"name":"Acme"}'::jsonb) x`)); 
const fj=(await as('e',`select save_job('', $1::jsonb) x`,[JSON.stringify({title:'T',external:true,extEmployer:'Evil',expiresTs:1,requires:[]})]))[0].x;
l=await as('c',`select list_jobs() x`); const f=l.find(q=>q.x.id===fj); t('spoofed label stripped',f&&!f.x.external&&!f.x.extEmployer&&!f.x.expiresTs,f);
// edits by board owner keep labels
r=await as('b',`select save_job($1,$2::jsonb) x`,[id,JSON.stringify({title:'Edited',requires:[]})]);
l=await as('c',`select list_jobs() x`); const e2=l.find(q=>q.x.id===id); t('board edit keeps labels',e2&&e2.x.title==='Edited'&&e2.x.external===true&&e2.x.extEmployer==='Acme Corp',e2);
// expiry
await db.query(`update jobs set data=jsonb_set(data,'{expiresTs}','1') where id=$1`,[id]);
l=await as('c',`select list_jobs() x`); t('expired hidden from professionals',!l.some(q=>q.x.id===id),0);
l=await as('b',`select list_jobs() x`); t('owner still sees expired',l.some(q=>q.x.id===id),0);
r=await as('a',`select admin_jobs('') x`); t('admin list flags external',r[0].x.some(j=>j.external&&j.extEmployer==='Acme Corp'),r);
console.log(fails?'FAILS '+fails:'ALL PASSED');
