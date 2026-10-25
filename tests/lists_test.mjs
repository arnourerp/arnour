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
const save=async(who,op,args)=>{ const r=await as(who,`select admin_lists_save($1,$2::jsonb) x`,[op,JSON.stringify(args)]); return r.err?r:r[0].x; };
const lst=async(who='c')=>(await as(who,`select get_lists() x`))[0].x;
const find=(L,k,id)=>k==='city'?L.countries.flatMap(c=>c.cities).find(x=>x.id===id):(k==='country'?L.countries:L[k==='nationality'?'nationalities':k==='language'?'languages':'regions']).find(x=>x.id===id);

let L=await lst(null);
t('anyone (even a visitor) can read the lists',Array.isArray(L.countries)&&L.countries.length===22&&L.regions.length===4);
t('seed: 5 languages, 22 nationalities as demonyms',L.languages.length===5&&L.nationalities.length===22&&L.nationalities[0].name==='Egyptian'&&L.nationalities.some(n=>n.name==='Emirati'));
t('seed: UAE has 8 cities',L.countries.find(c=>c.id==='ae').cities.length===8);
t('seed does not repeat on a second run',(await db.query(`select count(*)::int n from list_items where kind='country'`)).rows[0].n===22);
t('tables are closed to everyone',!!(await as('c','select * from list_items')).err||(await as('c','select * from list_items')).length===0);
t('sample profiles moved to demonyms',(await db.query(`select count(*)::int n from consultants where data->>'nationality' in ('Egypt','India','United Arab Emirates','Germany')`)).rows[0].n===0);

t('visitor cannot edit',!!(await save(null,'save',{kind:'language',name:'X'})).err);
t('professional cannot edit',!!(await save('c','save',{kind:'language',name:'X'})).err);
t('professional cannot see usage',!!(await as('c','select admin_lists_usage() x')).err);
t('professional cannot undo',!!(await save('c','undo',{})).err);

// add
let r=await save('a','save',{kind:'language',name:'Spanish'});
t('add language',!r.err&&r.id==='spanish'&&r.lists.languages.length===6,r.err);
t('duplicate language rejected',/already exists/.test((await save('a','save',{kind:'language',name:'  spanish '})).err||''));
t('empty name rejected',/name/i.test((await save('a','save',{kind:'language',name:' '})).err||''));
r=await save('a','save',{kind:'country',name:'Greece',parent:'other'});
t('add country (id from name)',!r.err&&r.id==='greece'&&r.lists.countries.find(c=>c.id==='greece').region==='other',r.err);
t('country needs a real region',!!(await save('a','save',{kind:'country',name:'Peru',parent:'nope'})).err);
r=await save('a','save',{kind:'city',name:'Athens',parent:'greece'});
t('add city under a country',!r.err&&r.id==='greece:athens'&&r.lists.countries.find(c=>c.id==='greece').cities.length===1,r.err);
t('same city twice in one country rejected',!!(await save('a','save',{kind:'city',name:'athens',parent:'greece'})).err);
r=await save('a','save',{kind:'city',name:'Athens',parent:'us'});
t('same city name in another country is fine',!r.err,r.err);
r=await save('a','save',{kind:'nationality',name:'Greek'});
t('add nationality',!r.err&&r.lists.nationalities.length===23,r.err);
r=await save('a','save',{kind:'region',name:'Europe'});
t('add region',!r.err&&r.id==='europe'&&r.lists.regions.length===5,r.err);
r=await save('a','save',{kind:'country',id:'greece',name:'Greece',parent:'europe'});
t('move a country to the new region',!r.err&&r.lists.countries.find(c=>c.id==='greece').region==='europe',r.err);

// usage + rename rewrites stored values
await db.query(`insert into consultants(id,owner,anon,sample,data) values ('c-x',null,false,false,$1::jsonb),('c-y',null,false,false,$2::jsonb)`,
  [JSON.stringify({country:'greece',city:'Athens',nationality:'Greek',languages:['Spanish','English']}),JSON.stringify({country:'us',city:'Athens',nationality:'Greek',languages:['Spanish']})]);
await db.query(`insert into companies(id,owner,sample,data) values ('co-x',null,false,'{"name":"X","country":"greece","city":"Athens"}')`);
await db.query(`insert into jobs(id,company_id,owner,status,sample,data) values ('j-x','co-x',null,'open',false,$1::jsonb)`,[JSON.stringify({country:'greece',city:'Athens',languages:['Spanish'],preferredLangs:['Spanish','Arabic']})]);
let US=(await as('a','select admin_lists_usage() x'))[0].x;
t('usage: country, city (per country), nationality, language',US.country.greece.pros===1&&US.country.greece.roles===1&&US.city['greece|Athens'].pros===1&&US.city['us|Athens'].pros===1&&US.nationality.Greek.pros===2&&US.language.Spanish.pros===2&&US.language.Spanish.roles===1,US);
r=await save('a','save',{kind:'language',id:'spanish',name:'Espanol'});
let cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data, jx=(await db.query(`select data from jobs where id='j-x'`)).rows[0].data;
t('rename language rewrites profiles and roles',!r.err&&cx.languages.join()==='Espanol,English'&&jx.languages.join()==='Espanol'&&jx.preferredLangs.join()==='Espanol,Arabic',r.err||[cx,jx]);
r=await save('a','save',{kind:'city',id:'greece:athens',name:'Athina'});
cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data; let cy=(await db.query(`select data from consultants where id='c-y'`)).rows[0].data;
t('rename city only rewrites that country',!r.err&&cx.city==='Athina'&&cy.city==='Athens',r.err||[cx,cy]);
let lg=(await as('a','select admin_lists_log(10) x'))[0].x;
t('history lists changes, undo offered for the last',lg.length>5&&lg[0].canUndo===true&&lg[1].canUndo===false);
r=await save('a','undo',{});
cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data;
t('undo a city rename restores the name and the data',!r.err&&cx.city==='Athens'&&find(r.lists,'city','greece:athens').name==='Athens',r.err);

// hide
r=await save('a','save',{kind:'language',id:'french',name:'French',hidden:true});
t('hide a language: flagged, not removed',!r.err&&find(r.lists,'language','french').hidden===true&&r.lists.languages.length===6);
r=await save('a','save',{kind:'region',id:'other',name:'Other',hidden:true});
t('cannot hide a region that still has visible countries',/visible countries/.test(r.err||''),r.err);

// reorder
r=await save('a','reorder',{kind:'language',ids:['arabic','english','hindi','urdu','french','espanol'.replace('espanol','spanish')]});
t('reorder languages',!r.err&&r.lists.languages[0].id==='arabic',r.err);

// merge
r=await save('a','merge',{kind:'language',from:'spanish',to:'arabic'});
cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data;
t('merge language: moved + hidden + counts',!r.err&&r.profiles===2&&r.roles===1&&cx.languages.join()==='Arabic,English'&&find(r.lists,'language','spanish').hidden===true,r.err||cx);
t('cannot merge into a hidden item',!!(await save('a','merge',{kind:'language',from:'urdu',to:'french'})).err);
t('cannot merge into itself',!!(await save('a','merge',{kind:'language',from:'urdu',to:'urdu'})).err);
r=await save('a','undo',{});
t('merge cannot be undone',/cannot be undone/.test(r.err||''),r.err);
r=await save('a','merge',{kind:'nationality',from:'greek',to:'emirati'});
cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data;
t('merge nationality',!r.err&&cx.nationality==='Emirati',r.err);
await save('a','save',{kind:'city',name:'Piraeus',parent:'greece'});
r=await save('a','merge',{kind:'city',from:'greece:piraeus',to:'us:athens'});
t('cities merge only within one country',/same country/.test(r.err||''),r.err);
await save('a','save',{kind:'city',name:'Dubai',parent:'greece'});
r=await save('a','merge',{kind:'country',from:'greece',to:'ae'});
cx=(await db.query(`select data from consultants where id='c-x'`)).rows[0].data; jx=(await db.query(`select data from jobs where id='j-x'`)).rows[0].data;
const ae=find(r.lists,'country','ae');
t('merge country: people + roles move, cities follow, duplicates fold',!r.err&&cx.country==='ae'&&jx.country==='ae'&&ae.cities.some(c=>c.name==='Athens')&&ae.cities.filter(c=>c.name==='Dubai'&&!c.hidden).length===1&&find(r.lists,'country','greece').hidden===true,r.err||[cx,ae.cities.length]);
t('merged country listed for the app',r.lists.mergedCountries.some(x=>x[0]==='greece'&&x[1]==='ae'));
t('cannot merge regions',!!(await save('a','merge',{kind:'region',from:'europe',to:'other'})).err);
t('unknown action / list rejected',!!(await save('a','zzz',{})).err&&!!(await save('a','save',{kind:'zzz',name:'a'})).err);
t('release can run again without changing anything',await (async()=>{const n0=(await db.query('select count(*)::int n from list_items')).rows[0].n; await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/009_lists.sql','utf8')); return (await db.query('select count(*)::int n from list_items')).rows[0].n===n0;})());
console.log(fails?`${fails} FAILED`:'ALL OK'); process.exit(fails?1:0);
