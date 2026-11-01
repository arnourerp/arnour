/* "Build it from your company presentation" for SI/Partners (live mode, mock database; the model is a stub).
   Real PPTX, DOCX and PDF files are read in the browser; we check what leaves the device, what fills the sign-up step and the
   Edit profile page (blank fields only), what is saved, and every error message. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import zlib from 'zlib'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
for(const f of ['017_company_type.sql','018_partner_capabilities.sql']) await be.db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f,'utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';

/* ---- small file makers (no libraries) ---- */
const crcT=(()=>{ const a=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; a[n]=c>>>0; } return a; })();
const crc=(b)=>{ let c=0xFFFFFFFF; for(const x of b) c=crcT[(c^x)&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
function zip(files){ const loc=[],cen=[]; let off=0;
  for(const f of files){ const name=Buffer.from(f.name), raw=Buffer.from(f.data), comp=f.deflate?zlib.deflateRawSync(raw):raw, m=f.deflate?8:0;
    const h=Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0); h.writeUInt16LE(20,4); h.writeUInt16LE(0,6); h.writeUInt16LE(m,8); h.writeUInt32LE(crc(raw),14); h.writeUInt32LE(comp.length,18); h.writeUInt32LE(raw.length,22); h.writeUInt16LE(name.length,26);
    loc.push(h,name,comp);
    const c=Buffer.alloc(46); c.writeUInt32LE(0x02014b50,0); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(m,10); c.writeUInt32LE(crc(raw),16); c.writeUInt32LE(comp.length,20); c.writeUInt32LE(raw.length,24); c.writeUInt16LE(name.length,28); c.writeUInt32LE(off,42);
    cen.push(c,name); off+=30+name.length+comp.length; }
  const cd=Buffer.concat(cen), e=Buffer.alloc(22); e.writeUInt32LE(0x06054b50,0); e.writeUInt16LE(files.length,8); e.writeUInt16LE(files.length,10); e.writeUInt32LE(cd.length,12); e.writeUInt32LE(off,16);
  return Buffer.concat([...loc,cd,e]); }
const esc=(s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const docx=(lines,deflate=true)=>zip([{name:'[Content_Types].xml',data:'<Types/>'},{name:'word/document.xml',deflate,data:'<?xml version="1.0"?><w:document xmlns:w="x"><w:body>'+lines.map(l=>'<w:p><w:r><w:t xml:space="preserve">'+esc(l)+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>'}]);
function pdf(lines){ const content='BT /F1 10 Tf 40 800 Td 13 TL '+lines.map(l=>'('+l.replace(/[()\\]/g,'\\$&')+') Tj T*').join(' ')+' ET';
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out='%PDF-1.4\n'; const off=[]; objs.forEach((o,i)=>{ off.push(out.length); out+=`${i+1} 0 obj\n${o}\nendobj\n`; });
  const x=out.length; out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out,'latin1'); }


const pptx=(slides,deflate=true)=>zip([{name:'[Content_Types].xml',data:'<Types/>'}].concat(slides.map((lines,i)=>({name:'ppt/slides/slide'+(i+1)+'.xml',deflate,data:'<?xml version="1.0"?><p:sld xmlns:p="x" xmlns:a="y"><p:cSld><p:spTree>'+lines.map(l=>'<p:sp><p:txBody><a:p><a:r><a:t>'+esc(l)+'</a:t></a:r></a:p></p:txBody></p:sp>').join('')+'</p:spTree></p:cSld></p:sld>'}))));
const DECK=[
 ['Orbit SAP Partners','We deliver S/4HANA finance and supply chain programmes for Gulf banks and energy groups','Contact: sales@orbit.com | +971 4 123 4567 | https://orbit.example/contact'],
 ['120 SAP consultants, Dubai and Riyadh','Greenfield and migration projects. Fees from USD 900 per day.','Certified in FI and CO'],
 ['Clients: banks and energy groups in the UAE and Saudi Arabia','On-site and hybrid delivery. Project teams and individual consultants.']];
const PARTNER={ about:'Orbit is a Dubai SAP firm delivering finance and supply chain programmes.', bestAt:'S/4HANA finance rollouts for Gulf banks and energy groups.', teamSize:'51-200',
  skills:[{productId:'s4onprem',moduleId:'fi',projects:14,certified:true},{productId:'s4onprem',moduleId:'co',projects:6,certified:true}],
  industries:['Banking & Financial Services'], specialties:['greenfield'], countries:['ae','sa'], languages:['English','Arabic'], delivery:['onsite','hybrid'], engagement:['team','consultants'] };

let n=0;
async function open(opts){ /* a new company, signed in, on step 2 of the company wizard as a partner */
  const ctx=await browser.newContext({viewport:{width:1100,height:1000}}); const p=await ctx.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  p.posts=[]; p.gets=0;
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/partner-parse',async r=>{
    const q=r.request();
    if(q.method()==='GET'){ p.gets++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:opts.configured!==false})}); }
    p.posts.push({headers:q.headers(),body:JSON.parse(q.postData()||'{}')});
    const a=opts.answer||{status:200,body:{partner:PARTNER}};
    return r.fulfill({status:a.status,contentType:'application/json',body:JSON.stringify(a.body)}); });
  const email='pt'+(++n)+'@test.com';
  await p.goto(BASE); await p.waitForSelector('.hero'); await p.evaluate(()=>{location.hash='#/register/e'}); await p.waitForTimeout(300);
  await p.fill('input[name=email]',email); await p.fill('input[name=password]','longenough1'); await p.check('input[name=terms]');
  await p.click('form[data-form=live-register] button[type=submit]'); await p.waitForFunction(()=>location.hash==='#/check-email');
  await p.goto(BASE+'?token_hash='+be.users[email].token+'&type=signup');
  await p.waitForFunction(()=>location.hash==='#/onboard-e',null,{timeout:8000}); await p.waitForSelector('form[data-form=wiz-e]'); await p.waitForTimeout(400);
  await p.fill('input[name=name]','Orbit SAP Partners'); await p.selectOption('select[name=country]','ae');
  await p.check('input[name=companyType][value='+(opts.type||'partner')+']');
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()); await p.waitForTimeout(500);
  p.errors=errors; p.email=email; return p;
}
const upload=async(p,name,buf)=>{ await p.setInputFiles('input[data-pt-import]',{name,mimeType:'application/octet-stream',buffer:buf}); };
const step2=(p)=>p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit()).then(()=>p.waitForTimeout(300));

/* ========== A. switched off, and not for other types ========== */
{ const p=await open({configured:false});
  t('A: the page asked whether the feature is on',p.gets>=1);
  t('A: no upload card when it is switched off, the skills picker is there',await p.evaluate(()=>!document.querySelector('.pt-import')&&/Team skills/.test(document.querySelector('.wiz-title').textContent)));
  t('A: no page errors',p.errors.length===0,p.errors); await p.context().close(); }
{ const p=await open({type:'customer'});
  t('A: a customer sees the SAP systems step and no upload card',await p.evaluate(()=>!document.querySelector('.pt-import')&&/SAP systems your company runs/.test(document.body.textContent)));
  t('A: …and the partner feature never asked the server',p.gets===0,p.gets); await p.context().close(); }

/* ========== B. a PowerPoint, start to finish ========== */
{ const p=await open({});
  t('B: the card shows with the privacy promise',await p.evaluate(()=>{ const c=document.querySelector('.pt-import'); return !!c&&/Build it from your company presentation/.test(c.textContent)&&/phone numbers and web links are removed on your device/i.test(c.textContent)&&/not stored/i.test(c.textContent)&&/not used to train/i.test(c.textContent)&&/Anthropic/.test(c.textContent); }));
  t('B: it asks for PDF, PPTX or DOCX',await p.evaluate(()=>document.querySelector('input[data-pt-import]').accept==='.pdf,.pptx,.docx'));
  await upload(p,'deck.pptx',pptx(DECK));
  await p.waitForSelector('.pt-import.cv-found',{timeout:15000});
  t('B: one request was sent, with the sign-in',p.posts.length===1&&/^Bearer \S+/.test(p.posts[0].headers.authorization||''),p.posts.length);
  const q=p.posts[0];
  t('B: only text and lists are sent, never the file',JSON.stringify(Object.keys(q.body).sort())==='["lists","text"]');
  t('B: every slide was read, in order',/Orbit SAP Partners[\s\S]*120 SAP consultants[\s\S]*Clients: banks/.test(q.body.text)&&/Certified in FI and CO/.test(q.body.text),q.body.text);
  t('B: lines stay separate',/\n/.test(q.body.text));
  t('B: email, phone and web links are gone before sending',!/sales@orbit|\+971|123 4567|orbit\.example/.test(q.body.text),q.body.text);
  const L=q.body.lists;
  t('B: the lists come from Arnour\'s own catalog',L.products.some(x=>x.id==='s4onprem'&&x.modules.some(m=>m.id==='fi'))&&L.countries.some(c=>c.id==='ae')&&L.specialties.some(s=>s.id==='greenfield')&&L.industries.indexOf('Banking & Financial Services')>-1&&L.languages.indexOf('English')>-1);
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizE.data)));
  t('B: skills, with project counts and certification',d.partner.skills.length===2&&d.partner.skills[0].projects===14&&d.partner.skills[0].certified===true,d.partner.skills);
  t('B: industries, specialties, countries, languages, delivery, engagement, size, best-at',JSON.stringify([d.partner.industries,d.partner.specialties,d.partner.countries,d.partner.languages,d.partner.delivery,d.partner.engagement,d.partner.teamSize])==='[["Banking & Financial Services"],["greenfield"],["ae","sa"],["English","Arabic"],["onsite","hybrid"],["team","consultants"],"51-200"]'&&/finance rollouts/.test(d.partner.bestAt),d.partner);
  t('B: the About text was blank, so it was filled',/Dubai SAP firm/.test(d.about),d.about);
  const card=await p.evaluate(()=>document.querySelector('.pt-import.cv-found').textContent);
  t('B: the found card lists what was filled and asks for a check',/We read your presentation/.test(card)&&/1 SAP product and 2 modules/.test(card)&&/industries/.test(card)&&/Please check it/.test(card)&&/Nothing is saved until/.test(card),card);
  t('B: the form shows the filled values (one product card, two certified modules)',await p.evaluate(()=>document.querySelectorAll('form[data-form=wiz-e] .prod-card').length===1&&document.querySelectorAll('form[data-form=wiz-e] .cert-chip.on').length===2));
  t('B: the draft is saved so a reload keeps it',await p.evaluate(()=>{ const x=JSON.parse(localStorage.getItem('arnour-wizard-draft')||'null'); return !!x&&x.wiz.data.partner.skills.length===2; }));
  await step2(p);
  t('B: step 3 already has the details from the file, so only the contact name is still needed',await p.evaluate(()=>APP.wizE.step===3&&!!document.querySelector('[data-pt-best]').value&&!document.querySelector('input[name=contactName]').value));
  await p.fill('input[name=contactName]','Dana'); await step2(p);
  t('B: step 4 reviews the team skills',await p.evaluate(()=>APP.wizE.step===4&&/Team skills: 2 modules across 1 product/.test(document.body.textContent)));
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit());
  await p.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:10000});
  const row=(await be.db.query(`select data from companies where owner=$1`,[be.users[p.email].id])).rows[0].data;
  t('B: saved in the database as a partner with its capabilities',row.companyType==='partner'&&row.partner.skills.length===2&&row.partner.teamSize==='51-200'&&row.partner.countries.length===2&&!('sapSystems' in row&&row.sapSystems.length),row);
  const pl=(await be.db.query(`select 1 from companies where owner=$1 and jsonb_array_length(data #> '{partner,skills}')=2`,[be.users[p.email].id])).rows.length;
  t('B: the database kept the capabilities (the cleaning trigger accepted them)',pl===1);
  t('B: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== C. Word and PDF files; typed values are never overwritten ========== */
{ const p=await open({});
  await p.fill('textarea[name=about]','x').catch(()=>{}); /* About is on step 1, not here */
  await p.evaluate(()=>{ APP.wizE.data.about='Our own About text.'; APP.wizE.data.partner.bestAt='Typed by the company.'; APP.wizE.data.partner.skills.push({productId:'s4onprem',moduleId:'fi',projects:2,certified:false}); APP._formSyncSkip=['wiz-e']; APP.render(); });
  await upload(p,'profile.docx',docx(['Orbit SAP Partners','We deliver S/4HANA finance and supply chain programmes for Gulf banks and energy groups.','120 SAP consultants. Greenfield and migration projects. Certified in FI and CO. '.repeat(3)]));
  await p.waitForSelector('.pt-import.cv-found',{timeout:15000});
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizE.data)));
  t('C: a Word file works',p.posts.length===1&&/Greenfield and migration/.test(p.posts[0].body.text));
  t('C: typed About and best-at text are kept',d.about==='Our own About text.'&&d.partner.bestAt==='Typed by the company.',[d.about,d.partner.bestAt]);
  t('C: a skill already there is not duplicated or reset',d.partner.skills.filter(k=>k.moduleId==='fi').length===1&&d.partner.skills.find(k=>k.moduleId==='fi').projects===2&&d.partner.skills.length===2,d.partner.skills);
  await p.context().close(); }
{ const p=await open({});
  await upload(p,'deck.pdf',pdf(['Orbit SAP Partners profile','We deliver S/4HANA finance and supply chain programmes for Gulf banks and energy groups with 120 SAP consultants.','Greenfield and migration projects in Dubai and Riyadh. Certified in FI and CO.','Contact: sales@orbit.com']));
  await p.waitForSelector('.pt-import.cv-found',{timeout:20000});
  t('C: a PDF works too, contact details removed',p.posts.length===1&&/S\/4HANA finance/.test(p.posts[0].body.text)&&!/sales@orbit/.test(p.posts[0].body.text),p.posts[0]&&p.posts[0].body.text);
  await p.context().close(); }

/* ========== D. Edit profile: the card is on the About tab; blank fields are filled; the Team skills tab shows the result ========== */
{ const p=await open({});
  await p.click('[data-pt-act=dismiss]'); await p.waitForTimeout(200);
  t('D: "No thanks" hides the card',await p.evaluate(()=>!document.querySelector('.pt-import')));
  await p.evaluate(()=>{ const d=APP.wizE.data; d.partner.skills.push({productId:'s4onprem',moduleId:'mm',projects:1,certified:false}); Object.assign(d.partner,{countries:['ae'],languages:['English'],delivery:['onsite'],engagement:['team'],teamSize:'11-50',bestAt:'Finance.'}); d.contactName='Dana'; APP._formSyncSkip=['wiz-e']; APP.render(); });
  await step2(p); await step2(p); await p.evaluate(()=>document.querySelector('form[data-form=wiz-e]').requestSubmit());
  await p.waitForFunction(()=>location.hash==='#/e/dashboard',null,{timeout:10000});
  await p.evaluate(()=>{ location.hash='#/e/company'; }); await p.waitForTimeout(500);
  await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(500);
  t('D: no upload card on the Company tab',await p.evaluate(()=>{ const e=document.querySelector('.pe-pane[data-pane=basics]'); return !e.querySelector('.pt-import'); }));
  await p.click('.pe-tab[data-s=about]'); await p.waitForTimeout(400);
  t('D: the card is on the About tab',await p.evaluate(()=>!!document.querySelector('.pe-pane[data-pane=about] .pt-import')));
  await upload(p,'deck.pptx',pptx(DECK));
  await p.waitForSelector('.pt-import.cv-found',{timeout:15000});
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.profileDraft)));
  t('D: skills were added to the edit draft next to the existing one',d.partner.skills.length===3&&d.partner.skills.some(k=>k.moduleId==='mm')&&d.partner.skills.some(k=>k.moduleId==='co'),d.partner.skills);
  await p.click('.pe-tab[data-s=skills]'); await p.waitForTimeout(300);
  t('D: the Team skills tab shows them',await p.evaluate(()=>document.querySelectorAll('.pe-pane[data-pane=skills] .skill-row, .pe-pane[data-pane=skills] .mod-line, .pe-pane[data-pane=skills] .cert-chip').length>=3));
  await p.evaluate(()=>document.querySelector('form[data-form=company-edit]').requestSubmit()); await p.waitForTimeout(800);
  const row=(await be.db.query(`select data from companies where owner=$1`,[be.users[p.email].id])).rows[0].data;
  t('D: saving stores the capabilities',row.partner.skills.length===3&&row.partner.countries.length===2,row.partner);
  t('D: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== E. every error message ========== */
for(const [status,body,re] of [[429,{error:'limit'},/used all of today/],[503,{error:'busy'},/very busy/],[401,{error:'signin'},/sign in again/],[502,{error:'ai'},/could not read this file/],[422,{error:'no_text'},/readable text/],[422,{error:'not_a_profile'},/does not look like a company profile/]]){
  const p=await open({answer:{status,body}}); await upload(p,'deck.pptx',pptx(DECK)); await p.waitForSelector('.field-error',{timeout:15000});
  t('E: '+status+' '+body.error+' shows a clear message and the form stays usable',await p.evaluate((s)=>{ return new RegExp(s).test(document.querySelector('.field-error').textContent)&&!!document.querySelector('input[data-pt-import]'); },re.source)&&(await p.evaluate(()=>document.querySelector('.field-error').textContent)).match(re)!==null);
  await p.context().close(); }
{ const p=await open({});
  await upload(p,'old.ppt',Buffer.from('x')); await p.waitForSelector('.field-error');
  t('E: an old .ppt file is explained',await p.evaluate(()=>/Old Office files \(\.ppt\)/.test(document.querySelector('.field-error').textContent)));
  await upload(p,'notes.txt',Buffer.from('x')); await p.waitForTimeout(200);
  t('E: other file types are refused',await p.evaluate(()=>/PDF, PPTX or DOCX/.test(document.querySelector('.field-error').textContent)));
  await upload(p,'empty.pptx',pptx([['Hi']])); await p.waitForTimeout(800);
  t('E: a deck with almost no text is explained and nothing is sent',await p.evaluate(()=>/readable text/.test(document.querySelector('.field-error').textContent))&&p.posts.length===0,p.posts.length);
  t('E: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

await browser.close(); console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
