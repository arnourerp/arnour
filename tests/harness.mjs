import {PGlite} from '@electric-sql/pglite';
import fs from 'fs'; import crypto from 'crypto';
export async function makeBackend(){
  const db=new PGlite();
  await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated, public;`);
  await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text, owner uuid); alter table storage.objects enable row level security; grant usage on schema storage to anon, authenticated; grant all on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;`);
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/001_schema.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/002_seed_samples.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/003_community.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/004_seed_community.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/005_admin.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/006_feedback.sql','utf8'));
  await db.exec(fs.readFileSync(process.env.ARNOUR_ROOT+'/supabase/007_email.sql','utf8'));
  const users={}; let tok=0; const log=[];
  const SETOF=['list_consultants','list_jobs','list_companies'];
  const JSONB=['p_data','p_cv','p_call'];
  async function withRole(uid,fn){
    await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${uid?'authenticated':'anon'};`);
    try{ return await fn(); } finally { await db.exec('reset role'); }
  }
  const err=(e)=>({error:{message:e.message,code:e.code||'XX000',status:400}});
  async function handle(op){
    if(op.t==='signup'){ if(users[op.email]) return {user:{id:users[op.email].id,email:op.email}}; const id=crypto.randomUUID(); users[op.email]={id,email:op.email,password:op.password,confirmed:false,meta:op.meta||{},token:'tok'+(++tok)}; await db.query('insert into auth.users values ($1,$2)',[id,op.email]); return {user:{id,email:op.email,user_metadata:op.meta}}; }
    if(op.t==='signin'){ const u=users[op.email]; if(!u||u.password!==op.password) return {error:{message:'Invalid login credentials',status:400}}; if(!u.confirmed) return {error:{message:'Email not confirmed',status:400}}; return {session:{access_token:'x',user:{id:u.id,email:u.email,user_metadata:u.meta}}}; }
    if(op.t==='verify'){ const u=Object.values(users).find(x=>x.token===op.token_hash); if(!u) return {error:{message:'Token has expired or is invalid'}}; u.confirmed=true; return {session:{access_token:'x',user:{id:u.id,email:u.email,user_metadata:u.meta}}}; }
    if(op.t==='setpw'){ const u=Object.values(users).find(x=>x.id===op.uid); if(u) u.password=op.password; return {}; }
    if(op.t==='reset'||op.t==='resend') return {};
    if(op.t==='rpc'){
      try{ return await withRole(op.uid,async()=>{
        const names=Object.keys(op.args), vals=[], parts=[];
        names.forEach((n,i)=>{ let v=op.args[n]; const ty=JSONB.includes(n)?'jsonb':(n==='p_accept'||n==='p_on'||n==='p_anon')?'boolean':n==='p_user'?'uuid':n==='p_report'?'bigint':(n==='p_limit')?'int':n==='p_msg'?'uuid':'text'; vals.push(ty==='jsonb'?(v===null?null:JSON.stringify(v)):v); parts.push(`${n} => $${i+1}::${ty}`); });
        const r=await db.query(`select * from public.${op.fn}(${parts.join(',')})`,vals);
        const rows=r.rows;
        if(rows.length&&Object.keys(rows[0]).length===1&&Object.keys(rows[0])[0]===op.fn){ const vs=rows.map(x=>x[op.fn]); return {data:SETOF.includes(op.fn)?vs:vs[0]}; }
        if(!rows.length&&SETOF.includes(op.fn)) return {data:[]};
        return {data:rows};
      }); }catch(e){ return err(e); }
    }
    if(op.t==='from'){
      const q=op.q;
      try{ return await withRole(op.uid,async()=>{
        const vals=[]; let where='';
        if(q.filters.length){ where=' where '+q.filters.map(f=>{vals.push(f.vals.map(String)); return `${f.col}::text = any($${vals.length}::text[])`;}).join(' and '); }
        let sql;
        if(q.action==='select') sql=`select * from public.${q.table}${where}${q.order?` order by ${q.order.col} ${q.order.asc?'asc':'desc'}`:''}${q.limit?` limit ${q.limit}`:''}`;
        else if(q.action==='update'){ const sets=Object.keys(q.values).map(k=>{vals.push(q.values[k]); return `${k} = $${vals.length}`;}); sql=`update public.${q.table} set ${sets.join(',')}${where.replace(/\$(\d+)/g,(m,n)=>'$'+n)}`; }
        else sql=`delete from public.${q.table}${where}`;
        const r=await db.query(sql,vals);
        if(q.single) return {data:r.rows[0]||null};
        return {data:r.rows};
      }); }catch(e){ return err(e); }
    }
    return {error:{message:'unknown op'}};
  }
  return {db,users,handle:async(s)=>JSON.stringify(await handle(JSON.parse(s)))};
}
