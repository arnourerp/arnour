/* Release 57: certifications in the app: the Edit profile tab, the box on the profile page, what a company sees, the admin list (Credly stubbed, real database behind) */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import crypto from 'crypto'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
for(const f of ['027_job_drafts','016_jd_import','035_job_to_draft','036_job_feed','037_credentials']) await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const fn=require(process.env.ARNOUR_ROOT+'/netlify/functions/cred-verify.js'); const run=fn._run;
const CFG={on:true,who:'pro'}; const secret='z'.repeat(40);
const B1='23c377e2-e43b-41d5-9595-acc4c8cdf86f', B2='99999999-8888-7777-6666-555555555555', B3='77777777-8888-7777-6666-555555555555';
const BADGE=(o)=>Object.assign({state:'accepted',public:true,is_private_badge:false,issued_at_date:'2024-12-18',expires_at_date:'2025-12-31',issued_to:'Pia PRO',image_url:'https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png',issuer:{entities:[{entity:{name:'SAP'}}]},badge_template:{name:'Positioning SAP Business AI – Record of Achievement',type_category:'Learning'}},o||{});
let reply={status:200,json:{data:BADGE()}};
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',pro2:'dddddddd-0000-0000-0000-000000000004',emp:'eeeeeeee-0000-0000-0000-000000000005'};
const role={adm:'consultant',pro:'consultant',pro2:'consultant',emp:'employer'};
for(const k of ['adm','pro','pro2','emp']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:4}],specialties:['rise']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
await claim('pro2',{firstName:'Paula',lastName:'Second',headline:'MM lead',anon:false,country:'ae',skills:[]});
await claim('emp',{name:'Acme Corp',country:'ae'});
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/cred-verify',async r=>{ const rq=r.request(); if(rq.method()==='GET') return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:CFG.on})}); CFG.who=who; const out=await fn.handler({httpMethod:'POST',headers:rq.headers(),body:rq.postData()||''}); r.fulfill({status:out.statusCode,headers:out.headers,body:out.body}); });
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const location_ok=(h)=>/#\/c\/profile/.test(h);
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;
await be.db.query(`update job_feed_worker set secret_hash=$1 where id=1`,[crypto.createHash('sha256').update(secret).digest('hex')]);
run.setDeps({secret:()=>secret,fetchBadge:async()=>typeof reply==='function'?reply():reply,
  rpc:async(auth,name,args)=>{ const a=Object.assign({},args||{}); if(auth.secret) a.p_secret=auth.secret; const r=JSON.parse(await be.handle(JSON.stringify({t:'rpc',uid:U[CFG.who],fn:name,args:a}))); if(r.error) throw new Error(r.error.message); return r.data; }});
const proCreds=async()=>(await sql(`select title, ext_id, name_ok, expires::text e from credentials where consultant_id=(select entity_id from profiles where user_id=$1) order by created_at`,[U.pro]));
const P=await page('pro');
await go(P,'#/c/profile'); await P.waitForSelector('[data-action=profile-edit-on]');
await P.click('[data-action=profile-edit-on]'); await P.waitForSelector('.pe-nav');
t('a Certifications tab sits in Edit profile (7 tabs now)',await P.locator('.pe-tab').count()===7&&await P.locator('.pe-tab[data-s=certs]').count()===1);
t('Certifications is optional: the completeness figure is unchanged by it',/\d+% complete/.test(await P.textContent('.pe-pct')));
await P.click('.pe-tab[data-s=certs]');
t('the pane has the box, the button and the help',await P.locator('.cr-input').isVisible()&&await P.locator('[data-action=cert-add]').isVisible()&&await P.locator('.cr-help').count()===1);
t('empty at first',/No certifications added yet/.test(await P.textContent('.cr-list')));

/* the prompt after sign-up: on the dashboard, once, for a professional with SAP skills and no badge */
const D=await page('pro'); await go(D,'#/c/dashboard'); await D.waitForTimeout(600);
t('dashboard: a professional with skills and no badge sees the certification prompt',await D.locator('.cr-prompt').count()===1&&/Prove your SAP certifications/.test(await D.textContent('.cr-prompt')));
t('dashboard: the prompt sits above the cards and says what companies see',/never your link/.test(await D.textContent('.cr-prompt')));
await D.click('[data-action=cert-prompt-go]'); await D.waitForSelector('.cr-input',{timeout:4000}).catch(()=>{});
t('"Add a badge" opens Edit profile on the Certifications tab',await D.locator('.cr-input').isVisible().catch(()=>false)&&location_ok(await D.evaluate(()=>location.hash)));
const D2=await page('pro'); await go(D2,'#/c/dashboard'); await D2.waitForTimeout(600); await D2.click('[data-action=cert-prompt-off]'); await D2.waitForTimeout(300);
t('"Not now" hides the prompt',await D2.locator('.cr-prompt').count()===0);
await D2.reload(); await D2.waitForTimeout(1200); await go(D2,'#/c/dashboard'); await D2.waitForTimeout(600);
t('"Not now" stays hidden after a reload',await D2.locator('.cr-prompt').count()===0);
const D3=await page('pro'); await go(D3,'#/c/dashboard'); await D3.waitForTimeout(600);
await D3.evaluate(()=>{ const m=APP.db.consultants[APP.db.session.consultantId]; m.creds=[{id:'x',title:'T',issuer:'SAP',kind:'Certification',issued:'2025-01-01',expires:''}]; APP.render(); });
t('with a badge the prompt is gone',await D3.locator('.cr-prompt').count()===0);
const DM=await page('pro',390,800); await go(DM,'#/c/dashboard'); await DM.waitForTimeout(600);
t('phone: the prompt fits without sideways scroll',await DM.locator('.cr-prompt').count()===1&&await DM.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));

/* a wrong link never reaches Credly and saves nothing */
await P.fill('.cr-input','https://example.com/badges/'+B1); await P.click('[data-action=cert-add]'); await P.waitForTimeout(500);
t('a link that is not Credly gets a clear message',/not a Credly badge link/.test(await P.textContent('.cr-msg')));
await P.fill('.cr-input',''); await P.click('[data-action=cert-add]'); await P.waitForTimeout(200);
t('an empty box asks for the link',/Paste the link/.test(await P.textContent('.cr-msg')));
t('nothing was saved by the mistakes',(await proCreds()).length===0);

/* the real badge: Enter in the box adds it and does not save the whole profile form */
const headBefore=(await sql(`select data->>'headline' h from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].h;
await P.evaluate(()=>{ const i=document.querySelector('[data-pane=basics] [name=headline]'); i.value='Changed but not saved yet'; i.dispatchEvent(new Event('input',{bubbles:true})); });
await P.fill('.cr-input','https://www.credly.com/badges/'+B1+'/public_url'); await P.press('.cr-input','Enter'); await P.waitForSelector('.cr-row',{timeout:5000});
t('Enter adds the badge: title, issuer, dates, Verified, Expired',await P.evaluate(()=>{ const r=document.querySelector('.cr-row'); const x=r.textContent; return /Positioning SAP Business AI/.test(x)&&/SAP/.test(x)&&/Learning/.test(x)&&/18 Dec 2024/.test(x)&&/Expired 31 Dec 2025/.test(x)&&/Verified via Credly/.test(x)&&!!r.querySelector('.cr-chip.exp'); }));
t('the badge picture shows next to the tick on the row',await P.evaluate(()=>{ const i=document.querySelector('.cr-row .cr-badge img'); return !!i&&i.getAttribute('src')==='https://images.credly.com/images/6c9f1d3c-aaaa-4bbb-8ccc-0123456789ab/image.png'&&!!document.querySelector('.cr-row .cr-badge .cr-tick')&&i.getAttribute('referrerpolicy')==='no-referrer'; }));
t('the page is still in edit mode and the other fields were not saved by Enter',await P.locator('.pe-nav').isVisible()&&(await sql(`select data->>'headline' h from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].h===headBefore);
t('the badge is in the database, saved right away, name matches',(await proCreds()).length===1&&(await proCreds())[0].ext_id===B1&&(await proCreds())[0].name_ok===true&&(await proCreds())[0].e==='2025-12-31');
t('the owner sees the name match note and the Credly link, only in the editor',/matches your profile/.test(await P.textContent('.cr-row'))&&await P.locator('.cr-row a[href*="credly.com/badges/'+B1+'"]').count()===1);
t('the tab shows the count',/1 verified/.test(await P.textContent('.pe-tab[data-s=certs]')));
await P.fill('.cr-input','https://www.credly.com/badges/'+B1); await P.click('[data-action=cert-add]'); await P.waitForTimeout(600);
t('adding the same badge again does not duplicate it',await P.locator('.cr-row').count()===1&&/already on your profile|up to date/.test(await P.textContent('.cr-msg')));

/* a badge that someone else claimed */
await sql(`select 1`); 
{ const e2=(await sql(`select entity_id from profiles where user_id=$1`,[U.pro2]))[0].entity_id; await sql(`insert into credentials(consultant_id,ext_id,title) values ($1,$2,'Taken badge')`,[e2,B2]); }
await P.fill('.cr-input','https://www.credly.com/badges/'+B2); await P.click('[data-action=cert-add]'); await P.waitForTimeout(600);
t('a badge already on another profile is refused',/already on another Arnour profile/.test(await P.textContent('.cr-msg'))&&await P.locator('.cr-row').count()===1);
/* Credly not answering, private, a different name */
reply={status:503}; await P.fill('.cr-input','https://www.credly.com/badges/'+B3); await P.click('[data-action=cert-add]'); await P.waitForTimeout(600);
t('Credly not answering says so and saves nothing',/Credly did not answer/.test(await P.textContent('.cr-msg'))&&(await proCreds()).length===1);
reply={status:200,json:{data:BADGE({public:false})}}; await P.click('[data-action=cert-add]'); await P.waitForTimeout(600);
t('a private badge tells the person how to make it public',/private/.test(await P.textContent('.cr-msg')));
reply={status:200,json:{data:BADGE({issued_to:'Someone Else',expires_at_date:'2099-01-01',badge_template:{name:'SAP Certified Associate – Finance',type_category:'Certification'}})}};
await P.click('[data-action=cert-add]'); await P.waitForTimeout(700);
t('a different name on the badge: added, with a note only the owner sees',await P.locator('.cr-row').count()===2&&/different from your profile name/.test(await P.textContent('.cr-list'))&&(await proCreds()).some(c=>c.name_ok===false));
t('a valid badge has no Expired mark and no Check again',await P.evaluate(()=>{ const rs=[...document.querySelectorAll('.cr-row')]; const v=rs.find(r=>/Certified Associate/.test(r.textContent)); return !!v&&!v.querySelector('.cr-chip.exp')&&!v.querySelector('[data-action=cert-check]'); }));

/* expired: Check again picks up a renewal */
t('the expired badge offers Check again',await P.locator('.cr-row.is-exp [data-action=cert-check]').count()===1);
reply={status:200,json:{data:BADGE({expires_at_date:'2099-12-31'})}};
await P.click('.cr-row.is-exp [data-action=cert-check]'); await P.waitForTimeout(700);
t('after Check again the renewed date shows and the Expired mark is gone',await P.locator('.cr-row.is-exp').count()===0&&/Valid until 31 Dec 2099/.test(await P.textContent('.cr-list'))&&(await proCreds()).some(c=>c.e==='2099-12-31'));

/* Save changes keeps the badges, a later save cannot lose them */
await P.click('.pe-tab[data-s=basics]'); await P.click('.edit-foot button[type=submit]'); await P.waitForTimeout(800);
t('saving the profile keeps the headline and the badges',(await sql(`select data from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].data.headline==='Changed but not saved yet'&&(await proCreds()).length===2&&(await sql(`select jsonb_array_length(data->'creds') n from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].n===2);

/* the profile page */
await go(P,'#/c/profile'); await P.waitForTimeout(400);
t('your profile page shows the Certifications box with both badges, ticks and the note for you',await P.evaluate(()=>{ const c=document.querySelector('.cr-card'); return !!c&&/Certifications/.test(c.textContent)&&c.querySelectorAll('.cr-row').length===2&&/Companies see this box/.test(c.textContent); }));
t('the box on your profile page has no link and no name',await P.evaluate(()=>{ const c=document.querySelector('.cr-card'); return !c.querySelector('a')&&!/credly\.com|Someone Else|PRO/.test(c.innerHTML)&&!c.querySelector('[data-action^=cert-]'); }));

/* a company sees it, without link or name */
const E=await page('emp'); const eid=(await sql(`select entity_id from profiles where user_id=$1`,[U.pro]))[0].entity_id;
await go(E,'#/e/talent/'+eid); await E.waitForTimeout(700);
const ehtml=await E.evaluate(()=>{ const c=document.querySelector('.jd-main .cr-list'); return c?c.innerHTML:''; });
t('a company sees the badges (title, issuer, dates, tick)',/Positioning SAP Business AI/.test(ehtml)&&/Certified Associate/.test(ehtml)&&/Verified via Credly/.test(ehtml)&&/Valid until/.test(ehtml));
t('a company sees no Credly link, no Credly id, no name check, no buttons',!/credly\.com|href=|Someone Else|different from your profile|data-action/.test(ehtml.replace(/https:\/\/images\.credly\.com\/[A-Za-z0-9\/_.%-]+/g,''))&&!ehtml.includes(B1));
t('a company sees the badge picture (the shared badge design, not a person link)',/<img src="https:\/\/images\.credly\.com\//.test(ehtml));
t('a company has no Certifications tab or box to edit',await E.locator('.pe-tab').count()===0);


/* remove */
await P.click('[data-action=profile-edit-on]'); await P.waitForSelector('.pe-nav'); await P.click('.pe-tab[data-s=certs]');
await P.click('.cr-row:has-text("Positioning") [data-action=cert-remove]'); await P.waitForTimeout(600);
t('Remove takes the badge off at once (table and profile)',await P.locator('.cr-row').count()===1&&(await proCreds()).length===1&&(await sql(`select jsonb_array_length(data->'creds') n from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].n===1);

/* admin */
const A=await page('adm'); await go(A,'#/admin/certs'); await A.waitForSelector('#adm-cert-table',{timeout:8000});
t('admin: the list shows who, the badge, the name check and a Credly link',await A.evaluate(()=>{ const t=document.getElementById('adm-cert-table').textContent; return /Pia Pro/.test(t)&&/Different from profile|Matches/.test(t)&&/Open on Credly/.test(t); }));
t('admin: a name that is different is listed first',await A.evaluate(()=>/Different from profile/.test(document.querySelector('#adm-cert-table tbody tr').textContent)));
t('admin: the sidebar has a Certifications entry',await A.locator('.adm-tab:has-text("Certifications")').count()===1);
await A.click('#adm-cert-table [data-action=adm-cred-remove]'); await A.waitForSelector('.modal button.btn-danger, [role=dialog] button.btn-danger, .dlg button.btn-danger',{timeout:4000}).catch(()=>{});
await A.evaluate(()=>{ const b=[...document.querySelectorAll('button')].filter(x=>/^Remove$/.test(x.textContent.trim())&&x.closest('[role=dialog],.modal,.dlg,.dialog')); if(b[0]) b[0].click(); }); await A.waitForTimeout(800);
t('admin: Remove asks first, then removes the badge from the profile',(await sql(`select count(*)::int n from credentials where title='Taken badge' or consultant_id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].n===1&&(await sql(`select count(*)::int n from admin_log where action='cred_remove'`))[0].n===1);

/* a private (anonymous) profile still shows the badges, to companies and to other professionals, but never the name */
await sql(`update consultants set anon=true, data=jsonb_set(data,'{anon}','true') where id=$1`,[eid]);
await sql(`insert into credentials(consultant_id,ext_id,title,issuer,kind,issued,expires,name_ok) values ($1,'aaaaaaaa-1111-2222-3333-444444444444','SAP Certified Associate - Finance','SAP','Certification','2025-05-01','2099-01-01',true) on conflict do nothing`,[eid]);
await sql(`update consultants set data=data||jsonb_build_object('creds',(select jsonb_agg(jsonb_build_object('id',id::text,'title',title,'issuer',issuer,'kind',kind,'issued',issued,'expires',expires)) from credentials where consultant_id=$1)) where id=$1`,[eid]);
const E2=await page('emp'); await go(E2,'#/e/talent/'+eid); await E2.waitForTimeout(700);
const ph=await E2.evaluate(()=>({card:(document.querySelector('.jd-main .cr-list')||{}).innerHTML||'',body:document.body.innerText}));
t('anonymous profile seen by a company: the badge box is there',/SAP Certified Associate - Finance/.test(ph.card)&&/Verified via Credly/.test(ph.card),ph.body.slice(0,300));
t('anonymous profile seen by a company: no name, no Credly link',!/\bPia\b|Pia Pro/.test(ph.body)&&!/credly\.com/.test(ph.card));
const P2=await page('pro2'); await go(P2,'#/talent/'+eid); await P2.waitForTimeout(700);
const ph2=await P2.evaluate(()=>({card:(document.querySelector('.cr-card')||{}).innerHTML||'',body:document.body.innerText}));
t('anonymous profile seen by another professional: the badge box is there, no name',/SAP Certified Associate - Finance/.test(ph2.card)&&!/\bPia\b/.test(ph2.body),ph2.body.slice(0,300));


/* not switched on: no tab at all */
CFG.on=false; const Q=await page('pro'); await go(Q,'#/c/profile'); await Q.click('[data-action=profile-edit-on]'); await Q.waitForSelector('.pe-nav');
t('when the function is not switched on there is no Certifications tab',await Q.locator('.pe-tab').count()===6&&await Q.locator('.pe-tab[data-s=certs]').count()===0);
const Q2=await page('pro'); await go(Q2,'#/c/dashboard'); await Q2.waitForTimeout(600);
t('when the function is not switched on there is no prompt',await Q2.locator('.cr-prompt').count()===0);
CFG.on=true;

/* phone */
const M=await page('pro',390,800); await go(M,'#/c/profile'); await M.click('[data-action=profile-edit-on]'); await M.waitForSelector('.pe-nav'); await M.click('.pe-tab[data-s=certs]'); await M.waitForTimeout(300);
t('phone: no sideways scroll on the Certifications tab',await M.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
