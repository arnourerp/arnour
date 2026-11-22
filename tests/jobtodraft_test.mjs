/* Release 55: moving a live role back to draft tells nobody it is closed; closing it still does */
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
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,owner uuid,metadata jsonb);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,300));} else console.log('ok  ',n); };
await as('e',`select claim_profile('employer','{"name":"Acme"}'::jsonb) x`);
await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]);
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/027_job_drafts.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/035_job_to_draft.sql','utf8'));

const save=(id,st)=>as('e',`select save_job($1,$2::jsonb) x`,[id,JSON.stringify({title:'Source FICO Lead',status:st,requires:[]})]);
const note=async()=>(await db.query(`select count(*)::int n from public.notifications where text like '%Source FICO Lead%is now closed%'`)).rows[0].n;
const job=async id=>(await db.query(`select status, closed_ts, posted_ts from public.jobs where id=$1`,[id])).rows[0];
const id=(await save('','open'))[0].x;
await as('c',`select apply_to_job($1,'hello') x`,[id]);
const n0=await note();
let r=await save(id,'draft'); const d=await job(id);
t('moving a live role to draft works',!r.err&&d.status==='draft',r);
t('the applicant got no "closed" message',(await note())===n0,[n0,await note()]);
t('the applicant can still see the role and their application',(await as('c',`select list_jobs() x`)).some(q=>q.x.id===id)&&(await db.query(`select 1 from public.applications where job_id=$1`,[id])).rows.length===1);
t('visitors and other professionals do not see it on the open list',!(await as(null,`select list_jobs() x`)).some(q=>q.x.id===id));
t('no closing time is set',d.closed_ts===null,d);
r=await save(id,'open'); const o=await job(id);
t('publishing again opens it, restarts the posted time, and still sends no message',o.status==='open'&&Number(o.posted_ts)>=Number(d.posted_ts)&&(await note())===n0,o);
r=await save(id,'closed'); const c=await job(id);
t('closing a live role still tells the applicant it is closed, and sets the closing time',c.status==='closed'&&c.closed_ts!==null&&(await note())===n0+1,[c,await note()]);
r=await save(id,'draft'); const d2=await job(id);
t('closed to draft clears the closing time and sends nothing',d2.status==='draft'&&d2.closed_ts===null&&(await note())===n0+1,d2);
r=await save(id,'open'); const o2=await job(id);
t('reopening later: still no second closed message',o2.status==='open'&&(await note())===n0+1);
r=await save(id,'closed');
t('closing again does not repeat the message to the same applicant',(await note())===n0+1,await note());
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
