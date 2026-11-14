-- Arnour release 52: paged role search gets a "company" filter (the open roles shown on one company's page).
-- The filter is compared with the company id the caller sees, so a confidential role is never listed under its real company.
-- Nothing else changes. Safe to run more than once.

create or replace function public._job_passes(jb public.jobs, p_f jsonb) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare d jsonb := jb.data; req jsonb; w text; hay text; inds text[]; f_inds text[]; co public.companies;
begin
  if p_f is null or p_f = '{}'::jsonb then return true; end if;
  -- the roles of one company page: compared with the id the caller sees (a confidential role answers only to its own alias)
  if coalesce(p_f->>'company', '') <> '' then
    select * into co from public.companies where id = jb.company_id;
    if (case when public._co_hidden(co, jb) then case when jb.confidential is true then jb.alias else co.alias end else jb.company_id end) is distinct from p_f->>'company' then return false; end if;
  end if;
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
revoke execute on function public._job_passes(public.jobs, jsonb) from public, anon, authenticated;

select 'ok' as release52;
