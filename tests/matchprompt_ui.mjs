/* Visitor match prompt: Example card on the role page, Apply / Save popup, one-time slide-up on the list and on a role page */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const SHOTS=process.env.SHOTS_DIR||'';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const jobs=await p.evaluate(()=>{ window.__ev=[]; APP.trackEvent=n=>window.__ev.push(n); localStorage.removeItem('arnour-mnudge');
  return Object.values(APP.db.jobs).filter(x=>x.status==='open'&&!x.confidential).slice(0,2).map(x=>x.id); });
const ev=()=>p.evaluate(()=>window.__ev.slice());
const go=async h=>{ if(await p.evaluate(()=>location.hash)===h){ await p.evaluate(()=>{location.hash='#/login';}); await p.waitForTimeout(1200); } await p.evaluate(x=>{location.hash=x;},h); await p.waitForTimeout(500); };

/* 1. role page as a visitor */
await go('#/job/'+jobs[0]);
t('a visitor is not signed in',await p.evaluate(()=>!APP.db.session));
t('the role page shows the Example match card',await p.locator('.jd-match-anon .sap-example').count()===1&&/example/i.test(await p.locator('.jd-match-anon .sap-example').innerText()));
t('no figure from a real role is shown in it',/86%/.test(await p.locator('.jd-match-anon .sap-ring').innerText()));
t('Apply and Save are buttons that open the popup',await p.locator('.jd-act [data-action=match-gate]').count()===2);
if(SHOTS) await p.screenshot({path:SHOTS+'/visitor-role.png'});
await p.locator('.jd-apply').click(); await p.waitForTimeout(350);
t('Apply opens the popup with the Example card',await p.locator('#dlg-root .sap-example').count()===1&&/Sign up to apply/.test(await p.locator('#dlg-title').innerText()));
if(SHOTS) await p.screenshot({path:SHOTS+'/visitor-popup.png'});
await p.locator('[data-action=dlg-cancel]').last().click(); await p.waitForTimeout(300);
t('Not now closes it and stays on the role',await p.locator('#dlg-root').count()===0&&(await p.evaluate(()=>location.hash))==='#/job/'+jobs[0]);
await p.locator('[data-action=match-gate][data-where=save]').click(); await p.waitForTimeout(350);
t('Save opens the popup too, worded for saving',/save this role/i.test(await p.locator('#dlg-title').innerText()));
await p.locator('#dlg-ok').click(); await p.waitForTimeout(400);
t('Create my profile goes to sign-up and remembers the role',(await p.evaluate(()=>location.hash))==='#/register'&&await p.evaluate(id=>APP.state.afterAuth==='#/job/'+id,jobs[0]));
let e=await ev();
t('the counters were written (seen and go, per place)',e.includes('mn:seen:apply')&&e.includes('mn:seen:save')&&e.includes('mn:go:save'),e);
await p.locator('body').evaluate(()=>{});
await go('#/job/'+jobs[0]); await p.locator('.jd-apply').click(); await p.waitForTimeout(300);
await p.locator('[data-action=match-signin]').click(); await p.waitForTimeout(400);
t('"Sign in" in the popup goes to sign-in and remembers the role',(await p.evaluate(()=>location.hash))==='#/login'&&await p.evaluate(id=>APP.state.afterAuth==='#/job/'+id,jobs[0]));
t('the popup is gone after that',await p.locator('#dlg-root').count()===0);

/* 2. the slide-up on the list: once per browser */
await p.evaluate(()=>{ window.__ev.length=0; localStorage.removeItem('arnour-mnudge'); });
await go('#/jobs'); await p.waitForTimeout(1300);
t('nothing shows at first',await p.locator('#mnudge').count()===0);
await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(500);
t('scrolling down shows the slide-up',await p.locator('#mnudge').count()===1);
t('it has the three buttons on the list (Create my profile, Open a role, Not now)',await p.locator('#mnudge .btn').count()===3&&/Open a role/.test(await p.locator('#mnudge').innerText()));
t('it is labelled Example and shows the 86% ring',/example/i.test(await p.locator('#mnudge').innerText())&&/86%/.test(await p.locator('#mnudge .sap-ring').innerText()));
if(SHOTS) await p.screenshot({path:SHOTS+'/visitor-slideup.png'});
t('it is marked as shown for good',await p.evaluate(()=>localStorage.getItem('arnour-mnudge')==='1'));
await p.locator('#mnudge [data-action=nudge-open]').click(); await p.waitForTimeout(500);
t('Open a role opens the first role',/^#\/job\//.test(await p.evaluate(()=>location.hash))&&await p.locator('#mnudge').count()===0);
await go('#/jobs'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(600);
t('it does not come back for the same visitor',await p.locator('#mnudge').count()===0);
e=await ev();
t('counters: shown once and the Open a role tap',e.filter(x=>x==='mn:seen:list').length===1&&e.includes('mn:open:list'),e);

/* 3. Not now / Create my profile on the slide-up */
await p.evaluate(()=>{ window.__ev.length=0; localStorage.removeItem('arnour-mnudge'); });
await go('#/jobs'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(500);
await p.locator('#mnudge [data-action=nudge-no]').last().click(); await p.waitForTimeout(300);
t('Not now closes it and the choice is counted',await p.locator('#mnudge').count()===0&&(await ev()).includes('mn:no:list'));
await p.evaluate(()=>{ window.__ev.length=0; localStorage.removeItem('arnour-mnudge'); });
await go('#/jobs'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(500);
await p.locator('#mnudge [data-action=nudge-go]').click(); await p.waitForTimeout(400);
t('Create my profile goes to sign-up',(await p.evaluate(()=>location.hash))==='#/register'&&(await ev()).includes('mn:go:list'));

/* 4. the slide-up on a role page: after the second role is opened */
await p.evaluate(()=>{ window.__ev.length=0; localStorage.removeItem('arnour-mnudge'); });
await go('#/job/'+jobs[0]); await go('#/job/'+jobs[1]); await p.waitForTimeout(4600);
t('a second role opened gives the slide-up after a few seconds (no "Open a role" there)',await p.locator('#mnudge').count()===1&&!/Open a role/.test(await p.locator('#mnudge').innerText())&&(await ev()).includes('mn:seen:job'));
await p.locator('#mnudge [data-action=nudge-go]').click(); await p.waitForTimeout(300);
t('it remembers the role the visitor was on',await p.evaluate(id=>APP.state.afterAuth==='#/job/'+id,jobs[1]));

/* 5. never for someone signed in, never on other pages, never over an open popup */
await p.evaluate(()=>{ localStorage.removeItem('arnour-mnudge'); const c=Object.values(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c.id}; });
await go('#/jobs'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(600);
t('a signed-in professional never gets it',await p.locator('#mnudge').count()===0);
await p.evaluate(()=>{ APP.db.session=null; localStorage.removeItem('arnour-mnudge'); });
await go('#/'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(600);
t('the home page does not show it',await p.locator('#mnudge').count()===0);
await go('#/job/'+jobs[0]); await p.locator('.jd-apply').click(); await p.waitForTimeout(300);
t('opening the Apply popup removes the slide-up bookkeeping (key set)',await p.evaluate(()=>localStorage.getItem('arnour-mnudge')==='1')&&await p.locator('#mnudge').count()===0);

/* 6. phone width: the card fits */
await p.evaluate(()=>{ localStorage.removeItem('arnour-mnudge'); APP.closeDialog(true); }); await p.setViewportSize({width:390,height:800});
await go('#/jobs'); await p.evaluate(()=>window.scrollTo(0,900)); await p.waitForTimeout(600);
const box=await p.locator('#mnudge').boundingBox();
t('on a phone the slide-up fits the screen',!!box&&box.x>=0&&box.x+box.width<=390&&box.y>=0&&await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),box);
if(SHOTS) await p.screenshot({path:SHOTS+'/visitor-slideup-phone.png'});
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
