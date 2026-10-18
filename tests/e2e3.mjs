import {makeBackend} from './harness.mjs';
import fs from 'fs'; import {createRequire} from 'module'; import {execSync} from 'child_process';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const MOCK=fs.readFileSync(process.env.ARNOUR_TESTS+'/mock-client.js','utf8');
const be=await makeBackend(); const browser=await chromium.launch();
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');}else console.log('ok  ',n); };
const errors=[]; const BASE='http://localhost:'+(process.env.PORT_LIVE||8123)+'/index.html';
const U={a:'aaaaaaaa-1111-1111-1111-111111111111',b:'bbbbbbbb-2222-2222-2222-222222222222',e:'eeeeeeee-3333-3333-3333-333333333333'};
const role={a:'consultant',b:'consultant',e:'employer'};
const data={a:{firstName:'Alma',lastName:'Aaa',headline:'FI lead',anon:false,country:'ae',skills:[{productId:'s4onprem',moduleId:'fi',years:5}]},b:{firstName:'Bob',lastName:'Bbb',headline:'MM dev',country:'ae',skills:[{productId:'s4onprem',moduleId:'mm',years:3}]},e:{name:'Acme Corp',industry:'Retail'}};
const ent={};
for(const k of Object.keys(U)){
  be.users[k+'@t.com']={id:U[k],email:k+'@t.com',password:'passpass1',confirmed:true,meta:{role:role[k]},token:'t'+k};
  await be.db.query('insert into auth.users values ($1,$2)',[U[k],k+'@t.com']);
  await be.db.exec(`reset role; select set_config('request.jwt.claim.sub','${U[k]}',false); set role authenticated;`);
  ent[k]=(await be.db.query(`select claim_profile($1,$2::jsonb) x`,[role[k],JSON.stringify(data[k])])).rows[0].x;
  await be.db.exec('reset role');
}
async function page(who,w=1280,h=900){
  const ctx=await browser.newContext({viewport:{width:w,height:h}});
  if(who) await ctx.addInitScript(([id,em,r])=>{ try{ if(!localStorage.getItem('mock-session')) localStorage.setItem('mock-session',JSON.stringify({access_token:'x',user:{id,email:em,user_metadata:{role:r}}})); }catch(e){} },[U[who],who+'@t.com',role[who]]);
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push((who||'visitor')+': '+m.text()); });
  p.on('pageerror',e=>errors.push((who||'visitor')+' PAGEERR: '+e.message));
  await p.exposeFunction('__sb',be.handle);
  await p.route('**/js/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await p.route('**/fonts.googleapis.com/**',r=>r.abort());
  await p.goto(BASE); await p.waitForFunction(()=>window.APP&&APP.backend&&APP.backend.ready,null,{timeout:10000}); return p;
}
const go=async(p,h)=>{ await p.evaluate(x=>{location.hash=x},h); await p.waitForTimeout(300); };
const quiet=async(p)=>{ await p.waitForFunction(()=>!APP.backend.commBusy&&!APP.backend.pending(),null,{timeout:8000}); await p.waitForTimeout(150); };
const sql=async(s,a)=>(await be.db.query(s,a)).rows;

// visitor
const v=await page(null);
t('visitor has sample questions from server',await v.evaluate(()=>Object.keys(APP.db.questions).length===25&&Object.keys(APP.db.articles).length===8));
await go(v,'#/community');
t('community lists with Sample pills',(await v.locator('.sample-pill').count())>0);
const html=await v.content();
t('sample authors resolve for visitor (no Former member)',!/Former member/.test(await v.textContent('body')));
await v.evaluate(()=>APP.onClick(Object.assign(document.createElement('button'),{}),{})).catch(()=>{});
await go(v,'#/community/q/q1'); await v.click('.upvote >> nth=0'); await v.waitForTimeout(200);
t('visitor upvote asks to sign in',/Sign in/i.test(await v.textContent('.toast, #toast, body')));
await go(v,'#/community/ask'); t('visitor sees sign-in prompt on ask',(await v.locator('form[data-form=community-ask]').count())===0);

// A asks (normal + anonymous)
const A=await page('a');
await go(A,'#/community/ask');
await A.fill('input[name=title]','How to cut over FI?'); await A.fill('textarea[name=body]','Details of the cutover question');
await A.selectOption('select[name=product]','s4onprem'); await A.click('form[data-form=community-ask] button[type=submit]'); await quiet(A);
let rows=await sql('select * from questions where title=$1',['How to cut over FI?']);
t('question saved on server',rows.length===1&&rows[0].author===ent.a&&rows[0].owner===U.a&&rows[0].product_id==='s4onprem',rows);
const qid=rows[0]?.id; t('navigated to the question',await A.evaluate(i=>location.hash==='#/community/q/'+i,qid));
await go(A,'#/community/ask');
await A.fill('input[name=title]','Private worry'); await A.fill('textarea[name=body]','Sensitive'); await A.selectOption('select[name=topic]',{index:1}); await A.check('input[name=anonymous]');
await A.click('form[data-form=community-ask] button[type=submit]'); await quiet(A);
rows=await sql('select * from questions where title=$1',['Private worry']);
t('anonymous question saved',rows.length===1&&rows[0].anonymous===true&&rows[0].topic!=='',rows);
await go(A,'#/community/ask'); await A.click('form[data-form=community-ask] button[type=submit]'); await A.waitForTimeout(200);
t('empty question not sent',(await sql('select count(*)::int n from questions where owner=$1',[U.a]))[0].n===2);

// B answers + votes
const B=await page('b');
t('B sees A question after load',await B.evaluate(i=>!!APP.db.questions[i],qid));
await go(B,'#/community/q/'+qid);
await B.fill('textarea[name=q]','Use DMO with two dress rehearsals.'); await B.click('form[data-form=community-answer] button[type=submit]'); await quiet(B);
rows=await sql('select * from answers where question_id=$1',[qid]);
t('answer saved',rows.length===1&&rows[0].author===ent.b,rows);
await B.click('.upvote >> nth=0'); await quiet(B);
t('upvote saved',(await sql(`select count(*)::int n from votes where kind='q' and item_id=$1`,[qid]))[0].n===1);
await B.click('.upvote >> nth=0'); await quiet(B);
t('upvote removed',(await sql(`select count(*)::int n from votes where kind='q' and item_id=$1`,[qid]))[0].n===0);
await B.click('.upvote >> nth=0'); await quiet(B);
// A reloads and sees answer, accepts
await A.reload(); await A.waitForFunction(()=>APP.backend.ready); await go(A,'#/community/q/'+qid);
t('A sees the answer after reload',/dress rehearsals/.test(await A.textContent('body')));
t('A sees 1 upvote after reload',await A.evaluate(i=>APP.db.questions[i].upvotes===1,qid));
await A.click('button[data-action=accept-answer]'); await quiet(A);
t('accepted saved',(await sql('select accepted from answers where question_id=$1',[qid]))[0].accepted===true);
t('B got a notification of acceptance',(await sql(`select count(*)::int n from notifications where user_key=$1 and text like '%accepted%'`,[ent.b]))[0].n===1);
t('A got a notification about the answer',(await sql(`select count(*)::int n from notifications where user_key=$1 and text like '%answered your question%'`,[ent.a]))[0].n>=1);
// visitor sees anonymous question without author
const v2=await page(null); await go(v2,'#/community');
const anonId=(await sql(`select id from questions where title='Private worry'`))[0].id;
t('visitor cannot learn anonymous author',await v2.evaluate(i=>APP.db.questions[i].authorId===null,anonId));
await go(v2,'#/community/q/'+anonId); t('anonymous shown as Anonymous member',/Anonymous member/.test(await v2.textContent('body')));
// employer shares article, B comments then deletes
const E=await page('e'); await go(E,'#/community/share');
await E.fill('input[name=title]','Field note'); await E.fill('input[name=url]','https://example.com/note'); await E.selectOption('select[name=product]','s4onprem'); await E.click('form[data-form=community-share] button[type=submit]'); await quiet(E);
rows=await sql('select * from articles where title=$1',['Field note']); t('article saved',rows.length===1&&rows[0].author===ent.e,rows);
const aid=rows[0]?.id;
await B.reload(); await B.waitForFunction(()=>APP.backend.ready); await go(B,'#/community/a/'+aid);
await B.fill('textarea[name=q]','Good read'); await B.click('form[data-form=community-comment] button[type=submit]'); await quiet(B);
t('comment saved',(await sql('select count(*)::int n from article_comments where article_id=$1',[aid]))[0].n===1);
await B.click('button[data-action=comment-delete]'); await quiet(B);
t('comment deleted on server',(await sql('select count(*)::int n from article_comments where article_id=$1',[aid]))[0].n===0);
// hidden-company author shows as company for others
await sql(`update companies set anon=true where id=$1`,[ent.e]);
await B.reload(); await B.waitForFunction(()=>APP.backend.ready); await go(B,'#/community/a/'+aid);
t('company author is named (anonymity is per role only)',/Acme Corp/.test(await B.textContent('body')));
await sql(`update companies set anon=false where id=$1`,[ent.e]);
// sample vote then failure rollback
await go(B,'#/community/q/q2'); const before=await B.evaluate(()=>APP.db.questions.q2.upvotes);
await B.click('.upvote >> nth=0'); await quiet(B);
t('vote on sample question saved',(await sql(`select count(*)::int n from votes where kind='q' and item_id='q2' and owner=$1`,[U.b]))[0].n===1);
await sql(`delete from questions where id=$1`,[qid]);
await go(B,'#/community/q/'+qid); // still in local cache
await B.evaluate(i=>APP.db.questions[i]&&APP.onClick(document.querySelector('.upvote'),{}),qid);
await B.waitForTimeout(500);
t('failed write resyncs from server',await B.evaluate(i=>!APP.db.questions[i],qid));
// account deletion removes posts
await sql(`delete from auth.users where id=$1`,[U.b]);
t('deleting an account removes their answers/votes',(await sql(`select count(*)::int n from answers where owner=$1`,[U.b]))[0].n===0);
t('no page errors',errors.length===0,errors);
console.log(fails?`\n${fails} FAILURES`:'\nALL PASSED'); await browser.close(); process.exit(fails?1:0);
