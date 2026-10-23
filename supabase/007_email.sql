-- =====================================================================
-- 007 · Email notifications
-- Every in-site notification that matters is also queued as an email,
-- following each person's settings. A scheduled job (pg_cron, every
-- 10 minutes) sends what is due through Resend (pg_net). The Resend key
-- is kept in the Supabase Vault under the name 'resend_api_key'; without
-- it nothing is sent and nothing breaks.
-- Texts come from public.notifications, which the server writes itself,
-- so a confidential company or a private professional is never named.
-- Safe to run again.
-- =====================================================================

drop function if exists public.set_email_prefs(jsonb);
create table if not exists public.email_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  matches    text not null default 'daily'   check (matches in ('instant','daily','weekly','off')),
  invites    boolean not null default true,
  messages   boolean not null default true,
  applicants text not null default 'instant' check (applicants in ('instant','daily','off')),
  community  boolean not null default true,
  token      uuid not null default gen_random_uuid() unique
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from anon, authenticated;

create table if not exists public.email_queue (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,                 -- matches | invites | messages | applicants | community
  text       text not null,
  link       text not null default '',
  conv_id    text,
  created_ts bigint not null default (extract(epoch from now())*1000)::bigint,
  send_after bigint not null,
  sent_ts    bigint,
  dropped    boolean not null default false
);
create index if not exists email_queue_due_idx on public.email_queue(send_after) where sent_ts is null;
create index if not exists email_queue_user_idx on public.email_queue(user_id, kind, created_ts);
alter table public.email_queue enable row level security;
revoke all on public.email_queue from anon, authenticated;

create table if not exists public.email_log (
  id      bigserial primary key,
  ts      bigint not null default (extract(epoch from now())*1000)::bigint,
  user_id uuid,
  subject text,
  items   int,
  request bigint
);
alter table public.email_queue add column if not exists tries int not null default 0;
alter table public.email_log add column if not exists queue_ids bigint[];
alter table public.email_log add column if not exists status int;
alter table public.email_log add column if not exists checked boolean not null default false;
create index if not exists email_log_open_idx on public.email_log(id) where not checked;
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- next 08:00 UAE time (04:00 UTC); weekly = next Monday at that time
create or replace function public._email_next_slot(p_weekly boolean) returns bigint
language plpgsql stable as
$$
declare t timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '4 hours';
begin
  if t <= now() then t := t + interval '1 day'; end if;
  if p_weekly then
    while extract(isodow from t at time zone 'UTC') <> 1 loop t := t + interval '1 day'; end loop;
  end if;
  return (extract(epoch from t) * 1000)::bigint;
end $$;

create or replace function public._email_prefs(p_user uuid) returns public.email_prefs
language plpgsql security definer set search_path = public as
$$
declare p public.email_prefs;
begin
  select * into p from public.email_prefs where user_id = p_user;
  if p.user_id is null then
    insert into public.email_prefs(user_id) values (p_user) on conflict (user_id) do nothing;
    select * into p from public.email_prefs where user_id = p_user;
  end if;
  return p;
end $$;

-- which email (if any) a notification becomes
create or replace function public._email_kind(p_text text, p_link text) returns text
language sql immutable as
$$ select case
    when p_text like 'New role matches your profile:%' then 'matches'
    when p_text like '%invited you to apply%' or p_text like '%would like to connect%' or p_text like '%is interested%'
      or p_text like '%accepted your introduction%' or p_text like '% shortlisted you for "%' or p_text like 'The role "%" is now closed. Thank you for applying%' then 'invites'
    when p_link ~ '^#/[ce]/messages/' and (p_text like '%sent you a message' or p_text like '%replied to your message' or p_text like '%proposed a call') then 'messages'
    when p_text like '% applied to "%' then 'applicants'
    when p_text like '%answered your question%' or (p_text like 'Your answer on %' and p_text like '%marked accepted') then 'community'
    else null end $$;

create or replace function public._queue_email() returns trigger
language plpgsql security definer set search_path = public as
$$
declare uid uuid; k text; p public.email_prefs; now_ms bigint := (extract(epoch from now())*1000)::bigint; after bigint; cv text;
begin
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

drop trigger if exists notifications_email on public.notifications;
create trigger notifications_email after insert on public.notifications for each row execute function public._queue_email();

-- ---------- settings (the Account page) ----------
create or replace function public.my_email_prefs() returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare p public.email_prefs;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  p := public._email_prefs(auth.uid());
  return jsonb_build_object('matches', p.matches, 'invites', p.invites, 'messages', p.messages, 'applicants', p.applicants, 'community', p.community,
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
    community  = case when jsonb_typeof(p_data->'community') = 'boolean' then (p_data->>'community')::boolean else community end
  where user_id = auth.uid();
  -- switching a type off also cancels what is still waiting
  delete from public.email_queue q using public.email_prefs e
   where q.user_id = auth.uid() and e.user_id = q.user_id and q.sent_ts is null and (
     (q.kind = 'matches' and e.matches = 'off') or (q.kind = 'applicants' and e.applicants = 'off') or
     (q.kind = 'invites' and not e.invites) or (q.kind = 'messages' and not e.messages) or (q.kind = 'community' and not e.community));
end $$;

-- one-click unsubscribe from the link in every email (no sign-in needed)
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
  else update public.email_prefs set matches = 'off', applicants = 'off', invites = false, messages = false, community = false where user_id = uid; p_kind := 'all';
  end if;
  delete from public.email_queue where user_id = uid and sent_ts is null and (p_kind = 'all' or kind = p_kind);
  return p_kind;
end $$;

-- ---------- building the emails ----------
create or replace function public._email_esc(t text) returns text
language sql immutable as
$$ select replace(replace(replace(replace(coalesce(t,''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;') $$;

-- everything due, one email per person; claims the rows so nothing is sent twice
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
      items := items || '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f1729">' || public._email_esc(it.text) ||
               case when it.link <> '' then ' <a href="' || site || public._email_esc(it.link) || '" style="color:#1d4ed8;text-decoration:none;white-space:nowrap">Open →</a>' else '' end || '</td></tr>';
    end loop;
    with claimed as (
      update public.email_queue q set sent_ts = now_ms where q.user_id = r.user_id and q.sent_ts is null and q.send_after <= now_ms
        and q.id in (select q2.id from public.email_queue q2 where q2.user_id = r.user_id and q2.sent_ts is null and q2.send_after <= now_ms order by q2.kind = 'matches', q2.created_ts limit 30)
      returning q.id)
    select array_agg(id) into qids from claimed;
    if addr is null or n = 0 then continue; end if;
    subj := case when n = 1 then left(first_text, 120)
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

-- the scheduled job: build the batch and hand each email to Resend
create or replace function public.email_run() returns int
language plpgsql security definer set search_path = public as
$$
declare key text; batch jsonb; e jsonb; rid bigint; n int := 0; lg record; st int; ids bigint[];
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''resend_api_key'' limit 1' into key;
  exception when others then key := null; end;
  if key is null or key = '' then return 0; end if;   -- not set up yet: emails wait in the queue
  -- read Resend's answers to earlier sends: anything refused goes back in the queue (up to 3 tries)
  for lg in select * from public.email_log where not checked and request is not null order by id limit 200 loop
    st := null;
    begin
      execute 'select coalesce(status_code, 0) from net._http_response where id = $1' into st using lg.request;
    exception when others then st := null; end;
    if st is null and lg.ts > (extract(epoch from now())*1000)::bigint - 30 * 60000 then continue; end if;  -- no answer yet
    update public.email_log set status = coalesce(st, 0), checked = true where id = lg.id;
    if coalesce(st, 0) not between 200 and 299 then
      update public.email_queue set sent_ts = null, tries = tries + 1 where id = any(lg.queue_ids) and tries < 3 and not dropped;
    end if;
  end loop;
  batch := public.email_build_batch(40);
  for e in select * from jsonb_array_elements(batch) loop
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid using
        'https://api.resend.com/emails',
        jsonb_build_object('from', 'Arnour <notifications@arnour.com>', 'to', jsonb_build_array(e->>'to'), 'subject', e->>'subject', 'html', e->>'html',
                           'headers', jsonb_build_object('List-Unsubscribe', '<' || (e->>'unsubscribe') || '>')),
        jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json');
      ids := array(select jsonb_array_elements_text(coalesce(e->'ids', '[]'::jsonb))::bigint);
      insert into public.email_log(user_id, subject, items, request, queue_ids) values ((e->>'user_id')::uuid, e->>'subject', (e->>'items')::int, rid, ids);
      n := n + 1;
    exception when others then
      ids := array(select jsonb_array_elements_text(coalesce(e->'ids', '[]'::jsonb))::bigint);
      insert into public.email_log(user_id, subject, items, request, queue_ids, status, checked) values ((e->>'user_id')::uuid, 'FAILED: ' || left(sqlerrm, 200), (e->>'items')::int, null, ids, 0, true);
      update public.email_queue set sent_ts = null, tries = tries + 1 where id = any(ids) and tries < 3;
    end;
  end loop;
  -- keep the queue small
  delete from public.email_queue where sent_ts is not null and sent_ts < (extract(epoch from now())*1000)::bigint - 30 * 86400000::bigint;
  return n;
end $$;

revoke all on function public.email_build_batch(int), public.email_run(), public._queue_email(), public._email_prefs(uuid) from public, anon, authenticated;
grant execute on function public.my_email_prefs(), public.set_email_prefs(jsonb) to authenticated;
grant execute on function public.email_unsubscribe(text, text) to anon, authenticated;

-- every 10 minutes (only where pg_cron is switched on)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'arnour-email';
    perform cron.schedule('arnour-email', '*/10 * * * *', 'select public.email_run()');
  end if;
end $cron$;
