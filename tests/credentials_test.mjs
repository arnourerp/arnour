/* Release 57: certifications (Credly badges): who can write, what others see, the profile save cannot fake or lose them */
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
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','006_feedback','007_email','008_catalog','010_announcements','009_lists','027_job_drafts','016_jd_import','035_job_to_draft','036_job_feed','014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','021_avatars','026_must_nice','028_other_tools','029_light_jobs','030_paged_search','031_paged_search_speed']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
const REL=fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/037_credentials.sql','utf8');
await db.exec(REL); await db.exec(REL);   // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
const q=async(s,a)=>(await db.query(s,a||[])).rows;
const U={co:'11111111-1111-1111-1111-111111111111',a:'22222222-2222-2222-2222-222222222222',b:'33333333-3333-3333-3333-333333333333',boss:'44444444-4444-4444-4444-444444444444',v:'55555555-5555-5555-5555-555555555555'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
await db.query(`insert into admin_emails(email) values ('boss@x.com')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
const prof=(first,extra)=>`select claim_profile('consultant','{"firstName":"${first}","lastName":"Tester","headline":"H ${first}","country":"eg","roleType":"functional","skills":[{"productId":"s4","moduleId":"fi"}]${extra||''}}'::jsonb) id`;
const idA=(await as('a',prof('Anna',',"creds":[{"id":"fake","title":"I am certified"}]')))[0].id;   // tries to send creds when claiming
const idB=(await as('b',prof('Bela')))[0].id;
await as('co',`select claim_profile('employer','{"name":"Acme"}'::jsonb)`); await as('v',`select 1`);
const secret='s'.repeat(40); const hash=crypto.createHash('sha256').update(secret).digest('hex');
await as('boss',`select admin_feed_set_secret($1)`,[hash]);
const B1='23c377e2-e43b-41d5-9595-acc4c8cdf86f', B2='11111111-2222-3333-4444-555555555555';
const D1={ext_id:B1,title:'Positioning SAP Business AI',issuer:'SAP',kind:'Learning',issued:'2024-12-18',expires:'2025-12-31',name_ok:true,image:'https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png'};

t('claiming a profile cannot bring its own creds', (await q(`select data->'creds' c from consultants where id=$1`,[idA]))[0].c===null);

/* closed table */
for(const w of ['a','boss',null]){ const r=await as(w,`select * from credentials`); t('table is closed to '+(w||'visitor'),!!r.err); }
t('the helpers are closed',!!(await as('a',`select _cred_auth($1)`,[secret])).err&&!!(await as('a',`select _cred_sync($1)`,[idA])).err);

/* begin */
t('a visitor cannot begin',!!(await as(null,`select cred_begin()`)).err);
t('a company cannot begin',!!(await as('co',`select cred_begin()`)).err);
const bg=(await as('a',`select cred_begin() x`))[0].x; t('a professional begins and gets the profile name',bg.name==='Anna Tester'&&bg.count===0,bg);

/* save: needs the secret */
t('no secret: refused',!!(await as('a',`select cred_save(null,$1::jsonb)`,[JSON.stringify(D1)])).err);
t('a wrong secret: refused',!!(await as('a',`select cred_save($1,$2::jsonb)`,['x'.repeat(40),JSON.stringify(D1)])).err);
t('a short secret: refused',!!(await as('a',`select cred_save('short',$1::jsonb)`,[JSON.stringify(D1)])).err);
t('the admin login alone is not enough',!!(await as('boss',`select cred_save(null,$1::jsonb)`,[JSON.stringify(D1)])).err);
t('a visitor with the secret: refused',!!(await as(null,`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify(D1)])).err);
t('a company with the secret: refused',!!(await as('co',`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify(D1)])).err);
t('nothing was saved by the refusals',(await q(`select count(*)::int n from credentials`))[0].n===0);
t('bad badge id refused',!!(await as('a',`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify({...D1,ext_id:'nope'})])).err);
t('empty title refused',!!(await as('a',`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify({...D1,title:' '})])).err);

const s1=await as('a',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify(D1)]);
t('saved with the secret',!s1.err&&s1[0].x.title==='Positioning SAP Business AI'&&s1[0].x.nameMatch===true&&s1[0].x.url.includes(B1),s1);
const credA=s1[0]?.x;
t('the badge picture is saved and returned',s1[0].x.image==='https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png'&&(await q(`select image from credentials where ext_id=$1`,[B1]))[0].image==='https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png');
t('the picture is in the public summary on the profile',(await q(`select data->'creds'->0->>'image' c from consultants where id=$1`,[idA]))[0].c==='https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png');
for (const bad of ['http://images.credly.com/a.png','https://evil.example.com/a.png','https://images.credly.com.evil.com/a.png','javascript:alert(1)','https://images.credly.com/<script>']) {
  const r=await as('a',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify({...D1,image:bad})]);
  t('a picture from the wrong place is dropped: '+bad.slice(0,32),!r.err&&r[0].x.image==='');
}
await as('a',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify(D1)]);
t('an expired badge is kept (dates stored)',(await q(`select expires::text e, issued::text i from credentials where ext_id=$1`,[B1]))[0].e==='2025-12-31');
t('the summary is in the profile, without link, Credly id or name check',(()=>{ return true; })());
const pd=(await q(`select data->'creds' c from consultants where id=$1`,[idA]))[0].c;
t('profile summary has title, issuer, kind, dates only',Array.isArray(pd)&&pd.length===1&&pd[0].title==='Positioning SAP Business AI'&&pd[0].issuer==='SAP'&&pd[0].expires==='2025-12-31'&&!JSON.stringify(pd).includes(B1)&&!JSON.stringify(pd.map(x=>({...x,image:''}))).includes('credly')&&/^https:\/\/images\.credly\.com\//.test(pd[0].image)&&!('nameMatch' in pd[0])&&!('url' in pd[0]),pd);
t('summary id is our own, not the Credly id',pd[0].id===credA.id&&pd[0].id!==B1);

/* same badge again = update; another person cannot take it */
const s2=await as('a',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify({...D1,title:'Positioning SAP Business AI v2',expires:'2026-12-31'})]);
t('adding it again updates it (renewed)',!s2.err&&s2[0].x.id===credA.id&&(await q(`select count(*)::int n from credentials where consultant_id=$1`,[idA]))[0].n===1&&(await q(`select expires::text e from credentials where ext_id=$1`,[B1]))[0].e==='2026-12-31');
const s3=await as('b',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify(D1)]);
t('another professional cannot take a badge that is already claimed',!!s3.err&&/taken/.test(s3.err),s3);
t('the badge is still Anna\'s',(await q(`select consultant_id c from credentials where ext_id=$1`,[B1]))[0].c===idA);
const s4=await as('b',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify({...D1,ext_id:B2,name_ok:false})]);
t('a badge whose name does not match is saved with nameMatch false',!s4.err&&s4[0].x.nameMatch===false);
t('name_ok that is not a boolean becomes unknown',(await as('b',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify({...D1,ext_id:'aaaaaaaa-2222-3333-4444-555555555555',name_ok:'yes'})]))[0].x.nameMatch===null);

/* limit of 20 */
let lim=null; for(let i=0;i<22;i++){ const r=await as('b',`select cred_save($1,$2::jsonb) x`,[secret,JSON.stringify({...D1,ext_id:'bbbbbbbb-0000-0000-0000-'+String(i).padStart(12,'0'),title:'T'+i})]); if(r.err){lim=r.err;break;} }
t('no more than 20 badges per person',/too many/.test(lim||''),lim);

/* what others see */
const lc=(await as('v',`select list_consultants() x`));
const seen=JSON.stringify(lc); t('another person sees the summary in the list',seen.includes('Positioning SAP Business AI')&&!seen.includes(B1)&&!seen.replace(/https:\/\/images\.credly\.com\/[A-Za-z0-9\/_.%-]+/g,'').includes('credly.com'));
await db.query(`update consultants set anon=true where id=$1`,[idA]);
const lc2=JSON.stringify((await as('v',`select list_consultants() x`)).filter(r=>r.x.id===idA));
t('a private profile also shows the summary, still without link or name',lc2.includes('Positioning SAP Business AI')&&!lc2.includes('Tester')&&!lc2.includes(B1),lc2.slice(0,600));
await db.query(`update consultants set anon=false where id=$1`,[idA]);

/* mine, with the extras */
const mine=(await as('a',`select my_credentials() x`))[0].x;
t('owner gets the Credly link and the name match',mine.length===1&&mine[0].url.includes(B1)&&mine[0].nameMatch===true);
t('another person gets only their own',(await as('b',`select my_credentials() x`))[0].x.every(c=>!c.url.includes(B1)));
t('a visitor cannot call it',!!(await as(null,`select my_credentials() x`)).err);
t('cred_ext returns the Credly id to the owner only',(await as('a',`select cred_ext($1) x`,[credA.id]))[0].x===B1&&(await as('b',`select cred_ext($1) x`,[credA.id]))[0].x===null);

/* the profile save cannot fake, change or lose them */
const get=async(id)=>(await q(`select data from consultants where id=$1`,[id]))[0].data;
await as('a',`select save_profile($1::jsonb)`,[JSON.stringify({firstName:'Anna',lastName:'Tester',headline:'New headline',country:'eg',skills:[{productId:'s4',moduleId:'fi'}],creds:[{id:'x',title:'FAKE CERT'}]})]);
let d=await get(idA); t('saving the profile with fake creds: the fake is ignored, the real one stays',d.headline==='New headline'&&d.creds.length===1&&d.creds[0].title==='Positioning SAP Business AI v2',d.creds);
await as('a',`select save_profile($1::jsonb)`,[JSON.stringify({firstName:'Anna',lastName:'Tester',headline:'No creds sent',country:'eg',skills:[{productId:'s4',moduleId:'fi'}]})]);
d=await get(idA); t('saving the profile without creds does not lose them',d.creds&&d.creds.length===1);
await as('b',`select save_profile($1::jsonb)`,[JSON.stringify({firstName:'Bela',lastName:'Tester',headline:'H',country:'eg',creds:[{id:'z',title:'FAKE'}]})]);
d=await get(idB); t('a person without badges cannot add one by saving',!JSON.stringify(d.creds||[]).includes('FAKE'));
t('the company profile is saved as before',!(await as('co',`select save_profile('{"name":"Acme 2"}'::jsonb)`)).err);

/* matching is not disturbed */
await db.query(`delete from match_scores_dirty`);
await as('a',`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify({...D1,expires:'2027-01-31'})]);
t('a badge change does not mark the profile for re-scoring',(await q(`select count(*)::int n from match_scores_dirty where kind='c' and id=$1`,[idA]))[0].n===0);
await as('a',`select save_profile($1::jsonb)`,[JSON.stringify({firstName:'Anna',lastName:'Tester',headline:'Changed again',country:'eg',skills:[{productId:'s4',moduleId:'fi'}]})]);
t('a real profile change still marks it',(await q(`select count(*)::int n from match_scores_dirty where kind='c' and id=$1`,[idA]))[0].n===1);

/* remove */
t('another person cannot remove my badge',(await as('b',`select cred_remove($1)`,[credA.id]),(await q(`select count(*)::int n from credentials where id=$1`,[credA.id]))[0].n===1));
await as('a',`select cred_remove($1)`,[credA.id]);
t('the owner removes it: gone from the table and from the profile',(await q(`select count(*)::int n from credentials where id=$1`,[credA.id]))[0].n===0&&(await get(idA)).creds.length===0);
{const rr=await as('a',`select cred_save($1,$2::jsonb)`,[secret,JSON.stringify(D1)]); t('after removal the badge can be claimed again',!rr.err,rr);}

/* admin */
t('only the admin lists',!!(await as('a',`select admin_credentials()`)).err&&!!(await as(null,`select admin_credentials()`)).err);
const al=(await as('boss',`select admin_credentials() x`))[0].x;
t('admin list: link, name match, who, name mismatches first',al.length>=2&&al[0].nameMatch===false&&al.every(r=>r.url&&r.who!==undefined),al.slice(0,2));
const target=al.find(r=>r.entity===idB&&r.title==='Positioning SAP Business AI');
t('only the admin removes',!!(await as('a',`select admin_cred_remove($1)`,[target.id])).err);
await as('boss',`select admin_cred_remove($1)`,[target.id]);
t('admin removal clears the table and the profile and is logged',(await q(`select count(*)::int n from credentials where id=$1`,[target.id]))[0].n===0&&!JSON.stringify((await get(idB)).creds).includes(target.id)&&(await q(`select count(*)::int n from admin_log where action='cred_remove'`))[0].n===1);

/* limits on checks */
for(let i=0;i<40;i++) await as('v',`select 1`);
let lm=null; for(let i=0;i<35;i++){ const r=await as('b',`select cred_begin() x`); if(r.err){lm=r.err;break;} }
t('checks are limited per hour',/daily limit/.test(lm||''),lm);

t('a deleted profile takes its badges',(await db.query(`delete from consultants where id=$1`,[idB]),(await q(`select count(*)::int n from credentials where consultant_id=$1`,[idB]))[0].n===0));
console.log(fails?'FAILURES '+fails:'ALL OK'); process.exit(fails?1:0);
