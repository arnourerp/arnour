/* "Start from your CV" in the sign-up wizard (live mode, mock database; the model is a stub).
   Real DOCX and PDF files are read in the browser; we check what leaves the device, what fills the wizard,
   what the person still has to confirm, what is saved, and every error message. */
import {makeBackend} from './harness.mjs';
import fs from 'fs'; import zlib from 'zlib'; import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
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

const CV=['Jane Doe','Senior SAP FICO Consultant','Email: jane.doe@example.com | Phone: +971 50 123 4567 | Mobile 050 123 4567 | linkedin.com/in/jane-doe | https://janedoe.example.com',
 'Dubai, United Arab Emirates','Summary: finance lead with 12 years of SAP experience on S/4HANA rollouts for banks and retailers.',
 '2018 - 2024 Senior FICO Consultant, Big Bank: S/4HANA greenfield, FI and CO, 4 projects','2012 - 2018 FICO Consultant, Retail Co: FI on ECC, 3 projects','Certified: SAP S/4HANA Financial Accounting','Languages: English, Arabic'];
const PROFILE={ firstName:'Jane', lastName:'Doe', headline:'Senior SAP S/4HANA FICO Consultant', summary:'Finance lead with 12 years of SAP experience on bank and retail rollouts.', linkedin:'linkedin.com/in/jane-doe',
  country:'United Arab Emirates', city:'Dubai', nationality:'', languages:['English','Arabic'], yearsExp:12, roleType:'functional', products:['s4onprem'],
  skills:[{productId:'s4onprem',moduleId:'fi',projects:4,certified:true},{productId:'s4onprem',moduleId:'co',projects:0,certified:false}],
  industries:['Banking & Financial Services'], specialties:['greenfield'], otherSkills:['HGB to IFRS'] };

let n=0;
async function open(opts){ /* a new person, signed in and on step 1 of the consultant wizard */
  const ctx=await browser.newContext({viewport:{width:1100,height:1000}}); const p=await ctx.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  p.posts=[]; p.gets=0;
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.route('**/.netlify/functions/cv-parse',async r=>{
    const q=r.request();
    if(q.method()==='GET'){ p.gets++; return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:opts.configured!==false})}); }
    p.posts.push({headers:q.headers(),body:JSON.parse(q.postData()||'{}')});
    const a=opts.answer||{status:200,body:{profile:PROFILE}};
    return r.fulfill({status:a.status,contentType:'application/json',body:JSON.stringify(a.body)}); });
  const email='cv'+(++n)+'@test.com';
  await p.goto(BASE); await p.waitForSelector('.hero'); await p.evaluate(()=>{location.hash='#/register/c'}); await p.waitForTimeout(300);
  await p.fill('input[name=email]',email); await p.fill('input[name=password]','longenough1'); await p.check('input[name=terms]');
  await p.click('form[data-form=live-register] button[type=submit]'); await p.waitForFunction(()=>location.hash==='#/check-email');
  await p.goto(BASE+'?token_hash='+be.users[email].token+'&type=signup');
  await p.waitForFunction(()=>location.hash==='#/onboard',null,{timeout:8000}); await p.waitForSelector('form[data-form=wiz-c]'); await p.waitForTimeout(500);
  p.errors=errors; p.email=email; return p;
}
const upload=async(p,name,buf)=>{ await p.setInputFiles('input[data-cv-import]',{name,mimeType:'application/octet-stream',buffer:buf}); };
const submit=async(p)=>{ await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(250); };

/* ========== A. switched off: nothing shows, the wizard works as before ========== */
{ const p=await open({configured:false});
  t('A: the page asked whether the feature is on',p.gets>=1);
  t('A: no CV card when it is switched off',await p.evaluate(()=>!document.querySelector('.cv-import')));
  t('A: nationality starts empty, so nobody becomes "Egyptian" by not choosing',await p.evaluate(()=>document.querySelector('[name=nationality]').value===''&&!APP.wizC.data.nationality));
  await p.evaluate(()=>{ const d=APP.wizC.data; d.firstName='A'; d.lastName='B'; d.headline='H'; d.gender='male'; d.country='ae'; d.languages=['English']; APP.rtSet(d,['functional']); APP._formSyncSkip=['wiz-c']; APP.render(); });
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(300);
  t('A: step 1 asks for the nationality',await p.evaluate(()=>APP.wizC.step===1&&/Select your nationality/.test(document.body.textContent)));
  t('A: the normal wizard is there',await p.evaluate(()=>!!document.querySelector('#wiz-role')&&/About you/.test(document.querySelector('.wiz-title').textContent)));
  t('A: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== B. a Word CV, start to finish ========== */
{ const p=await open({});
  t('B: the card shows with the privacy promise',await p.evaluate(()=>{ const c=document.querySelector('.cv-import'); return !!c&&/Start from your CV/.test(c.textContent)&&/phone numbers are removed on your device/i.test(c.textContent)&&/not stored/i.test(c.textContent)&&/not used to train/i.test(c.textContent)&&!!c.querySelector('a[href="#/privacy"]'); }));
  t('B: it asks for PDF or DOCX only',await p.evaluate(()=>document.querySelector('input[data-cv-import]').accept==='.pdf,.docx'));
  await upload(p,'cv.docx',docx(CV));
  await p.waitForSelector('.cv-found',{timeout:15000});
  t('B: one request was sent',p.posts.length===1,p.posts.length);
  const q=p.posts[0];
  t('B: it carries the person\'s sign-in',/^Bearer \S+/.test(q.headers.authorization||''));
  t('B: only text and lists are sent, never the file',JSON.stringify(Object.keys(q.body).sort())==='["lists","text"]');
  t('B: the CV text was read from the Word file',/Senior SAP FICO Consultant/.test(q.body.text)&&/greenfield, FI and CO, 4 projects/.test(q.body.text)&&/Languages: English, Arabic/.test(q.body.text),q.body.text.slice(0,300));
  t('B: lines stay separate',/\n/.test(q.body.text));
  t('B: email, phone numbers and web links are gone before sending',!/jane\.doe@example|\+971|123 4567|janedoe\.example/.test(q.body.text),q.body.text);
  t('B: the LinkedIn address is kept',/linkedin\.com\/in\/jane-doe/.test(q.body.text));
  t('B: dates are not mistaken for phone numbers',/2018 - 2024/.test(q.body.text)&&/2012 - 2018/.test(q.body.text));
  const L=q.body.lists;
  t('B: the lists come from Arnour\'s own catalog',L.products.some(x=>x.id==='s4onprem'&&x.modules.some(m=>m.id==='fi'))&&L.roleTypes.some(r=>r.id==='functional')&&L.specialties.some(s=>s.id==='greenfield')&&L.industries.indexOf('Banking & Financial Services')>-1&&L.languages.indexOf('English')>-1&&L.nationalities.length>5);
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizC.data)));
  t('B: role, name, headline filled',d.roleType==='functional'&&d.firstName==='Jane'&&d.lastName==='Doe'&&d.headline==='Senior SAP S/4HANA FICO Consultant',d);
  t('B: country matched to Arnour\'s list, city kept',d.country==='ae'&&d.city==='Dubai',[d.country,d.city]);
  t('B: languages, years, level, LinkedIn, summary',JSON.stringify(d.languages)==='["English","Arabic"]'&&d.yearsExp===12&&d.level==='Senior'&&d.linkedin==='linkedin.com/in/jane-doe'&&/12 years/.test(d.summary),d);
  const fi=d.skills.find(k=>k.moduleId==='fi'), co=d.skills.find(k=>k.moduleId==='co');
  t('B: modules with counts; unknown count becomes at least 1; certification kept',!!fi&&fi.projects===4&&fi.certified===true&&!!co&&co.projects===1&&co.certified===false,d.skills);
  t('B: industries, specialties, own specialties',JSON.stringify(d.industries)==='["Banking & Financial Services"]'&&JSON.stringify(d.specialties)==='["greenfield"]'&&JSON.stringify(d.otherSkills)==='["HGB to IFRS"]',d);
  t('B: gender is never guessed',!d.gender);
  const card=await p.evaluate(()=>document.querySelector('.cv-found').textContent);
  t('B: the found card lists what was filled and what is still needed',/We read your CV/.test(card)&&/your main role/.test(card)&&/your languages/.test(card)&&/1 SAP product and 2 modules/.test(card)&&/check every step/i.test(card)&&/Nothing is saved until/i.test(card)&&/Still needed from you[^.]*gender[^.]*nationality/i.test(card),card);
  t('B: the form shows the filled values',await p.evaluate(()=>document.querySelector('[name=firstName]').value==='Jane'&&document.querySelector('[name=headline]').value==='Senior SAP S/4HANA FICO Consultant'&&document.querySelector('#wiz-country').value==='ae'));
  t('B: the CV file is stored privately',await p.evaluate(()=>(window.__uploads||[]).length===1&&/\.docx$/.test(window.__uploads[0])&&APP.wizC.data.cv&&APP.wizC.data.cv.name==='cv.docx'));
  t('B: the answers are kept in the saved draft',await p.evaluate(()=>{ const x=JSON.parse(localStorage.getItem('arnour-wizard-draft')||'null'); return !!x&&x.wiz.data.firstName==='Jane'&&x.wiz.cvImp.done===true; }));
  /* the person completes what a CV cannot give, then walks the steps */
  await p.evaluate(()=>{ APP.wizC.data.gender='female'; APP.wizC.data.nationality='Egyptian'; APP._formSyncSkip=['wiz-c']; APP.render(); });
  t('B: nothing is still needed after that',await p.evaluate(()=>!/Still needed/.test(document.querySelector('.cv-found').textContent)));
  await submit(p);
  t('B: step 2 follows with the reminder',await p.evaluate(()=>APP.wizC.step===2&&!!document.querySelector('.cv-banner')&&/Filled in from your CV/.test(document.querySelector('.cv-banner').textContent)&&!document.querySelector('.cv-import')));
  t('B: step 2 shows the level and years from the CV',await p.evaluate(()=>document.querySelector('[name=yearsExp]').value==='12'&&document.querySelector('.seg-item.active').textContent==='Senior'));
  await submit(p);
  t('B: step 3 shows the skills and says counts are estimates',await p.evaluate(()=>APP.wizC.step===3&&/estimate/i.test(document.querySelector('.cv-est').textContent)&&document.querySelectorAll('.mod-line').length>=2));
  await submit(p);
  t('B: step 4 shows the specialty',await p.evaluate(()=>APP.wizC.step===4&&!!document.querySelector('.cv-banner')));
  await submit(p);
  t('B: last step has the reminder, the CV and the summary',await p.evaluate(()=>{ const s=APP.wizC.step; return (s===6||s===5)&&/check everything/i.test((document.querySelector('.cv-banner')||{}).textContent||'')&&/cv\.docx/.test(document.body.textContent); }));
  if(await p.evaluate(()=>APP.wizC.step===5)) await submit(p);
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit());
  await p.waitForFunction(()=>location.hash==='#/c/dashboard',null,{timeout:10000});
  const row=(await be.db.query(`select data from consultants where owner=$1`,[be.users[p.email].id])).rows[0].data;
  t('B: profile created with the CV answers',row.firstName==='Jane'&&row.gender==='female'&&row.country==='ae'&&row.skills.some(k=>k.moduleId==='fi'&&k.projects===4&&k.certified===true),row);
  t('B: import bookkeeping is not saved on the profile',!('cvImp' in row)&&!('cvFrom' in row)&&!JSON.stringify(row).includes('jane.doe@example'));
  t('B: the CV file is on the profile',!!row.cv&&row.cv.name==='cv.docx'&&/^[0-9a-f-]+\//.test(row.cv.path));
  t('B: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== C. a PDF CV (read with the bundled pdf.js) ========== */
{ const p=await open({});
  await upload(p,'Jane CV.pdf',pdf(CV.map(x=>x.replace(/[^\x20-\x7e]/g,'')))); await p.waitForSelector('.cv-found',{timeout:20000});
  const q=p.posts[0];
  t('C: PDF text was read',!!q&&/Senior SAP FICO Consultant/.test(q.body.text)&&/12 years of SAP experience/.test(q.body.text)&&/Languages: English, Arabic/.test(q.body.text),q&&q.body.text.slice(0,300));
  t('C: contact details removed from PDF text too',!!q&&!/jane\.doe@example|\+971|123 4567/.test(q.body.text));
  t('C: wizard filled',await p.evaluate(()=>APP.wizC.data.firstName==='Jane'&&APP.wizC.data.skills.length>=2));
  t('C: stored as a PDF',await p.evaluate(()=>/\.pdf$/.test((window.__uploads||[])[0]||'')));
  t('C: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== D. a stored (not compressed) Word file, and a person who already typed ========== */
{ const p=await open({});
  await p.fill('[name=headline]','My own headline'); await p.fill('[name=lastName]','Smith');
  await upload(p,'cv.docx',docx(CV,false)); await p.waitForSelector('.cv-found',{timeout:15000});
  t('D: uncompressed .docx is read too',/Senior SAP FICO Consultant/.test((p.posts[0]||{body:{text:''}}).body.text));
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizC.data)));
  t('D: what the person typed is kept, blanks are filled',d.headline==='My own headline'&&d.lastName==='Smith'&&d.firstName==='Jane',[d.headline,d.lastName,d.firstName]);
  await p.context().close(); }

/* ========== E. every error says what to do, and nothing is sent when it need not be ========== */
{ const p=await open({});
  const msg=()=>p.evaluate(()=>(document.querySelector('.cv-import .field-error')||{}).textContent||'');
  await upload(p,'old.doc',Buffer.from('x'.repeat(500))); await p.waitForTimeout(300);
  t('E: .doc is explained, nothing sent',/\.doc\) files cannot be read/.test(await msg())&&p.posts.length===0);
  await upload(p,'cv.txt',Buffer.from('hello')); await p.waitForTimeout(300);
  t('E: other types are refused',/PDF or DOCX/.test(await msg())&&p.posts.length===0);
  await upload(p,'huge.pdf',Buffer.alloc(5*1024*1024+10)); await p.waitForTimeout(300);
  t('E: over 5 MB is refused',/larger than 5 MB/.test(await msg())&&p.posts.length===0);
  await upload(p,'short.docx',docx(['Too short'])); await p.waitForTimeout(500);
  t('E: a file with no readable text is explained, nothing sent',/could not find readable text/.test(await msg())&&p.posts.length===0);
  await upload(p,'broken.docx',Buffer.from('not a zip file at all, just text '.repeat(20))); await p.waitForTimeout(500);
  t('E: a broken file is explained, nothing sent',/could not open this file/.test(await msg())&&p.posts.length===0);
  await upload(p,'broken.pdf',Buffer.from('%PDF-1.4 garbage '.repeat(20))); await p.waitForTimeout(1500);
  t('E: a broken PDF is explained, nothing sent',/could not open this file/.test(await msg())&&p.posts.length===0,await msg());
  t('E: the upload button is still there to try again',await p.evaluate(()=>!!document.querySelector('input[data-cv-import]')));
  t('E: no file was stored for failed reads',await p.evaluate(()=>!(window.__uploads||[]).length));
  t('E: the form can still be filled in by hand',await p.evaluate(()=>!!document.querySelector('[name=firstName]')&&!APP.wizC.data.firstName));
  await p.context().close(); }
for(const [status,body,re] of [[429,{error:'limit'},/used all of today/],[503,{error:'busy'},/very busy/],[401,{error:'signin'},/sign in again/],[502,{error:'ai'},/could not read this CV/],[422,{error:'no_text'},/readable text/]]){
  const p=await open({answer:{status,body}}); await upload(p,'cv.docx',docx(CV)); await p.waitForTimeout(1200);
  const m=await p.evaluate(()=>(document.querySelector('.cv-import .field-error')||{}).textContent||'');
  t('E: server says '+body.error+' → clear message, form untouched',re.test(m)&&await p.evaluate(()=>!APP.wizC.cvImp&&!APP.wizC.data.firstName&&!(window.__uploads||[]).length),m);
  await p.context().close(); }
{ const p=await open({}); await p.route('**/.netlify/functions/cv-parse',r=>r.abort()); await upload(p,'cv.docx',docx(CV)); await p.waitForTimeout(1000);
  t('E: network down → clear message',/Could not reach the server/.test(await p.evaluate(()=>(document.querySelector('.cv-import .field-error')||{}).textContent||'')));
  await p.context().close(); }

/* ========== F. "No thanks" hides the card; the wizard is unchanged ========== */
{ const p=await open({}); await p.click('[data-cv-act=dismiss]'); await p.waitForTimeout(200);
  t('F: card gone after "No thanks"',await p.evaluate(()=>!document.querySelector('.cv-import')));
  await p.evaluate(()=>{ APP._formSyncSkip=[]; APP.render(); });
  t('F: and it stays gone after the page redraws',await p.evaluate(()=>!document.querySelector('.cv-import')));
  t('F: nothing was sent',p.posts.length===0);
  t('F: no page errors',p.errors.length===0,p.errors); await p.context().close(); }

/* ========== G. a leadership role and a basis role get the shape their steps expect ========== */
{ const p=await open({answer:{status:200,body:{profile:Object.assign({},PROFILE,{roleType:'architect',specialties:['rise','clean-core']})}}});
  await upload(p,'cv.docx',docx(CV)); await p.waitForSelector('.cv-found',{timeout:15000});
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizC.data)));
  t('G: architect: modules kept without project counts',d.roleType==='architect'&&d.skills.filter(k=>k.moduleId).every(k=>k.projects===0),d.skills);
  await p.evaluate(()=>{ APP.wizC.data.gender='male'; APP.wizC.data.nationality='Egyptian'; APP._formSyncSkip=['wiz-c']; APP.render(); });
  await submit(p); await submit(p);
  t('G: leadership order: expertise step shows the specialties',await p.evaluate(()=>APP.wizC.step===4&&APP.wizC.data.specialties.length===2));
  await p.context().close(); }
{ const p=await open({answer:{status:200,body:{profile:Object.assign({},PROFILE,{roleType:'basis'})}}});
  await upload(p,'cv.docx',docx(CV)); await p.waitForSelector('.cv-found',{timeout:15000});
  const d=await p.evaluate(()=>JSON.parse(JSON.stringify(APP.wizC.data)));
  t('G: basis: products only (one row per product)',d.roleType==='basis'&&d.skills.length===1&&d.skills[0].productId==='s4onprem'&&d.skills[0].moduleId==='*'&&d.skills[0].certified===true,d.skills);
  t('G: basis: no industries asked, none filled',!(d.industries||[]).length);
  await p.context().close(); }

await browser.close(); console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
