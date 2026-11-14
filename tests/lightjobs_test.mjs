/* Release 49: the light role list shows exactly the roles list_jobs() shows, minus the description of other people's roles;
   texts are only given for roles the caller may see. */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db; const ROOT=process.env.ARNOUR_ROOT;
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');}else console.log('ok  ',n); };
const sqlFile=fs.readFileSync(ROOT+'/supabase/029_light_jobs.sql','utf8');
const r49=await db.exec(sqlFile); t('release 49 runs and answers ok',JSON.stringify(r49[r49.length-1].rows)==='[{"release49":"ok"}]');
const U={co:'11111111-0000-0000-0000-000000000001',co2:'22222222-0000-0000-0000-000000000002',pro:'33333333-0000-0000-0000-000000000003',pro2:'44444444-0000-0000-0000-000000000004'};
for(const k of Object.keys(U)) await db.query('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
const as=async(k,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${k?U[k]:''}',false); set role ${k?'authenticated':'anon'};`); try{ return (await db.query(q,a)).rows; } finally { await db.exec('reset role'); } };
const claim=async(k,role,data)=>(await as(k,`select claim_profile($1,$2::jsonb) x`,[role,JSON.stringify(data)]))[0].x;
const coId=await claim('co','employer',{name:'Crescent',industry:'Retail',country:'ae'});
const co2Id=await claim('co2','employer',{name:'Dune',industry:'Energy',country:'sa'});
const proId=await claim('pro','consultant',{firstName:'Pia',lastName:'Pro',anon:false,country:'ae',skills:[{productId:'ecc',moduleId:'fi',projects:3}],roleTypes:['functional']});
await claim('pro2','consultant',{firstName:'Tom',lastName:'Two',anon:false,country:'ae',skills:[]});
const LONG='We need an FI lead. '.repeat(150)+'Zanzibar rollout. Emoji 🚀 and Arabic نص.';
const job=(title,extra)=>Object.assign({title,roleType:'functional',country:'ae',requires:[{productId:'ecc',moduleId:'fi'}],description:LONG+' '+title,employmentType:'Contract',duration:'6 months'},extra||{});
const save=async(k,id,data,status)=>{ await as(k,`select save_job($1,$2::jsonb)`,[id,JSON.stringify(Object.assign({},data,status?{status}:{}))]); };
await save('co','j-open',job('Open role'));
await save('co','j-nodesc',Object.assign(job('No text'),{description:''}));
await save('co','j-closed',job('Closed role'));
await save('co','j-applied',job('Applied then closed'));
await save('co','j-draft',job('Draft role'));
await save('co2','j-other',job('Other company role',{confidential:true}));
await db.query(`update jobs set status='draft' where id='j-draft'`);
await as('pro',`select apply_to_job('j-applied','hi')`);
await db.query(`update jobs set status='closed' where id in ('j-closed','j-applied')`);
t('test data is in place',(await db.query(`select count(*)::int n from jobs where id like 'j-%'`)).rows[0].n===6);

const full=async(k)=>(await as(k,`select list_jobs() x`)).map(r=>r.x);
const light=async(k)=>(await as(k,`select list_jobs_light() x`)).map(r=>r.x);
const byId=(a)=>Object.fromEntries(a.map(x=>[x.id,x]));
const strip=(x)=>{ const c=Object.assign({},x); delete c.description; delete c.descN; return JSON.stringify(Object.keys(c).sort().map(k=>[k,c[k]])); };
for (const who of [null,'pro','pro2','co','co2']) {
  const F=await full(who), L=await light(who), f=byId(F), l=byId(L), label=who||'visitor';
  t(label+': same roles in the same order',JSON.stringify(F.map(x=>x.id))===JSON.stringify(L.map(x=>x.id)),[F.map(x=>x.id),L.map(x=>x.id)]);
  t(label+': every other field is identical',F.every(x=>strip(x)===strip(l[x.id])));
  t(label+': other people\'s roles come without the text, with its length',L.filter(x=>!x.mine).every(x=>!('description' in x)&&x.descN===Array.from(f[x.id].description||'').length));
  t(label+': own roles come complete (text kept, no length marker)',L.filter(x=>x.mine).every(x=>x.description===f[x.id].description&&!('descN' in x)));
  const texts=(await as(who,`select list_job_texts() x`))[0].x;
  t(label+': texts are given for exactly the visible roles that have one',JSON.stringify(Object.keys(texts).sort())===JSON.stringify(F.filter(x=>x.description).map(x=>x.id).sort())&&F.filter(x=>x.description).every(x=>texts[x.id]===x.description));
  for (const id of ['j-open','j-nodesc','j-closed','j-applied','j-draft','j-other','nope']) {
    const got=(await as(who,`select get_job_text($1) x`,[id]))[0].x, want=f[id]?(f[id].description===undefined?null:f[id].description):null;
    if(got!==want){ t(label+': get_job_text('+id+') matches what list_jobs shows',false,[got&&got.length,want&&want.length]); }
  }
  t(label+': single texts checked',true);
}
/* the cases that matter, spelled out */
const v=byId(await light(null)), p=byId(await light('pro')), p2=byId(await light('pro2')), c=byId(await light('co'));
t('visitor: sees the open roles only',!!v['j-open']&&!!v['j-other']&&!v['j-draft']&&!v['j-closed']&&!v['j-applied']);
t('professional who applied still sees the closed role; another professional does not',!!p['j-applied']&&!p2['j-applied']);
t('a draft is only in its owner\'s list',!!c['j-draft']&&!p['j-draft']&&!v['j-draft']);
t('nobody else can read a draft\'s text',(await as('pro',`select get_job_text('j-draft') x`))[0].x===null&&(await as(null,`select get_job_text('j-draft') x`))[0].x===null&&(await as('co2',`select get_job_text('j-draft') x`))[0].x===null);
t('a closed role\'s text is not given to a professional who never applied',(await as('pro2',`select get_job_text('j-closed') x`))[0].x===null&&(await as('pro',`select get_job_text('j-applied') x`))[0].x.includes('Zanzibar'));
t('a role without a description has length 0',v['j-nodesc'].descN===0);
t('length counts characters (emoji and Arabic included)',v['j-open'].descN===Array.from(LONG+' Open role').length);
t('confidential company stays hidden in the light list',v['j-other'].companyId!==co2Id&&v['j-other'].confidential===true);
t('visitors do not get the apply link or pay in the light list either',!('applyUrl' in v['j-open'])&&!('rateMin' in v['j-open']));
const size=(a)=>JSON.stringify(a).length;
const own=(a)=>a.filter(x=>/^j-/.test(x.id)); /* the seeded sample roles have very short texts; measure on the roles made here */
const sf=size(own(await full('pro'))), sl=size(own(await light('pro')));
t('the light list is much smaller ('+sl+' vs '+sf+' characters)',sl<sf*0.25);
/* rights */
const acl=async(fn)=>(await db.query(`select has_function_privilege('anon',$1,'execute') a, has_function_privilege('authenticated',$1,'execute') b`,[fn])).rows[0];
for (const fn of ['public.list_jobs_light()','public.get_job_text(text)','public.list_job_texts()']) { const r=await acl(fn); t(fn+' can be called by visitors and signed-in people',r.a&&r.b); }
t('running the release again is harmless',await (async()=>{ await db.exec(sqlFile); return (await light(null)).length===(await full(null)).length; })());
t('list_jobs itself is unchanged by the release',!/create or replace function public\.list_jobs\(\)/.test(sqlFile));
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
