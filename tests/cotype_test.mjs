/* Company type (release34): professionals and visitors can read one valid value, nothing else leaks through it */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/017_company_type.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
const U={a:'aaaaaaaa-0000-0000-0000-000000000001',b:'bbbbbbbb-0000-0000-0000-000000000002',c:'cccccccc-0000-0000-0000-000000000003',d:'dddddddd-0000-0000-0000-000000000004',pro:'eeeeeeee-0000-0000-0000-000000000005'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const co=(name,type)=>JSON.stringify({name,companyType:type,about:'x'});
await as(U.a,`select claim_profile('employer',$1::jsonb)`,[co('CustCo','customer')]);
await as(U.b,`select claim_profile('employer',$1::jsonb)`,[co('PartnerCo','partner')]);
await as(U.c,`select claim_profile('employer',$1::jsonb)`,[co('RecruitCo','recruiter')]);
await as(U.d,`select claim_profile('employer',$1::jsonb)`,[co('OddCo','<script>alert(1)</script>')]);
await as(U.pro,`select claim_profile('consultant','{"firstName":"A","lastName":"B"}'::jsonb)`);
const list=async(uid)=>{ const r=await as(uid,`select list_companies() x`); return (r.rows||[]).map(x=>x.x); };
for(const [who,uid] of [['a visitor',null],['a professional',U.pro]]){
  const L=await list(uid); const by=n=>L.find(x=>x.name===n)||{};
  t(who+' sees the three valid types',by('CustCo').companyType==='customer'&&by('PartnerCo').companyType==='partner'&&by('RecruitCo').companyType==='recruiter',L.map(x=>[x.name,x.companyType]));
  t(who+' sees nothing for an invalid value',by('OddCo').companyType===undefined,by('OddCo'));
}
t('the owner still sees their own data as saved',(await as(U.d,`select list_companies() x`)).rows.some(r=>r.x.name==='OddCo'&&r.x.companyType==='<script>alert(1)</script>'));
const pid=(await db.query(`select id from companies where data->>'name'='PartnerCo'`)).rows[0].id;
t('the public company page carries the type',(await as(null,`select get_public_company($1) x`,[pid])).rows[0].x.companyType==='partner');
const red=(await db.query(`select _redact_company(c,'alias-1') x from companies c where data->>'name'='RecruitCo'`)).rows[0].x;
t('a confidential company still shows its type, not its name',red.companyType==='recruiter'&&red.name==='Confidential company'&&red.about===undefined,red);
const red2=(await db.query(`select _redact_company(c,'alias-2') x from companies c where data->>'name'='OddCo'`)).rows[0].x;
t('…and an invalid type is not passed along there either',red2.companyType===undefined);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
