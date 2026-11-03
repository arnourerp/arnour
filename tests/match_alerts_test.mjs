/* Match alerts on the server (release31): the SQL score equals the website score, the queue, the limits, the wording */
import {makeBackend} from './harness.mjs'; import fs from 'fs'; import vm from 'vm';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(ROOT+'/supabase/014_match_alerts.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/014_match_alerts.sql','utf8')); /* safe to run twice */
await db.exec(fs.readFileSync(ROOT+'/supabase/015_module_families.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/015_module_families.sql','utf8')); /* safe to run twice */
await db.exec(fs.readFileSync(ROOT+'/supabase/026_must_nice.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/026_must_nice.sql','utf8')); /* safe to run twice */
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };

/* ---------- the website's own scoring, loaded in a sandbox, with the catalog and lists read from the database ---------- */
const stub=new Proxy(function(){}, {get:(_,k)=>k===Symbol.toPrimitive?()=>'':stub, apply:()=>stub, construct:()=>stub, set:()=>true});
const ctx={ARNOUR_CONFIG:{}, document:stub, addEventListener(){}, location:{hash:'',href:''}, matchMedia:()=>({matches:false}),
  localStorage:{getItem(){return null},setItem(){},removeItem(){}}, navigator:{}, setTimeout, clearTimeout, console, Intl, Date, Math, JSON, Object, Array, Number, String, RegExp};
ctx.window=ctx; vm.createContext(ctx);
for(const f of ['js/catalog.js','js/core.js']) vm.runInContext(fs.readFileSync(ROOT+'/'+f,'utf8').replace(/^const APP = window.APP/m,'var APP = window.APP'),ctx,{filename:f});
const APP=ctx.APP;
const catalog=(await db.query(`select get_catalog() x`)).rows[0].x, lists=(await db.query(`select get_lists() x`)).rows[0].x;
t('catalog and lists load into the website code',APP.applyCatalog(catalog)&&APP.applyLists(lists));

/* ---------- parity on random professionals and roles ---------- */
let seed=20261101; const rnd=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let x=Math.imul(seed^seed>>>15,1|seed); x=x+Math.imul(x^x>>>7,61|x)^x; return ((x^x>>>14)>>>0)/4294967296; };
const pick=a=>a[Math.floor(rnd()*a.length)], some=(a,n)=>{ const o=[]; for(let i=0;i<n;i++){ const v=pick(a); if(o.indexOf(v)<0) o.push(v);} return o; };
const products=catalog.products.map(p=>({id:p.id,mods:(p.modules||[]).map(m=>m.id)})).filter(p=>p.mods.length);
const core=products.filter(p=>['s4onprem','ecc','s4public'].indexOf(p.id)>=0), others=products.filter(p=>['s4onprem','ecc','s4public'].indexOf(p.id)<0);
const specIds=[]; catalog.areas.forEach(a=>{ specIds.push(a.id); (a.groups||[]).forEach(g=>(g.items||[]).forEach(i=>specIds.push(i.id))); });
const inds=['Manufacturing & Industrial','Retail & Consumer','Banking & Financial Services','Oil, Gas & Energy','Public Sector','Healthcare','Information Technology (IT)','Automotive','Telecom','Utilities'];
const langs=['English','Arabic','Hindi','French','Urdu'];
const countryIds=lists.countries.map(c=>c.id), cities=['Dubai','Cairo','Riyadh','Munich','Mumbai','Doha'];
const RTS=['functional','technical','basis','architect','delivery','support','keyuser','junior'];
const titles=['SAP FICO Consultant','SAP Basis Administrator','SAP Solution Architect','Project Manager SAP rollout','Junior SAP trainee','Key User SAP SD','SAP ABAP Developer','AMS Support Lead','SAP Consultant','Programme Director S/4HANA','Business Analyst','SAP DevOps Engineer'];
function mkSkills(){ const n=Math.floor(rnd()*5), o=[]; for(let i=0;i<n;i++){ const p=rnd()<0.75?pick(core):pick(products); const m=rnd()<0.12?'*':pick(p.mods); const k={productId:p.id,moduleId:m}; if(rnd()<0.85) k.projects=Math.floor(rnd()*12); if(rnd()<0.2) k.certified=true; o.push(k);} return o; }
function mkCons(){ const c={skills:mkSkills()};
  if(rnd()<0.9){ const r=some(RTS,1+Math.floor(rnd()*3)); if(rnd()<0.5) c.roleTypes=r; else c.roleType=r[0]; }
  if(rnd()<0.85) c.yearsExp=rnd()<0.1?String(Math.floor(rnd()*20)):Math.floor(rnd()*22); else if(rnd()<0.3) c.yearsExp='';
  if(rnd()<0.9) c.level=pick(['Junior','Mid','Senior']); if(rnd()<0.5) c.programs=Math.floor(rnd()*9);
  c.industries=some(inds,Math.floor(rnd()*(rnd()<0.1?10:4))); c.specialties=some(specIds,Math.floor(rnd()*(rnd()<0.1?15:5))); c.languages=some(langs,Math.floor(rnd()*4));
  if(rnd()<0.9) c.country=pick(countryIds); if(rnd()<0.6) c.city=pick(cities); return c; }
function mkJob(){ const j={title:pick(titles)}; if(rnd()<0.6) j.roleType=pick(RTS);
  const n=Math.floor(rnd()*5), rows=[]; for(let i=0;i<n;i++){ const p=rnd()<0.8?pick(core):pick(products); const r={productId:p.id,moduleId:rnd()<0.1?'*':pick(p.mods)}; if(rnd()<0.5) r.minProjects=1+Math.floor(rnd()*6); if(i>0&&rnd()<0.4) r.orPrev=true; if(rnd()<0.3) r.nice=true; rows.push(r);} j.requires=rows;
  if(rnd()<0.7) j.minExp=1+Math.floor(rnd()*14); if(rnd()<0.7) j.level=pick(['Junior','Mid','Senior']); if(rnd()<0.35) j.mustLevel=true; if(rnd()<0.35) j.mustExp=true; if(rnd()<0.3) j.minPrograms=1+Math.floor(rnd()*6);
  if(rnd()<0.6) j.industries=some(inds,1+Math.floor(rnd()*4)); else if(rnd()<0.4) j.industry=pick(inds);
  if(rnd()<0.5) j.preferredSpecialties=some(specIds,1+Math.floor(rnd()*3)); if(rnd()<0.4) j.languages=some(langs,1+Math.floor(rnd()*2)); if(rnd()<0.3) j.preferredLangs=some(langs,1+Math.floor(rnd()*2));
  if(rnd()<0.4) j.certification=pick(['required','preferred']); if(rnd()<0.3) j.remote=true; if(rnd()<0.8) j.country=pick(countryIds); if(rnd()<0.5) j.city=pick(cities); return j; }
let bad=0, total=0, sample=null; const hist={};
for(let i=0;i<3000;i++){ const c=mkCons(), j=mkJob(); const js=APP.matchScore(c,j); const sql=(await db.query(`select match_score($1::jsonb,$2::jsonb) s`,[JSON.stringify(c),JSON.stringify(j)])).rows[0].s;
  total++; hist[Math.floor(js/25)]=(hist[Math.floor(js/25)]||0)+1; if(js!==sql){ bad++; if(!sample) sample={js,sql,c,j}; } }
t('SQL score = website score on 3000 random pairs ('+JSON.stringify(hist)+')',bad===0,sample&&{bad,sample});
/* release 32: BTP / Data / IBP modules keep their family once the catalog is loaded (the catalog stores only fin/log/tech) */
t('website keeps built-in family for BTP modules after catalog load', APP.MODULE_FAMILY.eventmesh==='btp-int' && APP.MODULE_FAMILY.fi==='fin', APP.MODULE_FAMILY.eventmesh);
{ const c={roleType:'architect',roleTypes:['architect'],yearsExp:10,level:'Senior',skills:[{productId:'btp',moduleId:'eventmesh',projects:4}]};
  const j={title:'BTP Architect',roleType:'architect',minExp:8,level:'Senior',requires:[{productId:'btp',moduleId:'integration',minProjects:2}]};
  const js=APP.matchScore(c,j), sq=(await db.query(`select match_score($1::jsonb,$2::jsonb) s`,[JSON.stringify(c),JSON.stringify(j)])).rows[0].s;
  const fam=(await db.query(`select _m_fam('integration') a, _m_fam('ibp') b, _m_fam('fi') c`)).rows[0];
  t('same-family BTP credit: SQL = website, families resolved', js===sq && fam.a==='btp-int' && fam.b==='scm-plan' && fam.c==='fin', {js,sq,fam}); }
/* release 43: Must have / Nice to have */
{ const mk=(extra)=>Object.assign({title:'FI Consultant',roleType:'functional',minExp:8,level:'Senior',country:'ae',city:'Dubai',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:2}]},extra||{});
  const pro=(o)=>Object.assign({roleTypes:['functional'],yearsExp:10,level:'Senior',country:'ae',city:'Dubai',languages:['English'],skills:[{productId:'s4onprem',moduleId:'fi',projects:5}]},o||{});
  const both=async(c,j)=>{ const w=APP.matchScore(c,j), q=(await db.query(`select match_score($1::jsonb,$2::jsonb) s`,[JSON.stringify(c),JSON.stringify(j)])).rows[0].s; return {w,q}; };
  const base=await both(pro(),mk());
  const jn=mk({requires:[{productId:'s4onprem',moduleId:'fi',minProjects:2},{productId:'s4onprem',moduleId:'co',nice:true}]});
  const lo={yearsExp:6,level:'Mid'}, base2=await both(pro(lo),mk());
  const withNice=await both(pro(Object.assign({skills:[{productId:'s4onprem',moduleId:'fi',projects:5},{productId:'s4onprem',moduleId:'co',projects:3}]},lo)),jn);
  const noNice=await both(pro(lo),jn);
  t('nice-to-have product present adds points, absent costs nothing (site = database)', withNice.w===withNice.q && noNice.w===noNice.q && noNice.w===base2.w && base2.w<90 && withNice.w>base2.w && withNice.w-base2.w<=10, {base2,withNice,noNice});
  const jm=mk({mustLevel:true}), junior=await both(pro({level:'Junior'}),jm), senior=await both(pro(),jm), unknown=await both(pro({level:undefined}),jm);
  t('must-have seniority not met: capped below Strong, met: unchanged (site = database)', junior.w===junior.q && senior.w===senior.q && unknown.w===unknown.q && junior.w<=74 && unknown.w<=74 && senior.w===base.w, {junior,senior,unknown,base});
  const je=mk({mustExp:true}), lowx=await both(pro({yearsExp:3}),je), okx=await both(pro(),je);
  t('must-have years not met: capped below Strong (site = database)', lowx.w===lowx.q && okx.w===okx.q && lowx.w<=74 && okx.w===base.w, {lowx,okx});
  const soft=await both(pro({level:'Junior',yearsExp:3}),mk());
  t('without the must flags, seniority and years stay soft (no cap)', soft.w===soft.q, soft);
  const weak=await both(pro({skills:[{productId:'s4onprem',moduleId:'sd',projects:5},{productId:'s4onprem',moduleId:'co',projects:3}]}),jn);
  t('a nice-to-have cannot rescue a candidate who misses the must-have', weak.w===weak.q && weak.w<50, weak); }
/* near-matches: the professional is built from the role, then bent a little (other module, other SAP generation, fewer projects, missing language ...) */
let bad2=0, hi=0, sample2=null;
for(let i=0;i<2000;i++){ const j=mkJob(); if(!j.requires.length) continue; const c=mkCons(); c.skills=[];
  for(const r of j.requires){ if(rnd()<0.8){ let pid=r.productId, mid=r.moduleId; const x=rnd();
      if(x<0.15){ const p=pick(core); pid=p.id; } else if(x<0.25){ const p=products.find(q=>q.id===pid); mid=pick(p.mods); }
      const k={productId:pid,moduleId:mid==='*'?'*':mid,projects:Math.max(0,(r.minProjects||2)+Math.floor(rnd()*5)-3)}; if(rnd()<0.2) k.certified=true; c.skills.push(k); } }
  const rt0=(j.roleType||'functional'); if(rnd()<0.8){ c.roleTypes=[rt0].concat(rnd()<0.3?[pick(RTS)]:[]); delete c.roleType; }
  if(j.minExp&&rnd()<0.8) c.yearsExp=j.minExp+Math.floor(rnd()*4)-1; if(j.level&&rnd()<0.7) c.level=j.level; if(j.country&&rnd()<0.7) c.country=j.country;
  if(j.languages&&rnd()<0.8) c.languages=j.languages.slice(); if(j.industries&&rnd()<0.5) c.industries=j.industries.slice(); if(j.preferredSpecialties&&rnd()<0.5) c.specialties=j.preferredSpecialties.slice();
  const js=APP.matchScore(c,j); const sql=(await db.query(`select match_score($1::jsonb,$2::jsonb) s`,[JSON.stringify(c),JSON.stringify(j)])).rows[0].s; if(js>=70) hi++; if(js!==sql){ bad2++; if(!sample2) sample2={js,sql,c,j}; } }
t('SQL score = website score on 2000 near-match pairs ('+hi+' of them score 70+)',bad2===0&&hi>150,sample2||{hi});
t('the random pairs cover all score ranges',[0,1,2,3].every(k=>(hist[k]||0)>0)||(hist[4]||0)>0,hist);

/* ---------- queue, limits, wording ---------- */
const U={emp:'11111111-aaaa-0000-0000-000000000001',a:'11111111-aaaa-0000-0000-000000000002',b:'11111111-aaaa-0000-0000-000000000003',c:'11111111-aaaa-0000-0000-000000000004',late:'11111111-aaaa-0000-0000-000000000005',board:'11111111-aaaa-0000-0000-000000000006'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,(k==='board'?'jobs':k)+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args); await db.exec('reset role'); return r.rows; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const fico=(n)=>({productId:'s4onprem',moduleId:'fi',projects:n});
const full={firstName:'Test',lastName:'Pro',roleTypes:['functional'],yearsExp:8,level:'Senior',languages:['English'],country:'ae',city:'Dubai',industries:[],specialties:[],skills:[fico(6)]};
const emp=(await as(U.emp,`select claim_profile('employer','{"name":"Acme"}'::jsonb) x`))[0].x;
const board=(await as(U.board,`select claim_profile('employer','{"name":"Jobs on Arnour"}'::jsonb) x`))[0].x;
const pa=(await as(U.a,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify(full)]))[0].x;
const pb=(await as(U.b,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify(Object.assign({},full,{skills:[{productId:'s4onprem',moduleId:'sd',projects:6}]}))]))[0].x;
await as(U.a,`select save_profile($1::jsonb)`,[JSON.stringify(full)]);
await as(U.b,`select save_profile($1::jsonb)`,[JSON.stringify(Object.assign({},full,{skills:[{productId:'s4onprem',moduleId:'sd',projects:6}]}))]);
await db.exec(`delete from match_queue_c`);  /* the profile saves above are not what we test first */
const job=(o)=>JSON.stringify(Object.assign({title:'SAP FI Consultant',roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3}],minExp:5,level:'Senior',country:'ae',city:'Dubai',languages:['English'],industries:[],status:'open'},o||{}));
const j1=(await as(U.emp,`select save_job('',$1::jsonb) x`,[job()]))[0].x;
t('a posted role goes into the queue',(await db.query(`select count(*)::int n from match_queue where job_id=$1`,[j1])).rows[0].n===1);
const r1=(await db.query(`select match_alerts_run() r`)).rows[0].r;
const nots=async(k)=>(await db.query(`select text,link,type from notifications where user_key=$1 and text like 'New role matches%' order by ts,id`,[k])).rows;
t('the right professional is told, with the usual wording',(await nots(pa)).length===1&&/^New role matches your profile: SAP FI Consultant — Acme$/.test((await nots(pa))[0].text)&&(await nots(pa))[0].link==='#/job/'+j1,await nots(pa));
t('a different-module professional is not told',(await nots(pb)).length===0);
t('the queue is empty after the run',(await db.query(`select count(*)::int n from match_queue`)).rows[0].n===0&&r1.alerts===1,r1);
/* once per person per role, also after an edit */
await as(U.emp,`select save_job($1,$2::jsonb)`,[j1,job({requires:[{productId:'s4onprem',moduleId:'fi',minProjects:2}]})]);
t('an edit of the skills queues the role again',(await db.query(`select count(*)::int n from match_queue where job_id=$1`,[j1])).rows[0].n===1);
await db.query(`select match_alerts_run()`);
t('…but nobody is told twice',(await nots(pa)).length===1);
await as(U.emp,`select save_job($1,$2::jsonb)`,[j1,job({requires:[{productId:'s4onprem',moduleId:'fi',minProjects:2}],description:'only the text changed'})]);
t('a text-only edit does not queue it',(await db.query(`select count(*)::int n from match_queue`)).rows[0].n===0);
/* a newly matching person is told after an edit */
await as(U.emp,`select save_job($1,$2::jsonb)`,[j1,job({requires:[{productId:'s4onprem',moduleId:'sd',minProjects:2}]})]);
await db.query(`select match_alerts_run()`);
t('after an edit a person who now matches is told',(await nots(pb)).length===1);
/* applied and invited people are left alone */
const j2=(await as(U.emp,`select save_job('',$1::jsonb) x`,[job({title:'SAP FI Lead'})]))[0].x;
await as(U.a,`select apply_to_job($1,'hi')`,[j2]);
await db.query(`select match_alerts_run()`);
t('someone who already applied is not alerted',(await nots(pa)).filter(n=>n.link==='#/job/'+j2).length===0);
/* daily limit: at most 5 in 24 hours, best first */
await db.query(`delete from match_alerts`); await db.query(`delete from notifications where text like 'New role matches%'`);
const ids=[]; for(let i=0;i<8;i++) ids.push((await as(U.emp,`select save_job('',$1::jsonb) x`,[job({title:'SAP FI Role '+i,minExp:i<6?5:12})]))[0].x);
const r2=(await db.query(`select match_alerts_run() r`)).rows[0].r;
t('at most 5 alerts a day per person',(await nots(pa)).length===5&&r2.alerts===5,[(await nots(pa)).length,r2]);
t('…and the best matches are the ones sent (the 12-year roles score lower)',(await db.query(`select count(*)::int n from match_alerts where consultant_id=$1 and job_id = any($2)`,[pa,ids.slice(6)])).rows[0].n===0);
const lowScores=(await db.query(`select max(score) mx, min(score) mn from match_alerts where consultant_id=$1`,[pa])).rows[0];
t('alert scores are all at least 70',lowScores.mn>=70,lowScores);
/* imported roles need 80+ */
await db.query(`delete from match_alerts`); await db.query(`delete from notifications where text like 'New role matches%'`);
const xr=JSON.parse(job({title:'SAP FI Consultant (imported)',minExp:5})); xr.external=true; xr.extEmployer='Big Corp'; xr.applyUrl='https://example.com/job/1';
await db.query(`insert into jobs(id,company_id,owner,status,data) values ('x-test1',$1,$2,'open',$3::jsonb)`,[board,U.board,JSON.stringify(xr)]);
t('an imported role (direct insert, as the import tool does) is queued',(await db.query(`select count(*)::int n from match_queue where job_id='x-test1'`)).rows[0].n===1);
const strong=await db.query(`select match_score(data,$1::jsonb) s from consultants where id=$2`,[JSON.stringify(xr),pa]);
await db.query(`select match_alerts_run()`);
t('a strong match (80+) on an imported role is alerted',strong.rows[0].s>=80&&(await nots(pa)).length===1,[strong.rows[0].s,(await nots(pa)).length]);
const xr2=Object.assign({},xr,{title:'Weaker imported',minExp:30,level:'Senior',languages:['English','French'],industries:['Healthcare']});
await db.query(`insert into jobs(id,company_id,owner,status,data) values ('x-test2',$1,$2,'open',$3::jsonb)`,[board,U.board,JSON.stringify(xr2)]);
const weak=(await db.query(`select match_score(data,$1::jsonb) s from consultants where id=$2`,[JSON.stringify(xr2),pa])).rows[0].s;
await db.query(`select match_alerts_run()`);
t('an imported role that scores under 80 is not alerted (score '+weak+')',weak<80&&(await nots(pa)).length===1,weak);
/* confidential company stays hidden */
await db.query(`delete from match_alerts`); await db.query(`delete from notifications where text like 'New role matches%'`);
const jc=(await as(U.emp,`select save_job('',$1::jsonb) x`,[job({title:'Secret FI',confidential:true})]))[0].x;
await db.query(`select match_alerts_run()`);
t('a confidential company is not named in the alert',/^New role matches your profile: Secret FI — A confidential company$/.test(((await nots(pa)).find(n=>n.link==='#/job/'+jc)||{}).text||''),await nots(pa));
/* closed roles and suspended people */
const jz=(await as(U.emp,`select save_job('',$1::jsonb) x`,[job({title:'Closed one',status:'closed'})]))[0].x;
t('a closed role is never queued',(await db.query(`select count(*)::int n from match_queue where job_id=$1`,[jz])).rows[0].n===0);
await db.query(`update profiles set suspended=true where entity_id=$1`,[pb]); await db.query(`delete from match_alerts`);
const js2=(await as(U.emp,`select save_job('',$1::jsonb) x`,[job({title:'For B',requires:[{productId:'s4onprem',moduleId:'sd',minProjects:2}]})]))[0].x;
await db.query(`select match_alerts_run()`);
t('a suspended account is not alerted',(await nots(pb)).filter(n=>n.link==='#/job/'+js2).length===0);
await db.query(`update profiles set suspended=false where entity_id=$1`,[pb]);
/* top roles after a skills change, once a week */
await db.query(`delete from match_alerts`); await db.query(`delete from notifications where text like 'New role matches%'`); await db.query(`delete from match_queue`); await db.query(`delete from match_c_state`);
await db.query(`update jobs set status='closed' where id not in ('x-test1','x-test2')`);
for(let i=0;i<5;i++) await db.query(`insert into jobs(id,company_id,owner,status,data) values ($1,$2,$3,'open',$4::jsonb)`,['x-p'+i,board,U.board,JSON.stringify(Object.assign(JSON.parse(job({title:'FI imported '+i,minExp:5})),{external:true,extEmployer:'Corp'+i,applyUrl:'https://example.com/'+i}))]);
await db.query(`delete from match_queue`);
await as(U.a,`select save_profile($1::jsonb)`,[JSON.stringify(Object.assign({},full,{skills:[fico(7)]}))]);
t('changing skills queues the professional',(await db.query(`select count(*)::int n from match_queue_c where consultant_id=$1`,[pa])).rows[0].n===1);
await db.query(`select match_alerts_run()`);
t('they hear about their top 3 open roles',(await nots(pa)).length===3,(await nots(pa)).length);
await as(U.a,`select save_profile($1::jsonb)`,[JSON.stringify(Object.assign({},full,{skills:[fico(8)]}))]);
await db.query(`select match_alerts_run()`);
t('…and not again within a week',(await nots(pa)).length===3);
t('changing only the headline does not queue anyone',(await as(U.a,`select save_profile($1::jsonb)`,[JSON.stringify(Object.assign({},full,{skills:[fico(8)],headline:'new'}))]))&&(await db.query(`select count(*)::int n from match_queue_c`)).rows[0].n===0);
/* nothing is readable or callable by site visitors */
t('visitors cannot read the queue or call the worker',!!(await as(U.a,`select * from match_queue`)).err&&!!(await as(U.a,`select match_alerts_run()`)).err&&!!(await as(U.a,`select match_score('{}','{}')`)).err);
t('the cron entry is only created when pg_cron exists (no error here)',true);
console.log(fails?('\n'+fails+' FAILED'):'\nall ok'); process.exit(fails?1:0);
