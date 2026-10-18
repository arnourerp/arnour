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
`);
await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8')); // idempotent
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/002_seed_samples.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/004_seed_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/005_admin.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/005_admin.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/005_admin.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444',adm:'99999999-9999-9999-9999-999999999999'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k==='adm'?'Ahmed.Salem@arnour.com':k+'@x.com']);
let fails=0;
async function as(who,sql,params){ // run as role with uid
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};}
}
function t(name,ok,extra){ if(!ok){fails++;console.log('FAIL',name,extra!==undefined?JSON.stringify(extra).slice(0,300):'');} else console.log('ok  ',name);}

const val=(r,f)=>Array.isArray(r)?r[0][f]:null;
const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',headline:'FICO',skills:[{productId:'s4onprem',moduleId:'fi',certified:true}]})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Open',lastName:'Guy',headline:'ABAP'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp',industry:'Retail'})]),'x');
const ee2=val(await as('e2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Beta Ltd',industry:'Bank'})]),'x');
t('profiles',ce&&ce2&&ee&&ee2);
const j1=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Acme role'})]),'x');
// --- admin gate
t('non-admin cannot call admin_overview',!!(await as('c','select admin_overview() x')).err);
t('anon cannot call admin_overview',!!(await as(null,'select admin_overview() x')).err);
t('am_i_admin false for user',val(await as('c','select am_i_admin() x'),'x')===false);
t('am_i_admin true for admin (case-insensitive e-mail)',val(await as('adm','select am_i_admin() x'),'x')===true);
t('admin cannot be forged by profile data',!!(await as('c',`select admin_people('') x`)).err);
let ov=(await as('adm','select admin_overview() x'))[0].x;
t('overview counts',ov.professionals===2&&ov.companies===2&&ov.openRoles===1&&ov.selfCertified===1&&Array.isArray(ov.series)&&ov.series.length>=14,ov);
let ppl=(await as('adm',`select admin_people('') x`))[0].x;
t('people lists everyone with e-mail',ppl.length===5&&ppl.some(p=>p.email==='c@x.com'&&p.name==='Real Person'&&p.selfCertified===true),ppl.map(p=>p.email));
t('people search',(await as('adm',`select admin_people('acme') x`))[0].x.length===1);
// --- suspension
t('suspend works',!(await as('adm',`select admin_set_suspended('${U.c}',true,'Spam in messages') x`)).err);
t('suspended user blocked from reads',/suspended/.test((await as('c','select list_jobs() x')).err||''));
t('suspended user blocked from apply',!!(await as('c',`select apply_to_job('${j1}','hi') x`)).err);
t('suspended user blocked from posting',!!(await as('c',`select post_question(null,'t','b','s4onprem','','',false) x`)).err);
t('suspended user can still read own profile row (to show the notice)',(await as('c','select suspended, suspended_reason from profiles'))[0].suspended===true);
let rows=await as('e','select list_consultants() x'); t('suspended person hidden from others',!rows.some(r=>r.x.id===ce));
t('cannot suspend admin',!!(await as('adm',`select admin_set_suspended('${U.adm}',true,'x') x`)).err);
t('reinstate works',!(await as('adm',`select admin_set_suspended('${U.c}',false,'') x`)).err);
t('reinstated user works',!(await as('c','select list_jobs() x')).err);
rows=await as('e','select list_consultants() x'); t('reinstated person visible again',rows.some(r=>r.x.id===ce));
// suspended user may still delete own account
await as('adm',`select admin_set_suspended('${U.c2}',true,'x') x`);
t('suspended user can delete own account',!(await as('c2','select delete_my_account() x')).err);
t('account gone',(await db.query(`select count(*)::int n from auth.users where id='${U.c2}'`)).rows[0].n===0);
// --- cert badge
await as('adm',`select admin_set_cert_revoked('${ce}',true) x`);
rows=await as('e','select list_consultants() x'); t('revoked flag reaches clients',rows.find(r=>r.x.id===ce).x.certRevoked===true);
await as('c',`select save_profile($1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',certRevoked:false,skills:[{certified:true}]})]);
rows=await as('e','select list_consultants() x'); t('user cannot clear the revoked flag',rows.find(r=>r.x.id===ce).x.certRevoked===true);
t('user notified',(await as('c','select * from notifications')).some(n=>/badge was removed/.test(n.text)));
await as('adm',`select admin_set_cert_revoked('${ce}',false) x`);
// --- reports
t('anon cannot report',!!(await as(null,`select report_item('job','${j1}','spam','') x`)).err);
t('report a role',!(await as('c',`select report_item('job','${j1}','fake','looks fake') x`)).err);
t('duplicate report ignored',(await as('c',`select report_item('job','${j1}','fake','again') x`)).err===undefined&&(await db.query('select count(*)::int n from reports')).rows[0].n===1);
t('cannot report own item',!!(await as('e',`select report_item('job','${j1}','spam','') x`)).err);
t('report unknown target fails',!!(await as('c',`select report_item('job','nope','spam','') x`)).err);
t('bad reason rejected',!!(await as('c',`select report_item('profile','${ee}','xx','') x`)).err);
const hidco=null;
let rep=(await as('adm',`select admin_reports('open') x`))[0].x;
t('admin sees report with context',rep.length===1&&rep[0].label==='Acme role'&&rep[0].reporter==='c@x.com'&&rep[0].canRemove&&rep[0].ownerEmail==='e@x.com',rep);
t('user cannot read reports table',(await as('c','select * from reports')).err!==undefined||(await as('c','select * from reports')).length===0);
t('non-admin cannot list reports',!!(await as('c',`select admin_reports('open') x`)).err);
t('moderate remove deletes role and notifies company',!(await as('adm',`select admin_moderate(${rep[0].id},'remove','Fake posting') x`)).err
  && (await db.query(`select count(*)::int n from jobs where id='${j1}'`)).rows[0].n===0
  && (await as('e','select * from notifications')).some(n=>/was removed by Arnour/.test(n.text)));
t('report marked resolved',(await as('adm',`select admin_reports('resolved') x`))[0].x.length===1);
// report community item then suspend owner
const q1=val(await as('e2',`select post_question(null,'Buy cheap stuff','spam body','s4onprem','','',false) x`),'x');
await as('c',`select report_item('question','${q1}','spam','') x`);
rep=(await as('adm',`select admin_reports('open') x`))[0].x;
t('community report listed with link',rep.length===1&&rep[0].link==='#/community/q/'+q1,rep);
t('moderate suspend',!(await as('adm',`select admin_moderate(${rep[0].id},'suspend','Spammer') x`)).err);
let L=(await as(null,'select list_community() x'))[0].x; t('suspended user posts vanish from community',!L.questions.some(x=>x.id===q1));
await as('adm',`select admin_set_suspended('${U.e2}',false,'') x`);
// admin remove post + dismiss
await as('c',`select report_item('question','${q1}','abusive','') x`);
rep=(await as('adm',`select admin_reports('open') x`))[0].x;
t('dismiss works',!(await as('adm',`select admin_moderate(${rep[0].id},'dismiss','fine') x`)).err&&(await as('adm',`select admin_reports('dismissed') x`))[0].x.length===1);
t('admin removes post directly',!(await as('adm',`select admin_remove_post('question','${q1}','Spam') x`)).err&&!(await as(null,'select list_community() x'))[0].x.questions.some(x=>x.id===q1));
t('non-admin cannot remove post',!!(await as('c',`select admin_remove_post('question','q1','x') x`)).err);
// conversation report
const jj=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Conv role'})]),'x');
await as('e',`select create_intro('e','${ce}','${ee}',null,'hello',null) x`);
const iid=(await db.query('select id from intros limit 1')).rows[0]?.id;
await as('c',`select respond_intro('${iid}',true) x`);
const cvid=(await db.query('select id from conversations limit 1')).rows[0]?.id;
await as('e',`select send_message('${cvid}','you idiot',null,null) x`);
t('admin cannot read unreported conversation',!!(await as('adm',`select admin_conversation('${cvid}') x`)).err);
t('outsider cannot report a conversation',!!(await as('e2',`select report_item('conversation','${cvid}','abusive','') x`)).err);
t('participant reports conversation',!(await as('c',`select report_item('conversation','${cvid}','abusive','rude') x`)).err);
const cvr=(await as('adm',`select admin_conversation('${cvid}') x`))[0].x;
t('admin reads reported conversation',cvr.messages.some(m=>m.text==='you idiot')&&cvr.professional==='Real Person'&&cvr.company==='Acme Corp',cvr);
// hide samples
const nj=(await as(null,'select list_jobs() x')).length;
t('samples visible by default',nj>=20,nj);
t('only admin can hide samples',!!(await as('c',`select admin_set_hide_samples(true) x`)).err);
await as('adm',`select admin_set_hide_samples(true) x`);
t('hiding samples removes sample jobs/consultants/companies/community',(await as(null,'select list_jobs() x')).length<3&&(await as('c','select list_consultants() x')).filter(r=>r.x.sample).length===0&&(await as(null,'select list_companies() x')).filter(r=>r.x.sample).length===0&&(await as(null,'select list_community() x'))[0].x.questions.filter(q=>q.sample).length===0);
t('own profile still visible with samples hidden',(await as('c','select list_consultants() x')).some(r=>r.x.id===ce));
await as('adm',`select admin_set_hide_samples(false) x`);
t('samples back',(await as(null,'select list_jobs() x')).length>=20);
t('settings readable by admin',(await as('adm','select admin_settings() x'))[0].x.hideSamples===false);
// admin delete user
t('admin deletes account',!(await as('adm',`select admin_delete_user('${U.e2}') x`)).err&&(await db.query(`select count(*)::int n from auth.users where id='${U.e2}'`)).rows[0].n===0);
t('cannot delete self/admin',!!(await as('adm',`select admin_delete_user('${U.adm}') x`)).err);
// log
const lg=(await as('adm','select admin_log_list(50) x'))[0].x;
t('activity log records actions',lg.length>=8&&lg.some(l=>l.action==='suspend')&&lg.some(l=>l.action==='delete account'),lg.length);
t('non-admin cannot read log',!!(await as('c','select admin_log_list(5) x')).err);
t('log table not directly readable',!!(await as('c','select * from admin_log')).err);
console.log(fails?('FAILED '+fails):'ALL PASSED'); process.exit(fails?1:0);
