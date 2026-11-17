/* Phones and tablets: the filter panel is a full-screen sheet with a fixed close button and a fixed Show button (Jobs for professionals, Talent for companies) */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch();
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[];
const URL_='http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html';
async function open(vp, role){
  const ctx=await b.newContext({viewport:vp,hasTouch:vp.width<900,isMobile:vp.width<900}); const p=await ctx.newPage();
  await p.route('**/fonts.googleapis.com/**',r=>r.abort()); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL_); await p.waitForSelector('.hero');
  await p.evaluate(r=>{
    if(r==='c'){ const c=Object.values(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c.id}; location.hash='#/c/jobs'; }
    else { const e=Object.values(APP.db.companies)[0]; APP.db.session={role:'employer',companyId:e.id}; location.hash='#/e/talent'; }
    APP.save&&APP.save(); },role);
  await p.waitForSelector('.search-layout'); await p.waitForTimeout(300);
  return p;
}
const box=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height,vis:getComputedStyle(e).display!=='none'};},sel);
for (const [label,role,vp] of [['phone jobs','c',{width:390,height:780}],['tablet jobs','c',{width:820,height:1100}],['phone talent','e',{width:390,height:780}]]) {
  const p=await open(vp,role);
  t(label+': the panel is hidden until Filters is tapped',(await box(p,'#tf-panel')).vis===false);
  await p.tap('.tf-mobile-btn'); await p.waitForTimeout(300);
  let pn=await box(p,'#tf-panel');
  t(label+': the sheet covers the whole screen',pn.vis&&pn.t===0&&pn.l===0&&Math.round(pn.w)===vp.width&&Math.round(pn.h)===vp.height,pn);
  let cl=await box(p,'.tf-close'), ft=await box(p,'.tf-foot .tf-show');
  t(label+': Close is at the top and Show is at the bottom of the screen',cl&&cl.t>=0&&cl.b<=70&&cl.h>=44&&ft&&ft.b<=vp.height&&ft.b>=vp.height-40&&ft.h>=44,{cl,ft});
  /* scroll the sheet to the very end: both buttons stay on screen */
  await p.evaluate(()=>{const e=document.getElementById('tf-panel'); e.scrollTop=e.scrollHeight;}); await p.waitForTimeout(150);
  cl=await box(p,'.tf-close'); ft=await box(p,'.tf-foot .tf-show');
  t(label+': scrolled to the end, both buttons are still on screen',cl.t>=0&&cl.b<=70&&ft.b<=vp.height&&ft.t>=0,{cl,ft});
  t(label+': the page behind does not scroll',await p.evaluate(()=>getComputedStyle(document.body).overflow==='hidden'));
  /* picking a filter keeps the sheet open and where it was (the page is rebuilt, the sheet's own scroll must survive) */
  const st=await p.evaluate(()=>{const e=document.getElementById('tf-panel'); const room=e.scrollHeight-e.clientHeight; e.scrollTop=Math.min(120,room);
    const before=e.scrollTop; const chip=Array.from(e.querySelectorAll('.chip')).find(c=>c.offsetParent!==null); if(chip) chip.click();
    return {room,before,chip:!!chip}; });
  await p.waitForTimeout(400);
  const st2=await p.evaluate(()=>({open:document.getElementById('tf-panel').classList.contains('tf-open'),top:document.getElementById('tf-panel').scrollTop}));
  t(label+': choosing a filter keeps the sheet open and its scroll position',st.chip&&st2.open&&Math.abs(st2.top-st.before)<=2&&(st.room<=0||st.before>0),{st,st2});
  /* close with the X */
  await p.tap('.tf-close'); await p.waitForTimeout(400);
  t(label+': the X closes the sheet',(await box(p,'#tf-panel')).vis===false&&await p.evaluate(()=>getComputedStyle(document.body).overflow!=='hidden'));
  t(label+': Filters button is back in view',(await box(p,'.tf-mobile-btn')).vis);
  /* open again, close with the Show button */
  await p.tap('.tf-mobile-btn'); await p.waitForTimeout(250);
  t(label+': the Show button reads "Show N …"',/^Show \d+ (role|professional)s?$/.test((await p.locator('.tf-foot .tf-show').innerText()).trim()),await p.locator('.tf-foot .tf-show').innerText());
  await p.tap('.tf-foot .tf-show'); await p.waitForTimeout(400);
  t(label+': Show closes the sheet',(await box(p,'#tf-panel')).vis===false);
  /* Back swipe / button closes the sheet first and stays on the page */
  const hash=await p.evaluate(()=>location.hash);
  await p.tap('.tf-mobile-btn'); await p.waitForTimeout(250);
  await p.goBack(); await p.waitForTimeout(400);
  t(label+': Back closes the sheet and stays on the page',(await box(p,'#tf-panel')).vis===false&&await p.evaluate(()=>location.hash)===hash,await p.evaluate(()=>location.hash));
  /* Escape */
  await p.tap('.tf-mobile-btn'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  t(label+': Escape closes the sheet',(await box(p,'#tf-panel')).vis===false);
  /* after Escape and after the X the history is not left with extra steps that trap the person */
  const before=await p.evaluate(()=>history.length); await p.tap('.tf-mobile-btn'); await p.waitForTimeout(200); await p.tap('.tf-close'); await p.waitForTimeout(400);
  t(label+': history is back to where it was after opening and closing',await p.evaluate(()=>history.length)>=before);
  await p.context().close();
}
/* desktop is unchanged: the panel is a normal sidebar, no X, no bottom bar */
{ const p=await open({width:1280,height:900},'c');
  const pn=await box(p,'#tf-panel');
  t('desktop: the filter panel is a sidebar, not a sheet',pn.vis&&pn.w<400&&await p.evaluate(()=>getComputedStyle(document.getElementById('tf-panel')).position!=='fixed'),pn);
  t('desktop: no close button and no bottom bar',(await box(p,'.tf-close')).vis===false&&(await box(p,'.tf-foot')).vis===false);
  await p.context().close(); }
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
process.exit(f?1:0);
