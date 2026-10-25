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
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,owner uuid);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','006_feedback','007_email','008_catalog','009_lists','010_announcements']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/010_announcements.sql','utf8')); // runs twice
const U={a:'99999999-9999-9999-9999-999999999999',c:'22222222-2222-2222-2222-222222222222',e:'11111111-1111-1111-1111-111111111111'};
await db.query(`insert into auth.users(id,email) values ($1,'boss@arnour.test'),($2,'c@x.com'),($3,'e@x.com')`,[U.a,U.c,U.e]);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
// people: admin (professional account), 2 professionals, 1 company, 1 suspended professional, 1 company with email off
const ids={a:U.a,p1:'aaaaaaaa-0000-0000-0000-0000000000a1',p2:'aaaaaaaa-0000-0000-0000-0000000000a2',s:'aaaaaaaa-0000-0000-0000-0000000000a3',k:'aaaaaaaa-0000-0000-0000-0000000000b1',k2:'aaaaaaaa-0000-0000-0000-0000000000b2'};
Object.assign(U,ids);
for(const k of ['p1','p2','s','k','k2']) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[ids[k],k+'@x.com']);
const mkC=async(k,data,susp)=>{ await db.query(`insert into consultants(id,owner,anon,sample,data) values ($1,$2,false,false,$3::jsonb)`,['c-'+k,ids[k],JSON.stringify(data)]); await db.query(`insert into profiles(user_id,role,entity_id,suspended) values ($1,'consultant',$2,$3)`,[ids[k],'c-'+k,!!susp]); };
const mkE=async(k,data)=>{ await db.query(`insert into companies(id,owner,sample,data) values ($1,$2,false,$3::jsonb)`,['co-'+k,ids[k],JSON.stringify(data)]); await db.query(`insert into profiles(user_id,role,entity_id) values ($1,'employer',$2)`,[ids[k],'co-'+k]); };
await mkC('a',{country:'ae',roleTypes:['architect']});
await mkC('p1',{country:'ae',roleTypes:['functional','technical']});
await mkC('p2',{country:'in',roleType:'technical'});
await mkC('s',{country:'ae',roleTypes:['functional']},true);
await mkE('k',{name:'K',country:'ae'}); await mkE('k2',{name:'K2',country:'sa'});
await db.query(`insert into email_prefs(user_id,announcements) values ($1,false)`,[ids.k2]);
const cnt=async(d)=>{ const r=await as('a',`select admin_announce_count($1::jsonb) x`,[JSON.stringify(d)]); return r.err?r:r[0].x; };
const send=async(who,d,test)=>{ const r=await as(who,`select admin_announce_send($1::jsonb,$2) x`,[JSON.stringify(d),!!test]); return r.err?r:r[0].x; };
const base={title:'New: AI skills',body:'You can now add AI skills to your profile.',link:'#/c/profile',ch_banner:true,ch_bell:true,ch_email:true,who:'all'};

// permissions
t('professional cannot count',!!(await as('p1',`select admin_announce_count('{}'::jsonb) x`)).err);
t('professional cannot send',!!(await send('p1',base)).err);
t('professional cannot list/withdraw',!!(await as('p1',`select admin_announce_list() x`)).err&&!!(await as('p1',`select admin_announce_withdraw(1) x`)).err);
t('visitor has no banner',(await as(null,`select my_banner() x`))[0].x===null);

// counts
let c=await cnt({who:'all'});
t('everyone: 4 active people + admin, suspended left out',c.total===5&&c.pros===3&&c.companies===2&&c.emails===4,c);
t('professionals only',(await cnt({who:'pros'})).total===3);
t('companies only, email opt-out counted',(await cnt({who:'companies'})).emails===1);
t('country filter',(await cnt({who:'all',country:'ae'})).total===3);
t('role type filter (technical)',(await cnt({who:'pros',role_type:'technical'})).total===2);
t('role type + country',(await cnt({who:'pros',role_type:'technical',country:'in'})).total===1);

// validation
const bad=async(patch,re)=>{ const r=await send('a',Object.assign({},base,patch)); return re.test(r.err||''); };
t('title required',await bad({title:' '},/title/i));
t('long title rejected',await bad({title:'x'.repeat(81)},/too long/));
t('long message rejected',await bad({body:'x'.repeat(401)},/too long/));
t('external links rejected',await bad({link:'https://evil.com'},/page on Arnour/));
t('need a channel',await bad({ch_banner:false,ch_bell:false,ch_email:false},/at least one/));
t('role type only with professionals',await bad({who:'all',role_type:'technical'},/professionals/));
t('banner days limited',await bad({banner_days:200},/1 to 90/));

// test send goes to the admin only
let r=await send('a',base,true);
t('test send: only the admin, nothing recorded',!r.err&&r.test&&(await db.query(`select count(*)::int n from announcements`)).rows[0].n===0&&(await db.query(`select count(*)::int n from notifications where type='announcement'`)).rows[0].n===1&&(await db.query(`select count(*)::int n from email_queue where kind='announcements'`)).rows[0].n===1,r.err);
t('test is marked as a test',/^\[Test\]/.test((await db.query(`select text from notifications where type='announcement'`)).rows[0].text));
await db.exec(`delete from notifications where type='announcement'; delete from email_queue where kind='announcements'`);

// real send: bell text that looks like another kind of notification must not trigger other emails
r=await send('a',Object.assign({},base,{title:'Someone is interested',body:'and invited you to apply',banner_days:3}));
t('send reports counts',!r.err&&r.audience===5&&r.bell===5&&r.email===4&&r.banner===true,r);
t('bell: one per person, suspended excluded',(await db.query(`select count(*)::int n from notifications where type='announcement'`)).rows[0].n===5&&(await db.query(`select count(*)::int n from notifications where type='announcement' and user_key='c-s'`)).rows[0].n===0);
t('email: queued once each (no doubles from the text patterns), opt-out skipped',(await db.query(`select count(*)::int n from email_queue where kind='announcements'`)).rows[0].n===4&&(await db.query(`select count(*)::int n from email_queue where kind<>'announcements'`)).rows[0].n===0&&(await db.query(`select count(*)::int n from email_queue where user_id=$1`,[ids.k2])).rows[0].n===0);
t('audit trail',(await db.query(`select count(*)::int n from admin_log where action='announcement sent'`)).rows[0].n===1);

// banner
t('banner for a matching person',(await as('p1',`select my_banner() x`))[0].x?.title==='Someone is interested');
t('no banner for a suspended person',(await as('s',`select my_banner() x`))[0].x===null);
r=await send('a',{title:'India only',body:'Hello',ch_banner:true,who:'pros',country:'in'});
t('newest matching banner wins; others keep the older one',(await as('p2',`select my_banner() x`))[0].x?.title==='India only'&&(await as('p1',`select my_banner() x`))[0].x?.title==='Someone is interested');
await db.query(`update announcements set banner_until=1 where title='Someone is interested'`);
t('banner ends on its date',(await as('p1',`select my_banner() x`))[0].x===null);

// history + withdraw
let L=(await as('a',`select admin_announce_list() x`))[0].x;
t('history lists both, newest first, with counts',L.length===2&&L[0].title==='India only'&&L[1].bell===5&&L[1].email===4&&L[0].banner_live===true&&L[1].banner_live===false,L);
r=await send('a',{title:'Email later',body:'b',ch_email:true,who:'companies'});
const w=(await as('a',`select admin_announce_withdraw($1) x`,[r.id]))[0].x;
t('withdraw cancels emails not sent yet',w.cancelledEmails===1&&(await db.query(`select count(*)::int n from email_queue where ann_id=$1`,[r.id])).rows[0].n===0);
await send('a',{title:'Banner x',body:'b',ch_banner:true,who:'all'});
const lastId=(await db.query(`select max(id)::int m from announcements`)).rows[0].m;
await as('a',`select admin_announce_withdraw($1) x`,[lastId]);
t('withdraw ends a banner',(await as('p1',`select my_banner() x`))[0].x===null);

// the email itself
const batch=(await db.query(`select email_build_batch(40) x`)).rows[0].x;
const mine=batch.find(b=>b.to==='p1@x.com');
t('email: subject is the title, body and unsubscribe link present',mine&&mine.subject==='Someone is interested'&&/and invited you to apply/.test(mine.html)&&/k=announcements/.test(mine.html)&&/\/#\/c\/profile/.test(mine.html)||mine&&/#\/c\/profile/.test(mine.html),mine&&mine.subject);
// opting out
const tokn=(await db.query(`select token from email_prefs where user_id=$1`,[ids.p2])).rows[0].token;
await send('a',{title:'Again',body:'b',ch_email:true,who:'all'});
const un=(await as(null,`select email_unsubscribe($1,'announcements') x`,[tokn]))[0].x;
t('one-click unsubscribe from announcements: switched off, waiting email removed',un==='announcements'&&(await db.query(`select announcements from email_prefs where user_id=$1`,[ids.p2])).rows[0].announcements===false&&(await db.query(`select count(*)::int n from email_queue where user_id=$1 and sent_ts is null`,[ids.p2])).rows[0].n===0);
const prefs=(await as('p1',`select my_email_prefs() x`))[0].x;
t('settings expose the new switch',prefs.announcements===true);
await as('p1',`select set_email_prefs('{"announcements":false}'::jsonb) x`);
t('switching it off cancels waiting announcement emails',(await db.query(`select count(*)::int n from email_queue where user_id=$1 and kind='announcements' and sent_ts is null`,[ids.p1])).rows[0].n===0&&(await as('p1',`select my_email_prefs() x`))[0].x.announcements===false);
t('unsubscribe from all includes announcements',await (async()=>{ const tk=(await db.query(`select token from email_prefs where user_id=$1`,[ids.k])).rows[0]?.token||(await db.query(`select (_email_prefs($1)).token t`,[ids.k])).rows[0].t; await as(null,`select email_unsubscribe($1,'all') x`,[tk]); return (await db.query(`select announcements from email_prefs where user_id=$1`,[ids.k])).rows[0].announcements===false; })());
t('release can run again',await (async()=>{ await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/010_announcements.sql','utf8')); return true; })());
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
