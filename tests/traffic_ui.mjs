/* Release 41 in the browser: Traffic tab, numbers and split on the sign-up chart, plain labels, admin visits not counted */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/024_traffic.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002'};
for(const k of ['adm','pro']){ be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'t'+k}; await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']); }
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U.pro}',false); set role authenticated;`);
await be.db.query(`select claim_profile('consultant','{"firstName":"Pia","lastName":"Pro"}'::jsonb)`); await be.db.exec('reset role');
for(const n of ['v:home','v:home','v:job','v:register','lnd:facebook','lnd:facebook','conv:c:facebook','apply','ext_apply','v:admin']) await be.db.query(`select track_usage($1)`,[n]);
async function page(who){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  if(who) await ctx.addInitScript(([id,em])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:'consultant'}}})); }catch(e){} },[U[who],who+'@t.com']);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(600); };
const before=(await be.db.query(`select coalesce(sum(n),0)::int n from usage_counts`)).rows[0].n;
const A=await page('adm');
await go(A,'#/admin/overview'); await A.waitForSelector('.adm-bars-n',{timeout:10000});
t('every bar shows its number',await A.evaluate(()=>{ const b=[...document.querySelectorAll('.adm-bars-n .adm-bar b')].map(x=>x.textContent); return b.length===14&&b.includes('2'); }));
t('today shows one profile and one without',await A.evaluate(()=>{ const c=[...document.querySelectorAll('.adm-bars-n .adm-bar')].pop(); return c.querySelectorAll('.adm-bar-col i').length===2&&c.querySelectorAll('.adm-np').length===1; }));
t('the chart has a legend',await A.evaluate(()=>/Profile completed/.test(document.querySelector('.adm-legend').textContent)&&/No profile yet/.test(document.querySelector('.adm-legend').textContent)));
t('Traffic is in the sidebar',await A.evaluate(()=>!![...document.querySelectorAll('.adm-tab')].find(a=>/Traffic/.test(a.textContent))));

await go(A,'#/admin/traffic'); await A.waitForSelector('.adm-total',{timeout:10000}).catch(async e=>{ console.log('MAIN:',(await A.textContent('.adm-main')).slice(0,300)); throw e; });
t('14 days by default, the switch offers 7 / 14 / 30',await A.evaluate(()=>{ const c=[...document.querySelectorAll('[data-action=adm-traffic-days]')]; return c.length===3&&c.find(x=>/14/.test(x.textContent)).classList.contains('chip-on'); }));
const tot=await A.evaluate(()=>[...document.querySelectorAll('.adm-total td')].map(x=>x.textContent.trim()));
t('totals: 2 visitors, 3 page views (admin views left out), 1 sign-up page view, 2 accounts, 1 profile',tot[1]==='2'&&tot[2]==='4'&&tot[5]==='1'&&tot[6]==='2'&&tot[7]==='1'&&tot[8]==='1'&&tot[9]==='1',tot);
t('the funnel lists the five steps',await A.evaluate(()=>['New visitors','Views of the sign-up page','Accounts created','Profile completed','Applied or clicked apply'].every(s=>document.querySelector('.adm-main').textContent.indexOf(s)>-1)));
t('sources table shows facebook',await A.evaluate(()=>/facebook/.test(document.querySelector('.adm-main').textContent)));
t('the Admin row is not listed in the pages table',await A.evaluate(()=>!/Admin \(your own visits\)/.test([...document.querySelectorAll('.adm-main h2')].find(h=>/Pages/.test(h.textContent)).nextElementSibling.textContent)));
await A.click('[data-action=adm-traffic-days][data-n="7"]'); await A.waitForTimeout(800);
t('switching to 7 days gives 7 day rows',await A.evaluate(()=>document.querySelectorAll('.adm-table-num')[0].querySelectorAll('tbody tr').length===8));

/* plain labels in Health */
await go(A,'#/admin/health'); await A.waitForSelector('.adm-table',{timeout:10000}); await A.waitForTimeout(500);
t('Health usage table shows plain names next to the codes',await A.evaluate(()=>/Role pages — views/.test(document.querySelector('.adm-main').textContent)&&/New visitors from facebook/.test(document.querySelector('.adm-main').textContent)));

/* the admin's own browsing is not counted */
for(const h of ['#/home','#/admin/overview','#/admin/traffic']) await go(A,h);
await A.waitForTimeout(800);
const after=(await be.db.query(`select coalesce(sum(n),0)::int n from usage_counts`)).rows[0].n;
t('admin browsing adds no counts',after===before,{before,after});
const V=await page(null); await go(V,'#/login'); await V.waitForTimeout(800);
t('a visitor is still counted',(await be.db.query(`select coalesce(sum(n),0)::int n from usage_counts where name='v:login'`)).rows[0].n>=1);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
