-- Release 39: messages from the "Arnour team" (admin) to any professional or company, with replies.
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- A "staff" conversation is an ordinary conversation row that belongs to ONE person (the recipient):
--   * recipient is a professional: c_id = that professional, e_id and c2_id empty  (their side is 'c', the team is side 'e')
--   * recipient is a company:      e_id = that company, c_id and c2_id empty       (their side is 'e', the team is side 'c')
-- The recipient reads it in their normal Messages and can reply with the usual send_message.
-- The admin account is not a marketplace user, so it only ever writes through the admin_staff_* functions below.
-- The recipient sees "Arnour team", never the admin's name or e-mail. Recipients cannot block, report or reveal into it.

-- 1. the flag, and room for a conversation with only one real side
alter table public.conversations add column if not exists staff boolean not null default false;
alter table public.conversations alter column c_id drop not null;
alter table public.conversations drop constraint if exists conv_two_sides;
alter table public.conversations add constraint conv_two_sides check (
  (not staff and c_id is not null and ((e_id is not null and c2_id is null) or (e_id is null and c2_id is not null and c2_id <> c_id)))
  or (staff and c2_id is null and job_id is null and ((c_id is not null and e_id is null) or (c_id is null and e_id is not null)))
);
-- one team conversation per person
create unique index if not exists conv_staff_unique on public.conversations(coalesce(c_id, e_id)) where staff;

-- 2. nobody can block the team (there is no "other person")
create or replace function public._conv_other(v public.conversations) returns text
language sql stable security definer set search_path = public as
$$ select case when v.staff then null
               else case public._conv_side(v) when 'c' then coalesce(v.e_id, v.c2_id) when 'e' then v.c_id end end $$;

-- 3. my_conversations tells the site which conversations come from the team
drop function if exists public.my_conversations();
create or replace function public.my_conversations() returns table(id text, c_id text, e_id text, job_id text, c_read bigint, e_read bigint, last_ts bigint,
  c2_id text, rev_c boolean, rev_e boolean, mine boolean, blocked_by_me boolean, blocked_me boolean, staff boolean)
language sql stable security definer set search_path = public as
$$ select v.id, v.c_id, public._out_eid(v.e_id, v.job_id), v.job_id, v.c_read, v.e_read, v.last_ts,
          v.c2_id, v.rev_c, v.rev_e, v.created_by is not distinct from auth.uid(),
          exists (select 1 from public.blocks b where b.blocker = public.my_entity() and b.blocked = public._conv_other(v)),
          exists (select 1 from public.blocks b where b.blocked = public.my_entity() and b.blocker = public._conv_other(v)),
          v.staff
   from public.conversations v
   where v.c_id = public.my_entity() or v.e_id = public.my_entity() or v.c2_id = public.my_entity() $$;
revoke execute on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- 4. replying to the team: text only (no CV, no call proposal, no identity sharing)
create or replace function public.send_message(p_conv text, p_text text, p_cv jsonb default null, p_call jsonb default null) returns void
language plpgsql security definer set search_path = public as
$$
declare v public.conversations; my_side text; now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  select * into v from public.conversations where id = p_conv;
  if v.id is null then raise exception 'unknown conversation'; end if;
  my_side := public._conv_side(v);
  if my_side is null then raise exception 'not allowed'; end if;
  if public._blocked(my_entity(), public._conv_other(v)) then raise exception 'conversation closed'; end if;
  -- until the other side replies, the person who started the conversation can send 2 messages
  if v.created_by = auth.uid()
     and not exists (select 1 from public.messages m where m.conv_id = p_conv and m.side <> my_side)
     and (select count(*) from public.messages where conv_id = p_conv) >= 2 then
    raise exception 'wait for a reply: you can send 2 messages until they answer';
  end if;
  if v.c2_id is not null or v.staff then p_cv := null; end if;  /* CVs are shared with companies only */
  if v.staff then p_call := null; end if;                        /* no call proposals to the team */
  -- an attached CV must be a file the sender uploaded to their own folder
  if my_side <> 'c' or p_cv is null or jsonb_typeof(p_cv) <> 'object' or coalesce(p_cv->>'path','') not like auth.uid()::text || '/%' then
    p_cv := case when my_side = 'c' and p_cv is not null and jsonb_typeof(p_cv) = 'boolean' then p_cv else null end;
  end if;
  if p_call is not null then
    if jsonb_typeof(p_call) <> 'object' then p_call := null;
    else p_call := jsonb_set(p_call, '{status}', '"proposed"'); end if;
  end if;
  if char_length(coalesce(p_text,'')) = 0 and p_cv is null and p_call is null then return; end if;
  if my_side = 'c' and v.c2_id is null and not v.staff and p_cv is not null and jsonb_typeof(p_cv) = 'object' then
    update public.conversations set rev_c = true where id = p_conv;  /* a CV shows the name, so sending it shares the identity */
  end if;
  insert into public.messages(conv_id, side, text, ts, cv, call) values (p_conv, my_side, left(coalesce(p_text,''), 6000), now_ms, p_cv, p_call);
  update public.conversations set last_ts = now_ms,
         c_read = case when my_side = 'c' then now_ms else c_read end,
         e_read = case when my_side = 'e' then now_ms else e_read end where id = p_conv;
end $$;

-- 5. the team writes (first message or follow-up): p_target is a professional's or a company's id
create or replace function public.admin_staff_send(p_target text, p_text text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare k text; kind text; cvid text; ss text; txt text := btrim(coalesce(p_text, '')); owner_id uuid; nm text;
        now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  perform public._require_admin();
  if txt = '' then raise exception 'write a message first'; end if;
  if char_length(txt) > 2000 then raise exception 'too long: up to 2000 characters'; end if;
  k := public.resolve_eid(btrim(coalesce(p_target, '')));
  if k is null then raise exception 'unknown profile'; end if;
  if exists (select 1 from public.consultants where id = k) then
    kind := 'c'; select owner into owner_id from public.consultants where id = k;
    select coalesce(nullif(btrim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')), ''), 'Professional') into nm from public.consultants where id = k;
  elsif exists (select 1 from public.companies where id = k) then
    kind := 'e'; select owner into owner_id from public.companies where id = k;
    select coalesce(nullif(data->>'name',''), 'Company') into nm from public.companies where id = k;
  else raise exception 'unknown profile'; end if;
  if owner_id is null then raise exception 'this profile has no account to message'; end if;
  if (select count(*) from public.messages m join public.conversations v on v.id = m.conv_id
       where v.staff and m.side = case when v.c_id is not null then 'e' else 'c' end and m.ts > now_ms - 3600000) >= 100 then
    raise exception 'too many messages in the last hour, try again later';
  end if;
  ss := case when kind = 'c' then 'e' else 'c' end;   -- the team is the side the recipient is not
  select id into cvid from public.conversations where staff and coalesce(c_id, e_id) = k;
  if cvid is null then
    cvid := 'cv' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.conversations(id, c_id, e_id, staff, created_by) values (cvid, case when kind = 'c' then k end, case when kind = 'e' then k end, true, auth.uid());
  end if;
  insert into public.messages(conv_id, side, text, ts) values (cvid, ss, txt, now_ms);
  update public.conversations set last_ts = now_ms,
         c_read = case when ss = 'c' then now_ms else c_read end,
         e_read = case when ss = 'e' then now_ms else e_read end where id = cvid;
  insert into public.notifications(user_key, type, text, link)
  values (k, 'msg', 'Arnour team sent you a message', '#/' || case when kind = 'c' then 'c' else 'e' end || '/messages/' || cvid);
  perform public._audit('staff message', k, '');
  return jsonb_build_object('conv', cvid, 'name', nm);
end $$;

-- 6. the team's inbox: every conversation, newest first, with how many replies are unread
create or replace function public.admin_staff_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare out jsonb;
begin
  perform public._require_admin();
  select coalesce(jsonb_agg(x order by (x->>'lastTs')::bigint desc), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'id', v.id,
      'kind', case when v.c_id is not null then 'professional' else 'company' end,
      'entity', coalesce(v.c_id, v.e_id),
      'name', case when v.c_id is not null
                   then coalesce((select nullif(btrim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), '') from public.consultants c where c.id = v.c_id), 'Professional')
                   else coalesce((select nullif(co.data->>'name','') from public.companies co where co.id = v.e_id), 'Company') end,
      'lastTs', v.last_ts,
      'last', (select left(m.text, 140) from public.messages m where m.conv_id = v.id and not m.deleted order by m.ts desc limit 1),
      'fromThem', coalesce((select m.side = case when v.c_id is not null then 'c' else 'e' end from public.messages m where m.conv_id = v.id order by m.ts desc limit 1), false),
      'unread', (select count(*) from public.messages m where m.conv_id = v.id and not m.deleted
                   and m.side = case when v.c_id is not null then 'c' else 'e' end
                   and m.ts > case when v.c_id is not null then v.e_read else v.c_read end)
    ) x
    from public.conversations v where v.staff order by v.last_ts desc limit 200
  ) s;
  return out;
end $$;

create or replace function public.admin_staff_unread() returns int
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return (select count(*)::int from public.conversations v where v.staff and exists (
            select 1 from public.messages m where m.conv_id = v.id and not m.deleted
               and m.side = case when v.c_id is not null then 'c' else 'e' end
               and m.ts > case when v.c_id is not null then v.e_read else v.c_read end));
end $$;

-- 7. open one conversation (marks the replies as read)
create or replace function public.admin_staff_thread(p_conv text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare v public.conversations; theirs text; now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint; nm text;
begin
  perform public._require_admin();
  select * into v from public.conversations where id = p_conv and staff;
  if v.id is null then raise exception 'not found'; end if;
  theirs := case when v.c_id is not null then 'c' else 'e' end;
  if theirs = 'c' then update public.conversations set e_read = now_ms where id = v.id;
  else update public.conversations set c_read = now_ms where id = v.id; end if;
  nm := case when v.c_id is not null
             then coalesce((select nullif(btrim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), '') from public.consultants c where c.id = v.c_id), 'Professional')
             else coalesce((select nullif(co.data->>'name','') from public.companies co where co.id = v.e_id), 'Company') end;
  return jsonb_build_object('id', v.id, 'name', nm, 'entity', coalesce(v.c_id, v.e_id), 'kind', case when theirs = 'c' then 'professional' else 'company' end,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('mine', m.side <> theirs, 'text', m.text, 'ts', m.ts, 'deleted', m.deleted) order by m.ts, m.id)
                          from public.messages m where m.conv_id = v.id), '[]'::jsonb));
end $$;

revoke execute on function public.admin_staff_send(text, text), public.admin_staff_inbox(), public.admin_staff_unread(), public.admin_staff_thread(text) from public, anon;
grant execute on function public.admin_staff_send(text, text), public.admin_staff_inbox(), public.admin_staff_unread(), public.admin_staff_thread(text) to authenticated;

select 'ok' as release39;
