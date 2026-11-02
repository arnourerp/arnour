/* Profile photo and company logo: the browser shrinks any picture to 256 px / under 150 KB, upload, replace, remove,
   shown on avatars, never shown for anonymous profiles (demo mode, no network) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:1000}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(fn,a)=>p.evaluate(fn,a);
/* a big, noisy picture (hard to compress) handed to the file input like a person would */
const give=(sel,type,w,h)=>ev(async([sel,type,w,h])=>{
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'), id=x.createImageData(w,h);
  for(let i=0;i<id.data.length;i+=4){ id.data[i]=Math.random()*255; id.data[i+1]=Math.random()*255; id.data[i+2]=Math.random()*255; id.data[i+3]=255; }
  x.putImageData(id,0,0);
  const blob=await new Promise(r=>c.toBlob(r,type)); const file=new File([blob],'pic.'+type.split('/')[1],{type}); window.__srcSize=file.size;
  const dt=new DataTransfer(); dt.items.add(file); const el=document.querySelector(sel); el.files=dt.files; el.dispatchEvent(new Event('change',{bubbles:true}));
},[sel,type,w,h]);
const dims=(src)=>ev((s)=>new Promise(r=>{ const i=new Image(); i.onload=()=>r([i.naturalWidth,i.naturalHeight,Math.round((s.length-s.indexOf(',')-1)*3/4)]); i.src=s; }),src);

/* ---- company logo ---- */
const co=await ev(()=>{ const j=Object.values(APP.db.jobs)[0]; APP.login('employer',j.companyId); location.hash='#/e/company'; return j.companyId; });
await p.waitForTimeout(400); await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300);
t('the edit form has a logo field on the first tab',await ev(()=>!!document.querySelector('.pe-pane[data-pane=basics] input[data-photo-input=company]')));
await give('input[data-photo-input=company]','image/png',2400,1800); await p.waitForTimeout(1200);
const logo=await ev(()=>APP.profileDraft.logo);
t('the logo is a small JPEG inside the form draft',/^data:image\/jpeg/.test(logo||''),(logo||'').slice(0,40));
const d1=await dims(logo);
t('…256 x 256 and under 150 KB (source was '+(await ev(()=>Math.round(window.__srcSize/1000)))+' KB)',d1[0]===256&&d1[1]===256&&d1[2]<=150000,d1);
t('the preview shows it and offers Remove',await ev(()=>!!document.querySelector('.photo-row img.av-img')&&!!document.querySelector('[data-action=photo-clear]')));
await p.click('form[data-form=company-edit] button[type=submit]'); await p.waitForTimeout(500);
t('saving keeps the logo on the company',await ev((c)=>/^data:image\/jpeg/.test(APP.company(c).logo||''),co));
t('the company page shows the logo',await ev(()=>!!document.querySelector('.brand-logo img.av-img')));
await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300); await p.click('[data-action=photo-clear]'); await p.waitForTimeout(200);
await p.click('form[data-form=company-edit] button[type=submit]'); await p.waitForTimeout(500);
t('Remove clears it for good',await ev((c)=>!APP.company(c).logo,co));

/* ---- a wrong file ---- */
await p.click('[data-action=co-edit-on]'); await p.waitForTimeout(300);
await ev(()=>{ const dt=new DataTransfer(); dt.items.add(new File(['hello'],'a.txt',{type:'text/plain'})); const el=document.querySelector('input[data-photo-input=company]'); el.files=dt.files; el.dispatchEvent(new Event('change',{bubbles:true})); });
await p.waitForTimeout(400);
t('a text file is refused',await ev(()=>!APP.profileDraft.logo&&/JPG, PNG or WebP/.test(document.body.textContent)));
await p.click('[data-action=edit-cancel]').catch(()=>{}); await p.waitForTimeout(200);

/* ---- professional photo ---- */
const cid=await ev(()=>{ const c=Object.values(APP.db.consultants)[0]; APP.login('consultant',c.id); location.hash='#/c/profile'; return c.id; });
await p.waitForTimeout(400); await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(300);
await p.click('.pe-tab[data-s=about]'); await p.waitForTimeout(200);
await give('input[data-photo-input=profile]','image/jpeg',3000,2000); await p.waitForTimeout(1200);
const ph=await ev(()=>APP.profileDraft.photo); const d2=await dims(ph||'data:,');
t('the photo is 256 x 256 and under 150 KB',d2[0]===256&&d2[1]===256&&d2[2]<=150000,d2);
await p.click('form[data-form=profile-edit] button[type=submit]'); await p.waitForTimeout(600);
t('saved on the profile',await ev((c)=>/^data:image\/jpeg/.test(APP.consultant(c).photo||''),cid));
t('the avatar in the top bar shows it',await ev(()=>!!document.querySelector('.nav-user img.av-img')));

/* ---- anonymous: never a picture ---- */
const pic=await ev((c)=>APP.consultant(c).photo,cid);
t('an anonymous avatar shows the lock, not the picture',await ev((s)=>{ const h=APP.avatarHtml('Pia',"lg",true,s); return /avatar anon/.test(h)&&!/<img/.test(h); },pic));
t('a normal avatar shows the picture',await ev((s)=>/<img class="av-img"/.test(APP.avatarHtml('Pia','lg',false,s)),pic));
t('a made-up address is not shown',await ev(()=>!/<img/.test(APP.avatarHtml('Pia','lg',false,'https://evil.example/x.jpg'))));
t('a live-mode path outside the pattern is not shown',await ev(()=>APP.photoUrl('../../etc/passwd')===''&&APP.photoUrl('javascript:alert(1)')===''));
t('no page errors',errs.length===0,errs);
console.log(f?'FAILED '+f:'ALL OK'); await b.close(); process.exit(f?1:0);
