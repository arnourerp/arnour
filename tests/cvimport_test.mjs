/* CV import (release30): limits per person and per day, signed-in consultants only, nothing readable */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/013_cv_import.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
const U={a:'aaaaaaaa-0000-0000-0000-000000000001',b:'bbbbbbbb-0000-0000-0000-000000000002',emp:'cccccccc-0000-0000-0000-000000000003',sus:'dddddddd-0000-0000-0000-000000000004',con:'eeeeeeee-0000-0000-0000-000000000005'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
/* a profile for the employer, the consultant and the soon-to-be-suspended account */
await as(U.emp,`select claim_profile('employer','{"name":"Co"}'::jsonb)`);
await as(U.con,`select claim_profile('consultant','{"firstName":"A","lastName":"B"}'::jsonb)`);
await as(U.sus,`select claim_profile('consultant','{"firstName":"S","lastName":"S"}'::jsonb)`);
await db.query(`update profiles set suspended=true where user_id=$1`,[U.sus]);

t('a visitor cannot start a read',!!(await as(null,`select cv_import_begin()`)).err);
t('a visitor cannot finish one',!!(await as(null,`select cv_import_done(gen_random_uuid(),'ok')`)).err);
const b1=await as(U.a,`select cv_import_begin() id`);
t('a new person (no profile yet) can start a read',!b1.err&&!!b1.rows[0].id,b1);
t('a consultant can start a read',!(await as(U.con,`select cv_import_begin()`)).err);
t('an employer cannot',/consultants only/.test((await as(U.emp,`select cv_import_begin()`)).err||''));
t('a suspended account cannot',/suspended/.test((await as(U.sus,`select cv_import_begin()`)).err||''));
for(let i=0;i<4;i++) await as(U.a,`select cv_import_begin()`);
t('the 5th read of the day works (1 + 4 = 5 so far)',(await db.query(`select count(*)::int n from cv_imports where user_id=$1`,[U.a])).rows[0].n===5);
t('the 6th read is refused',/daily limit/.test((await as(U.a,`select cv_import_begin()`)).err||''));
t('another person is not affected',!(await as(U.b,`select cv_import_begin()`)).err);
/* failed reads are given back */
const id1=(await db.query(`select id from cv_imports where user_id=$1 limit 1`,[U.a])).rows[0].id;
t('a person can mark their own read failed',!(await as(U.a,`select cv_import_done($1,'failed')`,[id1])).err);
t('…and then gets that read back',!(await as(U.a,`select cv_import_begin()`)).err);
t('someone else cannot change it',(await as(U.b,`select cv_import_done($1,'ok')`,[id1])).err===undefined&&(await db.query(`select status from cv_imports where id=$1`,[id1])).rows[0].status==='failed');
const id2=(await as(U.b,`select cv_import_begin() id`)).rows[0].id;
await as(U.b,`select cv_import_done($1,'ok','{"products":2,"modules":5}'::jsonb)`,[id2]);
const r2=(await db.query(`select status,found from cv_imports where id=$1`,[id2])).rows[0];
t('a finished read keeps only the counts',r2.status==='ok'&&r2.found.modules===5,r2);
await as(U.b,`select cv_import_done($1,'ok','{"x":"${'y'.repeat(600)}"}'::jsonb)`,[id2]);
t('a finished read cannot be changed again',(await db.query(`select found from cv_imports where id=$1`,[id2])).rows[0].found.modules===5);
t('a bad status is refused',!!(await as(U.b,`select cv_import_done($1,'weird')`,[id2])).err);
const id3=(await as(U.b,`select cv_import_begin() id`)).rows[0].id;
await as(U.b,`select cv_import_done($1,'ok',$2::jsonb)`,[id3,JSON.stringify({x:'y'.repeat(600)})]);
t('…stored as nothing',(await db.query(`select found from cv_imports where id=$1`,[id3])).rows[0].found===null);
t('the table cannot be read directly',!!(await as(U.a,`select * from public.cv_imports`)).err);
t('the table cannot be written directly',!!(await as(U.a,`insert into public.cv_imports(user_id) values (gen_random_uuid())`)).err);
/* old reads fall out of the 24-hour window */
await db.query(`update cv_imports set created_at=now()-interval '25 hours' where user_id=$1`,[U.a]);
t('after 24 hours the limit resets',!(await as(U.a,`select cv_import_begin()`)).err);
/* site-wide stop */
await db.query(`insert into cv_imports(user_id,status) select gen_random_uuid(),'ok' from generate_series(1,400)`);
t('the site-wide daily stop works',/busy/.test((await as(U.con,`select cv_import_begin()`)).err||''));
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
