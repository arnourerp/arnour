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

const P=await page('pro');
await go(P,'#/c/profile'); await P.waitForSelector('[data-action=profile-edit-on]');
await P.click('[data-action=profile-edit-on]'); await P.waitForSelector('.pe-nav');
t('five sections in a side menu',await P.locator('.pe-tab').count()===5);
t('shows a completeness figure',/\d+% complete/.test(await P.textContent('.pe-pct')));
t('only the first section is showing',await P.evaluate(()=>[...document.querySelectorAll('.pe-pane')].filter(x=>!x.hidden).map(x=>x.dataset.pane).join()==='basics'));
t('basics holds names, role and country',await P.locator('.pe-pane[data-pane=basics] [name=firstName]').isVisible()&&await P.locator('.pe-pane[data-pane=basics] [name=country]').isVisible());
await P.click('.pe-tab[data-s=skills]');
t('skills section opens and the basics fields hide',await P.locator('.pe-pane[data-pane=skills] .skill-rows').isVisible()&&!(await P.locator('.pe-pane[data-pane=basics] [name=firstName]').isVisible()));
await P.click('.pe-tab[data-s=about]'); await P.fill('.pe-pane[data-pane=about] [name=summary]','Updated summary text');
await P.click('.pe-tab[data-s=basics]'); await P.fill('[name=headline]','Senior FI lead');
await P.click('.pe-tab[data-s=experience]'); await P.fill('[name=yearsExp]','9');
t('typing in one section survives moving between sections',await P.inputValue('.pe-pane[data-pane=about] [name=summary]',{timeout:2000}).catch(()=>'x')==='Updated summary text');
await P.click('.pe-step [data-action=psec]:has-text("Next")'); 
t('Next moves to the following section',await P.evaluate(()=>[...document.querySelectorAll('.pe-pane')].filter(x=>!x.hidden).map(x=>x.dataset.pane).join()==='skills'));
await P.click('#f-profile-edit button[type=submit], .edit-foot button[type=submit]'); await P.waitForTimeout(700);
t('save from any section stores every section',(await sql(`select data from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].data.headline==='Senior FI lead'&&(await sql(`select data from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].data.summary==='Updated summary text'&&(await sql(`select data from consultants where id=(select entity_id from profiles where user_id=$1)`,[U.pro]))[0].data.yearsExp===9);
// a missing required field sends you to the right section
await P.click('[data-action=profile-edit-on]'); await P.waitForSelector('.pe-nav');
await P.click('.pe-tab[data-s=basics]'); await P.selectOption('[name=country]','');
await P.click('.pe-tab[data-s=about]');
await P.click('.edit-foot button[type=submit]'); await P.waitForTimeout(500);
t('a missing country jumps back to Basics',await P.evaluate(()=>[...document.querySelectorAll('.pe-pane')].filter(x=>!x.hidden).map(x=>x.dataset.pane).join()==='basics'));
const p2=await page('pro',390,800); await go(p2,'#/c/profile'); await p2.click('[data-action=profile-edit-on]'); await p2.waitForSelector('.pe-nav');
t('phone: no sideways scroll, sections as tabs',await p2.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1&&getComputedStyle(document.querySelector('.pe-nav')).flexDirection==='row'));
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
