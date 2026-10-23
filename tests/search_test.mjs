import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:900}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const go=async h=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(350); };
const main=()=>p.evaluate(()=>document.getElementById('main').innerText);
const secs=()=>p.evaluate(()=>[...document.querySelectorAll('.sr-sec h2')].map(h=>h.firstChild.textContent.trim()));
// visitor: public header has the box, no People
await go('#/');
t('search box in the public header',await p.locator('header form[data-form=nav-search] input[name=q]').count()===1);
await go('#/search?q=fico');
t('visitor: no People section',!(await secs()).includes('People')&&(await secs())[0]==='Roles',await secs());
// set up: an imported role, a private professional, a confidential role
const ids=await p.evaluate(()=>{
  const cs=Object.values(APP.db.consultants).filter(c=>(c.skills||[]).length); const me=cs[0], priv=cs[1];
  Object.assign(priv,{anon:true,firstName:'Zorro',lastName:'Hidden'});
  const any=Object.values(APP.db.jobs).find(j=>j.status==='open');
  APP.db.jobs.jext=Object.assign(JSON.parse(JSON.stringify(any)),{id:'jext',title:'SAP Basis Engineer',external:true,extEmployer:'Aramco',applyUrl:'https://careers.example.com/1',confidential:false,status:'open',postedTs:Date.now()});
  const co=APP.company(any.companyId); APP.db.jobs.jconf=Object.assign(JSON.parse(JSON.stringify(any)),{id:'jconf',title:'Secret Treasury Lead',confidential:true,status:'open'});
  APP.db.session={role:'consultant',consultantId:me.id}; APP.save();
  return {me:me.id,priv:priv.id,privMod:APP.skillName(priv.skills[0].productId,priv.skills[0].moduleId),coName:co.name};
});
// live suggestions
await go('#/c/dashboard');
await p.fill('header form[data-form=nav-search] input[name=q]',''); await p.click('header form[data-form=nav-search] input[name=q]');
await p.keyboard.type('aramco'); await p.waitForTimeout(400);
t('suggestions appear while typing',await p.locator('#sr-sug .sr-sug-item').count()>0);
t('suggestion highlights the words',await p.locator('#sr-sug mark').count()>0);
await p.keyboard.press('Enter'); await p.waitForTimeout(400);
t('Enter opens the results page',/^#\/search\?q=aramco/.test(await p.evaluate(()=>location.hash)),await p.evaluate(()=>location.hash));
let tx=await main();
t('imported role found by its employer',/SAP Basis Engineer/.test(tx));
t('imported employer listed under Companies',(await secs()).includes('Companies')&&/Hiring through its own career site/.test(tx),await secs());
t('results highlight the match',await p.locator('.sr-item mark').count()>0);
// professional order
await go('#/search?q=fico');
if(process.env.SHOT){ await p.screenshot({path:process.env.SHOT}); await p.fill('header form[data-form=nav-search] input[name=q]',''); await p.click('header form[data-form=nav-search] input[name=q]'); await p.keyboard.type('mm'); await p.waitForTimeout(400); await p.screenshot({path:process.env.SHOT.replace('.png','2.png'),clip:{x:0,y:0,width:1280,height:520}}); await p.keyboard.press('Escape'); await go('#/search?q=fico'); }
const o=await secs();
t('professional: Roles first',o[0]==='Roles',o);
t('tabs with counts',await p.locator('.sr-tabs .seg-tab').count()>=4);
// privacy
await go('#/search?q=Zorro');
t('private professional never found by name',await p.locator('.sr-item').count()===0);
await go('#/search?q='+encodeURIComponent(ids.privMod)+'&t=people');
t('private professional found by skill (anonymous)',await p.locator('.sr-item [href$="'+ids.priv+'"]').count()>0||await p.locator('.sr-item[data-card-href$="'+ids.priv+'"]').count()>0);
await go('#/search?q='+encodeURIComponent(ids.coName)+'&t=roles');
t('confidential role not found by the company name',!/Secret Treasury Lead/.test(await main()));
await go('#/search?q=treasury');
t('confidential role found by its title',/Secret Treasury Lead/.test(await main()));
// tab + filter
await go('#/search?q=s/4hana&t=roles');
const n0=await p.locator('.sr-item').count();
await p.selectOption('form[data-form=search-filters] select[name=country]','ae'); await p.waitForTimeout(300);
const n1=await p.locator('.sr-item').count();
t('filter narrows the tab',n1<=n0&&await p.evaluate(()=>APP.state.searchF.country==='ae'),{n0,n1});
// clicking a result opens it
await go('#/search?q=aramco');
await p.click('.sr-item a.sr-title'); await p.waitForTimeout(400);
t('result opens its page',/^#\/job\//.test(await p.evaluate(()=>location.hash)));
// the jobs page search also finds imported employers now
await p.evaluate(()=>{ APP.state.jobFilters.q='aramco'; }); await go('#/c/jobs');
t('Jobs page search finds the imported employer',/SAP Basis Engineer/.test(await main()));
// company order
await p.evaluate(()=>{ const co=Object.values(APP.db.companies)[0]; APP.db.session={role:'employer',companyId:co.id}; APP.save(); });
await go('#/search?q=fico');
t('company: People first',(await secs())[0]==='People',await secs());
// mobile: icon instead of the box
await p.setViewportSize({width:390,height:800}); await go('#/e/dashboard');
t('mobile: search icon in the header',await p.locator('header a.nav-search-m').isVisible());
await go('#/search?q=fico');
t('mobile: no sideways scroll',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
t('no page errors',errs.length===0,errs);
await b.close(); process.exit(f?1:0);
