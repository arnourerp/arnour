-- release56: Job feed (a company's careers page is checked every day; SAP roles arrive as DRAFTS; roles that disappear are closed).
-- Step 1 is run by the admin (Admin > Job feeds): connect a company's link, press Check, tick the roles, they become drafts of that company.
-- Roles found on later checks arrive as drafts by themselves (after the first ticking), and the company is told in the app (and by e-mail, following
-- its e-mail settings, because the notice is an ordinary notification).
--   * job_feeds        one row per connected careers page
--   * job_feed_items   every job link found on it (state: found / selected / drafted / ignored / failed / gone)
--   * job_feed_worker  one row: hash of the secret the daily Netlify function uses, a copy of the site's option lists (so the function can read jobs
--                      without a browser), and the time of its last run
-- The page text of a role waiting to be read is kept in job_feed_items.body only until the draft exists. Nothing here is visible to anyone but the admin.

create table if not exists public.job_feeds (
  id              uuid primary key default gen_random_uuid(),
  company_id      text not null references public.companies(id) on delete cascade,
  url             text not null check (url ~* '^https://[^ ]+\.[^ ]+$' and length(url) <= 500),
  filter          text not null default 'sap' check (filter in ('sap','all')),   -- sap: only jobs that look SAP-related; all: every job is read and the reader decides
  enabled         boolean not null default true,
  approved        boolean not null default false,       -- true after the admin ticked the first list: from then on new roles are drafted without asking
  auto_close      boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  last_checked_at timestamptz,
  last_status     text not null default 'new' check (last_status in ('new','ok','warn','failed')),
  last_error      text not null default '',
  last_counts     jsonb not null default '{}'::jsonb,
  unique (company_id, url)
);
create table if not exists public.job_feed_items (
  id         uuid primary key default gen_random_uuid(),
  feed_id    uuid not null references public.job_feeds(id) on delete cascade,
  item_key   text not null,
  url        text not null default '',
  title      text not null default '',
  state      text not null default 'found' check (state in ('found','selected','drafted','ignored','failed','gone')),
  job_id     text,
  error      text not null default '',
  body       text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  missing    int not null default 0,
  tries      int not null default 0,
  notified   boolean not null default false,
  unique (feed_id, item_key)
);
create index if not exists job_feed_items_state_idx on public.job_feed_items (feed_id, state);
create table if not exists public.job_feed_worker (
  id          int primary key default 1 check (id = 1),
  secret_hash text,
  lists       jsonb,
  lists_ts    timestamptz,
  last_tick   timestamptz
);
insert into public.job_feed_worker(id) values (1) on conflict do nothing;
alter table public.job_feeds       enable row level security;
alter table public.job_feed_items  enable row level security;
alter table public.job_feed_worker enable row level security;
revoke all on public.job_feeds, public.job_feed_items, public.job_feed_worker from public, anon, authenticated;   -- no policies: only the functions below

-- who may call the worker functions: the admin (with their own login), or the daily function that knows the secret
create or replace function public._feed_auth(p_secret text) returns void
language plpgsql stable security definer set search_path = public as
$$
begin
  if public._is_admin() then return; end if;
  if p_secret is not null and length(p_secret) >= 32 and exists (
       select 1 from public.job_feed_worker
        where secret_hash is not null and secret_hash = encode(sha256(convert_to(p_secret, 'utf8')), 'hex')) then return; end if;
  raise exception 'not allowed';
end $$;
revoke execute on function public._feed_auth(text) from public, anon, authenticated;

-- ---------- admin screens ----------------------------------------------------
create or replace function public.admin_feed_companies() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', coalesce(nullif(c.data->>'name',''), c.id)) order by lower(coalesce(c.data->>'name', c.id)))
                     from public.companies c where not c.sample and c.owner is not null), '[]'::jsonb);
end $$;

create or replace function public.admin_feed_list() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', f.id, 'companyId', f.company_id, 'company', coalesce(nullif(c.data->>'name',''), f.company_id), 'url', f.url, 'filter', f.filter,
      'enabled', f.enabled, 'approved', f.approved, 'autoClose', f.auto_close, 'lastCheckedAt', f.last_checked_at, 'lastStatus', f.last_status,
      'lastError', f.last_error, 'lastCounts', f.last_counts,
      'counts', jsonb_build_object(
         'found',    (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'found'),
         'selected', (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'selected'),
         'drafted',  (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'drafted'),
         'ignored',  (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'ignored'),
         'failed',   (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'failed'),
         'gone',     (select count(*) from public.job_feed_items i where i.feed_id = f.id and i.state = 'gone')))
      order by f.created_at desc)
    from public.job_feeds f left join public.companies c on c.id = f.company_id), '[]'::jsonb);
end $$;

create or replace function public.admin_feed_add(p_company text, p_url text, p_filter text default 'sap') returns uuid
language plpgsql security definer set search_path = public, auth as
$$
declare nid uuid; u text := btrim(coalesce(p_url, ''));
begin
  perform public._require_admin();
  if not exists (select 1 from public.companies where id = p_company and owner is not null) then raise exception 'Choose a company'; end if;
  if u !~* '^https://[^ ]+\.[^ ]+$' or length(u) > 500 then raise exception 'The link must be a full https link'; end if;
  if p_filter not in ('sap','all') then raise exception 'bad filter'; end if;
  if (select count(*) from public.job_feeds) >= 50 then raise exception 'At most 50 job feeds'; end if;
  insert into public.job_feeds(company_id, url, filter, created_by) values (p_company, u, p_filter, auth.uid())
    on conflict (company_id, url) do update set enabled = true returning id into nid;
  perform public._audit('connect job feed', p_company, u);
  return nid;
end $$;

create or replace function public.admin_feed_update(p_id uuid, p_enabled boolean, p_auto_close boolean, p_filter text) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  perform public._require_admin();
  if p_filter not in ('sap','all') then raise exception 'bad filter'; end if;
  update public.job_feeds set enabled = coalesce(p_enabled, enabled), auto_close = coalesce(p_auto_close, auto_close), filter = p_filter where id = p_id;
  if not found then raise exception 'Unknown job feed'; end if;
  perform public._audit('change job feed', p_id::text, 'enabled=' || coalesce(p_enabled::text, '-') || ' close=' || coalesce(p_auto_close::text, '-') || ' filter=' || p_filter);
end $$;

create or replace function public.admin_feed_remove(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  perform public._require_admin();
  delete from public.job_feeds where id = p_id;   -- drafts and roles already made stay with the company
  perform public._audit('disconnect job feed', p_id::text, '');
end $$;

create or replace function public.admin_feed_items(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('key', i.item_key, 'title', i.title, 'url', i.url, 'state', i.state, 'error', i.error, 'jobId', i.job_id,
                    'firstSeen', i.first_seen, 'missing', i.missing)
                    order by (i.state = 'found') desc, (i.state = 'selected') desc, i.first_seen desc, i.title)
                     from public.job_feed_items i where i.feed_id = p_id), '[]'::jsonb);
end $$;

-- the admin ticked the list: ticked roles will be read and drafted, the others are set aside (never offered again); from now on new roles are drafted by themselves
create or replace function public.admin_feed_select(p_id uuid, p_keys text[]) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare a int; b int;
begin
  perform public._require_admin();
  if not exists (select 1 from public.job_feeds where id = p_id) then raise exception 'Unknown job feed'; end if;
  update public.job_feed_items set state = 'selected', tries = 0, error = '' where feed_id = p_id and state = 'found' and item_key = any(coalesce(p_keys, '{}'::text[]));
  get diagnostics a = row_count;
  update public.job_feed_items set state = 'ignored' where feed_id = p_id and state = 'found';
  get diagnostics b = row_count;
  update public.job_feeds set approved = true where id = p_id;
  perform public._audit('job feed: bring in roles', p_id::text, a || ' chosen, ' || b || ' set aside');
  return jsonb_build_object('selected', a, 'ignored', b);
end $$;

create or replace function public.admin_feed_retry(p_id uuid) returns int
language plpgsql security definer set search_path = public, auth as
$$
declare n int;
begin
  perform public._require_admin();
  update public.job_feed_items set state = 'selected', tries = 0, error = '' where feed_id = p_id and state = 'failed';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_feed_save_lists(p_lists jsonb) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  if jsonb_typeof(p_lists) is distinct from 'object' or length(p_lists::text) > 300000 then raise exception 'bad lists'; end if;
  update public.job_feed_worker set lists = p_lists, lists_ts = now() where id = 1;
end $$;

create or replace function public.admin_feed_set_secret(p_hash text) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  perform public._require_admin();
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad secret'; end if;
  update public.job_feed_worker set secret_hash = p_hash where id = 1;
  perform public._audit('job feed: daily check secret changed', '', '');
end $$;

create or replace function public.admin_feed_worker_status() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return (select jsonb_build_object('hasSecret', secret_hash is not null, 'lastTick', last_tick, 'listsAt', lists_ts) from public.job_feed_worker where id = 1);
end $$;

-- ---------- worker functions (the admin's Check button and the daily function) --
create or replace function public.feed_lists(p_secret text default null) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._feed_auth(p_secret);
  return (select lists from public.job_feed_worker where id = 1);
end $$;

-- one feed: the one asked for, or the next one that is due (connected, ticked once, not checked for 23 hours)
create or replace function public.feed_get(p_secret text default null, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare f public.job_feeds;
begin
  perform public._feed_auth(p_secret);
  if p_id is not null then select * into f from public.job_feeds where id = p_id;
  else select * into f from public.job_feeds
        where enabled and approved and (last_checked_at is null or last_checked_at < now() - interval '23 hours')
        order by last_checked_at nulls first limit 1;
  end if;
  if f.id is null then return null; end if;
  return jsonb_build_object('id', f.id, 'url', f.url, 'companyId', f.company_id, 'filter', f.filter, 'approved', f.approved, 'autoClose', f.auto_close);
end $$;

-- the result of one look at the careers page: p_items = [{key,url,title,sap,body?}] or an error
create or replace function public.feed_store(p_secret text, p_id uuid, p_items jsonb, p_error text default '') returns jsonb
language plpgsql security definer set search_path = public as
$$
declare f public.job_feeds; it jsonb; k text; n_new int := 0; n_found int := 0; n_closed int := 0; n_gone int := 0;
        keys text[] := '{}'; tracked int; vanished int; st text; jid text; v_body text;
begin
  perform public._feed_auth(p_secret);
  select * into f from public.job_feeds where id = p_id;
  if f.id is null then raise exception 'Unknown job feed'; end if;
  if coalesce(p_error, '') <> '' then
    update public.job_feeds set last_checked_at = now(), last_status = 'failed', last_error = left(p_error, 300), last_counts = '{}'::jsonb where id = p_id;
    return jsonb_build_object('status', 'failed');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    update public.job_feeds set last_checked_at = now(), last_status = 'failed', last_error = 'no_jobs', last_counts = '{}'::jsonb where id = p_id;
    return jsonb_build_object('status', 'failed');
  end if;
  for it in select * from jsonb_array_elements(p_items) limit 400 loop
    k := left(btrim(coalesce(it->>'key', '')), 500);
    if k = '' then continue; end if;
    keys := keys || k; n_found := n_found + 1;
    v_body := nullif(left(coalesce(it->>'body', ''), 20000), '');
    if exists (select 1 from public.job_feed_items where feed_id = p_id and item_key = k) then
      update public.job_feed_items set last_seen = now(), missing = 0, title = coalesce(nullif(left(it->>'title', 200), ''), title),
             url = coalesce(nullif(left(it->>'url', 500), ''), url),
             body = case when state in ('found','selected') and public.job_feed_items.body is null then v_body else public.job_feed_items.body end
       where feed_id = p_id and item_key = k;
    else
      st := case when coalesce((it->>'sap')::boolean, false) = false and f.filter = 'sap' then 'ignored' when f.approved then 'selected' else 'found' end;
      insert into public.job_feed_items(feed_id, item_key, url, title, state, body)
        values (p_id, k, left(coalesce(it->>'url', ''), 500), left(coalesce(it->>'title', ''), 200), st, case when st in ('found','selected') then v_body end);
      if st <> 'ignored' then n_new := n_new + 1; end if;
    end if;
  end loop;
  -- roles that were on the page before and are not there now
  select count(*) into tracked from public.job_feed_items where feed_id = p_id and state in ('found','selected','drafted');
  select count(*) into vanished from public.job_feed_items where feed_id = p_id and state in ('found','selected','drafted') and not (item_key = any(keys));
  if vanished >= 4 and vanished * 2 > tracked then
    update public.job_feeds set last_checked_at = now(), last_status = 'warn',
           last_error = 'Many roles disappeared at once (' || vanished || ' of ' || tracked || '). Nothing was closed. Check the careers page.',
           last_counts = jsonb_build_object('found', n_found, 'new', n_new, 'closed', 0) where id = p_id;
    return jsonb_build_object('status', 'warn', 'found', n_found, 'new', n_new, 'closed', 0);
  end if;
  update public.job_feed_items set missing = missing + 1 where feed_id = p_id and state in ('found','selected','drafted') and not (item_key = any(keys));
  for jid, st in
    select job_id, state from public.job_feed_items where feed_id = p_id and state in ('found','selected','drafted') and missing >= 2
  loop
    n_gone := n_gone + 1;
    if f.auto_close and jid is not null then
      update public.jobs set status = 'closed', updated_at = now() where id = jid and company_id = f.company_id and status = 'open';
      if found then n_closed := n_closed + 1; end if;
    end if;
  end loop;
  update public.job_feed_items set state = 'gone', body = null where feed_id = p_id and state in ('found','selected','drafted') and missing >= 2;
  update public.job_feeds set last_checked_at = now(), last_status = 'ok', last_error = '',
         last_counts = jsonb_build_object('found', n_found, 'new', n_new, 'closed', n_closed, 'gone', n_gone) where id = p_id;
  return jsonb_build_object('status', 'ok', 'found', n_found, 'new', n_new, 'closed', n_closed, 'gone', n_gone);
end $$;

-- the next role to read (one at a time, so a single call stays short); a role that was tried three times is given up
create or replace function public.feed_next(p_secret text default null, p_id uuid default null) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare i public.job_feed_items; f public.job_feeds;
begin
  perform public._feed_auth(p_secret);
  update public.job_feed_items set state = 'failed', error = 'gave_up' where state = 'selected' and tries >= 3 and (p_id is null or feed_id = p_id);
  select it.* into i from public.job_feed_items it join public.job_feeds fd on fd.id = it.feed_id
   where it.state = 'selected' and (p_id is null or it.feed_id = p_id) and fd.enabled
   order by it.first_seen, it.title limit 1;
  if i.id is null then return null; end if;
  update public.job_feed_items set tries = tries + 1 where id = i.id;
  select * into f from public.job_feeds where id = i.feed_id;
  return jsonb_build_object('itemId', i.id, 'feedId', i.feed_id, 'companyId', f.company_id, 'url', i.url, 'title', i.title, 'body', i.body, 'tries', i.tries + 1);
end $$;

-- the result of reading one role: 'drafted' (p_job is the role), 'ignored' (not an SAP role), 'failed' (cannot be read; a code), 'retry' (try again next time)
create or replace function public.feed_item_done(p_secret text, p_item uuid, p_status text, p_error text default '', p_job jsonb default null) returns text
language plpgsql security definer set search_path = public as
$$
declare i public.job_feed_items; f public.job_feeds; co public.companies; d jsonb := '{}'::jsonb; k text; jid text; cid text;
        allowed text[] := array['title','roleType','requires','country','remote','employmentType','duration','minExp','level','industries','industry','description',
                                'languages','preferredLangs','preferredSpecialties','certification','mustLevel','mustExp','mustSpec','mustInd','minPrograms','langMust'];
begin
  perform public._feed_auth(p_secret);
  select * into i from public.job_feed_items where id = p_item;
  if i.id is null or i.state <> 'selected' then return null; end if;
  if p_status = 'retry' then return 'selected'; end if;
  if p_status = 'failed' then
    update public.job_feed_items set state = 'failed', error = left(coalesce(p_error, 'failed'), 100), body = null where id = p_item; return 'failed';
  end if;
  if p_status = 'ignored' then
    update public.job_feed_items set state = 'ignored', error = left(coalesce(p_error, ''), 100), body = null where id = p_item; return 'ignored';
  end if;
  if p_status <> 'drafted' then raise exception 'bad status'; end if;
  select * into f from public.job_feeds where id = i.feed_id;
  select * into co from public.companies where id = f.company_id;
  if co.id is null or co.owner is null then raise exception 'company not found'; end if;
  if jsonb_typeof(p_job) is distinct from 'object' or coalesce(btrim(p_job->>'title'), '') = '' then raise exception 'no role'; end if;
  foreach k in array allowed loop if p_job ? k then d := d || jsonb_build_object(k, p_job->k); end if; end loop;
  d := d || jsonb_build_object('title', left(btrim(p_job->>'title'), 140), 'description', left(coalesce(p_job->>'description', ''), 8000));
  if coalesce(d->>'country', '') <> '' and d->>'country' = co.data->>'country' and coalesce(co.data->>'city', '') <> '' then d := d || jsonb_build_object('city', co.data->>'city'); end if;
  if octet_length(d::text) > 90000 then raise exception 'role too big'; end if;
  jid := 'j-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  insert into public.jobs(id, company_id, owner, status, confidential, data) values (jid, co.id, co.owner, 'draft', null, d);
  update public.job_feed_items set state = 'drafted', job_id = jid, error = '', body = null where id = p_item;
  return jid;
end $$;

-- one notice per company when a batch is finished (no role of the feed is still waiting to be read)
create or replace function public.feed_notify(p_secret text default null, p_id uuid default null) returns int
language plpgsql security definer set search_path = public as
$$
declare f record; n int; titles text; sent int := 0; txt text;
begin
  perform public._feed_auth(p_secret);
  for f in select fd.id, fd.company_id from public.job_feeds fd
            where (p_id is null or fd.id = p_id)
              and exists (select 1 from public.job_feed_items i where i.feed_id = fd.id and i.state = 'drafted' and not i.notified)
              and not exists (select 1 from public.job_feed_items i where i.feed_id = fd.id and i.state = 'selected')
  loop
    select count(*), string_agg('"' || left(title, 60) || '"', ', ' order by first_seen) into n, titles
      from public.job_feed_items where feed_id = f.id and state = 'drafted' and not notified;
    txt := case when n = 1 then 'A new draft role from your job feed is ready to review: ' || titles
                else n || ' new draft roles from your job feed are ready to review: ' || titles end;
    if length(txt) > 480 then txt := left(txt, 470) || '...'; end if;
    perform public._notify(f.company_id, txt, '#/e/jobs');
    update public.job_feed_items set notified = true where feed_id = f.id and state = 'drafted' and not notified;
    sent := sent + 1;
  end loop;
  return sent;
end $$;

create or replace function public.feed_tick(p_secret text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._feed_auth(p_secret);
  update public.job_feed_worker set last_tick = now() where id = 1;
end $$;

-- every role read by the AI counts like a job-ad read (release 33 table jd_imports): at most 200 feed reads per rolling 24 hours, and the site-wide stop of 400 still applies
create or replace function public.feed_read_begin(p_secret text default null) returns uuid
language plpgsql security definer set search_path = public as
$$
declare nid uuid; n int; g int; zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  perform public._feed_auth(p_secret);
  select count(*) into n from public.jd_imports where user_id = zero and created_at > now() - interval '24 hours' and status <> 'failed';
  if n >= 200 then raise exception 'daily limit'; end if;
  select count(*) into g from public.jd_imports where created_at > now() - interval '24 hours' and status <> 'failed';
  if g >= 400 then raise exception 'busy'; end if;
  insert into public.jd_imports(user_id, kind) values (zero, 'admin') returning id into nid;
  return nid;
end $$;

create or replace function public.feed_read_done(p_secret text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._feed_auth(p_secret);
  if p_status not in ('ok','failed') then raise exception 'bad status'; end if;
  update public.jd_imports set status = p_status where id = p_id and user_id = '00000000-0000-0000-0000-000000000000' and status = 'started';
end $$;

revoke execute on function
  public.admin_feed_companies(), public.admin_feed_list(), public.admin_feed_add(text,text,text), public.admin_feed_update(uuid,boolean,boolean,text),
  public.admin_feed_remove(uuid), public.admin_feed_items(uuid), public.admin_feed_select(uuid,text[]), public.admin_feed_retry(uuid),
  public.admin_feed_save_lists(jsonb), public.admin_feed_set_secret(text), public.admin_feed_worker_status() from public, anon;
grant execute on function
  public.admin_feed_companies(), public.admin_feed_list(), public.admin_feed_add(text,text,text), public.admin_feed_update(uuid,boolean,boolean,text),
  public.admin_feed_remove(uuid), public.admin_feed_items(uuid), public.admin_feed_select(uuid,text[]), public.admin_feed_retry(uuid),
  public.admin_feed_save_lists(jsonb), public.admin_feed_set_secret(text), public.admin_feed_worker_status() to authenticated;
-- the worker functions also run for the daily function (no login, only the secret), so anon may call them; each one checks the admin or the secret first
revoke execute on function
  public.feed_lists(text), public.feed_get(text,uuid), public.feed_store(text,uuid,jsonb,text), public.feed_next(text,uuid),
  public.feed_item_done(text,uuid,text,text,jsonb), public.feed_notify(text,uuid), public.feed_tick(text), public.feed_read_begin(text), public.feed_read_done(text,uuid,text) from public;
grant execute on function
  public.feed_lists(text), public.feed_get(text,uuid), public.feed_store(text,uuid,jsonb,text), public.feed_next(text,uuid),
  public.feed_item_done(text,uuid,text,text,jsonb), public.feed_notify(text,uuid), public.feed_tick(text), public.feed_read_begin(text), public.feed_read_done(text,uuid,text) to anon, authenticated;

select 'ok' as release56;
