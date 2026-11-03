-- Release 41: traffic numbers for the admin.
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- 1. The Dashboard's "Sign-ups, last 14 days" chart can now split each day into
--    accounts WITH a profile and accounts with NO profile yet.
-- 2. New function admin_traffic(days): the anonymous usage counters for the last 7 / 14 / 30 days
--    plus sign-ups per day (and how many of them have a profile), for the new Traffic tab.

-- 1. Dashboard numbers (same as before, plus 'p' = accounts with a profile in each day's bar)
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare ms bigint := (extract(epoch from now())*1000)::bigint; wk bigint; res jsonb;
begin
  perform public._require_admin();
  wk := ms - 7*86400000;
  select jsonb_build_object(
    'professionals', (select count(*) from public.profiles where role = 'consultant'),
    'companies',     (select count(*) from public.profiles where role = 'employer'),
    'signups7',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups30',     (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'noProfile',     (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id)),
    'openRoles',     (select count(*) from public.jobs where status = 'open' and not sample),
    'applications7', (select count(*) from public.applications where ts > wk),
    'conversations', (select count(*) from public.conversations),
    'messages7',     (select count(*) from public.messages where ts > wk),
    'posts7',        (select count(*) from public.questions where created_ts > wk and not sample)
                   + (select count(*) from public.answers where created_ts > wk and not sample)
                   + (select count(*) from public.articles where created_ts > wk and not sample)
                   + (select count(*) from public.article_comments where created_ts > wk and not sample),
    'openReports',   (select count(*) from public.reports where status = 'open'),
    'suspended',     (select count(*) from public.profiles where suspended),
    'selfCertified', (select count(*) from public.consultants c where not c.sample and not c.cert_revoked
                       and exists (select 1 from jsonb_array_elements(coalesce(c.data->'skills','[]'::jsonb)) k where k->>'certified' = 'true')),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d,'YYYY-MM-DD'),
                 'n', (select count(*) from auth.users u where u.created_at::date = g.d),
                 'p', (select count(*) from auth.users u where u.created_at::date = g.d
                         and exists (select 1 from public.profiles p where p.user_id = u.id))) order by g.d), '[]'::jsonb)
               from (select generate_series((now() - interval '13 days')::date, now()::date, interval '1 day')::date as d) g)
  ) into res;
  return res;
end $$;

-- 2. Traffic: raw anonymous counters for the last N days (the page adds them up) + sign-ups per day
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
                 from (select generate_series((current_date - (v_days - 1))::date, current_date, interval '1 day')::date as d) g), '[]'::jsonb));
end $$;

revoke execute on function public.admin_traffic(int) from public, anon;
grant execute on function public.admin_traffic(int) to authenticated;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

select 'ok' as release41;
