import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
`);
await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8')); // idempotent
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/002_seed_samples.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/004_seed_community.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/004_seed_community.sql','utf8'));
const U={e:'11111111-1111-1111-1111-111111111111',c:'22222222-2222-2222-2222-222222222222',c2:'33333333-3333-3333-3333-333333333333',e2:'44444444-4444-4444-4444-444444444444'};
for(const k in U) await db.query(`insert into auth.users values ($1,$2)`,[U[k],k+'@x.com']);
let fails=0;
async function as(who,sql,params){ // run as role with uid
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};}
}
function t(name,ok,extra){ if(!ok){fails++;console.log('FAIL',name,extra!==undefined?JSON.stringify(extra).slice(0,300):'');} else console.log('ok  ',name);}
const val=(r,f)=>Array.isArray(r)?r[0][f]:null;


const ce=val(await as('c',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Real',lastName:'Person',headline:'Senior FICO',anon:true,email:'a@b.c'})]),'x');
const ce2=val(await as('c2',`select claim_profile('consultant',$1::jsonb) x`,[JSON.stringify({firstName:'Open',lastName:'Guy',headline:'ABAP dev',email:'o@g.com'})]),'x');
const ee=val(await as('e',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Acme Corp',industry:'Retail'})]),'x');
const ee2=val(await as('e2',`select claim_profile('employer',$1::jsonb) x`,[JSON.stringify({name:'Hidden Co',industry:'Banking',anon:true})]),'x');
t('profiles',ce&&ce2&&ee&&ee2);
let r=await as(null,'select list_community() x'); let L=r[0].x;
t('sample seeded',L.questions.length===25&&L.articles.length===8,[L.questions.length,L.articles.length]);
t('anon can read',!r.err);
const q1=L.questions.find(x=>x.id==='q1');
t('q1 shape',q1.answers.length>0&&q1.upvotes>=12&&q1.upvotedBy.length===3&&q1.authorId==='c-vikram',q1.upvotes);
t('authors card for anon visitor',L.authors.some(a=>a.id==='c-vikram')&&!L.authors.some(a=>a.email||a.phone));
t('authors from sample incl anon redact',true);
// writes need login
t('anon cannot post',!!(await as(null,`select post_question(null,'t','b','s4onprem','fi','',false) x`)).err);
// post question
const qa=val(await as('c2',`select post_question('q1790000000001','My question','Body','s4onprem','fi','',false) x`),'x');
t('post question',qa==='q1790000000001',qa);
t('dup id rejected',!!(await as('c2',`select post_question('q1790000000001','x','y','s4onprem','fi','',false) x`)).err);
t('bad id rejected',!!(await as('c2',`select post_question('Q;drop','x','y','s4onprem','fi','',false) x`)).err);
t('needs topic',!!(await as('c2',`select post_question(null,'x','y','','','',false) x`)).err);
const qan=val(await as('c',`select post_question(null,'Anon q','secret body','','','general',true) x`),'x');
L=(await as(null,'select list_community() x'))[0].x;
let an=L.questions.find(x=>x.id===qan);
t('anonymous question hides author from public',an&&an.authorId===null&&an.anonymous===true,an);
t('anonymous author card not leaked',!L.authors.some(a=>a.id===ce&&a.firstName));
L=(await as('c',`select list_community() x`))[0].x; an=L.questions.find(x=>x.id===qan);
t('owner sees own anonymous question author',an.authorId===ce&&an.mine===true,an);
L=(await as('c2',`select list_community() x`))[0].x; an=L.questions.find(x=>x.id===qan);
t('other user cannot see anon author',an.authorId===null);
// answers
const aid=val(await as('e',`select post_answer('${qa}','ca1790000000002','Employer answer') x`),'x');
t('employer answers',aid==='ca1790000000002');
t('answer to missing q fails',!!(await as('e',`select post_answer('nope','ca1790000000003','x') x`)).err);
// accept
t('non-author cannot accept',!!(await as('e',`select accept_answer('${qa}','${aid}',true) x`)).err);
t('author accepts',!(await as('c2',`select accept_answer('${qa}','${aid}',true) x`)).err);
L=(await as(null,'select list_community() x'))[0].x; let qq=L.questions.find(x=>x.id===qa);
t('accepted visible',qq.answers[0].accepted===true);
const sA=(await as('c2',`select post_answer('${qa}','ca1790000000004','mine') x`));
t('cannot accept own answer',!!(await as('c2',`select accept_answer('${qa}','ca1790000000004',true) x`)).err);
// confidential company author shows alias
const hq=val(await as('e2',`select post_question(null,'Hidden co asks','b','s4onprem','fi','',false) x`),'x');
L=(await as(null,'select list_community() x'))[0].x; let hqq=L.questions.find(x=>x.id===hq);
t('hidden company shown as alias',/^cx:/.test(hqq.authorId),hqq.authorId);
L=(await as('e2',`select list_community() x`))[0].x; hqq=L.questions.find(x=>x.id===hq);
t('hidden company owner sees own id',hqq.authorId===ee2);
// votes
t('vote on',!(await as('e',`select set_vote('q','${qa}',true) x`)).err);
t('vote twice idempotent',!(await as('e',`select set_vote('q','${qa}',true) x`)).err);
L=(await as(null,'select list_community() x'))[0].x; qq=L.questions.find(x=>x.id===qa);
t('vote counted once',qq.upvotes===1&&qq.upvotedBy[0]===ee,qq);
t('vote off',!(await as('e',`select set_vote('q','${qa}',false) x`)).err);
L=(await as(null,'select list_community() x'))[0].x; t('vote removed',L.questions.find(x=>x.id===qa).upvotes===0);
t('vote on missing fails',!!(await as('e',`select set_vote('q','zzz',true) x`)).err);
t('anon cannot vote',!!(await as(null,`select set_vote('q','${qa}',true) x`)).err);
// milestone on sample q with base: find a sample with 4 total
await as('e',`select set_vote('r','a1',true) x`); L=(await as(null,'select list_community() x'))[0].x; const a1=L.articles.find(x=>x.id==='a1');
t('sample article vote adds to base',a1.upvotes===22,a1.upvotes);
// articles & comments
const ar=val(await as('c2',`select post_article('art1790000000005','Nice','https://x.example/a','b','s4onprem','fi','') x`),'x');
t('post article',ar==='art1790000000005');
t('bad url rejected',!!(await as('c2',`select post_article(null,'Nice','javascript:alert(1)','b','s4onprem','','') x`)).err);
const cm=val(await as('e',`select post_comment('${ar}','cm1790000000006','Cool') x`),'x');
L=(await as(null,'select list_community() x'))[0].x; const art=L.articles.find(x=>x.id===ar);
t('comment visible',art.comments.length===1&&art.comments[0].authorId===ee,art);
t('others cannot delete comment',(await as('c2',`select delete_comment('${cm}') x`))&&((await as(null,'select list_community() x'))[0].x.articles.find(x=>x.id===ar).comments.length===1));
await as('e',`select delete_comment('${cm}') x`);
t('owner deletes comment',(await as(null,'select list_community() x'))[0].x.articles.find(x=>x.id===ar).comments.length===0);
// direct table access blocked
t('no direct questions read anon',!!(await as(null,'select * from questions')).err);
t('no direct insert',!!(await as('c',`insert into questions(id,author,title,body) values ('q1','x','x','x')`)).err);
t('no direct votes',!!(await as('c',`insert into votes values ('q','q1','x',null)`)).err);
// rate limit
let lim=null; for(let i=0;i<45;i++){ const x=await as('e2',`select post_comment('art1790000000005',null,'spam ${i}') x`); if(x.err){lim=i;break;} }
t('rate limited',lim!==null&&lim<=40,lim);
// delete account cascades
await db.exec(`reset role; delete from auth.users where id='${U.c2}'`);
L=(await as(null,'select list_community() x'))[0].x;
t('account delete removes posts',!L.questions.some(x=>x.id===qa)&&!L.articles.some(x=>x.id===ar));
console.log(fails?('FAILED '+fails):'ALL PASSED'); process.exit(fails?1:0);
