-- Arnour release 53: per-campaign numbers in Admin > Traffic.
-- admin_traffic() now also returns "campaigns": for accounts created in the period, how many came from each campaign
-- (the utm_campaign of the first link that brought the person, saved with the account at sign-up), and how many of
-- them finished a professional or a company profile. Visitors per campaign come from the anonymous counters
-- ("lc:<campaign>", counted once per new browser by the site), which need no change here.
-- Only the admin can call it, as before. Safe to run more than once.

create or replace function public.admin_traffic(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare v_days int := greatest(1, least(coalesce(p_days, 14), 90));
begin
  perform public._require_admin();
  return jsonb_build_object(
    'days', v_days,
    'usage', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(u.d,'YYYY-MM-DD'), 'name', u.name, 'n', u.n) order by u.d, u.name)
                         from public.usage_counts u where u.d > current_date - v_days), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(g.d,'YYYY-MM-DD'),
                   'n', (select count(*) from auth.users a where a.created_at::date = g.d),
                   'p', (select count(*) from auth.users a where a.created_at::date = g.d
                           and exists (select 1 from public.profiles p where p.user_id = a.id))) order by g.d)
                 from (select generate_series((current_date - (v_days - 1))::date, current_date, interval '1 day')::date as d) g), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(jsonb_build_object('c', x.c, 's', x.s, 'm', x.m, 'n', x.n, 'pc', x.pc, 'pe', x.pe, 'g', x.g) order by x.n desc, x.c)
                 from (select left(regexp_replace(lower(a.raw_user_meta_data->'ft'->>'c'), '[^a-z0-9._-]', '-', 'g'), 40) as c,
                              left(coalesce(nullif(regexp_replace(lower(coalesce(a.raw_user_meta_data->'ft'->>'s', '')), '[^a-z0-9._-]', '-', 'g'), ''), '?'), 30) as s,
                              left(coalesce(nullif(regexp_replace(lower(coalesce(a.raw_user_meta_data->'ft'->>'m', '')), '[^a-z0-9._-]', '-', 'g'), ''), '?'), 30) as m,
                              count(*) as n,
                              count(*) filter (where exists (select 1 from public.profiles p where p.user_id = a.id and p.role = 'consultant')) as pc,
                              count(*) filter (where exists (select 1 from public.profiles p where p.user_id = a.id and p.role = 'employer')) as pe,
                              count(*) filter (where coalesce(a.raw_user_meta_data->'ft'->>'gc', '') <> '') as g
                         from auth.users a
                        where a.created_at::date > current_date - v_days
                          and coalesce(a.raw_user_meta_data->'ft'->>'c', '') <> ''
                        group by 1, 2, 3) x), '[]'::jsonb));
end $$;

revoke execute on function public.admin_traffic(int) from public, anon;
grant execute on function public.admin_traffic(int) to authenticated;

select 'ok' as release53;
