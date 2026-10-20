import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1200,height:1000}});
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const id=await p.evaluate(()=>{
  const c=Object.values(APP.db.consultants)[0];
  Object.assign(c,{roleType:'functional',roleTypes:['functional'],languages:['English'],industries:['Banking & Financial Services'],specialties:[APP.ROLE_SPECIALTIES.functional[0]],yearsExp:6,
    skills:[{productId:'s4onprem',moduleId:'fi',projects:1,certified:false},{productId:'ecc',moduleId:'co',projects:4}]});
  APP.db.session={role:'consultant',consultantId:c.id};
  const j=Object.values(APP.db.jobs).find(x=>x.status==='open'&&!x.confidential);
  Object.assign(j,{roleType:'functional',confidential:false,languages:['English','Arabic'],preferredLangs:['French'],certification:'required',minExp:8,industries:['Banking & Financial Services','Retail & Consumer Goods (FMCG)'],
    preferredSpecialties:[APP.ROLE_SPECIALTIES.functional[0],APP.ROLE_SPECIALTIES.functional[1]],
    requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3},{productId:'s4onprem',moduleId:'co',orPrev:true},{productId:'s4onprem',moduleId:'mm'},{productId:'successfactors',moduleId:'ec'}]});
  return j.id; });
await p.evaluate(x=>{location.hash='#/job/'+x;},id); await p.waitForTimeout(400);
const info=await p.evaluate(()=>Array.from(document.querySelectorAll('.jd-reqs li.jd-req')).map(li=>({cls:li.className,t:li.innerText.replace(/\s+/g,' ')})));
const find=(re)=>info.find(x=>re.test(x.t));
t('alternatives shown one per line with "Any one of these"',await p.locator('.jd-group').count()===1&&await p.locator('.jd-group .jd-opts li.jd-req').count()===2);
t('partial: FI with 1 of 3 projects is orange with the reason',/st-mid/.test(find(/FI/).cls)&&/1 of 3 projects/.test(find(/FI/).t),find(/FI/));
t('transferable CO from ECC is orange',/st-mid/.test(find(/Controlling|CO\b/).cls)&&/Transferable from ECC/.test(find(/Controlling|CO\b/).t),find(/Controlling|CO\b/));
t('group header summarises (partly met)',/Partly met/.test(await p.locator('.jd-group-h').innerText()));
t('product you know with other modules is orange',/st-mid/.test(find(/MM|Materials|Sourcing/).cls),find(/MM|Materials|Sourcing/));
t('missing product is red',/st-no/.test(find(/SuccessFactors|Employee Central/).cls),find(/SuccessFactors|Employee Central/));
t('each language on its own line: English green, Arabic red',/st-ok/.test(find(/Language English/).cls)&&/st-no/.test(find(/Language Arabic/).cls));
t('required certification missing is red',/st-no/.test(find(/certification required/i).cls));
t('experience 6 of 8 yrs is orange',/st-mid/.test(find(/Experience/).cls),find(/Experience/));
t('nice-to-have missing is grey, not red',/st-na/.test(find(/Language French/).cls)&&/st-na/.test(find(/Retail/).cls),[find(/French/),find(/Retail/)]);
t('nice-to-have met is green',/st-ok/.test(find(/Industry Banking/).cls)&&info.filter(x=>/Specialty/.test(x.t)).some(x=>/st-ok/.test(x.cls)));
t('each specialty on its own line',info.filter(x=>/Specialty/.test(x.t)).length===2);
// signed-out visitor: no status colours
await p.evaluate(()=>{APP.db.session=null; APP.render();}); await p.waitForTimeout(200);
t('visitors see plain lines without status',await p.locator('.jd-reqs .st-ok, .jd-reqs .st-no, .jd-reqs .st-mid').count()===0);
t('no page errors',errs.length===0,errs);
console.log(f?'FAILS '+f:'ALL PASSED'); await b.close();
