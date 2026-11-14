/* Paged mode in the browser (releases 50 to 52, switched on with ?paged=1): start-up without the role list, lists that load
   20 at a time from the database, filters and sorting done there, roles opened from a link, and the fallback when the
   database does not have the functions. Without the switch the site works as before (all other suites). */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={co:'11111111-0000-0000-0000-000000000001',co2:'22222222-0000-0000-0000-000000000002',pro:'33333333-0000-0000-0000-000000000003'};
const role={co:'employer',co2:'employer',pro:'consultant'};
const N=57;
async function world(withReleases){
  const be=await makeBackend(); const db=be.db;
  const files=['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','026_must_nice','029_light_jobs'].concat(withReleases?['030_paged_search','031_paged_search_speed','032_paged_company_filter']:[]);
  for(const f of files) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
  await db.exec(`delete from jobs;`);
  for(const k of Object.keys(U)){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k}; await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
  const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
  const coId=(await as('co',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Crescent Test',industry:'Retail',country:'ae',city:'Dubai',size:'51-200',about:'We run SAP.',companyType:'customer'})]))[0].x;
  await as('co2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Dune Partners',industry:'IT',country:'sa',companyType:'partner'})]);
  const proId=(await as('pro',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:6},{productId:'ecc',moduleId:'co',projects:3}]})]))[0].x;
  const now=Date.now();
  for(let i=0;i<N;i++){ const fi=i%3===0, owner=i%5===4?'co2':'co';
    const j={title:(fi?'FI Consultant ':'MM Analyst ')+String(i).padStart(2,'0')+(i===7?' Zanzibar':''),roleType:'functional',country:i%2?'ae':'eg',city:i%2?'Dubai':'Cairo',requires:[{productId:'ecc',moduleId:fi?'fi':'mm'}],description:'Role number '+i+'. '+'Details. '.repeat(30),employmentType:i%4===0?'Contract':'Full-time',duration:'6 months',remote:i%6===0};
    await as(owner,`select save_job($1,$2::jsonb)`,['j'+String(i).padStart(2,'0'),JSON.stringify(j)]);
    await db.query(`update jobs set posted_ts=$2 where id=$1`,['j'+String(i).padStart(2,'0'),now-i*3600e3-60e3]); }
  await as('pro',`select apply_to_job('j50','please')`);
  await db.query(`update jobs set status='closed' where id='j50'`);
  if(withReleases) await db.exec(`select public.match_scores_run(500);`);
  return {be,db,coId,proId,as};
}
async function page(w,who,query){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage(); p.__calls=[]; p.__args=[];
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',async(raw)=>{ try{ const op=JSON.parse(raw); if(op&&op.t==='rpc'){ p.__calls.push(op.fn); p.__args.push([op.fn,op.args]); } }catch(e){} return w.be.handle(raw); });
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE.replace('index.html','')+(query||'')); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(450); };
const n=(p,fn)=>p.__calls.filter(x=>x===fn).length;
const cards=(p)=>p.locator('#tf-results .job-card, #tf-results [data-job], #tf-results a[href^="#/job/"].job-title').count();
const titles=(p)=>p.evaluate(()=>[...document.querySelectorAll('#tf-results h3, #tf-results .job-title')].map(e=>e.textContent.trim()).filter(Boolean));
const settle=(p)=>p.waitForFunction(()=>!document.querySelector('.pg-wait'),null,{timeout:8000}).then(()=>p.waitForTimeout(150));

const W=await world(true);
const openN=(await W.db.query(`select count(*)::int n from jobs where status='open'`)).rows[0].n;

/* ================= visitor ================= */
{ const p=await page(W,null,'?paged=1');
  t('visitor: paged mode is on and the role list was not downloaded',await p.evaluate(()=>APP.PAGED===true)&&n(p,'list_jobs_light')===0&&n(p,'list_jobs')===0,p.__calls);
  t('visitor: start-up holds no role, only the count ('+openN+')',await p.evaluate(()=>Object.keys(APP.db.jobs).length===0)&&await p.evaluate(()=>APP.backend.openTotal)===openN);
  await go(p,'#/jobs'); await settle(p);
  let ts=await titles(p);
  t('visitor: the roles page shows the first 20, newest first',ts.length===20&&/00$/.test(ts[0])&&/19$/.test(ts[19]),[ts.length,ts[0],ts[19]]);
  t('the count shows all open roles, with a Show more button',await p.evaluate((N)=>new RegExp('\\b'+N+'\\b').test(document.querySelector('.rb-count').textContent)&&/Showing 20 of/.test(document.querySelector('.pg-foot').textContent),openN));
  await p.click('[data-action="jobs-more"]'); await settle(p); ts=await titles(p);
  t('Show more adds the next 20, no repeats',ts.length===40&&new Set(ts).size===40&&/39$/.test(ts[39]),[ts.length,ts[39]]);
  await p.click('[data-action="jobs-more"]'); await settle(p); ts=await titles(p);
  t('the last page ends the list: all open roles shown, button gone',ts.length===openN&&await p.locator('[data-action="jobs-more"]').count()===0,[ts.length,openN]);
  t('three pages were asked for, 20 at a time',p.__args.filter(a=>a[0]==='list_jobs_page'&&a[1].p_limit===20).map(a=>a[1].p_offset).join(',')==='0,20,40',p.__args.filter(a=>a[0]==='list_jobs_page').map(a=>[a[1].p_limit,a[1].p_offset]));
  /* a filter is applied by the database */
  await p.fill('form[data-form="job-q"] input[name="q"]','zanzibar'); await p.press('form[data-form="job-q"] input[name="q"]','Enter'); await p.waitForTimeout(200); await settle(p); ts=await titles(p);
  t('keyword filter: the database returns the one matching role',ts.length===1&&/Zanzibar/.test(ts[0])&&p.__args.some(a=>a[0]==='list_jobs_page'&&a[1].p_f&&a[1].p_f.q==='zanzibar'),ts);
  await p.fill('form[data-form="job-q"] input[name="q"]','nothing-like-this'); await p.press('form[data-form="job-q"] input[name="q"]','Enter'); await p.waitForTimeout(200); await settle(p);
  t('no result: the usual empty message',await p.evaluate(()=>/No SAP roles match/.test(document.querySelector('#tf-results').textContent)));
  await p.evaluate(()=>{ APP.state.jobFilters.q=''; APP.state.jobFilters.country='eg'; APP.state.jobFilters.types=['Contract']; APP._formSyncSkip=['job-q']; APP.render(); }); await settle(p); ts=await titles(p);
  const want=(await W.db.query(`select count(*)::int n from jobs where status='open' and data->>'country'='eg' and data->>'employmentType'='Contract'`)).rows[0].n;
  t('country and contract filters together ('+want+')',ts.length===Math.min(20,want)&&await p.evaluate((w)=>new RegExp('\\b'+w+'\\b').test(document.querySelector('.rb-count').textContent),want),[ts.length,want]);
  await p.evaluate(()=>{ APP.state.jobFilters.country=''; APP.state.jobFilters.types=[]; APP.render(); }); await settle(p);
  const before=n(p,'list_jobs_page');
  t('going back to a list already loaded asks for nothing new',(await titles(p)).length===openN&&n(p,'list_jobs_page')===before);
  /* a role opened from the list, and one opened from a link that was never listed */
  await go(p,'#/job/j07'); await p.waitForFunction(()=>/Role number 7\./.test(document.body.innerText),null,{timeout:6000});
  t('a listed role opens with its description',n(p,'get_job_text')===1&&n(p,'get_jobs')===0);
  await p.context().close();
  const d=await page(W,null,'?paged=1#/job/j33'); await d.waitForFunction(()=>/FI Consultant 33/.test(document.body.innerText)&&/Role number 33\./.test(document.body.innerText),null,{timeout:8000});
  t('a role opened straight from a link is fetched on its own',n(d,'get_jobs')===1&&n(d,'list_jobs_page')<=1&&n(d,'list_jobs_light')===0,d.__calls);
  await go(d,'#/job/j50'); await d.waitForTimeout(600);
  t('a closed role stays unavailable to a visitor',await d.evaluate(()=>/Job not found/.test(document.body.innerText)));
  /* search and company page */
  await go(d,'#/search?q=zanzibar'); await d.waitForFunction(()=>/Zanzibar/.test(document.body.innerText),null,{timeout:6000});
  t('search finds the role through the database, without downloading all texts',n(d,'list_job_texts')===0&&d.__args.some(a=>a[0]==='list_jobs_page'&&a[1].p_f.q==='zanzibar'));
  await go(d,'#/company/'+W.coId); await d.waitForFunction(()=>document.querySelectorAll('a[href^="#/job/"]').length>0,null,{timeout:6000});
  t('a company page lists that company\'s open roles from the database',d.__args.some(a=>a[0]==='list_jobs_page'&&a[1].p_f.company===W.coId)&&await d.evaluate(()=>[...document.querySelectorAll('a[href^="#/job/"]')].every(a=>!/j(04|09|14|19)$/.test(a.getAttribute('href')))));
  await go(d,'#/'); 
  t('the home page count comes from the database',await d.evaluate((N)=>new RegExp('\\b'+N+'\\b').test(document.body.innerText),openN));
  await d.context().close(); }

/* ================= professional ================= */
{ const p=await page(W,'pro','?paged=1');
  t('professional: start-up uses the bundle, not the list',n(p,'my_jobs_bundle')===1&&n(p,'list_jobs_light')===0&&n(p,'list_jobs')===0);
  t('professional: the role they applied to (now closed) is there from the start',await p.evaluate((id)=>!!APP.db.jobs['j50']&&APP.db.jobs['j50'].applicants.indexOf(id)!==-1,W.proId));
  await go(p,'#/c/jobs'); await settle(p);
  const info=await p.evaluate(()=>{ const c=APP.currentUser(); const ids=[...document.querySelectorAll('#tf-results a[href^="#/job/"]')].map(a=>a.getAttribute('href').split('/').pop()).filter((x,i,a)=>a.indexOf(x)===i); return {ids,scores:ids.map(id=>APP.matchScore(c,APP.db.jobs[id])),count:document.querySelector('.rb-count').textContent}; });
  t('professional: 20 roles, best match first (FI roles before MM roles)',info.ids.length===20&&info.scores.every((s,i)=>i===0||info.scores[i-1]>=s)&&info.scores[0]>info.scores[19]&&/ranked by fit/.test(info.count),[info.ids.length,info.scores[0],info.scores[19]]);
  const dbTop=(await W.db.query(`select s.job_id from match_scores s join jobs j on j.id=s.job_id where s.consultant_id=$1 and j.status='open' order by s.score desc, j.posted_ts desc, j.id limit 20`,[W.proId])).rows.map(r=>r.job_id);
  t('the order is the database\'s stored-score order',JSON.stringify(info.ids)===JSON.stringify(dbTop),[info.ids.slice(0,4),dbTop.slice(0,4)]);
  await p.selectOption('select[name="sort"]','newest'); await p.waitForTimeout(250); await settle(p);
  t('sorting by newest asks the database again',/00$/.test((await titles(p))[0])&&p.__args.some(a=>a[0]==='list_jobs_page'&&a[1].p_sort==='newest'));
  await p.selectOption('select[name="sort"]','match'); await p.waitForTimeout(250); await settle(p);
  await go(p,'#/c/dashboard'); await p.waitForFunction(()=>document.querySelectorAll('a[href^="#/job/"]').length>0,null,{timeout:6000});
  t('dashboard: best matches are shown',await p.evaluate(()=>{ const c=APP.currentUser(); const m=APP.jobsForConsultant(c); return m.length>=20&&m[0].score>=m[1].score; }));
  /* applying to a role from a page works and is saved */
  await go(p,'#/job/'+info.ids[0]); await p.waitForTimeout(300);
  await p.evaluate(([id,me])=>{ const j=APP.db.jobs[id]; j.applicants.push(me); j.appliedTs[me]=Date.now(); APP.save(); },[info.ids[0],W.proId]);
  await p.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(400);
  t('applying to a paged role is saved',(await W.db.query(`select count(*)::int n from applications where job_id=$1 and consultant_id=$2`,[info.ids[0],W.proId])).rows[0].n===1&&n(p,'save_job')===0);
  await p.evaluate(()=>APP.backend.poll(true)); await p.waitForTimeout(1200);
  t('after a refresh the cached roles and the application are still there',await p.evaluate(([id,me])=>Object.keys(APP.db.jobs).length>=20&&APP.db.jobs[id].applicants.indexOf(me)!==-1&&!!APP.db.jobs['j50'],[info.ids[0],W.proId]));
  await p.context().close(); }

/* ================= company ================= */
{ const p=await page(W,'co','?paged=1');
  const mine=(await W.db.query(`select count(*)::int n from jobs where owner=$1`,[U.co])).rows[0].n;
  t('company: all its own roles arrive complete at start-up, nobody else\'s',await p.evaluate((m)=>{ const js=Object.values(APP.db.jobs); return js.length===m&&js.every(j=>typeof j.description==='string'&&j.descN===undefined); },mine));
  await go(p,'#/e/jobs'); await p.waitForTimeout(300);
  t('company: My roles lists them',await p.locator('text=FI Consultant 00').count()>0);
  await p.evaluate(()=>{ APP.db.jobs['j00'].title='FI Consultant 00 (edited)'; APP.save(); });
  await p.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(400);
  const row=(await W.db.query(`select data->>'title' t, length(data->>'description') l from jobs where id='j00'`)).rows[0];
  t('company: editing a role keeps its description',row.t==='FI Consultant 00 (edited)'&&row.l>100,row);
  await go(p,'#/jobs'); await settle(p);
  t('company: the public roles page pages too, and other companies\' roles are never saved back',(await titles(p)).length===20&&await p.evaluate(()=>{ APP.save(); return true; }));
  await p.waitForTimeout(800);
  t('no role of another company was written',n(p,'save_job')===1,p.__calls.filter(x=>x==='save_job').length);
  await p.context().close(); }

/* ================= switch and fallback ================= */
{ const p=await page(W,null,'');
  t('without the switch the site is in the old mode',await p.evaluate(()=>APP.PAGED===false)&&n(p,'list_jobs_light')===1&&await p.evaluate(()=>Object.keys(APP.db.jobs).length)===openN);
  await p.context().close();
  const q=await page(W,null,'?paged=1'); await q.goto(BASE.replace('index.html','')+'?paged=0'); await q.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  t('?paged=0 switches it off again for the tab',await q.evaluate(()=>APP.PAGED===false&&sessionStorage.getItem('arnour-paged')==='0'));
  await q.context().close();
  /* automatic switch-on: remembered when the board is large */
  const a=await page(W,null,''); await a.evaluate(()=>{ APP.PAGED_FROM=10; APP.backend.notePagedAuto(57); });
  t('a large board is remembered for the next visit',await a.evaluate(()=>localStorage.getItem('arnour-paged-auto')==='1'));
  await a.reload(); await a.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  t('the next visit starts in paged mode by itself',await a.evaluate(()=>APP.PAGED===true));
  await a.evaluate(()=>{ APP.backend.notePagedAuto(100); });
  t('and it is forgotten when the board is small again',await a.evaluate(()=>localStorage.getItem('arnour-paged-auto')===null));
  await a.context().close(); }
{ const O=await world(false); const p=await page(O,'pro','?paged=1');
  t('database without the releases: falls back to the full list and works',await p.evaluate(()=>APP.PAGED===false&&APP.backend.noPaged===true)&&n(p,'list_jobs_light')===1&&await p.evaluate(()=>Object.values(APP.db.jobs).filter(j=>j.status==='open').length)>50,p.__calls.slice(0,12));
  await go(p,'#/c/jobs'); await p.waitForTimeout(400);
  t('the roles page shows everything as before',(await titles(p)).length>50&&await p.locator('[data-action="jobs-more"]').count()===0);
  await p.context().close(); }

t('no page errors',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
