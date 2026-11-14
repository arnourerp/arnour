-- Arnour release 50: paged role search (Stage B of paged search, part 1: roles).
--
-- Why: every browser still downloads every open role card and sorts them itself. That is fine for a few hundred
-- roles, not for thousands. Sorting by match on the server cannot be done per request: match_score() takes about
-- 0.9 ms for one professional and one role, so a page for one professional over 1,000 roles would take about a second.
--
-- What this adds (nothing existing is changed; list_jobs() and list_jobs_light() stay as they are):
--  1. match_scores: one stored score per professional and open role, kept up to date by triggers and a worker
--     (every minute by pg_cron, and at once for the caller's own profile when they ask for a page).
--  2. _job_listable / _job_row: the same visibility rules and the same row as list_jobs(), for one role.
--  3. list_jobs_page(filters, sort, limit, offset): one page of open roles (light rows: no description),
--     with the same filters as the site's filter panel, sorted by stored match or by newest, plus the total.
--  4. get_jobs(ids): light rows for specific roles the caller may see (deep links, notifications).
--  5. my_jobs_bundle(): what a signed-in person needs at start-up without the full list: their own roles, the roles
--     they applied to, were invited to or saved, and the counts the pages show.
-- Safe to run more than once.

-- ---------- 1. stored scores ----------------------------------------------------------------------------------
create table if not exists public.match_scores (
  consultant_id text not null references public.consultants(id) on delete cascade,
  job_id        text not null references public.jobs(id) on delete cascade,
  score         int  not null,
  primary key (consultant_id, job_id)
);
create index if not exists match_scores_c_idx on public.match_scores (consultant_id, score desc);
create index if not exists match_scores_j_idx on public.match_scores (job_id, score desc);
alter table public.match_scores enable row level security;   -- no policies: only the functions below read or write it

create table if not exists public.match_scores_dirty (       -- professionals ('c') and roles ('j') whose scores must be rebuilt
  kind text not null check (kind in ('c','j')),
  id   text not null,
  ts   timestamptz not null default now(),
  primary key (kind, id)
);
alter table public.match_scores_dirty enable row level security;

create or replace function public._ms_job_changed() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' or new.data is distinct from old.data or new.status is distinct from old.status then
    insert into public.match_scores_dirty(kind, id) values ('j', new.id) on conflict (kind, id) do update set ts = now();
  end if;
  return null;
end $$;
drop trigger if exists jobs_ms_dirty on public.jobs;
create trigger jobs_ms_dirty after insert or update on public.jobs for each row execute function public._ms_job_changed();

create or replace function public._ms_consultant_changed() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' or new.data is distinct from old.data then
    insert into public.match_scores_dirty(kind, id) values ('c', new.id) on conflict (kind, id) do update set ts = now();
  end if;
  return null;
end $$;
drop trigger if exists consultants_ms_dirty on public.consultants;
create trigger consultants_ms_dirty after insert or update on public.consultants for each row execute function public._ms_consultant_changed();

-- rebuild the scores of one professional against every open role
create or replace function public._ms_rescore_c(p_id text) returns void
language plpgsql security definer set search_path = public as
$$
declare c jsonb;
begin
  select data into c from public.consultants where id = p_id;
  delete from public.match_scores where consultant_id = p_id;
  if c is not null then
    insert into public.match_scores(consultant_id, job_id, score)
      select p_id, j.id, public.match_score(c, j.data) from public.jobs j where j.status = 'open';
  end if;
  delete from public.match_scores_dirty where kind = 'c' and id = p_id;
end $$;

-- rebuild the scores of one role against every professional (a role that is not open has no scores)
create or replace function public._ms_rescore_j(p_id text) returns void
language plpgsql security definer set search_path = public as
$$
declare j jsonb; st text;
begin
  select data, status into j, st from public.jobs where id = p_id;
  delete from public.match_scores where job_id = p_id;
  if j is not null and st = 'open' then
    insert into public.match_scores(consultant_id, job_id, score)
      select c.id, p_id, public.match_score(c.data, j) from public.consultants c;
  end if;
  delete from public.match_scores_dirty where kind = 'j' and id = p_id;
end $$;

-- the worker: oldest first, a limited number per run, one run at a time
create or replace function public.match_scores_run(p_max int default 40) returns int
language plpgsql security definer set search_path = public as
$$
declare r record; n int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('arnour-match-scores')) then return 0; end if;
  for r in select kind, id from public.match_scores_dirty order by ts limit greatest(1, least(coalesce(p_max, 40), 500)) loop
    if r.kind = 'c' then perform public._ms_rescore_c(r.id); else perform public._ms_rescore_j(r.id); end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.match_scores_run(int), public._ms_rescore_c(text), public._ms_rescore_j(text) from public, anon, authenticated;

-- first fill: every professional against every open role that has no score yet
insert into public.match_scores(consultant_id, job_id, score)
  select c.id, j.id, public.match_score(c.data, j.data)
    from public.consultants c cross join public.jobs j
   where j.status = 'open'
     and not exists (select 1 from public.match_scores s where s.consultant_id = c.id and s.job_id = j.id)
on conflict do nothing;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'arnour-match-scores';
    perform cron.schedule('arnour-match-scores', '* * * * *', 'select public.match_scores_run()');
  end if;
end $$;

-- ---------- 2. one role, as list_jobs() shows it ---------------------------------------------------------------
-- may the caller see this role at all? (same rule as the WHERE of list_jobs)
create or replace function public._job_listable(jb public.jobs) returns boolean
language sql stable security definer set search_path = public as
$$
  select public._visible(jb.owner, jb.sample)
     and (jb.owner is not distinct from auth.uid() and auth.uid() is not null
          or not (jb.data ? 'expiresTs') or (jb.data->>'expiresTs')::bigint > (extract(epoch from now())*1000)::bigint)
     and (jb.status = 'open' or jb.owner = auth.uid()
          or exists (select 1 from public.applications a where a.job_id = jb.id and a.consultant_id = public.my_entity())
          or exists (select 1 from public.invites i where i.job_id = jb.id and i.consultant_id = public.my_entity()))
$$;

-- the row the caller receives for this role (same as the loop body of list_jobs); p_light leaves the description out
-- for roles that are not the caller's own, exactly as list_jobs_light() does
create or replace function public._job_row(jb public.jobs, p_light boolean default true) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies; out_co text; d jsonb; mine boolean; x jsonb;
begin
  select * into co from public.companies where id = jb.company_id;
  if public._co_hidden(co, jb) then
    out_co := case when jb.confidential is true then jb.alias else co.alias end;
  else out_co := jb.company_id; end if;
  d := jb.data;
  if auth.uid() is null then d := d - 'applyUrl'; end if;
  if jb.owner is distinct from auth.uid() or auth.uid() is null then d := d - array['rateMin','rateMax','currency','ratePeriod']; end if;
  mine := jb.owner is not distinct from auth.uid() and auth.uid() is not null;
  x := d || jsonb_build_object('id', jb.id, 'companyId', out_co, 'status', jb.status,
            'postedTs', jb.posted_ts, 'confidential', jb.confidential, 'sample', jb.sample, 'mine', mine);
  if p_light and not mine then
    x := (x - 'description') || jsonb_build_object('descN', length(coalesce(x->>'description', '')));
  end if;
  return x;
end $$;
revoke execute on function public._job_listable(public.jobs), public._job_row(public.jobs, boolean) from public, anon, authenticated;

-- ---------- 3. one page of open roles --------------------------------------------------------------------------
-- JavaScript "truthy" for a JSON value (the site's filters test values that way)
create or replace function public._js_truthy(v jsonb) returns boolean
language sql immutable as
$$
  select case jsonb_typeof(v)
           when 'boolean' then v = 'true'::jsonb
           when 'string'  then length(v #>> '{}') > 0
           when 'number'  then (v #>> '{}')::double precision <> 0
           when 'object'  then true
           when 'array'   then true
           else false end
$$;

-- who is hiring: 'recruiter', 'partner', 'customer' or '' (same rule as APP.jobPosterType)
create or replace function public._job_poster_type(jb public.jobs) returns text
language sql stable security definer set search_path = public as
$$
  select case
    when public._js_truthy(jb.data->'external')
      then case when coalesce(jb.data->>'extSource', '') ~* 'recruit|agency|staffing' then 'recruiter' else '' end
    else coalesce((select co.data->>'companyType' from public.companies co
                    where co.id = jb.company_id and co.data->>'companyType' in ('customer','partner','recruiter')), '')
  end
$$;

-- the text the keyword box searches (same parts as the site: title, employer, skills, city, country)
create or replace function public._job_hay(jb public.jobs) returns text
language sql stable security definer set search_path = public as
$$
  select lower(
    coalesce(jb.data->>'title', '') || ' ' ||
    case when public._js_truthy(jb.data->'external') then coalesce(jb.data->>'extEmployer', '')
         else coalesce((select co.data->>'name' from public.companies co where co.id = jb.company_id and not public._co_hidden(co, jb)), '') end || ' ' ||
    coalesce((select string_agg(
                coalesce((select case when p.short <> '' then p.short else p.name end from public.catalog_products p where p.id = r->>'productId'), '') || ' ' ||
                case when r->>'moduleId' = '*' then 'Any module'
                     else coalesce((select m.name from public.catalog_modules m where m.product_id = r->>'productId' and m.id = r->>'moduleId'), r->>'moduleId', '') end,
                ' ' order by ord)
              from jsonb_array_elements(case when jsonb_typeof(jb.data->'requires') = 'array' then jb.data->'requires' else '[]'::jsonb end) with ordinality as t(r, ord)), '') || ' ' ||
    coalesce(jb.data->>'city', '') || ' ' ||
    coalesce((select li.name from public.list_items li where li.kind = 'country' and li.id = jb.data->>'country'), ''))
$$;

-- does the role pass the filter panel? p_f uses the same names as the site's filter state
create or replace function public._job_passes(jb public.jobs, p_f jsonb) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare d jsonb := jb.data; req jsonb; w text; hay text; inds text[]; f_inds text[];
begin
  if p_f is null or p_f = '{}'::jsonb then return true; end if;
  req := case when jsonb_typeof(d->'requires') = 'array' then d->'requires' else '[]'::jsonb end;
  if jsonb_typeof(p_f->'types') = 'array' and jsonb_array_length(p_f->'types') > 0
     and not (p_f->'types') ? coalesce(d->>'employmentType', '') then return false; end if;
  if coalesce(p_f->>'region', '') not in ('', 'all')
     and not exists (select 1 from public.list_items li where li.kind = 'country' and li.id = d->>'country' and li.parent = p_f->>'region') then return false; end if;
  if coalesce(p_f->>'roleType', '') <> '' and public._m_job_rt(d) is distinct from p_f->>'roleType' then return false; end if;
  if coalesce(p_f->>'product', '') <> ''
     and not exists (select 1 from jsonb_array_elements(req) r where r->>'productId' = p_f->>'product') then return false; end if;
  if coalesce(p_f->>'module', '') <> ''
     and not exists (select 1 from jsonb_array_elements(req) r where r->>'productId' = p_f->>'product' and r->>'moduleId' in (p_f->>'module', '*')) then return false; end if;
  if coalesce(p_f->>'country', '') <> '' and d->>'country' is distinct from p_f->>'country' then return false; end if;
  if jsonb_typeof(p_f->'levels') = 'array' and jsonb_array_length(p_f->'levels') > 0
     and public._js_truthy(d->'level') and not (p_f->'levels') ? (d->>'level') then return false; end if;
  if p_f->>'workMode' = 'remote' and not public._js_truthy(d->'remote') then return false; end if;
  if p_f->>'workMode' = 'onsite' and public._js_truthy(d->'remote') then return false; end if;
  if jsonb_typeof(p_f->'industries') = 'array' and jsonb_array_length(p_f->'industries') > 0 then
    if jsonb_typeof(d->'industries') = 'array' and jsonb_array_length(d->'industries') > 0 then inds := public._m_arr(d->'industries');
    elsif public._js_truthy(d->'industry') then inds := array[d->>'industry'];
    else inds := '{}'; end if;
    f_inds := public._m_arr(p_f->'industries');
    if not (inds && f_inds) then return false; end if;
  end if;
  if p_f->>'cert' = 'none' then
    if public._js_truthy(d->'certification') then return false; end if;
  elsif coalesce(p_f->>'cert', '') <> '' and d->>'certification' is distinct from p_f->>'cert' then return false; end if;
  if coalesce(p_f->>'lang', '') <> ''
     and not (coalesce(d->'languages', '[]'::jsonb) ? (p_f->>'lang') or coalesce(d->'preferredLangs', '[]'::jsonb) ? (p_f->>'lang')) then return false; end if;
  if coalesce(p_f->>'posted', '') ~ '^[0-9]+(\.[0-9]+)?$' and (p_f->>'posted')::double precision > 0
     and (extract(epoch from now())*1000) - jb.posted_ts > (p_f->>'posted')::double precision * 86400000 then return false; end if;
  if public._js_truthy(p_f->'direct') and public._job_poster_type(jb) in ('partner', 'recruiter') then return false; end if;
  if coalesce(p_f->>'q', '') <> '' then
    hay := public._job_hay(jb);
    foreach w in array regexp_split_to_array(lower(p_f->>'q'), '\s+') loop
      if w <> '' and position(w in hay) = 0 then return false; end if;
    end loop;
  end if;
  return true;
end $$;
revoke execute on function public._job_poster_type(public.jobs), public._job_hay(public.jobs), public._job_passes(public.jobs, jsonb) from public, anon, authenticated;

-- One page. p_sort: 'match' (best stored match first; only for a signed-in professional) or 'newest'.
-- Returns {total, rows, sort, limit, offset}; rows are light (as list_jobs_light) with the stored score in "ms" when there is one.
create or replace function public.list_jobs_page(p_f jsonb default '{}'::jsonb, p_sort text default 'match', p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare ent text := public.my_entity(); r text := public.my_role();
        lim int := greatest(1, least(coalesce(p_limit, 20), 50)); off int := greatest(0, coalesce(p_offset, 0));
        by_match boolean; total int; rows jsonb;
begin
  by_match := coalesce(p_sort, 'match') <> 'newest' and auth.uid() is not null and r = 'consultant' and ent is not null;
  -- the caller's own profile changed a moment ago: bring their scores up to date first, so the order is right
  if by_match and exists (select 1 from public.match_scores_dirty where kind = 'c' and id = ent) then
    perform public._ms_rescore_c(ent);
  end if;
  with base as (
    select j as jb, coalesce(s.score, -1) as sc
      from public.jobs j
      left join public.match_scores s on by_match and s.job_id = j.id and s.consultant_id = ent
     where j.status = 'open' and public._job_listable(j) and public._job_passes(j, p_f)
  ), page as (
    select jb, sc from base
     order by case when by_match then sc end desc nulls last, (jb).posted_ts desc, (jb).id
     limit lim offset off
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(public._job_row(p.jb, true) || case when by_match and p.sc >= 0 then jsonb_build_object('ms', p.sc) else '{}'::jsonb end
                                    order by case when by_match then p.sc end desc nulls last, (p.jb).posted_ts desc, (p.jb).id) from page p), '[]'::jsonb)
    into total, rows;
  return jsonb_build_object('total', total, 'rows', rows, 'sort', case when by_match then 'match' else 'newest' end, 'limit', lim, 'offset', off);
end $$;

-- ---------- 4. specific roles ----------------------------------------------------------------------------------
create or replace function public.get_jobs(p_ids text[]) returns setof jsonb
language sql stable security definer set search_path = public as
$$
  select public._job_row(j, true) from public.jobs j
   where j.id = any((coalesce(p_ids, '{}'::text[]))[1:50]) and public._job_listable(j)
$$;

-- ---------- 5. start-up bundle for a signed-in person ----------------------------------------------------------
-- {jobs: [...], open: N, strong: N}
--   jobs   = my own roles (complete), and the roles I applied to, was invited to, saved, or have a conversation or introduction about
--   open   = open roles I can see
--   strong = for a professional: open roles with a stored match of 75 or more
create or replace function public.my_jobs_bundle() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare ent text := public.my_entity(); r text := public.my_role(); saved text[] := '{}'; res jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('jobs', '[]'::jsonb, 'open', (select count(*) from public.jobs j where j.status = 'open' and public._job_listable(j)), 'strong', 0);
  end if;
  if r = 'consultant' and ent is not null then
    select public._m_arr(c.data->'savedJobIds') into saved from public.consultants c where c.id = ent;
  end if;
  select jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(public._job_row(j, true)) from public.jobs j
              where public._job_listable(j) and (
                    j.owner = auth.uid()
                 or exists (select 1 from public.applications a where a.job_id = j.id and a.consultant_id = ent)
                 or exists (select 1 from public.invites i where i.job_id = j.id and i.consultant_id = ent)
                 or j.id = any(coalesce(saved, '{}'::text[]))
                 or exists (select 1 from public.conversations v where v.job_id = j.id and (v.c_id = ent or v.e_id = ent))
                 or exists (select 1 from public.intros x where x.job_id = j.id and (x.cid = ent or x.eid = ent)))), '[]'::jsonb),
    'open', (select count(*) from public.jobs j where j.status = 'open' and public._job_listable(j)),
    'strong', case when r = 'consultant' and ent is not null
                   then (select count(*) from public.match_scores s join public.jobs j on j.id = s.job_id
                          where s.consultant_id = ent and s.score >= 75 and j.status = 'open' and public._job_listable(j))
                   else 0 end
  ) into res;
  return res;
end $$;

revoke execute on function public.list_jobs_page(jsonb, text, int, int), public.get_jobs(text[]), public.my_jobs_bundle() from public;
revoke execute on function public.my_jobs_bundle() from anon;
grant execute on function public.list_jobs_page(jsonb, text, int, int), public.get_jobs(text[]) to anon, authenticated;
grant execute on function public.my_jobs_bundle() to authenticated;

select 'ok' as release50;
