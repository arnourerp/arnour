/* Release 60: Import jobs > Check marks roles that are already on Arnour (or repeated in the list) and imports only the new ones */
import {createRequire} from 'module'; import fs from 'fs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
/* the pretend backend knows two links: one open role and one closed role; window.__known = 'fail' makes the lookup fail (SQL 60 not run yet) */
const FAKE_BACKEND=`APP.backend=APP.backend||{isAdmin:true,profile:{},rpc:function(fn,a){window.__calls=(window.__calls||[]);window.__calls.push([fn,a]);
 if(fn==='admin_import_known'){ if(window.__known==='fail') return Promise.reject(new Error('function admin_import_known does not exist'));
   var K={'https://careers.acme.com/j/1':'open','https://careers.acme.com/j/2':'closed'}; return Promise.resolve(a.p_urls.filter(function(u){return K[u];}).map(function(u){return {url:u,status:K[u]};})); }
 if(fn==='admin_roles_by_links'){ if(window.__known==='fail') return Promise.reject(new Error('function admin_roles_by_links does not exist'));
   var R={'https://careers.acme.com/j/1':{id:'x-1',title:'Open role',extEmployer:'Acme',country:'ae',city:'Dubai',status:'open'},'https://careers.acme.com/j/2':{id:'x-2',title:'Shut role',extEmployer:'Acme',country:'ae',city:'Dubai',status:'closed'}};
   return Promise.resolve(a.p_urls.filter(function(u){return R[u];}).map(function(u){return Object.assign({url:u},R[u]);})); }
 if(fn==='admin_close_by_links') return Promise.resolve({closed:a.p_urls.length,titles:a.p_urls.map(function(u){return 'T '+u;})});
 if(fn==='admin_import_external_jobs')return Promise.resolve({imported:a.p_jobs.length,skipped:[]});if(fn==='admin_overview')return Promise.resolve({openReports:0});if(fn==='admin_jobs')return Promise.resolve([]);return Promise.resolve({});}};`;
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
await p.evaluate(FAKE_BACKEND);
await p.addScriptTag({content:fs.readFileSync(process.env.ARNOUR_DEMO+'/js/report.js','utf8')});
await p.addScriptTag({content:fs.readFileSync(process.env.ARNOUR_DEMO+'/js/admin.js','utf8')});
await p.evaluate(()=>{location.hash='#/admin/import';}); await p.waitForTimeout(500);
const pid=await p.evaluate(()=>{ for (const id of ['s4','s4hana','ecc']) { const q=APP.product(id); if(q&&q.modules&&q.modules.length) return {id, mod:q.modules[0].id}; } return null; });
await p.evaluate(x=>{window.__pid=x;},pid);
const J=(title,url,o)=>Object.assign({title,extEmployer:'Acme',extSource:'Company career page',applyUrl:url,country:'ae',city:'Dubai',roleType:'functional',employmentType:'Full-time',requires:[{productId:pid.id,moduleId:pid.mod}],description:'x'},o||{});
const main=()=>p.locator('.adm-main').innerText();
const check=async(list)=>{ await p.fill('#imp-text',JSON.stringify(list)); await p.click('[data-action=adm-imp-check]'); await p.waitForTimeout(400); };

/* A: one open duplicate (with capitals and a trailing slash), one closed duplicate, two new, one repeated in the list */
await check([J('Open dup','https://Careers.Acme.com/j/1/'),J('Closed dup','https://careers.acme.com/j/2'),J('New one','https://careers.acme.com/j/3'),J('New two','https://careers.acme.com/j/4'),J('New two again','https://careers.acme.com/j/4')]);
let m=await main();
t('lookup asked with clean links, once each',await p.evaluate(()=>{const c=window.__calls.filter(x=>x[0]==='admin_import_known');return c.length===1&&c[0][1].p_urls.join('|')==='https://careers.acme.com/j/1|https://careers.acme.com/j/2|https://careers.acme.com/j/3|https://careers.acme.com/j/4';}),await p.evaluate(()=>JSON.stringify(window.__calls)));
t('open duplicate is labelled Already on Arnour',/Open dup[\s\S]{0,40}Already on Arnour/.test(m)&&!/Already on Arnour \(open\)/.test(m),m);
t('closed duplicate says closed',/Closed dup[\s\S]{0,60}Already on Arnour \(closed\)/.test(m),m);
t('repeat in the list is labelled',/New two again[\s\S]{0,40}Repeated in this list/.test(m),m);
t('new roles are OK',/New one[\s\S]{0,20}OK/.test(m)&&/New two[\s\S]{0,20}OK/.test(m),m);
t('header counts new and skipped',/5 roles · 2 new, 3 already on Arnour \(skipped\)/.test(m),m);
t('button counts only new roles',/Import 2 new roles/.test(await p.locator('[data-action=adm-imp-run]').innerText()));
t('skipped rows say why',/this apply link is already on Arnour/.test(m)&&/same apply link comes earlier/.test(m),m);
await p.click('[data-action=adm-imp-run]'); await p.waitForTimeout(400);
t('import still sends the whole list (the database skips repeats itself)',await p.evaluate(()=>{const c=window.__calls.filter(x=>x[0]==='admin_import_external_jobs');return c.length===1&&c[0][1].p_jobs.length===5;}));
t('result shown, labels cleared',/Imported/.test(await main())&&!/Already on Arnour/.test(await main()));

/* B: nothing new -> no import button, a plain sentence */
await check([J('Open dup','https://careers.acme.com/j/1'),J('Closed dup','https://careers.acme.com/j/2')]);
m=await main();
t('nothing new: sentence and no import button',/Nothing new to import/.test(m)&&await p.locator('[data-action=adm-imp-run]').count()===0,m);

/* C: a duplicate with a mistake in it does not block the new roles */
await check([J('Dup with mistake','https://careers.acme.com/j/1',{country:'zz'}),J('Fine','https://careers.acme.com/j/9')]);
m=await main();
t('flagged duplicate does not need fixing',!/need fixing/.test(m)&&/Import 1 new role\b/.test(await p.locator('[data-action=adm-imp-run]').innerText()),m);
t('a flagged new role still blocks',await (async()=>{await check([J('Bad new','https://careers.acme.com/j/8',{country:'zz'})]);return /1 need fixing/.test(await main())&&await p.locator('[data-action=adm-imp-run]').count()===0;})());

/* D: the lookup fails (SQL 60 not run yet): no labels, import works as before */
await p.evaluate(()=>{window.__known='fail';});
await check([J('Anything','https://careers.acme.com/j/1'),J('Other','https://careers.acme.com/j/5')]);
m=await main();
t('lookup failure: no labels, no error text, usual button',!/Already on Arnour/.test(m)&&!/does not exist/.test(m)&&/Import 2 roles/.test(await p.locator('[data-action=adm-imp-run]').innerText()),m);
await p.evaluate(()=>{window.__known='';});

/* E: a role added from a pasted posting is looked up too */
await check([J('First','https://careers.acme.com/j/6')]);
await p.evaluate(()=>APP.adminImpAdd({title:'Added',extEmployer:'Acme',extSource:'Company career page',applyUrl:'https://careers.acme.com/j/1',country:'ae',roleType:'functional',employmentType:'Full-time',description:'x',requires:[{productId:window.__pid.id,moduleId:window.__pid.mod}]})); await p.waitForTimeout(400);
m=await main(); t('a role added from a pasted posting is looked up too',/Added[\s\S]{0,40}Already on Arnour/.test(m)&&/First[\s\S]{0,20}OK/.test(m),m);

/* ---- F: close roles that left the career site ---- */
await p.evaluate(()=>{window.__calls=[];});
t('close box is on the Import page',await p.locator('#cls-text').count()===1&&/Close roles that left the career site/.test(await main()));
await p.click('[data-action=adm-cls-check]'); t('empty box: asks for a link',/Paste at least one apply link/.test(await main())&&await p.locator('[data-action=adm-cls-run]').count()===0);
await p.fill('#cls-text','Gone roles:\n1) HTTPS://Careers.Acme.com/J/1/\nhttps://careers.acme.com/j/2.\nhttps://careers.acme.com/j/77\nhttps://careers.acme.com/j/1\nno link here'); await p.click('[data-action=adm-cls-check]'); await p.waitForTimeout(400);
m=await main();
t('links are picked out of the text, cleaned, each once',await p.evaluate(()=>{const c=window.__calls.filter(x=>x[0]==='admin_roles_by_links');return c.length===1&&c[0][1].p_urls.join('|')==='https://careers.acme.com/j/1|https://careers.acme.com/j/2|https://careers.acme.com/j/77';}));
t('open role: title and Will close',/Open role[\s\S]{0,30}Will close/.test(m)&&/Acme · United Arab Emirates, Dubai/.test(m),m);
t('closed role: Already closed',/Shut role[\s\S]{0,40}Already closed/.test(m),m);
t('unknown link: not an imported role',/j\/77[\s\S]{0,80}Not an imported role on Arnour/.test(m),m);
t('summary line',/3 links · 1 will close, 1 already closed, 1 not found/.test(m),m);
t('button counts only open roles',/Close 1 role\b/.test(await p.locator('[data-action=adm-cls-run]').innerText()));
await p.click('[data-action=adm-cls-run]'); await p.waitForTimeout(400);
t('only the open role link is sent to close',await p.evaluate(()=>{const c=window.__calls.filter(x=>x[0]==='admin_close_by_links');return c.length===1&&c[0][1].p_urls.join('|')==='https://careers.acme.com/j/1';}));
m=await main(); t('result shown, box cleared',/Closed 1/.test(m)&&await p.locator('#cls-text').inputValue()===''&&await p.locator('[data-action=adm-cls-run]').count()===0,m);
await p.evaluate(()=>{window.__known='fail';}); await p.fill('#cls-text','https://careers.acme.com/j/1'); await p.click('[data-action=adm-cls-check]'); await p.waitForTimeout(400);
t('check fails (SQL 60 not run): clear message, no close button',/SQL release 60 has not been run/.test(await main())&&await p.locator('[data-action=adm-cls-run]').count()===0);
await p.evaluate(()=>{window.__known='';});
console.log(errs.length?'PAGEERR '+errs.join(' | '):'no page errors');
console.log(f?f+' FAILED':'all passed'); await b.close(); process.exit(f||errs.length?1:0);
