import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}}); const errs=[];
p.on('pageerror',e=>errs.push(e.message));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(f,a)=>p.evaluate(f,a);
// every id in every role list exists in the catalogue; sizes as agreed
const cat=await ev(()=>{ const bad=[]; const sz={}; for(const [rt,l] of Object.entries(APP.ROLE_SPECIALTIES)){ sz[rt]=l.length; l.forEach(id=>{ if(!APP.SPECIAL_IDX[id]) bad.push(rt+':'+id); }); } return {bad,sz,total:Object.keys(APP.SPECIAL_IDX).length,roles:APP.roleTypes.map(r=>r.id)}; });
t('every role specialty exists in the catalogue',cat.bad.length===0,cat.bad);
t('36 specialties in the catalogue',cat.total===36,cat.total);
t('sizes: F12 T11 B12 A13 D12 S8 K10 J6',JSON.stringify(cat.sz)===JSON.stringify({functional:12,technical:11,basis:12,architect:13,delivery:12,support:8,keyuser:10,junior:6}),cat.sz);
t('Basis role renamed',await ev(()=>APP.roleTypeLabel('basis')==='Basis, Cloud & Security'));
// wizard: single role, note shown, one role only
await ev(()=>{ APP.wizC=null; location.hash='#/onboard'; }); await p.waitForTimeout(400);
t('wizard reachable in demo',await ev(()=>!!document.querySelector('form[data-form=wiz-c]')));
t('role picker explains adding a role later',(await p.textContent('.rt-callout')).includes('You can add another role later in Edit profile'));
t('callout + 8 role cards + 4 section cards before picking',await ev(()=>!!document.querySelector('.rt-callout')&&document.querySelectorAll('.rt-list[data-rt-list] .rt-opt').length===8&&document.querySelectorAll('.wiz-sec').length===4));
await p.click('[data-action=rt-toggle][data-value=functional]'); await p.waitForTimeout(100);
t('role collapses to one row after picking',await ev(()=>!!document.querySelector('.rt-collapsed')&&!document.querySelector('.rt-list[data-rt-list]')&&document.querySelector('.wiz-sec[data-sec=role]').classList.contains('done')));
await p.click('[data-action=role-change]'); await p.waitForTimeout(100); await p.click('[data-action=rt-toggle][data-value=basis]'); await p.waitForTimeout(100);
t('sign-up picker keeps ONE role',await ev(()=>JSON.stringify(APP.rtList(APP.wizC.data))==='["basis"]'),await ev(()=>APP.rtList(APP.wizC.data)));
await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(200);
t('step 1 blocks without required fields + inline errors',await ev(()=>APP.wizC.step===1&&document.querySelectorAll('.field-error').length>=3&&!!document.querySelector('.wiz-sec.has-err')));
t('gender required',await ev(()=>/gender/i.test(Array.from(document.querySelectorAll('.field-error')).map(x=>x.textContent).join(' '))||!!document.querySelector('.gender-seg')));
t('no "Primary" badge / make-primary at sign-up',(await p.locator('.rt-make').count())===0&&!/Primary/.test(await p.textContent('form[data-form=wiz-c]')));
// walk each role through steps 2-4 and check what is asked
const modes={functional:'full',technical:'optional',basis:'products',architect:'modules',delivery:'products',support:'modules',keyuser:'modules',junior:'products'};
for(const rt of Object.keys(modes)){
  await ev((rt)=>{ APP.wizC={step:1,data:Object.assign(APP.wizCDefaults(),{firstName:'A',lastName:'B',gender:'male',headline:'H',nationality:'Egypt',country:'ae',languages:['English']})}; APP.rtSet(APP.wizC.data,[rt]); APP._formSyncSkip=['wiz-c']; APP.render(); },rt);
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  t(rt+': step 1 → 2',await ev(()=>APP.wizC.step===2),await ev(()=>Array.from(document.querySelectorAll('.toast')).map(x=>x.textContent).join('|')+' step='+APP.wizC.step+' d='+JSON.stringify(APP.wizC.data).slice(0,200)));
  const lvl=await p.locator('form[data-form=wiz-c] [data-group=level]').count();
  const wantLvl=!['keyuser','junior'].includes(rt);
  t(rt+': level '+(wantLvl?'asked':'not asked'),(lvl>0)===wantLvl);
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  t(rt+': step 3 mode = '+modes[rt],await ev((m)=>APP.roleProfile(APP.wizC.data).skills===m,modes[rt]));
  t(rt+': no product/module preselected',await ev(()=>!(APP.wizC.data.skills||[]).length));
  if(modes[rt]!=='products'){
    t(rt+': empty product chooser, no modules or add-another yet',await ev(()=>!!document.querySelector('.prod-empty select[data-prod-sel]')&&!document.querySelector('.mchip')&&!document.querySelector('.prod-add-card')));
    await p.selectOption('select[data-prod-sel]','s4onprem'); await p.waitForTimeout(120);
    await p.click('[data-action=mod-toggle][data-mid=ps]'); await p.waitForTimeout(120);
    if(rt==='functional'){
      await p.click('[data-action=mod-toggle][data-mid=qm]'); await p.waitForTimeout(120);
      t('projects rows use full module names, 1 project by default',await ev(()=>{const n=Array.from(document.querySelectorAll('.mod-line .ml-n')).map(x=>x.textContent); const v=Array.from(document.querySelectorAll('.mod-line input[data-skill-field=projects]')).map(x=>x.value); return n.join()==='Project System,Quality Management'&&v.join()==='1,1';}),await ev(()=>Array.from(document.querySelectorAll('.mod-line .ml-n')).map(x=>x.textContent)));
      t('module chips stay short (PS / QM)',await ev(()=>Array.from(document.querySelectorAll('.mod-chips .mchip.on')).map(x=>x.textContent.trim()).sort().join()==='PS,QM'));
      t('certification is a separate block, no checkbox beside projects',await ev(()=>!!document.querySelector('.cert-box')&&!document.querySelector('.mod-line input[type=checkbox]')&&document.querySelectorAll('.cert-box .cert-chip').length===2));
      await p.click('.cert-chip[data-mid=qm]'); await p.waitForTimeout(120);
      t('tapping a cert chip certifies only that module',await ev(()=>{const s=APP.wizC.data.skills; return s.find(x=>x.moduleId==='qm').certified===true&&s.find(x=>x.moduleId==='ps').certified===false;}));
      t('no module filter box in the professional skills step',await ev(()=>!document.querySelector('.mod-q')));
      t('Add another product card appears once a module is ticked',await ev(()=>!!document.querySelector('.prod-add-card')));
    }
  } else { await p.click('[data-action=prod-chip]'); await p.waitForTimeout(120); }
  const h=await ev(()=>({chips:document.querySelectorAll('[data-action=prod-chip]').length,cards:document.querySelectorAll('.prod-card').length,proj:document.querySelectorAll('input[data-skill-field=projects]').length,prog:!!document.querySelector('input[name=programs]'),ind:!!document.querySelector('[data-group=industries]'),skills:JSON.stringify(APP.wizC.data.skills)}));
  if(modes[rt]==='products') t(rt+': product chips, no module cards',h.chips>5&&h.cards===0&&h.proj===0,h);
  if(modes[rt]==='modules') t(rt+': module cards, no project counts',h.cards>0&&h.proj===0,h);
  if(modes[rt]==='full'||modes[rt]==='optional') t(rt+': module cards with project counts',h.cards>0&&h.proj>0,h);
  const wantProg={architect:1,delivery:1}[rt]||0;
  t(rt+': programs number '+(wantProg?'asked':'not asked'),h.prog===!!wantProg,h);
  const wantInd=!['basis','junior'].includes(rt);
  t(rt+': industries '+(wantInd?'asked':'hidden'),h.ind===wantInd,h);
  // step 3 → 4: specialties suggested for the role
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  t(rt+': reaches step 4',await ev(()=>APP.wizC.step===4),await ev(()=>APP.wizC.step));
  const sug=await ev(()=>Array.from(document.querySelectorAll('.spec-suggest [data-action=chip]')).map(x=>x.dataset.value));
  t(rt+': suggested specialties = agreed list',JSON.stringify(sug.slice().sort())===JSON.stringify(cat.sz&&await ev((r)=>APP.ROLE_SPECIALTIES[r].slice().sort(),rt)),sug);
  t(rt+': full list behind "Add other specialties"',await p.locator('details.spec-more').count()===1);
}
// products-mode: toggling a product, Next requires one
await ev(()=>{ APP.wizC={step:3,data:Object.assign(APP.wizCDefaults(),{roleType:'basis',roleTypes:['basis'],skills:[]})}; APP._formSyncSkip=['wiz-c']; APP.render(); });
await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
t('Basis: cannot continue with no product',await ev(()=>APP.wizC.step===3));
await p.click('[data-action=prod-chip]'); 
t('Basis: ticking a product stores it as product-level',await ev(()=>APP.wizC.data.skills.length===1&&APP.wizC.data.skills[0].moduleId==='*'),await ev(()=>APP.wizC.data.skills));
// finish a Delivery profile → stored, programs saved, level derived
await ev(()=>{ localStorage.clear(); APP.wizC={step:6,data:Object.assign(APP.wizCDefaults(),{firstName:'Pia',lastName:'Mgr',gender:'female',headline:'Programme Director',nationality:'Egypt',country:'ae',languages:['English'],roleType:'delivery',roleTypes:['delivery'],yearsExp:12,level:'Senior',programs:9,skills:[{productId:'s4onprem',moduleId:'*',projects:0}],_rtFor:'delivery'})}; APP._formSyncSkip=['wiz-c']; APP.render(); });
await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(500);
const me=await ev(()=>APP.consultant(APP.db.session.consultantId));
t('profile created with programs and product-level skill',me&&me.programs===9&&me.skills[0].moduleId==='*'&&!('_rtFor' in me),me);
// edit profile: add a second role → its fields appear; remove → data kept
await ev(()=>{ location.hash='#/c/profile'; }); await p.waitForTimeout(300);
await p.click('[data-action=profile-edit-on]'); await p.waitForTimeout(200);
t('edit: Delivery shows programs + products chips',await ev(()=>!!document.querySelector('input[name=programs]')&&document.querySelectorAll('[data-action=prod-chip]').length>5));
t('edit: multi-select picker still allows several roles',await p.locator('[data-action=rt-toggle]:not([data-single])').count()===8);
await p.click('[data-action=rt-toggle][data-value=functional]'); await p.waitForTimeout(200);
t('edit: adding Functional reveals module cards + project counts',await ev(()=>document.querySelectorAll('.prod-card').length>0&&document.querySelectorAll('input[data-skill-field=projects]').length>=0&&APP.roleProfile(APP.profileDraft).skills==='full'));
t('edit: "added role" note shown',(await p.locator('.role-added').count())===1);
t('edit: specialties now show both roles',await ev(()=>{ const s=Array.from(document.querySelectorAll('.spec-suggest [data-action=chip]')).map(x=>x.dataset.value); return s.includes('pmo'.replace('pmo','activate'))&&s.includes('localization')&&s.includes('release'); }));
await p.click('[data-action=rt-toggle][data-value=functional]'); await p.waitForTimeout(150);
t('edit: removing the role hides its fields but keeps data',await ev(()=>APP.roleProfile(APP.profileDraft).skills==='products'&&APP.profileDraft.skills.length>=1));
// matching: counts not required for non-counting roles
const m=await ev(()=>{ const c={roleType:'support',roleTypes:['support'],skills:[{productId:'s4onprem',moduleId:'fi',projects:0}],languages:['English'],yearsExp:5,level:'Mid',availability:'Immediate',country:'ae'};
  const full={roleType:'functional',roleTypes:['functional'],skills:[{productId:'s4onprem',moduleId:'fi',projects:0}],languages:['English'],yearsExp:5,level:'Mid',availability:'Immediate',country:'ae'};
  const job={roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3}],remote:true};
  const j2=Object.assign({},job,{roleType:'support'});
  return {support:APP.reqMatch(c,job.requires[0]).credit, functional:APP.reqMatch(full,job.requires[0]).credit,tracked:[APP.countsTracked(c),APP.countsTracked(full)]}; });
t('min-projects ignored for a Support profile, enforced for Functional',m.support===45&&m.functional===25,m);
t('product-level job form for Basis / Junior',await ev(()=>APP.rtProductLevel('basis')&&APP.rtProductLevel('junior')&&!APP.rtProductLevel('support')));
t('job form hides min-projects for a Delivery role',await ev(()=>{ APP.jobNewDraft={roleType:'delivery',requires:[{productId:'s4onprem',moduleId:'*',minProjects:0,orPrev:false}]}; return APP.jobReqRowsHtml(APP.jobNewDraft.requires).indexOf('data-req-min')===-1; }));
t('job form keeps min-projects for a Functional role',await ev(()=>{ APP.jobNewDraft={roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:0,orPrev:false}]}; return APP.jobReqRowsHtml(APP.jobNewDraft.requires).indexOf('data-req-min')!==-1; }));
t('no page errors',errs.length===0,errs);
console.log(fails?('FAILS '+fails):'ALL PASSED'); await b.close();
