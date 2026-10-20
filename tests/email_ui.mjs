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
// ---- account page: email settings
const A=await page('a');
await go(A,'#/account'); await A.waitForTimeout(500);
t('email section on the account page',/Email notifications/.test(await A.textContent('#main'))&&await A.locator('form[data-form=live-email]').count()===1);
t('professional sees job matches, daily by default',(await A.inputValue('form[data-form=live-email] select[name=ep_matches]'))==='daily');
t('no applicants setting for professionals',await A.locator('form[data-form=live-email] select[name=ep_applicants]').count()===0);
await A.selectOption('form[data-form=live-email] select[name=ep_matches]','weekly');
await A.uncheck('form[data-form=live-email] input[name=ep_messages]');
await A.click('form[data-form=live-email] button[type=submit]'); await A.waitForTimeout(500);
let pr=(await sql(`select matches,messages,invites from email_prefs where user_id=$1`,[U.a]))[0];
t('saved on the server',pr&&pr.matches==='weekly'&&pr.messages===false&&pr.invites===true,pr);
await A.reload(); await A.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await go(A,'#/account'); await A.waitForTimeout(500);
t('settings shown after reload',(await A.inputValue('form[data-form=live-email] select[name=ep_matches]'))==='weekly'&&!(await A.isChecked('form[data-form=live-email] input[name=ep_messages]')));
const E=await page('e');
await go(E,'#/account'); await E.waitForTimeout(500);
t('company sees applicants setting',await E.locator('form[data-form=live-email] select[name=ep_applicants]').count()===1&&await E.locator('form[data-form=live-email] select[name=ep_matches]').count()===0);
// ---- unsubscribe link (signed out)
const tok=(await sql(`select token from email_prefs where user_id=$1`,[U.a]))[0].token;
const V=await page(null);
await go(V,'#/unsubscribe?t='+tok+'&k=invites'); await V.waitForTimeout(600);
t('unsubscribe page confirms',/You are unsubscribed/.test(await V.textContent('#main'))&&/invitation and introduction/.test(await V.textContent('#main')),await V.textContent('#main'));
t('unsubscribed on the server',(await sql(`select invites from email_prefs where user_id=$1`,[U.a]))[0].invites===false);
await go(V,'#/unsubscribe?t=00000000-0000-0000-0000-000000000000&k=all'); await V.waitForTimeout(600);
t('bad link explained',/Link not valid/.test(await V.textContent('#main')));
// ---- a real notification becomes a queued email
await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U.e}',false); set role authenticated;`);
const jid=(await be.db.query(`select save_job(null,$1::jsonb) x`,[JSON.stringify({title:'FI role',requires:[{productId:'s4onprem',moduleId:'fi'}]})])).rows[0].x;
await be.db.query(`select send_notification($1,'job','x','#/job/'||$2)`,[ent.a,jid]);
await be.db.exec('reset role');
const qe=await sql(`select kind from email_queue where user_id=$1`,[U.a]);
t('match notification queued as an email',qe.some(r=>r.kind==='matches'),qe);
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
