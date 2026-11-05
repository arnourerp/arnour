/* "Other tools & third-party solutions" (release48): a free-text list on the professional profile, shown to companies, even when the name is hidden */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
for(const f of ['017_company_type.sql','018_partner_capabilities.sql','021_avatars.sql','028_other_tools.sql']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f,'utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={pub:'aaaaaaaa-0000-0000-0000-000000000001',anon:'aaaaaaaa-0000-0000-0000-000000000002',viewer:'bbbbbbbb-0000-0000-0000-000000000009'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); return await db.query(sql,args||[]); }
const J=(o)=>JSON.stringify(o);
const claim=async(u,role,d)=>(await as(U[u],`select claim_profile($1,$2::jsonb) x`,[role,J(d)])).rows[0].x;
const base={firstName:'Pia',lastName:'Pro',headline:'FI lead',country:'ae',skills:[],otherTools:['Vertex','Blackline']};
const cPub=await claim('pub','consultant',{...base,anon:false});
const cAnon=await claim('anon','consultant',{...base,firstName:'Ana',anon:true});
await claim('viewer','employer',{name:'Viewer Co',country:'ae',industry:'Retail',size:'11-50',companyType:'customer'});
const row=async(u,id)=>(await as(U[u],`select * from list_consultants()`)).rows.map(r=>r.list_consultants).find(x=>x.id===id);
t('a company sees the tools of a public professional',J((await row('viewer',cPub)||{}).otherTools)===J(['Vertex','Blackline']),await row('viewer',cPub));
const a=await row('viewer',cAnon)||{};
t('an anonymous professional still shows the tools, but no name',J(a.otherTools)===J(['Vertex','Blackline'])&&a.firstName==='',a);
t('the owner sees their own tools',J((await row('anon',cAnon)||{}).otherTools)===J(['Vertex','Blackline']));
console.log(fails?('FAILED '+fails):'ALL OK'); process.exit(fails?1:0);
