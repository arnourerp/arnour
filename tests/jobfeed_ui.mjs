/* Release 56 in the browser: Admin > Job feeds (connect a careers page, tick roles, bring them in as drafts, switch off, disconnect, daily-check secret).
   The Netlify function is a stub that talks to the real SQL, so what the page sends and what the database keeps are both checked. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import crypto from 'crypto'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
for(const f of ['027_job_drafts','016_jd_import','035_job_to_draft','036_job_feed']) await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={emp:'aaaaaaaa-0000-0000-0000-000000000001',adm:'bbbbbbbb-0000-0000-0000-000000000002'}; const role={emp:'employer',adm:'consultant'};
for(const k of ['emp','adm']){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k}; await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)]); await be.db.exec('reset role'); }
await claim('emp',{name:'Acme Retail',country:'ae',city:'Dubai',anon:false,industry:'Retail & Consumer Goods (FMCG)',size:'201-500',contactName:'Hana',contactTitle:'HR',sapSystems:['s4onprem']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
const sql=async(s,a)=>(await be.db.query(s,a)).rows;
const S0='z'.repeat(40);
await be.db.query(`insert into job_feed_worker(id,secret_hash) values (1,$1) on conflict (id) do update set secret_hash=excluded.secret_hash`,[crypto.createHash('sha256').update(S0).digest('hex')]);
await be.db.query(`update job_feed_worker set secret_hash=null where id=1`); /* start with the daily check "off" */
const ITEMS=[{key:'https://careers.acme.example/job/1',url:'https://careers.acme.example/job/1',title:'SAP FICO Consultant',sap:true},{key:'https://careers.acme.example/job/2',url:'https://careers.acme.example/job/2',title:'SAP MM Consultant',sap:true},{key:'https://careers.acme.example/job/3',url:'https://careers.acme.example/job/3',title:'Store Manager',sap:false}];
const ROLE={title:'SAP FICO Consultant',roleType:'functional',country:'ae',remote:false,employmentType:'Full-time',duration:'Permanent',minExp:5,level:'Senior',description:'Finance consultant for S/4HANA.',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:2,orPrev:false}],languages:['English']};
async function page(opts){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
  await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U.adm,'adm@t.com']);
  const p=await ctx.newPage(); p.errors=[]; p.posts=[];
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) p.errors.push(m.text()); });
  p.on('pageerror',e=>p.errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/job-feed',async r=>{
    const q=r.request(); const J=(status,body)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(q.method()==='GET') return J(200,{configured:true});
    const b=JSON.parse(q.postData()||'{}'); p.posts.push({headers:q.headers(),body:b});
    if(opts.fail) return J(opts.fail,{error:'service'});
    await be.db.exec(`select set_config('request.jwt.claim.sub','${U.adm}',false)`); /* the real function signs in as the admin */
    if(b.action==='check'){ const x=(await be.db.query(`select feed_store($1,$2::uuid,$3::jsonb) x`,[S0,b.feedId,JSON.stringify(ITEMS)])).rows[0].x; return J(200,{status:x.status,found:x.found,new:x.new,closed:x.closed}); }
    if(b.action==='read'){
      const n=(await be.db.query(`select feed_next($1,$2::uuid) x`,[S0,b.feedId])).rows[0].x;
      if(!n){ return J(200,{done:true}); }
      await be.db.query(`select feed_item_done($1,$2::uuid,'drafted','',$3::jsonb) x`,[S0,n.itemId,JSON.stringify(Object.assign({},ROLE,{title:n.title}))]);
      const left=(await be.db.query(`select count(*)::int n from job_feed_items where feed_id=$1::uuid and state='selected'`,[b.feedId])).rows[0].n;
      let notified=0; if(!left) notified=(await be.db.query(`select feed_notify($1,$2::uuid) x`,[S0,b.feedId])).rows[0].x;
      return J(200,{done:false,title:n.title,status:'drafted',notified});
    }
    return J(400,{error:'bad_request'}); });
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(700); };
const text=(p)=>p.evaluate(()=>document.querySelector('.adm-main').textContent);

const A=await page({});
await go(A,'#/admin/overview'); await A.waitForSelector('.adm-tabs');
t('the sidebar has a Job feeds tab',await A.evaluate(()=>[...document.querySelectorAll('.adm-tab')].some(x=>/Job feeds/.test(x.textContent))));
await go(A,'#/admin/feeds'); await A.waitForSelector('#feed-url',{timeout:10000});
t('the company picker lists the company and the daily check says off',await A.evaluate(()=>[...document.querySelectorAll('#feed-co option')].some(o=>/Acme Retail/.test(o.textContent))&&/Daily check: off/.test(document.querySelector('.adm-main').textContent)));
await A.waitForTimeout(500);


/* ---- mistakes ---- */
await A.fill('#feed-url','careers.acme.example/jobs'); await A.click('[data-action=adm-feed-add]'); await A.waitForTimeout(300);
t('no company chosen: a clear message and nothing saved',/Choose the company first/.test(await text(A))&&(await sql(`select count(*)::int n from job_feeds`))[0].n===0);
await A.selectOption('#feed-co',{index:1}); await A.fill('#feed-url','not a link'); await A.click('[data-action=adm-feed-add]'); await A.waitForTimeout(300);
t('a bad link is refused with an example',/Enter the full link/.test(await text(A))&&(await sql(`select count(*)::int n from job_feeds`))[0].n===0);

/* ---- connect, check, tick, bring in ---- */
await A.fill('#feed-url','careers.acme.example/jobs'); await A.click('[data-action=adm-feed-add]');
await A.waitForSelector('.feed-row',{timeout:6000}); await A.waitForTimeout(400);
const feed=(await sql(`select * from job_feeds`))[0];
t('the link got https:// and the feed is saved for the company',!!feed&&feed.url==='https://careers.acme.example/jobs'&&feed.filter==='sap',feed);
t('the check was sent with the admin\'s sign-in and no lists',A.posts.length===1&&A.posts[0].body.action==='check'&&A.posts[0].body.feedId===feed.id&&/^Bearer /.test(A.posts[0].headers.authorization)&&!A.posts[0].body.lists,A.posts[0]);
t('two SAP roles are listed to tick (all ticked), the store manager was set aside',await A.evaluate(()=>{ const r=[...document.querySelectorAll('.feed-row')]; return r.length===2&&r.every(x=>x.querySelector('input').checked)&&/SAP FICO Consultant/.test(r[0].textContent+r[1].textContent); })&&(await sql(`select state from job_feed_items where title='Store Manager'`))[0].state==='ignored');
t('the card says what was found',/\d roles? on the page, \d new/.test(await text(A)),(await text(A)).slice(-600));
await A.click('[data-action=adm-feed-tick][data-k="1"]'); await A.waitForTimeout(200);
t('unticking one changes the button to "Bring in 1 role as drafts"',await A.evaluate(()=>/Bring in 1 role as drafts/.test(document.querySelector('[data-action=adm-feed-bring]').textContent)));
await A.click('[data-action=adm-feed-bring]');
await A.waitForFunction(()=>/Done: 1 role read/.test(document.querySelector('.adm-main').textContent),null,{timeout:15000});
const jobs=await sql(`select status,company_id,data->>'title' title from jobs where company_id=$1`,[feed.company_id]);
t('one draft role was made for the company (not live)',jobs.length===1&&jobs[0].status==='draft'&&jobs[0].title==='SAP FICO Consultant',jobs);
t('the unticked role was set aside and never offered again',(await sql(`select state from job_feed_items where title='SAP MM Consultant'`))[0].state==='ignored');
t('the read calls carried the site\'s lists',A.posts.filter(x=>x.body.action==='read').length>=1&&A.posts.filter(x=>x.body.action==='read').every(x=>x.body.lists&&x.body.lists.products.length>0&&x.body.lists.countries.some(c=>c.id==='ae')));
t('the company got one notice with a link to its jobs',await (async()=>{ const n=await sql(`select text,link from notifications where text like '%job feed%'`); return n.length===1&&n[0].link==='#/e/jobs'; })());
t('the approval is remembered, so later roles come in by themselves',(await sql(`select approved from job_feeds`))[0].approved===true);
await A.waitForTimeout(500);
t('the list of roles to tick is gone and the count of drafts shows',await A.evaluate(()=>!document.querySelector('.feed-row')&&/1 drafted/.test(document.querySelector('.adm-main').textContent)));
await A.click('[data-action=adm-feed-all]'); await A.waitForSelector('.feed-card table',{timeout:8000});
t('"Show all roles" lists every role with its state',await A.evaluate(()=>{ const x=document.querySelector('.feed-card table').textContent; return /Draft created/.test(x)&&/Set aside/.test(x)&&/Store Manager/.test(x); }));

/* ---- switch off / on, disconnect ---- */
await A.click('[data-action=adm-feed-toggle]'); await A.waitForTimeout(600);
t('Switch off turns the feed off',(await sql(`select enabled from job_feeds`))[0].enabled===false&&/Switched off/.test(await text(A)));
await A.click('[data-action=adm-feed-toggle]'); await A.waitForTimeout(600);
t('Switch on turns it back on',(await sql(`select enabled from job_feeds`))[0].enabled===true);
await A.click('[data-action=adm-feed-remove]'); await A.waitForSelector('#dlg-ok'); 
t('Disconnect asks first and says drafts stay',await A.evaluate(()=>/Drafts and roles already made stay/.test(document.querySelector('.dlg').textContent)));
await A.click('.dlg-foot [data-action=dlg-cancel]'); await A.waitForTimeout(300);
t('cancelling keeps the feed',(await sql(`select count(*)::int n from job_feeds`))[0].n===1);

/* ---- the daily-check secret ---- */
await A.click('[data-action=adm-feed-secret]'); await A.waitForSelector('#feed-secret',{timeout:8000});
const secret=await A.evaluate(()=>document.getElementById('feed-secret').value);
t('a 64-character secret is shown once, with the Netlify steps',/^[0-9a-f]{64}$/.test(secret)&&await A.evaluate(()=>/FEED_WORKER_SECRET/.test(document.querySelector('.dlg').textContent)&&/Trigger deploy/.test(document.querySelector('.dlg').textContent)));
const wk=(await sql(`select secret_hash from job_feed_worker`))[0];
t('only its fingerprint is kept in the database (not the secret)',wk&&wk.secret_hash===crypto.createHash('sha256').update(secret).digest('hex')&&wk.secret_hash!==secret);
await A.click('.dlg-foot [data-action=dlg-cancel]'); await A.waitForTimeout(500);
t('the card now says the daily check is on',/Daily check: on/.test(await text(A)));
t('the option lists are in the database for the daily run',await (async()=>{ const l=(await sql(`select lists from job_feed_worker`))[0].lists; return !!l&&Array.isArray(l.products); })());

/* ---- disconnect for real ---- */
await A.click('[data-action=adm-feed-remove]'); await A.waitForSelector('#dlg-ok'); await A.click('#dlg-ok'); await A.waitForTimeout(800);
t('Disconnect removes the feed; the drafts stay',(await sql(`select count(*)::int n from job_feeds`))[0].n===0&&(await sql(`select count(*)::int n from jobs where company_id=$1`,[feed.company_id]))[0].n===1&&/No page connected yet/.test(await text(A)));
t('no page errors',A.errors.length===0,A.errors);
await A.context().close();

/* ---- the function being down ---- */
{ const B=await page({fail:502}); await go(B,'#/admin/feeds'); await B.waitForSelector('#feed-url');
  await B.selectOption('#feed-co',{index:1}); await B.fill('#feed-url','https://careers.acme.example/jobs'); await B.click('[data-action=adm-feed-add]'); await B.waitForTimeout(1500);
  t('when the service is down the page says so and the feed stays connected for a retry',/Could not check: The service had a problem/.test(await text(B))&&(await sql(`select count(*)::int n from job_feeds`))[0].n===1,await text(B));
  t('no page errors (service down)',B.errors.length===0,B.errors); await B.context().close(); }

await browser.close(); await be.db.close?.();
console.log(fails?`\n${fails} FAILED`:'\nALL OK'); process.exit(fails?1:0);
