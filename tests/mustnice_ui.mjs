/* Post a role with "Must have" and "Nice to have" (live mode, mock database): two boxes, moving items, saving, and what a professional sees. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const SHOTS=process.env.SHOTS||'';
const U={emp:'aaaaaaaa-0000-0000-0000-000000000001',pro:'cccccccc-0000-0000-0000-000000000003'};
const role={emp:'employer',pro:'consultant'};
for(const k of ['emp','pro']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)]); await be.db.exec('reset role'); }
await claim('emp',{name:'Acme Retail',country:'ae',city:'Dubai',anon:false,industry:'Retail & Consumer Goods (FMCG)',size:'201-500',contactName:'Hana',contactTitle:'HR',sapSystems:['s4onprem'],companyType:'customer'});
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI consultant',anon:false,country:'ae',city:'Dubai',roleTypes:['functional'],yearsExp:4,level:'Mid',languages:['English'],skills:[{productId:'s4onprem',moduleId:'fi',projects:5}]});
async function page(who){
  const ctx=await browser.newContext({viewport:{width:1280,height:1200}});
  await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage(); const errors=[]; p.errors=errors; p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/jd-parse',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:false})}));
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(500); };
const shot=async(p,n)=>{ if(SHOTS) await p.screenshot({path:SHOTS+'/'+n+'.png',fullPage:true}); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

{ const p=await page('emp'); await go(p,'#/e/jobs/new'); await p.waitForSelector('form[data-form=job-post]');
  await p.fill('input[name=title]','SAP FICO Consultant'); await p.selectOption('select[name=roleType]','functional');
  await p.click('.publish-bar button[type=submit]'); await p.waitForTimeout(500);
  t('step 2 shows the Must box, the Nice box stays hidden until asked',await p.evaluate(()=>{ const h=[...document.querySelectorAll('.jw-step[data-step="2"] h3')].map(x=>x.textContent); return /Must have/.test(h[0]||'')&&h.length===2&&!document.querySelector('.box-nice')&&!!document.querySelector('.add-nice-wrap [data-nice]'); }));
  t('the first requirement is in the Must box with no move link (it is the only one)',await p.evaluate(()=>document.querySelectorAll('.jw-step[data-step="2"] .req-list:not(.nice-list) .req-card').length===1&&!document.querySelector('.jw-step[data-step="2"] .req-list:not(.nice-list) [data-action=req-nice]')));
  /* pick FI in S/4HANA on-prem */
  await p.click('.jw-step[data-step="2"] .req-list:not(.nice-list) .mchip[data-mid=fi]'); await p.waitForTimeout(200);
  /* add a nice-to-have product */
  await p.click('[data-action=add-req][data-nice="1"]'); await p.waitForTimeout(300);
  t('Add a nice-to-have product creates a card in the Nice box only',await p.evaluate(()=>document.querySelectorAll('.nice-list .req-card').length===1&&document.querySelectorAll('.req-list:not(.nice-list) .req-card').length===1));
  await p.click('.nice-list .mchip[data-mid=co]'); await p.waitForTimeout(200);
  await p.click('.nice-list .mchip[data-mid=mm]'); await p.waitForTimeout(200);
  t('a second module picked in a Nice card stays in the Nice box, with the Any/All switch',await p.evaluate(()=>document.querySelectorAll('.nice-list .mchip.on').length>=2&&document.querySelectorAll('.nice-list .req-anyall').length===1&&document.querySelectorAll('.req-list:not(.nice-list) .req-card').length===1));
  /* add a second must requirement: goes above the nice one */
  await p.click('[data-action=add-req]:not([data-nice])'); await p.waitForTimeout(300);
  t('a new must requirement lands in the Must box',await p.evaluate(()=>document.querySelectorAll('.req-list:not(.nice-list) .req-card').length===2&&document.querySelectorAll('.nice-list .req-card').length===1));
  await p.locator('.req-list:not(.nice-list) .req-card').nth(1).locator('.mchip[data-mid=sd]').click();
  await p.waitForTimeout(200);
  /* move the second must to nice, then back */
  await p.click('.req-list:not(.nice-list) [data-action=req-nice] >> nth=1'); await p.waitForTimeout(300);
  t('Make it nice to have moves a card to the Nice box',await p.evaluate(()=>document.querySelectorAll('.nice-list .req-card').length===2&&document.querySelectorAll('.req-list:not(.nice-list) .req-card').length===1));
  t('the last must-have has no move link (at least one must stays)',await p.evaluate(()=>!document.querySelector('.req-list:not(.nice-list) [data-action=req-nice]')));
  /* the "About the candidate" table: Nice | Must per row */
  t('the candidate table has the rows and no duplicate fields',await p.evaluate(()=>{ const r=[...document.querySelectorAll('.crit-row .crit-l .label')].map(x=>x.firstChild.textContent.trim()); return ['Seniority','Minimum experience (years)','SAP certification','Languages','Specialties','Industries'].every(x=>r.includes(x))&&document.querySelectorAll('select[name=level]').length===1&&document.querySelectorAll('select[name=certification]').length===1; }));
  await p.selectOption('select[name=level]','Senior');
  await p.click('.mn-sw [data-key=level][data-val=must]'); await p.waitForTimeout(300);
  t('Must switch is on for seniority and the value stays',await p.evaluate(()=>!!document.querySelector('.mn-sw [data-key=level][data-val=must].on')&&document.querySelector('select[name=level]').value==='Senior'));
  await p.fill('input[name=minExp]','8');
  await p.selectOption('select[name=certification]','required');
  await p.click('.mn-sw [data-key=lang][data-val=must]'); await p.waitForTimeout(300);
  await p.click('.crit-row:has-text("Languages") .chip-wrap button >> nth=0'); await p.waitForTimeout(200);
  await p.click('.mn-sw [data-key=spec][data-val=must]'); await p.waitForTimeout(300);
  t('Must switch for specialties shows the "at least one" hint',await p.evaluate(()=>/at least one/i.test(document.querySelector('.crit-table').textContent)));
  await p.locator('.req-list:not(.nice-list) [data-action=req-shut]').first().click(); await p.waitForTimeout(300);
  t('Done collapses a card to one line',await p.evaluate(()=>!!document.querySelector('.req-list:not(.nice-list) .req-compact')&&!document.querySelector('.req-list:not(.nice-list) .mchip')));
  await p.locator('.req-list:not(.nice-list) .req-compact [data-action=req-shut]').first().click(); await p.waitForTimeout(300);
  t('Edit brings the modules back',await p.evaluate(()=>!document.querySelector('.req-list:not(.nice-list) .req-compact')&&!!document.querySelector('.req-list:not(.nice-list) .mchip.on')));
  await shot(p,'form-step2');
  t('the summary under the Must box names the nice-to-have',await p.evaluate(()=>/Nice to have/.test(document.querySelector('#req-summary').textContent)));
  await p.click('.publish-bar button[type=submit]'); await p.waitForTimeout(400);
  await shot(p,'form-step3');
  await p.click('.publish-bar button[type=submit]'); await p.waitForTimeout(1200);
  const row=(await sql(`select data from jobs where data->>'title'='SAP FICO Consultant'`))[0];
  t('the role was saved',!!row);
  const d=row&&row.data;
  t('saved: one must row, nice rows flagged, seniority flagged as must',d&&d.requires.filter(r=>!r.nice).length===1&&d.requires.filter(r=>r.nice).length===3&&d.requires.filter(r=>r.nice&&r.cid===2).length===2&&d.mustLevel===true&&!d.mustExp&&d.certification==='required'&&d.mustSpec===true&&(d.languages||[]).length===1&&!(d.preferredLangs||[]).length,d&&{r:d.requires,ml:d.mustLevel,l:d.languages});
  t('saved: the must row comes first',d&&!d.requires[0].nice&&d.requires[0].moduleId==='fi');
  t('no page errors (employer)',p.errors.length===0,p.errors); await p.context().close(); }

{ const p=await page('pro'); const id=(await sql(`select id from jobs where data->>'title'='SAP FICO Consultant'`))[0].id;
  await p.evaluate(()=>{ try{ APP.db.session && 0; }catch(e){} });
  await p.reload(); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
  await go(p,'#/job/'+id); await p.waitForSelector('.jd-reqs',{timeout:8000});
  const txt=await p.evaluate(()=>document.querySelector('.jd-main').innerText);
  t('professional sees Must have and Nice to have groups',/MUST HAVE/i.test(txt)&&/NICE TO HAVE/i.test(txt),txt.slice(0,400));
  t('a missing nice-to-have is grey, not red',await p.evaluate(()=>{ const sec=[...document.querySelectorAll('.jd-sec h3')].find(h=>/nice/i.test(h.textContent)); const ul=sec&&sec.nextElementSibling; return !!ul&&!ul.querySelector('.st-no'); }));
  t('Mid-level professional vs must Senior is shown as not met (red) under Must have',await p.evaluate(()=>{ const sec=[...document.querySelectorAll('.jd-sec h3')].find(h=>/must/i.test(h.textContent)); const li=[...sec.nextElementSibling.querySelectorAll('li.jd-req')].find(x=>/Seniority/i.test(x.textContent)); return !!li&&li.classList.contains('st-no'); }));
  await shot(p,'job-page');
  t('no page errors (professional)',p.errors.length===0,p.errors); await p.context().close(); }

await browser.close(); console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
