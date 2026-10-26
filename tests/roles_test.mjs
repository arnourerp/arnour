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
t('40 specialties in the catalogue',cat.total===40,cat.total);
t('sizes: F12 T14 B13 A17 D13 S8 K10 J6',JSON.stringify(cat.sz)===JSON.stringify({functional:12,technical:14,basis:13,architect:17,delivery:13,support:8,keyuser:10,junior:6}),cat.sz);
t('Basis role renamed',await ev(()=>APP.roleTypeLabel('basis')==='Basis, Cloud & Security'));
// wizard: single role, note shown, one role only
await ev(()=>{ APP.wizC=null; location.hash='#/onboard'; }); await p.waitForTimeout(400);
t('wizard reachable in demo',await ev(()=>!!document.querySelector('form[data-form=wiz-c]')));
t('role picker explains adding a role later',(await p.textContent('.rt-callout')).includes('You can add more later in Edit profile'));
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
const modes={functional:'full',technical:'optional',basis:'products',architect:'modules',delivery:'modules',support:'modules',keyuser:'modules',junior:'products'};
for(const rt of Object.keys(modes)){
  await ev((rt)=>{ APP.wizC={step:1,data:Object.assign(APP.wizCDefaults(),{firstName:'A',lastName:'B',gender:'male',headline:'H',nationality:'Egypt',country:'ae',languages:['English']})}; APP.rtSet(APP.wizC.data,[rt]); APP._formSyncSkip=['wiz-c']; APP.render(); },rt);
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  t(rt+': step 1 → 2',await ev(()=>APP.wizC.step===2),await ev(()=>Array.from(document.querySelectorAll('.toast')).map(x=>x.textContent).join('|')+' step='+APP.wizC.step+' d='+JSON.stringify(APP.wizC.data).slice(0,200)));
  const lvl=await p.locator('form[data-form=wiz-c] [data-group=level]').count();
  const wantLvl=!['keyuser','junior'].includes(rt);
  t(rt+': level '+(wantLvl?'asked':'not asked'),(lvl>0)===wantLvl);
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  const lead=['architect','delivery'].includes(rt);
  if(lead){ t(rt+': expertise (specialties) comes before SAP skills',await ev(()=>APP.wizC.step===4&&/Your expertise/.test(document.querySelector('.wiz-title').textContent)),await ev(()=>APP.wizC.step));
    await ev(()=>{ APP.wizC.step=3; APP._formSyncSkip=['wiz-c']; APP.render(); }); await p.waitForTimeout(100);
    t(rt+': skills step is called SAP landscape',await ev(()=>/SAP landscape/.test(document.querySelector('.wiz-title').textContent))); }
  else t(rt+': SAP skills come right after experience',await ev(()=>APP.wizC.step===3));
  t(rt+': step 3 mode = '+modes[rt],await ev((m)=>APP.roleProfile(APP.wizC.data).skills===m,modes[rt]));
  t(rt+': no product/module preselected',await ev(()=>!(APP.wizC.data.skills||[]).length));
  if(modes[rt]!=='products'){
    t(rt+': empty product chooser, no modules or add-another yet',await ev(()=>!!document.querySelector('.prod-empty select[data-prod-sel]')&&!document.querySelector('.mchip')&&!document.querySelector('.prod-add-card')));
    await p.selectOption('select[data-prod-sel]','s4onprem'); await p.waitForTimeout(120);
    await p.click('[data-action=mod-toggle][data-mid=ps]'); await p.waitForTimeout(120);
    if(rt==='functional'){
      await p.click('[data-action=mod-toggle][data-mid=qm]'); await p.waitForTimeout(120);
      t('projects rows use full module names, 1 project by default',await ev(()=>{const n=Array.from(document.querySelectorAll('.mod-line .ml-n')).map(x=>x.textContent); const v=Array.from(document.querySelectorAll('.mod-line input[data-skill-field=projects]')).map(x=>x.value); return n.join()==='Project System,Quality Management'&&v.join()==='1,1';}),await ev(()=>Array.from(document.querySelectorAll('.mod-line .ml-n')).map(x=>x.textContent)));
      t('module chips stay short (EPPM / PS, QM)',await ev(()=>Array.from(document.querySelectorAll('.mod-chips .mchip.on')).map(x=>x.textContent.trim()).sort().join()==='EPPM / PS,QM'));
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
  t(rt+': programs number not on the skills step',h.prog===false,h);
  const wantInd=!['basis','junior'].includes(rt);
  t(rt+': industries '+(wantInd?'asked':'hidden'),h.ind===wantInd,h);
  // step 3 → 4: specialties suggested for the role
  await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(150);
  if(lead){ t(rt+': after the SAP landscape comes the finish step',await ev(()=>APP.wizC.step===6),await ev(()=>APP.wizC.step));
    await ev(()=>{ APP.wizC.step=4; APP._formSyncSkip=['wiz-c']; APP.render(); }); await p.waitForTimeout(100);
    t(rt+': programmes asked on the expertise step',await ev(()=>!!document.querySelector('form[data-form=wiz-c] [name=programs]'))); }
  else t(rt+': reaches step 4',await ev(()=>APP.wizC.step===4),await ev(()=>APP.wizC.step));
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
t('edit: Delivery shows programs + product cards (modules optional)',await ev(()=>!!document.querySelector('input[name=programs]')&&document.querySelectorAll('.prod-card, .prod-empty').length>0));
t('edit: Delivery lists specialties before SAP skills',await ev(()=>{ const f=document.querySelector('form[data-form=profile-edit]'); const sp=f.querySelector('.spec-panel'), sk=f.querySelector('.skill-rows'); return !!sp&&!!sk&&(sp.compareDocumentPosition(sk)&Node.DOCUMENT_POSITION_FOLLOWING)>0; }));
t('edit: multi-select picker still allows several roles',await p.locator('[data-action=rt-toggle]:not([data-single])').count()===8);
await p.click('[data-action=rt-toggle][data-value=functional]'); await p.waitForTimeout(200);
t('edit: adding Functional reveals module cards + project counts',await ev(()=>document.querySelectorAll('.prod-card').length>0&&document.querySelectorAll('input[data-skill-field=projects]').length>=0&&APP.roleProfile(APP.profileDraft).skills==='full'));
t('edit: "added role" note shown',(await p.locator('.role-added').count())===1);
t('edit: specialties now show both roles',await ev(()=>{ const s=Array.from(document.querySelectorAll('.spec-suggest [data-action=chip]')).map(x=>x.dataset.value); return s.includes('pmo'.replace('pmo','activate'))&&s.includes('localization')&&s.includes('release'); }));
await p.click('[data-action=rt-toggle][data-value=functional]'); await p.waitForTimeout(150);
t('edit: removing the role hides its fields but keeps data',await ev(()=>APP.roleProfile(APP.profileDraft).skills==='modules'&&APP.profileDraft.skills.length>=1));
// matching: counts not required for non-counting roles
const m=await ev(()=>{ const c={roleType:'support',roleTypes:['support'],skills:[{productId:'s4onprem',moduleId:'fi',projects:0}],languages:['English'],yearsExp:5,level:'Mid',availability:'Immediate',country:'ae'};
  const full={roleType:'functional',roleTypes:['functional'],skills:[{productId:'s4onprem',moduleId:'fi',projects:0}],languages:['English'],yearsExp:5,level:'Mid',availability:'Immediate',country:'ae'};
  const job={roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:3}],remote:true};
  const j2=Object.assign({},job,{roleType:'support'});
  return {support:APP.reqFit(c,job.requires[0],'support').credit, functional:APP.reqFit(full,job.requires[0],'functional').credit,tracked:[APP.countsTracked(c),APP.countsTracked(full)]}; });
t('min-projects ignored for a Support profile, enforced for Functional',m.support===1&&Math.abs(m.functional-0.55)<1e-9,m);
t('product-level job form for Basis / Junior',await ev(()=>APP.rtProductLevel('basis')&&APP.rtProductLevel('junior')&&!APP.rtProductLevel('support')));
t('job form hides min-projects for a Delivery role',await ev(()=>{ APP.jobNewDraft={roleType:'delivery',requires:[{productId:'s4onprem',moduleId:'*',minProjects:0,orPrev:false}]}; return APP.jobReqRowsHtml(APP.jobNewDraft.requires).indexOf('data-req-min')===-1; }));
t('job form keeps min-projects for a Functional role',await ev(()=>{ APP.jobNewDraft={roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi',minProjects:0,orPrev:false}]}; return APP.jobReqRowsHtml(APP.jobNewDraft.requires).indexOf('data-req-min')!==-1; }));
// Match v19 edge cases
const E1=await ev(()=>{
  const S=(productId,moduleId,projects)=>({productId,moduleId,projects});
  const base={yearsExp:8,level:'Senior',country:'ae',city:'Dubai',languages:['English']};
  const basisJob={roleType:'basis',requires:[{productId:'s4onprem',moduleId:'basis'},{productId:'s4onprem',moduleId:'hanadba'}],minExp:7,level:'Senior',country:'ae',city:'Dubai'};
  const basisC=Object.assign({roleTypes:['basis'],skills:[S('s4onprem','*',0)]},base);
  const fj={roleType:'functional',requires:[{productId:'s4onprem',moduleId:'fi'}],languages:['English','Arabic'],certification:'required',country:'ae',city:'Dubai'};
  const noLang=Object.assign({roleTypes:['functional'],skills:[S('s4onprem','fi',3)]},base,{languages:[]});
  const partLang=Object.assign({},noLang,{languages:['English']});
  const unset=Object.assign({},noLang,{roleTypes:[],languages:['English','Arabic']});
  const adj=Object.assign({},noLang,{roleTypes:['support'],languages:['English','Arabic']});
  const mods=['fi','co','mm','sd','ewm','pm','ps','qm'];
  const anyJob={roleType:'functional',requires:mods.map((m,i)=>({productId:'s4onprem',moduleId:m,orPrev:i>0})),minExp:5,level:'Mid',country:'ae',city:'Dubai'};
  const one=Object.assign({roleTypes:['functional'],skills:[S('s4onprem','mm',4)],languages:['English'],yearsExp:6,level:'Mid',country:'ae',city:'Dubai'});
  const two=Object.assign({},one,{skills:[S('s4onprem','mm',4),S('s4onprem','sd',3)]});
  const short=Object.assign({},anyJob,{requires:anyJob.requires.slice(0,3)});
  const bd=APP.matchDetail(basisC,basisJob);
  return {basisGaps:bd.gaps.join('|'), basisScore:bd.score,
    noLang:APP.matchDetail(noLang,fj).gaps.join('|'), langOrder:APP.matchDetail(noLang,fj).otherFit<=APP.matchDetail(partLang,fj).otherFit,
    unsetBelowAdj:APP.roleFit(unset,'functional').f<APP.roleFit(adj,'functional').f, unset:APP.roleFit(unset,'functional').f,
    certReq:APP.matchDetail(adj,fj).gaps.some(g=>g==='Missing required module certification'),
    certPref:APP.matchDetail(adj,Object.assign({},fj,{certification:'preferred'})).gaps.some(g=>g==='Preferred certification not held'),
    one:APP.matchDetail(one,anyJob).coreFit, two:APP.matchDetail(two,anyJob).coreFit, oneShort:APP.matchDetail(one,short).coreFit,
    fam:[APP.MODULE_FAMILY.bw,APP.MODULE_FAMILY.datasphere,APP.MODULE_FAMILY.ibp,APP.MODULE_FAMILY.integration,APP.MODULE_FAMILY.fiorui5]};
});
t('wildcard Basis match leaves no "undefined+" gap text',E1.basisGaps.indexOf('undefined')===-1&&E1.basisScore===85,E1);
t('blank required languages never beat a partial list; gap names the language',E1.langOrder&&E1.noLang.indexOf('Missing required language: English / Arabic')!==-1,E1);
t('unset role type scores below an adjacent role',E1.unsetBelowAdj&&E1.unset===0.6,E1);
t('certification gap text differs for required vs preferred',E1.certReq&&E1.certPref,E1);
t('broad any-of list: one module 90%, two modules 100%, short lists unchanged',E1.one===90&&E1.two===100&&E1.oneShort===100,E1);
t('module families cover BTP / Data / IBP and the typo is gone',E1.fam[0]&&E1.fam[1]&&E1.fam[2]&&E1.fam[3]&&E1.fam[4]===undefined,E1);
t('no page errors',errs.length===0,errs);
console.log(fails?('FAILS '+fails):'ALL PASSED'); await b.close();
