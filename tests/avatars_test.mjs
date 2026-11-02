/* Profile photos and company logos (release38): the path is kept only inside the owner's folder, and an anonymous / confidential
   picture is hidden exactly like the name */
import {makeBackend} from './harness.mjs'; import fs from 'fs';
const be=await makeBackend(); const db=be.db;
for(const f of ['017_company_type.sql','018_partner_capabilities.sql','021_avatars.sql']) await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/'+f,'utf8'));
let fails=0; const t=(n,ok,x)=>{ if(!ok){fails++;console.log('FAIL',n,x!==undefined?JSON.stringify(x).slice(0,400):'');} else console.log('ok  ',n); };
const U={pub:'aaaaaaaa-0000-0000-0000-000000000001',anon:'aaaaaaaa-0000-0000-0000-000000000002',co:'bbbbbbbb-0000-0000-0000-000000000001',pt:'bbbbbbbb-0000-0000-0000-000000000002',pt2:'bbbbbbbb-0000-0000-0000-000000000003',viewer:'cccccccc-0000-0000-0000-000000000001'};
for(const [k,id] of Object.entries(U)) await db.query(`insert into auth.users(id,email) values ($1,$2)`,[id,k+'@arnour.test']);
async function as(uid,sql,args){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`); try{ const r=await db.query(sql,args||[]); await db.exec('reset role'); return {rows:r.rows}; }catch(e){ await db.exec('reset role'); return {err:e.message}; } }
const J=(o)=>JSON.stringify(o);
const claim=async(u,role,d)=>(await as(U[u],`select claim_profile($1,$2::jsonb) x`,[role,J(d)])).rows[0].x;
const P=(u,name)=>U[u]+'/'+name;
const base={firstName:'Pia',lastName:'Pro',headline:'FI lead',country:'ae',skills:[]};
const cPub=await claim('pub','consultant',{...base,anon:false,photo:P('pub','abcdef123456.jpg')});
const cAnon=await claim('anon','consultant',{...base,firstName:'Ana',anon:true,photo:P('anon','fedcba654321.webp')});
const coId=await claim('co','employer',{name:'Acme',country:'ae',industry:'Retail',size:'11-50',companyType:'customer',logo:P('co','112233445566.png')});
const ptId=await claim('pt','employer',{name:'Gamma',country:'ae',industry:'IT',size:'11-50',companyType:'partner',logo:P('pt','aabbccddeeff.jpg'),partner:{hideName:false,skills:[{productId:'s4public',moduleId:'fi',projects:2}]}});
await claim('viewer','employer',{name:'Viewer Co',country:'ae',industry:'Retail',size:'11-50',companyType:'customer'});
const row=async(u,id)=>(await as(U[u],`select * from list_consultants()`)).rows.map(r=>r.list_consultants).find(x=>x.id===id);

t('a public professional\'s photo is visible to a company',(await row('viewer',cPub)||{}).photo===P('pub','abcdef123456.jpg'),await row('viewer',cPub));
t('an anonymous professional\'s photo is NOT visible',(await row('viewer',cAnon)||{}).photo===undefined,await row('viewer',cAnon));
t('the owner always sees their own photo',(await row('anon',cAnon)||{}).photo===P('anon','fedcba654321.webp'));
const cos=async(u)=>(await as(U[u],`select * from list_companies()`)).rows.map(r=>r.list_companies);
t('a company logo is visible to others',(await cos('viewer')).find(x=>x.id===coId).logo===P('co','112233445566.png'),await cos('viewer'));

/* paths are only kept inside the owner's own folder */
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:'https://evil.example/x.jpg'})]);
t('an outside address is dropped',(await row('viewer',cPub)).photo===undefined);
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:P('anon','abcdef123456.jpg')})]);
t("someone else's folder is dropped",(await row('viewer',cPub)).photo===undefined);
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:U.pub+'/../x/evil.jpg'})]);
t('path tricks are dropped',(await row('viewer',cPub)).photo===undefined);
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:P('pub','abcdef123456.gif')})]);
t('other file types are dropped',(await row('viewer',cPub)).photo===undefined);
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:{a:1}})]);
t('a non-text value is dropped',(await row('viewer',cPub)).photo===undefined);
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false,photo:P('pub','newfile987654.png')})]);
t('a good path is kept',(await row('viewer',cPub)).photo===P('pub','newfile987654.png'));
await as(U.pub,`select save_profile($1::jsonb)`,[J({...base,anon:false})]);
t('removing the photo works',(await row('viewer',cPub)).photo===undefined);
await as(U.co,`select save_profile($1::jsonb)`,[J({name:'Acme',country:'ae',industry:'Retail',size:'11-50',companyType:'customer',logo:'javascript:alert(1)'})]);
t('a bad logo path is dropped',(await cos('viewer')).find(x=>x.id===coId).logo===undefined);

/* partner cards */
const card=async(id)=>(await as(U.viewer,`select * from list_partners()`)).rows.map(r=>r.list_partners).find(x=>x.id===id);
t('a named partner card shows the logo',(await card(ptId)||{}).logo===P('pt','aabbccddeeff.jpg'),await card(ptId));
await as(U.pt,`select save_profile($1::jsonb)`,[J({name:'Gamma',country:'ae',industry:'IT',size:'11-50',companyType:'partner',logo:P('pt','aabbccddeeff.jpg'),partner:{hideName:true,skills:[{productId:'s4public',moduleId:'fi',projects:2}]}})]);
const hidden=(await as(U.viewer,`select * from list_partners()`)).rows.map(r=>r.list_partners).find(x=>x.name==='Confidential SI/Partner');
t('a partner that hides its name shows no logo',hidden && hidden.logo===undefined,hidden);

/* the storage rules */
const b=(await db.query(`select public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars'`)).rows[0];
t('bucket: public, 150 KB, images only',b&&b.public===true&&Number(b.file_size_limit)===153600&&b.allowed_mime_types.join()==='image/jpeg,image/png,image/webp',b);
console.log(fails?'FAILED '+fails:'ALL OK'); process.exit(fails?1:0);
