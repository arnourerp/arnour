-- ============================================================================
-- ARNOUR — Release 3: admin area, reports, suspension, activity log
-- Run AFTER 001_schema.sql and 003_community.sql. Safe to run more than once.
-- The admin right is tied to the e-mail addresses in public.admin_emails.
-- ============================================================================

create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails(email) values ('ahmed.salem@arnour.com') on conflict do nothing;

create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  reporter        uuid references auth.users(id) on delete set null,
  reporter_entity text,
  kind            text not null check (kind in ('question','answer','article','comment','profile','company','job','conversation')),
  target          text not null,
  reason          text not null check (reason in ('spam','fake','abusive','privacy','other')),
  note            text not null default '' check (char_length(note) <= 1000),
  label           text not null default '',
  status          text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_ts      bigint not null default (extract(epoch from now())*1000)::bigint,
  handled_ts      bigint,
  handled_note    text not null default ''
);
create unique index if not exists reports_one_open on public.reports(reporter, kind, target) where status = 'open';
create index if not exists reports_status_idx on public.reports(status, created_ts desc);

create table if not exists public.admin_log (
  id     bigint generated always as identity primary key,
  ts     bigint not null default (extract(epoch from now())*1000)::bigint,
  admin  text not null,
  action text not null,
  target text not null default '',
  detail text not null default ''
);

alter table public.admin_emails enable row level security;
alter table public.reports      enable row level security;
alter table public.admin_log    enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.admin_emails, public.reports, public.admin_log, public.site_settings from anon, authenticated, public;

-- ---------- helpers ---------------------------------------------------------
create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = public, auth as
$$ select auth.uid() is not null and exists (
     select 1 from public.admin_emails a join auth.users u on lower(u.email) = lower(a.email) where u.id = auth.uid()) $$;

create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path = public as
$$ begin if not public._is_admin() then raise exception 'not allowed'; end if; end $$;

create or replace function public._audit(p_action text, p_target text, p_detail text) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  insert into public.admin_log(admin, action, target, detail)
  values (coalesce((select email from auth.users where id = auth.uid()), '?'), p_action, coalesce(p_target,''), left(coalesce(p_detail,''), 500));
end $$;

create or replace function public._notify(p_entity text, p_text text, p_link text) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if p_entity is null or p_entity = '' then return; end if;
  insert into public.notifications(user_key, type, text, link) values (p_entity, 'info', left(p_text, 500), left(coalesce(p_link,''), 200));
end $$;

create or replace function public._owner_of(p_kind text, p_target text) returns uuid
language sql stable security definer set search_path = public as
$$ select case p_kind
     when 'question'   then (select owner from public.questions where id = p_target)
     when 'answer'     then (select owner from public.answers where id = p_target)
     when 'article'    then (select owner from public.articles where id = p_target)
     when 'comment'    then (select owner from public.article_comments where id = p_target)
     when 'profile'    then (select owner from public.consultants where id = p_target)
     when 'company'    then (select owner from public.companies where id = p_target)
     when 'job'        then (select owner from public.jobs where id = p_target)
   end $$;

create or replace function public._target_exists(p_kind text, p_target text) returns boolean
language sql stable security definer set search_path = public as
$$ select case p_kind
     when 'question'     then exists (select 1 from public.questions where id = p_target)
     when 'answer'       then exists (select 1 from public.answers where id = p_target)
     when 'article'      then exists (select 1 from public.articles where id = p_target)
     when 'comment'      then exists (select 1 from public.article_comments where id = p_target)
     when 'profile'      then exists (select 1 from public.consultants where id = p_target)
     when 'company'      then exists (select 1 from public.companies where id = p_target)
     when 'job'          then exists (select 1 from public.jobs where id = p_target)
     when 'conversation' then exists (select 1 from public.conversations where id = p_target)
     else false end $$;

create or replace function public._label(p_kind text, p_target text) returns text
language sql stable security definer set search_path = public as
$$ select coalesce(case p_kind
     when 'question'     then (select title from public.questions where id = p_target)
     when 'answer'       then (select left(body, 90) from public.answers where id = p_target)
     when 'article'      then (select title from public.articles where id = p_target)
     when 'comment'      then (select left(body, 90) from public.article_comments where id = p_target)
     when 'profile'      then (select nullif(trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')), '') from public.consultants where id = p_target)
     when 'company'      then (select data->>'name' from public.companies where id = p_target)
     when 'job'          then (select data->>'title' from public.jobs where id = p_target)
     when 'conversation' then 'Conversation'
   end, '') $$;

create or replace function public._link(p_kind text, p_target text) returns text
language sql stable security definer set search_path = public as
$$ select case p_kind
     when 'question'     then '#/community/q/' || p_target
     when 'answer'       then '#/community/q/' || coalesce((select question_id from public.answers where id = p_target), '')
     when 'article'      then '#/community/a/' || p_target
     when 'comment'      then '#/community/a/' || coalesce((select article_id from public.article_comments where id = p_target), '')
     when 'job'          then '#/job/' || p_target
     when 'profile'      then '#/admin/people/' || p_target
     when 'company'      then '#/admin/people/' || p_target
     else '' end $$;

-- ---------- for everybody: who am I, and report something -------------------
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$ select public._is_admin() $$;

create or replace function public.report_item(p_kind text, p_target text, p_reason text, p_note text)
returns void language plpgsql security definer set search_path = public as
$$
declare ent text := my_entity(); tgt text := p_target;
begin
  if auth.uid() is null or ent is null then raise exception 'not allowed'; end if;
  if p_kind = 'company' then tgt := resolve_eid(p_target); end if;
  if tgt is null or not public._target_exists(p_kind, tgt) then raise exception 'not found'; end if;
  if p_kind = 'conversation' and not public.in_conversation(tgt) then raise exception 'not allowed'; end if;
  if public._owner_of(p_kind, tgt) is not distinct from auth.uid() then raise exception 'not allowed: own item'; end if;
  if (select count(*) from public.reports where reporter = auth.uid() and created_ts > (extract(epoch from now())*1000)::bigint - 86400000) >= 10 then
    raise exception 'too many reports';
  end if;
  insert into public.reports(reporter, reporter_entity, kind, target, reason, note, label)
  values (auth.uid(), ent, p_kind, tgt, p_reason, left(coalesce(p_note,''), 1000), left(public._label(p_kind, tgt), 200))
  on conflict do nothing;
end $$;

-- ---------- admin: overview -------------------------------------------------
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare ms bigint := (extract(epoch from now())*1000)::bigint; wk bigint; res jsonb;
begin
  perform public._require_admin();
  wk := ms - 7*86400000;
  select jsonb_build_object(
    'professionals', (select count(*) from public.profiles where role = 'consultant'),
    'companies',     (select count(*) from public.profiles where role = 'employer'),
    'signups7',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups30',     (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'noProfile',     (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id)),
    'openRoles',     (select count(*) from public.jobs where status = 'open' and not sample),
    'applications7', (select count(*) from public.applications where ts > wk),
    'conversations', (select count(*) from public.conversations),
    'messages7',     (select count(*) from public.messages where ts > wk),
    'posts7',        (select count(*) from public.questions where created_ts > wk and not sample)
                   + (select count(*) from public.answers where created_ts > wk and not sample)
                   + (select count(*) from public.articles where created_ts > wk and not sample)
                   + (select count(*) from public.article_comments where created_ts > wk and not sample),
    'openReports',   (select count(*) from public.reports where status = 'open'),
    'suspended',     (select count(*) from public.profiles where suspended),
    'selfCertified', (select count(*) from public.consultants c where not c.sample and not c.cert_revoked
                       and exists (select 1 from jsonb_array_elements(coalesce(c.data->'skills','[]'::jsonb)) k where k->>'certified' = 'true')),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d,'YYYY-MM-DD'), 'n',
                 (select count(*) from auth.users u where u.created_at::date = g.d)) order by g.d), '[]'::jsonb)
               from (select generate_series((now() - interval '13 days')::date, now()::date, interval '1 day')::date as d) g)
  ) into res;
  return res;
end $$;

-- ---------- admin: people ---------------------------------------------------
create or replace function public.admin_people(p_q text default '', p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%';
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(r order by (r->>'createdAt') desc) from (
    select jsonb_build_object(
      'userId', u.id, 'email', u.email, 'createdAt', u.created_at, 'lastSignIn', u.last_sign_in_at,
      'confirmed', u.email_confirmed_at is not null,
      'role', p.role, 'entityId', p.entity_id, 'suspended', coalesce(p.suspended, false), 'reason', coalesce(p.suspended_reason, ''),
      'name', case when p.role = 'consultant' then coalesce(nullif(trim(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')), ''), 'Anonymous professional')
                   when p.role = 'employer' then co.data->>'name' else null end,
      'headline', case when p.role = 'consultant' then c.data->>'headline' else co.data->>'industry' end,
      'anonymous', coalesce(c.anon, co.anon, false),
      'selfCertified', coalesce(exists (select 1 from jsonb_array_elements(coalesce(c.data->'skills','[]'::jsonb)) k where k->>'certified' = 'true'), false),
      'certRevoked', coalesce(c.cert_revoked, false),
      'roles', (select count(*) from public.jobs j where j.owner = u.id),
      'applications', (select count(*) from public.applications a where a.consultant_id = p.entity_id),
      'posts', (select count(*) from public.questions x where x.owner = u.id) + (select count(*) from public.answers x where x.owner = u.id)
             + (select count(*) from public.articles x where x.owner = u.id) + (select count(*) from public.article_comments x where x.owner = u.id)
    ) as r
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.consultants c on c.id = p.entity_id
    left join public.companies co on co.id = p.entity_id
    where q = '%%' or lower(u.email) like q or lower(coalesce(p.entity_id,'')) like q
       or lower(coalesce(c.data->>'firstName','') || ' ' || coalesce(c.data->>'lastName','')) like q
       or lower(coalesce(c.data->>'headline','')) like q or lower(coalesce(co.data->>'name','')) like q
    order by u.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))
  ) s), '[]'::jsonb);
end $$;

create or replace function public.admin_set_suspended(p_user uuid, p_on boolean, p_reason text) returns void
language plpgsql security definer set search_path = public, auth as
$$
declare em text;
begin
  perform public._require_admin();
  if p_user = auth.uid() then raise exception 'not allowed: yourself'; end if;
  select email into em from auth.users where id = p_user;
  if em is not null and exists (select 1 from public.admin_emails where lower(email) = lower(em)) then raise exception 'not allowed: admin'; end if;
  update public.profiles
     set suspended = p_on, suspended_reason = case when p_on then left(coalesce(p_reason,''), 300) else '' end,
         suspended_at = case when p_on then now() end
   where user_id = p_user;
  if not found then raise exception 'no profile'; end if;
  perform public._audit(case when p_on then 'suspend' else 'reinstate' end, coalesce(em, p_user::text), p_reason);
end $$;

create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as
$$
declare em text; eid text;
begin
  perform public._require_admin();
  if p_user = auth.uid() then raise exception 'not allowed: yourself'; end if;
  select email into em from auth.users where id = p_user;
  if em is null then raise exception 'not found'; end if;
  if exists (select 1 from public.admin_emails where lower(email) = lower(em)) then raise exception 'not allowed: admin'; end if;
  select entity_id into eid from public.profiles where user_id = p_user;
  delete from public.notifications where user_key = eid;
  delete from auth.users where id = p_user;
  perform public._audit('delete account', em, coalesce(eid, ''));
end $$;

create or replace function public.admin_set_cert_revoked(p_entity text, p_on boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  update public.consultants set cert_revoked = p_on where id = p_entity;
  if not found then raise exception 'not found'; end if;
  if p_on then
    perform public._notify(p_entity, 'The certified badge was removed from your profile because the certification could not be confirmed. Write to contact@arnour.com if you think this is a mistake.', '#/c/profile');
  end if;
  perform public._audit(case when p_on then 'remove badge' else 'restore badge' end, p_entity, '');
end $$;

-- ---------- admin: roles ----------------------------------------------------
create or replace function public.admin_jobs(p_q text default '', p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%';
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(r order by (r->>'postedTs')::bigint desc) from (
    select jsonb_build_object(
      'id', j.id, 'title', j.data->>'title', 'status', j.status, 'confidential', coalesce(j.confidential, false),
      'company', co.data->>'name', 'companyId', j.company_id, 'email', u.email, 'sample', j.sample, 'postedTs', j.posted_ts,
      'applicants', (select count(*) from public.applications a where a.job_id = j.id)) as r
    from public.jobs j
    left join public.companies co on co.id = j.company_id
    left join auth.users u on u.id = j.owner
    where q = '%%' or lower(coalesce(j.data->>'title','')) like q or lower(coalesce(co.data->>'name','')) like q or lower(coalesce(u.email,'')) like q
    order by j.posted_ts desc limit greatest(1, least(coalesce(p_limit, 60), 200))
  ) s), '[]'::jsonb);
end $$;

create or replace function public.admin_set_job_status(p_id text, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as
$$
declare jt text; cid text;
begin
  perform public._require_admin();
  if p_status not in ('open','closed') then raise exception 'bad status'; end if;
  update public.jobs set status = p_status, updated_at = now() where id = p_id returning data->>'title', company_id into jt, cid;
  if not found then raise exception 'not found'; end if;
  if p_status = 'closed' then
    perform public._notify(cid, 'Your role "' || coalesce(jt,'') || '" was closed by Arnour. ' || coalesce(nullif(p_reason,''), 'Write to contact@arnour.com for details.'), '#/e/jobs');
  end if;
  perform public._audit(case when p_status = 'closed' then 'close role' else 'reopen role' end, p_id, jt || ' — ' || coalesce(p_reason,''));
end $$;

create or replace function public.admin_delete_job(p_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as
$$
declare jt text; cid text;
begin
  perform public._require_admin();
  delete from public.jobs where id = p_id returning data->>'title', company_id into jt, cid;
  if not found then raise exception 'not found'; end if;
  perform public._notify(cid, 'Your role "' || coalesce(jt,'') || '" was removed by Arnour. ' || coalesce(nullif(p_reason,''), 'It did not follow our guidelines.'), '#/e/jobs');
  perform public._audit('delete role', p_id, jt || ' — ' || coalesce(p_reason,''));
end $$;

-- ---------- admin: community ------------------------------------------------
create or replace function public.admin_posts(p_q text default '', p_limit int default 60) returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%';
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(r order by (r->>'createdTs')::bigint desc) from (
    select * from (
      select jsonb_build_object('kind','question','id',x.id,'title',x.title,'createdTs',x.created_ts,'sample',x.sample,'anonymous',x.anonymous,
        'email',u.email,'count',(select count(*) from public.answers a where a.question_id = x.id)) as r
      from public.questions x left join auth.users u on u.id = x.owner
      where q = '%%' or lower(x.title) like q or lower(coalesce(u.email,'')) like q
      union all
      select jsonb_build_object('kind','article','id',x.id,'title',x.title,'createdTs',x.created_ts,'sample',x.sample,'anonymous',false,
        'email',u.email,'count',(select count(*) from public.article_comments a where a.article_id = x.id)) as r
      from public.articles x left join auth.users u on u.id = x.owner
      where q = '%%' or lower(x.title) like q or lower(coalesce(u.email,'')) like q
    ) t order by (r->>'createdTs')::bigint desc limit greatest(1, least(coalesce(p_limit, 60), 200))
  ) s), '[]'::jsonb);
end $$;

create or replace function public._remove_post(p_kind text, p_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as
$$
declare ent text; lbl text := public._label(p_kind, p_id); what text;
begin
  if p_kind = 'question' then delete from public.questions where id = p_id returning author into ent; what := 'question';
  elsif p_kind = 'answer' then delete from public.answers where id = p_id returning author into ent; what := 'answer';
  elsif p_kind = 'article' then delete from public.articles where id = p_id returning author into ent; what := 'article';
  elsif p_kind = 'comment' then delete from public.article_comments where id = p_id returning author into ent; what := 'comment';
  else raise exception 'bad kind'; end if;
  if not found then raise exception 'not found'; end if;
  perform public._notify(ent, 'Your ' || what || ' "' || left(lbl, 70) || '" was removed by Arnour. ' || coalesce(nullif(p_reason,''), 'It did not follow our community guidelines.'), '#/community');
  perform public._audit('remove ' || what, p_id, left(lbl,100) || ' — ' || coalesce(p_reason,''));
end $$;

create or replace function public.admin_remove_post(p_kind text, p_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as
$$ begin perform public._require_admin(); perform public._remove_post(p_kind, p_id, p_reason); end $$;

-- ---------- admin: reports --------------------------------------------------
create or replace function public.admin_reports(p_status text default 'open', p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public, auth as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(r order by (r->>'createdTs')::bigint desc) from (
    select jsonb_build_object(
      'id', x.id, 'kind', x.kind, 'target', x.target, 'reason', x.reason, 'note', x.note, 'label', x.label, 'status', x.status,
      'createdTs', x.created_ts, 'handledTs', x.handled_ts, 'handledNote', x.handled_note,
      'reporter', (select email from auth.users where id = x.reporter),
      'link', public._link(x.kind, x.target),
      'exists', public._target_exists(x.kind, x.target),
      'ownerEmail', (select email from auth.users where id = public._owner_of(x.kind, x.target)),
      'ownerSuspended', coalesce((select suspended from public.profiles where user_id = public._owner_of(x.kind, x.target)), false),
      'canRemove', x.kind in ('question','answer','article','comment','job'),
      'canSuspend', public._owner_of(x.kind, x.target) is not null) as r
    from public.reports x
    where (p_status = 'all' or x.status = p_status)
    order by x.created_ts desc limit greatest(1, least(coalesce(p_limit, 100), 300))
  ) s), '[]'::jsonb);
end $$;

create or replace function public.admin_moderate(p_report bigint, p_action text, p_note text) returns void
language plpgsql security definer set search_path = public, auth as
$$
declare rp public.reports; own uuid; em text; jt text; cid text;
begin
  perform public._require_admin();
  select * into rp from public.reports where id = p_report;
  if rp.id is null then raise exception 'not found'; end if;
  if p_action not in ('dismiss','resolve','remove','suspend') then raise exception 'bad action'; end if;
  if p_action = 'remove' and public._target_exists(rp.kind, rp.target) then
    if rp.kind = 'job' then
      delete from public.jobs where id = rp.target returning data->>'title', company_id into jt, cid;
      perform public._notify(cid, 'Your role "' || coalesce(jt,'') || '" was removed by Arnour. ' || coalesce(nullif(p_note,''), 'It did not follow our guidelines.'), '#/e/jobs');
      perform public._audit('delete role', rp.target, jt || ' — report ' || rp.id);
    else
      perform public._remove_post(rp.kind, rp.target, p_note);
    end if;
  elsif p_action = 'suspend' then
    own := public._owner_of(rp.kind, rp.target);
    if own is null then raise exception 'no owner'; end if;
    select email into em from auth.users where id = own;
    if own = auth.uid() or exists (select 1 from public.admin_emails where lower(email) = lower(coalesce(em,''))) then raise exception 'not allowed: admin'; end if;
    update public.profiles set suspended = true, suspended_reason = left(coalesce(nullif(p_note,''), 'Reported content'), 300), suspended_at = now() where user_id = own;
    perform public._audit('suspend', em, 'report ' || rp.id || ' — ' || coalesce(p_note,''));
  end if;
  update public.reports set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
         handled_ts = (extract(epoch from now())*1000)::bigint, handled_note = left(coalesce(p_note,''), 300)
   where kind = rp.kind and target = rp.target and status = 'open';
  perform public._audit('report ' || p_action, rp.kind || ':' || rp.target, coalesce(p_note,''));
end $$;

-- a reported conversation can be read, and only then
create or replace function public.admin_conversation(p_conv text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare cv public.conversations;
begin
  perform public._require_admin();
  if not exists (select 1 from public.reports where kind = 'conversation' and target = p_conv) then raise exception 'not reported'; end if;
  select * into cv from public.conversations where id = p_conv;
  if cv.id is null then raise exception 'not found'; end if;
  perform public._audit('read reported conversation', p_conv, '');
  return jsonb_build_object(
    'professional', (select coalesce(nullif(trim(coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','')), ''), 'Anonymous professional') from public.consultants where id = cv.c_id),
    'company', (select data->>'name' from public.companies where id = cv.e_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('side', m.side, 'text', m.text, 'ts', m.ts, 'cv', m.cv->>'name') order by m.ts)
                          from public.messages m where m.conv_id = p_conv), '[]'::jsonb));
end $$;

-- ---------- admin: settings and log ----------------------------------------
create or replace function public.admin_settings() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return jsonb_build_object('hideSamples', public._hide_samples());
end $$;

create or replace function public.admin_set_hide_samples(p_on boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  perform public._require_admin();
  insert into public.site_settings(key, value) values ('hide_samples', to_jsonb(coalesce(p_on,false)))
  on conflict (key) do update set value = excluded.value;
  perform public._audit(case when p_on then 'hide sample content' else 'show sample content' end, '', '');
end $$;

create or replace function public.admin_log_list(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('ts', l.ts, 'admin', l.admin, 'action', l.action, 'target', l.target, 'detail', l.detail) order by l.id desc)
                   from (select * from public.admin_log order by id desc limit greatest(1, least(coalesce(p_limit,100), 300))) l), '[]'::jsonb);
end $$;

-- ---------- who may call what ----------------------------------------------
revoke all on function
  public._is_admin(), public._require_admin(), public._audit(text,text,text), public._notify(text,text,text),
  public._owner_of(text,text), public._target_exists(text,text), public._label(text,text), public._link(text,text),
  public.am_i_admin(), public.report_item(text,text,text,text), public.admin_overview(), public.admin_people(text,int),
  public.admin_set_suspended(uuid,boolean,text), public.admin_delete_user(uuid), public.admin_set_cert_revoked(text,boolean),
  public.admin_jobs(text,int), public.admin_set_job_status(text,text,text), public.admin_delete_job(text,text),
  public.admin_posts(text,int), public._remove_post(text,text,text), public.admin_remove_post(text,text,text),
  public.admin_reports(text,int), public.admin_moderate(bigint,text,text), public.admin_conversation(text),
  public.admin_settings(), public.admin_set_hide_samples(boolean), public.admin_log_list(int)
  from public, anon, authenticated;

grant execute on function
  public.am_i_admin(), public.report_item(text,text,text,text), public.admin_overview(), public.admin_people(text,int),
  public.admin_set_suspended(uuid,boolean,text), public.admin_delete_user(uuid), public.admin_set_cert_revoked(text,boolean),
  public.admin_jobs(text,int), public.admin_set_job_status(text,text,text), public.admin_delete_job(text,text),
  public.admin_posts(text,int), public.admin_remove_post(text,text,text),
  public.admin_reports(text,int), public.admin_moderate(bigint,text,text), public.admin_conversation(text),
  public.admin_settings(), public.admin_set_hide_samples(boolean), public.admin_log_list(int)
  to authenticated;
