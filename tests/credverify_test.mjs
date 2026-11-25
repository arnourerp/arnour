/* Release 57: the Credly reader (netlify/functions/cred-verify.js) against the real database functions, with Credly stubbed */
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
import {createRequire} from 'module'; const require=createRequire(import.meta.url);
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/037_credentials.sql','utf8'));
const fn=require(process.env.ARNOUR_ROOT+'/netlify/functions/cred-verify.js'), run=fn._run;
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
const q=async(s,a)=>(await db.query(s,a||[])).rows;
const U={a:'22222222-2222-2222-2222-222222222222',b:'33333333-3333-3333-3333-333333333333',co:'11111111-1111-1111-1111-111111111111'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); throw e;} }
await as('a',`select claim_profile('consultant','{"firstName":"Ahmed","lastName":"Salem","headline":"H","country":"ae","skills":[{"productId":"s4","moduleId":"fi"}]}'::jsonb)`);
await as('b',`select claim_profile('consultant','{"firstName":"Bela","lastName":"Other","headline":"H","country":"eg","skills":[{"productId":"s4","moduleId":"fi"}]}'::jsonb)`);
await as('co',`select claim_profile('employer','{"name":"Acme"}'::jsonb)`);
const secret='k'.repeat(40); const hash=crypto.createHash('sha256').update(secret).digest('hex');
await db.query(`update job_feed_worker set secret_hash=$1 where id=1`,[hash]);
/* the database as the function sees it: the person's own login, plus the secret for saving */
const TYPES={p_data:'jsonb',p_id:'uuid',p_secret:'text'};
const rpc=async(auth,name,args)=>{ const who=auth.jwt; const a=Object.assign({},args||{}); if(auth.secret) a.p_secret=auth.secret;
  const keys=Object.keys(a); const call=`select public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)+'::'+TYPES[k]).join(', ')}) x`;
  const r=await as(who,call,keys.map(k=>typeof a[k]==='object'?JSON.stringify(a[k]):a[k])); return r[0].x; };
const B1='23c377e2-e43b-41d5-9595-acc4c8cdf86f';
const BADGE=(o)=>Object.assign({state:'accepted',public:true,is_private_badge:false,issued_at:'2024-12-18T00:00:00.000Z',issued_at_date:'2024-12-18',expires_at:'2025-12-31T00:00:00.000Z',expires_at_date:'2025-12-31',issued_to:'Ahmed SALEM',
  issuer:{summary:'Issued by SAP',entities:[{label:'Issuer',entity:{type:'Organization',name:'SAP'}}]},badge_template:{name:'Positioning SAP Business AI – Record of Achievement',type_category:'Learning'}},o||{});
let asked=[]; let reply={status:200,json:{data:BADGE()}};
run.setDeps({fetchBadge:async(id)=>{asked.push(id);return typeof reply==='function'?reply(id):reply;},rpc,secret:()=>secret});

/* the pasted link */
const P=run.parseLink;
t('parse: the public badge link',P('https://www.credly.com/badges/'+B1+'/public_url').id===B1);
t('parse: without www, upper case, trailing text, with query',P('https://credly.com/badges/'+B1.toUpperCase()+'?x=1').id===B1&&P('  https://www.credly.com/badges/'+B1+'  ').id===B1);
t('parse: a link to another site is refused, also tricks',['https://example.com/badges/'+B1,'https://credly.com.evil.com/badges/'+B1,'https://evil.com/?u=https://www.credly.com/badges/'+B1,'ftp://www.credly.com/badges/'+B1,'javascript:alert(1)','credly','','https://www.credly.com@evil.com/badges/'+B1].every(x=>P(x).error==='not_credly'));
t('parse: a badge template or organisation page is not a badge',P('https://www.credly.com/org/sap/badge/positioning-sap-business-ai').error==='template');
t('parse: a Credly page that is not a badge',P('https://www.credly.com/users/ahmed-salem/badges').error==='not_credly');

/* the name check */
const N=run.nameMatches;
t('name: same',N('Ahmed Salem','Ahmed SALEM')===true&&N('Ahmed Salem','Salem, Ahmed')===true);
t('name: accents, extra middle name on the badge',N('Jose Garcia','José Antonio García')===true);
t('name: different or only half',N('Ahmed Salem','Ahmed Said')===false&&N('Ahmed Salem','Sara Salem')===false);
t('name: nothing to compare',N('','Ahmed')===null&&N('Ahmed Salem','')===null);

/* reading the answer */
const R=run.readBadge;
const r1=R({data:BADGE()}); t('read: wrapped or plain, the fields we keep',r1.title.startsWith('Positioning SAP')&&r1.issuer==='SAP'&&r1.kind==='Learning'&&r1.issued==='2024-12-18'&&r1.expires==='2025-12-31'&&r1.issuedTo==='Ahmed SALEM'&&R(BADGE()).title===r1.title,r1);
t('read: no expiry is fine',R(BADGE({expires_at:null,expires_at_date:null})).expires==='');
t('read: the badge picture is kept only from the Credly picture host over https',R(BADGE({image_url:'https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png'})).image==='https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png'&&R(BADGE({image_url:'http://images.credly.com/a/b.png'})).image===''&&R(BADGE({image_url:'https://evil.example.com/a.png'})).image===''&&R(BADGE({image_url:'https://images.credly.com.evil.com/a.png'})).image===''&&R(BADGE({image_url:'https://images.credly.com/a b.png'})).image===''&&R(BADGE({image_url:'javascript:alert(1)'})).image===''&&R(BADGE()).image==='');
t('read: dates fall back to the timestamps',R(BADGE({issued_at_date:null,expires_at_date:null})).issued==='2024-12-18');
t('read: private, pending, revoked',R(BADGE({public:false})).error==='private'&&R(BADGE({is_private_badge:true})).error==='private'&&R(BADGE({state:'pending'})).error==='not_found'&&R(BADGE({state:'revoked'})).error==='not_found');
t('read: nonsense',R(null).error==='unreachable'&&R({}).error==='unreachable'&&R({badge_template:{name:''}}).error==='unreachable'&&R(BADGE({issued_at:null,issued_at_date:null})).error==='unreachable');
t('read: the issuer from the summary when there is no entity',R(BADGE({issuer:{summary:'Issued by Microsoft'}})).issuer==='Microsoft');

/* the whole flow */
const V=async(who,body,sec)=>{ const ev={httpMethod:'POST',headers:{authorization:'Bearer '+(who||'')},body:JSON.stringify(body)}; return fn.handler(ev); };
const parse=(r)=>({code:r.statusCode,...JSON.parse(r.body)});
let r=parse(await V('a',{url:'https://www.credly.com/badges/'+B1+'/public_url'}));
t('verify: a badge is saved, with the Credly link for the owner',r.code===200&&r.cred.title.startsWith('Positioning')&&r.cred.nameMatch===true&&r.cred.url.includes(B1)&&r.cred.expires==='2025-12-31',r);
t('verify: Credly was asked for exactly that id and nothing else',asked.length===1&&asked[0]===B1,asked);
const credId=r.cred&&r.cred.id;
t('verify: the profile shows the summary, without link or name',JSON.stringify((await q(`select data->'creds' c from consultants where owner=$1`,[U.a]))[0].c).includes('Positioning')&&!JSON.stringify((await q(`select data->'creds' c from consultants where owner=$1`,[U.a]))[0].c).includes(B1));
asked=[]; reply={status:200,json:{data:BADGE({expires_at_date:'2026-12-31'})}};
r=parse(await V('a',{id:credId}));
t('check again: by our own id, renewed expiry is saved, same row',r.code===200&&r.cred.id===credId&&r.cred.expires==='2026-12-31'&&asked[0]===B1,r);
t('check again: someone else\'s id is refused',parse(await V('b',{id:credId})).code===404);
t('check again: a bad id',parse(await V('a',{id:'nope'})).code===400);
asked=[]; reply={status:200,json:{data:BADGE({issued_to:'Somebody Else'})}};
r=parse(await V('b',{url:'https://www.credly.com/badges/'+B1+'/public_url'}));
t('verify: a badge already claimed by someone else is refused',r.code===409&&r.error==='taken',r);
const B2='99999999-8888-7777-6666-555555555555';
r=parse(await V('b',{url:'https://www.credly.com/badges/'+B2}));
t('verify: a different name on the badge is saved with nameMatch false (the owner and the admin see it)',r.code===200&&r.cred.nameMatch===false,r);
reply={status:404}; r=parse(await V('b',{url:'https://www.credly.com/badges/00000000-0000-0000-0000-000000000000'})); t('verify: Credly says not found',r.code===404&&r.error==='not_found',r);
reply={status:200,json:{data:BADGE({public:false})}}; r=parse(await V('b',{url:'https://www.credly.com/badges/'+B2})); t('verify: private badge',r.code===422&&r.error==='private',r);
reply={status:200,json:{data:BADGE({state:'revoked'})}}; r=parse(await V('b',{url:'https://www.credly.com/badges/'+B2})); t('verify: revoked badge is not saved',r.code===422&&r.error==='not_found',r);
for(const s of [0,500,503,429]){ reply={status:s}; r=parse(await V('b',{url:'https://www.credly.com/badges/'+B2})); t('verify: Credly down or blocking ('+s+') says could not reach, saves nothing',r.code===502&&r.error==='unreachable',r); }
t('nothing was saved by the failures',(await q(`select count(*)::int n from credentials`))[0].n===2);
asked=[]; r=parse(await V('b',{url:'https://example.com/badges/'+B2})); t('verify: a link to another site never reaches Credly',r.code===422&&r.error==='not_credly'&&asked.length===0,r);
reply={status:200,json:{data:BADGE()}};
r=parse(await V('co',{url:'https://www.credly.com/badges/'+B2})); t('a company cannot',r.code===403&&r.error==='consultants_only',r);
r=parse(await fn.handler({httpMethod:'POST',headers:{},body:'{}'})); t('no login',r.code===401);
r=parse(await fn.handler({httpMethod:'POST',headers:{authorization:'Bearer x'},body:'{nope'})); t('bad body',r.code===400);
r=parse(await fn.handler({httpMethod:'POST',headers:{authorization:'Bearer x'},body:'x'.repeat(5000)})); t('huge body',r.code===413);
r=parse(await fn.handler({httpMethod:'PUT',headers:{},body:''})); t('wrong method',r.code===405);
r=parse(await fn.handler({httpMethod:'GET',headers:{}})); t('GET says it is switched on',r.code===200&&r.configured===true);
run.setDeps({secret:()=>''}); r=parse(await fn.handler({httpMethod:'GET',headers:{}})); t('GET without the secret says not configured',r.configured===false);
r=parse(await V('a',{url:'https://www.credly.com/badges/'+B2})); t('POST without the secret is refused',r.code===503&&r.error==='not_configured',r);
run.setDeps({secret:()=>'w'.repeat(40)}); r=parse(await V('a',{url:'https://www.credly.com/badges/'+B2})); t('a wrong secret saves nothing (service error)',r.code===502&&r.error==='service'&&(await q(`select count(*)::int n from credentials`))[0].n===2,r);
run.setDeps({secret:()=>secret});
/* limits */
let lim=null; for(let i=0;i<35;i++){ const rr=parse(await V('b',{url:'https://www.credly.com/badges/'+B2})); if(rr.code===429){lim=rr;break;} }
t('the hourly limit answers 429 limit',lim&&lim.error==='limit',lim);
console.log(fails?'FAILURES '+fails:'ALL OK'); process.exit(fails?1:0);
