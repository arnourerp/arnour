/* Release 56: the Job feed reader (netlify/functions/job-feed.js) against the real database functions: page reading, drafts, notices, closing, limits, safety */
import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
import crypto from 'crypto';
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const ROOT=process.env.ARNOUR_ROOT;
const feedFn=require(ROOT+'/netlify/functions/job-feed.js'), run=feedFn._run;
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
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','016_jd_import','027_job_drafts','035_job_to_draft','036_job_feed']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',a:'33333333-3333-3333-3333-333333333333'};
for(const k in U) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[U[k],k+'@x.com']);
await db.query(`insert into admin_emails(email) values ('a@x.com')`);
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,String(JSON.stringify(x)).slice(0,500));} else console.log('ok  ',n); };
async function sql(who,q,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(q,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); throw e;} }
await sql('e',`select claim_profile('employer',$1::jsonb)`,[JSON.stringify({name:'Crescent',country:'eg',city:'Cairo'})]);
await sql('c',`select claim_profile('consultant',$1::jsonb)`,[JSON.stringify({firstName:'A',lastName:'B',headline:'H'})]);
const cid=(await db.query(`select id from companies where data->>'name'='Crescent'`)).rows[0].id;
const SECRET='k'.repeat(48), HASH=crypto.createHash('sha256').update(SECRET).digest('hex');
await sql('a',`select admin_feed_set_secret($1)`,[HASH]);
const LISTS={products:[{id:'s4onprem',name:'S/4HANA',modules:[{id:'fi',name:'FI'},{id:'mm',name:'MM'},{id:'abap',name:'ABAP'}]}],roleTypes:[{id:'functional',name:'Functional'},{id:'technical',name:'Technical'}],countries:[{id:'eg',name:'Egypt'}],industries:[],languages:[],jobTypes:['Full-time'],durations:['Permanent'],levels:['Senior']};
await sql('a',`select admin_feed_save_lists($1::jsonb)`,[JSON.stringify(LISTS)]);

/* the real database behind the function: admin login or the secret */
const calls=[];
const rpc=async(auth,fn,args)=>{
  calls.push(fn);
  const a=Object.assign({p_secret:auth.secret||null},args||{}); const names=Object.keys(a), vals=names.map(n=>{const v=a[n]; return v!==null&&typeof v==='object'?JSON.stringify(v):v;});
  const who=auth.jwt==='admin'?'a':auth.jwt==='company'?'e':null;
  const q=`select public.${fn}(${names.map((n,i)=>`${n} => $${i+1}${a[n]!==null&&typeof a[n]==='object'?'::jsonb':''}`).join(',')}) x`;
  const rows=await sql(who,q,vals); return rows[0].x;
};

/* the pretend web */
const BASE='https://crescent.example.com';
const page=(title,body)=>`<html><head><title>${title}</title></head><body><nav><a href="/">Home</a> <a href="/about">About us</a></nav><main><h1>${title}</h1>${body}</main><footer>x</footer></body></html>`;
const long='We are looking for an experienced consultant to join our team and deliver projects for our clients across the region. '.repeat(3);
const WEB={
 [BASE+'/careers']:`<html><body><nav><a href="/">Home</a><a href="/careers">Careers</a><a href="/about">About us</a><a href="mailto:hr@crescent.example.com">Mail</a></nav>
   <ul><li><a href="/jobs/101-sap-fico-consultant?utm_source=x">SAP FICO Consultant</a></li><li><a href="/jobs/102-abap-developer">ABAP Developer</a></li><li><a href="/jobs/103-office-manager">Office Manager</a></li>
   <li><a href="https://crescent.wd3.myworkdayjobs.com/en/job/XYZ">SAP BTP Architect</a></li><li><a href="https://www.linkedin.com/jobs/view/1">SAP on LinkedIn</a></li><li><a href="/jobs/104-finance-consultant">Finance Consultant</a></li><li><a href="/jobs/104-finance-consultant#apply">Apply now</a></li></ul><a href="/files/brochure.pdf">Brochure about jobs</a></body></html>`,
 [BASE+'/jobs/101-sap-fico-consultant']:page('SAP FICO Consultant',`<p>${long} SAP FI and CO configuration on S/4HANA, five years experience.</p>`),
 [BASE+'/jobs/102-abap-developer']:page('ABAP Developer',`<p>${long} ABAP development on S/4HANA.</p>`),
 [BASE+'/jobs/103-office-manager']:page('Office Manager',`<p>${long} Run the office.</p>`),
 [BASE+'/jobs/104-finance-consultant']:page('Finance Consultant',`<p>${long} Finance transformation using SAP FI.</p>`),
 'https://crescent.wd3.myworkdayjobs.com/en/job/XYZ':page('SAP BTP Architect',`<p>${long} SAP BTP.</p>`)
};
WEB[BASE+'/jobs/101-sap-fico-consultant?utm_source=x']=WEB[BASE+'/jobs/101-sap-fico-consultant'];
const fetcher=async(u)=>{ const h=u.href; if(WEB[h]==null) throw {code:'link_unreachable'}; return {html:WEB[h],url:h}; };
let modelCalls=0, modelMode='ok';
const model=async(text,L)=>{ modelCalls++;
  if(modelMode==='ai') return {error:'ai'};
  if(/Office Manager/.test(text)) return {error:'not_a_job'};
  if(/ABAP Developer/.test(text)) return {job:{title:'ABAP Developer',roleType:'technical',country:'eg',city:'Cairo',remote:false,employmentType:'Full-time',duration:'Permanent',level:'',minExp:0,certification:'',requires:[{productId:'s4onprem',moduleId:'abap',minProjects:2,orPrev:false,nice:false}],languages:[],preferredLangs:[],industries:[],specialties:[],minPrograms:0}};
  if(/BTP/.test(text)) return {job:{title:'SAP BTP Architect',roleType:'',country:'',requires:[],languages:[],preferredLangs:[],industries:[],specialties:[]}};
  return {job:{title:/Finance/.test(text)?'Finance Consultant':'SAP FICO Consultant',roleType:'functional',country:'eg',remote:false,employmentType:'Full-time',duration:'Permanent',level:'Senior',mustLevel:true,minExp:5,mustExp:true,certification:'',
    requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3,orPrev:false,nice:false},{productId:'s4onprem',moduleId:'mm',minProjects:0,orPrev:false,nice:true}],languages:['Arabic'],preferredLangs:[],industries:['Banking'],specialties:['rise'],minPrograms:0}};
};
run.setDeps({fetcher,jobPage:fetcher,model,rpc});

/* ---------- 1. reading pages ---------- */
let items=run.parseFeed(WEB[BASE+'/careers'],BASE+'/careers');
const titles=items.map(i=>i.title);
t('job links are found; menu, mail, file and "Apply now" links are not',titles.includes('SAP FICO Consultant')&&titles.includes('ABAP Developer')&&titles.includes('Office Manager')&&titles.includes('Finance Consultant')&&!titles.includes('Home')&&!titles.includes('About us')&&!titles.includes('Careers')&&!titles.includes('Apply now')&&!titles.some(x=>/brochure/i.test(x)),titles);
t('a job on the company\'s ATS host is found, LinkedIn is not',titles.includes('SAP BTP Architect')&&!titles.includes('SAP on LinkedIn'),titles);
t('tracking tags are removed from the key, the same job is not listed twice',items.find(i=>i.title==='SAP FICO Consultant').key===BASE+'/jobs/101-sap-fico-consultant'&&items.filter(i=>/104/.test(i.key)).length===1);
t('SAP jobs are flagged by title (FICO, ABAP, BTP yes; Office Manager and "Finance Consultant" no)',items.find(i=>i.title==='SAP FICO Consultant').sap&&items.find(i=>i.title==='ABAP Developer').sap&&items.find(i=>i.title==='SAP BTP Architect').sap&&!items.find(i=>i.title==='Office Manager').sap&&!items.find(i=>i.title==='Finance Consultant').sap,items.map(i=>[i.title,i.sap]));
const rss=`<?xml version="1.0"?><rss><channel><item><title>SAP MM Consultant</title><link>${BASE}/jobs/201</link><description>&lt;p&gt;${long} Materials management in SAP MM.&lt;/p&gt;</description></item><item><title>Driver</title><link>${BASE}/jobs/202</link><description>short</description></item></channel></rss>`;
items=run.parseFeed(rss,BASE+'/feed.xml');
t('an RSS feed gives titles, links and the text inside it',items.length===2&&items[0].sap&&items[0].body.length>150&&items[0].body.startsWith('Job title: SAP MM Consultant')&&!items[1].sap&&items[1].body==='',items);
const gh=JSON.stringify({jobs:[{id:1,title:'SAP ABAP Lead',absolute_url:BASE+'/j/1',content:'&lt;p&gt;'+long+' ABAP.&lt;/p&gt;'},{id:2,title:'Cook',absolute_url:BASE+'/j/2'}]});
items=run.parseFeed(gh,BASE+'/api/jobs');
t('a JSON feed (Greenhouse / Lever style) works',items.length===2&&items[0].sap&&items[0].body.length>150,items);
const ld=`<html><head><script type="application/ld+json">${JSON.stringify([{'@type':'JobPosting',title:'SAP Basis Admin',url:BASE+'/b1',description:'<p>'+long+' Basis</p>',hiringOrganization:'X'},{'@type':'JobPosting',title:'Sales Rep',url:BASE+'/b2',description:'<p>'+long+'</p>'}])}</script></head><body></body></html>`;
items=run.parseFeed(ld,BASE+'/careers');
t('several JobPosting blocks on one page become several roles with their text',items.length===2&&items[0].body.length>150&&items[0].sap&&!items[1].sap,items.map(i=>i.title));
const sm=`<?xml version="1.0"?><urlset><url><loc>${BASE}/jobs/sap-fi-consultant-1234</loc></url><url><loc>${BASE}/about</loc></url><url><loc>https://other.example.com/jobs/x-1</loc></url></urlset>`;
items=run.parseFeed(sm,BASE+'/sitemap.xml');
t('a sitemap gives only the job addresses of the same site, titled from the address',items.length===1&&items[0].title==='Sap Fi Consultant'&&items[0].sap,items);
let err=null; try{ run.parseFeed('<html><body><div id="app"></div><script src="app.js"></script></body></html>',BASE+'/careers'); }catch(e){ err=e.code; }
t('a page with no job links (loaded by scripts) says no_jobs',err==='no_jobs',err);
err=null; try{ run.parseFeed('{"a":1}',BASE+'/x'); }catch(e){ err=e.code; }
t('JSON with no jobs says no_jobs',err==='no_jobs');
t('looksSap understands the usual words',run.looksSap('Senior S/4HANA Finance')&&run.looksSap('Fiori developer')&&run.looksSap('SuccessFactors')&&!run.looksSap('Marketing manager')&&!run.looksSap('Assap team'));

/* ---------- 2. admin: connect, check, tick, read ---------- */
const fid=(await sql('a',`select admin_feed_add($1,$2) x`,[cid,BASE+'/careers']))[0].x;
const ADMIN={jwt:'admin'};
let r=await run.checkFeed(ADMIN,fid);
t('the first check finds the jobs: 5 listed, 3 SAP-looking offered, 2 set aside',r.status==='ok'&&r.found===5&&r.new===3,r);
t('nothing is read or drafted by the check',modelCalls===0&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===0);
await sql('a',`select admin_feed_select($1,$2::text[]) x`,[fid,[BASE+'/jobs/101-sap-fico-consultant',BASE+'/jobs/102-abap-developer','https://crescent.wd3.myworkdayjobs.com/en/job/XYZ']]);
const LL=require(ROOT+'/netlify/functions/jd-parse.js')._shared.readLists(LISTS);
const got=[]; for(let i=0;i<3;i++) got.push(await run.readNext(ADMIN,fid,LL,'key'));
const by=(st)=>got.filter(g=>g.status===st).map(g=>g.title).sort();
t('three roles are read: two become drafts, the one with no SAP skills is set aside',modelCalls===3&&by('drafted').join()==='ABAP Developer,SAP FICO Consultant'&&by('ignored').join()==='SAP BTP Architect',got);
t('the set-aside one says why, and nothing was drafted for it',got.find(g=>g.status==='ignored').error==='no_sap_skills'&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===2);
const fico=(await db.query(`select status,data,owner from jobs where data->>'title'='SAP FICO Consultant'`)).rows[0];
t('the draft is the company\'s, not live, and has the form fields (requires, Must flags, languages, industry)',fico&&fico.status==='draft'&&fico.owner===U.e&&fico.data.requires.length===2&&fico.data.requires[1].nice===true&&fico.data.requires[0].minProjects===3&&fico.data.mustLevel===true&&fico.data.mustExp===true&&fico.data.langMust===true&&fico.data.languages[0]==='Arabic'&&fico.data.industry==='Banking'&&fico.data.preferredSpecialties[0]==='rise'&&fico.data.employmentType==='Full-time'&&fico.data.duration==='Permanent'&&fico.data.city==='Cairo',fico&&fico.data);
t('the description is the page text, without links',/experienced consultant/.test(fico.data.description)&&!/http/.test(fico.data.description));
t('the technical role keeps its own project minimum',(await db.query(`select data from jobs where data->>'title'='ABAP Developer'`)).rows[0].data.requires[0].minProjects===2);
let s4=await run.readNext(ADMIN,fid,LL,'key');
t('when the batch is finished: done, and ONE notice goes to the company',s4.done===true&&(await db.query(`select text,link from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows.length===1,s4);
const nt=(await db.query(`select text from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows[0].text;
t('the notice says how many and names them',/2 new draft roles/.test(nt)&&/SAP FICO Consultant/.test(nt)&&/ABAP Developer/.test(nt),nt);
t('every read was counted against the daily AI budget',(await db.query(`select count(*)::int n from jd_imports where user_id='00000000-0000-0000-0000-000000000000' and status='ok'`)).rows[0].n===2);

/* ---------- 3. a read that fails ---------- */
await db.query(`update job_feeds set approved=true where id=$1`,[fid]);
delete WEB[BASE+'/jobs/104-finance-consultant']; await sql('a',`select admin_feed_select($1,$2::text[]) x`,[fid,[]]);
await db.query(`update job_feed_items set state='selected', tries=0 where feed_id=$1 and title='Finance Consultant'`,[fid]);
let f1=await run.readNext(ADMIN,fid,LL,'key');
t('a page that cannot be opened is retried later (not given up at once)',f1.status==='retry'&&(await db.query(`select state,tries from job_feed_items where title='Finance Consultant'`)).rows[0].state==='selected',f1);
await run.readNext(ADMIN,fid,LL,'key'); await run.readNext(ADMIN,fid,LL,'key'); const f4=await run.readNext(ADMIN,fid,LL,'key');
t('after three tries it is marked failed (gave_up), and the admin can put it back',(await db.query(`select state,error from job_feed_items where title='Finance Consultant'`)).rows[0].state==='failed'&&f4.done===true);
modelMode='ai'; WEB[BASE+'/jobs/104-finance-consultant']=page('Finance Consultant',`<p>${long} SAP FI.</p>`);
await sql('a',`select admin_feed_retry($1) x`,[fid]);
const a1=await run.readNext(ADMIN,fid,LL,'key');
t('an AI problem is a retry too, and drafts nothing',a1.status==='retry'&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===2,a1);
modelMode='ok';
const a2=await run.readNext(ADMIN,fid,LL,'key');
t('and works when the AI is back',a2.status==='drafted'&&(await db.query(`select count(*)::int n from jobs where company_id=$1`,[cid])).rows[0].n===3,a2);
await run.readNext(ADMIN,fid,LL,'key');

/* ---------- 4. the schedule ---------- */
await db.query(`update job_feeds set last_checked_at=now()-interval '2 days' where id=$1`,[fid]);
delete WEB[BASE+'/jobs/102-abap-developer'];                                 // an old role disappears from the page
WEB[BASE+'/careers']=WEB[BASE+'/careers'].replace('<li><a href="/jobs/102-abap-developer">ABAP Developer</a></li>','<li><a href="/jobs/105-sap-sd-consultant">SAP SD Consultant</a></li>');
WEB[BASE+'/jobs/105-sap-sd-consultant']=page('SAP SD Consultant',`<p>${long} SAP SD sales and distribution, S/4HANA.</p>`);
await db.query(`update jobs set status='open' where data->>'title'='ABAP Developer'`);   // the company published it
const mc0=modelCalls; const notes0=(await db.query(`select count(*)::int n from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows[0].n;
let k=await run.tick(SECRET,'key',{budgetMs:60000});
t('the tick checks the due feed with the secret, finds the new SAP role and drafts it without asking',k.checked&&k.checked.status==='ok'&&k.checked.new===1&&k.read>=1&&k.drafted===1&&modelCalls===mc0+1,k);
t('the new role is a draft of the company; the company is told once more',(await db.query(`select status from jobs where data->>'title'='SAP FICO Consultant' or data->>'title'='SAP SD Consultant'`)).rows.length>=2&&(await db.query(`select count(*)::int n from notifications where user_key=$1 and text like '%job feed%'`,[cid])).rows[0].n===notes0+1);
t('the last tick time is recorded',(await sql('a',`select admin_feed_worker_status() x`))[0].x.lastTick!==null);
k=await run.tick(SECRET,'key',{budgetMs:60000});
t('the next tick has nothing to do (the feed was just checked)',k.checked===null&&k.read===0,k);
await db.query(`update job_feeds set last_checked_at=now()-interval '2 days' where id=$1`,[fid]);
const k1=await run.tick(SECRET,'key',{budgetMs:60000});
await db.query(`update job_feeds set last_checked_at=now()-interval '2 days' where id=$1`,[fid]);
const k2=await run.tick(SECRET,'key',{budgetMs:60000});
t('a role gone from the page for two daily checks is closed if it was live',(await db.query(`select status from jobs where data->>'title'='ABAP Developer'`)).rows[0].status==='closed'&&k1.checked.closed+k2.checked.closed===1,[k1,k2]);
t('a draft that vanished stays a draft (nothing is deleted)',(await db.query(`select count(*)::int n from jobs where status='draft' and company_id=$1`,[cid])).rows[0].n>=1);

/* ---------- 5. safety ---------- */
const f2=(await sql('a',`select admin_feed_add($1,'https://127.0.0.1/jobs') x`,[cid]))[0].x;
let fetchCalls=0; run.setDeps({fetcher:async(u)=>{fetchCalls++;return fetcher(u);},jobPage:fetcher,model,rpc});
r=await run.checkFeed(ADMIN,f2);
t('a feed on a private address is never opened and is recorded as a bad link',r.status==='failed'&&r.error==='bad_link'&&fetchCalls===0&&(await sql('a',`select admin_feed_list() x`))[0].x.find(x=>x.id===f2).lastError==='bad_link',r);
const f3=(await sql('a',`select admin_feed_add($1,'https://www.linkedin.com/company/crescent/jobs') x`,[cid]))[0].x;
r=await run.checkFeed(ADMIN,f3);
t('a LinkedIn link is refused',r.status==='failed'&&r.error==='blocked_site'&&fetchCalls===0,r);
run.setDeps({fetcher:async()=>{throw {code:'link_blocked'};},jobPage:fetcher,model,rpc});
const f5=(await sql('a',`select admin_feed_add($1,'https://careers.example.org/open') x`,[cid]))[0].x;
r=await run.checkFeed(ADMIN,f5);
t('a site that refuses us is recorded with its reason',r.status==='failed'&&r.error==='link_blocked');
run.setDeps({fetcher,jobPage:fetcher,model,rpc});
let denied=null; try{ await run.checkFeed({secret:'z'.repeat(48)},fid); }catch(e){ denied=e.message; }
t('a wrong secret gets nothing',/not allowed/.test(denied||''),denied);

/* ---------- 6. the function itself (admin screen calls) ---------- */
process.env.ANTHROPIC_API_KEY='k';
const H=(m,hd,body)=>feedFn.handler({httpMethod:m,headers:hd||{},body:body==null?undefined:JSON.stringify(body)});
t('GET says whether the AI key is set',JSON.parse((await H('GET')).body).configured===true);
t('POST without a login is refused',(await H('POST',{},{action:'check',feedId:fid})).statusCode===401);
t('a bad action or id is refused',(await H('POST',{authorization:'Bearer admin'},{action:'x',feedId:fid})).statusCode===400&&(await H('POST',{authorization:'Bearer admin'},{action:'check',feedId:'nope'})).statusCode===400);
t('a company login (not the admin) is refused by the database',(await H('POST',{authorization:'Bearer company'},{action:'check',feedId:fid})).statusCode===403);
await db.query(`update job_feeds set last_checked_at=now() where id=$1`,[fid]);
const ck=await H('POST',{authorization:'Bearer admin'},{action:'check',feedId:fid});
t('the admin Check works and returns counts',ck.statusCode===200&&JSON.parse(ck.body).status==='ok',ck.body);
const rd=await H('POST',{authorization:'Bearer admin'},{action:'read',feedId:fid,lists:LISTS});
t('the admin Read works (here: nothing waiting)',rd.statusCode===200&&typeof JSON.parse(rd.body).done==='boolean',rd.body);
delete process.env.ANTHROPIC_API_KEY;
t('Read without the AI key says so',(await H('POST',{authorization:'Bearer admin'},{action:'read',feedId:fid,lists:LISTS})).statusCode===503);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
