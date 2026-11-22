-- release 56: "Save and finish later" for professionals. Run once in the Supabase SQL Editor. Safe to run twice.
--
-- What it adds
--   * A person can now save a profile without SAP skills. A profile is "ready" once it has at least one skill row with a product and a module.
--   * Admin > Unfinished: a counter and a list of (1) accounts with no profile yet and (2) professional profiles saved without SAP skills.
--   * Reminder e-mails for the second group: about 2 hours after the profile was saved (if it still has no SAP skills, and only for people
--     with a confirmed e-mail), plus one more about 3 days after the first was sent. Same rules as release 42: nothing is sent until you press
--     Send in Admin > Reminders; people who unsubscribed from all, are suspended or add skills are never sent one. Two new editable texts.
--   * The existing sign-up reminders are unchanged (they get the label "signup").
-- Nothing is sent by running this file.

-- a profile is ready for matching when it has at least one skill with a product and a module
create or replace function public._profile_ready(p jsonb) returns boolean
language plpgsql immutable set search_path = public as
$$
begin
  if p is null or jsonb_typeof(p->'skills') is distinct from 'array' then return false; end if;
  return exists (select 1 from jsonb_array_elements(p->'skills') k
                  where jsonb_typeof(k) = 'object' and coalesce(k->>'productId', '') <> '' and coalesce(k->>'moduleId', '') <> '');
end $$;

-- reminders: a second kind ("skills") next to the sign-up reminders
alter table public.reminders add column if not exists kind text not null default 'signup';
alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check check (kind in ('signup', 'skills'));
alter table public.reminders drop constraint if exists reminders_user_id_step_key;
create unique index if not exists reminders_user_kind_step_idx on public.reminders(user_id, kind, step);

alter table public.reminder_texts drop constraint if exists reminder_texts_key_check;
alter table public.reminder_texts add constraint reminder_texts_key_check
  check (key in ('consultant1', 'consultant2', 'employer1', 'employer2', 'any1', 'any2', 'skills1', 'skills2'));
insert into public.reminder_texts(key, subject, body) values
 ('skills1', 'Add your SAP skills to see your matches',
  E'Thanks for creating your Arnour profile.\n\nYour profile is saved, but it has no SAP products or modules yet, so we cannot show you how well you match open roles. It takes about 3 minutes: add the SAP products and modules you work with, and every role gets a match percentage.\n\nYou stay anonymous until you agree to an introduction.'),
 ('skills2', 'Your Arnour matches are waiting',
  E'A quick reminder: your Arnour profile has no SAP skills yet, so we cannot match you to open roles. Add your products and modules in about 3 minutes.\n\nThis is the last email we will send about it.')
on conflict (key) do nothing;

-- find people to remind (every 5 minutes): now also the 'skills' reminders
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
     and not exists (select 1 from public.reminders r where r.user_id = u.id and r.kind = 'signup')
     and not public._reminder_opted_out(u.id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- step 2: the first reminder was sent more than 3 days ago and there is still no profile
  insert into public.reminders(user_id, step, role, src)
  select r.user_id, 2, r.role, r.src from public.reminders r
   where r.kind = 'signup' and r.step = 1 and r.status = 'sent' and r.sent_ts < now_ms - 3 * 86400000
     and not exists (select 1 from public.profiles p where p.user_id = r.user_id)
     and not exists (select 1 from public.reminders r2 where r2.user_id = r.user_id and r2.kind = 'signup' and r2.step = 2)
     and not public._reminder_opted_out(r.user_id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- skills step 1: a profile saved more than 2 hours ago (within the last 3 days) that still has no SAP skills
  insert into public.reminders(user_id, kind, step, role, src)
  select p.user_id, 'skills', 1, 'consultant',
         left(coalesce(nullif(regexp_replace(lower(coalesce(u.raw_user_meta_data->'ft'->>'b', 'direct')), '[^a-z0-9_-]', '', 'g'), ''), 'direct'), 20)
    from public.profiles p
    join public.consultants cs on cs.id = p.entity_id
    join auth.users u on u.id = p.user_id
   where p.role = 'consultant' and not coalesce(p.suspended, false) and not coalesce(cs.sample, false)
     and u.email_confirmed_at is not null
     and p.created_at < now() - interval '2 hours' and p.created_at > now() - interval '3 days'
     and not public._profile_ready(cs.data)
     and not exists (select 1 from public.admin_emails a where lower(a.email) = lower(u.email))
     and not exists (select 1 from public.reminders r where r.user_id = p.user_id and r.kind = 'skills')
     and not public._reminder_opted_out(p.user_id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- skills step 2: the first one was sent more than 3 days ago and there are still no SAP skills
  insert into public.reminders(user_id, kind, step, role, src)
  select r.user_id, 'skills', 2, r.role, r.src from public.reminders r
   where r.kind = 'skills' and r.step = 1 and r.status = 'sent' and r.sent_ts < now_ms - 3 * 86400000
     and not coalesce((select public._profile_ready(cs.data) from public.profiles p join public.consultants cs on cs.id = p.entity_id where p.user_id = r.user_id), true)
     and not exists (select 1 from public.reminders r2 where r2.user_id = r.user_id and r2.kind = 'skills' and r2.step = 2)
     and not public._reminder_opted_out(r.user_id)
  on conflict do nothing;
  get diagnostics c = row_count; n := n + c;
  -- housekeeping: finished profiles, and approvals nobody gave within 3 days
  update public.reminders r set status = 'done', decided_ts = coalesce(decided_ts, now_ms)
   where r.status in ('pending', 'approved')
     and ((r.kind = 'signup' and exists (select 1 from public.profiles p where p.user_id = r.user_id))
       or (r.kind = 'skills' and coalesce((select public._profile_ready(cs.data) from public.profiles p join public.consultants cs on cs.id = p.entity_id where p.user_id = r.user_id), true)));
  update public.reminders set status = 'expired', decided_ts = now_ms
   where status = 'pending' and created_ts < now_ms - 3 * 86400000;
  return n;
end $$;

-- send what you approved: now also the 'skills' reminders
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
    if addr is null
       or (r.kind = 'signup' and exists (select 1 from public.profiles p where p.user_id = r.user_id))
       or (r.kind = 'skills' and coalesce((select public._profile_ready(c.data) from public.profiles p join public.consultants c on c.id = p.entity_id where p.user_id = r.user_id), true)) then
      update public.reminders set status = 'done', decided_ts = coalesce(decided_ts, now_ms) where id = r.id; continue; end if;
    if public._reminder_opted_out(r.user_id) then update public.reminders set status = 'skipped', decided_ts = now_ms where id = r.id; continue; end if;
    tk := case when r.kind = 'skills' then 'skills' else r.role end || r.step::text;
    select * into tx from public.reminder_texts where key = tk;
    if tx.key is null then select * into tx from public.reminder_texts where key = 'any' || r.step::text; end if;
    if tx.key is null then continue; end if;
    link := site || case when r.kind = 'skills' then '#/c/dashboard' else case r.role when 'consultant' then '#/onboard' when 'employer' then '#/onboard-e' else '' end end;
    tok := (public._email_prefs(r.user_id)).token;
    unsub := site || '#/unsubscribe?t=' || tok || '&k=all';
    paras := (select string_agg('<p style="margin:0 0 14px;font-size:15px;line-height:1.5">' || public._email_esc(p) || '</p>', '')
                from unnest(regexp_split_to_array(replace(tx.body, E'\r', ''), E'\n\n+')) p where btrim(p) <> '');
    html := '<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1729">' ||
      '<div style="font-size:20px;font-weight:700;margin-bottom:16px"><span style="display:inline-block;background:#0f1729;color:#fff;border-radius:8px;width:28px;height:28px;text-align:center;line-height:28px;margin-right:8px">A</span>Arnour</div>' ||
      replace(paras, E'\n', '<br>') ||
      '<p style="margin:22px 0"><a href="' || link || '" style="background:#0f1729;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">' ||
        case when r.kind = 'skills' then 'Add my SAP skills' when r.role = 'employer' then 'Finish my company profile' else 'Finish my profile' end || '</a></p>' ||
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

-- admin list of reminders: now with the kind
create or replace function public.admin_reminders() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare ready boolean := false;
begin
  perform public._require_admin();
  begin execute 'select exists (select 1 from vault.decrypted_secrets where name = ''resend_api_key'')' into ready;
  exception when others then ready := false; end;
  return jsonb_build_object(
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'step', r.step, 'role', r.role, 'src', r.src, 'email', u.email,
                    'confirmedTs', (extract(epoch from u.email_confirmed_at)*1000)::bigint, 'createdTs', r.created_ts) order by r.created_ts)
                  from public.reminders r join auth.users u on u.id = r.user_id where r.status = 'pending'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by (x->>'ts')::bigint desc) from (
                  select jsonb_build_object('id', r.id, 'kind', r.kind, 'step', r.step, 'role', r.role, 'src', r.src, 'email', u.email, 'status', r.status,
                         'ts', coalesce(r.sent_ts, r.decided_ts, r.created_ts)) x
                    from public.reminders r join auth.users u on u.id = r.user_id where r.status <> 'pending'
                   order by coalesce(r.sent_ts, r.decided_ts, r.created_ts) desc limit 50) q), '[]'::jsonb),
    'texts', coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'subject', t.subject, 'body', t.body) order by t.key) from public.reminder_texts t), '[]'::jsonb),
    'ready', ready);
end $$;

-- Admin > Unfinished -----------------------------------------------------------------------------------------------
-- stage 'noprofile' = signed up, no profile; 'noskills' = professional profile saved without SAP skills
create or replace function public.admin_unfinished() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare res jsonb;
begin
  perform public._require_admin();
  with np as (
    select 'noprofile'::text as stage, null::text as eid, u.id as uid, u.email::text as email, ''::text as name, ''::text as headline,
           case coalesce(u.raw_user_meta_data->>'role', '') when 'consultant' then 'c' when 'c' then 'c' when 'employer' then 'e' when 'e' then 'e' else '' end as who,
           left(coalesce(nullif(regexp_replace(lower(coalesce(u.raw_user_meta_data->'ft'->>'b', 'direct')), '[^a-z0-9_-]', '', 'g'), ''), 'direct'), 20) as src,
           (extract(epoch from u.created_at) * 1000)::bigint as ts, (u.email_confirmed_at is not null) as confirmed,
           '[]'::jsonb as missing, ''::text as country, ''::text as role_type
      from auth.users u
     where not exists (select 1 from public.profiles p where p.user_id = u.id)
       and not exists (select 1 from public.admin_emails a where lower(a.email) = lower(u.email))
  ), ns as (
    select 'noskills'::text, c.id, p.user_id, u.email::text,
           btrim(coalesce(c.data->>'firstName', '') || ' ' || coalesce(c.data->>'lastName', '')), coalesce(c.data->>'headline', ''),
           'c'::text,
           left(coalesce(nullif(regexp_replace(lower(coalesce(u.raw_user_meta_data->'ft'->>'b', 'direct')), '[^a-z0-9_-]', '', 'g'), ''), 'direct'), 20),
           (extract(epoch from p.created_at) * 1000)::bigint, (u.email_confirmed_at is not null),
           jsonb_build_array('SAP skills')
             || case when btrim(coalesce(c.data->>'summary', '')) = '' then jsonb_build_array('About you') else '[]'::jsonb end
             || case when c.data->'cv' is null or c.data->'cv' = 'null'::jsonb then jsonb_build_array('CV') else '[]'::jsonb end,
           coalesce(c.data->>'country', ''), coalesce(c.data->>'roleType', '')
      from public.profiles p
      join public.consultants c on c.id = p.entity_id
      join auth.users u on u.id = p.user_id
     where p.role = 'consultant' and not coalesce(c.sample, false) and not public._profile_ready(c.data)
  ), allr as (select * from np union all select * from ns)
  select jsonb_build_object(
    'noProfile', (select count(*) from allr where stage = 'noprofile' and who <> 'e'),
    'noProfileCompany', (select count(*) from allr where stage = 'noprofile' and who = 'e'),
    'noSkills', (select count(*) from allr where stage = 'noskills'),
    'rows', coalesce((select jsonb_agg(x order by (x->>'ts')::bigint desc) from (
        select jsonb_build_object('stage', a.stage, 'id', a.eid, 'userId', a.uid, 'email', a.email, 'name', a.name, 'headline', a.headline, 'who', a.who,
                 'src', a.src, 'ts', a.ts, 'confirmed', a.confirmed, 'missing', a.missing, 'country', a.country, 'roleType', a.role_type,
                 'rem', (select jsonb_build_object('kind', r.kind, 'step', r.step, 'status', r.status)
                           from public.reminders r where r.user_id = a.uid order by r.created_ts desc, r.id desc limit 1)) x
          from allr a order by a.ts desc limit 300) q), '[]'::jsonb))
    into res;
  return res;
end $$;

-- the number for the tab badge and the overview card
create or replace function public.admin_unfinished_count() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'noProfile', (select count(*) from auth.users u
                   where not exists (select 1 from public.profiles p where p.user_id = u.id)
                     and not exists (select 1 from public.admin_emails a where lower(a.email) = lower(u.email))
                     and coalesce(u.raw_user_meta_data->>'role', '') not in ('employer', 'e')),
    'noSkills', (select count(*) from public.profiles p join public.consultants c on c.id = p.entity_id
                  where p.role = 'consultant' and not coalesce(c.sample, false) and not public._profile_ready(c.data)));
end $$;

revoke all on function public._profile_ready(jsonb) from public, anon, authenticated;
revoke all on function public.reminders_scan(), public.reminders_run() from public, anon, authenticated;
revoke execute on function public.admin_unfinished(), public.admin_unfinished_count(), public.admin_reminders() from public, anon;
grant execute on function public.admin_unfinished(), public.admin_unfinished_count(), public.admin_reminders() to authenticated;

select 'ok' as release56;
