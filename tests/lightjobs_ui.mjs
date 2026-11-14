/* Release 49 in the browser: start-up brings roles without their description; the text arrives when a role is opened or when
   the person searches; a company's own roles stay complete and are saved complete; without the release the site works as before. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={co:'11111111-0000-0000-0000-000000000001',pro:'33333333-0000-0000-0000-000000000003'};
const role={co:'employer',pro:'consultant'};
const LONG='We need an FI lead for a retail programme. '.repeat(60)+'The Zanzibar rollout starts in March.';
async function world(withRelease){
  const be=await makeBackend(); const db=be.db;
  if(withRelease) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/029_light_jobs.sql','utf8'));
  for(const k of Object.keys(U)){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k}; await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
  const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
  await as('co',`select claim_profile('employer',$1::jsonb)`,[JSON.stringify({name:'Crescent Test',industry:'Retail',country:'ae',city:'Dubai',size:'51-200',about:'We run SAP.',companyType:'customer'})]);
  await as('pro',`select claim_profile('consultant',$1::jsonb)`,[JSON.stringify({firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:4}]})]);
  await as('co',`select save_job('j-fi',$1::jsonb)`,[JSON.stringify({title:'FI Lead Retail',roleType:'functional',country:'ae',city:'Dubai',requires:[{productId:'ecc',moduleId:'fi'}],description:LONG,employmentType:'Contract',duration:'6 months'})]);
  await as('co',`select save_job('j-none',$1::jsonb)`,[JSON.stringify({title:'MM Analyst',roleType:'functional',country:'ae',requires:[{productId:'ecc',moduleId:'mm'}],description:'',employmentType:'Contract',duration:'6 months'})]);
  return {be,db};
}
async function page(w,who,opt={}){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(()=>{ window.__cls=0; try{ new PerformanceObserver(l=>{ for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value; }).observe({type:'layout-shift',buffered:true}); }catch(e){} });
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage(); p.__calls=[]; p.__failText=opt.failText||0; p.__slow=null;
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',async(raw)=>{ let op=raw; try{ if(typeof raw==='string') op=JSON.parse(raw); }catch(e){} if(op&&op.t==='rpc'){ p.__calls.push(op.fn); if(op.fn==='get_job_text'){ if(p.__slow) await p.__slow; if(p.__failText>0){ p.__failText--; const fail={error:{message:'network down',code:'XX000'}}; return typeof raw==='string'?JSON.stringify(fail):fail; } } } return w.be.handle(raw); });
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(350); };
const n=(p,fn)=>p.__calls.filter(x=>x===fn).length;

/* ================= with release 49 ================= */
const W=await world(true);
{ const p=await page(W,null);
  t('visitor: start-up uses the light list, not the full one',n(p,'list_jobs_light')===1&&n(p,'list_jobs')===0,p.__calls);
  const j=await p.evaluate(()=>{ const x=APP.db.jobs['j-fi']; return {has:'description' in x&&x.description!=null,descN:x.descN,need:APP.jobNeedsText(x),none:APP.jobNeedsText(APP.db.jobs['j-none'])}; });
  t('the role arrives without its text but knows its length',!j.has&&j.descN>2000&&j.need&&!j.none,j);
  t('nothing was fetched for texts at start-up',n(p,'get_job_text')===0&&n(p,'list_job_texts')===0);
  await go(p,'#/jobs');
  t('the roles list shows the role card without fetching texts',await p.locator('text=FI Lead Retail').count()>0&&n(p,'get_job_text')===0);
  let release; p.__slow=new Promise(r=>{release=r;});
  await go(p,'#/job/j-fi');
  const wait=await p.evaluate(()=>{ const w=document.querySelector('.jd-text-wait'); return w?{h:w.offsetHeight,busy:w.getAttribute('aria-busy'),min:parseInt(w.style.minHeight)}:null; });
  t('opening the role: a placeholder holds the space while the text loads',!!wait&&wait.busy==='true'&&wait.min>=600&&wait.h>=wait.min,wait);
  const c0=await p.evaluate(()=>window.__cls);
  release(); p.__slow=null; await p.waitForFunction(()=>/Zanzibar rollout/.test(document.body.innerText),null,{timeout:6000}); await p.waitForTimeout(300);
  t('then the description is on the page',await p.evaluate(()=>!document.querySelector('.jd-text-wait')&&/About the role/.test(document.body.innerText)));
  t('the text arriving moves nothing (layout shift 0)',(await p.evaluate(()=>window.__cls))-c0===0);
  t('one request for that text',n(p,'get_job_text')===1);
  await go(p,'#/jobs'); await go(p,'#/job/j-fi');
  t('opening it again does not ask again',n(p,'get_job_text')===1&&await p.evaluate(()=>/Zanzibar rollout/.test(document.body.innerText)));
  await p.evaluate(()=>APP.backend.refreshPublicNow()); await p.waitForTimeout(300);
  t('a fresh list keeps the text already fetched',await p.evaluate(()=>/Zanzibar/.test(APP.db.jobs['j-fi'].description||''))&&n(p,'get_job_text')===1);
  await go(p,'#/job/j-none');
  t('a role without a description shows no placeholder and asks for nothing',await p.evaluate(()=>!document.querySelector('.jd-text-wait'))&&n(p,'get_job_text')===1);
  await p.context().close(); }

/* search finds a word that is only in a description */
{ const p=await page(W,null);
  await go(p,'#/search?q=zanzibar'); 
  await p.waitForFunction(()=>window.APP&&/Zanzibar/.test((APP.db.jobs['j-fi']||{}).description||''),null,{timeout:6000}); await p.waitForTimeout(400);
  t('search: all texts fetched once',n(p,'list_job_texts')===1&&n(p,'get_job_text')===0,p.__calls.filter(x=>/text/.test(x)));
  t('search: the role is found by a word from its description',await p.evaluate(()=>APP.searchAll('zanzibar').roles.some(r=>r.id==='j-fi'))&&await p.locator('text=FI Lead Retail').count()>0);
  await p.evaluate(()=>APP.searchAll('retail')); await p.waitForTimeout(200);
  t('search: a second search does not fetch again',n(p,'list_job_texts')===1);
  await p.context().close(); }

/* a failed text request: note and Try again */
{ const p=await page(W,null,{failText:1});
  await go(p,'#/job/j-fi'); await p.waitForSelector('.jd-text-fail',{timeout:6000});
  t('failed request: the page says so and offers Try again',await p.locator('.jd-text-fail [data-action="job-text-retry"]').count()===1&&n(p,'get_job_text')===1);
  await p.waitForTimeout(500);
  t('it does not keep asking by itself',n(p,'get_job_text')===1);
  await p.click('.jd-text-fail [data-action="job-text-retry"]');
  await p.waitForFunction(()=>/Zanzibar rollout/.test(document.body.innerText),null,{timeout:6000});
  t('Try again loads the description',n(p,'get_job_text')===2);
  await p.context().close(); }

/* professional */
{ const p=await page(W,'pro');
  await go(p,'#/job/j-fi'); await p.waitForFunction(()=>/Zanzibar rollout/.test(document.body.innerText),null,{timeout:6000});
  t('professional: the role page gets its text; match is still shown',await p.evaluate(()=>APP.matchScore(APP.currentUser(),APP.db.jobs['j-fi'])>0));
  await p.context().close(); }

/* the company that owns the roles */
{ const p=await page(W,'co');
  const own=await p.evaluate(()=>{ const x=APP.db.jobs['j-fi']; return {text:/Zanzibar/.test(x.description||''),marker:'descN' in x}; });
  t('company: its own role arrives complete',own.text&&!own.marker,own);
  await go(p,'#/e/jobs/j-fi/edit'); await p.waitForTimeout(300);
  t('company: no text request for its own role',n(p,'get_job_text')===0);
  await p.evaluate(()=>{ APP.db.jobs['j-fi'].title='FI Lead Retail (edited)'; APP.save(); });
  await p.waitForFunction(()=>!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(500);
  const row=(await W.db.query(`select data->>'title' t, length(data->>'description') n, data ? 'descN' m from jobs where id='j-fi'`)).rows[0];
  t('company: editing the role keeps its description in the database',row.t==='FI Lead Retail (edited)'&&row.n===LONG.length&&row.m===false,row);
  /* safety net: even a role that somehow lost its text is never written back */
  const before=n(p,'save_job');
  await p.evaluate(()=>{ const x=APP.db.jobs['j-none']; x.descN=50; delete x.description; x.title='should not be saved'; APP.save(); });
  await p.waitForTimeout(1200);
  const row2=(await W.db.query(`select data->>'title' t from jobs where id='j-none'`)).rows[0];
  t('safety net: a role without its text is never saved',row2.t==='MM Analyst'&&n(p,'save_job')===before,[row2,n(p,'save_job'),before]);
  await p.context().close(); }

/* ================= without release 49 (older database) ================= */
const O=await world(false);
{ const p=await page(O,null);
  t('older database: falls back to the full list',n(p,'list_jobs_light')===1&&n(p,'list_jobs')===1&&await p.evaluate(()=>APP.backend.noLight===true));
  await go(p,'#/job/j-fi');
  t('older database: the description shows at once, no text request',await p.evaluate(()=>/Zanzibar rollout/.test(document.body.innerText))&&n(p,'get_job_text')===0);
  await p.evaluate(()=>APP.backend.refreshPublicNow()); await p.waitForTimeout(300);
  t('older database: later refreshes go straight to the full list',n(p,'list_jobs_light')===1&&n(p,'list_jobs')===2);
  await go(p,'#/search?q=zanzibar'); await p.waitForTimeout(300);
  t('older database: search works and asks for nothing extra',n(p,'list_job_texts')===0&&await p.evaluate(()=>APP.searchAll('zanzibar').roles.some(r=>r.id==='j-fi')));
  await p.context().close(); }

t('no page errors',errors.length===0,errors);
await browser.close();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
