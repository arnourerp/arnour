import {createRequire} from 'module'; import {execSync} from 'child_process';
import fs from 'fs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
const calls=[];
await p.route('**/js/admin.js',async r=>{ const body=fs.readFileSync(process.env.ARNOUR_DEMO+'/js/admin.js','utf8');
  r.fulfill({contentType:'application/javascript',body:`APP.backend=APP.backend||{isAdmin:true,profile:{},rpc:function(fn,a){window.__calls=(window.__calls||[]);window.__calls.push([fn,a]);if(fn==='admin_import_external_jobs')return Promise.resolve({imported:a.p_jobs.length,skipped:[]});if(fn==='admin_overview')return Promise.resolve({openReports:0});if(fn==='admin_jobs')return Promise.resolve([]);return Promise.resolve({});}};\n`+body}); });
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'')); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
// card + detail rendering for an external job
const r=await p.evaluate(()=>{ const j=Object.values(APP.db.jobs).find(x=>x.status==='open'&&!x.confidential);
  const x=Object.assign({},j,{id:'x-1',external:true,extEmployer:'Acme Corp',extSource:'Company career page',applyUrl:'https://careers.acme.com/j/1'}); APP.db.jobs['x-1']=x;
  const card=APP.jobCard(x,70,APP.jobActionButtons(x,'consultant'));
  return {card, eid:x.companyId, cname:(APP.company(j.companyId)||{}).name}; });
t('card shows employer, not board company',r.card.includes('Acme Corp')&&!r.card.includes(r.cname),r.card.slice(0,300));
t('card has External listing badge',/External listing/.test(r.card));
t('card has no Message button',!/start-chat/.test(r.card));
await p.evaluate(()=>{ const c=Object.keys(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c}; });
await p.evaluate(()=>{location.hash='#/job/x-1';}); await p.waitForTimeout(500);
const txt=await p.evaluate(()=>document.body.innerText);
t('detail shows About this listing + via source',/About this listing/.test(txt)&&/via Company career page/.test(txt)&&/Acme Corp/.test(txt),txt.slice(0,400));
t('detail has apply on company site, no Message/I have applied',/Apply on company site/.test(txt)&&!/\bMessage\b/.test(txt.split('Your match')[0].slice(-400)),txt.slice(0,600));
// admin import page
await p.evaluate(()=>{location.hash='#/admin/import';}); await p.waitForTimeout(500);
t('import page renders',await p.locator('#imp-text').count()===1);
const good={title:'SAP FICO Lead',extEmployer:'Acme',extSource:'Company career page',applyUrl:'https://careers.acme.com/j/9',country:'ae',city:'Dubai',roleType:'functional',employmentType:'Full-time',requires:[{productId:'s4',moduleId:'FI'}],description:'x'};
const prods=await p.evaluate(()=>{const o=[];return Object.keys(window.CAT_INDEX||{}).length?1:APP.product('s4');});
await p.fill('#imp-text','not json'); await p.click('[data-action=adm-imp-check]');
t('bad json explained',/not valid JSON/.test(await p.locator('.adm-main').innerText()));
await p.fill('#imp-text',JSON.stringify([{title:'T',extEmployer:'A',applyUrl:'http://x',country:'zz',roleType:'q',requires:[]}])); await p.click('[data-action=adm-imp-check]');
const m=await p.locator('.adm-main').innerText();
t('bad rows flagged, no import button',/Apply link must be/.test(m)&&/Unknown country/.test(m)&&/Unknown role type/.test(m)&&await p.locator('[data-action=adm-imp-run]').count()===0,m);
const pid=await p.evaluate(()=>{ for (const id of ['s4','s4hana','ecc']) { const q=APP.product(id); if(q&&q.modules&&q.modules.length) return {id, mod:q.modules[0].id}; } return null; });
t('catalog product lookup works',!!pid,pid);
good.requires=[{productId:pid.id,moduleId:pid.mod}];
await p.fill('#imp-text',JSON.stringify([good])); await p.click('[data-action=adm-imp-check]');
t('good row -> import button',await p.locator('[data-action=adm-imp-run]').count()===1,await p.locator('.adm-main').innerText());
await p.click('[data-action=adm-imp-run]'); await p.waitForTimeout(400);
t('import RPC called and result shown',await p.evaluate(()=>window.__calls.some(c=>c[0]==='admin_import_external_jobs'&&c[1].p_jobs.length===1))&&/Imported 1/.test(await p.locator('.adm-main').innerText()));

// forgiving paste: raw line breaks inside a value, code fences, truncated text
const raw='```json\n[{"title":"T","extEmployer":"A","applyUrl":"https://a.com/x","country":"ae","roleType":"technical","employmentType":"Full-time","requires":[{"productId":"%P%","moduleId":"%M%"}],"description":"Line one\n- bullet\n\nLine two"}]\n```';
await p.fill('#imp-text',raw.replace('%P%',pid.id).replace('%M%',pid.mod)); await p.click('[data-action=adm-imp-check]');
t('raw line breaks + fences accepted',await p.locator('[data-action=adm-imp-run]').count()===1,await p.locator('.adm-main').innerText());
await p.fill('#imp-text','[{"title":"T","description":"About the role\\nCognizant is hiring an SAP C4C consultant and tech'); await p.click('[data-action=adm-imp-check]');
t('truncated paste explained',/looks cut off/.test(await p.locator('.adm-main').innerText()));

// the exact text Ahmed could not import, via textarea and via file
const badTxt=fs.readFileSync(process.env.ARNOUR_TESTS+'/fixtures/c4c-role.json','utf8');
await p.fill('#imp-text',badTxt); await p.click('[data-action=adm-imp-check]');
t('Ahmed C4C role checks clean',/ready to import/.test(await p.locator('.adm-main').innerText()),await p.locator('.adm-main').innerText());
await p.fill('#imp-text',''); await p.click('[data-action=adm-imp-check]');
fs.writeFileSync('/tmp/up.json',badTxt);
await p.setInputFiles('#imp-file','/tmp/up.json'); await p.waitForTimeout(400);
t('file upload fills + checks',/ready to import/.test(await p.locator('.adm-main').innerText())&&(await p.inputValue('#imp-text')).length===badTxt.length);
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
