-- ============================================================================
-- ARNOUR — problem reports, automatic error log, light usage counts
-- Run after 001 / 003 / 005. Safe to run again.
-- ============================================================================

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_ts bigint not null default (extract(epoch from now())*1000)::bigint,
  user_id    uuid references auth.users(id) on delete set null,
  role       text not null default '',
  email      text not null default '',
  category   text not null default 'problem' check (category in ('problem','suggestion','other')),
  message    text not null check (char_length(message) between 3 and 2000),
  page       text not null default '',
  ua         text not null default '',
  ctx        jsonb not null default '{}'::jsonb check (octet_length(ctx::text) < 8000),
  shot       text,
  status     text not null default 'open' check (status in ('open','done')),
  note       text not null default ''
);
create index if not exists feedback_status_idx on public.feedback(status, created_ts desc);

create table if not exists public.client_errors (
  fp         text primary key,
  message    text not null,
  src        text not null default '',
  page       text not null default '',
  ua         text not null default '',
  n          int  not null default 1,
  first_ts   bigint not null default (extract(epoch from now())*1000)::bigint,
  last_ts    bigint not null default (extract(epoch from now())*1000)::bigint,
  users      int  not null default 0
);

create table if not exists public.usage_counts (
  d     date not null,
  name  text not null,
  n     int  not null default 0,
  primary key (d, name)
);

alter table public.feedback      enable row level security;
alter table public.client_errors enable row level security;
alter table public.usage_counts  enable row level security;
revoke all on public.feedback, public.client_errors, public.usage_counts from anon, authenticated, public;

-- ---------- anyone: send a problem report -----------------------------------
create or replace function public.submit_feedback(p_category text, p_message text, p_email text, p_page text, p_ua text, p_ctx jsonb, p_shot text)
returns bigint language plpgsql security definer set search_path = public, auth as
$$
declare uid uuid := auth.uid(); id bigint; em text := left(btrim(coalesce(p_email,'')), 200); msg text := btrim(coalesce(p_message,''));
        r text := coalesce(public.my_role(), '');
begin
  if char_length(msg) < 3 then raise exception 'Please describe the problem'; end if;
  if em <> '' and em !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address does not look right'; end if;
  /* simple flood guard: per person (or overall for visitors) */
  if uid is not null then
    if (select count(*) from public.feedback where user_id = uid and created_ts > (extract(epoch from now())*1000)::bigint - 3600000) >= 5 then raise exception 'too many reports'; end if;
  else
    if (select count(*) from public.feedback where user_id is null and created_ts > (extract(epoch from now())*1000)::bigint - 3600000) >= 30 then raise exception 'too many reports'; end if;
  end if;
  if uid is not null and em = '' then select u.email into em from auth.users u where u.id = uid; end if;
  if p_shot is not null and (uid is null or p_shot not like uid::text || '/%') then p_shot := null; end if;
  insert into public.feedback(user_id, role, email, category, message, page, ua, ctx, shot)
  values (uid, r, coalesce(em,''), case when p_category in ('problem','suggestion','other') then p_category else 'problem' end,
          left(msg, 2000), left(coalesce(p_page,''), 300), left(coalesce(p_ua,''), 300),
          case when jsonb_typeof(p_ctx) = 'object' then p_ctx else '{}'::jsonb end, p_shot)
  returning feedback.id into id;
  return id;
end $$;

-- ---------- anyone: record an automatic error (grouped, no personal text) ---
create or replace function public.log_client_error(p_message text, p_src text, p_page text, p_ua text)
returns void language plpgsql security definer set search_path = public as
$$
declare m text := left(btrim(coalesce(p_message,'')), 300); f text; ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  if m = '' then return; end if;
  f := md5(m || '|' || left(coalesce(p_src,''), 120));
  if exists (select 1 from public.client_errors where fp = f) then
    update public.client_errors set n = n + 1, last_ts = ms, page = left(coalesce(p_page,''), 200), ua = left(coalesce(p_ua,''), 200) where fp = f;
  elsif (select count(*) from public.client_errors) < 2000 then
    insert into public.client_errors(fp, message, src, page, ua) values (f, m, left(coalesce(p_src,''), 120), left(coalesce(p_page,''), 200), left(coalesce(p_ua,''), 200));
  end if;
end $$;

-- ---------- anyone: count a page view or step (no cookies, no identity) -----
create or replace function public.track_usage(p_name text)
returns void language plpgsql security definer set search_path = public as
$$
begin
  if p_name is null or p_name !~ '^[a-z0-9_:-]{1,40}$' then return; end if;
  if not exists (select 1 from public.usage_counts where d = current_date and name = p_name)
     and (select count(*) from public.usage_counts where d = current_date) >= 80 then return; end if;
  insert into public.usage_counts(d, name, n) values (current_date, p_name, 1)
  on conflict (d, name) do update set n = public.usage_counts.n + 1;
end $$;

-- ---------- admin ------------------------------------------------------------
create or replace function public.admin_feedback(p_status text default 'open', p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.created_ts desc) from (
    select * from public.feedback where p_status = 'all' or status = p_status
    order by created_ts desc limit greatest(1, least(coalesce(p_limit,100), 300))) f), '[]'::jsonb);
end $$;

create or replace function public.admin_feedback_set(p_id bigint, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  if p_status not in ('open','done') then raise exception 'bad status'; end if;
  update public.feedback set status = p_status, note = left(coalesce(p_note,''), 500) where id = p_id;
  perform public._audit('feedback ' || p_status, p_id::text, '');
end $$;

create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'openFeedback', (select count(*) from public.feedback where status = 'open'),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.last_ts desc) from (select * from public.client_errors order by last_ts desc limit 60) e), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(jsonb_build_object('d', to_char(d,'YYYY-MM-DD'), 'name', name, 'n', n) order by d desc, name)
                       from public.usage_counts where d > current_date - 14), '[]'::jsonb));
end $$;

create or replace function public.admin_clear_errors() returns void
language plpgsql security definer set search_path = public as
$$ begin perform public._require_admin(); delete from public.client_errors; perform public._audit('clear errors', '', ''); end $$;

-- ---------- who may call what ------------------------------------------------
revoke all on function public.submit_feedback(text,text,text,text,text,jsonb,text), public.log_client_error(text,text,text,text), public.track_usage(text),
  public.admin_feedback(text,int), public.admin_feedback_set(bigint,text,text), public.admin_health(), public.admin_clear_errors() from public;
grant execute on function public.submit_feedback(text,text,text,text,text,jsonb,text), public.log_client_error(text,text,text,text), public.track_usage(text) to anon, authenticated;
grant execute on function public.admin_feedback(text,int), public.admin_feedback_set(bigint,text,text), public.admin_health(), public.admin_clear_errors() to authenticated;

-- ---------- screenshots (private bucket "feedback") --------------------------
do $storage$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('feedback', 'feedback', false, 3145728, array['image/png','image/jpeg','image/webp'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
    drop policy if exists "feedback upload own" on storage.objects;
    create policy "feedback upload own" on storage.objects for insert to authenticated
      with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists "feedback read admin" on storage.objects;
    create policy "feedback read admin" on storage.objects for select to authenticated
      using (bucket_id = 'feedback' and public._is_admin());
  end if;
end
$storage$;
