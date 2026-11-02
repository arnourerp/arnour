/* Release 39: messages from the "Arnour team" (admin) to a professional or a company, with replies */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/022_staff_messages.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/022_staff_messages.sql','utf8')); // safe to run twice
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={boss:'aaaaaaaa-0000-0000-0000-000000000001',p1:'bbbbbbbb-0000-0000-0000-000000000001',p2:'bbbbbbbb-0000-0000-0000-000000000002',co:'cccccccc-0000-0000-0000-000000000001',co2:'cccccccc-0000-0000-0000-000000000002'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const J=(o)=>JSON.stringify(o);
const claim=async(u,role,d)=>(await as(U[u],`select claim_profile($1,$2::jsonb) x`,[role,J(d)])).rows[0].x;
const p1=await claim('p1','consultant',{firstName:'Nora',lastName:'Fahmy',headline:'SAP FICO',anon:true});
const p2=await claim('p2','consultant',{firstName:'Omar',lastName:'Said'});
const co=await claim('co','employer',{name:'Gulf Retail'});
const co2=await claim('co2','employer',{name:'Nile Foods'});

/* nobody but the admin can use the team functions */
for(const [n,sql] of [['send',`select admin_staff_send('${p1}','hello')`],['inbox',`select admin_staff_inbox()`],['unread',`select admin_staff_unread()`],['thread',`select admin_staff_thread('cvx')`]]){
  t('a professional cannot call '+n,!!(await as(U.p1,sql)).err); t('a visitor cannot call '+n,!!(await as(null,sql)).err);
}
/* input checks */
t('empty message refused',!!(await as(U.boss,`select admin_staff_send($1,'   ')`,[p1])).err);
t('too long refused',!!(await as(U.boss,`select admin_staff_send($1,$2)`,[p1,'x'.repeat(2001)])).err);
t('unknown profile refused',!!(await as(U.boss,`select admin_staff_send('nobody','hi')`)).err);

/* the team writes to a professional */
const r1=await as(U.boss,`select admin_staff_send($1,'  Welcome to Arnour!  ') x`,[p1]);
t('the team can write to a professional',!r1.err&&r1.rows[0].x.conv&&r1.rows[0].x.name==='Nora Fahmy',r1);
const cv1=r1.rows[0].x.conv;
const mine=(await as(U.p1,`select * from my_conversations()`)).rows;
t('the professional sees one conversation, marked as from the team',mine.length===1&&mine[0].staff===true&&mine[0].c_id===p1&&mine[0].e_id===null&&mine[0].id===cv1,mine);
t('nobody else sees it',(await as(U.p2,`select * from my_conversations()`)).rows.length===0&&(await as(U.co,`select * from my_conversations()`)).rows.length===0);
const msgs=(await as(U.p1,`select side,text from messages where conv_id=$1`,[cv1])).rows;
t('the professional reads the message (trimmed, from the team side)',msgs.length===1&&msgs[0].side==='e'&&msgs[0].text==='Welcome to Arnour!',msgs);
t('a stranger cannot read it',(await as(U.p2,`select * from messages where conv_id=$1`,[cv1])).rows.length===0);
const nt=(await as(U.p1,`select text,link,type from notifications`)).rows;
t('the professional is notified with a link to the chat',nt.length===1&&nt[0].text==='Arnour team sent you a message'&&nt[0].link==='#/c/messages/'+cv1,nt);
t('an e-mail is queued under the usual message settings',(await db.query(`select count(*)::int n from email_queue where kind='messages'`)).rows[0].n===1);
t('the action is in the activity log, without the text',(await db.query(`select count(*)::int n from admin_log where action='staff message' and detail=''`)).rows[0].n===1);

/* unread numbers for the recipient and for the team */
const unreadFor=async()=>(await as(U.boss,`select admin_staff_inbox() x`)).rows[0].x;
let ib=await unreadFor();
t('the team inbox lists it, nothing unread yet',ib.length===1&&ib[0].unread===0&&ib[0].name==='Nora Fahmy'&&ib[0].kind==='professional'&&ib[0].fromThem===false,ib);

/* replying: three messages in a row are fine (the 2-message wait rule does not apply to the recipient) */
for(let i=1;i<=3;i++) t('the professional can reply ('+i+')',!(await as(U.p1,`select send_message($1,$2)`,[cv1,'reply '+i])).err);
ib=await unreadFor();
t('the team sees 3 unread replies, last one from them',ib[0].unread===3&&ib[0].fromThem===true&&ib[0].last==='reply 3',ib);
t('unread count for the badge',(await as(U.boss,`select admin_staff_unread() x`)).rows[0].x===1);
const th=(await as(U.boss,`select admin_staff_thread($1) x`,[cv1])).rows[0].x;
t('opening the thread returns it in order, the team flagged as mine',th.messages.length===4&&th.messages[0].mine===true&&th.messages[1].mine===false&&th.name==='Nora Fahmy',th);
t('opening it marks the replies as read',(await as(U.boss,`select admin_staff_unread() x`)).rows[0].x===0&&(await unreadFor())[0].unread===0);
t('a second message goes into the same conversation',(await as(U.boss,`select admin_staff_send($1,'Anything else?') x`,[p1])).rows[0].x.conv===cv1&&(await db.query(`select count(*)::int n from conversations where staff`)).rows[0].n===1);
/* the recipient's own unread count (read pointer) */
const mine2=(await as(U.p1,`select * from my_conversations()`)).rows[0];
t('the recipient has an unread message until they open it',Number(mine2.c_read)<Number(mine2.last_ts),mine2);
await as(U.p1,`select mark_read($1)`,[cv1]);
const mine3=(await as(U.p1,`select * from my_conversations()`)).rows[0];
t('opening it marks it read for the recipient',Number(mine3.c_read)>=Number(mine3.last_ts),mine3);

/* limits on what the recipient can do inside it */
t('the recipient cannot block the team',!!(await as(U.p1,`select set_block($1,true)`,[cv1])).err);
await as(U.p1,`select send_message($1,'with extras',$2::jsonb,$3::jsonb)`,[cv1,J({path:U.p1+'/cv.pdf',name:'cv.pdf'}),J({ts:1,dur:30})]);
const last=(await db.query(`select cv,call from messages where conv_id=$1 order by ts desc, id limit 1`,[cv1])).rows[0];
t('a CV or a call proposal cannot be attached to a team message',last.cv===null&&last.call===null,last);
t('another professional cannot write into it',!!(await as(U.p2,`select send_message($1,'hi')`,[cv1])).err);
t('a company cannot write into it',!!(await as(U.co,`select send_message($1,'hi')`,[cv1])).err);
t('the recipient can delete their own message',!(await as(U.p1,`select delete_message(id) from messages where conv_id=$1 and side='c' limit 1`,[cv1])).err);

/* the team writes to a company: the company is side e, the team side c */
const r2=await as(U.boss,`select admin_staff_send($1,'Hello from Arnour') x`,[co]);
t('the team can write to a company',!r2.err&&r2.rows[0].x.name==='Gulf Retail',r2);
const cv2=r2.rows[0].x.conv;
const cm=(await as(U.co,`select * from my_conversations()`)).rows;
t('the company sees it, marked as from the team',cm.length===1&&cm[0].staff===true&&cm[0].e_id===co&&cm[0].c_id===null,cm);
t('the company is notified with an e-side link',(await as(U.co,`select link from notifications`)).rows[0].link==='#/e/messages/'+cv2);
t('the company can reply',!(await as(U.co,`select send_message($1,'Thanks, got it')`,[cv2])).err);
t('another company cannot write into it',!!(await as(U.co2,`select send_message($1,'x')`,[cv2])).err);
ib=await unreadFor();
const row=ib.find(x=>x.id===cv2);
t('the team sees the company reply as unread',row&&row.kind==='company'&&row.unread===1&&row.name==='Gulf Retail'&&row.fromThem===true,ib);
t('inbox keeps the newest conversation first',ib[0].id===cv2);
const th2=(await as(U.boss,`select admin_staff_thread($1) x`,[cv2])).rows[0].x;
t('company thread flags the team side as mine',th2.messages[0].mine===true&&th2.messages[1].mine===false,th2);

/* a company alias works as a target; suspended and unowned profiles are handled */
const alias=(await db.query(`select alias from companies where id=$1`,[co2])).rows[0].alias;
if(alias){ const r3=await as(U.boss,`select admin_staff_send($1,'via alias') x`,[alias]); t('a company alias is resolved',!r3.err&&r3.rows[0].x.name==='Nile Foods',r3); }
await db.query(`insert into consultants(id,owner,anon,data) values ('c-orphan',null,false,'{"firstName":"No","lastName":"Account"}')`);
t('a profile without an account cannot be messaged',!!(await as(U.boss,`select admin_staff_send('c-orphan','hi')`)).err);

/* the old kinds of conversation still work, and the table rule still holds */
const sc=await as(U.p1,`select start_peer_conversation($1,null) x`,[p2]);
t('a professional can still start a chat with another professional',!sc.err,sc);
const ec=await as(U.co2,`select start_conversation($1,$2,null,null) x`,[p1,co2]);
t('a company can still start a chat with a professional',!ec.err,ec);
t('a two-sided staff row is refused by the table',!!(await db.query(`insert into conversations(id,c_id,e_id,staff) values ('cvbad',$1,$2,true)`,[p1,co]).then(()=>null,e=>e.message)));
t('a normal row without a professional is refused by the table',!!(await db.query(`insert into conversations(id,c_id,e_id,staff) values ('cvbad2',null,$1,false)`,[co]).then(()=>null,e=>e.message)));
t('a second team conversation for the same person is refused',!!(await db.query(`insert into conversations(id,c_id,staff) values ('cvdup',$1,true)`,[p1]).then(()=>null,e=>e.message)));

/* hourly limit */
await db.exec(`reset role`);
for(let i=0;i<100;i++) await db.query(`insert into messages(conv_id,side,text) values ($1,'e','filler')`,[cv1]);
t('an hourly limit applies to the team',!!(await as(U.boss,`select admin_staff_send($1,'one more')`,[p1])).err);

console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
