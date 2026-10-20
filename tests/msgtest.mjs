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
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444',c3:'55555555-5555-5555-5555-555555555555'};
for(const k in U) await db.query(`insert into auth.users values ($1,$2)`,[U[k],k+'@x.com']);
let fails=0;
async function as(who,sql,params){ // run as role with uid
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};}
}
function t(name,ok,extra){ if(!ok){fails++;console.log('FAIL',name,extra!==undefined?JSON.stringify(extra).slice(0,300):'');} else console.log('ok  ',name);}
const val=(r,f)=>Array.isArray(r)?r[0][f]:null;
const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',headline:'Senior FICO',anon:true})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Open',lastName:'Guy',headline:'ABAP dev',anon:true})]),'x');
const ce3=val(await as('c3',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Third',lastName:'One'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp'})]),'x');
const jc=val(await as('e',`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'Secret role',confidential:true})]),'x');
// company -> professional, no intro needed
const cv1=val(await as('e',`select start_conversation('${ce}','${ee}',null) x`),'x');
t('company starts chat without intro',typeof cv1==='string'&&cv1.startsWith('cv'),cv1);
t('first message',!(await as('e',`select send_message('${cv1}','hello')`)).err);
t('second message',!(await as('e',`select send_message('${cv1}','are you there')`)).err);
const third=await as('e',`select send_message('${cv1}','third')`);
t('third message blocked until reply',!!third.err&&/wait for a reply/.test(third.err),third);
t('receiver can reply',!(await as('c',`select send_message('${cv1}','yes')`)).err);
t('starter can send after reply',!(await as('e',`select send_message('${cv1}','great')`)).err);
let lc=(await as('e','select list_consultants() x')).find(r=>r.x.id===ce).x;
t('professional still anonymous in chat',lc.firstName==='',lc);
t('share identity',!(await as('c',`select reveal_in_conversation('${cv1}')`)).err);
lc=(await as('e','select list_consultants() x')).find(r=>r.x.id===ce).x;
t('name shown after share',lc.firstName==='Real',lc);
let mc=(await as('c','select * from my_conversations()')).find(r=>r.id===cv1);
t('my_conversations flags',mc&&mc.rev_c===true&&mc.rev_e===false&&mc.mine===false,mc);
// professional -> confidential role: company stays hidden
const cv2=val(await as('c2',`select start_conversation('${ce2}','${ee}','${jc}') x`),'x');
t('professional messages confidential role',typeof cv2==='string'&&cv2.startsWith('cv'),cv2);
mc=(await as('c2','select * from my_conversations()')).find(r=>r.id===cv2);
t('company id hidden in conversation',mc&&mc.e_id!==ee,mc);
const lj=(await as('c2','select list_jobs() x')).find(r=>r.x.id===jc).x;
t('confidential job still hidden',lj.companyId!==ee,lj);
t('company shares identity',!(await as('e',`select reveal_in_conversation('${cv2}')`)).err);
const lj2=(await as('c2','select list_jobs() x')).find(r=>r.x.id===jc).x;
t('job company shown after share',lj2.companyId===ee,lj2);
// peer chat
const p1=val(await as('c2',`select start_peer_conversation('${ce}') x`),'x');
t('peer chat starts',typeof p1==='string'&&p1.startsWith('cv'),p1);
t('peer chat idempotent from other side',val(await as('c',`select start_peer_conversation('${ce2}') x`),'x')===p1);
t('employer cannot start peer chat',!!(await as('e',`select start_peer_conversation('${ce}')`)).err);
t('cannot peer-chat yourself',!!(await as('c',`select start_peer_conversation('${ce}')`)).err);
t('peer send',!(await as('c2',`select send_message('${p1}','hi peer')`)).err);
t('peer reply',!(await as('c',`select send_message('${p1}','hi back')`)).err);
const pm=await as('c','select side,text from messages where conv_id=$1 order by ts',[p1]);
t('peer messages readable',pm.length===2&&pm[0].side==='c'&&pm[1].side==='e',pm);
t('outsider cannot read peer msgs',(await as('c3',`select * from messages where conv_id='${p1}'`)).length===0);
t('peer cv not stored',((await as('c',`select send_message('${p1}','',$1::jsonb)`,[JSON.stringify({name:'cv.pdf',path:U.c+'/cv.pdf'})])),(await as('c',`select cv from messages where conv_id='${p1}' and cv is not null`)).length===0));
lc=(await as('c','select list_consultants() x')).find(r=>r.x.id===ce2).x;
t('peer anonymous before share',lc.firstName==='',lc);
t('peer shares identity',!(await as('c2',`select reveal_in_conversation('${p1}')`)).err);
lc=(await as('c','select list_consultants() x')).find(r=>r.x.id===ce2).x;
t('peer visible after share',lc.firstName==='Open',lc);
lc=(await as('c3','select list_consultants() x')).find(r=>r.x.id===ce2).x;
t('still hidden to others',lc.firstName==='',lc);
t('peer mark read',!(await as('c',`select mark_read('${p1}')`)).err);
// block
t('block',!(await as('c',`select set_block('${p1}',true)`)).err);
let b=await as('c2',`select send_message('${p1}','still there?')`);
t('blocked side cannot send',!!b.err&&/closed/.test(b.err),b);
mc=(await as('c2','select * from my_conversations()')).find(r=>r.id===p1);
t('blocked_me flag',mc&&mc.blocked_me===true,mc);
mc=(await as('c','select * from my_conversations()')).find(r=>r.id===p1);
t('blocked_by_me flag',mc&&mc.blocked_by_me===true,mc);
t('blocks table not readable',!!(await as('c','select * from blocks')).err||(await as('c','select * from blocks')).length===0);
t('unblock',!(await as('c',`select set_block('${p1}',false)`)).err);
t('can send after unblock',!(await as('c2',`select send_message('${p1}','ok')`)).err);
t('outsider cannot block',!!(await as('c3',`select set_block('${p1}',true)`)).err);
t('outsider cannot reveal',!!(await as('c3',`select reveal_in_conversation('${p1}')`)).err);
// edit / delete
const mid=(await as('e',`select id from messages where conv_id='${cv1}' and text='great'`))[0].id;
t('sender edits',!(await as('e',`select edit_message('${mid}','great!')`)).err&&(await as('c',`select text,edited_ts from messages where id='${mid}'`))[0].text==='great!');
t('other side cannot edit',!!(await as('c',`select edit_message('${mid}','hacked')`)).err);
t('other side cannot delete',!!(await as('c',`select delete_message('${mid}')`)).err);
t('outsider cannot edit',!!(await as('c3',`select edit_message('${mid}','x')`)).err);
t('empty edit refused',!!(await as('e',`select edit_message('${mid}','  ')`)).err);
await db.exec(`update messages set ts = ts - 16*60000 where id='${mid}'`);
const late=await as('e',`select edit_message('${mid}','late')`);
t('edit after 15 minutes refused',!!late.err&&/edit window/.test(late.err),late);
t('delete any time',!(await as('e',`select delete_message('${mid}')`)).err);
const dm=(await as('c',`select text,deleted,cv,call from messages where id='${mid}'`))[0];
t('deleted message emptied',dm.deleted===true&&dm.text==='',dm);
t('history not readable by members',!!(await as('e','select * from message_history')).err||(await as('e','select * from message_history')).length===0);
t('history kept',(await db.query(`select action,text from message_history where msg_id='${mid}' order by ts`)).rows.map(r=>r.action+':'+r.text).join()==='edit:great,delete:great!');
t('cannot edit deleted',!!(await as('e',`select edit_message('${mid}','x')`)).err);
// sending a CV file to a company shares the identity
const cv3=val(await as('e',`select start_conversation('${ce2}','${ee}',null) x`),'x');
await as('e',`select send_message('${cv3}','hi')`);
await db.exec(`insert into storage.objects(bucket_id,name) values ('cvs','${U.c2}/cv.pdf')`);
t('send cv',!(await as('c2',`select send_message('${cv3}','',$1::jsonb)`,[JSON.stringify({name:'cv.pdf',size:'1 MB',path:U.c2+'/cv.pdf'})])).err);
t('cv shares identity',(await as('c2','select * from my_conversations()')).find(r=>r.id===cv3).rev_c===true);
const cvm=(await as('c2',`select id from messages where conv_id='${cv3}' and cv is not null`))[0].id;
t('cv not editable',!!(await as('c2',`select edit_message('${cvm}','x')`)).err);
t('company can read cv file',(await as('e',`select name from storage.objects where name='${U.c2}/cv.pdf'`)).length===1);
t('delete cv message',!(await as('c2',`select delete_message('${cvm}')`)).err&&(await as('e',`select cv from messages where id='${cvm}'`))[0].cv===null);
// daily limit
const others=[];
for(let i=0;i<10;i++){ const u='6666666'+i+'-0000-0000-0000-000000000000'; await db.query('insert into auth.users values ($1,$2)',[u,'p'+i+'@x.com']);
  U['p'+i]=u; others.push(val(await as('p'+i,`select claim_profile('consultant','{"firstName":"P"}'::jsonb) x`),'x')); }
let errAt=-1;
for(let i=0;i<10;i++){ const r=await as('c3',`select start_peer_conversation('${others[i]}')`); if(r.err){errAt=i;break;} }
t('10 new conversations allowed',errAt===-1,errAt);
const lim=await as('c3',`select start_peer_conversation('${ce}')`);
t('11th conversation blocked',!!lim.err&&/daily limit/.test(lim.err),lim);
t('existing conversation still opens',!(await as('c3',`select start_peer_conversation('${others[0]}')`)).err);
console.log(fails?fails+' FAILURES':'ALL PASS'); process.exit(fails?1:0);
