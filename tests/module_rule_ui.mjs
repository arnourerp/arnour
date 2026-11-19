import {createRequire} from 'module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1100,height:900}}); const errs=[];
p.on('pageerror',e=>errs.push(e.message));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
await p.route('**/fonts.googleapis.com/**',r=>r.abort());
await p.goto('http://localhost:'+(process.env.PORT_DEMO||8124)+'/index.html'); await p.waitForSelector('.hero');
const ev=(f,a)=>p.evaluate(f,a);
const go=async(rt,skills)=>{ await ev(([rt,skills])=>{ APP.wizC={step:3,data:Object.assign(APP.wizCDefaults(),{firstName:'A',lastName:'B',gender:'male',headline:'H',nationality:'Egypt',country:'ae',languages:['English'],yearsExp:5,skills:skills}),err:null}; APP.rtSet(APP.wizC.data,[rt]); APP._formSyncSkip=['wiz-c']; location.hash='#/onboard'; APP.render(); },[rt,skills]); await p.waitForTimeout(250); };
const submit=async()=>{ await p.evaluate(()=>document.querySelector('form[data-form=wiz-c]').requestSubmit()); await p.waitForTimeout(300); };
const step=()=>ev(()=>APP.wizC.step);
// 1. wording
await go('functional',[{productId:'s4onprem',moduleId:'fi',projects:4,certified:false}]);
const lab=await ev(()=>Array.from(document.querySelectorAll('.prod-card .field > .label')).map(x=>x.textContent).join('|'));
t('label asks for one or more modules',/Modules you've delivered \(choose one or more\)/.test(lab)&&!/tick all/.test(lab),lab);
// 2. a product with no module is refused for Functional (left-over product-only row from another role)
await go('functional',[{productId:'s4onprem',moduleId:'*',projects:0,certified:false}]);
await submit();
t('functional: product-only row is refused',await step()===3);
t('functional: message names the product and asks for a module',await ev(()=>/Pick at least one module for/.test((APP.wizC.err||{}).skills||'')),await ev(()=>APP.wizC.err));
t('functional: the product card stays on screen without a ticked module',await ev(()=>!!document.querySelector('.prod-card')&&!document.querySelector('.prod-card .mchip.on')));
t('functional: the product-only row was turned into an empty placeholder',await ev(()=>!(APP.wizC.data.skills||[]).some(k=>k.moduleId==='*')));
// 3. placeholder only
await go('functional',[{productId:'s4onprem',moduleId:'',projects:0,certified:false}]);
await submit();
t('functional: product without module refused',await step()===3);
// 4. support and key user need modules too
for(const rt of ['support','keyuser','technical']){
  await go(rt,[{productId:'s4onprem',moduleId:'',projects:0,certified:false}]); await submit();
  t(rt+': product without module refused',await step()===3);
}
// 5. junior and basis stay product-only
for(const rt of ['junior','basis']){
  await go(rt,[{productId:'s4onprem',moduleId:'*',projects:0,certified:false}]); await submit();
  t(rt+': product only is accepted',await step()!==3);
}
// 6. real modules with a good count: no pop-up
await go('functional',[{productId:'s4onprem',moduleId:'fi',projects:4,certified:false},{productId:'s4onprem',moduleId:'co',projects:3,certified:false}]);
await submit();
t('no pop-up when every module has 2 or more projects',await ev(()=>!document.getElementById('dlg-root')&&APP.wizC.step!==3));
// 7. one module at 1 project: pop-up lists modules, Go back keeps the step, Continue goes on
await go('functional',[{productId:'s4onprem',moduleId:'fi',projects:4,certified:false},{productId:'s4onprem',moduleId:'co',projects:1,certified:false}]);
await submit();
t('pop-up shows when a module is at 1 project',await ev(()=>!!document.getElementById('dlg-root')&&document.querySelectorAll('.pc-row').length===2&&document.querySelectorAll('.pc-row.low').length===1));
t('step stays on 3 while the pop-up is open',await step()===3);
await p.click('.pc-row.low [data-action=pc-step][data-d="1"]'); await p.waitForTimeout(100);
t('stepper in the pop-up changes the number',await ev(()=>APP.wizC.data.skills[1].projects===2&&document.querySelector('.pc-row[data-pc="1"] .pc-val').textContent==='2'&&!document.querySelector('.pc-row.low')));
await p.click('[data-action=dlg-cancel].btn'); await p.waitForTimeout(300);
t('Go back closes the pop-up and stays on step 3',await ev(()=>!document.getElementById('dlg-root')&&APP.wizC.step===3&&APP.wizC.data.skills[1].projects===2));
await ev(()=>{ APP.wizC.data.skills[1].projects=0; APP._formSyncSkip=['wiz-c']; APP.render(); }); await p.waitForTimeout(150);
await submit();
t('pop-up again for 0 projects',await ev(()=>!!document.getElementById('dlg-root')&&document.querySelectorAll('.pc-row.low').length===1));
await p.click('#dlg-ok'); await p.waitForTimeout(500);
t('Looks right, continue moves on with the saved numbers',await ev(()=>APP.wizC.step!==3&&APP.wizC.data.skills[1].projects===0));
// 8. modules-only roles do not count projects, so no pop-up
await go('support',[{productId:'s4onprem',moduleId:'fi',projects:0,certified:false}]); await submit();
t('support: no pop-up (no counts kept)',await ev(()=>!document.getElementById('dlg-root')&&APP.wizC.step!==3));
t('no page errors',errs.length===0,errs);
console.log(fails?('FAILS '+fails):'ALL PASSED'); await b.close(); process.exit(fails?1:0);
