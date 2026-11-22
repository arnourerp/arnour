/* Release 56: Job feed database part (connect, found list, tick, drafts, closing vanished roles, notices, who may call what) */
import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
import crypto from 'crypto';
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
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','027_job_drafts','016_jd_import','035_job_to_draft','036_job_feed']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',a:'33333333-3333-3333-3333-333333333333'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
await db.query(`insert into admin_emails(email) values ('a@x.com')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,400));} else console.log('ok  ',n); };
const ok=(r)=>!r.err;
await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Crescent',country:'eg',city:'Cairo'})]);
await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]);
const cid=(await db.query(`select id from companies where data->>'name'='Crescent'`)).rows[0].id;
const SECRET='s'.repeat(40), HASH=crypto.createHash('sha256').update(SECRET).digest('hex');

/* ---- who may do what ---- */
t('a company cannot use the admin screens',!!(await as('e',`select admin_feed_list() x`)).err&&!!(await as('e',`select admin_feed_add($1,'https://x.example.com/jobs') x`,[cid])).err);
t('a professional and a visitor cannot use them either',!!(await as('c',`select admin_feed_companies() x`)).err&&!!(await as(null,`select admin_feed_list() x`)).err);
t('the feed tables cannot be read directly',!!(await as('e',`select * from job_feeds`)).err&&!!(await as(null,`select * from job_feed_items`)).err&&!!(await as('a',`select * from job_feed_worker`)).err);
t('worker functions refuse a visitor and a company with no secret',!!(await as(null,`select feed_get(null,null) x`)).err&&!!(await as('e',`select feed_get(null,null) x`)).err);
t('the daily-check secret cannot be set by a company',!!(await as('e',`select admin_feed_set_secret($1) x`,[HASH])).err);
t('a bad secret hash is refused',!!(await as('a',`select admin_feed_set_secret('abc') x`)).err);
t('the admin sets the secret',ok(await as('a',`select admin_feed_set_secret($1) x`,[HASH])));
t('the status shows a secret and no run yet',(await as('a',`select admin_feed_worker_status() x`))[0].x.hasSecret===true&&(await as('a',`select admin_feed_worker_status() x`))[0].x.lastTick===null);
t('a visitor with the wrong secret is refused, with a short one too',!!(await as(null,`select feed_get($1,null) x`,['w'.repeat(40)])).err&&!!(await as(null,`select feed_get('short',null) x`)).err);
t('a visitor with the right secret may call the worker functions',ok(await as(null,`select feed_tick($1) x`,[SECRET]))&&(await as('a',`select admin_feed_worker_status() x`))[0].x.lastTick!==null);

/* ---- lists snapshot ---- */
t('the admin saves the option lists, others cannot',ok(await as('a',`select admin_feed_save_lists($1::jsonb) x`,[JSON.stringify({products:[{id:'p'}]})]))&&!!(await as('e',`select admin_feed_save_lists('{}'::jsonb) x`)).err&&(await as(null,`select feed_lists($1) x`,[SECRET]))[0].x.products[0].id==='p');

/* ---- connect ---- */
t('companies list for the admin has Crescent',(await as('a',`select admin_feed_companies() x`))[0].x.some(c=>c.id===cid&&c.name==='Crescent'));
t('a link that is not https is refused',!!(await as('a',`select admin_feed_add($1,'http://crescent.example.com/careers') x`,[cid])).err);
t('an unknown company is refused',!!(await as('a',`select admin_feed_add('nope','https://crescent.example.com/careers') x`)).err);
const fid=(await as('a',`select admin_feed_add($1,'https://crescent.example.com/careers') x`,[cid]))[0].x;
t('the admin connects a feed',!!fid);
t('connecting the same link twice gives the same feed',(await as('a',`select admin_feed_add($1,'https://crescent.example.com/careers') x`,[cid]))[0].x===fid);
t('a feed that was not ticked yet is not "due" for the daily check',(await as(null,`select feed_get($1,null) x`,[SECRET]))[0].x===null);
t('asking for a feed by id works',(await as(null,`select feed_get($1,$2) x`,[SECRET,fid]))[0].x.url==='https://crescent.example.com/careers');

/* ---- first look: found list ---- */
const items=[{key:'https://crescent.example.com/job/1',url:'https://crescent.example.com/job/1',title:'SAP FICO Consultant',sap:true},
             {key:'https://crescent.example.com/job/2',url:'https://crescent.example.com/job/2',title:'SAP MM Lead',sap:true},
             {key:'https://crescent.example.com/job/3',url:'https://crescent.example.com/job/3',title:'ABAP Developer',sap:true},
             {key:'https://crescent.example.com/job/4',url:'https://crescent.example.com/job/4',title:'Office Manager',sap:false}];
let r=(await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(items)]))[0].x;
t('first look: 4 jobs seen, 3 offered, 1 set aside',r.status==='ok'&&r.found===4&&r.new===3,r);
let L=(await as('a',`select admin_feed_items($1) x`,[fid]))[0].x;
t('the list shows the 3 SAP jobs as "found" and the other as "ignored"',L.filter(i=>i.state==='found').length===3&&L.filter(i=>i.state==='ignored').length===1,L);
t('nothing is read before the admin ticks',(await as(null,`select feed_next($1,null) x`,[SECRET]))[0].x===null);
t('looking again does not add the same jobs twice',(await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(items)]))[0].x.new===0);

/* ---- tick ---- */
r=(await as('a',`select admin_feed_select($1,$2::text[]) x`,[fid,['https://crescent.example.com/job/1','https://crescent.example.com/job/2']]))[0].x;
t('the admin ticks 2 of 3; the third is set aside',r.selected===2&&r.ignored===1,r);
t('the feed counts as ticked once',(await as('a',`select admin_feed_list() x`))[0].x[0].approved===true);

/* ---- reading, one at a time ---- */
let n1=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
t('the next role to read is given with its link and company',n1&&n1.url.endsWith('/job/1')&&n1.companyId===cid&&n1.tries===1,n1);
const role={title:'SAP FICO Consultant',roleType:'functional',country:'eg',remote:false,employmentType:'Full-time',duration:'Permanent',description:'Do FI things',
  requires:[{productId:'s4onprem',moduleId:'fi',minProjects:0,orPrev:false}],minExp:5,level:'Senior',hack:'x',status:'open',owner:'zzz'};
let jid=(await as(null,`select feed_item_done($1,$2,'drafted','',$3::jsonb) x`,[SECRET,n1.itemId,JSON.stringify(role)]))[0].x;
const J=(await db.query(`select * from jobs where id=$1`,[jid])).rows[0];
t('a DRAFT is created for the company (not live)',J&&J.status==='draft'&&J.company_id===cid&&J.owner===U.e,J);
t('only the allowed fields are kept; city comes from the company when the country is the same',J.data.title==='SAP FICO Consultant'&&J.data.requires.length===1&&J.data.hack===undefined&&J.data.status===undefined&&J.data.owner===undefined&&J.data.city==='Cairo'&&J.data.description==='Do FI things',J.data);
t('the draft is not on the open list; the company sees it',!(await as(null,`select list_jobs() x`)).some(q=>q.x.id===jid)&&(await as('e',`select list_jobs() x`)).some(q=>q.x.id===jid&&q.x.status==='draft'));
t('a role that is already drafted cannot be drafted again from the same item',(await as(null,`select feed_item_done($1,$2,'drafted','',$3::jsonb) x`,[SECRET,n1.itemId,JSON.stringify(role)]))[0].x===null&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===1);
t('no notice yet while a role is still waiting to be read',(await as(null,`select feed_notify($1,$2) x`,[SECRET,fid]))[0].x===0);
let n2=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
t('the second role is next',n2&&n2.url.endsWith('/job/2'));
t('"not an SAP role" is set aside',(await as(null,`select feed_item_done($1,$2,'ignored','no_sap') x`,[SECRET,n2.itemId]))[0].x==='ignored');
const nt0=(await db.query(`insert into job_feed_items(feed_id,item_key,title,state) values ($1,'zz','zz','selected') returning id`,[fid])).rows[0].id;
t('a role with no title cannot be drafted',!!(await as(null,`select feed_item_done($1,$2,'drafted','','{"title":""}'::jsonb) x`,[SECRET,nt0])).err);
await db.query(`delete from job_feed_items where id=$1`,[nt0]);
t('nothing left to read',(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x===null);
t('one notice is sent to the company for the batch',(await as(null,`select feed_notify($1,$2) x`,[SECRET,fid]))[0].x===1&&(await db.query(`select text,link from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows.length===1);
const nt=(await db.query(`select text,link from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows[0];
t('the notice names the role and links to My roles',/SAP FICO Consultant/.test(nt.text)&&nt.link==='#/e/jobs',nt);
t('the same drafts are not announced twice',(await as(null,`select feed_notify($1,$2) x`,[SECRET,fid]))[0].x===0);

/* ---- failures and retries ---- */
await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(items.concat([{key:'https://crescent.example.com/job/5',url:'https://crescent.example.com/job/5',title:'SAP SD Consultant',sap:true},{key:'https://crescent.example.com/job/6',url:'https://crescent.example.com/job/6',title:'SAP PP Consultant',sap:true}]))]);
L=(await as('a',`select admin_feed_items($1) x`,[fid]))[0].x;
t('after the first ticking, new SAP roles are lined up to be read without asking',L.filter(i=>i.state==='selected').length===2,L.map(i=>i.title+':'+i.state));
let n3=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
t('a read that cannot be done is marked failed with a code',(await as(null,`select feed_item_done($1,$2,'failed','unreadable') x`,[SECRET,n3.itemId]))[0].x==='failed'&&(await db.query(`select error from job_feed_items where id=$1`,[n3.itemId])).rows[0].error==='unreadable');
t('the admin can put failed ones back',(await as('a',`select admin_feed_retry($1) x`,[fid]))[0].x===1);
let n4=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
t('retry leaves it waiting',(await as(null,`select feed_item_done($1,$2,'retry') x`,[SECRET,n4.itemId]))[0].x==='selected');
await db.query(`update job_feed_items set tries=3 where id=$1`,[n4.itemId]);
let n5=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
t('a role tried three times is given up',(await db.query(`select state,error from job_feed_items where id=$1`,[n4.itemId])).rows[0].state==='failed'&&(!n5||n5.itemId!==n4.itemId));

/* ---- roles that disappear are closed (after two looks) ---- */
await db.query(`update jobs set status='open' where id=$1`,[jid]);                      // the company published the first draft
await as('c',`select apply_to_job($1,'hello') x`,[jid]);
const keep=items.filter(i=>i.title!=='SAP FICO Consultant');
r=(await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(keep)]))[0].x;
t('gone once: nothing closed yet',r.closed===0&&(await db.query(`select status from jobs where id=$1`,[jid])).rows[0].status==='open',r);
r=(await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(keep)]))[0].x;
const jc=(await db.query(`select status,closed_ts from jobs where id=$1`,[jid])).rows[0];
t('gone twice: the live role is closed and the applicant is told',r.closed===1&&jc.status==='closed'&&jc.closed_ts!==null&&(await db.query(`select count(*)::int n from notifications where text like '%SAP FICO Consultant%is now closed%'`)).rows[0].n===1,[r,jc]);
t('the item is marked gone',(await db.query(`select state from job_feed_items where feed_id=$1 and title='SAP FICO Consultant'`,[fid])).rows[0].state==='gone');
/* a role the company has not published stays a draft */
const dr=(await as(null,`select feed_next($1,$2) x`,[SECRET,fid]))[0].x;
/* a page that suddenly lists almost nothing is not trusted */
await db.query(`update job_feed_items set state='drafted', job_id=null, missing=0 where feed_id=$1 and state in ('selected','found','failed') `,[fid]);
await db.query(`insert into job_feed_items(feed_id,item_key,title,state,job_id) select $1,'k'||g,'T'||g,'drafted',null from generate_series(1,6) g`,[fid]);
r=(await as(null,`select feed_store($1,$2,$3::jsonb) x`,[SECRET,fid,JSON.stringify(keep.slice(0,1))]))[0].x;
t('many roles vanishing at once closes nothing and raises a warning',r.status==='warn'&&r.closed===0&&(await as('a',`select admin_feed_list() x`))[0].x[0].lastStatus==='warn',r);
t('an empty page is an error, not "everything is gone"',(await as(null,`select feed_store($1,$2,'[]'::jsonb) x`,[SECRET,fid]))[0].x.status==='failed'&&(await as('a',`select admin_feed_list() x`))[0].x[0].lastError==='no_jobs');
t('an error from the reader is recorded',(await as(null,`select feed_store($1,$2,null,'link_unreachable') x`,[SECRET,fid]))[0].x.status==='failed'&&(await as('a',`select admin_feed_list() x`))[0].x[0].lastError==='link_unreachable');

/* ---- due feeds, switch off, remove ---- */
await db.query(`update job_feeds set last_checked_at=now()-interval '2 days' where id=$1`,[fid]);
t('a ticked feed not checked for a day is due',(await as(null,`select feed_get($1,null) x`,[SECRET]))[0].x.id===fid);
await as('a',`select admin_feed_update($1,false,true,'sap') x`,[fid]);
t('a switched-off feed is not due',(await as(null,`select feed_get($1,null) x`,[SECRET]))[0].x===null);
t('a bad filter is refused',!!(await as('a',`select admin_feed_update($1,true,true,'x') x`,[fid])).err);
t('disconnecting keeps the drafts and roles of the company',ok(await as('a',`select admin_feed_remove($1) x`,[fid]))&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===1&&(await db.query(`select count(*)::int n from job_feed_items`)).rows[0].n===0);
t('the admin log has entries',(await db.query(`select count(*)::int n from admin_log where action like '%job feed%'`)).rows[0].n>=3);

/* ---- AI read budget ---- */
const rb=(await as(null,`select feed_read_begin($1) x`,[SECRET]))[0].x;
t('a read is counted',!!rb&&(await db.query(`select count(*)::int n from jd_imports where status='started'`)).rows[0].n===1);
t('refused without the secret',!!(await as(null,`select feed_read_begin(null) x`)).err&&!!(await as('e',`select feed_read_begin(null) x`)).err);
await as(null,`select feed_read_done($1,$2,'failed') x`,[SECRET,rb]);
t('a failed read does not count',(await db.query(`select count(*)::int n from jd_imports where status<>'failed'`)).rows[0].n===0);
await db.query(`insert into jd_imports(user_id,kind,status) select '00000000-0000-0000-0000-000000000000','admin','ok' from generate_series(1,200)`);
t('the 201st read in a day is refused',(await as(null,`select feed_read_begin($1) x`,[SECRET])).err==='daily limit');
await db.query(`delete from jd_imports`);
await db.query(`insert into jd_imports(user_id,kind,status) select gen_random_uuid(),'post','ok' from generate_series(1,400)`);
t('the site-wide stop of 400 applies too',(await as(null,`select feed_read_begin($1) x`,[SECRET])).err==='busy');
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
