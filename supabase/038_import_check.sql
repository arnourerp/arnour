-- Release 58: Admin > Import jobs > Check says which roles are already on Arnour.
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

revoke execute on function public.admin_import_known(jsonb) from public, anon;
grant execute on function public.admin_import_known(jsonb) to authenticated;

select 'ok' as release58;
