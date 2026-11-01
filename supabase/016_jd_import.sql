-- release33: job-description import (a company, or the admin, can paste a job ad once to pre-fill the role form)
-- Only who asked and when is kept (never the ad text), so use can be limited and counted.
--   * 30 reads per person per rolling 24 hours (a failed read does not count). The admin account has no per-person limit.
--   * 400 reads per rolling 24 hours for the whole site (a safety stop on top of the spend cap)
create table if not exists public.jd_imports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  kind       text not null default 'post' check (kind in ('post','admin')),
  status     text not null default 'started' check (status in ('started','ok','failed')),
  found      jsonb
);
create index if not exists jd_imports_user_idx on public.jd_imports (user_id, created_at desc);
create index if not exists jd_imports_day_idx  on public.jd_imports (created_at desc);
alter table public.jd_imports enable row level security;
revoke all on public.jd_imports from public, anon, authenticated;   -- no policies: only the two functions below touch it

create or replace function public.jd_import_begin(p_kind text default 'post') returns uuid
language plpgsql security definer set search_path = public, auth as
$$
declare uid uuid := auth.uid(); r text; n int; g int; nid uuid; adm boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_kind not in ('post','admin') then raise exception 'bad kind'; end if;
  adm := public._is_admin();
  if p_kind = 'admin' then
    if not adm then raise exception 'not allowed'; end if;
  else
    r := my_role();                                  -- refuses a suspended account
    if r is distinct from 'employer' and not adm then raise exception 'employers only'; end if;
  end if;
  if not adm then
    select count(*) into n from public.jd_imports
     where user_id = uid and created_at > now() - interval '24 hours' and status <> 'failed';
    if n >= 30 then raise exception 'daily limit'; end if;
  end if;
  select count(*) into g from public.jd_imports
   where created_at > now() - interval '24 hours' and status <> 'failed';
  if g >= 400 then raise exception 'busy'; end if;
  insert into public.jd_imports(user_id, kind) values (uid, p_kind) returning id into nid;
  return nid;
end $$;

create or replace function public.jd_import_done(p_id uuid, p_status text, p_found jsonb default null) returns void
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_status not in ('ok','failed') then raise exception 'bad status'; end if;
  if p_found is not null and length(p_found::text) > 500 then p_found := null; end if;
  update public.jd_imports
     set status = p_status, found = case when p_status = 'ok' then p_found end
   where id = p_id and user_id = uid and status = 'started';
end $$;

revoke execute on function public.jd_import_begin(text), public.jd_import_done(uuid,text,jsonb) from public, anon;
grant  execute on function public.jd_import_begin(text), public.jd_import_done(uuid,text,jsonb) to authenticated;

select 'ok' as release33;
