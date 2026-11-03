/* Release 41: Traffic numbers for the admin (admin_traffic) and the sign-up split in admin_overview */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(ROOT+'/supabase/024_traffic.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/024_traffic.sql','utf8')); // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={boss:'aaaaaaaa-0000-0000-0000-000000000001',p1:'bbbbbbbb-0000-0000-0000-000000000001',p2:'bbbbbbbb-0000-0000-0000-000000000002'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
t('a professional cannot read traffic',!!(await as(U.p1,`select admin_traffic(7)`)).err);
t('a visitor cannot read traffic',!!(await as(null,`select admin_traffic(7)`)).err);
/* p1 has a profile, p2 does not */
await as(U.p1,`select claim_profile('consultant','{"firstName":"Nora","lastName":"F"}'::jsonb)`);
for(const n of ['v:home','v:home','v:job','lnd:facebook','conv:c:facebook','apply']) await as(null,`select track_usage($1)`,[n]);
const TR=await as(U.boss,`select admin_traffic(7) x`); if(TR.err) console.log("ERR",TR.err); const T=TR.rows[0].x;
t('7 days of accounts, today last',T.accounts.length===7&&T.accounts[6].d===new Date().toISOString().slice(0,10),T.accounts.map(a=>a.d));
t('today: 3 accounts, 1 with a profile',T.accounts[6].n===3&&T.accounts[6].p===1,T.accounts[6]);
const u=Object.fromEntries(T.usage.map(r=>[r.name,r.n]));
t('counters are returned as written',u['v:home']===2&&u['v:job']===1&&u['lnd:facebook']===1&&u['conv:c:facebook']===1&&u.apply===1,u);
t('days are limited to 1..90',(await as(U.boss,`select admin_traffic(500) x`)).rows[0].x.days===90&&(await as(U.boss,`select admin_traffic(0) x`)).rows[0].x.days===1);
const O=(await as(U.boss,`select admin_overview() x`)).rows[0].x;
const last=O.series[O.series.length-1];
t('the overview chart splits sign-ups into with / without a profile',O.series.length===14&&last.n===3&&last.p===1,last);
t('the overview still has its other numbers',typeof O.professionals==='number'&&typeof O.noProfile==='number'&&O.noProfile===2,O);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
