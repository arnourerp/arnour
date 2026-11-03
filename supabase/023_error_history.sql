-- Release 40: Health tab fixes and an error history.
-- Run once in the Supabase SQL Editor. Safe to run twice.
--
-- 1. "Clear all" never worked: Supabase refuses a DELETE with no WHERE ("DELETE requires a WHERE clause").
-- 2. The Report box offers "Harassment or abuse" ('abuse') and "Inappropriate content" ('inappropriate'), but the
--    database only accepted 'abusive', so reports with those two reasons failed and were lost.
-- 3. Errors you have dealt with now move to a history list (kept for good) instead of disappearing.

-- 1. report reasons: accept what the Report box sends (old 'abusive' stays valid for any old row)
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam','fake','abuse','abusive','inappropriate','privacy','other'));

-- 2. the history list
create table if not exists public.client_errors_history (
  id          bigint generated always as identity primary key,
  fp          text   not null,
  message     text   not null,
  src         text   not null default '',
  page        text   not null default '',
  ua          text   not null default '',
  n           int    not null default 1,
  first_ts    bigint not null,
  last_ts     bigint not null,
  resolved_ts bigint not null default (extract(epoch from now())*1000)::bigint,
  outcome     text   not null default 'fixed' check (outcome in ('fixed','noise','cleared')),   -- fixed = a bug we fixed, noise = not a site bug, cleared = cleared without a verdict
  note        text   not null default '' check (char_length(note) <= 500)                       -- what was wrong and what was done (release, commit)
);
create index if not exists client_errors_history_fp_idx on public.client_errors_history(fp);
create index if not exists client_errors_history_ts_idx on public.client_errors_history(resolved_ts desc);
alter table public.client_errors_history enable row level security;
revoke all on public.client_errors_history from anon, authenticated, public;

-- 3. the Health numbers: each error also says whether it has been dealt with before ("came back")
create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'openFeedback', (select count(*) from public.feedback where status = 'open'),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) || jsonb_build_object('returned', exists (select 1 from public.client_errors_history h where h.fp = e.fp and h.outcome in ('fixed','noise')))
                                         order by e.last_ts desc)
                          from (select * from public.client_errors order by last_ts desc limit 60) e), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(d,'YYYY-MM-DD'), 'name', name, 'n', n) order by d desc, name)
                       from public.usage_counts where d > current_date - 14), '[]'::jsonb));
end $$;

-- 4. move one error to the history (fixed / noise), with a short note
create or replace function public.admin_error_resolve(p_fp text, p_outcome text, p_note text default '') returns void
language plpgsql security definer set search_path = public as
$$
declare moved int;
begin
  perform public._require_admin();
  if p_outcome not in ('fixed','noise') then raise exception 'unknown outcome'; end if;
  insert into public.client_errors_history(fp, message, src, page, ua, n, first_ts, last_ts, outcome, note)
    select fp, message, src, page, ua, n, first_ts, last_ts, p_outcome, left(btrim(coalesce(p_note,'')), 500)
      from public.client_errors where fp = p_fp;
  get diagnostics moved = row_count;
  if moved = 0 then raise exception 'not found'; end if;
  delete from public.client_errors where fp = p_fp;
  perform public._audit('error ' || p_outcome, p_fp, left(btrim(coalesce(p_note,'')), 200));
end $$;

-- 5. "Clear all" (fixed: it has a WHERE and keeps a copy in the history)
create or replace function public.admin_clear_errors() returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  insert into public.client_errors_history(fp, message, src, page, ua, n, first_ts, last_ts, outcome, note)
    select fp, message, src, page, ua, n, first_ts, last_ts, 'cleared', '' from public.client_errors where fp is not null;
  delete from public.client_errors where fp is not null;
  perform public._audit('clear errors', '', '');
end $$;

-- 6. read the history, newest first
create or replace function public.admin_error_history(p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(to_jsonb(h) order by h.resolved_ts desc, h.id desc)
                     from (select * from public.client_errors_history order by resolved_ts desc, id desc limit greatest(1, least(coalesce(p_limit, 200), 1000))) h), '[]'::jsonb);
end $$;

revoke execute on function public.admin_error_resolve(text, text, text), public.admin_error_history(int) from public, anon;
grant execute on function public.admin_error_resolve(text, text, text), public.admin_error_history(int) to authenticated;
revoke execute on function public.admin_health(), public.admin_clear_errors() from public, anon;
grant execute on function public.admin_health(), public.admin_clear_errors() to authenticated;

select 'ok' as release40;
