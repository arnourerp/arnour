-- =====================================================================
-- 010 · Announcements
-- The admin writes one message in Admin > Announcements and chooses how it
-- reaches people: a banner on screen, a bell notification, an email, or any
-- mix. The audience can be narrowed by who (professionals / companies /
-- everyone), country and role type. Emails reuse the 007 queue and sender and
-- have their own switch (and unsubscribe link) per person.
-- Needs 005 (_require_admin, _audit) and 007. Safe to run again.
-- =====================================================================

alter table public.email_prefs add column if not exists announcements boolean not null default true;
alter table public.email_queue add column if not exists ann_id bigint;

create table if not exists public.announcements (
  id bigserial primary key,
  ts bigint not null default (extract(epoch from now())*1000)::bigint,
  admin text not null default '',
  title text not null, body text not null default '', link text not null default '', link_label text not null default '',
  ch_banner boolean not null default false, ch_bell boolean not null default false, ch_email boolean not null default false,
  who text not null default 'all' check (who in ('pros','companies','all')),
  country text not null default '', role_type text not null default '',
  banner_until bigint not null default 0,
  withdrawn boolean not null default false,
  n_bell int not null default 0, n_email int not null default 0, n_audience int not null default 0
);
alter table public.announcements enable row level security;
revoke all on public.announcements from public, anon, authenticated;

-- ---- replaced 007 functions (each gets one small addition for announcements) ----
create or replace function public._queue_email() returns trigger
language plpgsql security definer set search_path = public as
$$
declare uid uuid; k text; p public.email_prefs; now_ms bigint := (extract(epoch from now())*1000)::bigint; after bigint; cv text;
begin
  if new.type = 'announcement' then return new; end if;   -- announcements are queued by the announcement sender, not by text patterns
  k := public._email_kind(new.text, new.link);
  if k is null then return new; end if;
  select user_id into uid from public.profiles where entity_id = new.user_key and not suspended;
  if uid is null then return new; end if;
  p := public._email_prefs(uid);
  if k = 'matches' then
    if p.matches = 'off' then return new; end if;
    after := case p.matches when 'instant' then now_ms when 'weekly' then public._email_next_slot(true) else public._email_next_slot(false) end;
  elsif k = 'applicants' then
    if p.applicants = 'off' then return new; end if;
    after := case p.applicants when 'daily' then public._email_next_slot(false) else now_ms end;
  elsif k = 'invites' then
    if not p.invites then return new; end if; after := now_ms;
  elsif k = 'community' then
    if not p.community then return new; end if; after := now_ms;
  elsif k = 'messages' then
    if not p.messages then return new; end if;
    cv := (regexp_match(new.link, '^#/[ce]/messages/([A-Za-z0-9-]+)$'))[1];
    -- at most one email per chat per hour
    if exists (select 1 from public.email_queue where user_id = uid and kind = 'messages' and conv_id = cv and created_ts > now_ms - 3600000) then return new; end if;
    after := now_ms + 15 * 60000;   -- only if still unread after 15 minutes
  end if;
  insert into public.email_queue(user_id, kind, text, link, conv_id, send_after) values (uid, k, new.text, coalesce(new.link,''), cv, after);
  return new;
end $$;

create or replace function public.my_email_prefs() returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare p public.email_prefs;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  p := public._email_prefs(auth.uid());
  return jsonb_build_object('matches', p.matches, 'invites', p.invites, 'messages', p.messages, 'applicants', p.applicants, 'community', p.community, 'announcements', p.announcements,
                            'email', (select email from auth.users where id = auth.uid()));
end $$;

create or replace function public.set_email_prefs(p_data jsonb) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public._email_prefs(auth.uid());
  update public.email_prefs set
    matches    = case when p_data->>'matches' in ('instant','daily','weekly','off') then p_data->>'matches' else matches end,
    applicants = case when p_data->>'applicants' in ('instant','daily','off') then p_data->>'applicants' else applicants end,
    invites    = case when jsonb_typeof(p_data->'invites') = 'boolean' then (p_data->>'invites')::boolean else invites end,
    messages   = case when jsonb_typeof(p_data->'messages') = 'boolean' then (p_data->>'messages')::boolean else messages end,
    community  = case when jsonb_typeof(p_data->'community') = 'boolean' then (p_data->>'community')::boolean else community end,
    announcements = case when jsonb_typeof(p_data->'announcements') = 'boolean' then (p_data->>'announcements')::boolean else announcements end
  where user_id = auth.uid();
  -- switching a type off also cancels what is still waiting
  delete from public.email_queue q using public.email_prefs e
   where q.user_id = auth.uid() and e.user_id = q.user_id and q.sent_ts is null and (
     (q.kind = 'matches' and e.matches = 'off') or (q.kind = 'applicants' and e.applicants = 'off') or
     (q.kind = 'invites' and not e.invites) or (q.kind = 'messages' and not e.messages) or (q.kind = 'community' and not e.community) or (q.kind = 'announcements' and not e.announcements));
end $$;

create or replace function public.email_unsubscribe(p_token text, p_kind text) returns text
language plpgsql security definer set search_path = public as
$$
declare uid uuid;
begin
  if p_token !~ '^[0-9a-f-]{36}$' then return 'invalid'; end if;
  select user_id into uid from public.email_prefs where token = p_token::uuid;
  if uid is null then return 'invalid'; end if;
  if p_kind = 'matches' then update public.email_prefs set matches = 'off' where user_id = uid;
  elsif p_kind = 'applicants' then update public.email_prefs set applicants = 'off' where user_id = uid;
  elsif p_kind = 'invites' then update public.email_prefs set invites = false where user_id = uid;
  elsif p_kind = 'messages' then update public.email_prefs set messages = false where user_id = uid;
  elsif p_kind = 'community' then update public.email_prefs set community = false where user_id = uid;
  elsif p_kind = 'announcements' then update public.email_prefs set announcements = false where user_id = uid;
  else update public.email_prefs set matches = 'off', applicants = 'off', invites = false, messages = false, community = false, announcements = false where user_id = uid; p_kind := 'all';
  end if;
  delete from public.email_queue where user_id = uid and sent_ts is null and (p_kind = 'all' or kind = p_kind);
  return p_kind;
end $$;

create or replace function public.email_build_batch(p_limit int default 40) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare
  now_ms bigint := (extract(epoch from now())*1000)::bigint; r record; it record; out jsonb := '[]'::jsonb;
  items text; n int; subj text; first_text text; first_link text; first_kind text; kinds text[]; site text := 'https://arnour.com/';
  addr text; tok uuid; footer text; btn text; qids bigint[];
begin
  -- a message that was read in the meantime needs no email
  update public.email_queue q set dropped = true, sent_ts = now_ms
   where q.sent_ts is null and q.kind = 'messages' and q.send_after <= now_ms and exists (
     select 1 from public.conversations v join public.profiles pr on pr.user_id = q.user_id
      where v.id = q.conv_id and ((v.c_id = pr.entity_id and v.c_read >= q.created_ts) or ((v.e_id = pr.entity_id or v.c2_id = pr.entity_id) and v.e_read >= q.created_ts)));
  -- suspended or deleted accounts get nothing
  update public.email_queue q set dropped = true, sent_ts = now_ms
   where q.sent_ts is null and q.send_after <= now_ms and not exists (select 1 from public.profiles pr where pr.user_id = q.user_id and not pr.suspended);

  for r in select q.user_id from public.email_queue q where q.sent_ts is null and q.send_after <= now_ms group by q.user_id order by min(q.send_after) limit p_limit loop
    select u.email into addr from auth.users u where u.id = r.user_id;
    tok := (public._email_prefs(r.user_id)).token;
    items := ''; n := 0; kinds := '{}';
    for it in select * from public.email_queue q where q.user_id = r.user_id and q.sent_ts is null and q.send_after <= now_ms order by q.kind = 'matches', q.created_ts limit 30 loop
      n := n + 1;
      if n = 1 then first_text := it.text; first_link := it.link; first_kind := it.kind; end if;
      if not (it.kind = any(kinds)) then kinds := kinds || it.kind; end if;
      items := items || '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f1729">' || case when it.kind = 'announcements' then '<b>' || public._email_esc(split_part(it.text, E'\n', 1)) || '</b><br>' || public._email_esc(substr(it.text, length(split_part(it.text, E'\n', 1)) + 2)) else public._email_esc(it.text) end ||
               case when it.link <> '' then ' <a href="' || site || public._email_esc(it.link) || '" style="color:#1d4ed8;text-decoration:none;white-space:nowrap">Open →</a>' else '' end || '</td></tr>';
    end loop;
    with claimed as (
      update public.email_queue q set sent_ts = now_ms where q.user_id = r.user_id and q.sent_ts is null and q.send_after <= now_ms
        and q.id in (select q2.id from public.email_queue q2 where q2.user_id = r.user_id and q2.sent_ts is null and q2.send_after <= now_ms order by q2.kind = 'matches', q2.created_ts limit 30)
      returning q.id)
    select array_agg(id) into qids from claimed;
    if addr is null or n = 0 then continue; end if;
    subj := case when n = 1 then left(split_part(first_text, E'\n', 1), 120)
                 when kinds = array['matches'] then n || ' new roles match your profile'
                 else 'You have ' || n || ' updates on Arnour' end;
    btn := case when n = 1 and first_link <> '' then site || first_link
                when kinds = array['matches'] then site || '#/c/jobs' else site end;
    footer := '<p style="font-size:12px;color:#64748b;margin-top:24px">You get these emails because you have an Arnour account. ' ||
      '<a href="' || site || '#/account" style="color:#64748b">Manage email settings</a> · ' ||
      case when array_length(kinds,1) = 1 then '<a href="' || site || '#/unsubscribe?t=' || tok || '&amp;k=' || kinds[1] || '" style="color:#64748b">Unsubscribe from these emails</a> · ' else '' end ||
      '<a href="' || site || '#/unsubscribe?t=' || tok || '&amp;k=all" style="color:#64748b">Unsubscribe from all</a></p>';
    out := out || jsonb_build_object('user_id', r.user_id, 'to', addr, 'subject', subj, 'items', n, 'ids', to_jsonb(qids),
      'unsubscribe', site || '#/unsubscribe?t=' || tok || '&k=' || case when array_length(kinds,1) = 1 then kinds[1] else 'all' end,
      'html', '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1729">' ||
        '<div style="font-size:20px;font-weight:700;margin-bottom:16px"><span style="display:inline-block;background:#0f1729;color:#fff;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;margin-right:8px">A</span>Arnour</div>' ||
        '<table style="width:100%;border-collapse:collapse">' || items || '</table>' ||
        '<p style="margin:22px 0"><a href="' || btn || '" style="background:#0f1729;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">' ||
          case when n = 1 and first_kind = 'messages' then 'Open chat' when kinds = array['matches'] then 'View roles' else 'Open Arnour' end || '</a></p>' || footer || '</div>');
  end loop;
  return out;
end $$;

-- ---- who an announcement reaches ----
create or replace function public._ann_match(p_who text, p_country text, p_role text, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as
$$
select exists (
  select 1 from public.profiles pr
  left join public.consultants c on pr.role = 'consultant' and c.id = pr.entity_id
  left join public.companies co on pr.role = 'employer' and co.id = pr.entity_id
  where pr.user_id = p_uid and not pr.suspended
    and (p_who = 'all' or (p_who = 'pros' and pr.role = 'consultant') or (p_who = 'companies' and pr.role = 'employer'))
    and (coalesce(p_country, '') = '' or coalesce(c.data->>'country', co.data->>'country', '') = p_country)
    and (coalesce(p_role, '') = '' or (pr.role = 'consultant' and (c.data->'roleTypes' ? p_role or c.data->>'roleType' = p_role)))
)
$$;

create or replace function public._ann_clean(p_data jsonb) returns jsonb
language plpgsql immutable as
$$
declare d jsonb := coalesce(p_data, '{}'::jsonb); t text := btrim(coalesce(d->>'title', '')); b text := btrim(coalesce(d->>'body', ''));
  l text := btrim(coalesce(d->>'link', '')); ll text := btrim(coalesce(d->>'link_label', '')); w text := coalesce(nullif(d->>'who', ''), 'all');
  c text := btrim(coalesce(d->>'country', '')); r text := btrim(coalesce(d->>'role_type', ''));
  cb boolean := coalesce((d->>'ch_banner')::boolean, false); cl boolean := coalesce((d->>'ch_bell')::boolean, false); ce boolean := coalesce((d->>'ch_email')::boolean, false);
  days int := coalesce(nullif(d->>'banner_days', '')::int, 7);
begin
  if t = '' then raise exception 'Please add a title'; end if;
  if length(t) > 80 then raise exception 'The title is too long (80 characters at most)'; end if;
  if length(b) > 400 then raise exception 'The message is too long (400 characters at most)'; end if;
  if l <> '' and l !~ '^#/[A-Za-z0-9/_?=&.-]*$' then raise exception 'The link must be a page on Arnour, like #/c/jobs'; end if;
  if length(ll) > 30 then raise exception 'The link label is too long (30 characters at most)'; end if;
  if not (cb or cl or ce) then raise exception 'Choose at least one way to reach people'; end if;
  if w not in ('pros', 'companies', 'all') then raise exception 'Unknown audience'; end if;
  if r <> '' and w <> 'pros' then raise exception 'A role type only applies when you send to professionals'; end if;
  if days < 1 or days > 90 then raise exception 'The banner can stay up for 1 to 90 days'; end if;
  return jsonb_build_object('title', t, 'body', b, 'link', l, 'link_label', case when l = '' then '' else coalesce(nullif(ll, ''), 'Learn more') end, 'who', w, 'country', c, 'role_type', r,
    'ch_banner', cb, 'ch_bell', cl, 'ch_email', ce, 'banner_days', days);
end $$;

-- how many people a message would reach (admin)
create or replace function public.admin_announce_count(p_data jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare d jsonb; n int; ne int; np int; nc int;
begin
  perform public._require_admin();
  d := coalesce(p_data, '{}'::jsonb);
  if d ? 'title' then perform public._ann_clean(d); end if;   -- the same checks as sending, so mistakes show up before the review step
  select count(*), count(*) filter (where pr.role = 'consultant'), count(*) filter (where pr.role = 'employer'),
         count(*) filter (where coalesce((select e.announcements from public.email_prefs e where e.user_id = pr.user_id), true))
    into n, np, nc, ne
    from public.profiles pr where public._ann_match(coalesce(nullif(d->>'who', ''), 'all'), coalesce(d->>'country', ''), coalesce(d->>'role_type', ''), pr.user_id);
  return jsonb_build_object('total', n, 'pros', np, 'companies', nc, 'emails', ne);
end $$;

-- send (admin). p_test = true sends only to the admin who is signed in, and is not recorded as an announcement
create or replace function public.admin_announce_send(p_data jsonb, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare d jsonb; a_id bigint; txt text; nb int := 0; ne int := 0; na int := 0; now_ms bigint := (extract(epoch from now())*1000)::bigint; me uuid := auth.uid(); ttl text;
begin
  perform public._require_admin();
  d := public._ann_clean(p_data);
  ttl := case when p_test then '[Test] ' else '' end || (d->>'title');
  txt := left(ttl || case when d->>'body' <> '' then ': ' || (d->>'body') else '' end, 500);
  if p_test then
    if (d->>'ch_bell')::boolean then
      insert into public.notifications(user_key, type, text, link) select pr.entity_id, 'announcement', txt, d->>'link' from public.profiles pr where pr.user_id = me; nb := 1;
    end if;
    if (d->>'ch_email')::boolean then
      insert into public.email_queue(user_id, kind, text, link, send_after) values (me, 'announcements', ttl || E'\n' || (d->>'body'), d->>'link', now_ms); ne := 1;
    end if;
    return jsonb_build_object('test', true, 'bell', nb, 'email', ne, 'hasProfile', exists (select 1 from public.profiles where user_id = me));
  end if;
  select count(*) into na from public.profiles pr where public._ann_match(d->>'who', d->>'country', d->>'role_type', pr.user_id);
  insert into public.announcements(admin, title, body, link, link_label, ch_banner, ch_bell, ch_email, who, country, role_type, banner_until, n_audience)
  values (coalesce((select email from auth.users where id = me), '?'), d->>'title', d->>'body', d->>'link', d->>'link_label',
          (d->>'ch_banner')::boolean, (d->>'ch_bell')::boolean, (d->>'ch_email')::boolean, d->>'who', d->>'country', d->>'role_type',
          case when (d->>'ch_banner')::boolean then now_ms + (d->>'banner_days')::int * 86400000::bigint else 0 end, na)
  returning id into a_id;
  if (d->>'ch_bell')::boolean then
    insert into public.notifications(user_key, type, text, link)
      select pr.entity_id, 'announcement', txt, d->>'link' from public.profiles pr where public._ann_match(d->>'who', d->>'country', d->>'role_type', pr.user_id);
    get diagnostics nb = row_count;
  end if;
  if (d->>'ch_email')::boolean then
    insert into public.email_queue(user_id, kind, text, link, send_after, ann_id)
      select pr.user_id, 'announcements', (d->>'title') || E'\n' || (d->>'body'), d->>'link', now_ms, a_id
        from public.profiles pr
       where public._ann_match(d->>'who', d->>'country', d->>'role_type', pr.user_id)
         and coalesce((select e.announcements from public.email_prefs e where e.user_id = pr.user_id), true);
    get diagnostics ne = row_count;
  end if;
  update public.announcements set n_bell = nb, n_email = ne where id = a_id;
  perform public._audit('announcement sent', a_id::text, (d->>'title') || ' — ' || na || ' people (bell ' || nb || ', email ' || ne || (case when (d->>'ch_banner')::boolean then ', banner' else '' end) || ')');
  return jsonb_build_object('id', a_id, 'audience', na, 'bell', nb, 'email', ne, 'banner', (d->>'ch_banner')::boolean);
end $$;

create or replace function public.admin_announce_list() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare now_ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ts', a.ts, 'admin', a.admin, 'title', a.title, 'body', a.body, 'link', a.link,
      'who', a.who, 'country', a.country, 'role_type', a.role_type, 'ch_banner', a.ch_banner, 'ch_bell', a.ch_bell, 'ch_email', a.ch_email,
      'audience', a.n_audience, 'bell', a.n_bell, 'email', a.n_email, 'withdrawn', a.withdrawn,
      'banner_live', (a.ch_banner and not a.withdrawn and a.banner_until > now_ms), 'banner_until', a.banner_until,
      'email_waiting', (select count(*) from public.email_queue q where q.ann_id = a.id and q.sent_ts is null)) order by a.id desc)
    from (select * from public.announcements order by id desc limit 50) a), '[]'::jsonb);
end $$;

-- end the banner and cancel emails that have not gone out yet (bell notifications already delivered stay)
create or replace function public.admin_announce_withdraw(p_ann_id bigint) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare t text; n int := 0;
begin
  perform public._require_admin();
  update public.announcements set withdrawn = true where id = p_ann_id returning title into t;
  if t is null then raise exception 'Unknown announcement'; end if;
  delete from public.email_queue where ann_id = p_ann_id and sent_ts is null; get diagnostics n = row_count;
  perform public._audit('announcement withdrawn', p_ann_id::text, t);
  return jsonb_build_object('cancelledEmails', n);
end $$;

-- the banner for whoever is signed in (null when there is none for them)
create or replace function public.my_banner() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare a public.announcements; now_ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  if auth.uid() is null then return null; end if;
  for a in select * from public.announcements where ch_banner and not withdrawn and banner_until > now_ms order by id desc limit 5 loop
    if public._ann_match(a.who, a.country, a.role_type, auth.uid()) then
      return jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'link', a.link, 'label', a.link_label);
    end if;
  end loop;
  return null;
end $$;

revoke all on function public._ann_match(text,text,text,uuid), public._ann_clean(jsonb), public.admin_announce_count(jsonb), public.admin_announce_send(jsonb,boolean),
  public.admin_announce_list(), public.admin_announce_withdraw(bigint), public.my_banner() from public, anon, authenticated;
grant execute on function public.admin_announce_count(jsonb), public.admin_announce_send(jsonb,boolean), public.admin_announce_list(), public.admin_announce_withdraw(bigint) to authenticated;
grant execute on function public.my_banner() to anon, authenticated;
-- the replaced 007 functions keep the access they had
revoke all on function public.email_build_batch(int), public._queue_email() from public, anon, authenticated;
grant execute on function public.my_email_prefs(), public.set_email_prefs(jsonb) to authenticated;
grant execute on function public.email_unsubscribe(text, text) to anon, authenticated;
