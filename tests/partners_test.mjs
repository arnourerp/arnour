/* SI/Partner capabilities, Find partners and partner requests (release35) */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
for(const f of ['017_company_type.sql','018_partner_capabilities.sql']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f,'utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={cust:'aaaaaaaa-0000-0000-0000-000000000001',cust2:'aaaaaaaa-0000-0000-0000-000000000002',p1:'bbbbbbbb-0000-0000-0000-000000000001',p2:'bbbbbbbb-0000-0000-0000-000000000002',
  rec:'cccccccc-0000-0000-0000-000000000001',unl:'cccccccc-0000-0000-0000-000000000002',pro:'eeeeeeee-0000-0000-0000-000000000005',pro2:'eeeeeeee-0000-0000-0000-000000000006'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const J=(o)=>JSON.stringify(o);
const claim=async(u,role,d)=>(await as(U[u],`select claim_profile($1,$2::jsonb) x`,[role,J(d)])).rows[0].x;
const skill=(p,m,n,c)=>({productId:p,moduleId:m,projects:n,certified:!!c});
const eC=await claim('cust','employer',{name:'Gulf Retail',companyType:'customer',country:'ae'});
const eC2=await claim('cust2','employer',{name:'Nile Foods',companyType:'customer',country:'eg'});
const eP1=await claim('p1','employer',{name:'Alpha SI',companyType:'partner',country:'ae'});
const eP2=await claim('p2','employer',{name:'Secret SI',companyType:'partner',country:'sa',city:'Riyadh',about:'We are Secret SI',contactName:'Sam Secret',contactTitle:'Director'});
const eR=await claim('rec','employer',{name:'Recruit It',companyType:'recruiter'});
const eU=await claim('unl','employer',{name:'No Type Ltd'});
const cPro=await claim('pro','consultant',{firstName:'Pia',lastName:'Pro'});
const cPro2=await claim('pro2','consultant',{firstName:'Paul',lastName:'Pro2'});
const saveP=async(u,d)=>as(U[u],`select save_profile($1::jsonb)`,[J(d)]);

/* ---- cleaning ---- */
const many=Array.from({length:250},(_,i)=>skill('s4public','m'+i,1));
await saveP('p1',{name:'Alpha SI',companyType:'partner',country:'ae',about:'Alpha about',city:'Dubai',contactName:'Ann Alpha',
  partner:{skills:[skill('s4public','fi',12,true),{productId:'<b>',moduleId:'x'},skill('ecc','mm',99999),skill('s4public','fi',3)].concat(many),
    industries:['Banking',123,'Banking',''], delivery:['onsite','teleport'], engagement:['team','x'], teamSize:'11-50', bestAt:'x'.repeat(1000), hideName:'yes', extra:'evil', countries:['ae','sa'], languages:['English','Arabic']}});
let p1=(await db.query(`select data->'partner' p from companies where id=$1`,[eP1])).rows[0].p;
t('skills: bad ids dropped, duplicates merged, capped at 200',p1.skills.length===200&&p1.skills[0].moduleId==='fi'&&p1.skills[0].projects===12&&p1.skills[0].certified===true&&!p1.skills.some(s=>s.productId==='<b>'),p1.skills.slice(0,3));
t('skills: absurd project count becomes 0',p1.skills[1].moduleId==='mm'&&p1.skills[1].projects===0,p1.skills[1]);
t('lists keep only valid, unique values',J(p1.industries)==='["Banking"]'&&J(p1.delivery)==='["onsite"]'&&J(p1.engagement)==='["team"]'&&J(p1.countries)==='["ae","sa"]',p1);
t('text is cut at 400, hideName must be a real true, unknown keys vanish',p1.bestAt.length===400&&p1.hideName===false&&p1.extra===undefined&&p1.teamSize==='11-50',p1.hideName);
await saveP('cust',{name:'Gulf Retail',companyType:'customer',country:'ae',partner:{skills:[skill('s4public','fi',1)]}});
t('only a partner keeps capabilities',(await db.query(`select data ? 'partner' h from companies where id=$1`,[eC])).rows[0].h===false);
await saveP('p1',{name:'Alpha SI',companyType:'partner',country:'ae',about:'Alpha about',city:'Dubai',contactName:'Ann Alpha',partner:{skills:[skill('s4public','fi',12,true)],industries:['Banking'],countries:['ae'],bestAt:'Alpha best',engagement:['team','consultants']}});
await saveP('p2',{name:'Secret SI',companyType:'partner',country:'sa',city:'Riyadh',about:'We are Secret SI',contactName:'Sam Secret',contactTitle:'Director',size:'51-200',
  partner:{skills:[skill('s4public','fi',5),skill('s4public','mm',2)],industries:['Retail & Consumer Goods (FMCG)'],countries:['sa','ae'],bestAt:'Secret SI is the best',hideName:true,engagement:['team']}});
await db.query(`update companies set data=jsonb_set(data,'{partner}', $2::jsonb) where id=$1`,[eP1,J(p1)]); /* the trigger must keep it clean even for direct updates */
t('direct updates are cleaned as well',(await db.query(`select jsonb_array_length(data#>'{partner,skills}') n from companies where id=$1`,[eP1])).rows[0].n===200);
await saveP('p1',{name:'Alpha SI',companyType:'partner',country:'ae',about:'Alpha about',city:'Dubai',contactName:'Ann Alpha',partner:{skills:[skill('s4public','fi',12,true)],industries:['Banking'],countries:['ae'],bestAt:'Alpha best',engagement:['team','consultants']}});
await db.query(`insert into companies(id,owner,data) values ('co-nos',null,'{"name":"No Skills SI","companyType":"partner","partner":{"skills":[]}}')`);
for(const i of [5,6,7,8]) await db.query(`insert into companies(id,owner,data) values ($1,null,$2::jsonb)`,['co-x'+i,J({name:'Extra SI '+i,companyType:'partner',partner:{skills:[skill('s4public','fi',1)]}})]);

/* ---- reading: the list ---- */
const lp=async(u)=>(await as(u?U[u]:null,`select list_partners() x`)).rows.map(r=>r.x);
for(const who of [null,'pro','cust2']){
  const L=await lp(who); const a=L.find(x=>x.name==='Alpha SI'); const h=L.find(x=>x.anon===true&&x.partner&&x.country==='sa');
  t((who||'a visitor')+' sees the named partner with capabilities',a&&a.id===eP1&&a.partner.skills.length===1&&a.companyType==='partner'&&a.about==='Alpha about'&&a.contactName===undefined,a);
  t((who||'a visitor')+' sees the hidden partner without a name',h&&h.id.startsWith('cx:')&&h.name==='Confidential SI/Partner'&&h.partner.bestAt===undefined&&h.city===undefined&&h.about===undefined&&h.contactName===undefined&&h.partner.skills.length===2,h);
  t((who||'a visitor')+' does not see a partner without skills, and the real name leaks nowhere',!L.some(x=>x.name==='No Skills SI')&&!J(L).includes('Secret SI')&&!J(L).includes('Sam Secret')&&!J(L).includes(eP2),null);
}
t('the owner of a hidden partner sees their own name',(await lp('p2')).some(x=>x.name==='Secret SI'));
const lc=async(u)=>(await as(u?U[u]:null,`select list_companies() x`)).rows.map(r=>r.x);
for(const who of [null,'pro','cust']){
  const L=await lc(who);
  t((who||'a visitor')+': the company list hides a hidden partner',!J(L).includes('Secret SI')&&!J(L).includes('Sam Secret')&&L.some(x=>x._anon&&x.companyType==='partner'),L.filter(x=>x._anon));
}
t('the company page of a hidden partner is private',(await as(null,`select get_public_company($1) x`,[eP2])).rows[0].x.private===true);
t('get_partner by real id of a hidden partner gives nothing away',(await as(null,`select get_partner($1) x`,[eP2])).rows[0].x.private===true);
const alias2=(await db.query(`select alias from companies where id=$1`,[eP2])).rows[0].alias;
const gp=(await as(null,`select get_partner($1) x`,[alias2])).rows[0].x;
t('get_partner by alias shows capabilities only',gp.name==='Confidential SI/Partner'&&gp.partner.skills.length===2&&gp.id===alias2&&!J(gp).includes('Secret SI'),gp);
t('get_partner for a named partner and for an unknown id',(await as(null,`select get_partner($1) x`,[eP1])).rows[0].x.name==='Alpha SI'&&(await as(null,`select get_partner('nope') x`)).rows[0].x===null);

/* ---- a hidden partner's role and notifications do not give the name away ---- */
const jid=(await as(U.p2,`select save_job(null,$1::jsonb) x`,[J({title:'FI Team',requires:[]})])).rows[0].x;
const jobsFor=async(u)=>(await as(u?U[u]:null,`select list_jobs() x`)).rows.map(r=>r.x);
t('a hidden partner\'s role shows an alias to others and the real id to its owner',(await jobsFor('pro')).find(j=>j.id===jid).companyId===alias2&&(await jobsFor('p2')).find(j=>j.id===jid).companyId===eP2);
await as(U.p2,`select invite_to_job($1,$2)`,[jid,cPro]);
await as(U.p2,`select send_notification($1,'info','x',$2)`,[cPro,'#/job/'+jid]);
const nt=(await db.query(`select text from notifications where user_key=$1 order by ts desc limit 1`,[cPro])).rows[0];
t('an invitation from a hidden partner names it as confidential',nt&&nt.text.includes('A confidential SI/Partner')&&!nt.text.includes('Secret'),nt);

/* ---- sending a request ---- */
const req=async(u,partner,need,timing,note,share)=>as(U[u],`select request_partner($1,$2,$3,$4,$5) x`,[partner,need,timing,note,!!share]);
for(const [who,why] of [['rec','a recruiter'],['unl','a company without a type'],['p1','a partner'],['pro','a professional']]){
  const r=await req(who,alias2,'team','soon','hi'); t(why+' cannot send a request',!!r.err,r);
}
t('a visitor cannot send a request',!!(await as(null,`select request_partner($1,'team','','',false)`,[alias2])).err);
const r1=await req('cust',alias2,'team','Q1 2027','We need a FI team for a rollout '.repeat(30),true);
t('a customer can ask a hidden partner by its alias',!r1.err&&/^pr/.test(r1.rows[0].x),r1);
const rid=r1.rows[0].x;
t('asking again returns the same open request',(await req('cust',alias2,'team','','',false)).rows[0].x===rid);
const row=(await db.query(`select note,need,from_share from partner_requests where id=$1`,[rid])).rows[0];
t('the note is cut and the choices are kept',row.note.length===600&&row.need==='team'&&row.from_share===true,row.note.length);
t('a wrong "need" becomes both',(await req('cust2',alias2,'weird','','',false)).rows[0].x&&(await db.query(`select need from partner_requests where from_eid=$1`,[eC2])).rows[0].need==='both');
const n2=(await db.query(`select text,link from notifications where user_key=$1 order by ts desc limit 1`,[eP2])).rows[0];
t('the partner is notified, and the text can become an e-mail',n2&&n2.text==='Nile Foods would like to connect about a project'||(n2&&n2.text.includes('would like to connect about a project')),n2);
t('…the e-mail queue picked it up',(await db.query(`select count(*)::int n from email_queue where kind='invites' and user_id=$1`,[U.p2])).rows[0].n>=1);
t('requests cannot be read straight from the table',!!(await as(U.cust,`select * from partner_requests`)).err);

/* ---- before the answer: what each side sees ---- */
const mine=async(u)=>(await as(U[u],`select my_partner_requests() x`)).rows.map(r=>r.x);
let cm=(await mine('cust'))[0];
t('the customer still sees the partner as confidential while pending',cm.status==='pending'&&cm.dir==='out'&&cm.other.id===alias2&&cm.other.name==='Confidential SI/Partner'&&!J(cm).includes('Secret SI')&&cm.contactEmail===null,cm);
let pm=(await mine('p2')).find(x=>x.id===rid);
t('the partner sees who is asking, but no e-mail yet',pm.dir==='in'&&pm.other.name==='Gulf Retail'&&pm.contactEmail===null&&pm.need==='team',pm);
t('a stranger cannot answer, and the customer cannot answer its own request',!!(await as(U.cust2,`select respond_partner_request($1,true,false)`,[rid])).err&&!!(await as(U.cust,`select respond_partner_request($1,true,false)`,[rid])).err);

/* ---- answering ---- */
await as(U.p2,`select respond_partner_request($1,true,true)`,[rid]);
cm=(await mine('cust'))[0]; pm=(await mine('p2')).find(x=>x.id===rid);
t('after accepting, the customer sees the partner by name with contact details and the shared e-mail',cm.status==='accepted'&&cm.other.name==='Secret SI'&&cm.other.contactName==='Sam Secret'&&cm.contactEmail==='p2@arnour.test'&&cm.other.partner.skills.length===2,cm);
t('…and the partner sees the customer\'s e-mail because the customer agreed to share it',pm.status==='accepted'&&pm.contactEmail==='cust@arnour.test',pm);
t('the name is revealed to that customer only',J(await lc('cust')).includes('Secret SI')&&!J(await lc('cust2')).includes('Secret SI')&&(await lp('cust')).some(x=>x.name==='Secret SI')&&!(await lp('cust2')).some(x=>x.name==='Secret SI'));
t('a revealed partner\'s role shows the real company to that customer only',(await jobsFor('cust')).find(j=>j.id===jid).companyId===eP2&&(await jobsFor('cust2')).find(j=>j.id===jid).companyId===alias2);
const nc=(await db.query(`select text from notifications where user_key=$1 order by ts desc limit 1`,[eC])).rows[0];
t('the customer is told, with the real name, in the wording that sends an e-mail',nc.text==='Secret SI accepted your introduction — you can now see their contact details',nc);
t('answering twice changes nothing',!(await as(U.p2,`select respond_partner_request($1,false,false)`,[rid])).err&&(await mine('cust'))[0].status==='accepted');
t('an accepted pair cannot send again',!!(await req('cust',alias2,'team','','',false)).err);

/* ---- declining, repeat guard, daily limit ---- */
const r2=(await req('cust',eP1,'both','','',false)).rows[0].x;
await as(U.p1,`select respond_partner_request($1,false,true)`,[r2]);
const dn=(await db.query(`select text from notifications where user_key=$1 order by ts desc limit 1`,[eC])).rows[0];
t('a decline tells the customer plainly and without a name',dn.text==='Your request to a partner was not accepted this time');
t('the customer cannot ask the same partner again within 30 days',!!(await req('cust',eP1,'both','','',false)).err);
t('a decline never shares an e-mail address',(await mine('cust')).find(x=>x.id===r2).contactEmail===null);
for(const i of [5,6,7]) await req('cust','co-x'+i,'both','','',false);
const lim=await req('cust','co-x8','both','','',false);
t('at most 5 requests a day per customer',!!lim.err&&/too many/.test(lim.err),lim);
t('a partner without skills cannot be asked',!!(await req('cust2','co-nos','both','','',false)).err);

/* ---- a professional introduced to a hidden partner sees its name ---- */
const ci=(await as(U.p2,`select create_intro('e',$1,$2,null,'Hello') x`,[cPro,eP2])).rows[0].x;
t('before accepting, a professional still sees the partner as confidential',!J(await lc('pro')).includes('Secret SI'));
await as(U.pro,`select respond_intro($1,true)`,[ci]);
t('after accepting an introduction, that professional sees the name',J(await lc('pro')).includes('Secret SI')&&!J(await lc('pro2')).includes('Secret SI'));
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
