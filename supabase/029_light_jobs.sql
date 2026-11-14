-- Arnour release 49: light job list (Stage A of paged search).
-- Until now every browser downloaded every open role with its full description at start-up
-- (about 438 KB for 174 roles, 312 KB of it description text that the cards never show).
--
-- 1. list_jobs_light(): the same roles, with the same visibility rules, as list_jobs(), but the description
--    is left out for roles that are not the caller's own; "descN" says how long it is (0 = none).
--    The owner still gets the complete role, because the site saves an edited role as a whole.
-- 2. get_job_text(id): the description of one role the caller may see (fetched when the role is opened).
-- 3. list_job_texts(): all descriptions the caller may see, as {id: text} (fetched only when the person uses Search,
--    so search still finds words that appear only in a description).
-- All three read through list_jobs(), so they can never show a role that list_jobs() would not.
-- list_jobs() itself is unchanged (job pages for search engines, the sitemap and older browser tabs keep using it).
-- Safe to run more than once.

create or replace function public.list_jobs_light() returns setof jsonb
language sql stable security definer set search_path = public as
$$
  select case when coalesce((x->>'mine')::boolean, false) then x
              else (x - 'description') || jsonb_build_object('descN', length(coalesce(x->>'description', ''))) end
    from public.list_jobs() x
$$;

create or replace function public.get_job_text(p_id text) returns text
language sql stable security definer set search_path = public as
$$
  select x->>'description' from public.list_jobs() x where x->>'id' = p_id limit 1
$$;

create or replace function public.list_job_texts() returns jsonb
language sql stable security definer set search_path = public as
$$
  select coalesce(jsonb_object_agg(x->>'id', x->>'description'), '{}'::jsonb)
    from public.list_jobs() x
   where coalesce(x->>'description', '') <> ''
$$;

revoke execute on function public.list_jobs_light(), public.get_job_text(text), public.list_job_texts() from public;
grant execute on function public.list_jobs_light(), public.get_job_text(text), public.list_job_texts() to anon, authenticated;

select 'ok' as release49;
