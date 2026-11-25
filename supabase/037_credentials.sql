-- Release 57: certifications. A professional pastes the public link of a Credly badge; the Netlify function cred-verify asks Credly and saves
-- the result here, using the same secret as the Job feed daily check (FEED_WORKER_SECRET). Nobody can write a "verified" badge from the browser.
-- What other people see of a badge: only its title, issuer, kind and dates (inside the profile, key `creds`). Never the Credly link, the Credly id
-- or the name on the badge. The owner also gets the Credly link and whether the name on the badge matches the profile (my_credentials()).
-- Expired badges stay (the page shows "Expired"); a badge that Credly reports as revoked is not saved.
-- Safe to run twice.

create table if not exists public.credentials (
  id            uuid primary key default gen_random_uuid(),
  consultant_id text not null references public.consultants(id) on delete cascade,
  provider      text not null default 'credly' check (provider = 'credly'),
  ext_id        text not null,                         -- the badge id at Credly (a uuid)
  title         text not null,
  issuer        text not null default '',
  kind          text not null default '',
  issued        date,
  expires       date,
  image         text not null default '',              -- the badge picture, only ever a https://images.credly.com/ link
  name_ok       boolean,                               -- does the name on the badge match the profile name? (null = could not be told)
  checked_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (provider, ext_id)
);
create index if not exists credentials_cid_idx on public.credentials (consultant_id);
create table if not exists public.credential_checks (   -- one row per check, only to limit use
  id      bigserial primary key,
  user_id uuid not null,
  ts      timestamptz not null default now()
);
create index if not exists credential_checks_ts_idx on public.credential_checks (user_id, ts);
alter table public.credentials       enable row level security;
alter table public.credential_checks enable row level security;
revoke all on public.credentials, public.credential_checks from public, anon, authenticated;   -- no policies: only the functions below

-- only the Netlify function knows the secret; unlike _feed_auth the admin's own login is NOT enough (a badge must come from Credly)
create or replace function public._cred_auth(p_secret text) returns void
language plpgsql stable security definer set search_path = public as
$$
begin
  if p_secret is not null and length(p_secret) >= 32 and exists (
       select 1 from public.job_feed_worker
        where secret_hash is not null and secret_hash = encode(sha256(convert_to(p_secret, 'utf8')), 'hex')) then return; end if;
  raise exception 'not allowed';
end $$;
revoke execute on function public._cred_auth(text) from public, anon, authenticated;

-- the public summary inside the profile: what companies and other people may see
create or replace function public._cred_sync(p_cid text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  update public.consultants c
     set data = (c.data - 'creds') || jsonb_build_object('creds', coalesce((
           select jsonb_agg(jsonb_build_object('id', x.id::text, 'title', x.title, 'issuer', x.issuer, 'kind', x.kind,
                                               'issued', x.issued, 'expires', x.expires, 'image', x.image) order by x.issued desc nulls last, x.created_at desc)
             from public.credentials x where x.consultant_id = c.id), '[]'::jsonb))
   where c.id = p_cid;
end $$;
revoke execute on function public._cred_sync(text) from public, anon, authenticated;

-- 1) before reading a badge: checks who is asking, limits use, returns the profile name (for the name check) and the badges so far
create or replace function public.cred_begin() returns jsonb
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text; eid text; n int; g int; nm text; cnt int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  r := my_role();                                    -- refuses a suspended account
  if r is distinct from 'consultant' then raise exception 'consultants only'; end if;
  eid := my_entity();
  delete from public.credential_checks where ts < now() - interval '2 days';
  select count(*) into n from public.credential_checks where user_id = uid and ts > now() - interval '1 hour';
  if n >= 30 then raise exception 'daily limit'; end if;
  select count(*) into g from public.credential_checks where ts > now() - interval '24 hours';
  if g >= 1500 then raise exception 'busy'; end if;
  select count(*) into cnt from public.credentials where consultant_id = eid;
  insert into public.credential_checks(user_id) values (uid);
  select trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')) into nm from public.consultants where id = eid;
  return jsonb_build_object('name', coalesce(nm, ''), 'count', cnt);
end $$;

-- the Credly id of one of my badges (to check it again)
create or replace function public.cred_ext(p_id uuid) returns text
language plpgsql stable security definer set search_path = public as
$$
declare e text;
begin
  if auth.uid() is null or my_role() is distinct from 'consultant' then raise exception 'not allowed'; end if;
  select ext_id into e from public.credentials where id = p_id and consultant_id = my_entity();
  return e;
end $$;

-- 2) save what Credly said (only with the secret). p_data: ext_id, title, issuer, kind, issued, expires, name_ok
create or replace function public.cred_save(p_secret text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); eid text; ext text; n int; other text; rid uuid; ttl text;
begin
  perform public._cred_auth(p_secret);
  if uid is null then raise exception 'not signed in'; end if;
  if my_role() is distinct from 'consultant' then raise exception 'consultants only'; end if;
  eid := my_entity();
  ext := lower(coalesce(p_data->>'ext_id', ''));
  if ext !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'bad badge'; end if;
  ttl := left(btrim(coalesce(p_data->>'title', '')), 200);
  if ttl = '' then raise exception 'bad badge'; end if;
  select consultant_id into other from public.credentials where provider = 'credly' and ext_id = ext;
  if other is not null and other <> eid then raise exception 'taken'; end if;
  select count(*) into n from public.credentials where consultant_id = eid and ext_id <> ext;
  if n >= 20 then raise exception 'too many'; end if;
  insert into public.credentials(consultant_id, ext_id, title, issuer, kind, issued, expires, name_ok, image)
  values (eid, ext, ttl, left(btrim(coalesce(p_data->>'issuer', '')), 120), left(btrim(coalesce(p_data->>'kind', '')), 60),
          nullif(p_data->>'issued', '')::date, nullif(p_data->>'expires', '')::date,
          case when p_data ? 'name_ok' and jsonb_typeof(p_data->'name_ok') = 'boolean' then (p_data->>'name_ok')::boolean end,
          case when length(coalesce(p_data->>'image', '')) <= 300 and coalesce(p_data->>'image', '') ~ '^https://images\.credly\.com/[A-Za-z0-9/_.%-]+$' then p_data->>'image' else '' end)
  on conflict (provider, ext_id) do update
     set title = excluded.title, issuer = excluded.issuer, kind = excluded.kind, issued = excluded.issued, expires = excluded.expires,
         image = excluded.image, name_ok = excluded.name_ok, checked_at = now()
  returning id into rid;
  perform public._cred_sync(eid);
  return (select jsonb_build_object('id', x.id::text, 'title', x.title, 'issuer', x.issuer, 'kind', x.kind, 'issued', x.issued, 'expires', x.expires, 'image', x.image,
                                    'nameMatch', x.name_ok, 'url', 'https://www.credly.com/badges/' || x.ext_id || '/public_url', 'checked', x.checked_at)
            from public.credentials x where x.id = rid);
end $$;

-- 3) mine (with the extras only the owner sees)
create or replace function public.my_credentials() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  if auth.uid() is null or my_role() is distinct from 'consultant' then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id::text, 'title', x.title, 'issuer', x.issuer, 'kind', x.kind, 'issued', x.issued, 'expires', x.expires, 'image', x.image,
                                    'nameMatch', x.name_ok, 'url', 'https://www.credly.com/badges/' || x.ext_id || '/public_url', 'checked', x.checked_at)
                                    order by x.issued desc nulls last, x.created_at desc)
                     from public.credentials x where x.consultant_id = my_entity()), '[]'::jsonb);
end $$;

create or replace function public.cred_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare eid text;
begin
  if auth.uid() is null or my_role() is distinct from 'consultant' then raise exception 'not allowed'; end if;
  eid := my_entity();
  delete from public.credentials where id = p_id and consultant_id = eid;
  perform public._cred_sync(eid);
end $$;

-- 4) admin: the list (with the Credly link, to open and compare) and removal
create or replace function public.admin_credentials() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id::text, 'entity', x.consultant_id,
            'who', trim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), 'headline', coalesce(c.data->>'headline',''),
            'title', x.title, 'issuer', x.issuer, 'kind', x.kind, 'issued', x.issued, 'expires', x.expires, 'image', x.image, 'nameMatch', x.name_ok,
            'url', 'https://www.credly.com/badges/' || x.ext_id || '/public_url', 'checked', x.checked_at, 'added', x.created_at)
            order by (x.name_ok is false) desc, x.created_at desc)
          from public.credentials x join public.consultants c on c.id = x.consultant_id), '[]'::jsonb);
end $$;

create or replace function public.admin_cred_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare eid text;
begin
  perform public._require_admin();
  delete from public.credentials where id = p_id returning consultant_id into eid;
  if eid is not null then perform public._cred_sync(eid); perform public._audit('cred_remove', eid, 'certification removed'); end if;
end $$;

-- 5) the profile functions: `creds` belongs to the server. A person can never send it, change it or lose it by saving the profile.
create or replace function public.claim_profile(p_role text, p_data jsonb) returns text
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); eid text; anon boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_role not in ('consultant','employer') then raise exception 'bad role'; end if;
  select entity_id into eid from public.profiles where user_id = uid;
  if eid is not null then return eid; end if;
  anon := coalesce((p_data->>'anon')::boolean, false);
  if p_role = 'consultant' then
    eid := 'c-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);
    insert into public.consultants(id, owner, anon, data) values (eid, uid, anon, (p_data - 'creds') || jsonb_build_object('id', eid));
  else
    eid := 'co-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);
    insert into public.companies(id, owner, anon, data) values (eid, uid, false, (p_data - 'anon') || jsonb_build_object('id', eid));
  end if;
  insert into public.profiles(user_id, role, entity_id) values (uid, p_role, eid);
  return eid;
end $$;

create or replace function public.save_profile(p_data jsonb) returns void
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text := my_role(); eid text := my_entity(); keep jsonb;
begin
  if uid is null or r is null then raise exception 'not signed in'; end if;
  p_data := p_data - array['sample','mine','_anon','certRevoked','creds'] || jsonb_build_object('id', eid);
  if r = 'consultant' then
    select data->'creds' into keep from public.consultants where id = eid;
    if keep is not null then p_data := p_data || jsonb_build_object('creds', keep); end if;
    update public.consultants set data = p_data, anon = coalesce((p_data->>'anon')::boolean, false), updated_at = now() where id = eid;
  else
    update public.companies set data = p_data - 'anon', anon = false, updated_at = now() where id = eid;
  end if;
end $$;

-- 6) others may see the summary (it holds no link, no Credly id, no name), also for a private profile
create or replace function public._consultant_public_keys() returns text[]
language sql immutable as
$$ select array['creds','firstName','lastName','headline','summary','city','country','nationality','availability',
               'industries','languages','level','linkedin','otherSkills','otherTools','photo','programs','roleType','roleTypes','skills','specialties','workPrefs','yearsExp'] $$;

-- a badge added or renewed must not make every role score the person again: only changes to the rest of the profile do
create or replace function public._ms_consultant_changed() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' or (new.data - 'creds') is distinct from (old.data - 'creds') or new.anon is distinct from old.anon then
    insert into public.match_scores_dirty(kind, id) values ('c', new.id) on conflict (kind, id) do update set ts = now();
  end if;
  return null;
end $$;

revoke execute on function public.cred_begin(), public.cred_ext(uuid), public.my_credentials(), public.cred_remove(uuid),
  public.admin_credentials(), public.admin_cred_remove(uuid) from public, anon;
grant execute on function public.cred_begin(), public.cred_ext(uuid), public.my_credentials(), public.cred_remove(uuid),
  public.admin_credentials(), public.admin_cred_remove(uuid) to authenticated;
revoke execute on function public.cred_save(text,jsonb) from public, anon;
grant execute on function public.cred_save(text,jsonb) to authenticated;   -- needs the signed-in person AND the secret

select 'ok' as release57;
