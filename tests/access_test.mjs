/* access hardening (release28): admin functions closed to visitors; admin needs a confirmed email */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/012_access_hardening.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
const U={adm:'aaaaaaaa-0000-0000-0000-000000000001',unc:'bbbbbbbb-0000-0000-0000-000000000002',usr:'cccccccc-0000-0000-0000-000000000003'};
await db.query(`insert into auth.users(id,email) values ($1,'boss@arnour.test'),($2,'user@arnour.test')`,[U.adm,U.usr]);
await db.query(`insert into auth.users(id,email,email_confirmed_at) values ($1,'Boss2@arnour.test',null)`,[U.unc]);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test'),('boss2@arnour.test')`);
async function isAdm(uid){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false);`); return (await db.query(`select _is_admin() x`)).rows[0].x; }
async function as(uid,sql){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql); await db.exec('reset role'); return r.rows; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const fns=(await db.query(`select p.proname n, has_function_privilege('anon',p.oid,'execute') a, has_function_privilege('authenticated',p.oid,'execute') u from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.prokind='f' and p.proname not like '\\_%' and (p.proname like 'admin\\_%' or p.prosrc like '%_require_admin%')`)).rows;
t('there are admin functions to check',fns.length>20,fns.length);
t('no admin function can be executed by a visitor',fns.every(f=>!f.a),fns.filter(f=>f.a).map(f=>f.n));
t('signed-in users can still reach them (they refuse non-admins inside)',fns.every(f=>f.u));
t('a confirmed admin passes',(await isAdm(U.adm))===true);
t('an unconfirmed sign-up with the admin email is NOT admin',(await isAdm(U.unc))===false);
t('a normal user is not admin',(await isAdm(U.usr))===false);
t('admin_overview refuses a normal user',!!(await as(U.usr,`select admin_overview()`)).err);
t('admin_overview refuses the unconfirmed one',!!(await as(U.unc,`select admin_overview()`)).err);
t('admin_overview works for the confirmed admin',!(await as(U.adm,`select admin_overview()`)).err);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
