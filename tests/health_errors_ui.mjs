/* Release 40 in the browser: Health errors, "Fixed" / "Not a bug", the history list, and the network-noise filter */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
for(const f of ['006_feedback.sql','022_staff_messages.sql','023_error_history.sql']) await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f,'utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001'};
be.users['adm@t.com']={id:U.adm,email:'adm@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'tadm'};
await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U.adm,'adm@t.com']);
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U[who],who+'@t.com']);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>{ errors.push((who||'visitor')+' PAGEERR: '+e.message); if(who) console.log('PAGEERR',who,e.message); });
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(500); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;
const log=(m,s='rpc')=>be.db.query(`select log_client_error($1,$2,'#/x','Mozilla/5.0 Safari')`,[m,s]);

/* the visitor's browser: a plain network failure is not recorded, a real error is */
const V=await page(null);
await V.evaluate(()=>{ Promise.reject(new Error('Load failed')); Promise.reject(new Error('Failed to fetch')); Promise.reject(new Error('Cannot read properties of undefined (reading x)')); });
await V.waitForTimeout(1500);
const rec=(await sql(`select message from client_errors`)).map(r=>r.message);
t('"Load failed" and "Failed to fetch" are not logged, a real error still is',rec.length===1&&/Cannot read properties/.test(rec[0]),rec);
await sql(`delete from client_errors where fp is not null`); errors.length=0; /* the visitor errors above were injected on purpose */

/* the admin's Health tab */
await log('RPC thing_a failed: boom'); await log('RPC thing_b failed: bad');
const A=await page('adm');
await go(A,'#/admin/health'); await A.waitForSelector('.adm-table',{timeout:10000});
t('two errors listed, each with Fixed and Not a bug buttons',await A.evaluate(()=>document.querySelectorAll('.adm-table tbody tr').length>=2&&document.querySelectorAll('[data-action=adm-err-resolve][data-o=fixed]').length===2&&document.querySelectorAll('[data-action=adm-err-resolve][data-o=noise]').length===2));
t('the history is closed until asked for',await A.evaluate(()=>/Show the history/.test(document.querySelector('[data-action=adm-err-history]').textContent)));

/* Fixed with a note */
await A.locator('tr:has-text("thing_a") [data-action=adm-err-resolve][data-o=fixed]').click(); await A.waitForSelector('#dlg-note',{timeout:5000});
t('a dialog asks what was done',await A.evaluate(()=>/fixed/i.test(document.querySelector('#dlg-title').textContent)));
await A.fill('#dlg-note','Fixed in release 40'); await A.click('#dlg-ok'); await A.waitForTimeout(900);
t('the error left the list',await A.evaluate(()=>!/thing_a/.test(document.querySelector('.adm-main').textContent.split('Error history')[0])));
const hrow=await sql(`select outcome,note,n from client_errors_history`);
t('it is in the history table with the note',hrow.length===1&&hrow[0].outcome==='fixed'&&hrow[0].note==='Fixed in release 40',hrow);

/* Not a bug, with no note */
await A.locator('tr:has-text("thing_b") [data-action=adm-err-resolve][data-o=noise]').click(); await A.waitForSelector('#dlg-note');
await A.click('#dlg-ok'); await A.waitForTimeout(900);
t('"Not a bug" works without a note',(await sql(`select count(*)::int n from client_errors_history where outcome='noise'`))[0].n===1&&(await sql(`select count(*)::int n from client_errors`))[0].n===0,{h:await sql(`select outcome,message from client_errors_history`),e:await sql(`select message from client_errors`),dlg:await A.evaluate(()=>!!document.querySelector('#dlg-root'))});
t('the empty state shows',await A.evaluate(()=>/No errors recorded/.test(document.querySelector('.adm-main').textContent)));

/* the history list */
await A.click('[data-action=adm-err-history]'); await A.waitForFunction(()=>/Fixed in release 40/.test(document.querySelector('.adm-main').textContent),null,{timeout:10000});
t('the history lists both, with their verdict and note',await A.evaluate(()=>{ const m=document.querySelector('.adm-main').textContent; return /thing_a/.test(m)&&/thing_b/.test(m)&&/Not a bug/.test(m)&&/Fixed in release 40/.test(m); }));
t('the button now says Hide the history',await A.evaluate(()=>/Hide the history/.test(document.querySelector('[data-action=adm-err-history]').textContent)));

/* it comes back */
await log('RPC thing_a failed: boom');
const A2=await page('adm'); await go(A2,'#/admin/health'); await A2.waitForSelector('.adm-table',{timeout:10000}); /* a fresh visit to the admin area */
t('an error that was fixed and returns is marked "Came back"',await A2.evaluate(()=>/Came back/.test(document.querySelector('.adm-table').textContent)));

/* Clear all works and keeps a copy */
await A2.click('[data-action=adm-clear-errors]'); await A2.waitForTimeout(900);
t('Clear all empties the list without an error',(await sql(`select count(*)::int n from client_errors`))[0].n===0&&!errors.some(e=>/WHERE|Could not do that/i.test(e)));
t('the cleared error is kept in the history',(await sql(`select count(*)::int n from client_errors_history where outcome='cleared'`))[0].n===1);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
