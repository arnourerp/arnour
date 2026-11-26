/* Release 60: Admin > Import jobs > Check: admin_import_known tells which apply links the board already has (same rule as the import) */
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
const REL=fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/040_import_check.sql','utf8');
await db.exec(REL); await db.exec(REL);   // safe to run twice
const U={e:'11111111-1111-1111-1111-111111111111',a:'99999999-9999-9999-9999-999999999999',b:'88888888-8888-8888-8888-888888888888'};
await db.query(`insert into auth.users(id,email) values ($1,'e@x.com'),($2,'boss@arnour.test'),($3,'jobs@arnour.com')`,[U.e,U.a,U.b]);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,400));} else console.log('ok  ',n); };
const known=async(u,who)=>(await as(who===undefined?'a':who,`select admin_import_known($1::jsonb) x`,[JSON.stringify(u)]));

let r=await known(['https://a.com/1']); t('no board company yet: empty list, no error',Array.isArray(r[0].x)&&r[0].x.length===0,r);
await as('b',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Jobs on Arnour',anon:false})]);
const J=(o)=>Object.assign({title:'SAP FICO Lead',extEmployer:'Acme Corp',extSource:'Company career page',applyUrl:'https://careers.acme.com/j/1',country:'ae',roleType:'functional',requires:[{productId:'s4',moduleId:'FI'}],description:'x'},o||{});
r=await as('a',`select admin_import_external_jobs($1::jsonb) x`,[JSON.stringify([J(),J({title:'B',applyUrl:'https://careers.ibm.com/en_US/careers/JobDetail?jobId=132911'}),J({title:'C',applyUrl:'https://c.com/Path#frag'})])]);
t('three imported',r[0]&&r[0].x.imported===3,r);

r=await known(['https://careers.acme.com/j/1','https://careers.acme.com/j/2']); const a=r[0].x;
t('known link found, new link not',a.length===1&&a[0].url==='https://careers.acme.com/j/1'&&a[0].status==='open',a);
r=await known(['HTTPS://Careers.Acme.com/J/1/']); t('capitals and a trailing slash are ignored (as in the import)',r[0].x.length===1,r);
r=await known(['https://c.com/path']); t('a #fragment on the stored link is ignored',r[0].x.length===1,r);
r=await known(['https://careers.ibm.com/en_US/careers/JobDetail?jobId=132911','https://careers.ibm.com/en_US/careers/JobDetail?jobId=132912']);
t('the query part counts: 132911 known, 132912 not',r[0].x.length===1&&/132911/.test(r[0].x[0].url),r);
r=await known(['https://careers.acme.com/j/1','https://careers.acme.com/j/1/']); t('the same link twice gives one answer',r[0].x.length===1,r);

/* a closed role still counts, with its status, exactly as the import skips it */
const id=(await db.query(`select id from jobs where data->>'applyUrl'='https://careers.acme.com/j/1'`)).rows[0].id;
await db.query(`update jobs set status='closed' where id=$1`,[id]);
r=await known(['https://careers.acme.com/j/1']); t('closed role is reported as closed',r[0].x[0]&&r[0].x[0].status==='closed',r);
r=await as('a',`select admin_import_external_jobs($1::jsonb) x`,[JSON.stringify([J()])]);
t('the import agrees: skipped as already imported',r[0].x.imported===0&&/Already imported/.test(JSON.stringify(r[0].x.skipped)),r);

/* roles of other companies do not count */
await db.query(`insert into jobs(id,company_id,owner,status,confidential,data,posted_ts) select 'other-1', c.id, c.owner, 'open', false, '{"title":"X","applyUrl":"https://other.com/1"}'::jsonb, 1 from companies c where c.id <> (select _board_company()) limit 1`);
r=await known(['https://other.com/1']); t('a role of another company is not "on Arnour" for the import',r[0].x.length===0,r);

/* who may ask, and bad input */
r=await known(['https://careers.acme.com/j/1'],'e'); t('non-admin blocked',r.err&&/not allowed/.test(r.err),r);
r=await known(['https://careers.acme.com/j/1'],null); t('visitor blocked',!!r.err,r);
r=await as('a',`select admin_import_known('{}'::jsonb) x`); t('not a list is refused',!!r.err,r);
r=await as('a',`select admin_import_known($1::jsonb) x`,[JSON.stringify(Array.from({length:201},(_,i)=>'https://z.com/'+i))]); t('more than 200 links refused',!!r.err,r);
r=await known([]); t('empty list gives empty list',r[0].x.length===0,r);
const before=(await db.query(`select count(*)::int n from jobs`)).rows[0].n; await known(['https://c.com/path']);
t('it changes nothing',(await db.query(`select count(*)::int n from jobs`)).rows[0].n===before);

/* ---- (2) close roles from a list of apply links ---- */
const prev=async(u,who)=>(await as(who===undefined?'a':who,`select admin_roles_by_links($1::jsonb) x`,[JSON.stringify(u)]));
const cls=async(u,who)=>(await as(who===undefined?'a':who,`select admin_close_by_links($1::jsonb) x`,[JSON.stringify(u)]));
const boardCo=(await db.query(`select _board_company() c`)).rows[0].c;
await db.query(`update jobs set status='open' where id=$1`,[id]);   // the acme /j/1 role is open again for these checks
await db.query(`insert into jobs(id,company_id,owner,status,confidential,data,posted_ts) values ('own-1',$1,(select owner from companies where id=$1),'open',false,'{"title":"Posted by the company","applyUrl":"https://own.com/1"}'::jsonb,1)`,[boardCo]);
r=await prev(['HTTPS://Careers.Acme.com/J/1/','https://nowhere.com/x','https://own.com/1']); let pv=r[0].x;
t('preview: finds the imported role with title, employer, status; unknown and non-imported links are not listed',pv.length===1&&pv[0].title==='SAP FICO Lead'&&pv[0].extEmployer==='Acme Corp'&&pv[0].status==='open'&&pv[0].id===id,pv);
t('preview changes nothing',(await db.query(`select status from jobs where id=$1`,[id])).rows[0].status==='open');
r=await prev(['https://careers.acme.com/j/1'],'e'); t('preview: non-admin blocked',r.err&&/not allowed/.test(r.err),r);
r=await prev(['https://careers.acme.com/j/1'],null); t('preview: visitor blocked',!!r.err,r);

r=await cls(['https://careers.acme.com/j/1','https://own.com/1','https://nowhere.com/x']); let c=r[0].x;
t('close: only the open imported role is closed',c.closed===1&&c.titles[0]==='SAP FICO Lead',c);
t('close: it is closed and has a closing time (the usual trigger ran)',(await db.query(`select status, closed_ts is not null as ts from jobs where id=$1`,[id])).rows[0].status==='closed'&&(await db.query(`select closed_ts is not null as ts from jobs where id=$1`,[id])).rows[0].ts);
t('close: a role the company posted itself is untouched',(await db.query(`select status from jobs where id='own-1'`)).rows[0].status==='open');
t('close: nothing deleted',(await db.query(`select count(*)::int n from jobs where id=$1`,[id])).rows[0].n===1);
r=await cls(['https://careers.acme.com/j/1']); t('close twice: second time closes nothing',r[0].x.closed===0,r);
r=await prev(['https://careers.acme.com/j/1']); t('preview shows the closed status',r[0].x[0]&&r[0].x[0].status==='closed',r);
t('the action is in the activity log',(await db.query(`select count(*)::int n from admin_log where action='close imported roles'`)).rows[0].n>=2);
r=await cls(['https://careers.ibm.com/en_US/careers/JobDetail?jobId=132911']); t('close by a link with a query part',r[0].x.closed===1,r);
r=await cls(['https://c.com/path'],'e'); t('close: non-admin blocked',r.err&&/not allowed/.test(r.err),r);
t('close: blocked attempt closed nothing',(await db.query(`select status from jobs where data->>'applyUrl'='https://c.com/Path#frag'`)).rows[0].status==='open');
r=await cls(['https://c.com/path'],null); t('close: visitor blocked',!!r.err,r);
r=await as('a',`select admin_close_by_links('{}'::jsonb) x`); t('close: not a list refused',!!r.err,r);
r=await as('a',`select admin_close_by_links($1::jsonb) x`,[JSON.stringify(Array.from({length:201},(_,i)=>'https://z.com/'+i))]); t('close: more than 200 links refused',!!r.err,r);
r=await cls([]); t('close: empty list closes nothing',r[0].x.closed===0,r);
console.log(fails?fails+' FAILED':'all passed'); process.exit(fails?1:0);
