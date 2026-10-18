-- ============================================================================
-- ARNOUR — database schema, access rules and functions (Release 1)
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
-- ============================================================================

-- older versions of two functions (safe if they do not exist)
drop function if exists public.create_intro(text,text,text,text,text);
drop function if exists public.start_conversation(text,text,text);

-- ---------- tables ----------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('consultant','employer')),
  entity_id  text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.consultants (
  id         text primary key,
  owner      uuid references auth.users(id) on delete cascade,
  anon       boolean not null default false,
  sample     boolean not null default false,
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 600000),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id         text primary key,
  owner      uuid references auth.users(id) on delete cascade,
  anon       boolean not null default false,
  sample     boolean not null default false,
  alias      text not null unique default ('cx:' || substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) < 600000),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id           text primary key,
  company_id   text not null references public.companies(id) on delete cascade,
  owner        uuid references auth.users(id) on delete cascade,
  status       text not null default 'open',
  confidential boolean,
  sample       boolean not null default false,
  alias        text not null unique default ('cj:' || substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  posted_ts    bigint not null default (extract(epoch from now())*1000)::bigint,
  data         jsonb not null default '{}'::jsonb check (octet_length(data::text) < 100000),
  updated_at   timestamptz not null default now()
);
create index if not exists jobs_company_idx on public.jobs(company_id);

create table if not exists public.applications (
  job_id        text not null references public.jobs(id) on delete cascade,
  consultant_id text not null references public.consultants(id) on delete cascade,
  ts            bigint not null default (extract(epoch from now())*1000)::bigint,
  note          text not null default '' check (char_length(note) <= 2000),
  primary key (job_id, consultant_id)
);
create index if not exists applications_c_idx on public.applications(consultant_id);

create table if not exists public.invites (
  job_id        text not null references public.jobs(id) on delete cascade,
  consultant_id text not null references public.consultants(id) on delete cascade,
  ts            bigint not null default (extract(epoch from now())*1000)::bigint,
  primary key (job_id, consultant_id)
);
create index if not exists invites_c_idx on public.invites(consultant_id);

create table if not exists public.intros (
  id        text primary key,
  from_side text not null check (from_side in ('e','c')),
  cid       text not null references public.consultants(id) on delete cascade,
  eid       text not null references public.companies(id) on delete cascade,
  job_id    text references public.jobs(id) on delete set null,
  note      text not null default '' check (char_length(note) <= 600),
  status    text not null default 'pending' check (status in ('pending','accepted','declined')),
  ts        bigint not null default (extract(epoch from now())*1000)::bigint,
  resp_ts   bigint
);
create index if not exists intros_c_idx on public.intros(cid);
create index if not exists intros_e_idx on public.intros(eid);

create table if not exists public.conversations (
  id       text primary key,
  c_id     text not null references public.consultants(id) on delete cascade,
  e_id     text not null references public.companies(id) on delete cascade,
  job_id   text references public.jobs(id) on delete set null,
  c_read   bigint not null default 0,
  e_read   bigint not null default 0,
  last_ts  bigint not null default (extract(epoch from now())*1000)::bigint
);
create unique index if not exists conv_unique on public.conversations(c_id, e_id, coalesce(job_id,''));

create table if not exists public.messages (
  id      uuid primary key default gen_random_uuid(),
  conv_id text not null references public.conversations(id) on delete cascade,
  side    text not null check (side in ('c','e')),
  text    text not null default '' check (char_length(text) <= 6000),
  ts      bigint not null default (extract(epoch from now())*1000)::bigint,
  cv      jsonb,
  call    jsonb
);
create index if not exists messages_conv_idx on public.messages(conv_id, ts);

create table if not exists public.notifications (
  id        uuid primary key default gen_random_uuid(),
  user_key  text not null,
  type      text not null default 'info',
  text      text not null check (char_length(text) <= 500),
  link      text not null default '',
  ts        bigint not null default (extract(epoch from now())*1000)::bigint,
  read      boolean not null default false,
  from_user uuid
);
create index if not exists notif_key_idx on public.notifications(user_key, ts desc);
create index if not exists notif_from_idx on public.notifications(from_user, ts);
create index if not exists jobs_owner_idx on public.jobs(owner);
create index if not exists consultants_owner_idx on public.consultants(owner);
create index if not exists companies_owner_idx on public.companies(owner);
create index if not exists conv_e_idx on public.conversations(e_id);

-- ---------- admin controls (Release 3) -------------------------------------
alter table public.profiles    add column if not exists suspended        boolean not null default false;
alter table public.profiles    add column if not exists suspended_reason text    not null default '';
alter table public.profiles    add column if not exists suspended_at     timestamptz;
alter table public.consultants add column if not exists cert_revoked     boolean not null default false;
create table if not exists public.site_settings (key text primary key, value jsonb not null default 'null'::jsonb);

-- ---------- who am I --------------------------------------------------------
create or replace function public.my_entity() returns text
language plpgsql stable security definer set search_path = public as
$$
declare pr record;
begin
  select entity_id, suspended into pr from public.profiles where user_id = auth.uid();
  if pr.suspended then raise exception 'account suspended'; end if;
  return pr.entity_id;
end $$;

create or replace function public.my_role() returns text
language plpgsql stable security definer set search_path = public as
$$
declare pr record;
begin
  select role, suspended into pr from public.profiles where user_id = auth.uid();
  if pr.suspended then raise exception 'account suspended'; end if;
  return pr.role;
end $$;

-- hidden from everyone else: samples (when the admin hides them) and suspended people's content
create or replace function public._hide_samples() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select value = 'true'::jsonb from public.site_settings where key = 'hide_samples'), false) $$;

create or replace function public._visible(p_owner uuid, p_sample boolean) returns boolean
language sql stable security definer set search_path = public as
$$ select not (coalesce(p_sample,false) and public._hide_samples())
      and not coalesce((select suspended from public.profiles where user_id = p_owner), false) $$;

-- two people have been introduced (accepted) => identities are visible to each other
create or replace function public.is_revealed(p_cid text, p_eid text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.intros
                  where cid = p_cid and eid = p_eid and status = 'accepted') $$;

-- turn a public alias (cj:... / cx:...) back into the real company id
create or replace function public.resolve_eid(t text) returns text
language sql stable security definer set search_path = public as
$$ select case
     when t like 'cj:%' then (select company_id from public.jobs where alias = t)
     when t like 'cx:%' then (select id from public.companies where alias = t)
     else t end $$;

-- is this company hidden from the current viewer, for this job (or in general)?
create or replace function public._co_hidden(co public.companies, jb public.jobs) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare hidden boolean;
begin
  hidden := coalesce(case when jb.id is not null then jb.confidential end, co.anon);
  if not hidden then return false; end if;
  if co.owner is not null and co.owner = auth.uid() then return false; end if;
  if my_role() = 'consultant' and is_revealed(my_entity(), co.id) then return false; end if;
  return true;
end $$;

-- ---------- redaction helpers ----------------------------------------------
-- What other people may see of a profile: only these fields ever leave the server for someone else.
-- (Anything else a person stores, such as their saved roles or "seen" markers, stays with them.)
create or replace function public._pick(d jsonb, keys text[]) returns jsonb
language sql immutable as
$$ select coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(coalesce(d, '{}'::jsonb)) e where e.key = any(keys)), '{}'::jsonb) $$;

create or replace function public._consultant_public_keys() returns text[]
language sql immutable as
-- pay rates (currency, dailyRate, ratePeriod) are left out while rates are hidden on the site (APP.SHOW_RATES = false);
-- add them back here when rates return
$$ select array['firstName','lastName','headline','summary','city','country','nationality','availability',
               'industries','languages','level','linkedin','otherSkills','programs','roleType','roleTypes','skills','specialties','workPrefs','yearsExp'] $$;

create or replace function public._redact_consultant(c public.consultants) returns jsonb
language sql immutable as
$$ select public._pick(c.data, public._consultant_public_keys()) - array['firstName','lastName','city','nationality','summary','linkedin']
          || jsonb_build_object('id', c.id, 'anon', true, 'firstName', '', 'lastName', '', 'sample', c.sample, 'certRevoked', c.cert_revoked) $$;

-- mine: everything. Others: the public fields, and only the CV's name (the file itself is downloaded through its own rule)
create or replace function public._full_consultant(c public.consultants, mine boolean) returns jsonb
language sql immutable as
$$ select (case when mine then c.data
                else public._pick(c.data, public._consultant_public_keys())
                     || case when jsonb_typeof(c.data->'cv') = 'object' then jsonb_build_object('cv', (c.data->'cv') - 'path') else '{}'::jsonb end end)
          || jsonb_build_object('id', c.id, 'anon', c.anon, 'sample', c.sample, 'certRevoked', c.cert_revoked) $$;

create or replace function public._redact_company(co public.companies, as_id text) returns jsonb
language sql immutable as
$$ select public._pick(co.data, array['industry','size','country','sapSystems'])
          || jsonb_build_object('id', as_id, 'anon', true, '_anon', true, 'name', 'Confidential company', 'sample', co.sample) $$;

create or replace function public._full_company(co public.companies) returns jsonb
language sql stable security definer set search_path = public as
$$ select (case when co.owner is not distinct from auth.uid() and auth.uid() is not null then co.data
                else public._pick(co.data, array['name','about','description','city','country','industry','size','website','sapSystems','contactName','contactTitle','linkedin']) end)
          || jsonb_build_object('id', co.id, 'anon', co.anon, 'sample', co.sample) $$;

-- ---------- reading (everything goes through these) ------------------------
-- Gender is shown only to the owner and to signed-in companies (so it can be filtered on). Never to visitors, other professionals,
-- the community, shared links or previews: it is not part of _consultant_public_keys().
create or replace function public._emp_gender(c public.consultants) returns jsonb
language sql stable security definer set search_path = public as
$$ select case when auth.uid() is not null and my_role() = 'employer' and c.data ? 'gender' and c.data->>'gender' in ('male','female')
               then jsonb_build_object('gender', c.data->'gender') else '{}'::jsonb end $$;

create or replace function public.list_consultants() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare ent text := my_entity(); r text := my_role(); c public.consultants;
begin
  if auth.uid() is null then return; end if;
  for c in select * from public.consultants x where public._visible(x.owner, x.sample) or x.owner = auth.uid() loop
    if c.owner = auth.uid() then return next _full_consultant(c, true);
    elsif r = 'employer' and is_revealed(c.id, ent) then   -- introduced: the company may also open the CV file
      return next _full_consultant(c, false) || _emp_gender(c) || case when jsonb_typeof(c.data->'cv') = 'object' then jsonb_build_object('cv', c.data->'cv') else '{}'::jsonb end;
    elsif not c.anon then return next _full_consultant(c, false) || _emp_gender(c);
    else return next _redact_consultant(c) || _emp_gender(c);
    end if;
  end loop;
end $$;

create or replace function public.get_public_profile(p_id text) returns jsonb
language sql stable security definer set search_path = public as
$$ select case when c.anon and coalesce(c.owner <> auth.uid(), true) then jsonb_build_object('id', c.id, 'private', true)
               else _full_consultant(c, c.owner is not distinct from auth.uid()) || case when c.owner is not distinct from auth.uid() then '{}'::jsonb else _emp_gender(c) end end
   from public.consultants c where c.id = p_id and (public._visible(c.owner, c.sample) or c.owner = auth.uid()) $$;

create or replace function public.list_companies() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies; jb public.jobs;
begin
  for co in select * from public.companies x where public._visible(x.owner, x.sample) loop
    if not _co_hidden(co, null::public.jobs) then
      return next _full_company(co);
    else
      return next _redact_company(co, co.alias);
    end if;
  end loop;
  -- one anonymous stand-in per role that is confidential on its own
  for jb in select * from public.jobs j2 where j2.confidential is true and public._visible(j2.owner, j2.sample) loop
    select * into co from public.companies where id = jb.company_id;
    if _co_hidden(co, jb) then return next _redact_company(co, jb.alias); end if;
  end loop;
end $$;

create or replace function public.get_public_company(p_id text) returns jsonb
language sql stable security definer set search_path = public as
$$ select case when public._co_hidden(co, null::public.jobs)
               then jsonb_build_object('id', co.alias, 'private', true)
               else _full_company(co) end
   from public.companies co where co.id = p_id and (public._visible(co.owner, co.sample) or co.owner = auth.uid()) $$;

create or replace function public.list_jobs() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare jb public.jobs; co public.companies; ent text := my_entity(); out_co text; d jsonb;
begin
  for jb in select * from public.jobs j
            where public._visible(j.owner, j.sample)
               and (j.owner is not distinct from auth.uid() and auth.uid() is not null
                    or not (j.data ? 'expiresTs') or (j.data->>'expiresTs')::bigint > (extract(epoch from now())*1000)::bigint)
               and (j.status = 'open' or j.owner = auth.uid()
               or exists (select 1 from public.applications a where a.job_id = j.id and a.consultant_id = ent)
               or exists (select 1 from public.invites i where i.job_id = j.id and i.consultant_id = ent))
  loop
    select * into co from public.companies where id = jb.company_id;
    if _co_hidden(co, jb) then
      out_co := case when jb.confidential is true then jb.alias else co.alias end;
    else out_co := jb.company_id; end if;
    d := jb.data;
    if auth.uid() is null then d := d - 'applyUrl'; end if; /* the external apply link is for signed-in people only */
    /* pay is hidden on the site for now: only the company that posted the role receives it */
    if jb.owner is distinct from auth.uid() or auth.uid() is null then d := d - array['rateMin','rateMax','currency','ratePeriod']; end if;
    return next (d || jsonb_build_object('id', jb.id, 'companyId', out_co, 'status', jb.status,
                  'postedTs', jb.posted_ts, 'confidential', jb.confidential, 'sample', jb.sample,
                  'mine', jb.owner is not distinct from auth.uid() and auth.uid() is not null));
  end loop;
end $$;

-- conversations / introductions as seen by me (consultants get anonymous company ids)
create or replace function public._out_eid(p_eid text, p_job text) returns text
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies; jb public.jobs;
begin
  if my_role() <> 'consultant' then return p_eid; end if;
  select * into co from public.companies where id = p_eid;
  select * into jb from public.jobs where id = p_job;
  if _co_hidden(co, jb) then
    return case when jb.id is not null and jb.confidential is true then jb.alias else co.alias end;
  end if;
  return p_eid;
end $$;

create or replace function public.my_conversations() returns table(id text, c_id text, e_id text, job_id text, c_read bigint, e_read bigint, last_ts bigint)
language sql stable security definer set search_path = public as
$$ select v.id, v.c_id, public._out_eid(v.e_id, v.job_id), v.job_id, v.c_read, v.e_read, v.last_ts
   from public.conversations v
   where v.c_id = public.my_entity() or v.e_id = public.my_entity() $$;

create or replace function public.my_intros() returns table(id text, from_side text, cid text, eid text, job_id text, note text, status text, ts bigint, resp_ts bigint)
language sql stable security definer set search_path = public as
$$ select i.id, i.from_side, i.cid, public._out_eid(i.eid, i.job_id), i.job_id, i.note, i.status, i.ts, i.resp_ts
   from public.intros i
   where i.cid = public.my_entity() or i.eid = public.my_entity() $$;

-- ---------- writing (all through functions that check who you are) ---------
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
    insert into public.consultants(id, owner, anon, data) values (eid, uid, anon, p_data || jsonb_build_object('id', eid));
  else
    eid := 'co-' || substr(replace(gen_random_uuid()::text,'-',''),1,10);
    insert into public.companies(id, owner, anon, data) values (eid, uid, anon, p_data || jsonb_build_object('id', eid));
  end if;
  insert into public.profiles(user_id, role, entity_id) values (uid, p_role, eid);
  return eid;
end $$;

create or replace function public.save_profile(p_data jsonb) returns void
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); r text := my_role(); eid text := my_entity();
begin
  if uid is null or r is null then raise exception 'not signed in'; end if;
  p_data := p_data - array['sample','mine','_anon','certRevoked'] || jsonb_build_object('id', eid);
  if r = 'consultant' then
    update public.consultants set data = p_data, anon = coalesce((p_data->>'anon')::boolean, false), updated_at = now() where id = eid;
  else
    update public.companies set data = p_data, anon = coalesce((p_data->>'anon')::boolean, false), updated_at = now() where id = eid;
  end if;
end $$;

-- the one company that carries listings taken from other employers' career pages
create or replace function public._board_company() returns text
language sql stable security definer set search_path = public, auth as
$$ select co.id from public.companies co join auth.users u on u.id = co.owner
   where lower(u.email) = 'jobs@arnour.com' order by co.updated_at limit 1 $$;

create or replace function public.save_job(p_id text, p_data jsonb) returns text
language plpgsql security definer set search_path = public as
$$
declare uid uuid := auth.uid(); eid text := my_entity(); jid text := p_id; conf boolean; st text; old jsonb;
begin
  if my_role() <> 'employer' then raise exception 'employers only'; end if;
  conf := case when p_data ? 'confidential' and jsonb_typeof(p_data->'confidential') = 'boolean' then (p_data->>'confidential')::boolean end;
  st := coalesce(nullif(p_data->>'status',''), 'open');
  if st not in ('open','closed','filled','draft') then st := 'open'; end if;
  p_data := p_data - array['id','companyId','status','postedTs','applicants','appliedTs','applyNotes','invited','sample','mine','confidential','external','extEmployer','extSource','expiresTs'];
  if jid is null or jid = '' or not exists (select 1 from public.jobs where id = jid) then
    jid := coalesce(nullif(p_id,''), 'j-' || substr(replace(gen_random_uuid()::text,'-',''),1,10));
    insert into public.jobs(id, company_id, owner, status, confidential, data) values (jid, eid, uid, st, conf, p_data);
  else
    /* labels set by the import tool survive edits, and cannot be added by anyone else */
    select data into old from public.jobs where id = jid and owner = uid;
    if old is not null then
      p_data := p_data || (select coalesce(jsonb_object_agg(k, old->k), '{}'::jsonb) from unnest(array['external','extEmployer','extSource','expiresTs']) k where old ? k);
    end if;
    update public.jobs set data = p_data, status = st, confidential = conf, updated_at = now()
     where id = jid and owner = uid and company_id = eid;
    if not found then raise exception 'not your role'; end if;
  end if;
  return jid;
end $$;

create or replace function public.delete_job(p_id text) returns void
language sql security definer set search_path = public as
$$ delete from public.jobs where id = p_id and owner = auth.uid() $$;

create or replace function public.apply_to_job(p_job text, p_note text) returns void
language plpgsql security definer set search_path = public as
$$
declare ent text := my_entity();
begin
  if my_role() <> 'consultant' then raise exception 'professionals only'; end if;
  if not exists (select 1 from public.jobs where id = p_job and status = 'open') then raise exception 'role not open'; end if;
  if exists (select 1 from public.jobs where id = p_job and data->>'external' = 'true') then raise exception 'apply on the employer site'; end if;
  insert into public.applications(job_id, consultant_id, note) values (p_job, ent, left(coalesce(p_note,''), 2000))
  on conflict (job_id, consultant_id) do nothing;
end $$;

create or replace function public.withdraw_application(p_job text) returns void
language sql security definer set search_path = public as
$$ delete from public.applications where job_id = p_job and consultant_id = public.my_entity() $$;

create or replace function public.invite_to_job(p_job text, p_cid text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not exists (select 1 from public.jobs where id = p_job and owner = auth.uid()) then raise exception 'not your role'; end if;
  insert into public.invites(job_id, consultant_id) values (p_job, p_cid) on conflict do nothing;
end $$;

create or replace function public.create_intro(p_from text, p_cid text, p_eid text, p_job text, p_note text, p_id text default null) returns text
language plpgsql security definer set search_path = public as
$$
declare real_e text := resolve_eid(p_eid); r text := my_role(); ent text := my_entity(); iid text; jid text := nullif(p_job,'');
begin
  if real_e is null then raise exception 'unknown company'; end if;
  if p_from = 'e' and not (r = 'employer' and ent = real_e) then raise exception 'not allowed'; end if;
  if p_from = 'c' and not (r = 'consultant' and ent = p_cid) then raise exception 'not allowed'; end if;
  if p_from not in ('e','c') then raise exception 'bad side'; end if;
  select id into iid from public.intros where cid = p_cid and eid = real_e and coalesce(job_id,'') = coalesce(jid,'') and status = 'pending';
  if iid is not null then return iid; end if;
  iid := case when p_id ~ '^in[a-z0-9]{6,30}$' and not exists (select 1 from public.intros where id = p_id) then p_id
              else 'in' || substr(replace(gen_random_uuid()::text,'-',''),1,12) end;
  insert into public.intros(id, from_side, cid, eid, job_id, note) values (iid, p_from, p_cid, real_e, jid, left(coalesce(p_note,''), 300));
  return iid;
end $$;

create or replace function public.respond_intro(p_id text, p_accept boolean) returns void
language plpgsql security definer set search_path = public as
$$
declare i public.intros; r text := my_role(); ent text := my_entity();
begin
  select * into i from public.intros where id = p_id;
  if i.id is null then raise exception 'unknown introduction'; end if;
  -- only the receiving side answers
  if not ((i.from_side = 'e' and r = 'consultant' and ent = i.cid) or (i.from_side = 'c' and r = 'employer' and ent = i.eid)) then
    raise exception 'not allowed'; end if;
  update public.intros set status = case when p_accept then 'accepted' else 'declined' end,
         resp_ts = (extract(epoch from now())*1000)::bigint where id = p_id and status = 'pending';
  -- accepting opens the conversation, starting with the requester's own message
  if p_accept and i.status = 'pending' then
    declare cvid text; ttl text; now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
    begin
      select id into cvid from public.conversations where c_id = i.cid and e_id = i.eid and coalesce(job_id,'') = coalesce(i.job_id,'');
      if cvid is null then
        cvid := 'cv' || substr(replace(gen_random_uuid()::text,'-',''),1,12);
        insert into public.conversations(id, c_id, e_id, job_id, last_ts) values (cvid, i.cid, i.eid, i.job_id, now_ms);
        select data->>'title' into ttl from public.jobs where id = i.job_id;
        insert into public.messages(conv_id, side, text, ts) values (cvid, i.from_side,
          coalesce(nullif(i.note,''), case when i.from_side = 'e' then 'Hi, your profile looks relevant for a role we are hiring for.'
                                           else 'Hi, I am interested in ' || coalesce('the ' || ttl || ' role', 'opportunities with you') || '.' end), now_ms);
      end if;
    end;
  end if;
end $$;

create or replace function public.start_conversation(p_cid text, p_eid text, p_job text, p_id text default null) returns text
language plpgsql security definer set search_path = public as
$$
declare real_e text := resolve_eid(p_eid); r text := my_role(); ent text := my_entity(); cvid text; jid text := nullif(p_job,'');
begin
  if real_e is null then raise exception 'unknown company'; end if;
  if not ((r = 'consultant' and ent = p_cid) or (r = 'employer' and ent = real_e)) then raise exception 'not allowed'; end if;
  select id into cvid from public.conversations where c_id = p_cid and e_id = real_e and coalesce(job_id,'') = coalesce(jid,'');
  if cvid is not null then return cvid; end if;
  -- a private person or a confidential company can only be written to after an accepted introduction
  if r = 'consultant' and _co_hidden((select c from public.companies c where c.id = real_e), (select j from public.jobs j where j.id = jid)) then
    raise exception 'introduction required'; end if;
  if r = 'employer' and exists (select 1 from public.consultants c where c.id = p_cid and c.anon and c.owner is distinct from auth.uid())
     and not is_revealed(p_cid, real_e) then
    raise exception 'introduction required'; end if;
  cvid := case when p_id ~ '^cv[a-z0-9]{6,30}$' and not exists (select 1 from public.conversations where id = p_id) then p_id
               else 'cv' || substr(replace(gen_random_uuid()::text,'-',''),1,12) end;
  insert into public.conversations(id, c_id, e_id, job_id) values (cvid, p_cid, real_e, jid);
  return cvid;
end $$;

create or replace function public.send_message(p_conv text, p_text text, p_cv jsonb default null, p_call jsonb default null) returns void
language plpgsql security definer set search_path = public as
$$
declare v public.conversations; side text; now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  select * into v from public.conversations where id = p_conv;
  if v.id is null then raise exception 'unknown conversation'; end if;
  if my_role() = 'consultant' and my_entity() = v.c_id then side := 'c';
  elsif my_role() = 'employer' and my_entity() = v.e_id then side := 'e';
  else raise exception 'not allowed'; end if;
  -- an attached CV must be a file the sender uploaded to their own folder
  if side <> 'c' or p_cv is null or jsonb_typeof(p_cv) <> 'object' or coalesce(p_cv->>'path','') not like auth.uid()::text || '/%' then
    p_cv := case when side = 'c' and p_cv is not null and jsonb_typeof(p_cv) = 'boolean' then p_cv else null end;
  end if;
  if p_call is not null then
    if jsonb_typeof(p_call) <> 'object' then p_call := null;
    else p_call := jsonb_set(p_call, '{status}', '"proposed"'); end if;
  end if;
  if char_length(coalesce(p_text,'')) = 0 and p_cv is null and p_call is null then return; end if;
  insert into public.messages(conv_id, side, text, ts, cv, call) values (p_conv, side, left(coalesce(p_text,''), 6000), now_ms, p_cv, p_call);
  update public.conversations set last_ts = now_ms,
         c_read = case when side = 'c' then now_ms else c_read end,
         e_read = case when side = 'e' then now_ms else e_read end where id = p_conv;
end $$;

create or replace function public.mark_read(p_conv text) returns void
language plpgsql security definer set search_path = public as
$$
declare now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  update public.conversations set c_read = now_ms where id = p_conv and c_id = my_entity() and my_role() = 'consultant';
  update public.conversations set e_read = now_ms where id = p_conv and e_id = my_entity() and my_role() = 'employer';
end $$;

create or replace function public.in_conversation(p_conv text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.conversations v where v.id = p_conv
                  and (v.c_id = public.my_entity() or v.e_id = public.my_entity())) $$;

-- only the person who received the proposal answers it
create or replace function public.answer_call(p_msg uuid, p_status text) returns void
language sql security definer set search_path = public as
$$ update public.messages m set call = jsonb_set(m.call, '{status}', to_jsonb(p_status))
   where m.id = p_msg and p_status in ('accepted','declined') and m.call->>'status' = 'proposed'
     and public.in_conversation(m.conv_id)
     and m.side <> case when public.my_role() = 'consultant' then 'c' else 'e' end $$;

-- notifications: a member may only notify people they are actually connected to (a role, an introduction,
-- a conversation or a community thread). For anything sent to another person the wording is written here,
-- from the real records, so nobody can send made-up text to someone else.
create or replace function public._ent_label(p_ent text, p_viewer text) returns text
language plpgsql stable security definer set search_path = public as
$$
declare c public.consultants; co public.companies;
begin
  select * into c from public.consultants where id = p_ent;
  if c.id is not null then
    if c.anon and not public.is_revealed(c.id, p_viewer) then
      return coalesce(nullif(trim(c.data->>'headline'), ''), 'An SAP professional');
    end if;
    return coalesce(nullif(trim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), ''), 'An SAP professional');
  end if;
  select * into co from public.companies where id = p_ent;
  if co.id is not null then
    if co.anon and not public.is_revealed(p_viewer, co.id) then return 'A confidential company'; end if;
    return coalesce(nullif(co.data->>'name',''), 'A company');
  end if;
  return 'Someone';
end $$;

create or replace function public.send_notification(p_key text, p_type text, p_text text, p_link text) returns void
language plpgsql security definer set search_path = public as
$$
declare
  me text := my_entity(); k text := resolve_eid(p_key); lnk text := left(coalesce(p_link,''), 200);
  mc text[]; mj text[]; mq text[]; ma text[]; txt text := null; ttl text; who text; j public.jobs; co public.companies; i public.intros; v public.conversations;
  qa record; n int;
begin
  if auth.uid() is null or me is null then raise exception 'not signed in'; end if;
  if k is null then return; end if;
  if not (exists (select 1 from public.consultants where id = k) or exists (select 1 from public.companies where id = k)) then return; end if;
  -- only links to pages inside Arnour
  if lnk <> '' and lnk !~ '^#/[A-Za-z0-9/_:-]*$' then lnk := ''; end if;
  -- flood guard: at most 60 notifications per sender per hour
  if (select count(*) from public.notifications where from_user = auth.uid() and ts > (extract(epoch from now())*1000)::bigint - 3600000) > 60 then return; end if;
  who := public._ent_label(me, k);
  mc := regexp_match(lnk, '^#/[ce]/messages/([A-Za-z0-9-]+)$');
  mj := regexp_match(lnk, '^#/(?:job|e/jobs)/([A-Za-z0-9-]+)$');
  mq := regexp_match(lnk, '^#/community/q/([A-Za-z0-9-]+)$');
  ma := regexp_match(lnk, '^#/community/a/([A-Za-z0-9-]+)$');

  if k = me then
    txt := left(coalesce(p_text,''), 300);                                   -- notes to yourself (welcome, levels, reminders)
  elsif mc is not null then
    select * into v from public.conversations where id = mc[1];
    if v.id is not null and ((v.c_id = me and v.e_id = k) or (v.e_id = me and v.c_id = k)) then
      txt := who || case when p_text ilike '%proposed a call%' then ' proposed a call'
                         when p_text ilike '%accepted your introduction%' then ' accepted your introduction — you can now chat'
                         when p_text ilike '%replied%' then ' replied to your message' else ' sent you a message' end;
    end if;
  elsif lnk ~ '^#/[ce]/intros$' then
    select * into i from public.intros where (cid = me and eid = k) or (eid = me and cid = k) order by coalesce(resp_ts, ts) desc limit 1;
    if i.id is not null then
      select data->>'title' into ttl from public.jobs where id = i.job_id;
      txt := case
        when i.status = 'pending' and i.from_side = 'e' then who || ' would like to connect' || coalesce(' about "' || ttl || '"', '')
        when i.status = 'pending' then who || ' is interested' || coalesce(' in "' || ttl || '"', '')
        when i.status = 'accepted' then who || ' accepted your introduction — you can now chat'
        else 'Your introduction request' || coalesce(' for "' || ttl || '"', '') || ' was not accepted this time' end;
    end if;
  elsif mj is not null then
    select * into j from public.jobs where id = mj[1];
    if j.id is not null then
      ttl := coalesce(j.data->>'title', 'a role');
      select * into co from public.companies where id = j.company_id;
      if j.company_id = me and exists (select 1 from public.consultants where id = k) then
        who := case when public._co_hidden(co, j) and not public.is_revealed(k, co.id) then 'A confidential company' else coalesce(co.data->>'name', 'A company') end;
        txt := case when exists (select 1 from public.invites where job_id = j.id and consultant_id = k)
                    then who || ' invited you to apply for "' || ttl || '"'
                    else 'New role matches your profile: ' || ttl || ' — ' || who end;
      elsif j.company_id = k and exists (select 1 from public.consultants where id = me) then
        txt := case when exists (select 1 from public.applications where job_id = j.id and consultant_id = me)
                    then who || ' applied to "' || ttl || '"' || case when p_text ilike '%with a note%' then ' — with a note' else '' end
                    else who || ' withdrew their application for "' || ttl || '"' end;
      end if;
    end if;
  elsif mq is not null then
    select q.id, q.title, q.author into qa from public.questions q where q.id = mq[1];
    if qa.id is not null then
      ttl := left(qa.title, 80);
      if qa.author = me then
        if exists (select 1 from public.answers where question_id = qa.id and author = k and accepted) then
          txt := 'Your answer on "' || ttl || '" was marked accepted';
        else
          txt := 'New question in the community: "' || ttl || '"';           -- sent to members who know the product
        end if;
      elsif exists (select 1 from public.answers where question_id = qa.id and author = me) then
        if qa.author = k then txt := who || ' answered your question "' || ttl || '"';
        elsif exists (select 1 from public.answers where question_id = qa.id and author = k) then txt := 'Another answer was posted on "' || ttl || '", which you answered';
        end if;
      elsif exists (select 1 from public.votes where voter = me and ((kind = 'q' and item_id = qa.id) or (kind = 'a' and item_id in (select id from public.answers where question_id = qa.id and author = k)))) then
        txt := 'Your post on "' || ttl || '" is getting upvotes';
      end if;
    end if;
  elsif ma is not null then
    select r.id, r.title, r.author into qa from public.articles r where r.id = ma[1];
    if qa.id is not null then
      ttl := left(qa.title, 80);
      if exists (select 1 from public.article_comments where article_id = qa.id and author = me) then
        if qa.author = k then txt := who || ' commented on your article "' || ttl || '"';
        elsif exists (select 1 from public.article_comments where article_id = qa.id and author = k) then txt := who || ' also commented on "' || ttl || '"';
        end if;
      elsif qa.author = k and exists (select 1 from public.votes where voter = me and kind = 'r' and item_id = qa.id) then
        txt := 'Your article "' || ttl || '" is getting upvotes';
      end if;
    end if;
  end if;

  if txt is null then return; end if;                                         -- no real connection: nothing is sent
  insert into public.notifications(user_key, type, text, link, from_user)
  values (k, case when p_type in ('msg','job','app','comm') then p_type else 'job' end, left(txt, 500), lnk, auth.uid());
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.notifications where user_key = (select entity_id from public.profiles where user_id = auth.uid());
  delete from auth.users where id = auth.uid();   -- cascades to profile, profile data, roles, messages
end $$;

-- ---------- access rules (row level security) ------------------------------
alter table public.profiles       enable row level security;
alter table public.consultants    enable row level security;
alter table public.companies      enable row level security;
alter table public.jobs           enable row level security;
alter table public.applications   enable row level security;
alter table public.invites        enable row level security;
alter table public.intros         enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.notifications  enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- direct table reads (writes only ever happen through the functions above)
grant select on public.profiles, public.applications, public.invites, public.messages to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select on public.consultants, public.companies, public.jobs to authenticated;  -- own rows only, see policies

drop policy if exists p_profiles_own on public.profiles;
create policy p_profiles_own on public.profiles for select to authenticated using (user_id = auth.uid());

drop policy if exists p_cons_own on public.consultants;
create policy p_cons_own on public.consultants for select to authenticated using (owner = auth.uid());
drop policy if exists p_cos_own on public.companies;
create policy p_cos_own on public.companies for select to authenticated using (owner = auth.uid());
drop policy if exists p_jobs_own on public.jobs;
create policy p_jobs_own on public.jobs for select to authenticated using (owner = auth.uid());

drop policy if exists p_apps_read on public.applications;
create policy p_apps_read on public.applications for select to authenticated using (
  consultant_id = public.my_entity()
  or exists (select 1 from public.jobs j where j.id = job_id and j.owner = auth.uid()));
drop policy if exists p_inv_read on public.invites;
create policy p_inv_read on public.invites for select to authenticated using (
  consultant_id = public.my_entity()
  or exists (select 1 from public.jobs j where j.id = job_id and j.owner = auth.uid()));

drop policy if exists p_msg_read on public.messages;
create policy p_msg_read on public.messages for select to authenticated using (public.in_conversation(conv_id));

drop policy if exists p_not_own on public.notifications;
create policy p_not_own on public.notifications for select to authenticated using (user_key = public.my_entity());
drop policy if exists p_not_upd on public.notifications;
create policy p_not_upd on public.notifications for update to authenticated using (user_key = public.my_entity()) with check (user_key = public.my_entity());
drop policy if exists p_not_del on public.notifications;
create policy p_not_del on public.notifications for delete to authenticated using (user_key = public.my_entity());
-- the only column a person may change on a notification is "read"
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;

-- who may call what
grant execute on function public.my_entity(), public.my_role(), public.is_revealed(text,text) to authenticated;
grant execute on function public.in_conversation(text) to authenticated;   -- used by the messages policy
grant execute on function public.list_consultants(), public.my_conversations(), public.my_intros(),
  public.claim_profile(text,jsonb), public.save_profile(jsonb), public.save_job(text,jsonb), public.delete_job(text),
  public.apply_to_job(text,text), public.withdraw_application(text), public.invite_to_job(text,text),
  public.create_intro(text,text,text,text,text,text), public.respond_intro(text,boolean),
  public.start_conversation(text,text,text,text), public.send_message(text,text,jsonb,jsonb), public.mark_read(text), public.answer_call(uuid,text),
  public.send_notification(text,text,text,text), public.delete_my_account() to authenticated;
grant execute on function public.list_jobs(), public.list_companies(), public.get_public_profile(text), public.get_public_company(text) to anon, authenticated;
-- helpers used inside other functions run as the function owner; they need no public grant

-- a short fingerprint of everything private that can change for me; the site checks it often and
-- reloads my messages, introductions and applications only when it changes
create or replace function public.my_pulse() returns text
language plpgsql stable security definer set search_path = public as
$$
declare ent text := my_entity(); r text := my_role(); s text;
begin
  if auth.uid() is null or ent is null then return ''; end if;
  select concat_ws('|',
    (select count(*) || ':' || coalesce(max(m.ts),0) || ':' || count(*) filter (where m.call->>'status' in ('accepted','declined'))
       from public.messages m join public.conversations v on v.id = m.conv_id where v.c_id = ent or v.e_id = ent),
    (select count(*) || ':' || coalesce(sum(v.c_read + v.e_read),0) || ':' || coalesce(max(v.last_ts),0)
       from public.conversations v where v.c_id = ent or v.e_id = ent),
    (select count(*) || ':' || coalesce(max(n.ts),0) from public.notifications n where n.user_key = ent),
    (select count(*) || ':' || coalesce(max(greatest(i.ts, coalesce(i.resp_ts,0))),0) || ':' || count(*) filter (where i.status <> 'pending')
       from public.intros i where i.cid = ent or i.eid = ent),
    case when r = 'consultant' then (select count(*) || ':' || coalesce(max(a.ts),0) from public.applications a where a.consultant_id = ent)
         else (select count(*) || ':' || coalesce(max(a.ts),0) from public.applications a join public.jobs j on j.id = a.job_id where j.company_id = ent) end,
    case when r = 'consultant' then (select count(*)::text from public.invites x where x.consultant_id = ent)
         else (select count(*)::text from public.invites x join public.jobs j on j.id = x.job_id where j.company_id = ent) end
  ) into s;
  return s;
end $$;
grant execute on function public.my_pulse() to authenticated;

-- ---------- CV files (private storage bucket "cvs") -------------------------
create or replace function public.can_read_cv(p_name text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from public.messages m join public.conversations v on v.id = m.conv_id
     where m.side = 'c' and m.cv->>'path' = p_name and v.e_id = public.my_entity() and public.my_role() = 'employer')
   or exists (
     select 1 from public.consultants c
     where c.data->'cv'->>'path' = p_name and public.my_role() = 'employer' and public.is_revealed(c.id, public.my_entity())) $$;
grant execute on function public.can_read_cv(text) to authenticated;

do $storage$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cvs', 'cvs', false, 5242880, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

    drop policy if exists "cv upload own" on storage.objects;
    create policy "cv upload own" on storage.objects for insert to authenticated
      with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "cv read" on storage.objects;
    create policy "cv read" on storage.objects for select to authenticated
      using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.can_read_cv(name)));
    drop policy if exists "cv delete own" on storage.objects;
    create policy "cv delete own" on storage.objects for delete to authenticated
      using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end
$storage$;

-- re-running this file resets every access right above; give the community and admin parts theirs back
do $regrant$
begin
  if exists (select 1 from pg_proc where proname = '_grant_community' and pronamespace = 'public'::regnamespace) then perform public._grant_community(); end if;
  if exists (select 1 from pg_proc where proname = '_grant_admin' and pronamespace = 'public'::regnamespace) then perform public._grant_admin(); end if;
end
$regrant$;
