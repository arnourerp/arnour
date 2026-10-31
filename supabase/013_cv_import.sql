-- release30: CV import (the sign-up wizard can read a CV once to pre-fill the profile)
-- Only who asked and when is kept (never the CV text), so use can be limited and counted.
--   * 5 reads per person per rolling 24 hours (a failed read does not count)
--   * 400 reads per rolling 24 hours for the whole site (a safety stop on top of the spend cap)
create table if not exists public.cv_imports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  status     text not null default 'started' check (status in ('started','ok','failed')),
  found      jsonb
);
create index if not exists cv_imports_user_idx on public.cv_imports (user_id, created_at desc);
create index if not exists cv_imports_day_idx  on public.cv_imports (created_at desc);
alter table public.cv_imports enable row level security;
revoke all on public.cv_imports from public, anon, authenticated;   -- no policies: only the two functions below touch it

create or replace function public.cv_import_begin() returns uuid
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text; n int; g int; nid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  r := my_role();                                    -- refuses a suspended account
  if r is not null and r <> 'consultant' then raise exception 'consultants only'; end if;
  select count(*) into n from public.cv_imports
   where user_id = uid and created_at > now() - interval '24 hours' and status <> 'failed';
  if n >= 5 then raise exception 'daily limit'; end if;
  select count(*) into g from public.cv_imports
   where created_at > now() - interval '24 hours' and status <> 'failed';
  if g >= 400 then raise exception 'busy'; end if;
  insert into public.cv_imports(user_id) values (uid) returning id into nid;
  return nid;
end $$;

create or replace function public.cv_import_done(p_id uuid, p_status text, p_found jsonb default null) returns void
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_status not in ('ok','failed') then raise exception 'bad status'; end if;
  if p_found is not null and length(p_found::text) > 500 then p_found := null; end if;
  update public.cv_imports
     set status = p_status, found = case when p_status = 'ok' then p_found end
   where id = p_id and user_id = uid and status = 'started';
end $$;

revoke execute on function public.cv_import_begin(), public.cv_import_done(uuid,text,jsonb) from public, anon;
grant  execute on function public.cv_import_begin(), public.cv_import_done(uuid,text,jsonb) to authenticated;

select 'ok' as release30;
