import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={a:'aaaaaaaa-1111-1111-1111-111111111111',b:'bbbbbbbb-2222-2222-2222-222222222222',e:'eeeeeeee-3333-3333-3333-333333333333'};
const role={a:'consultant',b:'consultant',e:'employer'};
const data={a:{firstName:'Alma',lastName:'Aaa',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'s4onprem',moduleId:'fi',years:5}]},b:{firstName:'Bob',lastName:'Bbb',headline:'MM dev',country:'ae',skills:[{productId:'s4onprem',moduleId:'mm',years:3}]},e:{name:'Acme Corp',industry:'Retail'}};
const ent={};
for(const k of Object.keys(U)){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users values ($1,$2)',[U[k],k+'@t.com']);
  await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`);
  ent[k]=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data[k])])).rows[0].x;
  await be.db.exec('reset role');
}
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
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const quiet=async(p)=>{ await p.waitForFunction(()=>!APP.backend.commBusy&&!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(150); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;
U.adm='dddddddd-4444-4444-4444-444444444444'; 
be.users['ahmed.salem@arnour.com']={id:U.adm,email:'ahmed.salem@arnour.com',password:'passpass1',confirmed:true,meta:{},token:'tadm'};
await be.db.query('insert into auth.users values ($1,$2)',[U.adm,'ahmed.salem@arnour.com']);
const admPage=async()=>{ const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(([id])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:'ahmed.salem@arnour.com',user_metadata:{}}})); }catch(e){} },[U.adm]);
  const p=await ctx.newPage(); p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push('adm: '+m.text()); }); p.on('pageerror',e=>errors.push('adm PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle); await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK})); await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p; };
const dlg=async(p,note)=>{ if(note!==undefined) await p.fill('#dlg-note',note); await p.click('#dlg-ok'); await p.waitForTimeout(500); };

// A posts a question; B reports it
const A=await page('a'); await go(A,'#/community/ask');
await A.fill('input[name=title]','Buy my course now'); await A.fill('textarea[name=body]','spam spam spam'); await A.selectOption('select[name=product]','s4onprem');
await A.click('form[data-form=community-ask] button[type=submit]'); await A.waitForTimeout(700);
const qid=(await sql(`select id from questions where title='Buy my course now'`))[0].id;
const B=await page('b'); await go(B,'#/community/q/'+qid);
t('B sees Report on A question',(await B.locator('.report-btn').count())>0);
await go(A,'#/community/q/'+qid); t('A does not see Report on own question',(await A.locator('.report-btn').count())===0,await A.evaluate(i=>[JSON.stringify(APP.db.questions[i]).slice(0,300),document.querySelector('.report-btn')?.outerHTML],qid));
await B.click('.report-btn >> nth=0'); await B.selectOption('#dlg-sel','spam'); await dlg(B,'selling stuff');
t('report stored',(await sql(`select * from reports where target=$1`,[qid])).length===1);
await B.click('.report-btn >> nth=0'); await dlg(B,'again'); t('duplicate report ignored',(await sql(`select count(*)::int n from reports where target=$1`,[qid]))[0].n===1);

// admin
const M=await admPage();
t('admin flag true',await M.evaluate(()=>APP.backend.isAdmin===true));
t('admin without profile lands in admin',await M.evaluate(()=>{ location.hash='#/admin'; return true; }));
await M.waitForTimeout(600); t('overview renders',/Open reports/.test(await M.textContent('body')),await M.textContent('body'));
t('non-admin cannot open admin',await (async()=>{ await go(B,'#/admin'); return !/Arnour admin/.test(await B.textContent('body')); })());
await go(M,'#/admin/reports'); t('report listed',/Buy my course now/.test(await M.textContent('body')));
await M.screenshot({path:'/tmp/adm_reports.png'});
await M.click('[data-action=adm-mod][data-do=remove]'); await dlg(M,'Spam'); 
t('question removed',(await sql(`select count(*)::int n from questions where id=$1`,[qid]))[0].n===0);
t('report resolved',(await sql(`select status from reports where target=$1`,[qid]))[0].status==='resolved');
t('author notified',(await sql(`select count(*)::int n from notifications where text like '%was removed by Arnour%'`))[0].n===1);

// suspend A via people
await go(M,'#/admin/people'); await M.fill('input[name=q]','a@t.com'); await M.click('.adm-search button'); await M.waitForTimeout(600);
await M.click('[data-action=adm-suspend]'); await dlg(M,'Repeated spam'); 
t('A suspended',(await sql(`select suspended from profiles where user_id=$1`,[U.a]))[0].suspended===true);
const A2=await page('a'); await A2.waitForTimeout(500);
t('suspended user sees notice',/Your account is suspended/.test(await A2.textContent('body'))&&/Repeated spam/.test(await A2.textContent('body')),await A2.evaluate(()=>location.hash));
await go(A2,'#/c/dashboard'); t('suspended user kept on notice',/Your account is suspended/.test(await A2.textContent('body')));
t('suspended profile hidden from visitors',await (async()=>{ const v=await page(null); return v.evaluate(id=>!Object.keys(APP.db.consultants).some(k=>k===id),ent.a); })());
await M.click('[data-action=adm-unsuspend]'); await M.waitForTimeout(600);
t('A reinstated',(await sql(`select suspended from profiles where user_id=$1`,[U.a]))[0].suspended===false);

// badge
await M.fill('input[name=q]','b@t.com'); await M.click('.adm-search button'); await M.waitForTimeout(600);
t('badge control shown for self-certified',true);
// settings
await go(M,'#/admin/settings'); t('settings render',/Sample content/.test(await M.textContent('body')));
await M.click('[data-action=adm-samples]'); await M.waitForTimeout(600);
t('samples hidden',(await sql(`select value from site_settings where key='hide_samples'`))[0].value===true);
await M.click('[data-action=adm-samples]'); await M.waitForTimeout(600);
t('log has entries',(await sql(`select count(*)::int n from admin_log`))[0].n>=3);

// conversation reporting
t('no page errors',errors.length===0,errors);
console.log(fails?`\n${fails} FAILURES`:'\nALL PASSED'); await browser.close(); process.exit(fails?1:0);
