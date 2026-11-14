-- Arnour release 51: paged search, faster (no change in results).
-- Measured on the live database after release 50: one page of roles took about 100 ms for 174 open roles.
-- Cause: small helper functions written in plain SQL are planned again on every call (once per role), and the
-- "may this owner be shown" check ran once per role although only a handful of owners exist.
-- This release rewrites those helpers so their plans are kept, and checks each owner once per request.
-- Same inputs, same outputs: the tests of release 50 run unchanged against it. Safe to run more than once.

create or replace function public._ms_pub(c public.consultants) returns jsonb
language plpgsql stable security definer set search_path = public as
$$ begin return case when c.anon then public._redact_consultant(c) else c.data end; end $$;

create or replace function public._job_listable(jb public.jobs) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare uid uuid := auth.uid(); ent text;
begin
  if not public._visible(jb.owner, jb.sample) then return false; end if;
  if not (jb.owner is not distinct from uid and uid is not null
          or not (jb.data ? 'expiresTs') or (jb.data->>'expiresTs')::bigint > (extract(epoch from now())*1000)::bigint) then return false; end if;
  if jb.status = 'open' or jb.owner = uid then return true; end if;
  ent := public.my_entity();
  return exists (select 1 from public.applications a where a.job_id = jb.id and a.consultant_id = ent)
      or exists (select 1 from public.invites i where i.job_id = jb.id and i.consultant_id = ent);
end $$;

create or replace function public._job_poster_type(jb public.jobs) returns text
language plpgsql stable security definer set search_path = public as
$$
begin
  if public._js_truthy(jb.data->'external') then
    return case when coalesce(jb.data->>'extSource', '') ~* 'recruit|agency|staffing' then 'recruiter' else '' end;
  end if;
  return coalesce((select co.data->>'companyType' from public.companies co
                    where co.id = jb.company_id and co.data->>'companyType' in ('customer','partner','recruiter')), '');
end $$;

create or replace function public._skill_label(k jsonb) returns text
language plpgsql stable security definer set search_path = public as
$$
declare p text; m text;
begin
  select case when cp.short <> '' then cp.short else cp.name end into p from public.catalog_products cp where cp.id = k->>'productId';
  if k->>'moduleId' = '*' then m := 'Any module';
  else
    select cm.name into m from public.catalog_modules cm where cm.product_id = k->>'productId' and cm.id = k->>'moduleId';
    m := coalesce(m, k->>'moduleId', '');
  end if;
  return coalesce(p, '') || ' ' || m;
end $$;

create or replace function public._job_hay(jb public.jobs) returns text
language plpgsql stable security definer set search_path = public as
$$
declare who text; skills text := ''; r jsonb; first boolean := true; co public.companies; country text;
begin
  if public._js_truthy(jb.data->'external') then who := coalesce(jb.data->>'extEmployer', '');
  else
    select * into co from public.companies where id = jb.company_id;
    who := case when co.id is not null and not public._co_hidden(co, jb) then coalesce(co.data->>'name', '') else '' end;
  end if;
  if jsonb_typeof(jb.data->'requires') = 'array' then
    for r in select e from jsonb_array_elements(jb.data->'requires') with ordinality as t(e, ord) order by ord loop
      skills := skills || case when first then '' else ' ' end || public._skill_label(r); first := false;
    end loop;
  end if;
  select li.name into country from public.list_items li where li.kind = 'country' and li.id = jb.data->>'country';
  return lower(coalesce(jb.data->>'title', '') || ' ' || who || ' ' || skills || ' ' || coalesce(jb.data->>'city', '') || ' ' || coalesce(country, ''));
end $$;

create or replace function public._consultant_seen(c public.consultants) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text;
begin
  if (c.owner is not distinct from uid and uid is not null) or not c.anon then return true; end if;
  r := public.my_role();
  if r = 'employer' then return public.is_revealed(c.id, public.my_entity()); end if;
  if r = 'consultant' then return public._peer_revealed(c.id, public.my_entity()); end if;
  return false;
end $$;

create or replace function public._consultant_listable(c public.consultants) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  return c.owner = uid or public._visible(c.owner, c.sample);
end $$;

create or replace function public._consultant_hay(x jsonb, seen boolean) returns text
language plpgsql stable security definer set search_path = public as
$$
declare roles text := ''; skills text := ''; specs text := ''; rt text; k jsonb; sid text; first boolean; s public.catalog_specs; area text; nm text;
begin
  first := true;
  foreach rt in array public._m_rt_list(x) loop roles := roles || case when first then '' else ' · ' end || public._role_label(rt); first := false; end loop;
  first := true;
  if jsonb_typeof(x->'skills') = 'array' then
    for k in select e from jsonb_array_elements(x->'skills') with ordinality as t(e, ord) order by ord loop
      skills := skills || case when first then '' else ' ' end || public._skill_label(k); first := false;
    end loop;
  end if;
  first := true;
  foreach sid in array public._m_arr(x->'specialties') loop
    s := null; area := null; nm := null;
    select * into s from public.catalog_specs cs where cs.id = sid;
    if s.id is not null then
      select a.name into area from public.catalog_areas a where a.id = s.area_id;
      nm := case when s.short <> '' then s.short else s.name end;
    else
      select a.name into nm from public.catalog_areas a where a.id = sid;
    end if;
    specs := specs || case when first then '' else ' ' end || coalesce(nm, sid) || ' ' || coalesce(s.name, '') || ' ' || coalesce(area, ''); first := false;
  end loop;
  return lower(public._consultant_name(x, seen) || ' ' || public._consultant_headline(x, seen) || ' ' ||
               case when seen then coalesce(x->>'summary', '') else '' end || ' ' || roles || ' ' || skills || ' ' ||
               public._tag_join(x->'otherSkills') || ' ' || public._tag_join(x->'otherTools') || ' ' || specs);
end $$;

-- one page of roles: each owner is checked once, not once per role
create or replace function public.list_jobs_page(p_f jsonb default '{}'::jsonb, p_sort text default 'match', p_limit int default 20, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); ent text := public.my_entity(); r text := public.my_role();
        lim int := greatest(1, least(coalesce(p_limit, 20), 50)); off int := greatest(0, coalesce(p_offset, 0));
        now_ms bigint := (extract(epoch from now())*1000)::bigint;
        by_match boolean; no_f boolean := p_f is null or p_f = '{}'::jsonb; total int; rows jsonb;
begin
  by_match := coalesce(p_sort, 'match') <> 'newest' and uid is not null and r = 'consultant' and ent is not null;
  if by_match and exists (select 1 from public.match_scores_dirty where kind = 'c' and id = ent) then
    perform public._ms_rescore_c(ent);
  end if;
  with owners as materialized (
    select o.owner, o.sample, public._visible(o.owner, o.sample) as ok
      from (select distinct j.owner, j.sample from public.jobs j where j.status = 'open') o
  ), base as materialized (
    select j as jb, coalesce(s.score, -1) as sc
      from public.jobs j
      join owners o on o.owner is not distinct from j.owner and o.sample = j.sample and o.ok
      left join public.match_scores s on by_match and s.job_id = j.id and s.consultant_id = ent
     where j.status = 'open'
       and ((j.owner is not distinct from uid and uid is not null) or not (j.data ? 'expiresTs') or (j.data->>'expiresTs')::bigint > now_ms)
       and (no_f or public._job_passes(j, p_f))
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

-- one page of professionals: each owner is checked once
create or replace function public.search_consultants(p_f jsonb default '{}'::jsonb, p_sort text default 'best', p_limit int default 20, p_offset int default 0, p_job text default null)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); lim int := greatest(1, least(coalesce(p_limit, 20), 50)); off int := greatest(0, coalesce(p_offset, 0));
        mode text := case when p_sort in ('years', 'active') then p_sort else 'best' end;
        by_job boolean := false; min_sc double precision; excl text[]; no_f boolean; total int; rows jsonb;
begin
  if uid is null then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'sort', mode, 'limit', lim, 'offset', off); end if;
  if p_job is not null and exists (select 1 from public.jobs j where j.id = p_job and j.owner = uid) then
    by_job := true;
    if exists (select 1 from public.match_scores_dirty where kind = 'j' and id = p_job) then perform public._ms_rescore_j(p_job); end if;
  end if;
  min_sc := case when by_job then public._js_num(p_f->'minScore') end;
  excl := coalesce(public._m_arr(p_f->'exclude'), '{}'::text[]);
  no_f := p_f is null or (p_f - 'minScore' - 'exclude') = '{}'::jsonb;
  with owners as materialized (
    select o.owner, o.sample, public._visible(o.owner, o.sample) as ok
      from (select distinct c.owner, c.sample from public.consultants c) o
  ), vis as materialized (
    select c.id, public._consultant_row(c) as x, public._consultant_seen(c) as seen
      from public.consultants c
      join owners o on o.owner is not distinct from c.owner and o.sample = c.sample
     where (o.ok or c.owner = uid) and not (c.id = any(excl))
  ), base as materialized (
    select v.id, v.x, case when v.seen then s.score else s.score_pub end as sc,
           case when mode = 'years' then coalesce(public._js_num(v.x->'yearsExp'), 0)
                when mode = 'active' then -public._consultant_idle(v.x)
                when by_job then coalesce(case when v.seen then s.score else s.score_pub end, -1)::double precision
                else public._consultant_rel(v.x, v.seen, p_f) end as k
      from vis v
      left join public.match_scores s on by_job and s.consultant_id = v.id and s.job_id = p_job
     where (no_f or public._consultant_passes(v.x, v.seen, p_f))
       and (min_sc is null or coalesce(case when v.seen then s.score else s.score_pub end, -1) >= min_sc)
  ), page as (
    select * from base order by k desc, id limit lim offset off
  )
  select (select count(*) from base),
         coalesce((select jsonb_agg(p.x || case when by_job and p.sc is not null then jsonb_build_object('ms', p.sc) else '{}'::jsonb end order by p.k desc, p.id) from page p), '[]'::jsonb)
    into total, rows;
  return jsonb_build_object('total', total, 'rows', rows, 'sort', mode, 'limit', lim, 'offset', off);
end $$;

revoke execute on function public._ms_pub(public.consultants), public._job_listable(public.jobs), public._job_poster_type(public.jobs), public._skill_label(jsonb),
  public._job_hay(public.jobs), public._consultant_seen(public.consultants), public._consultant_listable(public.consultants), public._consultant_hay(jsonb, boolean)
  from public, anon, authenticated;
revoke execute on function public.list_jobs_page(jsonb, text, int, int) from public;
grant execute on function public.list_jobs_page(jsonb, text, int, int) to anon, authenticated;
revoke execute on function public.search_consultants(jsonb, text, int, int, text) from public, anon;
grant execute on function public.search_consultants(jsonb, text, int, int, text) to authenticated;

select 'ok' as release51;
