-- release36: "Build my partner page from a company presentation" (an SI/Partner can upload a profile deck once to pre-fill its team skills)
-- Only who asked and when is kept (never the file or its text), so use can be limited and counted.
--   * 10 reads per person per rolling 24 hours (a failed read does not count)
--   * 400 reads per rolling 24 hours for the whole site (a safety stop on top of the spend cap)
-- Allowed for a company, or for someone who is signing up and has no profile yet (the company wizard).
create table if not exists public.pt_imports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  status     text not null default 'started' check (status in ('started','ok','failed')),
  found      jsonb
);
create index if not exists pt_imports_user_idx on public.pt_imports (user_id, created_at desc);
create index if not exists pt_imports_day_idx  on public.pt_imports (created_at desc);
alter table public.pt_imports enable row level security;
revoke all on public.pt_imports from public, anon, authenticated;   -- no policies: only the two functions below touch it

create or replace function public.pt_import_begin() returns uuid
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text; n int; g int; nid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  r := my_role();                                    -- refuses a suspended account
  if r is not null and r <> 'employer' then raise exception 'companies only'; end if;
  select count(*) into n from public.pt_imports
   where user_id = uid and created_at > now() - interval '24 hours' and status <> 'failed';
  if n >= 10 then raise exception 'daily limit'; end if;
  select count(*) into g from public.pt_imports
   where created_at > now() - interval '24 hours' and status <> 'failed';
  if g >= 400 then raise exception 'busy'; end if;
  insert into public.pt_imports(user_id) values (uid) returning id into nid;
  return nid;
end $$;

create or replace function public.pt_import_done(p_id uuid, p_status text, p_found jsonb default null) returns void
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_status not in ('ok','failed') then raise exception 'bad status'; end if;
  if p_found is not null and length(p_found::text) > 500 then p_found := null; end if;
  update public.pt_imports
     set status = p_status, found = case when p_status = 'ok' then p_found end
   where id = p_id and user_id = uid and status = 'started';
end $$;

revoke execute on function public.pt_import_begin(), public.pt_import_done(uuid,text,jsonb) from public, anon;
grant  execute on function public.pt_import_begin(), public.pt_import_done(uuid,text,jsonb) to authenticated;

select 'ok' as release36;
