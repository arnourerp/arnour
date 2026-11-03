/* Draft roles (live mode, mock database): save as draft, drafts list, preview, edit, publish, delete. */
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


const emp=await page('emp');
await go(emp,'#/e/jobs/new'); await emp.waitForSelector('form[data-form=job-post]');
await emp.click('button[data-action=job-draft]'); await emp.waitForTimeout(400);
t('Save as draft without a title is refused',/#\/e\/jobs\/new/.test(await emp.evaluate(()=>location.hash)));
await emp.fill('input[name=title]','Half-finished FICO role');
await emp.click('button[data-action=job-draft]'); await emp.waitForTimeout(900);
let rows=await sql(`select id, status, data->>'title' title from public.jobs where company_id is not null order by posted_ts desc limit 1`);
const id=rows[0]&&rows[0].id;
t('a draft is saved with only a title',rows[0]&&rows[0].status==='draft'&&rows[0].title==='Half-finished FICO role',rows);
t('we land on the draft page, marked Draft, with Publish / Edit / Preview / Delete and no tabs',await emp.evaluate(()=>/#\/e\/jobs\//.test(location.hash)&&!!document.querySelector('.jd-title .pill')&&/Draft/.test(document.querySelector('.jd-title').textContent)&&!!document.querySelector('[data-action=job-publish]')&&!!document.querySelector('[data-action=job-delete]')&&!!document.querySelector('[data-action=preview-public]')&&!document.querySelector('.jd-tabs')&&!document.querySelector('[data-action=close-job]')));
await go(emp,'#/e/jobs');
t('My roles shows a Drafts section with Continue editing / Publish / Delete',await emp.evaluate(()=>{ const b=document.querySelector('.draft-box'); return !!b&&/Half-finished FICO role/.test(b.textContent)&&!!b.querySelector('[data-action=job-publish]')&&!!b.querySelector('[data-action=job-delete]')&&/Continue editing/.test(b.textContent); }));
const pro=await page('pro'); await go(pro,'#/c/jobs');
t('a professional does not see the draft',await pro.evaluate((i)=>!APP.db.jobs[i]&&!/Half-finished/.test(document.body.textContent),id));
await go(emp,'#/e/jobs/'+id);
await emp.click('[data-action=preview-public]'); await emp.waitForTimeout(600);
t('Preview as professional opens the role page marked Draft',await emp.evaluate(()=>/#\/job\//.test(location.hash)&&/Half-finished FICO role/.test(document.body.textContent)&&/Draft/.test(document.querySelector('.jd-title').textContent)));
await go(emp,'#/e/jobs/'+id+'/edit'); await emp.waitForTimeout(400);
t('editing a draft offers Save draft and Publish (not Save changes)',await emp.evaluate(()=>!!document.querySelector('[data-action=job-draft]')&&/Publish/.test(document.querySelector('.edit-bar').textContent)&&!/Save changes/.test(document.querySelector('.edit-bar').textContent)));
await emp.click('.edit-bar button[type=submit]'); await emp.waitForTimeout(600);
rows=await sql(`select status from public.jobs where id=$1`,[id]);
t('publishing an incomplete draft is refused and it stays a draft',rows[0].status==='draft'&&/#\/e\/jobs\/.+\/edit/.test(await emp.evaluate(()=>location.hash)),rows);
await emp.selectOption('select[name=roleType]','functional'); await emp.selectOption('select[name=country]','ae');
await emp.click('.req-list:not(.nice-list) .mchip[data-mid=fi]'); await emp.waitForTimeout(200);
await emp.click('[data-action=job-draft]'); await emp.waitForTimeout(800);
rows=await sql(`select status, data->>'country' c, data->'requires' r from public.jobs where id=$1`,[id]);
t('Save draft keeps it a draft with the new details',rows[0].status==='draft'&&rows[0].c==='ae'&&rows[0].r.length===1,rows);
await go(emp,'#/e/jobs/'+id); await emp.click('[data-action=job-publish]'); await emp.waitForTimeout(900);
rows=await sql(`select status from public.jobs where id=$1`,[id]);
t('Publish role makes it open',rows[0].status==='open',rows);
t('the page now shows Open with Close role and no Publish',await emp.evaluate(()=>/Open/.test(document.querySelector('.jd-title').textContent)&&!!document.querySelector('[data-action=close-job]')&&!document.querySelector('[data-action=job-publish]')&&!!document.querySelector('.jd-tabs')));
await go(pro,'#/c/jobs'); await pro.reload(); await pro.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); await pro.waitForTimeout(600);
t('after publishing the professional sees it',await pro.evaluate((i)=>!!APP.db.jobs[i]&&APP.db.jobs[i].status==='open',id));
/* delete a draft */
await go(emp,'#/e/jobs/new'); await emp.fill('input[name=title]','Throwaway draft'); await emp.click('button[data-action=job-draft]'); await emp.waitForTimeout(800);
const id2=(await sql(`select id from public.jobs where data->>'title'='Throwaway draft'`))[0].id;
await emp.click('[data-action=job-delete]'); await emp.waitForTimeout(300);
t('Delete asks for confirmation first',await emp.evaluate(()=>!!document.querySelector('#dlg-ok')));
await emp.click('#dlg-ok'); await emp.waitForTimeout(900);
t('the draft is deleted in the database and we are back on My roles',(await sql(`select 1 from public.jobs where id=$1`,[id2])).length===0&&/#\/e\/jobs$/.test(await emp.evaluate(()=>location.hash)));
/* delete a published role */
await go(emp,'#/e/jobs/'+id); await emp.click('[data-action=job-delete]'); await emp.waitForTimeout(300);
t('deleting a published role warns it is permanent',await emp.evaluate(()=>/cannot be undone/.test(document.querySelector('.dlg').textContent)));
await emp.click('#dlg-ok'); await emp.waitForTimeout(900);
t('the published role is deleted',(await sql(`select 1 from public.jobs where id=$1`,[id])).length===0);
t('no page errors',emp.errors.length===0&&pro.errors.length===0,[emp.errors,pro.errors]);
await browser.close();
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
