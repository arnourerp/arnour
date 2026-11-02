/* Photo upload on the live site (mock storage + real SQL): the file goes into the person's own folder as a random .jpg,
   the profile keeps only that path, a replaced picture is deleted, and the address shown is the public bucket */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/021_avatars.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const UID='aaaaaaaa-0000-0000-0000-000000000001';
be.users['pia@t.com']={id:UID,email:'pia@t.com',password:'passpass1',confirmed:true,meta:{role:'consultant'},token:'tpia'};
await be.db.query('insert into auth.users(id,email) values ($1,$2)',[UID,'pia@t.com']);
await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${UID}',false); set role authenticated;`);
await be.db.query(`select claim_profile('consultant',$1::jsonb)`,[JSON.stringify({firstName:'Pia',lastName:'Pro',headline:'FI lead',anon:false,country:'ae',nationality:'eg',roleType:'functional',languages:['English'],yearsExp:8,level:'Senior',availability:'Immediate',workPrefs:[],skills:[{productId:'s4onprem',moduleId:'fi',projects:3}],specialties:[],industries:[]})]);
await be.db.exec('reset role');
const ctx=await browser.newContext({viewport:{width:1280,height:1000}});
await ctx.addInitScript(([id])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:'pia@t.com',user_metadata:{role:'consultant'}}})); }catch(e){} },[UID]);
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.exposeFunction('__sb',be.handle);
await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
await p.route('**/storage/v1/object/public/avatars/**',r=>r.fulfill({contentType:'image/png',body:PNG}));
await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000});
const ev=(fn,a)=>p.evaluate(fn,a);
const give=(w,h)=>ev(async([w,h])=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle='#39c'; x.fillRect(0,0,w,h);
  const blob=await new Promise(r=>c.toBlob(r,'image/png')); const dt=new DataTransfer(); dt.items.add(new File([blob],'me.png',{type:'image/png'}));
  const el=document.querySelector('input[data-photo-input=profile]'); el.files=dt.files; el.dispatchEvent(new Event('change',{bubbles:true})); },[w,h]);
const openEdit=async()=>{ await ev(()=>{location.hash='#/c/profile'}); await p.waitForSelector('[data-action=profile-edit-on]'); await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(300); await p.click('.pe-tab[data-s=about]'); await p.waitForTimeout(200); };
const dbPhoto=async()=>(await be.db.query(`select data->>'photo' ph from consultants where owner=$1`,[UID])).rows[0].ph;

await openEdit(); await give(800,600); await p.waitForTimeout(1200);
const up1=await ev(()=>window.__uploads||[]);
t('one file was uploaded into the person\'s own folder as a random .jpg',up1.length===1&&new RegExp('^'+UID+'/[0-9a-f]{20}\\.jpg$').test(up1[0]),up1);
t('uploaded as image/jpeg',(await ev(()=>window.__upTypes||[]))[0]==='image/jpeg');
t('the form preview points at the public bucket',await ev(()=>{ const i=document.querySelector('.photo-row img.av-img'); return !!i&&/\/storage\/v1\/object\/public\/avatars\//.test(i.src); }));
await p.click('form[data-form=profile-edit] button[type=submit]'); await p.waitForTimeout(1500);
t('the profile in the database holds the path',await dbPhoto()===up1[0],await dbPhoto());
t('the top bar shows the photo',await ev(()=>!!document.querySelector('.nav-user img.av-img')));

await openEdit(); await give(500,500); await p.waitForTimeout(1200);
const up2=await ev(()=>window.__uploads||[]);
await p.click('form[data-form=profile-edit] button[type=submit]'); await p.waitForTimeout(1500);
t('the new path is saved',await dbPhoto()===up2[1],[await dbPhoto(),up2]);
t('the replaced file was deleted',(await ev(()=>window.__removed||[])).indexOf(up1[0])!==-1,await ev(()=>window.__removed));

await openEdit(); await p.click('[data-action=photo-clear]'); await p.waitForTimeout(200);
await p.click('form[data-form=profile-edit] button[type=submit]'); await p.waitForTimeout(1500);
t('removing clears the path in the database',await dbPhoto()===null,await dbPhoto());
t('…and deletes the file',(await ev(()=>window.__removed||[])).indexOf(up2[1])!==-1);
t('no page errors',errs.length===0,errs);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
