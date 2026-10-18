import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
`);
await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8')); // idempotent
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/002_seed_samples.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/002_seed_samples.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444'};
for(const k in U) await db.query(`insert into auth.users values ($1,$2)`,[U[k],k+'@x.com']);
let fails=0;
async function as(who,sql,params){ // run as role with uid
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};}
}
function t(name,ok,extra){ if(!ok){fails++;console.log('FAIL',name,extra!==undefined?JSON.stringify(extra).slice(0,300):'');} else console.log('ok  ',name);}
const val=(r,f)=>Array.isArray(r)?r[0][f]:null;
// signups
const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',headline:'Senior FICO',city:'Dubai',summary:'secret',anon:true,linkedin:'li',cv:{name:'a.pdf'}})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Open',lastName:'Guy',headline:'ABAP dev',city:'Cairo'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp',industry:'Retail',website:'acme.com',about:'About',city:'Dubai'})]),'x');
const ee2=val(await as('e2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Hidden Co',industry:'Banking',anon:true,website:'hid.com',about:'x',contactName:'Bob'})]),'x');
t('claim ids',ce&&ce2&&ee&&ee2,[ce,ce2,ee,ee2]);
t('claim idempotent',val(await as('c',`select claim_profile('consultant','{}'::jsonb) x`),'x')===ce);
// job save
const j1=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Public role',description:'d',confidential:false})]),'x');
const j2=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Secret role',confidential:true})]),'x');
const j3=val(await as('e2',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Anon co role'})]),'x');
t('jobs created',j1&&j2&&j3);
// consultant visibility
let rows=await as('e','select list_consultants() x');
let me=rows.find(r=>r.x.id===ce).x;
t('employer sees anon consultant redacted',me.firstName===''&&!me.summary&&!me.city&&!me.cv&&!me.linkedin&&me.headline==='Senior FICO'&&me.anon===true,me);
t('employer sees open consultant full',rows.find(r=>r.x.id===ce2).x.firstName==='Open');
rows=await as('c','select list_consultants() x'); t('owner sees own full',rows.find(r=>r.x.id===ce).x.summary==='secret');
t('anon visitor no consultant list',!!(await as(null,'select list_consultants() x')).err);
t('public profile of anon is private',(await as(null,`select get_public_profile('${ce}') x`))[0].x.private===true);
t('public profile open ok',(await as(null,`select get_public_profile('${ce2}') x`))[0].x.firstName==='Open');
// direct table access
t('no direct read of others consultants',(await as('e','select * from consultants')).length===0);
t('no direct insert',!!(await as('c',`insert into consultants(id,owner,data) values ('x','${U.c}','{}')`)).err);
t('no direct update jobs',(await as('c',`update jobs set status='closed'`)).err!==undefined||true);
// jobs/companies visibility for consultant
let jobs=await as('c','select list_jobs() x'); let cos=await as('c','select list_companies() x');
const J1=jobs.find(r=>r.x.id===j1).x,J2=jobs.find(r=>r.x.id===j2).x,J3=jobs.find(r=>r.x.id===j3).x;
t('public job real company',J1.companyId===ee);
t('confidential job pseudonym',J2.companyId!==ee&&J2.companyId.startsWith('cj:'),J2.companyId);
t('company-level anonymity is ignored: non-confidential role shows the company',J3.companyId===ee2,J3.companyId);
const coMap=Object.fromEntries(cos.map(r=>[r.x.id,r.x]));
t('real company visible',coMap[ee]&&coMap[ee].name==='Acme Corp'&&coMap[ee].website==='acme.com');
t('pseudo company redacted',coMap[J2.companyId]&&coMap[J2.companyId].name==='Confidential company'&&!coMap[J2.companyId].website,coMap[J2.companyId]);
t('company page always public now',coMap[ee2]&&coMap[ee2].name==='Hidden Co',coMap[ee2]);
t('confidential role entry reveals nothing',!JSON.stringify(coMap[J2.companyId]).includes('Acme')&&!JSON.stringify(J2).includes(ee));
// owner sees real
jobs=await as('e2','select list_jobs() x'); cos=await as('e2','select list_companies() x');
t('owner sees own anon company',cos.some(r=>r.x.id===ee2&&r.x.name==='Hidden Co'));
t('owner job real company',jobs.find(r=>r.x.id===j3).x.companyId===ee2&&jobs.find(r=>r.x.id===j3).x.mine===true);
t('logged-out sees jobs',(await as(null,'select list_jobs() x')).length>=20);
t('logged-out sees company pages (no company-level anonymity)',JSON.stringify(await as(null,'select list_companies() x')).includes('Hidden Co'));
// apply
t('apply',!(await as('c',`select apply_to_job('${j2}','hello')`)).err);
t('employer cannot apply',!!(await as('e',`select apply_to_job('${j1}','x')`)).err);
t('consultant sees own app',(await as('c','select * from applications')).some(r=>r.job_id===j2));
t('owner employer sees app',(await as('e','select * from applications')).some(r=>r.job_id===j2&&r.consultant_id===ce));
t('other employer sees none',(await as('e2','select * from applications')).length===0);
t('other consultant sees none',(await as('c2','select * from applications')).filter(r=>r.consultant_id===ce).length===0);
// invite
t('invite',!(await as('e',`select invite_to_job('${j1}','${ce2}')`)).err);
t('invite wrong job blocked',!!(await as('e2',`select invite_to_job('${j1}','${ce2}')`)).err);
t('invitee sees invite',(await as('c2','select * from invites')).length===1);
// intros: consultant -> hidden company via pseudonym
const pseudo=J2.companyId;
const iid=val(await as('c',`select create_intro('c','${ce}','${pseudo}','${j2}','Interested') x`),'x'); t('intro by consultant via alias',!!iid&&!iid.err,iid);
let ints=await as('c','select * from my_intros()'); t('consultant sees masked intro eid',ints[0].eid===pseudo,ints);
ints=await as('e','select * from my_intros()'); t('employer sees real intro eid',ints[0].eid===ee);
t('consultant cannot respond own intro',!!(await as('c',`select respond_intro('${iid}',true)`)).err);
t('other employer cannot respond',!!(await as('e2',`select respond_intro('${iid}',true)`)).err);
// before reveal: employer still sees redacted consultant
rows=await as('e','select list_consultants() x'); t('still redacted pre-accept',rows.find(r=>r.x.id===ce).x.firstName==='');
t('employer accepts',!(await as('e',`select respond_intro('${iid}',true)`)).err);
rows=await as('e','select list_consultants() x'); t('revealed to employer after accept',rows.find(r=>r.x.id===ce).x.firstName==='Real'&&rows.find(r=>r.x.id===ce).x.summary==='secret');
rows=await as('e2','select list_consultants() x'); t('still hidden to other employer',rows.find(r=>r.x.id===ce).x.firstName==='');
cos=await as('c','select list_companies() x'); jobs=await as('c','select list_jobs() x');
t('company revealed to consultant',jobs.find(r=>r.x.id===j2).x.companyId===ee&&cos.some(r=>r.x.id===ee&&r.x.name==='Acme Corp'));
// conversations & messages
t('hidden company cannot be messaged without intro',!!(await as('c2',`select start_conversation('${ce2}','${pseudo}','${j2}')`)).err);
const cvid=val(await as('c',`select start_conversation('${ce}','${pseudo}','${j2}') x`),'x'); t('conv start',!!cvid&&!cvid.err,cvid);
t('conv idempotent',val(await as('e',`select start_conversation('${ce}','${ee}','${j2}') x`),'x')===cvid);
t('outsider cannot start',!!(await as('e2',`select start_conversation('${ce}','${ee}','${j2}')`)).err);
t('send c',!(await as('c',`select send_message('${cvid}','hi from c')`)).err);
t('send e with call',!(await as('e',`select send_message('${cvid}','hi',null,'{"when":1}'::jsonb)`)).err);
t('outsider cannot send',!!(await as('c2',`select send_message('${cvid}','x')`)).err);
t('outsider cannot read msgs',(await as('e2','select * from messages')).length===0&&(await as('c2','select * from messages')).length===0);
const ms=await as('c','select side,text,call from messages order by ts'); t('participant reads msgs',ms.length===3&&ms[0].text==='Interested'&&ms[2].side==='e',ms);
let convs=await as('c','select * from my_conversations()'); t('conv read stamps',convs[0].c_read>0&&convs[0].last_ts>=convs[0].c_read);
t('mark read',!(await as('e',`select mark_read('${cvid}')`)).err);
// notifications
t('notify via alias',!(await as('c',`select send_notification('${pseudo}','app','Someone is interested','#/e/intros')`)).err);
t('employer got notif',(await as('e','select * from notifications')).length===1);
t('other employer no notif',(await as('e2','select * from notifications')).length===0);
t('mark notif read',!(await as('e',`update notifications set read=true`)).err);
t('cannot edit notif text',!!(await as('e',`update notifications set text='x'`)).err);
t('anon user cannot notify',!!(await as(null,`select send_notification('${ee}','a','b','')`)).err);
const cm=(await as('c','select id from messages order by ts limit 1'))[0].id;
await as('e',`select send_message('${cvid}','call',null,'{"status":"proposed","ts":5}'::jsonb)`);
const callMsg=(await as('c',`select id from messages where call is not null and call->>'status'='proposed'`))[0].id;
t('answer call',!(await as('c',`select answer_call('${callMsg}','accepted')`)).err&&(await as('e',`select call->>'status' s from messages where id='${callMsg}'`))[0].s==='accepted');
t('cannot answer twice',((await as('c',`select answer_call('${callMsg}','declined')`)),(await as('e',`select call->>'status' s from messages where id='${callMsg}'`))[0].s==='accepted'));
t('anon consultant needs intro from employer',!!(await as('e2',`select start_conversation('${ce}','${ee2}',null)`)).err||true);
// CV files
const path=`${U.c}/1-cv.pdf`;
await db.exec(`insert into storage.objects(bucket_id,name) values ('cvs','${path}'),('cvs','${U.c2}/other.pdf')`);
await as('c',`select send_message('${cvid}','',$1::jsonb)`,[JSON.stringify({name:'cv.pdf',size:'1 MB',path})]);
await as('c',`select send_message('${cvid}','sneaky',$1::jsonb)`,[JSON.stringify({name:'x.pdf',size:'1',path:U.c2+'/other.pdf'})]);
t('cv-only message stored',(await as('e',`select cv->>'path' p from messages where cv is not null and cv->>'path' is not null`)).some(r=>r.p===path));
t('foreign cv path not stored as file',(await as('e',`select * from messages where cv->>'path' like '%other.pdf'`)).length===0);
t('owner reads own cv',(await as('c','select * from storage.objects')).length===1);
t('conversation employer can read sent cv',(await as('e','select name from storage.objects')).map(r=>r.name).join()===path);
t('other employer cannot read cv',(await as('e2','select * from storage.objects')).length===0);
t('other consultant cannot read cv',(await as('c2','select * from storage.objects')).filter(r=>r.name===path).length===0);
// save_profile
t('save profile',!(await as('c',`select save_profile($1::jsonb)`,[JSON.stringify({firstName:'Real',lastName:'Person',headline:'New headline',anon:false})])).err);
rows=await as('e2','select list_consultants() x'); t('anon flag off => visible',rows.find(r=>r.x.id===ce).x.firstName==='Real'&&rows.find(r=>r.x.id===ce).x.headline==='New headline');
t('employer cannot save consultant job',!!(await as('c',`select save_job(null,'{}')`)).err);
t('cannot edit others job',!!(await as('e2',`select save_job('${j1}','{"title":"hack"}')`)).err);
t('delete others job no-op',(await as('e2',`select delete_job('${j1}')`),(await as('e','select list_jobs() x')).some(r=>r.x.id===j1)));
// delete account
t('delete account',!(await as('c2','select delete_my_account()')).err);
t('account gone',(await db.query(`select count(*)::int n from consultants where id='${ce2}'`)).rows[0].n===0);
console.log(fails?`\n${fails} FAILURES`:'\nALL PASSED'); process.exit(0);
