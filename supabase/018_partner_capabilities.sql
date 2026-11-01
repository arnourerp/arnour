-- release35: SI/Partner capabilities, "Find partners", partner requests
-- 1) A partner company can describe what its team delivers (company data key "partner"). The database cleans it on every save,
--    so only well-formed values are ever stored or shown.
-- 2) Anyone (visitors included) can read the partner list. A partner that chose "hide our name" shows its capabilities only,
--    under an alias, and its name is hidden everywhere (company list, roles, notifications) until it accepts a request.
-- 3) An SAP Customer can send a request to a partner; the partner accepts or declines; on accept both sides see each other's
--    contact details (and the e-mail address only if its owner chose to share it). No rates or prices anywhere.

-- ---------- cleaning ----------------------------------------------------------
create or replace function public._clean_strs(a jsonb, max_items int, max_len int, allowed text[] default null) returns jsonb
language sql immutable as
$$ select coalesce(jsonb_agg(to_jsonb(z.s) order by z.o), '[]'::jsonb)
   from (select q.s, min(q.o) o
           from (select left(trim(e.v #>> '{}'), max_len) s, e.o
                   from jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]'::jsonb end) with ordinality as e(v, o)
                  where jsonb_typeof(e.v) = 'string' and trim(e.v #>> '{}') <> ''
                    and (allowed is null or (e.v #>> '{}') = any(allowed))) q
          group by q.s order by min(q.o) limit max_items) z $$;

create or replace function public._clean_skills(a jsonb) returns jsonb
language sql immutable as
$$ select coalesce(jsonb_agg(jsonb_build_object('productId', s.p, 'moduleId', s.m, 'projects', s.n, 'certified', s.c) order by s.o), '[]'::jsonb)
   from (select d.* from (
           select distinct on (q.p, q.m) q.p, q.m, q.n, q.c, q.o
             from (select left(e.v->>'productId', 40) p, left(e.v->>'moduleId', 60) m,
                          case when (e.v->>'projects') ~ '^[0-9]{1,3}$' then (e.v->>'projects')::int else 0 end n,
                          coalesce((e.v->>'certified') = 'true', false) c, e.o
                     from jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]'::jsonb end) with ordinality as e(v, o)
                    where jsonb_typeof(e.v) = 'object'
                      and (e.v->>'productId') ~ '^[A-Za-z0-9_-]{1,40}$' and (e.v->>'moduleId') ~ '^[A-Za-z0-9_*.:-]{1,60}$') q
            order by q.p, q.m, q.o) d order by d.o limit 200) s $$;

create or replace function public._partner_clean(d jsonb) returns jsonb
language sql immutable as
$$ select case when d is null or jsonb_typeof(d) <> 'object' then null else jsonb_build_object(
     'skills',     public._clean_skills(d->'skills'),
     'industries', public._clean_strs(d->'industries', 20, 60),
     'specialties',public._clean_strs(d->'specialties', 40, 40),
     'countries',  public._clean_strs(d->'countries', 60, 20),
     'languages',  public._clean_strs(d->'languages', 20, 30),
     'delivery',   public._clean_strs(d->'delivery', 3, 10, array['onsite','remote','hybrid']),
     'engagement', public._clean_strs(d->'engagement', 3, 12, array['team','consultants','support']),
     'teamSize',   case when d->>'teamSize' in ('1-10','11-50','51-200','200+') then d->>'teamSize' else '' end,
     'bestAt',     left(trim(case when jsonb_typeof(d->'bestAt') = 'string' then d->>'bestAt' else '' end), 400),
     'hideName',   coalesce(d->>'hideName' = 'true', false)) end $$;

-- every save of a company: only a partner keeps capabilities, and they are always in the clean shape
create or replace function public._companies_partner_clean() returns trigger
language plpgsql as
$$
begin
  if new.data ? 'partner' then
    if new.data->>'companyType' = 'partner' and public._partner_clean(new.data->'partner') is not null then
      new.data := jsonb_set(new.data, '{partner}', public._partner_clean(new.data->'partner'));
    else
      new.data := new.data - 'partner';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists companies_partner_clean on public.companies;
create trigger companies_partner_clean before insert or update of data on public.companies
  for each row execute function public._companies_partner_clean();

-- ---------- requests ------------------------------------------------------------
create table if not exists public.partner_requests (
  id         text primary key,
  from_eid   text not null references public.companies(id) on delete cascade,   -- the SAP Customer
  to_eid     text not null references public.companies(id) on delete cascade,   -- the partner
  need       text not null default 'both' check (need in ('team','consultants','both')),
  timing     text not null default '' check (char_length(timing) <= 80),
  note       text not null default '' check (char_length(note) <= 600),
  from_share boolean not null default false,   -- the customer agreed to share its e-mail address once accepted
  to_share   boolean not null default false,   -- the partner agreed to share its e-mail address when accepting
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  ts         bigint not null default (extract(epoch from now())*1000)::bigint,
  resp_ts    bigint,
  check (from_eid <> to_eid)
);
create index if not exists partner_req_from_idx on public.partner_requests(from_eid);
create index if not exists partner_req_to_idx on public.partner_requests(to_eid);
create unique index if not exists partner_req_one_pending on public.partner_requests(from_eid, to_eid) where status = 'pending';
alter table public.partner_requests enable row level security;
revoke all on public.partner_requests from anon, authenticated, public;

-- ---------- hiding ----------------------------------------------------------------
create or replace function public._partner_hidden(co public.companies) returns boolean
language sql immutable as
$$ select co.data->>'companyType' = 'partner' and coalesce(co.data #>> '{partner,hideName}', '') = 'true' $$;

-- the customer asked this partner and the partner said yes
create or replace function public._partner_revealed(p_partner text, p_viewer text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.partner_requests where to_eid = p_partner and from_eid = p_viewer and status = 'accepted') $$;

-- a professional was introduced to this company (accepted introduction, or the company shared its name in a chat)
create or replace function public._co_revealed_to_pro(p_cid text, p_eid text) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.intros where cid = p_cid and eid = p_eid and status = 'accepted')
       or exists (select 1 from public.conversations where c_id = p_cid and e_id = p_eid and rev_e) $$;

-- is this company hidden from the current viewer? (a confidential role, or a partner that hides its name)
create or replace function public._co_hidden(co public.companies, jb public.jobs) returns boolean
language plpgsql stable security definer set search_path = public as
$$
begin
  if co.owner is not null and co.owner = auth.uid() then return false; end if;
  if public._partner_hidden(co) then
    if my_role() = 'consultant' and public._co_revealed_to_pro(my_entity(), co.id) then return false; end if;
    if my_role() = 'employer' and public._partner_revealed(co.id, my_entity()) then return false; end if;
    return true;
  end if;
  if jb.id is null or jb.confidential is not true then return false; end if;
  if my_role() = 'consultant' and is_revealed_job(my_entity(), co.id, jb.id) then return false; end if;
  return true;
end $$;

-- the name used in notifications and alerts
create or replace function public._ent_label(p_ent text, p_viewer text) returns text
language plpgsql stable security definer set search_path = public as
$$
declare c public.consultants; co public.companies;
begin
  select * into c from public.consultants where id = p_ent;
  if c.id is not null then
    if c.anon and not public.is_revealed(c.id, p_viewer) and not public._peer_revealed(c.id, p_viewer) then
      return coalesce(nullif(trim(c.data->>'headline'), ''), 'An SAP professional');
    end if;
    return coalesce(nullif(trim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), ''), 'An SAP professional');
  end if;
  select * into co from public.companies where id = p_ent;
  if co.id is not null then
    if public._partner_hidden(co) and not public._partner_revealed(co.id, p_viewer) and not public._co_revealed_to_pro(p_viewer, co.id) then
      return 'A confidential SI/Partner';
    end if;
    return coalesce(nullif(co.data->>'name',''), 'A company');
  end if;
  return 'Someone';
end $$;

-- ---------- reading -----------------------------------------------------------------
-- named: what everybody may see of a partner. Not named: capabilities only (no free text, no city, no name).
create or replace function public._partner_card(co public.companies, p_named boolean) returns jsonb
language sql stable security definer set search_path = public as
$$ select (case when p_named then
          public._pick(co.data, array['name','about','country','city','industry','size','website','linkedin'])
          || jsonb_build_object('id', co.id, 'anon', false, 'partner', co.data->'partner')
        else
          public._pick(co.data, array['country','size'])
          || jsonb_build_object('id', co.alias, 'anon', true, '_anon', true, 'name', 'Confidential SI/Partner', 'partner', (co.data->'partner') - 'bestAt')
        end) || jsonb_build_object('companyType', 'partner', 'sample', co.sample) $$;

create or replace function public.list_partners() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies;
begin
  for co in select * from public.companies x
             where x.data->>'companyType' = 'partner'
               and jsonb_array_length(coalesce(x.data #> '{partner,skills}', '[]'::jsonb)) > 0
               and (public._visible(x.owner, x.sample) or x.owner = auth.uid())
             order by x.updated_at desc
  loop
    return next public._partner_card(co, not public._co_hidden(co, null::public.jobs));
  end loop;
end $$;

create or replace function public.get_partner(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies; rid text := resolve_eid(p_id); hid boolean;
begin
  select * into co from public.companies x
   where x.id = rid and x.data->>'companyType' = 'partner' and (public._visible(x.owner, x.sample) or x.owner = auth.uid());
  if co.id is null or jsonb_array_length(coalesce(co.data #> '{partner,skills}', '[]'::jsonb)) = 0 then return null; end if;
  hid := public._co_hidden(co, null::public.jobs);
  if hid and p_id = co.id then return jsonb_build_object('id', co.alias, 'private', true); end if;   -- the real id of a hidden partner gives nothing away
  return public._partner_card(co, not hid);
end $$;

-- ---------- requests: send, answer, read -----------------------------------------------
create or replace function public.request_partner(p_partner text, p_need text, p_timing text, p_note text, p_share_email boolean default false) returns text
language plpgsql security definer set search_path = public as
$$
declare me text := my_entity(); rid text := resolve_eid(p_partner); mine public.companies; pco public.companies; iid text;
        now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint; need text := case when p_need in ('team','consultants','both') then p_need else 'both' end;
begin
  if auth.uid() is null or my_role() is distinct from 'employer' or me is null then raise exception 'companies only'; end if;
  select * into mine from public.companies where id = me;
  if mine.data->>'companyType' is distinct from 'customer' then raise exception 'only SAP customers can ask partners'; end if;
  select * into pco from public.companies where id = rid;
  if pco.id is null or pco.data->>'companyType' is distinct from 'partner' or not public._visible(pco.owner, pco.sample)
     or jsonb_array_length(coalesce(pco.data #> '{partner,skills}', '[]'::jsonb)) = 0 then raise exception 'unknown partner'; end if;
  if pco.id = me or public._blocked(me, pco.id) then raise exception 'not allowed'; end if;
  select id into iid from public.partner_requests where from_eid = me and to_eid = pco.id and status = 'pending';
  if iid is not null then return iid; end if;
  if exists (select 1 from public.partner_requests where from_eid = me and to_eid = pco.id and status = 'accepted') then raise exception 'already connected'; end if;
  if exists (select 1 from public.partner_requests where from_eid = me and to_eid = pco.id and status = 'declined' and resp_ts > now_ms - 30::bigint*86400000) then
    raise exception 'this partner did not accept your last request; try again later'; end if;
  if (select count(*) from public.partner_requests where from_eid = me and ts > now_ms - 86400000) >= 5
     or (select count(*) from public.partner_requests where from_eid = me and ts > now_ms - 7::bigint*86400000) >= 20 then
    raise exception 'too many requests, try again later'; end if;
  iid := 'pr' || substr(replace(gen_random_uuid()::text,'-',''),1,12);
  insert into public.partner_requests(id, from_eid, to_eid, need, timing, note, from_share)
  values (iid, me, pco.id, need, left(trim(coalesce(p_timing,'')), 80), left(trim(coalesce(p_note,'')), 600), coalesce(p_share_email, false));
  perform public._notify(pco.id, coalesce(nullif(mine.data->>'name',''), 'A company') || ' would like to connect about a project', '#/e/partner-requests');
  return iid;
end $$;

create or replace function public.respond_partner_request(p_id text, p_accept boolean, p_share_email boolean default false) returns void
language plpgsql security definer set search_path = public as
$$
declare q public.partner_requests; me text := my_entity(); mine public.companies; now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  select * into q from public.partner_requests where id = p_id;
  if q.id is null then raise exception 'unknown request'; end if;
  if my_role() is distinct from 'employer' or q.to_eid is distinct from me then raise exception 'not allowed'; end if;
  if q.status <> 'pending' then return; end if;
  update public.partner_requests set status = case when p_accept then 'accepted' else 'declined' end,
         to_share = coalesce(p_accept, false) and coalesce(p_share_email, false), resp_ts = now_ms where id = p_id;
  select * into mine from public.companies where id = me;
  if p_accept then
    perform public._notify(q.from_eid, coalesce(nullif(mine.data->>'name',''), 'A partner') || ' accepted your introduction — you can now see their contact details', '#/e/partner-requests');
  else
    perform public._notify(q.from_eid, 'Your request to a partner was not accepted this time', '#/e/partner-requests');
  end if;
end $$;

create or replace function public.my_partner_requests() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare me text := my_entity(); q public.partner_requests; oc public.companies; incoming boolean; card jsonb; mail text; shared boolean;
begin
  if auth.uid() is null or my_role() is distinct from 'employer' or me is null then return; end if;
  for q in select * from public.partner_requests where from_eid = me or to_eid = me order by ts desc limit 200 loop
    incoming := q.to_eid = me;
    select * into oc from public.companies where id = case when incoming then q.from_eid else q.to_eid end;
    if oc.id is null then continue; end if;
    if incoming then card := public._full_company(oc);
    elsif q.status = 'accepted' then card := public._full_company(oc) || jsonb_build_object('partner', oc.data->'partner');
    else card := public._partner_card(oc, not public._co_hidden(oc, null::public.jobs)); end if;
    mail := null;
    shared := case when incoming then q.from_share else q.to_share end;
    if q.status = 'accepted' and shared and oc.owner is not null then select u.email into mail from auth.users u where u.id = oc.owner; end if;
    return next jsonb_build_object('id', q.id, 'dir', case when incoming then 'in' else 'out' end, 'status', q.status, 'need', q.need,
                                   'timing', q.timing, 'note', q.note, 'ts', q.ts, 'respTs', q.resp_ts, 'other', card, 'contactEmail', mail,
                                   'iShared', case when incoming then q.to_share else q.from_share end);
  end loop;
end $$;

-- ---------- who may call what -----------------------------------------------------------
revoke execute on function public._partner_revealed(text, text), public._co_revealed_to_pro(text, text),
                           public._partner_card(public.companies, boolean) from public, anon, authenticated;
revoke execute on function public.request_partner(text, text, text, text, boolean), public.respond_partner_request(text, boolean, boolean),
                           public.my_partner_requests() from public, anon;
grant execute on function public.request_partner(text, text, text, text, boolean), public.respond_partner_request(text, boolean, boolean),
                          public.my_partner_requests() to authenticated;
grant execute on function public.list_partners(), public.get_partner(text) to anon, authenticated;

select 'ok' as release35;
