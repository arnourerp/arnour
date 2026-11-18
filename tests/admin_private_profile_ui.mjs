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
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead PRIVATE',anon:true,country:'ae',city:'Dubai',nationality:'Indian',languages:['English'],roleType:'functional',roleTypes:['functional'],yearsExp:8,level:'Senior',availability:'Immediate',summary:'SECRET ABOUT',skills:[{productId:'ecc',moduleId:'fi',projects:4}],specialties:['rise']});
await claim('adm',{firstName:'Ann',lastName:'Admin',headline:'Admin',anon:false,country:'ae',skills:[]});
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js*',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
/* admin opens a private professional by a direct link: the anonymous profile with skills (no name, city, about) */
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(400); };
const pid=(await be.db.query(`select id from consultants where owner=$1`,[U.pro])).rows[0].id;
const A=await page('adm'); await go(A,'#/talent/'+pid); await A.waitForSelector('.anon-note',{timeout:10000}).catch(()=>{});
await A.waitForTimeout(500);
const tx=await A.evaluate(()=>document.getElementById('main').innerText);
t('admin sees the private-profile note, not the empty card',/Private profile/.test(tx)&&!/This profile is private/.test(tx),tx.slice(0,300));
t('admin sees the skills and specialties (not "No skills tagged yet")',!/No skills tagged yet/.test(tx)&&/FI/.test(tx),tx.slice(0,600));
t('admin sees the languages',/English/.test(tx),tx.slice(0,600));
t('no name, city, about',!/Pia|Pro\b|Dubai|SECRET ABOUT|Indian/.test(tx.replace(/Private profile|PRIVATE/g,'')),tx.slice(0,600));
t('team message button',await A.locator('#main [data-action=adm-message]').count()>=1);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
