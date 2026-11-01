/* "Start from a job description" on Post a role, and "Read a job ad" on Admin → Import jobs (live mode, mock database; the model is a stub).
   We check what leaves the device, what fills the form, what the company still checks, what is saved, and the error messages. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={emp:'aaaaaaaa-0000-0000-0000-000000000001',adm:'bbbbbbbb-0000-0000-0000-000000000002'};
const role={emp:'employer',adm:'consultant'};
for(const k of ['emp','adm']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)]); await be.db.exec('reset role'); }
await claim('emp',{name:'Acme Retail',country:'ae',city:'Dubai',anon:false,industry:'Retail & Consumer Goods (FMCG)',size:'201-500',contactName:'Hana',contactTitle:'HR',sapSystems:['s4onprem']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});

const JOB={ title:'SAP FICO Consultant', roleType:'functional', country:'ae', city:'Dubai', remote:true, employmentType:'Full-time', duration:'Permanent', level:'Senior', minExp:8, certification:'required',
  requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3,orPrev:false},{productId:'s4onprem',moduleId:'co',minProjects:0,orPrev:true},{productId:'ecc',moduleId:'fi',minProjects:0,orPrev:true}],
  languages:['English'], preferredLangs:['Arabic'], industries:['Banking & Financial Services'], specialties:['greenfield'], minPrograms:0, employerName:'Acme Bank' };
const AD='SAP FICO Consultant - Dubai\nAbout the role\nWe need a senior finance consultant for S/4HANA programmes.\n\nApply: jobs@acme.com, call +971 50 123 4567 or visit https://careers.acme.com/job/77\n\nWhat you bring\n- 8+ years in SAP FICO\n- English required, Arabic is an advantage\n'+'Responsible for finance workstreams. '.repeat(6);

async function page(who,opts){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage(); const errors=[]; p.errors=errors; p.posts=[]; p.gets=0;
  p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/jd-parse',async r=>{
    const q=r.request();
    if(q.method()==='GET'){ p.gets++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:opts.configured!==false})}); }
    p.posts.push({headers:q.headers(),body:JSON.parse(q.postData()||'{}')});
    const a=opts.answer||{status:200,body:{job:JOB}};
    return r.fulfill({status:a.status,contentType:'application/json',body:JSON.stringify(a.body)}); });
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(500); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

/* ========== A. switched off: nothing shows, the form works as before ========== */
{ const p=await page('emp',{configured:false}); await go(p,'#/e/jobs/new'); await p.waitForSelector('form[data-form=job-post]'); await p.waitForTimeout(400);
  t('A: the page asked whether the feature is on',p.gets>=1);
  t('A: no card when it is switched off',await p.evaluate(()=>!document.querySelector('.jd-import')));
  t('A: the normal form is there',await p.locator('input[name=title]').count()===1);
  t('A: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== B. a company pastes a job ad, checks the form and publishes ========== */
{ const p=await page('emp',{}); await go(p,'#/e/jobs/new'); await p.waitForSelector('.jd-import textarea',{timeout:8000});
  t('B: the card shows with the privacy promise',await p.evaluate(()=>{ const c=document.querySelector('.jd-import'); return /Start from a job description/.test(c.textContent)&&/not stored by Arnour/i.test(c.textContent)&&/not used to train/i.test(c.textContent)&&/English ads only/.test(c.textContent); }));
  await p.fill('input[name=title]','My own title');
  await p.fill('.jd-import textarea',AD); await p.click('[data-jd-act=read]');
  await p.waitForSelector('.cv-found',{timeout:10000});
  const post=p.posts[0];
  t('B: one request, signed in, kind "post"',p.posts.length===1&&/^Bearer /.test(post.headers.authorization)&&post.body.kind==='post');
  t('B: contact details never left the device',!/jobs@acme\.com|123 4567|careers\.acme\.com/.test(post.body.text)&&/finance consultant for S\/4HANA/.test(post.body.text),post.body.text.slice(0,300));
  t('B: the lists sent are the site\'s own (products, countries, role types, durations)',post.body.lists.products.some(x=>x.id==='s4onprem'&&x.modules.some(m=>m.id==='fi'))&&post.body.lists.countries.some(c=>c.id==='ae')&&post.body.lists.roleTypes.length>=6&&post.body.lists.durations.includes('Permanent')&&post.body.lists.levels.length===3);
  t('B: a found card replaces the paste box and asks for a check',await p.evaluate(()=>{ const c=document.querySelector('.jd-import'); return /We read your job description/.test(c.textContent)&&/check every step/i.test(c.textContent)&&!c.querySelector('textarea'); }));
  t('B: step 1 shows a "please check" banner',await p.evaluate(()=>/Filled in from your job description/.test(document.querySelector('.cv-banner').textContent)));
  t('B: what the company typed first is kept, the rest is filled',await p.evaluate(()=>document.querySelector('input[name=title]').value==='My own title'&&document.querySelector('select[name=roleType]').value==='functional'&&document.querySelector('select[name=country]').value==='ae'&&document.querySelector('select[name=city],input[name=city]').value==='Dubai'&&document.querySelector('select[name=employmentType]').value==='Full-time'&&document.querySelector('input[name=remote]').checked));
  await p.evaluate(()=>APP.jobGoStep(2)); await p.waitForTimeout(300);
  t('B: step 2 shows the banner and the three skills (FI or CO on S/4HANA, or FI on ECC)',await p.evaluate(()=>{ const d=APP.jobNewDraft; return !!document.querySelector('.cv-banner')&&d.requires.length===3&&d.requires[0].minProjects===3&&d.requires[1].orPrev===true&&d.requires[2].orPrev===true&&d.requires[2].productId==='ecc'&&document.querySelectorAll('[data-req-card]').length===2; }));
  t('B: seniority, years, certification, languages, specialty, industry',await p.evaluate(()=>{ const d=APP.jobNewDraft; return d.level==='Senior'&&d.minExp===8&&d.certification==='required'&&d.languages.join()==='English'&&d.preferredLangs.join()==='Arabic'&&d.preferredSpecialties.join()==='greenfield'&&d.industries.join()==='Banking & Financial Services'; }));
  await p.evaluate(()=>APP.jobGoStep(3)); await p.waitForTimeout(300);
  const desc=await p.evaluate(()=>document.querySelector('textarea[name=description]').value);
  t('B: the description is the ad itself, with contact details removed and line breaks kept',/About the role\nWe need a senior finance consultant/.test(desc)&&/What you bring\n- 8\+ years/.test(desc)&&!/@|\+971|https?:/.test(desc),desc.slice(0,200));
  t('B: step 3 has no banner and the Publish button',await p.evaluate(()=>!document.querySelector('.cv-banner')&&/Publish role/.test(document.querySelector('.publish-bar').textContent)));
  await p.evaluate(()=>document.querySelector('form[data-form=job-post]').requestSubmit()); await p.waitForFunction(()=>/^#\/e\/jobs\/j/.test(location.hash),null,{timeout:8000}); await p.waitForTimeout(800);
  const rows=await sql(`select status,data from jobs where data->>'title'='My own title'`);
  t('B: the role was saved as the company checked it',rows.length===1&&rows[0].data.roleType==='functional'&&rows[0].data.requires.length===3&&rows[0].data.country==='ae'&&rows[0].data.employmentType==='Full-time'&&rows[0].data.duration==='Permanent'&&rows[0].data.remote===true,rows[0]&&rows[0].data);
  t('B: the ad text was not kept anywhere except as the description',rows.length===1&&JSON.stringify(rows[0].data).split('careers.acme.com').length===1);
  await go(p,'#/e/jobs/new'); await p.waitForSelector('.jd-import textarea',{timeout:8000});
  t('B: a new role starts clean, with the paste box again',await p.evaluate(()=>!APP.jobNewDraft.title&&!document.querySelector('.cv-banner')&&!!document.querySelector('.jd-import textarea')));
  t('B: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== C. messages, dismiss, edit page ========== */
{ const MSG={ limit:/used all of today/, busy:/very busy/, not_a_job:/could not find a SAP job/, ai:/could not read this job ad/, signin:/sign in again/ };
  for(const [code,re] of Object.entries(MSG)){
    const p=await page('emp',{answer:{status:code==='signin'?401:code==='limit'?429:code==='busy'?503:code==='not_a_job'?422:502,body:{error:code}}}); await go(p,'#/e/jobs/new'); await p.waitForSelector('.jd-import textarea',{timeout:8000});
    await p.fill('.jd-import textarea',AD); await p.click('[data-jd-act=read]'); await p.waitForSelector('.jd-import .field-error',{timeout:8000});
    t('C: "'+code+'" says what happened and keeps the pasted text and the form',re.test(await p.textContent('.jd-import .field-error'))&&await p.inputValue('.jd-import textarea')===AD&&await p.locator('input[name=title]').count()===1);
    await p.context().close(); }
  { const p=await page('emp',{}); await go(p,'#/e/jobs/new'); await p.waitForSelector('.jd-import textarea',{timeout:8000});
    await p.fill('.jd-import textarea','too short'); await p.click('[data-jd-act=read]'); await p.waitForTimeout(200);
    t('C: a very short text is refused on the device, nothing is sent',/too short/.test(await p.textContent('.jd-import .field-error'))&&p.posts.length===0);
    await p.click('[data-jd-act=dismiss]'); await p.waitForTimeout(200);
    t('C: "No thanks" hides the card',await p.evaluate(()=>!document.querySelector('.jd-import')));
    await go(p,'#/e/jobs/j1'); const ed=await sql(`select id from jobs where owner=$1 limit 1`,[U.emp]);
    if(ed.length){ await go(p,'#/e/jobs/'+ed[0].id+'/edit'); await p.waitForSelector('form[data-form=job-post]'); t('C: the edit page has no paste box',await p.evaluate(()=>!document.querySelector('.jd-import'))); }
    else t('C: (edit page check skipped, no saved role yet)',true);
    t('C: no page errors',p.errors.length===0,p.errors); await p.context().close(); } }

/* ========== D. a very long ad is cut for the description, and a role type that counts projects ========== */
{ const p=await page('emp',{}); await go(p,'#/e/jobs/new'); await p.waitForSelector('.jd-import textarea',{timeout:8000});
  const long=('Paragraph about the role and what is needed from the person who joins us.\n\n').repeat(150);
  await p.fill('.jd-import textarea',long); await p.click('[data-jd-act=read]'); await p.waitForSelector('.cv-found',{timeout:10000});
  t('D: the description fits the 8,000 character limit and the company is told',await p.evaluate(()=>APP.jobNewDraft.description.length<=8000&&/shortened/.test(document.querySelector('.cv-found').textContent)));
  await p.context().close(); }

/* ========== E. admin: read a posting into the import list ========== */
{ const p=await page('adm',{}); await go(p,'#/admin/import'); await p.waitForSelector('#jd-slot-admin textarea',{timeout:10000});
  t('E: the admin sees "Read a job ad" above the JSON box',await p.evaluate(()=>/Read a job ad/.test(document.querySelector('#jd-slot-admin').textContent)&&!!document.querySelector('#imp-text')));
  await p.fill('#jd-slot-admin textarea',AD); await p.click('#jd-slot-admin [data-jd-act=read]'); await p.waitForTimeout(300);
  t('E: a posting link is required first',/full https link/.test(await p.textContent('#jd-slot-admin .field-error'))&&p.posts.length===0);
  await p.fill('[data-jd-admin=url]','https://careers.acme.com/job/77'); await p.selectOption('[data-jd-admin=source]','Recruiter / agency posting');
  await p.click('#jd-slot-admin [data-jd-act=read]'); await p.waitForFunction(()=>/Added/.test((document.querySelector('#jd-slot-admin')||{}).textContent||''),null,{timeout:10000});
  t('E: sent as an admin read',p.posts.length===1&&p.posts[0].body.kind==='admin'&&!/careers\.acme\.com/.test(p.posts[0].body.text));
  const list=JSON.parse(await p.inputValue('#imp-text'));
  t('E: one role in the list with employer from the ad, the link and source typed, skills, and the cleaned text',list.length===1&&list[0].extEmployer==='Acme Bank'&&list[0].applyUrl==='https://careers.acme.com/job/77'&&list[0].extSource==='Recruiter / agency posting'&&list[0].requires.length===3&&list[0].requires[1].orPrev===true&&list[0].requires[0].minProjects===3&&list[0].country==='ae'&&list[0].city==='Dubai'&&list[0].employmentType==='Full-time'&&!/@|\+971|https?:/.test(list[0].description),list[0]);
  t('E: the usual check ran: ready to import',/ready to import/.test(await p.textContent('.adm-main'))&&await p.locator('[data-action=adm-imp-run]').count()===1,await p.textContent('.adm-main'));
  await p.fill('#jd-slot-admin textarea',AD); await p.fill('[data-jd-admin=url]','https://careers.acme.com/job/78'); await p.click('#jd-slot-admin [data-jd-act=read]');
  await p.waitForFunction(()=>{ try{ return JSON.parse(document.getElementById('imp-text').value).length===2; }catch(e){ return false; } },null,{timeout:10000});
  t('E: a second ad is added to the list, not replacing it',JSON.parse(await p.inputValue('#imp-text')).length===2);
  await p.fill('#imp-text','[ {"title": '); await p.fill('#jd-slot-admin textarea',AD); await p.fill('[data-jd-admin=url]','https://careers.acme.com/job/79'); await p.click('#jd-slot-admin [data-jd-act=read]');
  await p.waitForSelector('#jd-slot-admin .field-error',{timeout:10000});
  t('E: a broken list is not overwritten',/nothing was added/.test(await p.textContent('#jd-slot-admin .field-error'))&&(await p.inputValue('#imp-text')).startsWith('[ {"title"'));
  t('E: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

console.log(fails?'FAILED '+fails:'ALL OK'); await browser.close(); process.exit(fails?1:0);
