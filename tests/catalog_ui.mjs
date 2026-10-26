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
await claim('pro',{firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'ecc',moduleId:'po',projects:4}],specialties:['rise']});
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

// the app uses the database copy
const V=await page(null);
t('visitor loads the database catalog',await V.evaluate(()=>APP.CATALOG_V===0&&CAT_INDEX.totalModules===147&&APP.specialtyItems.length===40));
const A=await page('adm');
t('admin is admin',await A.evaluate(()=>APP.backend.isAdmin===true));
await go(A,'#/admin/catalog'); await A.waitForSelector('.adm-main h1');
t('Catalog tab exists',await A.locator('a.adm-tab:has-text("Catalog")').count()===1);
t('products listed with counts',/Skills \(147\)/.test(await A.textContent('.adm-main'))&&/Specialties \(40\)/.test(await A.textContent('.adm-main')),await A.textContent('.adm-tabs'));
t('usage shown for a used product',/Used by 1 professional/.test(await A.textContent('article:has(code:text-is("ecc"))')));

// add a product + module
await A.click('[data-action=adm-cat-add][data-kind=product]'); await A.waitForSelector('form[data-form=adm-cat-ed] [name=name]'); await A.waitForTimeout(400);
await A.fill('form[data-form=adm-cat-ed] [name=name]','SAP Demo Suite'); await A.fill('form[data-form=adm-cat-ed] [name=short]','Demo Suite');
await A.click('form[data-form=adm-cat-ed] button[type=submit]'); await A.waitForSelector('article:has(code:text-is("sapdemosuite"))',{timeout:15000}); await A.waitForTimeout(300);
t('product saved in the database',(await sql(`select id from catalog_products where name='SAP Demo Suite'`)).length===1);
t('product shows in the app pickers right away',await A.evaluate(()=>CATALOG.products.some(p=>p.id==='sapdemosuite')&&APP.productOptions('').includes('SAP Demo Suite')));
await A.click('article:has(code:text-is("sapdemosuite")) [data-action=adm-cat-add][data-kind=module]'); await A.waitForSelector('form[data-form=adm-cat-ed] [name=name]'); await A.waitForTimeout(400);
await A.fill('form[data-form=adm-cat-ed] [name=name]','Demo Module A'); await A.click('form[data-form=adm-cat-ed] button[type=submit]'); await A.waitForTimeout(600);
await A.click('article:has(code:text-is("sapdemosuite")) [data-action=adm-cat-add][data-kind=module]'); await A.waitForSelector('form[data-form=adm-cat-ed] [name=name]'); await A.waitForTimeout(400);
await A.fill('form[data-form=adm-cat-ed] [name=name]','Demo Module B'); await A.click('form[data-form=adm-cat-ed] button[type=submit]'); await A.waitForTimeout(600);
t('modules saved',(await sql(`select id from catalog_modules where product_id='sapdemosuite' order by pos`)).map(r=>r.id).join()==='demomodulea,demomoduleb');
t('module list in the app',await A.evaluate(()=>APP.moduleOptions('sapdemosuite','').includes('Demo Module A')));
// empty name
await A.click('article:has(code:text-is("sapdemosuite")) [data-action=adm-cat-add][data-kind=module]'); await A.waitForSelector('form[data-form=adm-cat-ed] [name=name]'); await A.waitForTimeout(400);
await A.click('form[data-form=adm-cat-ed] button[type=submit]'); await A.waitForTimeout(200);
t('empty name is refused',/Please give it a name/.test(await A.evaluate(()=>document.body.innerText)),null);
await A.click('[data-action=adm-cat-cancel]');

// rename keeps the id; hide keeps it for who has it
await A.click('article:has(code:text-is("ecc")) [data-action=adm-cat-toggle]');
await A.click('tr:has(code:text-is("po")) [data-action=adm-cat-edit]:has-text("Edit")'); 
t('edit form is filled in',(await A.inputValue('form[data-form=adm-cat-ed] [name=name]')).startsWith('PO / PI'));
await A.fill('form[data-form=adm-cat-ed] [name=name]','PO / PI (renamed)'); await A.click('form[data-form=adm-cat-ed] button[type=submit]'); await A.waitForTimeout(600);
t('renamed, same id',(await sql(`select name from catalog_modules where product_id='ecc' and id='po'`))[0].name==='PO / PI (renamed)');
await A.click('tr:has(code:text-is("po")) [data-action=adm-cat-edit]:has-text("Hide")'); await A.waitForTimeout(600);
t('hidden in the database',(await sql(`select hidden from catalog_modules where product_id='ecc' and id='po'`))[0].hidden===true);
t('gone from the pickers',await A.evaluate(()=>!APP.moduleOptions('ecc','').includes('PO / PI')&&CATALOG.products.find(p=>p.id==='ecc').modules.every(m=>m.id!=='po')));
t('still there for someone who has it selected',await A.evaluate(()=>APP.moduleOptions('ecc','po').includes('PO / PI (renamed)')&&APP.moduleChipsHtml('ecc',['po'],'','k',false).includes('data-mid="po"')&&APP.skillName('ecc','po').includes('PO / PI')));
t('chips for other people do not offer it',await A.evaluate(()=>!APP.moduleChipsHtml('ecc',[],'','k2',false).includes('data-mid="po"')));
await A.click('tr:has(code:text-is("po")) [data-action=adm-cat-edit]:has-text("Unhide")'); await A.waitForTimeout(600);
t('unhide brings it back',await A.evaluate(()=>APP.moduleOptions('ecc','').includes('PO / PI (renamed)')));

// reorder (the product opened itself when a module was added)
await A.click('tr:has(code:text-is("demomodulea")) [data-action=adm-cat-move][data-dir="1"]'); await A.waitForTimeout(600);
t('reorder saved',(await sql(`select id from catalog_modules where product_id='sapdemosuite' order by pos`)).map(r=>r.id).join()==='demomoduleb,demomodulea');

// merge: needs typed confirmation
await sql(`update consultants set data = jsonb_set(data,'{skills}',data->'skills'||'[{"productId":"sapdemosuite","moduleId":"demomodulea","projects":5}]'::jsonb) where id=(select id from consultants where data->>'firstName'='Pia')`);
await A.reload(); await A.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await go(A,'#/admin/catalog'); await A.waitForSelector('.adm-main h1');
await A.click('article:has(code:text-is("sapdemosuite")) [data-action=adm-cat-toggle]');
await A.click('tr:has(code:text-is("demomodulea")) [data-action=adm-cat-merge]');
t('merge card explains the impact',/1 professional/.test(await A.textContent('form[data-form=adm-cat-merge]'))&&/cannot be undone/.test(await A.textContent('form[data-form=adm-cat-merge]')),await A.textContent('form[data-form=adm-cat-merge]'));
await A.selectOption('form[data-form=adm-cat-merge] [name=tm]','demomoduleb');
await A.click('form[data-form=adm-cat-merge] button[type=submit]'); await A.waitForTimeout(300);
t('refused without the typed word',(await sql(`select hidden from catalog_modules where id='demomodulea'`))[0].hidden===false);
await A.fill('form[data-form=adm-cat-merge] [name=confirm]','MERGE'); await A.click('form[data-form=adm-cat-merge] button[type=submit]'); await A.waitForTimeout(700);
t('merged: profile moved',(await sql(`select data->'skills' s from consultants where data->>'firstName'='Pia'`))[0].s.some(k=>k.moduleId==='demomoduleb'&&k.projects===5));
t('old module hidden',(await sql(`select hidden, merged_into from catalog_modules where id='demomodulea'`))[0].merged_into==='sapdemosuite:demomoduleb');

// specialties
await A.click('[data-action=adm-cat-sub][data-s=specs]'); await A.waitForTimeout(300);
t('specialties listed with suggested roles',/Suggested first for/.test(await A.textContent('.adm-main'))&&await A.locator('code:text-is("rise")').count()===1);
await A.click('article:has(code:text-is("ai")) [data-action=adm-cat-add][data-kind=spec]'); await A.waitForSelector('form[data-form=adm-cat-ed] [name=name]'); await A.waitForTimeout(400);
await A.fill('form[data-form=adm-cat-ed] [name=name]','Demo Specialty'); await A.fill('form[data-form=adm-cat-ed] [name=grp]','AI Development');
await A.check('form[data-form=adm-cat-ed] input[name=role][value=technical]');
await A.click('form[data-form=adm-cat-ed] button[type=submit]');
for(let i=0;i<40;i++){ await A.waitForTimeout(250); if((await sql(`select 1 from catalog_role_spec where spec_id='demo-specialty'`)).length) break; }
await A.waitForTimeout(300);
t('specialty saved with its roles',(await sql(`select 1 from catalog_role_spec where spec_id='demo-specialty' and role_type='technical'`)).length===1);
t('app offers it',await A.evaluate(()=>!!APP.SPECIAL_IDX['demo-specialty']&&APP.specialtiesForRoles(['technical']).includes('demo-specialty')));
// history + undo
await A.click('[data-action=adm-cat-sub][data-s=history]'); await A.waitForTimeout(300);
t('history lists the changes',/Added specialty/.test(await A.textContent('.adm-log')));
await A.click('.adm-log [data-action=adm-cat-undo]'); await A.waitForTimeout(700);
t('undo removes the specialty',(await sql(`select 1 from catalog_specs where id='demo-specialty'`)).length===0);

// other people
const P=await page('pro');
t('a professional sees the new catalog',await P.evaluate(()=>CATALOG.products.some(p=>p.id==='sapdemosuite')&&!!CAT_INDEX.mods['sapdemosuite:demomoduleb']));
t('old merged module maps to the new one on load',await P.evaluate(()=>APP.catalogMigrate.some(r=>r.join()==='sapdemosuite,demomodulea,sapdemosuite,demomoduleb')));
t('professional cannot open the admin catalog',await P.evaluate(()=>{ location.hash='#/admin/catalog'; return true; })&&(await P.waitForTimeout(400),!/Catalog/.test(await P.textContent('#main').catch(()=>''))||/Not available|404|not found/i.test(await P.textContent('#main'))));
t('no page errors',errors.length===0,errors);
await browser.close(); process.exit(fails?1:0);
