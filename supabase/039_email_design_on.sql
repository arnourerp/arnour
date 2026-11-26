-- =====================================================================
-- 039 · New email design, STEP 2 of 2 (switch it on)
-- Run only after you liked the test email from 038. From the next send,
-- notification emails use the new look. Needs 038. Safe to run again.
-- To go back: run 010_announcements.sql's email_build_batch again.
-- =====================================================================

-- everything due, one email per person; claims the rows so nothing is sent twice
create or replace function public.email_build_batch(p_limit int default 40) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare
  now_ms bigint := (extract(epoch from now())*1000)::bigint; r record; out jsonb := '[]'::jsonb;
  site text := 'https://arnour.com/'; addr text; tok uuid; qids bigint[]; items jsonb; kinds text[]; n int; mail jsonb;
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
    with claimed as (
      update public.email_queue q set sent_ts = now_ms where q.user_id = r.user_id and q.sent_ts is null and q.send_after <= now_ms
        and q.id in (select q2.id from public.email_queue q2 where q2.user_id = r.user_id and q2.sent_ts is null and q2.send_after <= now_ms order by q2.kind = 'matches', q2.created_ts limit 30)
      returning q.id, q.kind, q.text, q.link, q.created_ts)
    select array_agg(c.id), count(*), array_agg(distinct c.kind),
           jsonb_agg(jsonb_build_object('kind', c.kind, 'text', c.text, 'link', c.link) order by c.kind = 'matches', c.created_ts)
      into qids, n, kinds, items from claimed c;
    if addr is null or coalesce(n, 0) = 0 then continue; end if;
    begin
      mail := public._email_render(r.user_id, items, tok);
    exception when others then
      -- never hold the emails back because of the design: send a plain one
      raise warning 'email design failed: %', sqlerrm;
      mail := jsonb_build_object(
        'subject', case when n = 1 then left(split_part(items->0->>'text', E'\n', 1), 120) else 'You have ' || n || ' updates on Arnour' end,
        'html', '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">' ||
          (select string_agg('<p>' || public._email_esc(x->>'text') || ' <a href="' || site || public._email_esc(x->>'link') || '">Open →</a></p>', '') from jsonb_array_elements(items) x) ||
          '<p style="font-size:12px"><a href="' || site || '#/account">Manage email settings</a> · <a href="' || site || '#/unsubscribe?t=' || tok || '&amp;k=all">Unsubscribe from all</a></p></div>');
    end;
    -- every role closed or already applied to: nothing to send
    if mail is null then
      update public.email_queue set dropped = true where id = any(qids);
      continue;
    end if;
    out := out || jsonb_build_object('user_id', r.user_id, 'to', addr, 'subject', mail->>'subject', 'items', n, 'ids', to_jsonb(qids),
      'unsubscribe', site || '#/unsubscribe?t=' || tok || '&k=' || case when array_length(kinds,1) = 1 then kinds[1] else 'all' end,
      'html', mail->>'html');
  end loop;
  return out;
end $$;

revoke all on function public.email_build_batch(int) from public, anon, authenticated;

select 'ok' as release59;
