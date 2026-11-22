/* Release 55: profiles saved without SAP skills ("save and finish later"): admin list and counter, reminders for them */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(ROOT+'/supabase/025_profile_reminders.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/036_unfinished_profiles.sql','utf8'));
await db.exec(fs.readFileSync(ROOT+'/supabase/036_unfinished_profiles.sql','utf8')); // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,500):'');} else console.log('ok  ',n); };
const q=async(s,a)=>(await db.query(s,a||[])).rows;
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const U=n=>'cccccccc-0000-0000-0000-00000000000'+n;
const ids={boss:U(1),a:U(2),b:U(3),c:U(4),d:U(5),e:U(6),co:U(7),unconf:U(8),f:U(9)};
await db.exec(`alter table auth.users add column if not exists email_confirmed_at timestamptz; alter table auth.users add column if not exists raw_user_meta_data jsonb; alter table auth.users add column if not exists created_at timestamptz default now();`);
const mk=async(k,hoursAgo,meta,confirmed=true)=>{ await db.query(`insert into auth.users(id,email) values ($1,$2)`,[ids[k],k+'@x.com']); await db.query(`update auth.users set email_confirmed_at=${confirmed?`now() - ('${hoursAgo} hours')::interval`:'null'}, raw_user_meta_data=$2::jsonb, created_at=now() - ('${hoursAgo} hours')::interval where id=$1`,[ids[k],JSON.stringify(meta||{})]); };
await mk('boss',50,{}); await db.query(`insert into admin_emails(email) values ('boss@x.com')`);
for(const k of ['a','b','c','d','e','f']) await mk(k,60,{role:'consultant',ft:{b:'facebook'}});
await mk('co',60,{role:'employer'}); await mk('unconf',60,{role:'consultant'},false);
const SK='"skills":[{"productId":"s4","moduleId":"fi","projects":2,"certified":false}]';
const prof=(first,extra)=>`select claim_profile('consultant','{"firstName":"${first}","lastName":"T","headline":"H ${first}","country":"eg","roleType":"functional"${extra||''}}'::jsonb)`;
await as(ids.a,prof('Anna',',"skills":[]'));                       // saved without skills, 3 h ago
await as(ids.b,prof('Bela',','+SK));                                // ready
await as(ids.c,prof('Cara',',"skills":[]'));                        // saved 1 h ago
await as(ids.d,prof('Dina',',"skills":[{"productId":"s4","moduleId":""}]')); // a product without a module is not a skill; saved 5 days ago
await as(ids.f,prof('Fay',',"skills":[]'));                         // saved 4 h ago, will add skills later
await db.query(`update profiles set created_at = now() - interval '3 hours' where user_id=$1`,[ids.a]);
await db.query(`update profiles set created_at = now() - interval '1 hour' where user_id=$1`,[ids.c]);
await db.query(`update profiles set created_at = now() - interval '5 days' where user_id=$1`,[ids.d]);
await db.query(`update profiles set created_at = now() - interval '4 hours' where user_id=$1`,[ids.f]);

/* the ready rule */
const R=async(j)=>(await q(`select _profile_ready($1::jsonb) r`,[JSON.stringify(j)]))[0].r;
t('ready: one skill with product and module',await R({skills:[{productId:'s4',moduleId:'fi'}]})===true);
t('ready: a product-only row (module *) counts',await R({skills:[{productId:'s4',moduleId:'*'}]})===true);
t('not ready: no skills, empty module, no key, not an array, null',(await R({skills:[]}))===false&&(await R({skills:[{productId:'s4',moduleId:''}]}))===false&&(await R({}))===false&&(await R({skills:'x'}))===false&&(await q(`select _profile_ready(null) r`))[0].r===false);

/* only the admin */
for(const [n,sql] of [['list',`select admin_unfinished()`],['count',`select admin_unfinished_count()`]]){
  t('a professional cannot call '+n,!!(await as(ids.b,sql)).err); t('a visitor cannot call '+n,!!(await as(null,sql)).err);
}
t('the helper is closed',!!(await as(ids.b,`select _profile_ready('{}'::jsonb)`)).err);

/* counter and list */
const C=(await as(ids.boss,`select admin_unfinished_count() x`)).rows[0].x;
t('counter: 2 accounts without a profile are professionals or unknown (e, unconf), the company is counted apart',C.noProfile===2,C);
t('counter: 4 profiles without skills (a, c, d, f)',C.noSkills===4,C);
const L=(await as(ids.boss,`select admin_unfinished() x`)).rows[0].x;
t('list counts match the counter, companies counted apart',L.noProfile===2&&L.noSkills===4&&L.noProfileCompany===1,{p:L.noProfile,s:L.noSkills,c:L.noProfileCompany});
const em=L.rows.map(r=>r.email).sort().join();
t('list: everyone unfinished, nobody ready, the admin never',em==='a@x.com,c@x.com,co@x.com,d@x.com,e@x.com,f@x.com,unconf@x.com',em);
const ra=L.rows.find(r=>r.email==='a@x.com');
t('a saved profile shows name, headline, stage, what is missing, source, confirmed',ra.stage==='noskills'&&ra.name==='Anna T'&&ra.headline==='H Anna'&&ra.id&&ra.who==='c'&&ra.src==='facebook'&&ra.confirmed===true&&ra.missing.indexOf('SAP skills')===0&&ra.missing.indexOf('CV')>0&&ra.country==='eg'&&ra.roleType==='functional',ra);
const re=L.rows.find(r=>r.email==='e@x.com'); t('an account with no profile has no entity id and shows the account date',re.stage==='noprofile'&&re.id===null&&re.ts>0&&re.who==='c');
const rc=L.rows.find(r=>r.email==='co@x.com'); t('a company without a profile is marked as a company',rc.stage==='noprofile'&&rc.who==='e');
t('an unconfirmed account is shown as not confirmed',L.rows.find(r=>r.email==='unconf@x.com').confirmed===false);
t('newest first',L.rows.every((r,i)=>i===0||L.rows[i-1].ts>=r.ts));

/* reminders: the scan */
const n1=(await q(`select reminders_scan() n`))[0].n;
const rem=await q(`select u.email, r.kind, r.step, r.role, r.status from reminders r join auth.users u on u.id=r.user_id order by u.email, r.kind`);
const skills=rem.filter(r=>r.kind==='skills'), signup=rem.filter(r=>r.kind==='signup');
t('skills reminders: a (3 h) and f (4 h) only; not c (1 h), not d (5 days), not b (ready)',skills.map(r=>r.email).join()==='a@x.com,f@x.com'&&skills.every(r=>r.step===1&&r.role==='consultant'&&r.status==='pending'),skills);
t('sign-up reminders are unchanged: people with no profile and a confirmed e-mail (e, co)',signup.map(r=>r.email).join()==='co@x.com,e@x.com',signup);
t('the scan returns how many it added',n1===4,n1);
t('a second scan adds nobody',(await q(`select reminders_scan() n`))[0].n===0);
const A1=(await as(ids.boss,`select admin_reminders() x`)).rows[0].x;
t('the admin list shows the kind and has 8 texts',A1.pending.filter(p=>p.kind==='skills').length===2&&A1.pending.filter(p=>p.kind==='signup').length===2&&A1.texts.length===8,{n:A1.texts.length});
const L2=(await as(ids.boss,`select admin_unfinished() x`)).rows[0].x;
t('the unfinished list shows the reminder status',L2.rows.find(r=>r.email==='a@x.com').rem.kind==='skills'&&L2.rows.find(r=>r.email==='a@x.com').rem.status==='pending'&&L2.rows.find(r=>r.email==='c@x.com').rem===null,L2.rows.find(r=>r.email==='a@x.com'));

/* a person who adds skills before approval is never sent the reminder */
await db.query(`update consultants set data = data || '{"skills":[{"productId":"s4","moduleId":"fi","projects":1}]}'::jsonb where owner=$1`,[ids.f]);
await db.query(`select reminders_scan()`);
t('adding skills closes the waiting reminder',(await q(`select status from reminders where user_id=$1 and kind='skills'`,[ids.f]))[0].status==='done');
t('and the others stay waiting',(await q(`select status from reminders where user_id=$1 and kind='skills'`,[ids.a]))[0].status==='pending');
const C2=(await as(ids.boss,`select admin_unfinished_count() x`)).rows[0].x;
t('the counter drops by one',C2.noSkills===3,C2);

/* sending */
await db.exec(`create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
 create schema net; create table net.calls(id bigserial, url text, body jsonb, headers jsonb);
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;
 create table net._http_response(id bigint primary key, status_code int, content text, error_msg text);
 insert into vault.decrypted_secrets values ('resend_api_key','re_test');`);
t('nothing is sent before approval',(await q(`select reminders_run() n`))[0].n===0&&(await q(`select count(*)::int n from net.calls`))[0].n===0);
const ridA=(await q(`select id from reminders where user_id=$1 and kind='skills'`,[ids.a]))[0].id;
t('approve sends at once',(await as(ids.boss,`select admin_reminder_decide($1::bigint[],'approve') x`,[`{${ridA}}`])).rows[0].x===1);
const call=(await q(`select * from net.calls`))[0];
t('the e-mail goes to Anna with the skills text, a button to the dashboard and an unsubscribe link',call.body.to[0]==='a@x.com'&&/Add your SAP skills/.test(call.body.subject)&&/#\/c\/dashboard"/.test(call.body.html)&&/Add my SAP skills/.test(call.body.html)&&!/onboard/.test(call.body.html)&&/#\/unsubscribe/.test(call.body.headers['List-Unsubscribe']),call.body.subject);
t('the wording can be edited',!(await as(ids.boss,`select admin_reminder_text_save('skills1','New subject','New body') x`)).err&&(await q(`select subject from reminder_texts where key='skills1'`))[0].subject==='New subject');

/* the second one, 3 days later, only while there are still no skills */
await db.query(`update reminders set sent_ts = sent_ts - 4 * 86400000, checked=true where user_id=$1 and kind='skills'`,[ids.a]);
t('a second skills reminder is queued after 3 days',(await q(`select reminders_scan() n`))[0].n===1&&(await q(`select step,status from reminders where user_id=$1 and kind='skills' order by step`,[ids.a])).map(r=>r.step+r.status).join()==='1sent,2pending');
await db.query(`update consultants set data = data || '{"skills":[{"productId":"s4","moduleId":"fi","projects":1}]}'::jsonb where owner=$1`,[ids.a]);
await db.query(`select reminders_scan()`);
t('once Anna adds skills it is closed and the counter drops again',(await q(`select status from reminders where user_id=$1 and kind='skills' and step=2`,[ids.a]))[0].status==='done'&&(await as(ids.boss,`select admin_unfinished_count() x`)).rows[0].x.noSkills===2);
t('an approved reminder is not sent to someone who added skills meanwhile',await (async()=>{ await db.query(`update reminders set status='approved' where user_id=$1 and kind='skills' and step=2`,[ids.a]); const before=(await q(`select count(*)::int n from net.calls`))[0].n; await db.query(`select reminders_run()`); return (await q(`select count(*)::int n from net.calls`))[0].n===before&&(await q(`select status from reminders where user_id=$1 and step=2 and kind='skills'`,[ids.a]))[0].status==='done'; })());

/* the old sign-up reminders still close when the profile exists, and are not mixed up with the new kind */
t('a sign-up reminder and a skills reminder can exist for the same person',await (async()=>{ await db.query(`insert into reminders(user_id,kind,step,role) values ($1,'signup',1,'consultant') on conflict do nothing`,[ids.c]); await db.query(`insert into reminders(user_id,kind,step,role) values ($1,'skills',1,'consultant') on conflict do nothing`,[ids.c]); return (await q(`select count(*)::int n from reminders where user_id=$1`,[ids.c]))[0].n===2; })());
t('a duplicate of the same kind and step is refused',await (async()=>{ try{ await db.query(`insert into reminders(user_id,kind,step,role) values ($1,'skills',1,'consultant')`,[ids.c]); return false; }catch(e){ return true; } })());
t('the kind is limited to the two values',await (async()=>{ try{ await db.query(`insert into reminders(user_id,kind,step,role) values ($1,'other',1,'consultant')`,[ids.e]); return false; }catch(e){ return true; } })());

/* the live data stays as it is: the function bodies keep the release 42 behaviour for sign-up reminders */
t('the sign-up reminder of someone who then creates a profile is closed by the scan',await (async()=>{ await db.query(`select reminders_scan()`); return (await q(`select status from reminders where user_id=$1 and kind='signup'`,[ids.c]))[0].status==='done'; })());

console.log(fails?('\n'+fails+' FAILED'):'\nall passed'); process.exit(fails?1:0);
