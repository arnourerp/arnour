-- Release 42: reminder e-mails for people who signed up but did not finish their profile.
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- How it works
--   * Every 5 minutes the database looks for accounts whose e-mail was confirmed more than 2 hours ago and that still
--     have no profile. Each one is put on the "Reminders" list in Admin as WAITING FOR YOUR APPROVAL.
--   * Nothing is sent until you press Send (or Send all). Skip removes it.
--   * One reminder per person, plus one more about 3 days after the first was sent (also needs your approval).
--   * Waiting items that nobody approved within 3 days expire. People who finish their profile, are suspended or have
--     unsubscribed ("Unsubscribe from all") are never sent a reminder.
--   * The texts are stored here and can be edited in Admin. Same sender as the other Arnour e-mails.
-- It does not touch the existing e-mail queue, which ignores accounts without a profile.

create table if not exists public.reminders (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  step        int  not null check (step in (1, 2)),
  role        text not null default 'any' check (role in ('consultant', 'employer', 'any')),
  src         text not null default 'direct',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'sent', 'skipped', 'expired', 'done', 'failed')),
  created_ts  bigint not null default (extract(epoch from now())*1000)::bigint,
  decided_ts  bigint,
  sent_ts     bigint,
  request     bigint,
  checked     boolean not null default false,
  tries       int not null default 0,
  unique (user_id, step)
);
create index if not exists reminders_status_idx on public.reminders(status);
alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated, public;

create table if not exists public.reminder_texts (
  key     text primary key check (key in ('consultant1', 'consultant2', 'employer1', 'employer2', 'any1', 'any2')),
  subject text not null check (char_length(subject) between 1 and 120),
  body    text not null check (char_length(body) between 1 and 1500)
);
alter table public.reminder_texts enable row level security;
revoke all on public.reminder_texts from anon, authenticated, public;

insert into public.reminder_texts(key, subject, body) values
 ('consultant1', 'Your Arnour profile is almost ready',
  E'Thanks for joining Arnour.\n\nYour account is ready, but your profile is not finished yet, so recommended roles cannot be matched to you. It takes about 5 minutes: add your SAP products and modules, or upload your CV and we will fill most of it in for you.\n\nYou stay anonymous until you agree to an introduction.'),
 ('consultant2', 'Still want to finish your Arnour profile?',
  E'A quick reminder: your Arnour account is waiting for a profile. It takes about 5 minutes, and then we can show you SAP roles that match your skills.\n\nThis is the last email we will send about it.'),
 ('employer1', 'Finish setting up your company on Arnour',
  E'Thanks for joining Arnour.\n\nYour account is ready, but your company profile is not finished yet. It takes a few minutes, and then you can post a role and see SAP professionals matched on exact product and module.'),
 ('employer2', 'Your Arnour company profile is still waiting',
  E'A quick reminder: your company profile on Arnour is not finished yet. Once it is, you can post a role and see matching SAP professionals.\n\nThis is the last email we will send about it.'),
 ('any1', 'Finish setting up your Arnour account',
  E'Thanks for joining Arnour.\n\nYour account is ready, but your profile is not finished yet. It only takes a few minutes.'),
 ('any2', 'Your Arnour account is still waiting',
  E'A quick reminder: your Arnour profile is not finished yet. It only takes a few minutes.\n\nThis is the last email we will send about it.')
on conflict (key) do nothing;

-- true when the person pressed "Unsubscribe from all" in an Arnour e-mail
create or replace function public._reminder_opted_out(p_user uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.email_prefs e where e.user_id = p_user
     and e.matches = 'off' and e.applicants = 'off' and not e.invites and not e.messages and not e.community) $$;

-- 1. find people to remind (runs every 5 minutes)
create or replace function public.reminders_scan() returns int
language plpgsql security definer set search_path = public, auth as
$$
declare now_ms bigint := (extract(epoch from now())*1000)::bigint; n int := 0; c int;
begin
  -- step 1: confirmed more than 2 hours ago (but within the last 3 days), still no profile
  insert into public.reminders(user_id, step, role, src)
  select u.id, 1,
         case u.raw_user_meta_data->>'role' when 'consultant' then 'consultant' when 'employer' then 'employer' else 'any' end,
         left(coalesce(nullif(regexp_replace(lower(coalesce(u.raw_user_meta_data->'ft'->>'b', 'direct')), '[^a-z0-9_-]', '', 'g'), ''), 'direct'), 20)
    from auth.users u
   where u.email_confirmed_at is not null
     and u.email_confirmed_at < now() - interval '2 hours' and u.email_confirmed_at > now() - interval '3 days'
     and not exists (select 1 from public.profiles p where p.user_id = u.id)
     and not exists (select 1 from public.admin_emails a where lower(a.email) = lower(u.email))
     and not exists (select 1 from public.reminders r where r.user_id = u.id)
     and not public._reminder_opted_out(u.id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- step 2: the first reminder was sent more than 3 days ago and there is still no profile
  insert into public.reminders(user_id, step, role, src)
  select r.user_id, 2, r.role, r.src from public.reminders r
   where r.step = 1 and r.status = 'sent' and r.sent_ts < now_ms - 3 * 86400000
     and not exists (select 1 from public.profiles p where p.user_id = r.user_id)
     and not exists (select 1 from public.reminders r2 where r2.user_id = r.user_id and r2.step = 2)
     and not public._reminder_opted_out(r.user_id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- housekeeping: finished profiles, and approvals nobody gave within 3 days
  update public.reminders r set status = 'done', decided_ts = coalesce(decided_ts, now_ms)
   where r.status in ('pending', 'approved') and exists (select 1 from public.profiles p where p.user_id = r.user_id);
  update public.reminders set status = 'expired', decided_ts = now_ms
   where status = 'pending' and created_ts < now_ms - 3 * 86400000;
  return n;
end $$;

-- 2. send what you approved
create or replace function public.reminders_run() returns int
language plpgsql security definer set search_path = public, auth as
$$
declare api_key text; now_ms bigint := (extract(epoch from now())*1000)::bigint; r record; lg record; st int; rid bigint; n int := 0;
  addr text; tok uuid; tx public.reminder_texts; tk text; site text := 'https://arnour.com/'; link text; paras text; unsub text; html text;
begin
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = ''resend_api_key'' limit 1' into api_key;
  exception when others then api_key := null; end;
  if api_key is null or api_key = '' then return 0; end if;   -- not set up: approved reminders wait
  -- Resend's answer to earlier sends: refused ones go back to "approved" (up to 3 tries), then "failed"
  for lg in select * from public.reminders where status = 'sent' and not checked and request is not null order by id limit 100 loop
    st := null;
    begin execute 'select coalesce(status_code, 0) from net._http_response where id = $1' into st using lg.request;
    exception when others then st := null; end;
    if st is null and lg.sent_ts > now_ms - 30 * 60000 then continue; end if;
    if coalesce(st, 0) between 200 and 299 then update public.reminders set checked = true where id = lg.id;
    elsif lg.tries < 3 then update public.reminders set status = 'approved', checked = false, request = null, tries = tries + 1 where id = lg.id;
    else update public.reminders set status = 'failed', checked = true where id = lg.id; end if;
  end loop;
  for r in select * from public.reminders where status = 'approved' order by id limit 20 loop
    select u.email into addr from auth.users u where u.id = r.user_id and u.email_confirmed_at is not null;
    if addr is null or exists (select 1 from public.profiles p where p.user_id = r.user_id) then
      update public.reminders set status = 'done', decided_ts = coalesce(decided_ts, now_ms) where id = r.id; continue; end if;
    if public._reminder_opted_out(r.user_id) then update public.reminders set status = 'skipped', decided_ts = now_ms where id = r.id; continue; end if;
    tk := r.role || r.step::text;
    select * into tx from public.reminder_texts where key = tk;
    if tx.key is null then select * into tx from public.reminder_texts where key = 'any' || r.step::text; end if;
    if tx.key is null then continue; end if;
    link := site || case r.role when 'consultant' then '#/onboard' when 'employer' then '#/onboard-e' else '' end;
    tok := (public._email_prefs(r.user_id)).token;
    unsub := site || '#/unsubscribe?t=' || tok || '&k=all';
    paras := (select string_agg('<p style="margin:0 0 14px;font-size:15px;line-height:1.5">' || public._email_esc(p) || '</p>', '')
                from unnest(regexp_split_to_array(replace(tx.body, E'\r', ''), E'\n\n+')) p where btrim(p) <> '');
    html := '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1729">' ||
      '<div style="font-size:20px;font-weight:700;margin-bottom:16px"><span style="display:inline-block;background:#0f1729;color:#fff;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;margin-right:8px">A</span>Arnour</div>' ||
      replace(paras, E'\n', '<br>') ||
      '<p style="margin:22px 0"><a href="' || link || '" style="background:#0f1729;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">' ||
        case r.role when 'employer' then 'Finish my company profile' else 'Finish my profile' end || '</a></p>' ||
      '<p style="font-size:12px;color:#64748b;margin-top:24px">You get this email because you created an Arnour account. <a href="' || unsub || '" style="color:#64748b">Unsubscribe</a></p></div>';
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid using
        'https://api.resend.com/emails',
        jsonb_build_object('from', 'Arnour <notifications@arnour.com>', 'to', jsonb_build_array(addr), 'subject', tx.subject, 'html', html,
                           'headers', jsonb_build_object('List-Unsubscribe', '<' || unsub || '>')),
        jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json');
      update public.reminders set status = 'sent', sent_ts = now_ms, request = rid, checked = false where id = r.id;
      n := n + 1;
    exception when others then
      update public.reminders set tries = tries + 1, status = case when tries + 1 >= 3 then 'failed' else status end where id = r.id;
    end;
  end loop;
  return n;
end $$;

-- 3. admin screens
create or replace function public.admin_reminders_count() returns int
language plpgsql stable security definer set search_path = public as
$$ begin perform public._require_admin(); return (select count(*) from public.reminders where status = 'pending'); end $$;

create or replace function public.admin_reminders() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare ready boolean := false;
begin
  perform public._require_admin();
  begin execute 'select exists (select 1 from vault.decrypted_secrets where name = ''resend_api_key'')' into ready;
  exception when others then ready := false; end;
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'step', r.step, 'role', r.role, 'src', r.src, 'email', u.email,
                    'confirmedTs', (extract(epoch from u.email_confirmed_at)*1000)::bigint, 'createdTs', r.created_ts) order by r.created_ts)
                  from public.reminders r join auth.users u on u.id = r.user_id where r.status = 'pending'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by (x->>'ts')::bigint desc) from (
                  select jsonb_build_object('id', r.id, 'step', r.step, 'role', r.role, 'src', r.src, 'email', u.email, 'status', r.status,
                         'ts', coalesce(r.sent_ts, r.decided_ts, r.created_ts)) x
                    from public.reminders r join auth.users u on u.id = r.user_id where r.status <> 'pending'
                   order by coalesce(r.sent_ts, r.decided_ts, r.created_ts) desc limit 50) q), '[]'::jsonb),
    'texts', coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'subject', t.subject, 'body', t.body) order by t.key) from public.reminder_texts t), '[]'::jsonb),
    'ready', ready);
end $$;

-- approve or skip (a list of ids); approved ones are sent at once
create or replace function public.admin_reminder_decide(p_ids bigint[], p_action text) returns int
language plpgsql security definer set search_path = public as
$$
declare now_ms bigint := (extract(epoch from now())*1000)::bigint; c int;
begin
  perform public._require_admin();
  if p_action not in ('approve', 'skip') then raise exception 'unknown action'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then raise exception 'nothing selected'; end if;
  update public.reminders set status = case when p_action = 'approve' then 'approved' else 'skipped' end, decided_ts = now_ms
   where id = any(p_ids) and status = 'pending';
  get diagnostics c = row_count;
  perform public._audit('reminder ' || p_action, c::text, '');
  if p_action = 'approve' then begin perform public.reminders_run(); exception when others then null; end; end if;
  return c;
end $$;

create or replace function public.admin_reminder_text_save(p_key text, p_subject text, p_body text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  if btrim(coalesce(p_subject, '')) = '' or btrim(coalesce(p_body, '')) = '' then raise exception 'subject and text are required'; end if;
  update public.reminder_texts set subject = left(btrim(p_subject), 120), body = left(btrim(p_body), 1500) where key = p_key;
  if not found then raise exception 'unknown text'; end if;
  perform public._audit('reminder text', p_key, '');
end $$;

revoke all on function public._reminder_opted_out(uuid), public.reminders_scan(), public.reminders_run() from public, anon, authenticated;
revoke execute on function public.admin_reminders_count(), public.admin_reminders(), public.admin_reminder_decide(bigint[], text),
  public.admin_reminder_text_save(text, text, text) from public, anon;
grant execute on function public.admin_reminders_count(), public.admin_reminders(), public.admin_reminder_decide(bigint[], text),
  public.admin_reminder_text_save(text, text, text) to authenticated;

-- every 5 minutes (only where pg_cron is switched on)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'arnour-reminders';
    perform cron.schedule('arnour-reminders', '*/5 * * * *', 'select public.reminders_scan(); select public.reminders_run()');
  end if;
end $cron$;

select 'ok' as release42;
