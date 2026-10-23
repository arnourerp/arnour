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


const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444',c3:'55555555-5555-5555-5555-555555555555'};
for(const k in U) await db.query(`insert into auth.users values ($1,$2)`,[U[k],k+'@x.com']);
let fails=0;
async function as(who,sql,params){ // run as role with uid
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};}
}
function t(name,ok,extra){ if(!ok){fails++;console.log('FAIL',name,extra!==undefined?JSON.stringify(extra).slice(0,300):'');} else console.log('ok  ',name);}
const val=(r,f)=>Array.isArray(r)?r[0][f]:null;
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/007_email.sql','utf8'));
const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',anon:true,skills:[{productId:'s4onprem',moduleId:'fi',projects:3}]})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Two'})]),'x');
const ce3=val(await as('c3',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Three'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp'})]),'x');
await as('e2',`select claim_profile('employer','{"name":"Other"}'::jsonb)`);
const jid=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'FICO Lead',requires:[{productId:'s4onprem',moduleId:'fi'}]})]),'x');
for(const w of ['c','c2','c3']) t('apply '+w,!(await as(w,`select apply_to_job('${jid}','hi')`)).err);
const myApp=async(w)=>(await as(w,`select viewed_ts, shortlisted_ts from applications where job_id='${jid}'`))[0];
t('starts as applied (not viewed)',!(await myApp('c')).viewed_ts);
t('company marks viewed',!(await as('e',`select mark_applications_viewed('${jid}')`)).err&&!!(await myApp('c')).viewed_ts);
t('other company cannot',!!(await as('e2',`select mark_applications_viewed('${jid}')`)).err);
const nBefore=(await as('c','select * from notifications')).length;
t('shortlist',!(await as('e',`select set_application_stage('${jid}','${ce}','shortlisted')`)).err);
t('professional sees Shortlisted',!!(await myApp('c')).shortlisted_ts);
const nots=await as('c','select text,link from notifications order by ts');
t('told about it',nots.length===nBefore+1&&/Acme Corp shortlisted you for "FICO Lead"/.test(nots[nots.length-1].text)&&nots[nots.length-1].link==='#/c/applied',nots);
await as('e',`select set_application_stage('${jid}','${ce}','shortlisted')`);
t('shortlisting twice tells once',(await as('c','select * from notifications')).length===nBefore+1);
t('emailed (application update)',(await db.query(`select kind from email_queue where text like '%shortlisted you%'`)).rows.some(r=>r.kind==='invites'));
t('pass on c2',!(await as('e',`select set_application_stage('${jid}','${ce2}','declined')`)).err);
t('company sees it',(await as('e',`select * from app_review where job_id='${jid}'`)).length===1);
t('professional cannot see "not selected" before close',(await as('c2',`select * from app_review`)).length===0);
t('no message yet',(await as('c2',`select * from notifications where text like '%not move forward%'`)).length===0);
t('other company cannot set stage',!!(await as('e2',`select set_application_stage('${jid}','${ce3}','shortlisted')`)).err);
t('only applicants',!!(await as('e',`select set_application_stage('${jid}','c-nobody','shortlisted')`)).err);
t('undo',!(await as('e',`select set_application_stage('${jid}','${ce2}','new')`)).err&&(await as('e',`select * from app_review`)).length===0);
await as('e',`select set_application_stage('${jid}','${ce2}','declined')`);
// close with a hire
t('hire recorded',!(await as('e',`select set_job_hired('${jid}','${ce}')`)).err);
t('other company cannot set hire',!!(await as('e2',`select set_job_hired('${jid}','${ce}')`)).err);
t('close',!(await as('e',`select save_job('${jid}',$1::jsonb)`,[JSON.stringify({title:'FICO Lead',status:'closed',requires:[{productId:'s4onprem',moduleId:'fi'}]})])).err);
const closedMsg=async w=>(await as(w,`select text from notifications where text like 'The role "FICO Lead" is now closed%'`));
t('not-hired applicants told politely',(await closedMsg('c2')).length===1&&(await closedMsg('c3')).length===1&&/Acme Corp has decided not to move forward/.test((await closedMsg('c3'))[0].text));
t('the hire is not told "not moving forward"',(await closedMsg('c')).length===0);
t('closed time set',(await db.query(`select closed_ts, hired_id from jobs where id=$1`,[jid])).rows[0].closed_ts>0);
await as('e',`select save_job('${jid}',$1::jsonb)`,[JSON.stringify({title:'FICO Lead',status:'open'})]);
await as('e',`select save_job('${jid}',$1::jsonb)`,[JSON.stringify({title:'FICO Lead',status:'closed'})]);
t('reopen and close again does not repeat the message',(await closedMsg('c3')).length===1);
// confidential role: label stays anonymous
const j2=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Secret role',confidential:true})]),'x');
await as('c3',`select apply_to_job('${j2}','hi')`);
await as('e',`select set_application_stage('${j2}','${ce3}','shortlisted')`);
const n3=(await as('c3',`select text from notifications where text like '%shortlisted you for "Secret role"%'`))[0];
t('confidential role: company not named',n3&&/^A confidential company shortlisted you/.test(n3.text),n3);
console.log(fails?fails+' FAILURES':'ALL PASS'); process.exit(fails?1:0);
