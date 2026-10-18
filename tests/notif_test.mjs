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
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,JSON.stringify(x).slice(0,300));} else console.log('ok  ',n); };
const ce=(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Anon',lastName:'Pro',headline:'FICO lead',anon:true})]))[0].x;
const ce2=(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Open',lastName:'Pro',anon:false,trust:'Trusted',savedJobIds:['x'],jobsSeenTs:1})]))[0].x;
const ee=(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme',anon:false})]))[0].x;
const ee2=(await as('e2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Other Co',anon:false})]))[0].x;
const jid=(await as('e',`select save_job('',$1::jsonb) x`,[JSON.stringify({title:'FI lead',status:'open'})]))[0].x;
const last=async(k)=>(await db.query(`select text,link from notifications where user_key=$1 order by ts desc, id desc limit 1`,[k])).rows[0];
const cnt=async(k)=>(await db.query(`select count(*)::int n from notifications where user_key=$1`,[k])).rows[0].n;
await as('c2',`select send_notification($1,'msg','Your account is locked, click here','#/c/dashboard')`,[ee2]);
t('unrelated member cannot notify a company',(await cnt(ee2))===0);
await as('c2',`select apply_to_job($1,'hi')`,[jid]);
await as('c2',`select send_notification($1,'app','FAKE TEXT click evil','#/e/jobs/'||$2)`,[ee,jid]);
t('application notice uses real wording',(await last(ee)).text==='Open Pro applied to "FI lead"',await last(ee));
await as('c',`select send_notification($1,'app','x','#/e/jobs/'||$2)`,[ee,jid]);
t('anonymous pro is shown by headline, not name',(await last(ee)).text.startsWith('FICO lead withdrew'),await last(ee));
await as('e',`select send_notification($1,'job','spam','#/job/'||$2)`,[ce2,jid]);
t('employer to pro about own role: match wording',/^New role matches your profile: FI lead — Acme$/.test((await last(ce2)).text),await last(ce2));
await as('e',`select invite_to_job($1,$2)`,[jid,ce2]); await as('e',`select send_notification($1,'job','spam','#/job/'||$2)`,[ce2,jid]);
t('invitation wording',(await last(ce2)).text==='Acme invited you to apply for "FI lead"',await last(ce2));
const n0=await cnt(ce2); await as('e2',`select send_notification($1,'job','spam','#/job/'||$2)`,[ce2,jid]); t('other company cannot notify about a role it does not own',(await cnt(ce2))===n0);
const cv=(await as('e',`select start_conversation($1,$2,$3) x`,[ce2,ee,jid]))[0].x;
await as('e',`select send_notification($1,'msg','Wire money now','#/c/messages/'||$2)`,[ce2,cv]); t('message notice wording',(await last(ce2)).text==='Acme sent you a message',await last(ce2));
const n1=await cnt(ce2); await as('e2',`select send_notification($1,'msg','x','#/c/messages/'||$2)`,[ce2,cv]); t('outsider cannot notify about a conversation',(await cnt(ce2))===n1);
await as('c2',`select send_notification($1,'comm','You reached the Contributor level','#/community')`,[ce2]); t('notes to yourself keep their text',(await last(ce2)).text==='You reached the Contributor level');
await as('c2',`select send_notification($1,'comm','x','https://evil.example')`,[ce2]); t('outside links are dropped',(await last(ce2)).link==='');
// community
await as('c2',`select post_question('q12345678901','How to cut over?','Details here','s4onprem','fi','',false)`);
const n2=await cnt(ce); await as('c2',`select send_notification($1,'comm','spam','#/community/q/q12345678901')`,[ce]); t('question author may alert members about their question',(await last(ce)).text==='New question in the community: "How to cut over?"' && (await cnt(ce))===n2+1, await last(ce));
await as('c',`select post_answer('q12345678901','ca12345678901','Use DMO')`); await as('c',`select send_notification($1,'comm','spam','#/community/q/q12345678901')`,[ce2]);
t('answer notice wording',(await last(ce2)).text==='FICO lead answered your question "How to cut over?"',await last(ce2));
const n3=await cnt(ce); await as('e2',`select send_notification($1,'comm','spam','#/community/q/q12345678901')`,[ce]); t('stranger cannot notify about a thread',(await cnt(ce))===n3);
// exposure of private fields
const lc=await as('c',`select x from list_consultants() x`); const o=lc.find(r=>r.x.id===ce2).x;
t('other members never receive private or made-up fields',o.trust===undefined&&o.savedJobIds===undefined&&o.jobsSeenTs===undefined&&o.firstName==='Open',o);
const mine=(await as('c2',`select x from list_consultants() x`)).find(r=>r.x.id===ce2).x; t('owner still gets all their fields',mine.savedJobIds&&mine.jobsSeenTs===1,mine);
// cv path: only the introduced company
await db.query(`update consultants set data = data || '{"cv":{"name":"cv.pdf","path":"${U.c2}/1.pdf"}}' where id=$1`,[ce2]);
const pub=(await as(null,`select get_public_profile($1) x`,[ce2]))[0].x; t('visitor sees CV name but no file path',pub.cv&&pub.cv.name==='cv.pdf'&&!pub.cv.path,pub.cv);
await as('e',`select create_intro('e',$1,$2,$3,'hi')`,[ce2,ee,jid]); const iid=(await db.query(`select id from intros limit 1`)).rows[0].id; await as('c2',`select respond_intro($1,true)`,[iid]);
const rev=(await as('e',`select x from list_consultants() x`)).find(r=>r.x.id===ce2).x; t('introduced company gets the CV file path',rev.cv&&rev.cv.path===U.c2+'/1.pdf',rev.cv);
const co=(await as('e',`select x from list_companies() x`)).find(r=>r.x.id===ee).x; await db.query(`update companies set data = data || '{"privateNote":"x"}' where id=$1`,[ee]);
const co1=(await as('e',`select x from list_companies() x`)).find(r=>r.x.id===ee).x, co2=(await as('c',`select x from list_companies() x`)).find(r=>r.x.id===ee).x;
t('company owner keeps own fields; others do not get them',co1.privateNote==='x'&&co2.privateNote===undefined);
// regrant: re-run 001 alone, community + admin rights survive
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
t('re-running 001 alone keeps community access',!(await as(null,`select list_community() x`)).err);
t('re-running 001 alone keeps admin check',!(await as('c',`select am_i_admin() x`)).err);
console.log(fails?fails+' FAILURES':'ALL PASSED');
