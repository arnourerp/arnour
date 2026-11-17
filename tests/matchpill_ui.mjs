/* The percentage on a role card / professional card is a button that opens the match breakdown */
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:800}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
/* a visitor sees no percentage at all */
await p.evaluate(()=>{location.hash='#/jobs';}); await p.waitForTimeout(400);
t('a visitor has no clickable percentage',await p.locator('.match-btn').count()===0);
/* a professional: Jobs list */
await p.evaluate(()=>{const c=Object.values(APP.db.consultants)[0]; APP.db.session={role:'consultant',consultantId:c.id}; location.hash='#/c/jobs';});
await p.waitForSelector('.search-layout'); await p.waitForTimeout(400);
const n=await p.locator('.card .match-btn').count();
t('role cards show the percentage as a button',n>=1&&await p.locator('.card .match:not(.match-btn)').count()===0,n);
const first=p.locator('.card .match-btn').first();
t('the button keeps its colour band and shows an arrow',/% Match\s*›/.test((await first.innerText()).replace(/\s+/g,' '))&&/m-(strong|good|mid|low|weak)/.test(await first.getAttribute('class')),await first.getAttribute('class'));
t('it has an accessible name that says what it does',/% match, show the match breakdown/.test(await first.getAttribute('aria-label')));
t('the "Match breakdown" link is still there',await p.locator('.card [data-action="match-drawer"]:not(.match-btn)').count()>=1);
await first.click(); await p.waitForTimeout(500);
t('tapping the percentage opens the match breakdown',await p.locator('.drawer .mb-score').count()===1&&/Match breakdown/.test(await p.locator('.drawer-head').innerText()));
const pct=await p.locator('.drawer .mb-score strong').innerText();
t('the drawer shows the same percentage as the card',pct.trim()===(await first.innerText()).match(/\d+%/)[0],pct);
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
t('Escape closes it and the list is as before',await p.locator('.drawer').count()===0&&await p.locator('.card .match-btn').count()===n);
/* the page can be followed from the keyboard: Enter on the button */
await first.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
t('Enter on the focused percentage opens it too',await p.locator('.drawer .mb-score').count()===1);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* professional cards in a company's view: percentage button when a role is attached */
const html=await p.evaluate(()=>{const c=Object.values(APP.db.consultants)[0], j=Object.values(APP.db.jobs).find(x=>x.status==='open'); return {withRole:APP.talentCard(c,{job:j,score:81}), plain:APP.talentCard(c,{})};});
t('a professional card with a role has the percentage as a button',/<button[^>]*match-btn[^>]*data-action="match-drawer"/.test(html.withRole)&&/Match breakdown<\/button>/.test(html.withRole));
t('a professional card without a role has no percentage',!/match-btn/.test(html.plain)&&!/% Match/.test(html.plain));
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close(); process.exit(f?1:0);
