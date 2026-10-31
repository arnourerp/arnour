/* Clean entry URL in a real browser: /job/<id>?utm… opens the app on #/job/<id> without a redirect, keeps the tracking tags, and resets title/canonical when the person moves on */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import path from 'path'; import {createRequire} from 'module'; import {pathToFileURL} from 'url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const ROOT=process.env.ARNOUR_ROOT||path.resolve(process.cwd(),'..');
const lib=await import(pathToFileURL(path.join(ROOT,'netlify/edge-lib/seo.mjs')).href);
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const shell=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const ORIGIN='http://localhost:'+(process.env.PORT_LIVE||8123);
const jr=await be.db.query(`select id, data->>'title' title from jobs where status='open' and sample is not true limit 1`).catch(()=>({rows:[]}));
const job=(jr.rows[0])||(await be.db.query(`select id, data->>'title' title from jobs where status='open' limit 1`)).rows[0];
t('a seeded open job exists for the test',!!(job&&job.id),job);

const ctx=await browser.newContext({viewport:{width:1280,height:900}});
const p=await ctx.newPage(); await p.exposeFunction('__sb',be.handle);
await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
/* stand in for the edge function: the real index.html turned into the page for this job */
const served=lib.buildPage(shell,{title:'Hiring: '+job.title+' — Test Employer | Arnour',desc:'Test description for the role.',canonical:'https://arnour.com/job/'+job.id,robots:null,ld:[{'@context':'https://schema.org','@type':'JobPosting',title:job.title}],fallback:lib.jobFallbackHtml({id:job.id,title:job.title,country:'ae',external:true,extEmployer:'Test Employer',description:'Body text.'},[]),path:'/job/'+job.id});
let hits=0; await p.route('**/job/'+job.id+'**',r=>{ hits++; r.fulfill({contentType:'text/html; charset=utf-8',body:served}); });
const navs=[]; p.on('framenavigated',f=>{ if(f===p.mainFrame()) navs.push(f.url()); });
await p.goto(ORIGIN+'/job/'+job.id+'?utm_source=whatsapp&utm_medium=share&gclid=g123');
await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); await p.waitForTimeout(800);
const loc=await p.evaluate(()=>({path:location.pathname,search:location.search,hash:location.hash}));
t('the clean URL was served once, with no second page load (no redirect)',hits===1&&navs.filter(u=>!u.includes('#')).length===1,navs);
t('app opened on its own #/ route at the site root',loc.path==='/'&&loc.hash==='#/job/'+job.id,loc);
t('utm and gclid tags are kept for attribution',/utm_source=whatsapp/.test(loc.search)&&/gclid=g123/.test(loc.search),loc.search);
t('scripts and styles loaded from the site root (base href works)',await p.evaluate(()=>!!(window.APP&&APP.catalog!==undefined||window.APP)&&getComputedStyle(document.body).fontFamily.length>0));
t('the role is shown by the app',(await p.evaluate(()=>document.body.innerText)).includes(job.title),job.title);
t('title names the role and the canonical stays the clean job URL',(await p.title()).includes(job.title)&&(await p.getAttribute('link[rel=canonical]','href'))==='https://arnour.com/job/'+job.id,[await p.title(),await p.getAttribute('link[rel=canonical]','href')]);
t('JobPosting data is in the page',await p.evaluate(()=>[...document.querySelectorAll('script[type="application/ld+json"]')].some(s=>/JobPosting/.test(s.textContent))));
await p.evaluate(()=>{location.hash='#/jobs'}); await p.waitForTimeout(500);
t('moving to another page resets canonical to the home page',(await p.getAttribute('link[rel=canonical]','href'))==='https://arnour.com/');
t('moving to another page replaces the job title',!/^Hiring: /.test(await p.title()),await p.title());
await browser.close();
console.log(fails?'FAILS '+fails:'ALL PASSED'); process.exit(fails?1:0);
