-- Release 37: contact email for companies + in-app messages between a customer and a partner after the partner accepted.
-- Run once in the Supabase SQL Editor. Safe to run twice.

-- 1. the e-mail a company shares: its own "contactEmail" (company data) when valid, else the sign-in address
create or replace function public._contact_mail(co public.companies) returns text
language plpgsql stable security definer set search_path = public as
$$
declare m text := lower(btrim(coalesce(co.data->>'contactEmail', '')));
begin
  if m ~ '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$' and length(m) <= 120 then return m; end if;
  if co.owner is null then return null; end if;
  return (select u.email from auth.users u where u.id = co.owner);
end $$;

-- 2. messages on an accepted request
alter table public.partner_requests add column if not exists from_read bigint not null default 0;
alter table public.partner_requests add column if not exists to_read bigint not null default 0;
create table if not exists public.partner_messages (
  id      uuid primary key default gen_random_uuid(),
  req_id  text not null references public.partner_requests(id) on delete cascade,
  side    text not null check (side in ('from','to')),     -- from = the SAP Customer, to = the partner
  text    text not null check (char_length(text) between 1 and 2000),
  ts      bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists partner_messages_req_idx on public.partner_messages(req_id, ts);
alter table public.partner_messages enable row level security;
revoke all on public.partner_messages from anon, authenticated, public;

create or replace function public.send_partner_message(p_req text, p_text text) returns void
language plpgsql security definer set search_path = public as
$$
declare q public.partner_requests; me text := my_entity(); sd text; mine public.companies; txt text := btrim(coalesce(p_text, ''));
        now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  if auth.uid() is null or my_role() is distinct from 'employer' or me is null then raise exception 'companies only'; end if;
  select * into q from public.partner_requests where id = p_req;
  if q.id is null or (q.from_eid <> me and q.to_eid <> me) then raise exception 'unknown request'; end if;
  if q.status <> 'accepted' then raise exception 'messages open once the partner accepts'; end if;
  if txt = '' or char_length(txt) > 2000 then raise exception 'write a message (up to 2000 characters)'; end if;
  if public._blocked(q.from_eid, q.to_eid) or public._blocked(q.to_eid, q.from_eid) then raise exception 'not allowed'; end if;
  sd := case when q.from_eid = me then 'from' else 'to' end;
  if (select count(*) from public.partner_messages m where m.req_id in (select id from public.partner_requests where from_eid = me or to_eid = me)
        and m.side = sd and m.ts > now_ms - 3600000) >= 60 then raise exception 'too many messages, try again later'; end if;
  insert into public.partner_messages(req_id, side, text, ts) values (q.id, sd, txt, now_ms);
  if sd = 'from' then update public.partner_requests set from_read = now_ms where id = q.id; else update public.partner_requests set to_read = now_ms where id = q.id; end if;
  select * into mine from public.companies where id = me;
  perform public._notify(case when sd = 'from' then q.to_eid else q.from_eid end,
                         coalesce(nullif(mine.data->>'name', ''), 'A company') || ' sent you a message about your project', '#/e/partner-requests');
end $$;

create or replace function public.partner_messages_for(p_req text) returns setof jsonb
language plpgsql security definer set search_path = public as
$$
declare q public.partner_requests; me text := my_entity(); m public.partner_messages; mine_side text;
        now_ms bigint := (extract(epoch from clock_timestamp())*1000)::bigint;
begin
  if auth.uid() is null or my_role() is distinct from 'employer' or me is null then return; end if;
  select * into q from public.partner_requests where id = p_req;
  if q.id is null or (q.from_eid <> me and q.to_eid <> me) or q.status <> 'accepted' then return; end if;
  mine_side := case when q.from_eid = me then 'from' else 'to' end;
  if mine_side = 'from' then update public.partner_requests set from_read = now_ms where id = q.id; else update public.partner_requests set to_read = now_ms where id = q.id; end if;
  for m in select * from public.partner_messages where req_id = q.id order by ts, id limit 500 loop
    return next jsonb_build_object('id', m.id, 'mine', m.side = mine_side, 'text', m.text, 'ts', m.ts);
  end loop;
end $$;

-- 3. my_partner_requests now uses the contact email and tells how many messages are unread
create or replace function public.my_partner_requests() returns setof jsonb
language plpgsql stable security definer set search_path = public as
$$
declare me text := my_entity(); q public.partner_requests; oc public.companies; incoming boolean; card jsonb; mail text; shared boolean; unread int; total int;
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
    if q.status = 'accepted' and shared then mail := public._contact_mail(oc); end if;
    select count(*), count(*) filter (where m.side = case when incoming then 'from' else 'to' end and m.ts > case when incoming then q.to_read else q.from_read end)
      into total, unread from public.partner_messages m where m.req_id = q.id;
    return next jsonb_build_object('id', q.id, 'dir', case when incoming then 'in' else 'out' end, 'status', q.status, 'need', q.need,
                                   'timing', q.timing, 'note', q.note, 'ts', q.ts, 'respTs', q.resp_ts, 'other', card, 'contactEmail', mail,
                                   'iShared', case when incoming then q.to_share else q.from_share end, 'msgCount', total, 'unread', unread);
  end loop;
end $$;

revoke execute on function public._contact_mail(public.companies) from public, anon, authenticated;
revoke execute on function public.send_partner_message(text, text), public.partner_messages_for(text), public.my_partner_requests() from public, anon;
grant execute on function public.send_partner_message(text, text), public.partner_messages_for(text), public.my_partner_requests() to authenticated;

select 'ok' as release37;
