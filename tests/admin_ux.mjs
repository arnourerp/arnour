import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',pro:'bbbbbbbb-0000-0000-0000-000000000002',v:'cccccccc-0000-0000-0000-000000000003'};
const role={adm:'consultant',pro:'consultant'};
for(const k of ['adm','pro']){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
}
await be.db.query(`insert into admin_emails(email) values ('adm@t.com')`);
async function claim(k,data){ await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`); const r=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data)])).rows[0].x; await be.db.exec('reset role'); return r; }
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'Hello',skills:[{productId:'ecc',moduleId:'fi',projects:4}],specialties:['rise']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

const A=await page('adm'); const V=await page(null);
t('an admin account that once had a profile is treated as admin only',await A.evaluate(()=>APP.backend.isAdmin===true&&!APP.backend.profile&&!APP.db.session));
await go(A,'#/'); 
t('the front door goes to Admin',await A.evaluate(()=>location.hash.indexOf('#/admin')===0),await A.evaluate(()=>location.hash));
await go(A,'#/c/dashboard');
t('professional pages bounce to Admin',await A.evaluate(()=>location.hash.indexOf('#/admin')===0));
await go(A,'#/admin'); await A.waitForSelector('.adm-main h1');
t('sidebar has the five groups',await A.locator('.adm-group').count()===5&&/Overview/.test(await A.textContent('.adm-group-t:first-child'))||await A.locator('.adm-group').count()===5);
const groups=await A.evaluate(()=>[...document.querySelectorAll('.adm-group-t')].map(x=>x.textContent.trim()).join('|'));
t('groups are named clearly',/Overview\|People & roles\|Content\|Communicate\|Settings/.test(groups),groups);
t('settings are split: Site settings and Activity log',await A.locator('a.adm-tab:has-text("Site settings")').count()===1&&await A.locator('a.adm-tab:has-text("Activity log")').count()===1);
await A.click('a.adm-tab:has-text("Activity log")'); await A.waitForFunction(()=>/Activity log/.test((document.querySelector('.adm-main h1')||{}).textContent||''),null,{timeout:15000});
t('activity log page',/Activity log/.test(await A.textContent('.adm-main h1')));
await A.click('a.adm-tab:has-text("Site settings")'); await A.waitForFunction(()=>/Sample content/.test((document.querySelector('.adm-main')||{}).textContent||''),null,{timeout:15000});
t('site settings page has the sample switch',/Sample content/.test(await A.textContent('.adm-main')));
t('the current page is highlighted',await A.locator('a.adm-tab.on').count()===1&&/Site settings/.test(await A.textContent('a.adm-tab.on')));
await A.click('a:has-text("View the site")'); await A.waitForFunction(()=>/^#\/home/.test(location.hash),null,{timeout:15000}); await A.waitForTimeout(300);
t('"View the site" shows the public home, not a loop',await A.evaluate(()=>/^#\/home/.test(location.hash)&&!!document.querySelector('.hero, .nav.pub')));
// phone
const M=await page('adm',390,800); await go(M,'#/admin/catalog'); await M.waitForSelector('.adm-main h1');
t('phone: sidebar is behind a menu button',await M.locator('.adm-menu-btn').isVisible()&&!(await M.locator('.adm-tabs').isVisible()));
await M.click('.adm-menu-btn'); await M.waitForTimeout(200);
t('phone: menu opens, no sideways scroll',await M.locator('.adm-tabs').isVisible()&&await M.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await M.click('a.adm-tab:has-text("Announcements")'); await M.waitForFunction(()=>/Announcements/.test((document.querySelector('.adm-main h1')||{}).textContent||''),null,{timeout:15000});
t('phone: choosing a page closes the menu',/Announcements/.test(await M.textContent('.adm-main h1'))&&!(await M.locator('.adm-tabs').isVisible()));
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
