/* Release 40: Health errors (clear all, mark fixed, history) and the Report reasons */
import {makeBackend} from './harness.mjs'; import fs from 'fs'; import path from 'path';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(ROOT+'/supabase/023_error_history.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/023_error_history.sql','utf8')); // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={boss:'aaaaaaaa-0000-0000-0000-000000000001',p1:'bbbbbbbb-0000-0000-0000-000000000001'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const log=(m,s='rpc',p='#/x')=>as(null,`select log_client_error($1,$2,$3,'Mozilla/5.0 test')`,[m,s,p]);
const health=async()=>(await as(U.boss,`select admin_health() x`)).rows[0].x;
const hist=async()=>(await as(U.boss,`select admin_error_history() x`)).rows[0].x;
const fpOf=async(m)=>(await db.query(`select fp from client_errors where message=$1`,[m])).rows[0].fp;

/* only the admin */
for(const [n,sql] of [['resolve',`select admin_error_resolve('x','fixed','n')`],['history',`select admin_error_history()`],['clear',`select admin_clear_errors()`],['health',`select admin_health()`]]){
  t('a professional cannot call '+n,!!(await as(U.p1,sql)).err); t('a visitor cannot call '+n,!!(await as(null,sql)).err);
}
t('the history table is closed to direct reads',!!(await as(U.p1,`select * from client_errors_history`)).err);

/* errors arrive from visitors */
await log('RPC thing_a failed: boom'); await log('RPC thing_a failed: boom'); await log('Unhandled: Load failed','promise'); await log('RPC thing_c failed: bad');
let h=await health();
t('three grouped errors, the repeated one counted twice',h.errors.length===3&&h.errors.find(e=>/thing_a/.test(e.message)).n===2,h.errors);
t('none has been dealt with before',h.errors.every(e=>e.returned===false));

/* mark one fixed with a note */
const fa=await fpOf('RPC thing_a failed: boom');
t('an unknown outcome is refused',!!(await as(U.boss,`select admin_error_resolve($1,'maybe','')`,[fa])).err);
t('an unknown error is refused',!!(await as(U.boss,`select admin_error_resolve('nope','fixed','')`)).err);
t('the admin can mark it fixed',!(await as(U.boss,`select admin_error_resolve($1,'fixed',$2)`,[fa,'  Fixed in release 40 (commit abc)  '])).err);
h=await health();
t('it leaves the list',h.errors.length===2&&!h.errors.some(e=>/thing_a/.test(e.message)));
let H=await hist();
t('it is in the history with its count, note (trimmed) and outcome',H.length===1&&H[0].outcome==='fixed'&&H[0].n===2&&H[0].note==='Fixed in release 40 (commit abc)'&&/thing_a/.test(H[0].message)&&H[0].resolved_ts>0,H);
t('a note over 500 characters is cut',!(await as(U.boss,`select admin_error_resolve($1,'noise',$2)`,[await fpOf('Unhandled: Load failed'),'x'.repeat(900)])).err&&(await hist()).find(x=>/Load failed/.test(x.message)).note.length===500);

/* the same error coming back is flagged */
await log('RPC thing_a failed: boom');
h=await health(); const back=h.errors.find(e=>/thing_a/.test(e.message));
t('an error that was fixed and returns shows as "came back" with a fresh count',back&&back.returned===true&&back.n===1,back);
t('the others are not flagged',h.errors.filter(e=>!/thing_a/.test(e.message)).every(e=>e.returned===false));

/* Clear all works and keeps a copy */
t('Clear all works',!(await as(U.boss,`select admin_clear_errors()`)).err);
h=await health(); H=await hist();
t('the list is empty and everything cleared is in the history',h.errors.length===0&&H.filter(x=>x.outcome==='cleared').length===2,H.map(x=>x.outcome));
t('history keeps the earlier entries too',H.length===4&&H.filter(x=>x.outcome==='fixed').length===1&&H.filter(x=>x.outcome==='noise').length===1);
t('the history is newest first and limit works',H[0].resolved_ts>=H[H.length-1].resolved_ts&&(await as(U.boss,`select admin_error_history(2) x`)).rows[0].x.length===2);
t('actions are in the activity log',(await db.query(`select count(*)::int n from admin_log where action in ('error fixed','error noise','clear errors')`)).rows[0].n===3);

/* Report reasons: every reason the page offers must be accepted by the database */
const adminJs=fs.readFileSync(ROOT+'/js/admin.js','utf8');
const block=adminJs.match(/var REASONS = \[([\s\S]*?)\];/)[1];
const reasons=[...block.matchAll(/\['([a-z]+)'/g)].map(m=>m[1]);
t('the page offers the expected reasons',reasons.length>=6&&reasons.includes('abuse')&&reasons.includes('inappropriate'),reasons);
for(const r of reasons){
  const res=await db.query(`insert into reports(reporter,kind,target,reason) values (null,'profile','x',$1)`,[r]).then(()=>null,e=>e.message);
  t('the report reason "'+r+'" is accepted',res===null,res);
}
t('an invented reason is still refused',!!(await db.query(`insert into reports(reporter,kind,target,reason) values (null,'profile','x','nonsense')`).then(()=>null,e=>e.message)));

/* Supabase refuses DELETE / UPDATE without WHERE: no function in the SQL files may do it */
const files=fs.readdirSync(ROOT+'/supabase').filter(f=>/\.sql$/.test(f)&&!/^00[24]_seed|seed/.test(f));
const bad=[];
for(const f of files){ const s=fs.readFileSync(path.join(ROOT,'supabase',f),'utf8').replace(/--[^\n]*/g,'');
  for(const m of s.matchAll(/\bdelete\s+from\s+(?:only\s+)?[\w.]+\s*(?:;|\$\$)/gi)) bad.push(f+': '+m[0].replace(/\s+/g,' ')); }
t('no function deletes without a WHERE clause',bad.length===0,bad);

console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
