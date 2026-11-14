/* Release 50, part 2 (paged search of professionals): the pages the database returns equal what the website's own Talent
   filter and sort code produces from the full directory, and never match on anything the viewer is not allowed to see. */
import {makeBackend} from './harness.mjs'; import fs from 'fs'; import vm from 'vm';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
for (const f of ['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','021_avatars','026_must_nice','028_other_tools','029_light_jobs','030_paged_search','030_paged_search','031_paged_search_speed','031_paged_search_speed']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,600):'');} else console.log('ok  ',n); };
await db.exec(`delete from jobs; delete from consultants where owner is null; delete from match_scores_dirty;`);

const stub=new Proxy(function(){}, {get:(_,k)=>k===Symbol.toPrimitive?()=>'':stub, apply:()=>stub, construct:()=>stub, set:()=>true});
const ctx={ARNOUR_CONFIG:{}, document:stub, addEventListener(){}, location:{hash:'',href:''}, matchMedia:()=>({matches:false}),
  localStorage:{getItem(){return null},setItem(){},removeItem(){}}, navigator:{}, setTimeout, clearTimeout, console, Intl, Date, Math, JSON, Object, Array, Number, String, RegExp, Map, Set};
ctx.window=ctx; vm.createContext(ctx);
for(const f of ['js/catalog.js','js/core.js','js/views-employer.js']) vm.runInContext(fs.readFileSync(ROOT+'/'+f,'utf8').replace(/^const APP = window.APP/m,'var APP = window.APP'),ctx,{filename:f});
const APP=ctx.APP;
const catalog=(await db.query(`select get_catalog() x`)).rows[0].x, lists=(await db.query(`select get_lists() x`)).rows[0].x;
t('catalog and lists load into the website code',APP.applyCatalog(catalog)&&APP.applyLists(lists));

let seed=20261116; const rnd=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let x=Math.imul(seed^seed>>>15,1|seed); x=x+Math.imul(x^x>>>7,61|x)^x; return ((x^x>>>14)>>>0)/4294967296; };
const pick=a=>a[Math.floor(rnd()*a.length)], some=(a,n)=>{ const o=[]; for(let i=0;i<n;i++){ const v=pick(a); if(o.indexOf(v)<0) o.push(v);} return o; };
const products=catalog.products.map(p=>({id:p.id,mods:(p.modules||[]).map(m=>m.id)})).filter(p=>p.mods.length);
const core=products.filter(p=>['s4onprem','ecc','s4public'].indexOf(p.id)>=0);
const specIds=[], areaIds=[]; catalog.areas.forEach(a=>{ areaIds.push(a.id); (a.groups||[]).forEach(g=>(g.items||[]).forEach(i=>specIds.push(i.id))); });
const inds=['Manufacturing & Industrial','Retail & Consumer','Banking & Financial Services','Oil, Gas & Energy','Public Sector','Healthcare'];
const langs=['English','Arabic','French','German','Hindi'];
const countryIds=lists.countries.map(c=>c.id), regionIds=lists.regions.map(r=>r[0]||r.id), cities=['Dubai','Cairo','Riyadh','Munich','Mumbai','Doha'];
const RTS=['functional','technical','basis','architect','delivery','support','keyuser','junior'];
const firsts=['Omar','Layla','Zainab','Karim','Priya','Hans','Fatima','Yusuf','Nadia','Rahul'], lasts=['Haddad','Mansour','Khoury','Sharma','Becker','Farouk','Nasser','Iyer'];
const heads=['FICO lead for retail rollouts','ABAP developer','Basis and cloud admin','Solution architect S/4HANA','EWM consultant','Project manager','Treasury specialist','SuccessFactors consultant','Key user finance','Zephyr integration expert'];
const nats=['Egyptian','Indian','German','Jordanian','Lebanese'], avail=['Immediate','2 weeks','1 month','3 months'], prefs=['Remote','Onsite','Hybrid','Travel'];
const tools=['Celonis, Signavio','Jira,  Confluence , jira','ServiceNow','Vertex, OpenText','','Tricentis，Worksoft'];
function mkSkills(){ const n=Math.floor(rnd()*5), o=[]; for(let i=0;i<n;i++){ const p=rnd()<0.75?pick(core):pick(products); const k={productId:p.id,moduleId:rnd()<0.1?'*':pick(p.mods)}; if(rnd()<0.85) k.projects=Math.floor(rnd()*14); if(rnd()<0.25) k.certified=true; o.push(k);} return o; }
function mkCons(i){ const c={firstName:pick(firsts),lastName:pick(lasts)+i,headline:pick(heads),skills:mkSkills(),anon:rnd()<0.45};
  if(rnd()<0.7) c.summary='Worked on '+pick(['Quasar','Nimbus','Orion'])+' programme in '+pick(cities)+'.';
  if(rnd()<0.9){ const r=some(RTS,1+Math.floor(rnd()*3)); if(rnd()<0.5) c.roleTypes=r; else c.roleType=r[0]; }
  if(rnd()<0.85) c.yearsExp=rnd()<0.1?String(Math.floor(rnd()*20)):Math.floor(rnd()*22); else if(rnd()<0.3) c.yearsExp='';
  if(rnd()<0.85) c.level=pick(['Junior','Mid','Senior']); if(rnd()<0.4) c.programs=Math.floor(rnd()*9);
  c.industries=some(inds,Math.floor(rnd()*4)); c.specialties=some(specIds,Math.floor(rnd()*5)); c.languages=some(langs,Math.floor(rnd()*4));
  if(rnd()<0.9) c.country=pick(countryIds); if(rnd()<0.6) c.city=pick(cities);
  if(rnd()<0.8) c.nationality=pick(nats); if(rnd()<0.7) c.gender=pick(['male','female']); if(rnd()<0.8) c.availability=pick(avail);
  if(rnd()<0.6) c.workPrefs=some(prefs,1+Math.floor(rnd()*2)); if(rnd()<0.5) c.otherSkills=pick(tools); if(rnd()<0.5) c.otherTools=pick(tools);
  return c; }
const uid=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const U={co:uid(1),co2:uid(2),viewer:uid(3)}; const NP=90;
for(const k of Object.keys(U)) await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
const asU=async(u,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${u||''}',false); set role ${u?'authenticated':'anon'};`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
const coId=(await asU(U.co,`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Crescent Retail',industry:'Retail',country:'ae',companyType:'customer'})]))[0].x;
await asU(U.co2,`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Dune',industry:'IT',country:'sa',companyType:'partner'})]);
const viewerId=(await asU(U.viewer,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify(Object.assign(mkCons(999),{anon:false}))]))[0].x;
const P=[];
for(let i=0;i<NP;i++){ const u=uid(100+i); await db.query('insert into auth.users(id,email) values ($1,$2)',[u,'p'+i+'@t.com']); const d=mkCons(i); const id=(await asU(u,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify(d)]))[0].x; P.push({u,id,d}); }
/* a private professional whose city equals the role's city but who lives in another country: the full profile scores higher than what a company sees */
{ const u=uid(900); await db.query('insert into auth.users(id,email) values ($1,$2)',[u,'px@t.com']); const d={firstName:'Hidden',lastName:'Person',headline:'FICO lead',anon:true,country:'sa',city:'Dubai',roleTypes:['functional'],level:'Senior',yearsExp:12,skills:[{productId:'ecc',moduleId:'fi',projects:8}],languages:['English']}; const id=(await asU(u,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify(d)]))[0].x; P.push({u,id,d}); }
const anonN=(await db.query(`select count(*)::int n from consultants where anon`)).rows[0].n;
t('test people: '+NP+' professionals, '+anonN+' of them private',anonN>20&&anonN<NP-20);
/* the company has been introduced to three private professionals: it sees them in full */
const priv=P.filter(p=>p.d.anon), revealed=priv.slice(0,3).map(p=>p.id);
for(const cid of revealed) await db.query(`insert into intros(id,from_side,cid,eid,status,ts) values ($1,'e',$2,$3,'accepted',1)`,['i-'+cid,cid,coId]).catch(async()=>{ await db.query(`insert into intros(id,cid,eid,status) values ($1,$2,$3,'accepted')`,['i-'+cid,cid,coId]); });
t('three introductions are in place',(await db.query(`select count(*)::int n from intros where eid=$1 and status='accepted'`,[coId])).rows[0].n===3);
/* two roles of the company, scored */
await asU(U.co,`select save_job('jr1',$1::jsonb)`,[JSON.stringify({title:'SAP FICO Consultant',roleType:'functional',country:'ae',city:'Dubai',requires:[{productId:'ecc',moduleId:'fi'},{productId:'s4onprem',moduleId:'fi',orPrev:true}],description:'x',level:'Senior',minExp:5})]);
await asU(U.co2,`select save_job('jr2',$1::jsonb)`,[JSON.stringify({title:'Basis admin',roleType:'basis',country:'sa',requires:[{productId:'ecc',moduleId:'*'}],description:'x'})]);
await db.exec(`select public.match_scores_run(500); select public.match_scores_run(500);`);

/* ---------- the browser of one viewer, and all pages from the database ---------- */
async function client(u,ses){ const rows=(await asU(u,`select list_consultants() x`)).map(r=>r.x);
  APP.db={consultants:{},jobs:{},companies:{},conversations:{},intros:{},notifications:{},session:ses};
  rows.forEach(c=>{ APP.db.consultants[c.id]=c; });
  if(ses&&ses.role==='employer') revealed.forEach(cid=>{ APP.db.intros['i-'+cid]={id:'i-'+cid,cid,eid:ses.companyId,status:'accepted'}; });
  return rows; }
async function pages(u,f,sort,size=23,job=null){ const out=[]; let total=null, first=null;
  for(let off=0;;off+=size){ const p=(await asU(u,`select search_consultants($1::jsonb,$2,$3,$4,$5) x`,[JSON.stringify(f),sort,size,off,job]))[0].x; if(first===null) first=p; total=p.total; out.push(...p.rows); if(p.rows.length<size) break; if(off>3000) break; }
  return {rows:out,total,first}; }
const F0=()=>({q:'',roleType:'',levels:[],product:'',module:'',cert:'',specialties:[],minYears:0,minProjects:0,industries:[],country:'',region:'all',workPref:'',availability:'',langs:[],nationality:'',gender:'',sort:'best'});
const qs=['omar','haddad','fico','abap','lead','zephyr','quasar','dubai','celonis','jira','any module','consultant','senior','sap professional','functional','architect','sharma1','retail',' fi','khoury','tricentis','worksoft','mid ·'];
function rndFilter(){ const f=F0(); const k=1+Math.floor(rnd()*3);
  for(let i=0;i<k;i++){ const w=Math.floor(rnd()*16);
    if(w===0) f.q=pick(qs); else if(w===1) f.roleType=pick(RTS); else if(w===2) f.levels=some(['Junior','Mid','Senior'],1+Math.floor(rnd()*2));
    else if(w===3){ const p=pick(core); f.product=p.id; if(rnd()<0.6) f.module=pick(p.mods); if(rnd()<0.3) f.cert='in-module'; }
    else if(w===4) f.cert=pick(['any-module','in-module']); else if(w===5) f.specialties=rnd()<0.5?some(specIds,1+Math.floor(rnd()*2)):some(areaIds,1);
    else if(w===6) f.minYears=pick([3,5,10]); else if(w===7) f.minProjects=pick([2,5,8]); else if(w===8) f.industries=some(inds,1+Math.floor(rnd()*2));
    else if(w===9) f.country=pick(countryIds); else if(w===10) f.region=pick(regionIds); else if(w===11) f.workPref=pick(prefs);
    else if(w===12) f.availability=pick(avail); else if(w===13) f.langs=some(langs,1+Math.floor(rnd()*2)); else if(w===14) f.nationality=pick(nats); else f.gender=pick(['male','female']); }
  return f; }
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const norm=(x)=>{ const c=Object.assign({},x); delete c.ms; return JSON.stringify(Object.keys(c).sort().map(k=>[k,c[k]])); };
const VIEW=[['company',U.co,{role:'employer',companyId:coId}],['professional',U.viewer,{role:'consultant',consultantId:viewerId}]];

for (const [label,u,ses] of VIEW) {
  const all=await client(u,ses), byId=Object.fromEntries(all.map(c=>[c.id,c]));
  const pg=await pages(u,{},'years');
  t(label+': all pages together are exactly the directory this viewer gets today',same(pg.rows.map(r=>r.id).sort(),all.map(c=>c.id).sort())&&pg.total===all.length,[pg.total,all.length]);
  t(label+': each row is identical to the directory row',pg.rows.every(r=>norm(r)===norm(byId[r.id])));
  t(label+': private professionals arrive without name, city, nationality or summary',pg.rows.filter(r=>r.anon&&!revealed.includes(r.id)&&r.id!==viewerId).every(r=>r.firstName===''&&r.lastName===''&&!('city' in r)&&!('nationality' in r)&&!('summary' in r)));
  /* random filters */
  let bad=[], checked=0, nonEmpty=0;
  for(let i=0;i<150;i++){ const f=rndFilter(); APP.state.talentFilters=f;
    const want=APP.applyTalentFilters(all).map(c=>c.id).sort(); const got=await pages(u,f,'years',50); checked++; if(want.length) nonEmpty++;
    const g=got.rows.map(r=>r.id).sort();
    if(!same(g,want)||got.total!==want.length) bad.push({f:Object.fromEntries(Object.entries(f).filter(([k,v])=>v&&!(Array.isArray(v)&&!v.length)&&v!=='all'&&k!=='sort')),want:want.length,got:g.length,extra:g.filter(x=>!want.includes(x)).slice(0,2),missing:want.filter(x=>!g.includes(x)).slice(0,2)}); }
  t(label+': '+checked+' random filter sets give the same people as the website code ('+nonEmpty+' with results)',bad.length===0&&nonEmpty>checked*0.3,bad.slice(0,4));
  /* each filter alone */
  const singles=[{q:'omar'},{q:'haddad'},{q:'zephyr'},{q:'quasar'},{q:'celonis'},{q:'sap professional'},{q:'Functional Consultant'},{roleType:'architect'},{levels:['Senior']},{product:'ecc'},{product:'s4onprem',module:'fi'},{cert:'any-module'},{product:'ecc',module:'fi',cert:'in-module'},{cert:'in-module'},{specialties:[specIds[0]]},{specialties:[areaIds[0]]},{minYears:10},{minProjects:8},{industries:[inds[0]]},{country:countryIds[0]},{region:regionIds[0]},{workPref:'Remote'},{availability:'Immediate'},{langs:['Arabic']},{nationality:'Egyptian'},{gender:'female'}];
  let one=[]; for(const s of singles){ const f=Object.assign(F0(),s); APP.state.talentFilters=f; const want=APP.applyTalentFilters(all).map(c=>c.id).sort(); const got=(await pages(u,f,'years',50)).rows.map(r=>r.id).sort(); if(!same(got,want)) one.push([s,want.length,got.length]); }
  t(label+': each of the '+singles.length+' single filters matches the website code',one.length===0,one);
  /* sorts */
  for (const [mode,f] of [['years',F0()],['active',F0()],['best',Object.assign(F0(),{q:'fico'})],['best',Object.assign(F0(),{product:'ecc'})],['best',Object.assign(F0(),{product:'s4onprem',module:'fi',q:'lead'})],['best',F0()]]) {
    APP.state.talentFilters=f; const want=APP.applyTalentFilters(all); const got=await pages(u,f,mode,20);
    const key=mode==='years'?(c=>Number(c.yearsExp)||0):mode==='active'?(c=>APP.lastActive(c)):(c=>APP.talentRelevance(c,f));
    const ks=got.rows.map(r=>key(byId[r.id]));
    const okOrder=ks.every((k,i)=>i===0||ks[i-1]-k>=(mode==='active'?-1000:0));
    if(!(okOrder&&same(got.rows.map(r=>r.id).sort(),want.map(c=>c.id).sort()))) t(label+': sort '+mode+' '+JSON.stringify(Object.fromEntries(Object.entries(f).filter(([k,v])=>v&&!(Array.isArray(v)&&!v.length)&&v!=='all'&&k!=='sort'))),false,ks.slice(0,12));
  }
  t(label+': the three sort orders agree with the website (years, recently active, best match with and without a keyword or product)',true);
}

/* ---------- privacy: nothing hidden can be searched ---------- */
{ const hidden=priv.filter(p=>!revealed.includes(p.id));
  const leaks=[]; 
  for(const p of hidden.slice(0,25)){ 
    for (const [what,f] of [['last name',{q:p.d.lastName.toLowerCase()}],['summary word',p.d.summary?{q:'quasar programme in '+(p.d.city||'zzz').toLowerCase()}:null],['nationality',p.d.nationality?{nationality:p.d.nationality}:null]]) {
      if(!f) continue; const r=(await pages(U.co,Object.assign(F0(),f),'years',50)).rows; if(r.some(x=>x.id===p.id)) leaks.push([what,p.id]); } }
  t('a private professional is never found by their name, summary or nationality',leaks.length===0,leaks.slice(0,5));
  const one=hidden.find(p=>p.d.headline&&p.d.level); const byHead=(await pages(U.co,Object.assign(F0(),{q:one.d.headline.toLowerCase()}),'years',50)).rows;
  t('but is found by what a company does see (headline)',byHead.some(x=>x.id===one.id));
  const rv=P.find(p=>p.id===revealed[0]); const byName=(await pages(U.co,Object.assign(F0(),{q:rv.d.lastName.toLowerCase()}),'years',50)).rows;
  t('an introduced professional is found by name by that company, and not by another company',byName.some(x=>x.id===rv.id)&&!(await pages(U.co2,Object.assign(F0(),{q:rv.d.lastName.toLowerCase()}),'years',50)).rows.some(x=>x.id===rv.id));
  const g=(await pages(U.viewer,Object.assign(F0(),{gender:'female'}),'years',50));
  t('gender is not searchable by other professionals (only their own row can match)',g.rows.every(x=>x.id===viewerId));
  t('visitors get nothing',(await asU(null,`select 1 x`)).length===1&&await (async()=>{ try{ const r=(await asU(null,`select search_consultants('{}'::jsonb,'best',20,0,null) x`))[0].x; return r.total===0&&r.rows.length===0; }catch(e){ return /permission denied/.test(e.message); } })()); }

/* ---------- best match for one of the company's roles ---------- */
{ const all=await client(U.co,{role:'employer',companyId:coId}), byId=Object.fromEntries(all.map(c=>[c.id,c]));
  const job=(await asU(U.co,`select list_jobs() x`)).map(r=>r.x).find(j=>j.id==='jr1');
  const pg=await pages(U.co,{},'best',20,'jr1');
  const diff=pg.rows.filter(r=>r.ms!==APP.matchScore(byId[r.id],job));
  t('role match: the score on every row equals the score the company\'s own page computes (private people included)',diff.length===0&&pg.rows.length===all.length,diff.slice(0,3).map(r=>[r.id,r.ms,APP.matchScore(byId[r.id],job),r.anon]));
  t('role match: best first',pg.rows.every((r,i)=>i===0||pg.rows[i-1].ms>=r.ms));
  const differ=(await db.query(`select count(*)::int n from match_scores where job_id='jr1' and score <> score_pub`)).rows[0].n;
  t('the public score differs from the full score for some private people (so the order cannot give away a city)',differ>0,differ);
  const strong=await pages(U.co,{minScore:50,exclude:[pg.rows[0].id]},'best',50,'jr1');
  t('minimum score and exclusions work',strong.rows.every(r=>r.ms>=50)&&!strong.rows.some(r=>r.id===pg.rows[0].id)&&strong.total===pg.rows.filter(r=>r.ms>=50).length-(pg.rows[0].ms>=50?1:0));
  const other=await pages(U.co,{},'best',20,'jr2');
  t('another company\'s role cannot be used for scoring (no scores returned)',other.rows.every(r=>!('ms' in r)));
  /* privacy switch: a person going private gets a new public score */
  const pub=P.find(p=>!p.d.anon&&p.d.city==='Dubai'&&p.d.country==='ae')||P.find(p=>!p.d.anon);
  await asU(pub.u,`select save_profile($1::jsonb)`,[JSON.stringify(Object.assign({},pub.d,{anon:true}))]);
  const marked=(await db.query(`select count(*)::int n from match_scores_dirty where kind='c' and id=$1`,[pub.id])).rows[0].n;
  await db.query(`select public.match_scores_run()`); await client(U.co,{role:'employer',companyId:coId});
  const s=(await db.query(`select score, score_pub from match_scores where consultant_id=$1 and job_id='jr1'`,[pub.id])).rows[0];
  t('going private re-scores the person; the public score matches the company\'s view',marked===1&&s.score_pub===APP.matchScore(APP.db.consultants[pub.id],job),[marked,s]); }

/* ---------- specific people, rights ---------- */
{ const ids=P.slice(0,5).map(p=>p.id); const rows=(await asU(U.co,`select get_consultants($1::text[]) x`,[ids.concat(['nope'])])).map(r=>r.x); const all=await client(U.co,{role:'employer',companyId:coId}); const byId=Object.fromEntries(all.map(c=>[c.id,c]));
  t('get_consultants: the same rows as the directory, only for ids that exist',rows.length===5&&rows.every(r=>norm(r)===norm(byId[r.id])));
  const pr=async(role,fn)=>(await db.query(`select has_function_privilege($1,$2,'execute') x`,[role,fn])).rows[0].x;
  t('people search needs a sign-in; helpers are closed',!(await pr('anon','public.search_consultants(jsonb,text,int,int,text)'))&&!(await pr('anon','public.get_consultants(text[])'))&&await pr('authenticated','public.search_consultants(jsonb,text,int,int,text)')&&!(await pr('authenticated','public._consultant_row(public.consultants)'))&&!(await pr('authenticated','public._consultant_hay(jsonb,boolean)'))&&!(await pr('authenticated','public._ms_pub(public.consultants)'))); }
t('list_consultants is not redefined by the release',!/function public\.list_consultants\(\)/.test(fs.readFileSync(ROOT+'/supabase/030_paged_search.sql','utf8')));
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
