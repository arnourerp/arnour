import {PGlite} from '@electric-sql/pglite';
import fs from 'fs';
const db=new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated, public;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,owner uuid);
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
for(const f of ['001_schema','002_seed_samples','003_community','004_seed_community','005_admin','006_feedback','007_email','008_catalog','009_lists']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f+'.sql','utf8'));
await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/008_catalog.sql','utf8')); // runs twice
const U={a:'99999999-9999-9999-9999-999999999999',c:'22222222-2222-2222-2222-222222222222',e:'11111111-1111-1111-1111-111111111111'};
await db.query(`insert into auth.users(id,email) values ($1,'boss@arnour.test'),($2,'c@x.com'),($3,'e@x.com')`,[U.a,U.c,U.e]);
await db.query(`insert into admin_emails(email) values ('boss@arnour.test')`);
async function as(who,sql,params){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${who?U[who]:''}',false); set role ${who?'authenticated':'anon'};`);
  try{ const r=await db.query(sql,params); await db.exec('reset role'); return r.rows;}catch(e){await db.exec('reset role'); return {err:e.message};} }
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,300):'');} else console.log('ok  ',n); };
const save=async(who,op,args)=>{ const r=await as(who,`select admin_catalog_save($1,$2::jsonb) x`,[op,JSON.stringify(args)]); return r.err?r:r[0].x; };
const cat=async(who='c')=>(await as(who,`select get_catalog() x`))[0].x;

// reading
let c=await cat(null);
t('anyone (even a visitor) can read the catalog',Array.isArray(c.products)&&c.products.length===15);
t('147 modules, 40 specialties seeded',c.products.reduce((n,p)=>n+p.modules.length,0)===147&&c.areas.reduce((n,a)=>n+a.groups.reduce((m,g)=>m+g.items.length,0),0)===40);
t('role suggestions seeded',c.roles.technical.length===14&&c.roles.architect.length===17&&c.roles.functional.length===12);
t('families seeded (fi=fin, abap=tech)',c.products.find(p=>p.id==='s4onprem').modules.find(m=>m.id==='fi').family==='fin'&&c.products.find(p=>p.id==='ecc').modules.find(m=>m.id==='abap').family==='tech');
t('seed does not repeat on a second run',(await db.query('select count(*)::int n from catalog_products')).rows[0].n===15);
t('tables are closed to everyone',!!(await as('c','select * from catalog_products')).err||(await as('c','select * from catalog_products')).length===0);

// permissions
t('visitor cannot edit',!!(await save(null,'product_save',{name:'X'})).err);
t('professional cannot edit',!!(await save('c','module_save',{product_id:'ecc',name:'X'})).err);
t('professional cannot see usage',!!(await as('c','select admin_catalog_usage() x')).err);
t('professional cannot undo',!!(await save('c','undo',{})).err);

// product / module
let r=await save('a','product_save',{name:'SAP Test Cloud',short:'Test Cloud'});
t('admin adds a product',!r.err&&r.id==='saptestcloud'&&r.catalog.products.length===16,r.err||r.id);
r=await save('a','module_save',{product_id:'saptestcloud',name:'Test Module One'});
t('admin adds a module (id from name)',!r.err&&r.id==='testmoduleone',r.err||r.id);
r=await save('a','module_save',{product_id:'saptestcloud',name:'Test Module One'});
t('same name gets a different id',!r.err&&r.id==='testmoduleone2',r.err||r.id);
t('empty name rejected',/name/i.test((await save('a','module_save',{product_id:'saptestcloud',name:'  '})).err||''));
t('bad family rejected',!!(await save('a','module_save',{product_id:'saptestcloud',name:'Q',family:'zzz'})).err);
t('unknown product rejected',!!(await save('a','module_save',{product_id:'nope',name:'Q'})).err);
r=await save('a','module_save',{product_id:'saptestcloud',id:'testmoduleone',name:'Test Module Renamed',family:'fin'});
t('rename keeps the id',!r.err&&r.catalog.products.find(p=>p.id==='saptestcloud').modules.find(m=>m.id==='testmoduleone').name==='Test Module Renamed');
r=await save('a','module_save',{product_id:'ecc',id:'trm',name:'Treasury',hidden:true});
t('hide a module: still in the catalog, flagged',!r.err&&r.catalog.products.find(p=>p.id==='ecc').modules.find(m=>m.id==='trm').hidden===true);
r=await save('a','module_save',{product_id:'ecc',id:'trm',name:'Treasury & Bank Communication (TRM / BCM / Cash)',hidden:false});
t('unhide',!r.err&&r.catalog.products.find(p=>p.id==='ecc').modules.find(m=>m.id==='trm').hidden===false);
r=await save('a','reorder',{kind:'module',parent:'saptestcloud',ids:['testmoduleone2','testmoduleone']});
t('reorder modules',!r.err&&r.catalog.products.find(p=>p.id==='saptestcloud').modules.map(m=>m.id).join()==='testmoduleone2,testmoduleone',r.err);

// usage + merge
await db.query(`insert into consultants(id,owner,anon,sample,data) values ('c-x',null,false,false,$1::jsonb),('c-y',null,false,false,$2::jsonb)`,
  [JSON.stringify({skills:[{productId:'saptestcloud',moduleId:'testmoduleone',projects:3,certified:false},{productId:'ecc',moduleId:'fi',projects:2}],specialties:['rise','greenfield']}),
   JSON.stringify({skills:[{productId:'saptestcloud',moduleId:'testmoduleone',projects:1},{productId:'saptestcloud',moduleId:'testmoduleone2',projects:6,certified:true}],specialties:['rise']})]);
await db.query(`insert into companies(id,owner,sample,data) values ('co-x',null,false,'{"name":"X"}')`);
await db.query(`insert into jobs(id,company_id,owner,status,sample,data) values ('j-x','co-x',null,'open',false,$1::jsonb)`,[JSON.stringify({title:'T',requires:[{productId:'saptestcloud',moduleId:'testmoduleone',minProjects:2},{orPrev:true,productId:'ecc',moduleId:'fi'}],preferredSpecialties:['rise','pmo']})]);
let u=(await as('a','select admin_catalog_usage() x'))[0].x;
t('usage counts professionals and roles',u.mods['saptestcloud:testmoduleone'].pros===2&&u.mods['saptestcloud:testmoduleone'].roles===1&&u.prods.saptestcloud.pros===2&&u.specs.rise.pros===2&&u.specs.rise.roles===1,u.mods['saptestcloud:testmoduleone']);
r=await save('a','merge_module',{from_p:'saptestcloud',from_m:'testmoduleone',to_p:'saptestcloud',to_m:'testmoduleone2'});
t('merge module ok, counts returned',!r.err&&r.profiles===2&&r.roles===1,r.err||r);
const sk=(await db.query(`select data->'skills' s from consultants where id='c-y'`)).rows[0].s;
t('duplicates folded: max projects, certified kept',sk.length===1&&sk[0].moduleId==='testmoduleone2'&&sk[0].projects===6&&sk[0].certified===true,sk);
const sx=(await db.query(`select data->'skills' s from consultants where id='c-x'`)).rows[0].s;
t('moved: x now has the target, other skills untouched',sx.some(k=>k.moduleId==='testmoduleone2'&&k.projects===3)&&sx.some(k=>k.moduleId==='fi'),sx);
const rq=(await db.query(`select data->'requires' s from jobs where id='j-x'`)).rows[0].s;
t('roles rewritten, orPrev kept',rq[0].moduleId==='testmoduleone2'&&rq[0].minProjects===2&&rq[1].orPrev===true,rq);
c=await cat(); const old=c.products.find(p=>p.id==='saptestcloud').modules.find(m=>m.id==='testmoduleone');
t('old module hidden and remembered as merged',old.hidden===true&&c.merged.some(x=>x.join()==='saptestcloud,testmoduleone,saptestcloud,testmoduleone2'),c.merged);
t('cannot merge into itself',/different/.test((await save('a','merge_module',{from_p:'ecc',from_m:'fi',to_p:'ecc',to_m:'fi'})).err||''));
t('cannot merge into a hidden module',!!(await save('a','merge_module',{from_p:'ecc',from_m:'fi',to_p:'saptestcloud',to_m:'testmoduleone'})).err);
t('merge cannot be undone',/Merges cannot be undone/.test((await save('a','undo',{})).err||''));

// specialties
r=await save('a','spec_save',{area_id:'ai',grp:'AI Development',name:'Prompt Engineering',short:'Prompting',roles:['technical','architect']});
t('admin adds a specialty in an existing group',!r.err&&r.id==='prompt-engineering',r.err||r.id);
c=r.catalog; const ai=c.areas.find(a=>a.id==='ai');
t('it lands in that group',ai.groups.find(g=>g.name==='AI Development').items.some(i=>i.id==='prompt-engineering'));
t('suggested for the roles chosen (at the end)',c.roles.technical[c.roles.technical.length-1]==='prompt-engineering'&&c.roles.architect.includes('prompt-engineering')&&!(c.roles.functional||[]).includes('prompt-engineering'));
r=await save('a','spec_save',{id:'prompt-engineering',area_id:'ai',grp:'AI Development',name:'Prompt Engineering',short:'Prompting',roles:['architect']});
t('role list can shrink',!r.err&&!r.catalog.roles.technical.includes('prompt-engineering')&&r.catalog.roles.architect.includes('prompt-engineering'));
r=await save('a','spec_save',{area_id:'ai',grp:'Brand new group',name:'Another One'});
t('new group is added after the others',!r.err&&r.catalog.areas.find(a=>a.id==='ai').groups.map(g=>g.name).join('|')==='AI Strategy & Architecture|AI Development|Brand new group',r.catalog&&r.catalog.areas.find(a=>a.id==='ai').groups.map(g=>g.name));
r=await save('a','area_save',{name:'Test Area'}); t('admin adds a practice area',!r.err&&r.id==='testarea');
r=await save('a','merge_spec',{from:'rise',to:'grow'});
t('merge specialty rewrites profiles and roles',!r.err&&r.profiles===2&&r.roles===1,r.err||r);
t('profile specialties deduped',JSON.stringify((await db.query(`select data->'specialties' s from consultants where id='c-x'`)).rows[0].s)==='["grow","greenfield"]');
t('role specialties rewritten',JSON.stringify((await db.query(`select data->'preferredSpecialties' s from jobs where id='j-x'`)).rows[0].s)==='["grow","pmo"]');
c=await cat(); t('old specialty hidden + remembered',c.areas.flatMap(a=>a.groups.flatMap(g=>g.items)).find(i=>i.id==='rise').hidden===true&&c.mergedSpecs.some(x=>x[0]==='rise'&&x[1]==='grow'));
t('role suggestions of the old one moved',!c.roles.basis.includes('rise')&&c.roles.basis.includes('grow'),c.roles.basis);

// undo (last non-merge step first? the last log entry is a merge -> blocked; create a fresh change)
r=await save('a','module_save',{product_id:'ecc',id:'po',name:'PO / PI renamed'});
t('rename done',!r.err);
let lg=(await as('a','select admin_catalog_log(10) x'))[0].x;
t('log lists it as undoable',lg[0].canUndo===true&&/PO \/ PI renamed/.test(lg[0].summary),lg[0]);
r=await save('a','undo',{});
t('undo restores the old name',!r.err&&r.catalog.products.find(p=>p.id==='ecc').modules.find(m=>m.id==='po').name==='PO / PI (Process Orchestration / Integration)',r.err);
r=await save('a','undo',{});
t('next undo hits the merge and is refused',/Merges cannot be undone/.test(r.err||''),r);
r=await save('a','product_save',{name:'Undo Me'}); r=await save('a','undo',{});
t('undo of an add removes it',!r.err&&!r.catalog.products.some(p=>p.id==='undome'));
r=await save('a','reorder',{kind:'product',ids:['ecc','s4onprem']}); const first=(await cat()).products.map(p=>p.id).slice(0,2).join();
r=await save('a','undo',{}); t('reorder + undo',first==='ecc,s4onprem'&&(await cat()).products[0].id==='s4onprem',first);
t('audit trail written',(await db.query(`select count(*)::int n from admin_log where action like 'catalog%'`)).rows[0].n>=10);
console.log(fails?'FAILS '+fails:'ALL OK'); process.exit(fails?1:0);
