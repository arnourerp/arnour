/* Release 50 (paged role search): the pages the database returns equal what the website's own filter and sort code
   produces from the full list, for visitors, professionals and companies; stored scores stay up to date. */
import {makeBackend} from './harness.mjs'; import fs from 'fs'; import vm from 'vm';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
for (const f of ['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','026_must_nice','029_light_jobs','030_paged_search','030_paged_search']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
await db.exec(`delete from jobs; delete from consultants where owner is null; delete from match_scores_dirty;`); /* start from an empty board: only the roles made here */

/* ---------- the website's own code in a sandbox ---------- */
const stub=new Proxy(function(){}, {get:(_,k)=>k===Symbol.toPrimitive?()=>'':stub, apply:()=>stub, construct:()=>stub, set:()=>true});
const ctx={ARNOUR_CONFIG:{}, document:stub, addEventListener(){}, location:{hash:'',href:''}, matchMedia:()=>({matches:false}),
  localStorage:{getItem(){return null},setItem(){},removeItem(){}}, navigator:{}, setTimeout, clearTimeout, console, Intl, Date, Math, JSON, Object, Array, Number, String, RegExp};
ctx.window=ctx; vm.createContext(ctx);
for(const f of ['js/catalog.js','js/core.js','js/views-consultant.js']) vm.runInContext(fs.readFileSync(ROOT+'/'+f,'utf8').replace(/^const APP = window.APP/m,'var APP = window.APP'),ctx,{filename:f});
const APP=ctx.APP;
const catalog=(await db.query(`select get_catalog() x`)).rows[0].x, lists=(await db.query(`select get_lists() x`)).rows[0].x;
t('catalog and lists load into the website code',APP.applyCatalog(catalog)&&APP.applyLists(lists));

/* ---------- people ---------- */
const U={coA:'11111111-0000-0000-0000-000000000001',coB:'22222222-0000-0000-0000-000000000002',coR:'55555555-0000-0000-0000-000000000005',pro:'33333333-0000-0000-0000-000000000003',pro2:'44444444-0000-0000-0000-000000000004'};
for(const k of Object.keys(U)) await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${k?U[k]:''}',false); set role ${k?'authenticated':'anon'};`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
const claim=async(k,role,data)=>(await as(k,`select claim_profile($1,$2::jsonb) x`,[role,JSON.stringify(data)]))[0].x;
const E={coA:await claim('coA','employer',{name:'Crescent Retail',industry:'Retail',country:'ae',companyType:'customer'}),
         coB:await claim('coB','employer',{name:'Dune Partners',industry:'IT',country:'sa',companyType:'partner'}),
         coR:await claim('coR','employer',{name:'Oasis Staffing',industry:'IT',country:'eg',companyType:'recruiter'})};
let seed=20261115; const rnd=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let x=Math.imul(seed^seed>>>15,1|seed); x=x+Math.imul(x^x>>>7,61|x)^x; return ((x^x>>>14)>>>0)/4294967296; };
const pick=a=>a[Math.floor(rnd()*a.length)], some=(a,n)=>{ const o=[]; for(let i=0;i<n;i++){ const v=pick(a); if(o.indexOf(v)<0) o.push(v);} return o; };
const products=catalog.products.map(p=>({id:p.id,mods:(p.modules||[]).map(m=>m.id)})).filter(p=>p.mods.length);
const core=products.filter(p=>['s4onprem','ecc','s4public'].indexOf(p.id)>=0);
const inds=['Manufacturing & Industrial','Retail & Consumer','Banking & Financial Services','Oil, Gas & Energy','Public Sector','Healthcare'];
const langs=['English','Arabic','French','German'];
const countryIds=lists.countries.map(c=>c.id), regionIds=lists.regions.map(r=>r[0]||r.id), cities=['Dubai','Cairo','Riyadh','Munich','Mumbai','Doha'];
const RTS=['functional','technical','basis','architect','delivery','support','keyuser','junior'];
const titles=['SAP FICO Consultant','SAP Basis Administrator','SAP Solution Architect','Project Manager SAP rollout','Junior SAP trainee','Key User SAP SD','SAP ABAP Developer','AMS Support Lead','SAP Consultant','Programme Director S/4HANA','Business Analyst','SAP DevOps Engineer','EWM Lead Cairo','Treasury Specialist'];
const types=['Full-time','Contract','Freelance'];
function mkSkills(){ const n=1+Math.floor(rnd()*4), o=[]; for(let i=0;i<n;i++){ const p=rnd()<0.75?pick(core):pick(products); const k={productId:p.id,moduleId:rnd()<0.12?'*':pick(p.mods)}; if(rnd()<0.85) k.projects=Math.floor(rnd()*12); o.push(k);} return o; }
function mkJob(i){ const j={title:pick(titles)+' '+i, requires:mkSkills().map(k=>{ const r={productId:k.productId,moduleId:k.moduleId}; if(rnd()<0.4) r.minProjects=1+Math.floor(rnd()*4); if(rnd()<0.2) r.nice=true; return r; }), description:'Role '+i+' text. '.repeat(20)};
  if(rnd()<0.6) j.roleType=pick(RTS);
  if(rnd()<0.9) j.country=pick(countryIds); if(rnd()<0.6) j.city=pick(cities);
  if(rnd()<0.9) j.employmentType=pick(types);
  if(rnd()<0.6) j.level=pick(['Junior','Mid','Senior']);
  if(rnd()<0.5) j.remote=rnd()<0.8?true:false;
  if(rnd()<0.5) j.industries=some(inds,1+Math.floor(rnd()*2)); else if(rnd()<0.4) j.industry=pick(inds);
  if(rnd()<0.4) j.certification=pick(['preferred','required']);
  if(rnd()<0.4) j.languages=some(langs,1+Math.floor(rnd()*2)); if(rnd()<0.3) j.preferredLangs=some(langs,1);
  if(rnd()<0.5) j.minExp=Math.floor(rnd()*12);
  return j; }
const NOW=Date.now(); const N=140;
for(let i=0;i<N;i++){
  const owner=pick(['coA','coA','coB','coR']); const j=mkJob(i); const conf=owner==='coA'&&rnd()<0.2;
  if(conf) j.confidential=true;
  await as(owner,`select save_job($1,$2::jsonb)`,['j'+i,JSON.stringify(j)]);
  const ext=rnd()<0.25; /* imported roles: employer name and source inside the role */
  if(ext) await db.query(`update jobs set data = data || $2::jsonb where id=$1`,['j'+i,JSON.stringify({external:true,extEmployer:pick(['Acme Gulf','Nile Motors','Atlas Bank']),extSource:pick(['Company career page','Recruiter posting','Staffing agency site']),applyUrl:'https://x.test/'+i})]);
  /* spread the posted time over 120 days, every role a different time */
  await db.query(`update jobs set posted_ts=$2 where id=$1`,['j'+i,NOW-Math.floor(rnd()*120*864e5)-i*1000-3600e3]);
}
await db.query(`update jobs set status='closed' where id in ('j3','j4','j5')`);
await db.query(`update jobs set status='draft' where id in ('j6','j7')`);
const proId=await claim('pro','consultant',{firstName:'Pia',lastName:'Pro',anon:false,country:'ae',languages:['English','Arabic'],roleTypes:['functional','technical'],yearsExp:9,level:'Senior',skills:[{productId:'ecc',moduleId:'fi',projects:5},{productId:'s4onprem',moduleId:'fi',projects:3},{productId:'s4onprem',moduleId:'co',projects:2}],industries:['Retail & Consumer'],savedJobIds:['j20','j21']});
const pro2Id=await claim('pro2','consultant',{firstName:'Tom',lastName:'Two',anon:false,country:'eg',roleTypes:['basis'],yearsExp:3,level:'Mid',skills:[{productId:'ecc',moduleId:'mm',projects:1}]});
await db.query(`update jobs set status='open', data = data - 'external' - 'extEmployer' - 'extSource' - 'applyUrl' where id='j3'`); await as('pro',`select apply_to_job('j3','hi')`); await db.query(`update jobs set status='closed' where id='j3'`);
await as('coA',`select invite_to_job((select id from jobs where owner='${U.coA}' and status='open' limit 1),$1)`,[proId]).catch(()=>{});
await db.exec(`select public.match_scores_run(500); select public.match_scores_run(500);`);
t('every professional has a stored score for every open role',(await db.query(`select (select count(*) from match_scores)::int s, (select count(*) from jobs where status='open')::int*(select count(*) from consultants)::int w, (select count(*) from match_scores_dirty)::int d`)).rows.every(r=>r.s===r.w&&r.d===0));

/* ---------- helpers: what the website would do with the full list, and all pages from the database ---------- */
async function client(who){ /* the data a browser of this person holds today */
  const jobs=(await as(who,`select list_jobs_light() x`)).map(r=>r.x), cos=(await as(who,`select list_companies() x`)).map(r=>r.x);
  if(!APP.db) APP.db={consultants:{},conversations:{},intros:{},notifications:{},session:null}; APP.db.jobs={}; jobs.forEach(j=>{ APP.db.jobs[j.id]=j; }); APP.db.companies={}; cos.forEach(c=>{ APP.db.companies[c.id]=c; });
  return jobs; }
async function pages(who,f,sort,size=17){ const out=[]; let total=null, first=null;
  for(let off=0;;off+=size){ const p=(await as(who,`select list_jobs_page($1::jsonb,$2,$3,$4) x`,[JSON.stringify(f),sort,size,off]))[0].x; if(first===null) first=p; total=p.total; out.push(...p.rows); if(p.rows.length<size) break; if(off>2000) break; }
  return {rows:out,total,first}; }
const F0=()=>({types:[],region:'all',roleType:'',product:'',module:'',country:'',levels:[],workMode:'',industries:[],cert:'',lang:'',posted:'',direct:false,q:'',sort:'match'});
const words=['sap','fico','lead','cairo','dubai','acme','crescent','dune','oasis','fi','any','module','basis','egypt','retail','7','architect sap','gulf acme','zzz'];
function rndFilter(){ const f=F0(); const k=1+Math.floor(rnd()*3);
  for(let i=0;i<k;i++){ const w=Math.floor(rnd()*13);
    if(w===0) f.types=some(types,1+Math.floor(rnd()*2)); else if(w===1) f.region=pick(regionIds); else if(w===2) f.roleType=pick(RTS);
    else if(w===3){ const p=pick(core); f.product=p.id; if(rnd()<0.6) f.module=pick(p.mods); } else if(w===4) f.country=pick(countryIds);
    else if(w===5) f.levels=some(['Junior','Mid','Senior'],1+Math.floor(rnd()*2)); else if(w===6) f.workMode=pick(['remote','onsite']);
    else if(w===7) f.industries=some(inds,1+Math.floor(rnd()*2)); else if(w===8) f.cert=pick(['none','preferred','required']);
    else if(w===9) f.lang=pick(langs); else if(w===10) f.posted=pick(['7','30','90']); else if(w===11) f.direct=true; else f.q=pick(words); }
  return f; }
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);

/* ---------- rows: every page row equals the light list row ---------- */
for (const who of [null,'pro','coA','coB']) {
  const jobs=await client(who), open=jobs.filter(j=>j.status==='open'), byId=Object.fromEntries(jobs.map(j=>[j.id,j]));
  const pg=await pages(who,{},'newest');
  t((who||'visitor')+': all pages together are exactly the open roles of the full list',same(pg.rows.map(r=>r.id).sort(),open.map(j=>j.id).sort())&&pg.total===open.length,[pg.total,open.length]);
  const norm=(x)=>{ const c=Object.assign({},x); delete c.ms; return JSON.stringify(Object.keys(c).sort().map(k=>[k,c[k]])); };
  t((who||'visitor')+': each row is identical to the full list row',pg.rows.every(r=>norm(r)===norm(byId[r.id])));
  t((who||'visitor')+': newest first',same(pg.rows.map(r=>r.id),open.slice().sort((a,b)=>b.postedTs-a.postedTs).map(j=>j.id)));
  t((who||'visitor')+': no page repeats or skips a role',new Set(pg.rows.map(r=>r.id)).size===pg.rows.length);
}

/* ---------- filters: 300 random filter sets, three kinds of viewer ---------- */
let bad=[], checked=0, nonEmpty=0;
for (const who of [null,'pro','coB']) {
  const jobs=await client(who), open=jobs.filter(j=>j.status==='open');
  const c=who==='pro'?(await db.query(`select data from consultants where id=$1`,[proId])).rows[0].data:null;
  for(let i=0;i<100;i++){ const f=rndFilter(); APP.state.jobFilters=f;
    const want=APP.applyJobFilters(c,open).slice().sort((a,b)=>b.postedTs-a.postedTs).map(j=>j.id);
    const got=await pages(who,f,'newest',50); checked++; if(want.length) nonEmpty++;
    if(!same(got.rows.map(r=>r.id),want)||got.total!==want.length) bad.push({who:who||'visitor',f:Object.fromEntries(Object.entries(f).filter(([k,v])=>v&&!(Array.isArray(v)&&!v.length)&&v!=='all'&&k!=='sort')),want:want.length,got:got.rows.length,total:got.total,extra:got.rows.map(r=>r.id).filter(x=>!want.includes(x)).slice(0,3),missing:want.filter(x=>!got.rows.some(r=>r.id===x)).slice(0,3)});
  }
}
t('filters: '+checked+' random filter sets give the same roles in the same order as the website code ('+nonEmpty+' with results)',bad.length===0&&nonEmpty>checked*0.4,bad.slice(0,4));
/* each filter on its own, so none is left untested by chance */
{ const jobs=await client('pro'), open=jobs.filter(j=>j.status==='open'); let one=[];
  const singles=[{types:['Contract']},{region:regionIds[0]},{roleType:'architect'},{product:'ecc'},{product:'s4onprem',module:'fi'},{country:countryIds[0]},{levels:['Senior']},{workMode:'remote'},{workMode:'onsite'},{industries:[inds[1]]},{cert:'none'},{cert:'required'},{lang:'Arabic'},{posted:'30'},{direct:true},{q:'acme'},{q:'crescent'},{q:'any module'},{q:'SAP  lead'},{q:'dune'}];
  for(const s of singles){ const f=Object.assign(F0(),s); APP.state.jobFilters=f; const want=APP.applyJobFilters(null,open).map(j=>j.id).sort(); const got=(await pages('pro',f,'newest',50)).rows.map(r=>r.id).sort(); if(!same(got,want)) one.push([s,want.length,got.length]); }
  t('filters: each of the '+singles.length+' single filters matches the website code',one.length===0,one); }
t('keyword: a confidential company\'s name does not find its role; a named company\'s does',await (async()=>{ const conf=(await db.query(`select count(*)::int n from jobs where status='open' and confidential and owner=$1 and not coalesce((data->>'external')::boolean,false)`,[U.coA])).rows[0].n; const r=(await pages('pro',{q:'crescent'},'newest',50)).rows; return conf>0&&r.length>0&&r.every(x=>x.confidential!==true); })());

/* ---------- best match first ---------- */
{ const jobs=await client('pro'), open=jobs.filter(j=>j.status==='open'); const c=(await db.query(`select data from consultants where id=$1`,[proId])).rows[0].data;
  const pg=await pages('pro',{},'match',20);
  const cs=pg.rows.map(r=>APP.matchScore(c,APP.db.jobs[r.id]));
  t('match sort: the stored score on every row equals the website score',pg.rows.every((r,i)=>r.ms===cs[i]),pg.rows.filter((r,i)=>r.ms!==cs[i]).slice(0,3).map(r=>[r.id,r.ms]));
  t('match sort: best first, all open roles, none twice',cs.every((s,i)=>i===0||cs[i-1]>=s)&&pg.rows.length===open.length&&new Set(pg.rows.map(r=>r.id)).size===open.length&&pg.first.sort==='match');
  t('match sort: equal scores are ordered newest first',pg.rows.every((r,i)=>i===0||pg.rows[i-1].ms!==r.ms||pg.rows[i-1].postedTs>r.postedTs));
  const f=Object.assign(F0(),{product:'ecc'}); APP.state.jobFilters=f; const want=APP.applyJobFilters(c,open).map(j=>j.id).sort(); const got=await pages('pro',f,'match',10);
  t('match sort with a filter: same roles as the website, best first',same(got.rows.map(r=>r.id).sort(),want)&&got.rows.every((r,i)=>i===0||got.rows[i-1].ms>=r.ms));
  const v=await pages(null,{},'match',20), co=await pages('coA',{},'match',20);
  t('visitors and companies get newest first and no score',v.first.sort==='newest'&&co.first.sort==='newest'&&v.rows.every(r=>!('ms' in r))&&co.rows.every(r=>!('ms' in r)));
  t('visitors still get no apply link or pay',v.rows.every(r=>!('applyUrl' in r)&&!('rateMin' in r))); }
t('page size is limited to 50 and never below 1',(await as(null,`select list_jobs_page('{}'::jsonb,'newest',500,0) x`))[0].x.rows.length===50&&(await as(null,`select list_jobs_page('{}'::jsonb,'newest',0,0) x`))[0].x.rows.length===1);

/* ---------- scores stay up to date ---------- */
{ const c0=(await db.query(`select data from consultants where id=$1`,[proId])).rows[0].data;
  const c1=Object.assign({},c0,{skills:[{productId:'ecc',moduleId:'mm',projects:6},{productId:'ecc',moduleId:'sd',projects:4}],roleTypes:['functional']});
  await as('pro',`select save_profile($1::jsonb)`,[JSON.stringify(c1)]);
  t('a profile change marks that professional for re-scoring',(await db.query(`select count(*)::int n from match_scores_dirty where kind='c' and id=$1`,[proId])).rows[0].n===1);
  await client('pro'); const cNow=(await db.query(`select data from consultants where id=$1`,[proId])).rows[0].data;
  const pg=await pages('pro',{},'match',25);
  t('their next page is already re-scored (no waiting for the worker)',pg.rows.every(r=>r.ms===APP.matchScore(cNow,APP.db.jobs[r.id]))&&(await db.query(`select count(*)::int n from match_scores_dirty where kind='c' and id=$1`,[proId])).rows[0].n===0);
  const jid=pg.rows[pg.rows.length-1].id; const jd=(await db.query(`select data, owner from jobs where id=$1`,[jid])).rows[0];
  const who=Object.keys(U).find(k=>U[k]===jd.owner); const nd=Object.assign({},jd.data,{requires:[{productId:'ecc',moduleId:'mm'}],roleType:'functional'}); delete nd.level; delete nd.minExp; delete nd.languages; delete nd.certification;
  await as(who,`select save_job($1,$2::jsonb)`,[jid,JSON.stringify(nd)]);
  t('a role change marks that role',(await db.query(`select count(*)::int n from match_scores_dirty where kind='j' and id=$1`,[jid])).rows[0].n===1);
  const ran=(await db.query(`select public.match_scores_run() x`)).rows[0].x; await client('pro');
  const s=(await db.query(`select score from match_scores where consultant_id=$1 and job_id=$2`,[proId,jid])).rows[0].score;
  t('the worker re-scores it for every professional',ran>=1&&s===APP.matchScore(cNow,APP.db.jobs[jid])&&(await db.query(`select count(*)::int n from match_scores where job_id=$1`,[jid])).rows[0].n===(await db.query(`select count(*)::int n from consultants`)).rows[0].n,[ran,s]);
  await db.query(`update jobs set status='closed' where id=$1`,[jid]); await db.query(`select public.match_scores_run()`);
  t('a closed role keeps no scores and leaves the pages',(await db.query(`select count(*)::int n from match_scores where job_id=$1`,[jid])).rows[0].n===0&&!(await pages('pro',{},'match',50)).rows.some(r=>r.id===jid));
  await db.query(`delete from jobs where id='j30'`);
  t('a deleted role takes its scores with it',(await db.query(`select count(*)::int n from match_scores where job_id='j30'`)).rows[0].n===0);
  t('a text-only edit still leaves the scores right',await (async()=>{ const r=(await db.query(`select id, data, owner from jobs where status='open' limit 1`)).rows[0]; const k=Object.keys(U).find(x=>U[x]===r.owner); await as(k,`select save_job($1,$2::jsonb)`,[r.id,JSON.stringify(Object.assign({},r.data,{description:'new text'}))]); await db.query(`select public.match_scores_run()`); await client('pro'); return (await db.query(`select score from match_scores where consultant_id=$1 and job_id=$2`,[proId,r.id])).rows[0].score===APP.matchScore(cNow,APP.db.jobs[r.id]); })());
  t('two workers at once: the second one steps aside',(await db.query(`select public.match_scores_run() x`)).rows[0].x===0); }

/* ---------- specific roles and the start-up bundle ---------- */
{ const ids=async(who,a)=>(await as(who,`select get_jobs($1::text[]) x`,[a])).map(r=>r.x.id).sort();
  t('get_jobs: open role yes, someone else\'s draft no, closed role only for the applicant and the owner',same(await ids('pro',['j10','j6','j3','j4','nope']),['j10','j3'].sort())&&same(await ids('pro2',['j10','j6','j3']),['j10'])&&same(await ids(null,['j10','j6','j3']),['j10']));
  const o6=(await db.query(`select owner from jobs where id='j6'`)).rows[0].owner; const own6=Object.keys(U).find(k=>U[k]===o6);
  t('get_jobs: the owner gets their draft, complete',await (async()=>{ const r=(await as(own6,`select get_jobs($1::text[]) x`,[['j6']])).map(x=>x.x); return r.length===1&&typeof r[0].description==='string'&&!('descN' in r[0]); })());
  t('get_jobs: other people\'s roles come without the text',(await as('pro',`select get_jobs($1::text[]) x`,[['j10']]))[0].x.descN>0);
  const full=(await as('pro',`select list_jobs_light() x`)).map(r=>r.x); const b=(await as('pro',`select my_jobs_bundle() x`))[0].x;
  const inv=(await db.query(`select job_id from invites where consultant_id=$1`,[proId])).rows.map(r=>r.job_id);
  const want=[...new Set(['j3','j20','j21',...inv])].filter(id=>full.some(j=>j.id===id)).sort();
  t('bundle (professional): applied, invited and saved roles, nothing else',same(b.jobs.map(j=>j.id).sort(),want),[b.jobs.map(j=>j.id),want]);
  t('bundle: counts of open roles and strong matches',b.open===full.filter(j=>j.status==='open').length&&b.strong===(await db.query(`select count(*)::int n from match_scores s join jobs j on j.id=s.job_id where s.consultant_id=$1 and s.score>=75 and j.status='open'`,[proId])).rows[0].n);
  const bc=(await as('coA',`select my_jobs_bundle() x`))[0].x, mine=(await as('coA',`select list_jobs() x`)).map(r=>r.x).filter(j=>j.mine);
  t('bundle (company): all its own roles, complete, drafts and closed included',same(bc.jobs.map(j=>j.id).sort(),mine.map(j=>j.id).sort())&&bc.jobs.every(j=>typeof j.description==='string')&&bc.jobs.some(j=>j.status!=='open')); }

/* ---------- rights ---------- */
const priv=async(role,fn)=>(await db.query(`select has_function_privilege($1,$2,'execute') x`,[role,fn])).rows[0].x;
t('pages and single roles are open to visitors; the bundle needs a sign-in',await priv('anon','public.list_jobs_page(jsonb,text,int,int)')&&await priv('anon','public.get_jobs(text[])')&&!(await priv('anon','public.my_jobs_bundle()'))&&await priv('authenticated','public.my_jobs_bundle()'));
t('the worker and the helpers cannot be called from outside',!(await priv('anon','public.match_scores_run(int)'))&&!(await priv('authenticated','public.match_scores_run(int)'))&&!(await priv('authenticated','public._ms_rescore_c(text)'))&&!(await priv('authenticated','public._job_row(public.jobs,boolean)')));
t('the score tables cannot be read directly',await (async()=>{ try{ const r=await as('pro',`select count(*)::int n from match_scores`); return r[0].n===0; }catch(e){ return true; } })());
t('running the release again keeps the scores',await (async()=>{ const a=(await db.query(`select count(*)::int n, coalesce(sum(score),0)::int s from match_scores`)).rows[0]; await db.exec(fs.readFileSync(ROOT+'/supabase/030_paged_search.sql','utf8')); const b=(await db.query(`select count(*)::int n, coalesce(sum(score),0)::int s from match_scores`)).rows[0]; return a.n===b.n&&a.s===b.s; })());
t('list_jobs and list_jobs_light are not redefined by the release',!/function public\.list_jobs(_light)?\(\)/.test(fs.readFileSync(ROOT+'/supabase/030_paged_search.sql','utf8')));
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
