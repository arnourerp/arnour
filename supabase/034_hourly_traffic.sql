-- Arnour release 54: "Last 24 hours" in Admin > Traffic.
-- The anonymous counters were stored per day only. This release also counts per hour (kept for 3 days, then removed
-- automatically), so the Traffic tab can show the last 24 hours hour by hour. The hourly numbers start from the moment
-- this release is run, so the first 24 hours are partial. Accounts per hour are exact (they come from the accounts).
-- Only the admin can read the hourly numbers. Safe to run more than once.

create table if not exists public.usage_hourly (
  h     timestamptz not null,   -- the start of the hour, UTC
  name  text not null,
  n     int  not null default 0,
  primary key (h, name)
);
alter table public.usage_hourly enable row level security;
revoke all on public.usage_hourly from anon, authenticated, public;

-- same as before (daily), plus the hourly count
create or replace function public.track_usage(p_name text)
returns void language plpgsql security definer set search_path = public as
$$
declare v_h timestamptz := date_trunc('hour', now());
begin
  if p_name is null or p_name !~ '^[a-z0-9_:-]{1,40}$' then return; end if;
  if not exists (select 1 from public.usage_counts where d = current_date and name = p_name)
     and (select count(*) from public.usage_counts where d = current_date) >= 80 then return; end if;
  insert into public.usage_counts(d, name, n) values (current_date, p_name, 1)
  on conflict (d, name) do update set n = public.usage_counts.n + 1;
  -- hourly: the same cap per hour; the first count of a new hour also clears hours older than 3 days
  if not exists (select 1 from public.usage_hourly where h = v_h) then
    delete from public.usage_hourly where h < now() - interval '3 days';
  end if;
  if not exists (select 1 from public.usage_hourly where h = v_h and name = p_name)
     and (select count(*) from public.usage_hourly where h = v_h) >= 80 then return; end if;
  insert into public.usage_hourly(h, name, n) values (v_h, p_name, 1)
  on conflict (h, name) do update set n = public.usage_hourly.n + 1;
end $$;

revoke all on function public.track_usage(text) from public;
grant execute on function public.track_usage(text) to anon, authenticated;

-- the last 24 hours (24 hour slots, the current hour included), same shape as admin_traffic but per hour
create or replace function public.admin_traffic_hours() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare v_end timestamptz := date_trunc('hour', now());
        v_start timestamptz := date_trunc('hour', now()) - interval '23 hours';
begin
  perform public._require_admin();
  return jsonb_build_object(
    'start', to_char(v_start at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'since', (select to_char(min(u.h) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from public.usage_hourly u),
    'usage', coalesce((select jsonb_agg(jsonb_build_object('h', to_char(u.h at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'name', u.name, 'n', u.n) order by u.h, u.name)
                         from public.usage_hourly u where u.h >= v_start and u.h <= v_end), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('h', to_char(g.h at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                   'n', (select count(*) from auth.users a where date_trunc('hour', a.created_at) = g.h),
                   'p', (select count(*) from auth.users a where date_trunc('hour', a.created_at) = g.h
                           and exists (select 1 from public.profiles p where p.user_id = a.id))) order by g.h)
                 from (select generate_series(v_start, v_end, interval '1 hour') as h) g), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('c', x.c, 's', x.s, 'm', x.m, 'n', x.n, 'pc', x.pc, 'pe', x.pe, 'g', x.g) order by x.n desc, x.c)
                 from (select left(regexp_replace(lower(a.raw_user_meta_data->'ft'->>'c'), '[^a-z0-9._-]', '-', 'g'), 40) as c,
                              left(coalesce(nullif(regexp_replace(lower(coalesce(a.raw_user_meta_data->'ft'->>'s', '')), '[^a-z0-9._-]', '-', 'g'), ''), '?'), 30) as s,
                              left(coalesce(nullif(regexp_replace(lower(coalesce(a.raw_user_meta_data->'ft'->>'m', '')), '[^a-z0-9._-]', '-', 'g'), ''), '?'), 30) as m,
                              count(*) as n,
                              count(*) filter (where exists (select 1 from public.profiles p where p.user_id = a.id and p.role = 'consultant')) as pc,
                              count(*) filter (where exists (select 1 from public.profiles p where p.user_id = a.id and p.role = 'employer')) as pe,
                              count(*) filter (where coalesce(a.raw_user_meta_data->'ft'->>'gc', '') <> '') as g
                         from auth.users a
                        where a.created_at >= v_start
                          and coalesce(a.raw_user_meta_data->'ft'->>'c', '') <> ''
                        group by 1, 2, 3) x), '[]'::jsonb));
end $$;

revoke execute on function public.admin_traffic_hours() from public, anon;
grant execute on function public.admin_traffic_hours() to authenticated;

select 'ok' as release54;
