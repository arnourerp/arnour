/* Shared search links (/jobs?country=eg&product=s4public&module=sd): reading and building links, the words, the edge page,
   and that the count in a link preview equals what a visitor sees on the board. No browser needed. */
import {makeBackend} from './harness.mjs'; import fs from 'fs'; import vm from 'vm'; import path from 'path'; import {pathToFileURL} from 'url';
const ROOT=process.env.ARNOUR_ROOT||path.resolve(process.cwd(),'..');
const be=await makeBackend(); const db=be.db;
for (const f of ['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','026_must_nice','029_light_jobs','030_paged_search','031_paged_search_speed','032_paged_company_filter']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
const imp=(p)=>import(pathToFileURL(path.join(ROOT,p)).href);
const L=await imp('netlify/edge-lib/searchlink.mjs');
const seo=await imp('netlify/edge-lib/seo.mjs');
const page=await imp('netlify/edge-functions/jobs-search.js');
await db.exec(`delete from jobs; delete from consultants where owner is null; delete from match_scores_dirty;`);

/* ---------- the website's own code in a sandbox ---------- */
const stub=new Proxy(function(){}, {get:(_,k)=>k===Symbol.toPrimitive?()=>'':stub, apply:()=>stub, construct:()=>stub, set:()=>true});
const urls=[];
const ctx={ARNOUR_CONFIG:{}, document:stub, addEventListener(){}, location:{hash:'',href:'',search:'',pathname:'/',origin:'https://arnour.com'}, history:{replaceState(a,b,c){ urls.push(c); }},
  matchMedia:()=>({matches:false}), localStorage:{getItem(){return null},setItem(){},removeItem(){}}, navigator:{}, setTimeout, clearTimeout, console, Intl, Date, Math, JSON, Object, Array, Number, String, RegExp, encodeURIComponent, decodeURIComponent};
ctx.window=ctx; vm.createContext(ctx);
for(const f of ['js/catalog.js','js/core.js','js/views-consultant.js']) vm.runInContext(fs.readFileSync(ROOT+'/'+f,'utf8').replace(/^const APP = window.APP/m,'var APP = window.APP'),ctx,{filename:f});
const APP=ctx.APP;
const catalog=(await db.query(`select get_catalog() x`)).rows[0].x, lists=(await db.query(`select get_lists() x`)).rows[0].x;
t('catalog and lists load into the website code',APP.applyCatalog(catalog)&&APP.applyLists(lists));
const nm=page.namesFrom(catalog,lists);
const cleanF=(f)=>{ const o={}; Object.keys(f).sort().forEach(k=>{ const v=f[k]; if(k==='sort'||v===''||v==null||v===false||(k==='region'&&v==='all')||(Array.isArray(v)&&!v.length)) return; o[k]=v; }); return o; };
const J=(o)=>JSON.stringify(o);
const F0=()=>APP.JF_DEFAULTS();

/* ---------- reading a link (Node side) ---------- */
{ const r=L.parseSearch('?country=eg&product=s4public&module=sd&utm_source=linkedin&utm_medium=share');
  t('a link is read into the filters list_jobs_page takes; utm tags are not filters',J(r.f)===J({country:'eg',product:'s4public',module:'sd'})&&r.any,r); }
t('no filters: nothing understood',!L.parseSearch('?utm_source=x&gclid=1').any&&!L.parseSearch('').any&&!L.parseSearch(undefined).any);
t('a module without its product is dropped',J(L.parseSearch('?module=sd&country=eg').f)===J({country:'eg'}));
t('unknown names and malformed values are ignored',J(L.parseSearch('?country=e%20g&role=<x>&cert=maybe&posted=99&mode=moon&level=Boss&type=Gig&lang=1&direct=0&zzz=1').f)==='{}',L.parseSearch('?country=e%20g&role=<x>&cert=maybe&posted=99&mode=moon&level=Boss&type=Gig&lang=1&direct=0&zzz=1'));
t('lists: valid values kept, repeated ones merged, capped',J(L.parseSearch('?level=Senior,Mid,Senior,Boss&type=Contract,Freelance').f)===J({types:['Contract','Freelance'],levels:['Senior','Mid']}));
t('industries with & and commas inside names survive the round trip',(()=>{ const f={industries:['Banking & Financial Services','Oil, Gas & Energy']}; const q=L.filtersQuery(f); return J(L.parseSearch('?'+q).f)===J(f)&&!/Oil, Gas/.test(q); })());
t('free text: control characters and extra spaces cleaned, 80 characters at most',(()=>{ const f=L.parseSearch('?q='+encodeURIComponent('  SD \n\t  & MM  '+'x'.repeat(200))).f; return f.q.length===80&&f.q.startsWith('SD & MM x'); })());
t('a repeated name uses its first value',L.parseSearch('?country=eg&country=ae').f.country==='eg');
t('region "all" is no filter; direct only with 1',!('region' in L.parseSearch('?region=all').f)&&L.parseSearch('?direct=1').f.direct==='yes'&&!('direct' in L.parseSearch('?direct=yes').f));
t('bad percent-escapes do not throw',(()=>{ try{ return typeof L.parseSearch('?q=%E0%A4%A&country=%').f==='object'; }catch(e){ return false; } })());

/* ---------- building a link ---------- */
t('link text is short and readable, in a fixed order',L.filtersQuery({module:'sd',product:'s4public',country:'eg',region:'all'})==='country=eg&product=s4public&module=sd');
t('no filters: empty text; sort and empty values are not part of a link',L.filtersQuery({})===''&&L.filtersQuery({sort:'newest',types:[],q:'  '})===''&&APP.searchQuery(F0())==='');
t('a module is only written with its product',L.filtersQuery({module:'sd'})===''&&APP.searchQuery(Object.assign(F0(),{module:'sd'}))==='');

/* ---------- the website and the edge code agree (random filters, valid values) ---------- */
let seed=20261117; const rnd=()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let x=Math.imul(seed^seed>>>15,1|seed); x=x+Math.imul(x^x>>>7,61|x)^x; return ((x^x>>>14)>>>0)/4294967296; };
const pick=a=>a[Math.floor(rnd()*a.length)], some=(a,n)=>{ const o=[]; for(let i=0;i<n;i++){ const v=pick(a); if(o.indexOf(v)<0) o.push(v);} return o; };
const products=catalog.products.filter(p=>!p.hidden).map(p=>({id:p.id,mods:(p.modules||[]).filter(m=>!m.hidden).map(m=>m.id)})).filter(p=>p.mods.length);
const countryIds=lists.countries.filter(c=>!c.hidden).map(c=>c.id), regionIds=lists.regions.filter(r=>!r.hidden).map(r=>r.id);
const RTS=['functional','technical','basis','architect','delivery','support','keyuser','junior'];
const words=['sd','SD & MM','قيمة','café','fico lead','a+b','100%','“quoted”','x y z','q=1&z=2','50/50'];
function rndF(){ const f=F0(); const k=1+Math.floor(rnd()*6);
  for(let i=0;i<k;i++){ const w=Math.floor(rnd()*14);
    if(w===0) f.types=some(APP.jobTypes,1+Math.floor(rnd()*3)); else if(w===1) f.region=pick(regionIds); else if(w===2) f.roleType=pick(RTS);
    else if(w===3||w===4){ const p=pick(products); f.product=p.id; f.module=rnd()<0.7?pick(p.mods):''; } else if(w===5) f.country=pick(countryIds);
    else if(w===6) f.levels=some(APP.levels,1+Math.floor(rnd()*3)); else if(w===7) f.workMode=pick(['remote','onsite']);
    else if(w===8) f.industries=some(APP.industries,1+Math.floor(rnd()*4)); else if(w===9) f.cert=pick(['none','preferred','required']);
    else if(w===10) f.lang=pick(APP.languages); else if(w===11) f.posted=pick(['1','7','30']); else if(w===12) f.direct='yes'; else f.q=pick(words); }
  return f; }
let badQ=0, badBack=0, badNode=0, badWords=0, sample=null;
for(let i=0;i<600;i++){ const f=rndF(), want=cleanF(f); if(f.module&&!f.product) continue;
  const q=APP.searchQuery(f), qn=L.filtersQuery(want);
  if(q!==qn){ badQ++; sample=sample||{f,q,qn}; }
  const back=APP.searchFilters('?'+q).f; if(J(cleanF(back))!==J(want)){ badBack++; sample=sample||{f,back}; }
  const node=L.parseSearch('?'+q).f; if(J(cleanF(node))!==J(want)){ badNode++; sample=sample||{f,node}; }
  const a=APP.searchPhrase(f), b=L.searchPhrase(want,nm); if(a.head!==b.head||a.text!==b.text||a.tags!==b.tags||J(a.extras)!==J(b.extras)){ badWords++; sample=sample||{a,b,f}; } }
t('600 random searches: the site and the edge code write the same link',badQ===0,sample);
t('600 random searches: the site reads its own link back to the same filters',badBack===0,sample);
t('600 random searches: the edge code reads the link to the same filters',badNode===0,sample);
t('600 random searches: the same words in the site and in the edge code',badWords===0,sample);

/* ---------- the website ignores what its own lists do not know ---------- */
{ const r=APP.searchFilters('?country=zz&product=nope&module=sd&role=wizard&region=mars&industry=Pirates&lang=Klingon&cert=none');
  t('unknown country, product, role, region, industry, language: ignored; a valid one kept',!r.f.country&&!r.f.product&&!r.f.module&&!r.f.roleType&&r.f.region==='all'&&!r.f.industries.length&&!r.f.lang&&r.f.cert==='none'&&r.any,r.f);
  const o=APP.searchFilters('?product=s4public&module=nosuchmodule'); t('a module the product does not have: product kept, module dropped',o.f.product==='s4public'&&!o.f.module);
  t('nothing understood: not "any", filters stay the defaults',!APP.searchFilters('?utm_source=x').any&&J(APP.searchFilters('?utm_source=x').f)===J(F0())); }

/* ---------- the words ---------- */
{ const ph=APP.searchPhrase(Object.assign(F0(),{country:'eg',product:'s4public',module:'sd'}));
  t('module names shorten to their code: SD (Sales & Distribution), Sales (SD), Central Finance (cFin), Fiori / UI5 Development',[['SD (Sales & Distribution)','SD'],['Sales (SD)','SD'],['Central Finance (cFin)','Central Finance'],['Fiori / UI5 Development','Fiori / UI5 Development'],['PM / EAM (Plant Maintenance / Asset Management)','PM / EAM'],['BTP (Business Technology Platform)','BTP']].every(([a,b])=>APP.searchModShort(a)===b&&L.modShort(a)===b));
  t('words for Egypt + S/4HANA Public Cloud + SD',ph.head==='SAP S/4HANA Public Cloud SD roles in Egypt'&&ph.text==='Open SAP S/4HANA Public Cloud SD roles in Egypt on Arnour'&&ph.tags==='#SAP #SAPJobs #Egypt',ph);
  const p2=APP.searchPhrase(Object.assign(F0(),{q:'SD',region:'middle-east',workMode:'remote',levels:['Senior']}));
  t('words with a keyword, a region and extras',p2.head==='SAP roles in Middle East'&&p2.text==='Open SAP roles in Middle East (remote-friendly, senior level, matching “SD”) on Arnour',p2);
  t('no filters: plain words',APP.searchPhrase(F0()).head==='SAP roles'&&APP.searchPhrase(F0()).tags==='#SAP #SAPJobs');
  t('UAE gets its short hashtag',APP.searchPhrase(Object.assign(F0(),{country:'ae'})).tags==='#SAP #SAPJobs #UAE');
  t('a product whose name starts with SAP is not prefixed twice',(()=>{ const p=catalog.products.find(x=>/^SAP\b/i.test(x.short||x.name)); if(!p) return true; return !/^SAP SAP/.test(APP.searchPhrase(Object.assign(F0(),{product:p.id})).head); })());
  t('card title: count first, singular for one, no count for none or unknown',L.searchTitle({country:'eg'},nm,12)==='12 open SAP roles in Egypt'&&L.searchTitle({country:'eg'},nm,1)==='1 open SAP role in Egypt'&&L.searchTitle({country:'eg'},nm,0)==='SAP roles in Egypt'&&L.searchTitle({country:'eg'},nm,null)==='SAP roles in Egypt'); }

/* ---------- the link for the search on screen ---------- */
{ APP.LIVE=true; APP.state.jobFilters=Object.assign(F0(),{country:'eg',product:'s4public',module:'sd',sort:'newest'});
  t('live link: /jobs with the filters, no sort, no tags',APP.searchLinkUrl(APP.state.jobFilters)==='https://arnour.com/jobs?country=eg&product=s4public&module=sd',APP.searchLinkUrl(APP.state.jobFilters));
  t('live link without filters is just /jobs',APP.searchLinkUrl(F0())==='https://arnour.com/jobs');
  const it=APP.shareSearchItem(); t('the share item carries title, words, link and hashtags',it.title==='SAP S/4HANA Public Cloud SD roles in Egypt'&&/^Open SAP/.test(it.text)&&/^https:\/\/arnour\.com\/jobs\?country=eg/.test(it.url)&&/#SAPJobs/.test(it.tags),it);
  t('shared with a channel, the link gets the usual source tags and keeps the filters',APP.tagUrl(it.url,'linkedin')==='https://arnour.com/jobs?country=eg&product=s4public&module=sd&utm_source=linkedin&utm_medium=share');
  APP.LIVE=false; t('practice copy: a link to its own board (it has no /jobs address)',APP.searchLinkUrl(APP.state.jobFilters)==='https://arnour.com/?country=eg&product=s4public&module=sd#/jobs'||/\?country=eg&product=s4public&module=sd#\/jobs$/.test(APP.searchLinkUrl(APP.state.jobFilters)),APP.searchLinkUrl(APP.state.jobFilters)); APP.LIVE=true; }

/* ---------- arriving by a link: the filters are taken once and cleaned off the address ---------- */
{ APP.db={session:null,jobs:{},companies:{},consultants:{}};
  const go=(search,hash,session)=>{ urls.length=0; ctx.location.search=search; ctx.location.hash=hash; ctx.location.pathname='/'; APP.db.session=session||null; APP.state.jobFilters=F0(); const r=APP.applyEntrySearch(); return {r,url:urls[urls.length-1],f:APP.state.jobFilters}; };
  let x=go('?country=eg&module=sd&product=s4public&utm_source=linkedin&utm_medium=share&gclid=g1','#/jobs');
  t('a visitor: filters applied, tracking tags kept, filter words gone from the address',x.r&&x.f.country==='eg'&&x.f.product==='s4public'&&x.f.module==='sd'&&x.url==='/?utm_source=linkedin&utm_medium=share&gclid=g1#/jobs',x);
  x=go('?country=eg','#/jobs',{role:'consultant',consultantId:'c1'});
  t('a signed-in professional continues on their own Find roles page, with the filters',x.r&&x.f.country==='eg'&&x.url==='/#/c/jobs',x);
  x=go('?country=eg','#/c/jobs'); t('only a #/jobs entry is read (nothing else is hijacked)',!x.r&&!x.url&&!x.f.country);
  x=go('?country=eg','#/community'); t('another page with a country in the address is left alone',!x.r&&!x.url);
  x=go('?utm_source=x','#/jobs'); t('no filters in the address: nothing changes and the address is not rewritten',!x.r&&!x.url);
  x=go('?country=zz&nonsense=1','#/jobs'); t('only unknown filter values: nothing applied',!x.r&&!x.url&&!x.f.country);
  x=go('?q=SD%20%26%20MM&paged=1','#/jobs'); t('a keyword is read; other tags such as paged=1 stay in the address',x.r&&x.f.q==='SD & MM'&&x.url==='/?paged=1#/jobs',x); }

/* ---------- the edge page, with a fake network ---------- */
const shell=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const realFetch=globalThis.fetch; let shellOk=true, rpcOk=true, total=12; const calls=[];
globalThis.fetch=async(u,init)=>{ const s=String(u);
  if(s.includes('/rest/v1/rpc/')){ const fn=s.split('/rpc/')[1]; calls.push({fn,body:init&&init.body?JSON.parse(init.body):null}); if(!rpcOk) return new Response('x',{status:500});
    const data=fn==='list_jobs_page'?{total,rows:[],sort:'newest',limit:1,offset:0}:fn==='get_catalog'?catalog:fn==='get_lists'?lists:null; return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}}); }
  if(s==='https://arnour.com/') return shellOk?new Response(shell,{status:200}):new Response('x',{status:500});
  return new Response('?',{status:404}); };
const call=async(p)=>page.default(new Request('https://arnour.com'+p),{});
let r=await call('/jobs?country=eg&product=s4public&module=sd&utm_source=linkedin&utm_medium=share'); let body=await r.text();
t('GET /jobs?…: 200 html',r.status===200&&/text\/html/.test(r.headers.get('content-type')));
t('card title has the live count and the names',body.includes('<title>12 open SAP S/4HANA Public Cloud SD roles in Egypt | Arnour</title>')&&body.includes('<meta property="og:title" content="12 open SAP S/4HANA Public Cloud SD roles in Egypt | Arnour"'),body.match(/<title>.*?<\/title>/)[0]);
t('card text names the search and says what Arnour is',/<meta name="description" content="12 open: SAP S\/4HANA Public Cloud SD roles in Egypt\. Arnour matches/.test(body)&&body.includes('<meta property="og:description" content="12 open:'),body.match(/<meta name="description" content="[^"]*"/)[0]);
t('never indexed',body.includes('<meta name="robots" content="noindex,follow" />'));
t('canonical and og:url are this search without the tracking tags',body.includes('<link rel="canonical" href="https://arnour.com/jobs?country=eg&amp;product=s4public&amp;module=sd" />')&&body.includes('<meta property="og:url" content="https://arnour.com/jobs?country=eg&amp;product=s4public&amp;module=sd"'),body.match(/rel="canonical"[^>]*>/)[0]);
t('the count is asked of the database as a visitor: newest first, one row, the same filters',(()=>{ const c=calls.find(x=>x.fn==='list_jobs_page'); return c&&J(c.body)===J({p_f:{country:'eg',product:'s4public',module:'sd'},p_sort:'newest',p_limit:1,p_offset:0}); })(),calls.find(x=>x.fn==='list_jobs_page'));
t('app opens on #/jobs with no redirect, query kept (the app reads the filters and the tracking tags)',/<head><base href="\/"><script>\(function\(\)\{try\{history\.replaceState\(null,"","\/"\+location\.search\+"#\/jobs"\);window\.__arnourEntry="\/jobs"/.test(body));
t('app scripts and the crawlable fallback are untouched',/<script src="js\/config\.js\?v=[a-f0-9]{10}"><\/script>/.test(body)&&body.includes('SAP role types'));
t('cached at the edge, never stale in the browser',/s-maxage=300/.test(r.headers.get('netlify-cdn-cache-control'))&&/must-revalidate/.test(r.headers.get('cache-control')));
total=1; r=await call('/jobs?country=eg'); body=await r.text(); t('one role: singular title',body.includes('<title>1 open SAP role in Egypt | Arnour</title>'),body.match(/<title>.*?<\/title>/)[0]);
total=0; r=await call('/jobs?country=eg'); body=await r.text(); t('no open roles: no count in the title',body.includes('<title>SAP roles in Egypt | Arnour</title>')&&!/ open: /.test(body.match(/<meta name="description" content="[^"]*"/)[0]),body.match(/<title>.*?<\/title>/)[0]); total=12;
r=await call('/jobs?utm_source=whatsapp'); body=await r.text();
t('no filters: the general roles preview, no database call for a count, still noindex',body.includes('<title>Open SAP roles | Arnour</title>')&&body.includes('noindex,follow')&&body.includes('rel="canonical" href="https://arnour.com/jobs"'));
r=await call('/jobs/'); t('the trailing-slash address works too',r.status===200);
r=await call('/jobs?q='+encodeURIComponent('<script>alert(1)</script>')+'&country=eg'); body=await r.text();
t('a keyword cannot inject markup into the page',!body.includes('<script>alert(1)')&&body.includes('&lt;script&gt;'),body.match(/<title>.*?<\/title>/)[0]);
r=await call('/jobs?country=eg&industry='+encodeURIComponent('"><img src=x onerror=alert(1)>')); body=await r.text(); t('a made-up industry is dropped',!/onerror/.test(body));
rpcOk=false; r=await call('/jobs?country=eg&product=s4public'); body=await r.text();
t('database down: still serves the app with a general preview, never an error page',r.status===200&&body.includes('noindex,follow')&&body.includes('replaceState')&&/<title>/.test(body)&&!/12 open/.test(body)); rpcOk=true;
shellOk=false; r=await call('/jobs?country=eg&utm_source=x'); t('app page unreachable: redirect to the normal address, query kept',r.status===302&&r.headers.get('location')==='https://arnour.com/?country=eg&utm_source=x#/jobs',r.headers.get('location')); shellOk=true;
r=await call('/jobs/extra'); t('another path: redirected home',r.status===302&&r.headers.get('location')==='https://arnour.com/');
t('edge route declared for both spellings',J(page.config.path)==='["/jobs","/jobs/"]');
t('the entry script is only for /job, /company, /partner and /jobs',!seo.buildPage(shell,{title:'T',desc:'D',canonical:'x',path:'/jobsx'}).includes('replaceState')&&seo.buildPage(shell,{title:'T',desc:'D',canonical:'x',path:'/jobs'}).includes('__arnourEntry="/jobs"'));
globalThis.fetch=realFetch;

/* ---------- the count in the preview equals what a visitor sees (same database function, real roles) ---------- */
const U={co:'11111111-0000-0000-0000-000000000001',co2:'22222222-0000-0000-0000-000000000002'};
for(const k of Object.keys(U)) await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${k?U[k]:''}',false); set role ${k?'authenticated':'anon'};`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
const claim=async(k,role,data)=>(await as(k,`select claim_profile($1,$2::jsonb) x`,[role,JSON.stringify(data)]))[0].x;
await claim('co','employer',{name:'Crescent Retail',industry:'Retail',country:'ae',companyType:'customer'});
await claim('co2','employer',{name:'Dune Partners',industry:'IT',country:'sa',companyType:'partner'});
const NOW=Date.now(); const jobsIn=[];
const mk=(i,o)=>Object.assign({title:'SAP Consultant '+i,description:'Role '+i,requires:[],employmentType:'Full-time',level:'Senior'},o);
const defs=[
 {country:'eg',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'}],remote:false},
 {country:'eg',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'},{productId:'s4public',moduleId:'mm'}],remote:true},
 {country:'eg',roleType:'technical',requires:[{productId:'s4onprem',moduleId:'abap'}],employmentType:'Contract'},
 {country:'ae',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'}],industries:['Retail & Consumer Goods (FMCG)']},
 {country:'ae',roleType:'functional',requires:[{productId:'s4onprem',moduleId:'sd'}],level:'Mid'},
 {country:'sa',roleType:'functional',requires:[{productId:'ecc',moduleId:'sd'}],certification:'required',languages:['Arabic']},
 {country:'eg',roleType:'basis',requires:[{productId:'s4onprem',moduleId:'basis'}],employmentType:'Freelance'},
 {country:'in',roleType:'functional',requires:[{productId:'s4public',moduleId:'fi'}]},
 {country:'eg',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'}],title:'SD Lead for a Cairo retailer'}];
for(let i=0;i<defs.length;i++){ const owner=i===4?'co2':'co'; await as(owner,`select save_job($1,$2::jsonb)`,['j'+i,JSON.stringify(mk(i,defs[i]))]); await db.query(`update jobs set posted_ts=$2 where id=$1`,['j'+i,NOW-i*3600e3*30]); }
await db.query(`update jobs set status='closed' where id='j8'`); /* a closed role is on no board */
const openJobs=(await as(null,`select list_jobs_light() x`)).map(r=>r.x).filter(j=>j.status==='open');
APP.db={session:null,jobs:{},companies:{},consultants:{}}; openJobs.forEach(j=>{ APP.db.jobs[j.id]=j; }); (await as(null,`select list_companies() x`)).map(r=>r.x).forEach(c=>{ APP.db.companies[c.id]=c; });
const links=['?country=eg','?country=eg&product=s4public&module=sd','?product=s4public&module=sd','?country=eg&role=functional','?type=Contract,Freelance','?level=Mid','?mode=remote','?industry=Retail%20%26%20Consumer%20Goods%20(FMCG)','?cert=required','?lang=Arabic','?direct=1','?q=sd','?q=cairo','?country=ae&product=s4public&module=sd','?posted=1','?posted=7','?region=middle-east','?role=basis&type=Freelance','?country=eg&q=lead','?product=ecc'];
let allSame=true, firstBad=null, nonZero=0;
for(const lk of links){ const f=L.parseSearch(lk).f; const srv=(await as(null,`select list_jobs_page($1::jsonb,'newest',1,0) x`,[J(f)]))[0].x.total;
  const app=APP.applyJobFilters(null,openJobs.slice(),APP.state.jobFilters=APP.searchFilters(lk).f).length;
  if(srv>0) nonZero++; if(srv!==app){ allSame=false; firstBad=firstBad||{lk,srv,app}; } }
t('20 real links: the preview count (database) equals what the board shows a visitor (site code)',allSame,firstBad);
t('the links really select roles (not all zero, not all the same)',nonZero>=12,nonZero);
{ const f=L.parseSearch('?country=eg&product=s4public&module=sd').f; const srv=(await as(null,`select list_jobs_page($1::jsonb,'newest',50,0) x`,[J(f)]))[0].x; t('Egypt + S/4HANA Public Cloud + SD finds the 2 matching open roles, the closed one excluded',srv.total===2&&srv.rows.every(r=>r.country==='eg'),srv.total); }

console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
