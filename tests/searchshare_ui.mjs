/* Share this search, in a real browser: a shared link (/jobs?country=eg&product=s4public&module=sd) opens the roles board with those filters,
   the Share button and sheet build the link, and phones and desktops both fit. The link-preview page itself is tested in searchlink_test. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import path from 'path'; import {createRequire} from 'module'; import {pathToFileURL} from 'url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const ROOT=process.env.ARNOUR_ROOT||path.resolve(process.cwd(),'..');
const seo=await import(pathToFileURL(path.join(ROOT,'netlify/edge-lib/seo.mjs')).href);
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const shell=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');}else console.log('ok  ',n); };
const errors=[]; const ORIGIN='http://localhost:'+(process.env.PORT_LIVE||8123);
const U={co:'11111111-0000-0000-0000-000000000001',co2:'22222222-0000-0000-0000-000000000002',pro:'33333333-0000-0000-0000-000000000003'};
const role={co:'employer',co2:'employer',pro:'consultant'};

const be=await makeBackend(); const db=be.db;
for(const f of ['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','026_must_nice','029_light_jobs','030_paged_search','031_paged_search_speed','032_paged_company_filter']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
await db.exec(`delete from jobs;`);
for(const k of Object.keys(U)){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k}; await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
await as('co',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Crescent Test',industry:'Retail',country:'ae',city:'Dubai',size:'51-200',about:'We run SAP.',companyType:'customer'})]);
await as('co2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Dune Partners',industry:'IT',country:'sa',companyType:'partner'})]);
await as('pro',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Pia',lastName:'Pro',headline:'SD lead',anon:false,country:'eg',city:'Cairo',nationality:'Egyptian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:9,level:'Senior',skills:[{productId:'s4public',moduleId:'sd',projects:5}]})]);
const defs=[
 ['SD Consultant Cairo','co',{country:'eg',city:'Cairo',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'}]}],
 ['SD MM Lead Cairo','co',{country:'eg',city:'Cairo',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'},{productId:'s4public',moduleId:'mm'}]}],
 ['ABAP Developer Cairo','co',{country:'eg',city:'Cairo',roleType:'technical',employmentType:'Contract',requires:[{productId:'s4onprem',moduleId:'abap'}]}],
 ['SD Consultant Dubai','co',{country:'ae',city:'Dubai',roleType:'functional',requires:[{productId:'s4public',moduleId:'sd'}]}],
 ['SD Mid Dubai (partner)','co2',{country:'ae',city:'Dubai',roleType:'functional',level:'Mid',requires:[{productId:'s4onprem',moduleId:'sd'}]}],
 ['SD Riyadh ECC','co',{country:'sa',city:'Riyadh',roleType:'functional',requires:[{productId:'ecc',moduleId:'sd'}]}],
 ['Basis Freelance Cairo','co',{country:'eg',city:'Cairo',roleType:'basis',employmentType:'Freelance',requires:[{productId:'s4onprem',moduleId:'basis'}]}],
 ['FI India','co',{country:'in',city:'Pune',roleType:'functional',requires:[{productId:'s4public',moduleId:'fi'}]}]];
for(let i=0;i<24;i++) defs.push(['FI Analyst '+String(i).padStart(2,'0'),'co',{country:i%2?'ae':'eg',city:i%2?'Dubai':'Cairo',roleType:'functional',requires:[{productId:'ecc',moduleId:'fi'}]}]);
const NOW=Date.now();
for(let i=0;i<defs.length;i++){ const [title,owner,o]=defs[i]; const j=Object.assign({title,description:'Role text '+i,employmentType:'Full-time',level:'Senior'},o);
  await as(owner,`select save_job($1,$2::jsonb)`,['j'+String(i).padStart(2,'0'),JSON.stringify(j)]); await db.query(`update jobs set posted_ts=$2 where id=$1`,['j'+String(i).padStart(2,'0'),NOW-i*3600e3-60e3]); }
await db.exec(`select public.match_scores_run(500);`);
const openN=(await db.query(`select count(*)::int n from jobs where status='open'`)).rows[0].n;
const sdEg=['SD Consultant Cairo','SD MM Lead Cairo'];

async function open(vp,who,urlPath){
  const ctx=await browser.newContext({viewport:vp,hasTouch:vp.width<900,isMobile:vp.width<900});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  /* stand in for the edge function: the real index.html turned into the page for /jobs */
  const served=seo.buildPage(shell,{title:'Search | Arnour',desc:'D',canonical:'https://arnour.com/jobs',robots:'noindex,follow',ld:[],fallback:null,path:'/jobs'});
  await p.route(/\/jobs(\?.*)?$/,r=>r.fulfill({contentType:'text/html; charset=utf-8',body:served}));
  await p.goto(ORIGIN+urlPath);
  await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); await p.waitForSelector('.search-layout',{timeout:8000}); await p.waitForTimeout(500);
  return p;
}
const titles=(p)=>p.evaluate(()=>[...document.querySelectorAll('#tf-results .job-title, #tf-results h3')].map(e=>e.textContent.trim()).filter(Boolean));
const loc=(p)=>p.evaluate(()=>({path:location.pathname,search:location.search,hash:location.hash}));
const chips=(p)=>p.evaluate(()=>[...document.querySelectorAll('.af-chip')].map(e=>e.textContent.replace('✕','').trim()));

/* ================= a visitor opens a shared link ================= */
{ const p=await open({width:1280,height:900},null,'/jobs?country=eg&product=s4public&module=sd&utm_source=linkedin&utm_medium=share');
  let l=await loc(p);
  t('the address is cleaned: tracking tags kept, filters gone, board on #/jobs',l.path==='/'&&l.search==='?utm_source=linkedin&utm_medium=share'&&l.hash==='#/jobs',l);
  t('the filters are on: Egypt, S/4HANA Public Cloud, SD',JSON.stringify(await chips(p))===JSON.stringify(['S/4HANA Public Cloud','Sales (SD)','Egypt'])||(await chips(p)).length===3,await chips(p));
  const ts=await titles(p); t('only the matching roles are listed',ts.length===2&&sdEg.every(x=>ts.includes(x)),ts);
  t('the count says 2',await p.evaluate(()=>/\b2\b/.test(document.querySelector('.rb-count').textContent)));
  t('the filter panel shows the same choices',await p.evaluate(()=>document.querySelector('#tf-panel select[name=product]').value==='s4public'&&document.querySelector('#tf-panel select[name=module]').value==='sd'&&document.querySelector('#tf-panel select[name=country]').value==='eg'));
  t('Share button is in the results bar',await p.locator('.rb-row .rb-share').count()===1&&await p.locator('.rb-share').isVisible());
  /* the sheet */
  await p.evaluate(()=>{ window.__copied=[]; APP._copyText=(x)=>{ window.__copied.push(x); }; window.__opened=[]; window.open=(u)=>{ window.__opened.push(u); return null; }; });
  await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  const dl=await p.evaluate(()=>({title:document.getElementById('dlg-title').textContent,text:document.querySelector('.ss-text').textContent,link:document.getElementById('ss-link').value,icons:[...document.querySelectorAll('#dlg-root .share-ic')].map(e=>e.dataset.channel),pills:[...document.querySelectorAll('#dlg-root .share-pill')].map(e=>e.textContent.trim()),ok:document.getElementById('dlg-ok').textContent}));
  t('sheet: title, words and the link',dl.title==='Share this search'&&dl.text==='Open SAP S/4HANA Public Cloud SD roles in Egypt on Arnour'&&dl.link===ORIGIN+'/jobs?country=eg&product=s4public&module=sd',dl);
  t('sheet: LinkedIn, Facebook, WhatsApp, X, Telegram, Email and Copy post text',['linkedin','facebook','whatsapp','x','telegram','email'].every(c=>dl.icons.includes(c))&&dl.pills.some(x=>/Copy post text/.test(x))&&dl.ok==='Copy link',dl);
  await p.click('#dlg-root .share-linkedin'); await p.waitForTimeout(100);
  const op=await p.evaluate(()=>window.__opened);
  t('LinkedIn: opens its share page with the link tagged utm_source=linkedin&utm_medium=share, filters intact',op.length===1&&op[0].startsWith('https://www.linkedin.com/sharing/share-offsite/?url=')&&decodeURIComponent(op[0].split('url=')[1])===ORIGIN+'/jobs?country=eg&product=s4public&module=sd&utm_source=linkedin&utm_medium=share',op);
  await p.click('#dlg-root .share-pill:has-text("Copy post text")'); await p.waitForTimeout(100);
  const cp=await p.evaluate(()=>window.__copied);
  t('Copy post text: words, tagged link and hashtags, ready for a comment',cp.length===1&&cp[0]==='Open SAP S/4HANA Public Cloud SD roles in Egypt on Arnour\n\n'+ORIGIN+'/jobs?country=eg&product=s4public&module=sd&utm_source=copy&utm_medium=share\n\n#SAP #SAPJobs #Egypt',cp);
  await p.click('#dlg-ok'); await p.waitForTimeout(150);
  const cp2=await p.evaluate(()=>window.__copied);
  t('Copy link (main button) copies the tagged link and closes the sheet',cp2.length===2&&cp2[1]===ORIGIN+'/jobs?country=eg&product=s4public&module=sd&utm_source=copy&utm_medium=share'&&await p.locator('#dlg-root').count()===0,cp2);
  /* the link follows the filters on screen */
  await p.click('.af-chip:has-text("Egypt")'); await p.waitForTimeout(300);
  await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  t('after removing Egypt the link and words drop it',await p.evaluate(()=>document.getElementById('ss-link').value.endsWith('/jobs?product=s4public&module=sd')&&/^Open SAP S\/4HANA Public Cloud SD roles on Arnour$/.test(document.querySelector('.ss-text').textContent)));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  t('Escape closes the sheet',await p.locator('#dlg-root').count()===0);
  /* a keyword typed but not yet searched is part of the search */
  await p.fill('form[data-form="job-q"] input[name="q"]','Cairo'); await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  t('a typed keyword is included without pressing Search',await p.evaluate(()=>/[?&]q=Cairo$/.test(document.getElementById('ss-link').value)&&/matching “Cairo”/.test(document.querySelector('.ss-text').textContent)),await p.evaluate(()=>document.getElementById('ss-link').value));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  /* no filters at all */
  await p.click('.af-clear'); await p.waitForTimeout(250); await p.fill('form[data-form="job-q"] input[name="q"]',''); await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  t('no filters: the link is just /jobs and the words say so',await p.evaluate(()=>document.getElementById('ss-link').value.endsWith('/jobs')&&document.querySelector('.ss-text').textContent==='Open SAP roles on Arnour'));
  await p.keyboard.press('Escape');
  await p.context().close(); }

/* ================= other ways in ================= */
{ const p=await open({width:1280,height:900},null,'/jobs?country=zz&product=nope&utm_source=x');
  t('unknown values in a link: the normal board, nothing filtered, address untouched',(await titles(p)).length>=20&&(await loc(p)).hash==='#/jobs'&&(await loc(p)).search==='?country=zz&product=nope&utm_source=x'&&(await chips(p)).length===0,[await loc(p),(await titles(p)).length]);
  await p.context().close(); }
{ const p=await open({width:1280,height:900},null,'/jobs?region=middle-east&type=Contract&q=cairo');
  const ts=await titles(p); t('several filters together: region, job type and keyword',ts.length===1&&ts[0]==='ABAP Developer Cairo',ts); await p.context().close(); }
{ const p=await open({width:1280,height:900},null,'/jobs?country=eg&product=s4public&module=sd&paged=1');
  const ts=await titles(p); t('paged mode (?paged=1): the same two roles, the database does the filtering',await p.evaluate(()=>APP.PAGED===true)&&ts.length===2&&sdEg.every(x=>ts.includes(x))&&(await loc(p)).search==='?paged=1',[ts,await loc(p)]);
  t('paged mode: the count in the bar is 2 of '+openN,await p.evaluate(()=>/\b2\b/.test(document.querySelector('.rb-count').textContent)));
  await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  t('paged mode: the link has the filters only, not paged=1',await p.evaluate(()=>document.getElementById('ss-link').value.endsWith('/jobs?country=eg&product=s4public&module=sd')));
  await p.context().close(); }
{ const p=await open({width:1280,height:900},'pro','/jobs?country=eg&product=s4public&module=sd&utm_source=whatsapp&utm_medium=share');
  const l=await loc(p), ts=await titles(p);
  t('a signed-in professional lands on their own Find roles with the filters',l.hash==='#/c/jobs'&&l.search==='?utm_source=whatsapp&utm_medium=share'&&ts.length===2&&sdEg.every(x=>ts.includes(x)),[l,ts]);
  t('they see their own match on the cards',await p.evaluate(()=>/% Match/.test(document.querySelector('#tf-results').textContent)));
  await p.click('.rb-share'); await p.waitForSelector('#dlg-root.open');
  t('their link has the filters and no sort or match data',await p.evaluate(()=>document.getElementById('ss-link').value.endsWith('/jobs?country=eg&product=s4public&module=sd')));
  await p.context().close(); }

/* ================= phone ================= */
{ const vp={width:390,height:780}; const p=await open(vp,null,'/jobs?country=eg&product=s4public&module=sd');
  const bx=(sel)=>p.evaluate(s=>{ const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height}; },sel);
  const sb=await bx('.rb-share');
  t('phone: Share is on screen in the results bar and big enough to tap',sb&&sb.l>=0&&sb.r<=vp.width&&sb.h>=32,sb);
  t('phone: the page does not scroll sideways',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await p.tap('.rb-share'); await p.waitForSelector('#dlg-root.open'); await p.waitForTimeout(300);
  const dg=await bx('#dlg-root .dlg'); const ic=await p.evaluate(()=>[...document.querySelectorAll('#dlg-root .share-ic, #dlg-root .share-pill')].map(e=>{ const r=e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),r:Math.round(r.right)}; }));
  t('phone: the sheet fits the screen',dg&&dg.l>=0&&dg.r<=vp.width&&dg.b<=vp.height+1,dg);
  t('phone: every share button is inside the sheet and at least 36 px tall',ic.length>=7&&ic.every(x=>x.l>=0&&x.r<=vp.width&&x.h>=36),ic);
  t('phone: no sideways scroll with the sheet open',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await p.screenshot({path:'/tmp/searchshare-phone-sheet.png'});
  await p.tap('#dlg-root [data-action="dlg-cancel"].btn'); await p.waitForTimeout(250);
  t('phone: Close closes it',await p.locator('#dlg-root').count()===0);
  /* with the filter sheet and the Share button together */
  await p.tap('.tf-mobile-btn'); await p.waitForTimeout(300); await p.tap('.tf-close'); await p.waitForTimeout(300);
  t('phone: the filter sheet still opens and closes as before',await p.locator('.rb-share').isVisible());
  await p.screenshot({path:'/tmp/searchshare-phone-board.png'});
  await p.context().close(); }
{ const p=await open({width:820,height:1100},null,'/jobs?country=eg');
  const sb=await p.evaluate(()=>{ const r=document.querySelector('.rb-share').getBoundingClientRect(); return {l:r.left,r:r.right,w:innerWidth}; });
  t('tablet: Share fits in the bar',sb.l>=0&&sb.r<=sb.w,sb); await p.context().close(); }

t('no page errors in any of these runs',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
