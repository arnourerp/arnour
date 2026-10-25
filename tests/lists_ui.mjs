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
t('visitor loads the database lists',await V.evaluate(()=>APP.LISTS_V===0&&APP.countries.length===22&&APP.nationalities[0]==='Egyptian'&&APP.languages.length===5));
const A=await page('adm');
await go(A,'#/admin/lists'); await A.waitForSelector('.adm-main h1');
t('Lists tab exists',await A.locator('a.adm-tab:has-text("Countries")').count()===1);
t('countries listed',/Countries & cities \(22\)/.test(await A.textContent('.adm-main'))&&/Languages \(5\)/.test(await A.textContent('.adm-main')),await A.textContent('.adm-tabs'));
t('usage shown for UAE',/Used by 2 professionals/.test(await A.textContent('.adm-card:has(code:text-is("ae"))')),await A.textContent('.adm-card:has(code:text-is("ae"))'));

// add a region, a country and a city
await A.click('[data-action=adm-lst-sub][data-s=regions]'); await A.click('[data-action=adm-lst-add][data-kind=region]');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Europe'); await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('region saved + shown in the app',(await sql(`select id from list_items where kind='region' and name='Europe'`)).length===1&&await A.evaluate(()=>APP.regions.europe==='Europe'));
await A.click('[data-action=adm-lst-sub][data-s=countries]'); await A.click('[data-action=adm-lst-add][data-kind=country]');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Greece'); await A.selectOption('form[data-form=adm-lst-ed] [name=parent]','europe');
await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('country saved and offered in the pickers',await A.evaluate(()=>APP.countriesById.greece.region==='europe'&&APP.countryOptions('').includes('Greece')));
await A.click('.adm-card:has(code:text-is("greece")) [data-action=adm-lst-add][data-kind=city]');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Athens'); await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('city saved and offered under its country',await A.evaluate(()=>APP.cityOptions('greece','').includes('Athens')));

// nationality + language
await A.click('[data-action=adm-lst-sub][data-s=nationalities]'); await A.click('[data-action=adm-lst-add][data-kind=nationality]');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Greek'); await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('nationality added',await A.evaluate(()=>APP.nationalities.includes('Greek')));
await A.click('[data-action=adm-lst-sub][data-s=languages]'); await A.click('[data-action=adm-lst-add][data-kind=language]');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Greek'); await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('language added',await A.evaluate(()=>APP.languages.includes('Greek')));

// hide: leaves pickers, stays known
await A.click('.adm-row:has(strong:text-is("Greek")) [data-action=adm-lst-edit]:has-text("Hide")'); await A.waitForTimeout(600);
t('hidden language leaves the pickers but a chosen one stays',await A.evaluate(()=>!APP.languages.includes('Greek')&&APP.withSelected(APP.languages,['Greek']).includes('Greek')));

// rename rewrites people
await A.click('[data-action=adm-lst-sub][data-s=languages]');
await A.click('.adm-row:has(strong:text-is("French")) [data-action=adm-lst-edit]:has-text("Edit")');
await A.fill('form[data-form=adm-lst-ed] [name=name]','Francais'); await A.click('form[data-form=adm-lst-ed] button[type=submit]'); await A.waitForTimeout(600);
t('renamed language saved',(await sql(`select 1 from list_items where kind='language' and name='Francais'`)).length===1&&await A.evaluate(()=>APP.languages.includes('Francais')));
// undo it
await A.click('[data-action=adm-lst-undo]'); await A.waitForTimeout(600);
t('undo restores the name',await A.evaluate(()=>APP.languages.includes('French')&&!APP.languages.includes('Francais')));

// merge needs the typed word
await A.click('[data-action=adm-lst-sub][data-s=nationalities]');
await A.click('.adm-row:has(strong:text-is("Greek")) [data-action=adm-lst-merge]').catch(()=>{});
await A.click('[data-action=adm-lst-sub][data-s=countries]');
await A.click('.adm-card:has(code:text-is("greece")) [data-action=adm-lst-merge]');
await A.selectOption('form[data-form=adm-lst-merge] [name=to]','ae');
await A.click('form[data-form=adm-lst-merge] button[type=submit]'); await A.waitForTimeout(400);
t('merge without typing MERGE does nothing',(await sql(`select hidden from list_items where kind='country' and id='greece'`))[0].hidden===false);
await A.fill('form[data-form=adm-lst-merge] [name=confirm]','MERGE'); await A.click('form[data-form=adm-lst-merge] button[type=submit]'); await A.waitForTimeout(700);
t('country merged: hidden, cities followed',(await sql(`select hidden from list_items where kind='country' and id='greece'`))[0].hidden===true&&(await sql(`select 1 from list_items where kind='city' and name='Athens' and parent='ae'`)).length===1);

// pickers: the profile form offers visible items only
await go(A,'#/admin/lists'); await A.click('[data-action=adm-lst-sub][data-s=export]'); await A.waitForTimeout(200);
const ex=await A.inputValue('#adm-lst-export');
t('export lists countries with ids and cities for the skill',/ae United Arab Emirates \(Dubai/.test(ex)&&/## Nationalities/.test(ex)&&!/greece/.test(ex),ex.slice(0,200));
await A.click('[data-action=adm-lst-sub][data-s=history]');
t('history lists the changes',/Added region "Europe"/.test(await A.textContent('.adm-main')));

// non-admin cannot reach it, everyone else loads fine
const P=await page('pro'); await go(P,'#/admin/lists');
t('professional gets nothing',!/Countries & cities/.test(await P.textContent('body'))&&await P.evaluate(()=>APP.backend.isAdmin===false));
await V.reload(); await V.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready); await V.waitForTimeout(500);
t('visitor sees the changes after a reload',await V.evaluate(()=>APP.countriesById.greece&&APP.countriesById.greece.hidden===true&&APP.LISTS_V>0&&Object.keys(APP.regions).length===5));
t('no console errors',errors.length===0,errors.slice(0,3));
await browser.close(); await be.close?.();
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
