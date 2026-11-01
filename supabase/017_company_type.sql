-- release34: company type (SAP Customer / SI/Partner / Recruiter)
-- A company says which describes it best (stored in its profile as companyType). Professionals and visitors may see that one value,
-- and only when it is one of the three allowed ones, so nothing else can be passed along through it. No table changes.
create or replace function public._redact_company(co public.companies, as_id text) returns jsonb
language sql immutable as
$$ select public._pick(co.data, array['industry','size','country','sapSystems'])
          || case when co.data->>'companyType' in ('customer','partner','recruiter') then jsonb_build_object('companyType', co.data->>'companyType') else '{}'::jsonb end
          || jsonb_build_object('id', as_id, 'anon', true, '_anon', true, 'name', 'Confidential company', 'sample', co.sample) $$;

create or replace function public._full_company(co public.companies) returns jsonb
language sql stable security definer set search_path = public as
$$ select (case when co.owner is not distinct from auth.uid() and auth.uid() is not null then co.data
                else public._pick(co.data, array['name','about','description','city','country','industry','size','website','sapSystems','contactName','contactTitle','linkedin'])
                     || case when co.data->>'companyType' in ('customer','partner','recruiter') then jsonb_build_object('companyType', co.data->>'companyType') else '{}'::jsonb end end)
          || jsonb_build_object('id', co.id, 'anon', false, 'sample', co.sample) $$;

select 'ok' as release34;
