-- release38: profile photos (professionals) and logos (companies)
-- The picture is a small file in the public "avatars" bucket (browser makes it 256 px, max 150 KB). The profile stores only its path
-- (consultants: data.photo, companies: data.logo). The path is part of what others may see, so:
--   * an anonymous professional's photo and a confidential company's logo are left out until the introduction is accepted
--     (same rule that already hides the name), and
--   * a path is only kept when it points into the owner's own folder, so nobody can store another address in these fields.
-- File names are random, so a picture cannot be found without being shown the path.

do $storage$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 153600, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists "avatar upload own" on storage.objects;
    create policy "avatar upload own" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "avatar list own" on storage.objects;
    create policy "avatar list own" on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "avatar delete own" on storage.objects;
    create policy "avatar delete own" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end
$storage$;

-- keep the path only if it is a picture inside the owner's own folder
create or replace function public._clean_picture() returns trigger
language plpgsql as
$$
declare k text := case tg_table_name when 'consultants' then 'photo' else 'logo' end; v text;
begin
  if new.data ? k then
    v := new.data->>k;
    if v is null or new.owner is null or v !~ ('^' || new.owner::text || '/[a-z0-9]{8,40}\.(jpg|png|webp)$') then
      new.data := new.data - k;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists consultants_clean_picture on public.consultants;
create trigger consultants_clean_picture before insert or update on public.consultants for each row execute function public._clean_picture();
drop trigger if exists companies_clean_picture on public.companies;
create trigger companies_clean_picture before insert or update on public.companies for each row execute function public._clean_picture();

-- professionals: the photo is public like the name, and goes with it when the profile is anonymous
create or replace function public._consultant_public_keys() returns text[]
language sql immutable as
$$ select array['firstName','lastName','headline','summary','city','country','nationality','availability',
               'industries','languages','level','linkedin','otherSkills','photo','programs','roleType','roleTypes','skills','specialties','workPrefs','yearsExp'] $$;

create or replace function public._redact_consultant(c public.consultants) returns jsonb
language sql immutable as
$$ select public._pick(c.data, public._consultant_public_keys()) - array['firstName','lastName','city','nationality','summary','linkedin','photo']
          || jsonb_build_object('id', c.id, 'anon', true, 'firstName', '', 'lastName', '', 'sample', c.sample, 'certRevoked', c.cert_revoked) $$;

-- companies: the logo goes with the name (a confidential company shows no logo)
create or replace function public._full_company(co public.companies) returns jsonb
language sql stable security definer set search_path = public as
$$ select (case when co.owner is not distinct from auth.uid() and auth.uid() is not null then co.data
                else public._pick(co.data, array['name','about','description','city','country','industry','size','website','sapSystems','contactName','contactTitle','linkedin','logo'])
                     || case when co.data->>'companyType' in ('customer','partner','recruiter') then jsonb_build_object('companyType', co.data->>'companyType') else '{}'::jsonb end end)
          || jsonb_build_object('id', co.id, 'anon', false, 'sample', co.sample) $$;

create or replace function public._partner_card(co public.companies, p_named boolean) returns jsonb
language sql stable security definer set search_path = public as
$$ select (case when p_named then
          public._pick(co.data, array['name','about','country','city','industry','size','website','linkedin','logo'])
          || jsonb_build_object('id', co.id, 'anon', false, 'partner', co.data->'partner')
        else
          public._pick(co.data, array['country','size'])
          || jsonb_build_object('id', co.alias, 'anon', true, '_anon', true, 'name', 'Confidential SI/Partner', 'partner', (co.data->'partner') - 'bestAt')
        end) || jsonb_build_object('companyType', 'partner', 'sample', co.sample) $$;

select 'ok' as release38;
