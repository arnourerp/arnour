-- Release 60: Admin > Import jobs. (1) Check says which roles are already on Arnour. (2) "Close roles that left the career site": paste apply links, see which
-- imported roles they are, close them in one go (nothing is deleted; applicants are told by the usual closing trigger).
-- admin_import_known(p_urls) takes the apply links of the pasted roles and returns the ones the board ("Jobs on Arnour") already has,
-- with the status of that role (open, closed, draft...). It uses exactly the same rule as the import itself (admin_import_external_jobs):
-- lower case, one trailing "/" or "#..." ignored, closed roles count too. Admin only. Changes nothing. Safe to run twice.

create or replace function public.admin_import_known(p_urls jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare cid text := public._board_company();
begin
  perform public._require_admin();
  if jsonb_typeof(p_urls) is distinct from 'array' then raise exception 'Expected a list of links'; end if;
  if jsonb_array_length(p_urls) > 200 then raise exception 'Too many links at once'; end if;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((
    with u as (select distinct regexp_replace(lower(btrim(x)), '(/|#.*)$', '') as n from jsonb_array_elements_text(p_urls) x),
         k as (select regexp_replace(lower(coalesce(j.data->>'applyUrl','')), '(/|#.*)$', '') as n, j.status, j.posted_ts
               from public.jobs j where j.company_id = cid and coalesce(j.data->>'applyUrl','') <> '')
    select jsonb_agg(jsonb_build_object('url', u.n, 'status', (select k.status from k where k.n = u.n order by k.posted_ts desc limit 1)))
    from u where exists (select 1 from k where k.n = u.n)
  ), '[]'::jsonb);
end $$;

-- (2a) read-only preview: which imported (external) roles of the board do these apply links belong to? Same matching rule as above.
create or replace function public.admin_roles_by_links(p_urls jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare cid text := public._board_company();
begin
  perform public._require_admin();
  if jsonb_typeof(p_urls) is distinct from 'array' then raise exception 'Expected a list of links'; end if;
  if jsonb_array_length(p_urls) > 200 then raise exception 'Too many links at once'; end if;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((
    with u as (select distinct regexp_replace(lower(btrim(x)), '(/|#.*)$', '') as n from jsonb_array_elements_text(p_urls) x)
    select jsonb_agg(jsonb_build_object('url', u.n, 'id', j.id, 'title', j.data->>'title', 'extEmployer', j.data->>'extEmployer',
                                        'country', j.data->>'country', 'city', j.data->>'city', 'status', j.status) order by j.posted_ts desc)
    from u join public.jobs j on j.company_id = cid and coalesce((j.data->>'external')::boolean, false)
                              and regexp_replace(lower(coalesce(j.data->>'applyUrl','')), '(/|#.*)$', '') = u.n
  ), '[]'::jsonb);
end $$;

-- (2b) close: every OPEN imported role of the board whose apply link is in the list. Never deletes, never touches roles that companies posted themselves.
-- The usual closing trigger (_job_closed) sets the closing time and tells the applicants. Returns {closed: n, titles: [...]}.
create or replace function public.admin_close_by_links(p_urls jsonb) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare cid text := public._board_company(); n int := 0; titles jsonb := '[]'::jsonb; r record;
begin
  perform public._require_admin();
  if jsonb_typeof(p_urls) is distinct from 'array' then raise exception 'Expected a list of links'; end if;
  if jsonb_array_length(p_urls) > 200 then raise exception 'Too many links at once'; end if;
  if cid is null then return jsonb_build_object('closed', 0, 'titles', titles); end if;
  for r in
    with u as (select distinct regexp_replace(lower(btrim(x)), '(/|#.*)$', '') as n from jsonb_array_elements_text(p_urls) x)
    select j.id, j.data->>'title' as title from public.jobs j join u on regexp_replace(lower(coalesce(j.data->>'applyUrl','')), '(/|#.*)$', '') = u.n
    where j.company_id = cid and j.status = 'open' and coalesce((j.data->>'external')::boolean, false)
  loop
    update public.jobs set status = 'closed', updated_at = now() where id = r.id;
    n := n + 1; titles := titles || to_jsonb(coalesce(r.title, ''));
  end loop;
  perform public._audit('close imported roles', cid, n || ' closed from a list of apply links');
  return jsonb_build_object('closed', n, 'titles', titles);
end $$;

revoke execute on function public.admin_import_known(jsonb), public.admin_roles_by_links(jsonb), public.admin_close_by_links(jsonb) from public, anon;
grant execute on function public.admin_import_known(jsonb), public.admin_roles_by_links(jsonb), public.admin_close_by_links(jsonb) to authenticated;

select 'ok' as release60;
