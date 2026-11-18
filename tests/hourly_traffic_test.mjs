/* Release 54: hourly counters and the last-24-hours numbers for the admin */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(`alter table auth.users add column if not exists raw_user_meta_data jsonb default '{}'::jsonb`);
for (const f of ['024_traffic','033_campaigns','034_hourly_traffic','034_hourly_traffic']) await db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
const uid=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const mk=async(n,meta,hoursAgo)=>{ await db.query(`insert into auth.users(id,email,raw_user_meta_data,created_at) values ($1,$2,$3::jsonb, now() - ($4||' hours')::interval)`,[uid(n),'u'+n+'@t.test',JSON.stringify(meta),String(hoursAgo||0)]); return uid(n); };
const as=async(u,q,a)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${u||''}',false); set role ${u?'authenticated':'anon'};`); try{ return {rows:(await db.query(q,a||[])).rows}; }catch(e){ return {err:e.message}; } finally { await db.exec('reset role'); } };
const boss=await mk(1,{}); await db.query(`insert into admin_emails(email) values ('u1@t.test')`);
const a=await mk(10,{role:'consultant',ft:{s:'google',m:'cpc',c:'eg-sap'}},0), b=await mk(11,{role:'consultant'},5), c=await mk(12,{role:'consultant'},30);
await as(a,`select claim_profile('consultant','{"firstName":"A","lastName":"A"}'::jsonb)`);
t('a professional and a visitor cannot read it',!!(await as(a,`select admin_traffic_hours()`)).err&&!!(await as(null,`select admin_traffic_hours()`)).err);
t('the hourly table cannot be read directly',!!(await as(a,`select * from usage_hourly`)).err&&!!(await as(null,`select * from usage_hourly`)).err);
for(const n of ['v:home','v:home','lnd:facebook','apply','BAD NAME','x'.repeat(50)]) await as(null,`select track_usage($1)`,[n]);
t('daily counters still work',(await db.query(`select n from usage_counts where d=current_date and name='v:home'`)).rows[0].n===2);
t('hourly counters count the same',(await db.query(`select n from usage_hourly where name='v:home' and h=date_trunc('hour',now())`)).rows[0].n===2);
t('bad names are ignored',(await db.query(`select count(*)::int n from usage_hourly where name in ('BAD NAME')`)).rows[0].n===0);
/* an old hour is removed when a new hour starts to be counted */
await db.query(`insert into usage_hourly(h,name,n) values (now()-interval '5 days','v:old',3), (date_trunc('hour',now())-interval '2 hours','v:two',4)`);
await db.query(`delete from usage_hourly where h=date_trunc('hour',now())`);
await as(null,`select track_usage('v:home')`);
t('hours older than 3 days are removed, recent ones kept',(await db.query(`select count(*)::int n from usage_hourly where name='v:old'`)).rows[0].n===0&&(await db.query(`select count(*)::int n from usage_hourly where name='v:two'`)).rows[0].n===1);
/* cap of 80 names per hour */
await db.query(`delete from usage_hourly`); await db.query(`insert into usage_hourly(h,name,n) select date_trunc('hour',now()), 'z'||g, 1 from generate_series(1,80) g`);
await as(null,`select track_usage('v:newname')`);
t('no more than 80 names per hour',(await db.query(`select count(*)::int n from usage_hourly where name='v:newname'`)).rows[0].n===0);
await db.query(`delete from usage_hourly`); await db.query(`insert into usage_hourly(h,name,n) values (date_trunc('hour',now())-interval '3 hours','v:home',7),(date_trunc('hour',now())-interval '30 hours','v:home',9),(date_trunc('hour',now()),'lnd:facebook',2)`);
const T=(await as(boss,`select admin_traffic_hours() x`)).rows[0].x;
t('24 hour slots, oldest first',T.accounts.length===24&&T.accounts[0].h<T.accounts[23].h,T.accounts.length);
t('usage inside the 24 hours only',T.usage.length===2&&T.usage.every(u=>u.name!=='v:home'||u.n===7),T.usage);
const sum=k=>T.accounts.reduce((s,x)=>s+x[k],0);
t('accounts: 3 in the last 24 hours (admin, a, b; the one 30 hours ago is out), 1 with a profile',sum('n')===3&&sum('p')===1,T.accounts.filter(x=>x.n));
t('the last slot is the current hour with the new account',T.accounts[23].n===2&&T.accounts[23].p===1);
t('the campaign from the last 24 hours is listed',T.campaigns.length===1&&T.campaigns[0].c==='eg-sap'&&T.campaigns[0].n===1,T.campaigns);
t('"since" tells when hourly counting began',typeof T.since==='string'&&T.since<=T.usage[0].h);
process.exit(fails?1:0);
