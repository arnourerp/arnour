/* Releases 58 and 59 (new email design): test-send first, then the switch-on. */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT;
const be=await makeBackend(); const db=be.db;
const load=async(f)=>db.exec(fs.readFileSync(ROOT+'/supabase/'+f+'.sql','utf8'));
for (const f of ['014_match_alerts','015_module_families','017_company_type','018_partner_capabilities','026_must_nice','029_light_jobs','030_paged_search','031_paged_search_speed','038_email_design','038_email_design']) await load(f);
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,600):'');} else console.log('ok  ',n); };
const q=async(s,p)=>(await db.query(s,p)).rows;
const as=async(uid,s,p)=>{ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ return (await db.query(s,p)).rows; } catch(e){ return {err:e.message}; } finally { await db.exec('reset role'); } };
const U={c:'11111111-0000-0000-0000-000000000001',e:'22222222-0000-0000-0000-000000000002'};
for(const k in U) await q('insert into auth.users(id,email) values ($1,$2)',[U[k],k+'@t.com']);
const ce=(await as(U.c,`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',anon:true})]))[0].x;
const ee=(await as(U.e,`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Hidden Holding'})]))[0].x;
await db.exec('delete from jobs; delete from match_queue; delete from match_queue_c');
const DAY=86400000, now=Date.now();
const job=async(id,data,score,{age=1,conf=false,status='open'}={})=>{
  await q('insert into jobs(id,company_id,status,posted_ts,confidential,data) values ($1,$2,$3,$4,$5,$6::jsonb)',[id,ee,status,now-age*DAY,conf,JSON.stringify(data)]);
  await q(`insert into match_scores(consultant_id,job_id,score) values ($1,$2,$3) on conflict (consultant_id,job_id) do update set score=excluded.score`,[ce,id,score]);
  await q(`insert into match_alerts(job_id,consultant_id,score) values ($1,$2,$3)`,[id,ce,score]);
};
const sd={productId:'s4onprem',moduleId:'sd'};
const ext=(title,extra={})=>Object.assign({title,external:true,extEmployer:'Deloitte',country:'eg',city:'Cairo',employmentType:'Full-time',level:'Senior',minExp:'10',languages:['English'],remote:false,
  requires:[sd,{productId:'s4onprem',moduleId:'mm'},{productId:'ecc',moduleId:'sd'},{productId:'cx',moduleId:'salescloud',nice:true}]},extra);
await job('x-1',ext('SAP SD (Sales & Distribution) Manager'),92);
const notify=(link,text='New role matches your profile: x — y')=>q(`insert into notifications(user_key,type,text,link) values ($1,'job',$2,$3)`,[ce,text,link]);
const build=async()=>{ await q(`update email_queue set send_after=0 where sent_ts is null`); return (await q(`select email_build_batch() x`))[0].x; };

// ---------- before the switch: old emails unchanged ----------
await notify('#/job/x-1');
let b=await build();
t('038 alone keeps the old email',b.length===1&&b[0].subject==='New role matches your profile: x — y'&&!/YOUR TOP MATCH/.test(b[0].html),b);
await db.exec('delete from email_queue');
await load('039_email_design_on'); await load('039_email_design_on');

// ---------- one new role ----------
await notify('#/job/x-1');
b=await build(); let m=b[0];
const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Dubai'}).format(new Date(now-DAY)).replace('Sept','Sep');
t('subject: new role, score, employer, place, date',m.subject.startsWith('New role, 92% match: SAP SD (Sales & Distribution) Manager at Deloitte, Cairo · posted '+day)&&!/more\)/.test(m.subject),m.subject);
t('hero with details',/YOUR TOP MATCH/.test(m.html)&&/NEW ROLE/.test(m.html)&&/92%/.test(m.html)&&/Cairo, Egypt/.test(m.html)&&/Full-time · Senior/.test(m.html)&&/10\+ yrs/.test(m.html)&&/Languages: English/.test(m.html));
t('chips use the site labels, nice-to-have left out',m.html.includes('S/4 Private · SD + MM')&&m.html.includes('ECC 6.0 · SD')&&!/Sales Cloud/.test(m.html),m.html.match(/S\/4[^<]*/g));
t('no site name in place of the employer',!/Jobs on Arnour/.test(m.html));
t('links marked as email',m.html.includes('https://arnour.com/?utm_source=email&amp;utm_medium=notification#/job/x-1'));
t('unsubscribe and settings kept',/#\/unsubscribe\?t=[0-9a-f-]{36}&amp;k=matches/.test(m.html)&&/#\/account/.test(m.html)&&/k=all/.test(m.html)&&/k=matches$/.test(m.unsubscribe));
t('hidden preview line comes first',m.html.startsWith('<div style="display:none')&&/Posted .{4,12} · Full-time · Senior/.test(m.html.slice(0,300)),m.html.slice(0,300));
t('one role: no "also" heading',!/Also matching you/.test(m.html));
t('not sent twice',(await build()).length===0);

// ---------- many roles ----------
for(let i=2;i<=7;i++) await job('x-'+i,ext('Role number '+i,{extEmployer:'Co '+i}),80+i,{age:i===7?30:2});
for(let i=2;i<=7;i++) await notify('#/job/x-'+i);
await notify('#/job/x-2');
b=await build(); m=b[0];
t('best score on top, older role is a "match" not "new role"',m.subject.startsWith('New match, 87% match: Role number 7'.replace('New match, 87% match','New match, 87% match'))&&/NEW MATCH/.test(m.html),m.subject);
t('count in subject ignores duplicates',m.subject.endsWith('(+5 more)'),m.subject);
t('five roles shown, rest counted',(m.html.match(/View role →/g)||[]).length===4&&/\+1 more matching role</.test(m.html)&&!/Role number 2</.test(m.html));
t('size well under the Gmail cut',m.html.length<60000,m.html.length);

// ---------- privacy and stale roles ----------
await db.exec('delete from email_queue');
await job('j-conf',{title:'Quiet <script>alert(1)</script> role',country:'ae',requires:[sd,{productId:'ecc',moduleId:'sd',orPrev:true}]},90,{conf:true});
await job('j-closed',ext('Closed one'),99,{status:'closed'});
await job('j-applied',ext('Applied one'),99);
await q(`insert into applications(job_id,consultant_id) values ('j-applied',$1)`,[ce]);
for(const id of ['j-conf','j-closed','j-applied']) await notify('#/job/'+id);
b=await build(); m=b[0];
t('confidential company stays hidden',!/Hidden Holding/.test(m.html+m.subject)&&/at a confidential company/.test(m.subject),m.subject);
t('titles are escaped',!/<script/.test(m.html)&&/&lt;script&gt;/.test(m.html));
t('any-of group',/Any of: S\/4 Private · SD \/ ECC 6\.0 · SD/.test(m.html));
t('closed and already-applied roles left out',!/Closed one|Applied one/.test(m.html)&&!/more\)/.test(m.subject),m.subject);
await db.exec('delete from email_queue');
await notify('#/job/j-closed');
b=await build();
t('nothing left to show: no email, row dropped',b.length===0&&(await q('select dropped from email_queue'))[0].dropped===true,b);

// ---------- other emails get the shared look ----------
await db.exec('delete from email_queue');
await notify('#/job/j-conf','A confidential company invited you to apply for "Quiet role"');
b=await build(); m=b[0];
t('invite: same subject, new look',m.subject==='A confidential company invited you to apply for "Quiet role"'&&/bgcolor="#0F172A"/.test(m.html)&&/Open Arnour/.test(m.html)&&!/TOP MATCH/.test(m.html)&&/k=invites/.test(m.html),m);
await db.exec('delete from email_queue');
await notify('#/c/messages/cv9','Hidden Holding sent you a message');
b=await build();
t('message keeps Open chat',/Open chat/.test(b[0].html),b);
await db.exec('delete from email_queue');
await notify('#/c/intros','Acme would like to connect'); await notify('#/job/x-1');
b=await build(); m=b[0];
t('mixed email: one email, update first, then the role',b.length===1&&m.subject==='You have 2 updates on Arnour'&&m.html.indexOf('would like to connect')<m.html.indexOf('YOUR TOP MATCH')&&/k=all$/.test(m.unsubscribe),m.subject);

// ---------- test send ----------
const test=async(a)=>(await q('select email_test($1) x',[a]))[0].x;
t('unknown address: nothing sent',/No Arnour account/.test(await test('stranger@x.com')));
t('no key: nothing sent',/key is not set up/.test(await test('c@t.com')));
await db.exec(`create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text); insert into vault.decrypted_secrets values ('resend_api_key','re_test');
 create schema net; create table net.calls(id bigserial, url text, body jsonb, headers jsonb);
 create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls(url,body,headers) values (url,body,headers) returning id $$;`);
const before=(await q('select count(*)::int n from email_queue'))[0].n;
t('two test emails',(await test(' C@T.com '))==='Sent 2 test email(s) to c@t.com');
const calls=await q('select body from net.calls order by id');
t('only to that account, marked [Test]',calls.length===2&&calls.every(c=>c.body.to.length===1&&c.body.to[0]==='c@t.com'&&c.body.subject.startsWith('[Test] '))&&/YOUR TOP MATCH/.test(calls[0].body.html)&&/Example only/.test(calls[1].body.html),calls.map(c=>c.body.subject));
t('test does not touch the queue',(await q('select count(*)::int n from email_queue'))[0].n===before);
t('company account gets only the shared-look sample',/Sent 1 test email/.test(await test('e@t.com')));

// ---------- security ----------
for(const [n,s] of [['email_test',`select email_test('c@t.com')`],['_email_render',`select _email_render('${U.c}','[]','${U.c}')`],['_email_job',`select _email_job('${ce}','x-1')`],['email_build_batch','select email_build_batch()']]){
  t('members cannot call '+n,!!(await as(U.c,s)).err); t('visitors cannot call '+n,!!(await as(null,s)).err); }

// ---------- a design fault never holds emails back ----------
await db.exec('delete from email_queue; alter table list_items rename to list_items_gone');
await notify('#/job/x-1','New role matches your profile: Fallback — Deloitte');
b=await build();
t('plain email sent if the design fails',b.length===1&&/Fallback/.test(b[0].html)&&/k=all/.test(b[0].html),b);
await db.exec('alter table list_items_gone rename to list_items');

// a sample for looking at
await q(`update jobs set status='closed' where id not in ('x-1','x-2','x-3','x-7')`);
await db.exec('delete from email_queue');
for(const id of ['x-1','x-2','x-3','x-7']) await notify('#/job/'+id);
b=await build(); if(process.env.EMAIL_SAMPLE) fs.writeFileSync(process.env.EMAIL_SAMPLE,b[0].html);
console.log(fails?fails+' FAILED':'ALL PASSED'); process.exit(fails?1:0);
