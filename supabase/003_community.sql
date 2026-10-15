-- ============================================================================
-- ARNOUR — Release 2: community (questions, answers, articles, comments, upvotes)
-- Run AFTER 001_schema.sql. Safe to run more than once.
-- Then run 004_seed_community.sql to add the labelled sample posts.
-- ============================================================================

create table if not exists public.questions (
  id          text primary key,
  owner       uuid references auth.users(id) on delete cascade,
  author      text not null,
  title       text not null check (char_length(title) between 1 and 200),
  body        text not null check (char_length(body) between 1 and 5000),
  product_id  text not null default '',
  module_id   text not null default '',
  topic       text not null default '',
  anonymous   boolean not null default false,
  sample      boolean not null default false,
  votes_base  int not null default 0,
  milestone   int not null default 0,
  created_ts  bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists questions_ts_idx on public.questions(created_ts desc);

create table if not exists public.answers (
  id          text primary key,
  question_id text not null references public.questions(id) on delete cascade,
  owner       uuid references auth.users(id) on delete cascade,
  author      text not null,
  body        text not null check (char_length(body) between 1 and 5000),
  accepted    boolean not null default false,
  sample      boolean not null default false,
  votes_base  int not null default 0,
  milestone   int not null default 0,
  created_ts  bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists answers_q_idx on public.answers(question_id, created_ts);

create table if not exists public.articles (
  id          text primary key,
  owner       uuid references auth.users(id) on delete cascade,
  author      text not null,
  title       text not null check (char_length(title) between 1 and 200),
  url         text not null check (char_length(url) <= 500 and url ~* '^https?://'),
  body        text not null default '' check (char_length(body) <= 5000),
  product_id  text not null default '',
  module_id   text not null default '',
  topic       text not null default '',
  sample      boolean not null default false,
  votes_base  int not null default 0,
  milestone   int not null default 0,
  created_ts  bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists articles_ts_idx on public.articles(created_ts desc);

create table if not exists public.article_comments (
  id          text primary key,
  article_id  text not null references public.articles(id) on delete cascade,
  owner       uuid references auth.users(id) on delete cascade,
  author      text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  sample      boolean not null default false,
  created_ts  bigint not null default (extract(epoch from now())*1000)::bigint
);
create index if not exists comments_a_idx on public.article_comments(article_id, created_ts);

-- kind: q = question, a = answer, r = article
create table if not exists public.votes (
  kind     text not null check (kind in ('q','a','r')),
  item_id  text not null,
  voter    text not null,
  owner    uuid references auth.users(id) on delete cascade,
  primary key (kind, item_id, voter)
);
create index if not exists votes_item_idx on public.votes(kind, item_id);

-- ---------- helpers ---------------------------------------------------------
create or replace function public._cid(p_prefix text, p_id text) returns text
language plpgsql volatile set search_path = public as
$$
begin
  if p_id is null or p_id = '' then
    return p_prefix || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14);
  end if;
  if p_id !~ '^[a-z]{1,4}[0-9]{8,16}$' then raise exception 'bad id'; end if;
  return p_id;
end $$;

-- at most 40 community posts per person per hour
create or replace function public._comm_guard() returns void
language plpgsql security definer set search_path = public as
$$
declare since bigint := (extract(epoch from now())*1000)::bigint - 3600000; n int;
begin
  if auth.uid() is null or my_entity() is null then raise exception 'not allowed'; end if;
  select (select count(*) from public.questions where owner = auth.uid() and created_ts > since)
       + (select count(*) from public.answers where owner = auth.uid() and created_ts > since)
       + (select count(*) from public.articles where owner = auth.uid() and created_ts > since)
       + (select count(*) from public.article_comments where owner = auth.uid() and created_ts > since) into n;
  if n >= 40 then raise exception 'too many posts, slow down'; end if;
end $$;

-- the id the viewer is allowed to see for an author (confidential companies show their alias)
create or replace function public._pub_eid(p_eid text) returns text
language plpgsql stable security definer set search_path = public as
$$
declare co public.companies;
begin
  select * into co from public.companies where id = p_eid;
  if co.id is not null and _co_hidden(co, null::public.jobs) then return co.alias; end if;
  return p_eid;
end $$;

-- ---------- reading ---------------------------------------------------------
create or replace function public.list_community() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  me uuid := auth.uid();
  qs jsonb; ars jsonb; auths jsonb; ids text[];
begin
  select coalesce(jsonb_agg(x order by (x->>'createdTs')::bigint desc), '[]'::jsonb) into qs from (
    select jsonb_build_object(
      'id', q.id,
      'authorId', case when q.anonymous and q.owner is distinct from me then null else _pub_eid(q.author) end,
      'title', q.title, 'body', q.body, 'productId', q.product_id, 'moduleId', q.module_id, 'topic', q.topic,
      'anonymous', q.anonymous, 'sample', q.sample, 'createdTs', q.created_ts, 'milestone', q.milestone,
      'mine', q.owner is not distinct from me and me is not null,
      'upvotes', q.votes_base + (select count(*) from public.votes v where v.kind = 'q' and v.item_id = q.id),
      'upvotedBy', coalesce((select jsonb_agg(_pub_eid(v.voter)) from public.votes v where v.kind = 'q' and v.item_id = q.id), '[]'::jsonb),
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'authorId', _pub_eid(a.author), 'body', a.body, 'createdTs', a.created_ts,
          'accepted', a.accepted, 'sample', a.sample, 'milestone', a.milestone,
          'mine', a.owner is not distinct from me and me is not null,
          'upvotes', a.votes_base + (select count(*) from public.votes v where v.kind = 'a' and v.item_id = a.id),
          'upvotedBy', coalesce((select jsonb_agg(_pub_eid(v.voter)) from public.votes v where v.kind = 'a' and v.item_id = a.id), '[]'::jsonb)
        ) order by a.created_ts)
        from public.answers a where a.question_id = q.id and public._visible(a.owner, a.sample)), '[]'::jsonb)
    ) as x
    from public.questions q where public._visible(q.owner, q.sample) order by q.created_ts desc limit 300
  ) s;

  select coalesce(jsonb_agg(x order by (x->>'createdTs')::bigint desc), '[]'::jsonb) into ars from (
    select jsonb_build_object(
      'id', r.id, 'authorId', _pub_eid(r.author), 'title', r.title, 'url', r.url, 'body', r.body,
      'productId', r.product_id, 'moduleId', r.module_id, 'topic', r.topic,
      'sample', r.sample, 'createdTs', r.created_ts, 'milestone', r.milestone,
      'mine', r.owner is not distinct from me and me is not null,
      'upvotes', r.votes_base + (select count(*) from public.votes v where v.kind = 'r' and v.item_id = r.id),
      'upvotedBy', coalesce((select jsonb_agg(_pub_eid(v.voter)) from public.votes v where v.kind = 'r' and v.item_id = r.id), '[]'::jsonb),
      'comments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'authorId', _pub_eid(c.author), 'body', c.body, 'createdTs', c.created_ts,
          'mine', c.owner is not distinct from me and me is not null
        ) order by c.created_ts)
        from public.article_comments c where c.article_id = r.id and public._visible(c.owner, c.sample)), '[]'::jsonb)
    ) as x
    from public.articles r where public._visible(r.owner, r.sample) order by r.created_ts desc limit 150
  ) s;

  -- people who wrote something, so visitors who are not signed in can still see who it was
  -- (anonymous members stay anonymous; contact details are never included)
  select array_agg(distinct e) into ids from (
    select author as e from public.answers
    union select author from public.article_comments
    union select author from public.articles
    union select author from public.questions where not anonymous or owner = me
    union select voter from public.votes
  ) u;
  select coalesce(jsonb_agg(
    case when c.anon and c.owner is distinct from me then _redact_consultant(c)
         else (c.data - array['email','phone','cv','savedJobIds','linkedin']) || jsonb_build_object('id', c.id, 'anon', c.anon, 'sample', c.sample) end
  ), '[]'::jsonb) into auths
  from public.consultants c where c.id = any(coalesce(ids, array[]::text[]));

  return jsonb_build_object('questions', qs, 'articles', ars, 'authors', auths);
end $$;

-- ---------- writing ---------------------------------------------------------
create or replace function public.post_question(p_id text, p_title text, p_body text, p_product text, p_module text, p_topic text, p_anon boolean)
returns text language plpgsql security definer set search_path = public as
$$
declare nid text := _cid('q', p_id);
begin
  perform _comm_guard();
  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_body),'') = '' then raise exception 'not allowed: empty'; end if;
  if coalesce(p_product,'') = '' and coalesce(p_topic,'') = '' then raise exception 'not allowed: choose a topic'; end if;
  insert into public.questions(id, owner, author, title, body, product_id, module_id, topic, anonymous)
  values (nid, auth.uid(), my_entity(), left(trim(p_title),200), left(trim(p_body),5000), left(coalesce(p_product,''),60),
          case when coalesce(p_product,'') <> '' then left(coalesce(p_module,''),60) else '' end,
          case when coalesce(p_product,'') = '' then left(coalesce(p_topic,''),60) else '' end, coalesce(p_anon,false));
  return nid;
end $$;

create or replace function public.post_answer(p_q text, p_id text, p_body text)
returns text language plpgsql security definer set search_path = public as
$$
declare nid text := _cid('ca', p_id);
begin
  perform _comm_guard();
  if coalesce(trim(p_body),'') = '' then raise exception 'not allowed: empty'; end if;
  if not exists (select 1 from public.questions where id = p_q) then raise exception 'not found'; end if;
  insert into public.answers(id, question_id, owner, author, body) values (nid, p_q, auth.uid(), my_entity(), left(trim(p_body),5000));
  return nid;
end $$;

create or replace function public.accept_answer(p_q text, p_a text, p_on boolean)
returns void language plpgsql security definer set search_path = public as
$$
declare q public.questions; a public.answers;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into q from public.questions where id = p_q;
  select * into a from public.answers where id = p_a and question_id = p_q;
  if q.id is null or a.id is null then raise exception 'not found'; end if;
  if q.owner is distinct from auth.uid() then raise exception 'not allowed: only the author can accept'; end if;
  if a.owner is not distinct from auth.uid() then raise exception 'not allowed: own answer'; end if;
  if p_on then update public.answers set accepted = (id = p_a) where question_id = p_q;
  else update public.answers set accepted = false where id = p_a; end if;
end $$;

create or replace function public.post_article(p_id text, p_title text, p_url text, p_body text, p_product text, p_module text, p_topic text)
returns text language plpgsql security definer set search_path = public as
$$
declare nid text := _cid('art', p_id);
begin
  perform _comm_guard();
  if coalesce(trim(p_title),'') = '' or coalesce(trim(p_url),'') = '' then raise exception 'not allowed: empty'; end if;
  if coalesce(p_product,'') = '' and coalesce(p_topic,'') = '' then raise exception 'not allowed: choose a topic'; end if;
  insert into public.articles(id, owner, author, title, url, body, product_id, module_id, topic)
  values (nid, auth.uid(), my_entity(), left(trim(p_title),200), left(trim(p_url),500), left(coalesce(p_body,''),5000), left(coalesce(p_product,''),60),
          case when coalesce(p_product,'') <> '' then left(coalesce(p_module,''),60) else '' end,
          case when coalesce(p_product,'') = '' then left(coalesce(p_topic,''),60) else '' end);
  return nid;
end $$;

create or replace function public.post_comment(p_article text, p_id text, p_body text)
returns text language plpgsql security definer set search_path = public as
$$
declare nid text := _cid('cm', p_id);
begin
  perform _comm_guard();
  if coalesce(trim(p_body),'') = '' then raise exception 'not allowed: empty'; end if;
  if not exists (select 1 from public.articles where id = p_article) then raise exception 'not found'; end if;
  insert into public.article_comments(id, article_id, owner, author, body) values (nid, p_article, auth.uid(), my_entity(), left(trim(p_body),2000));
  return nid;
end $$;

create or replace function public.delete_comment(p_id text)
returns void language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.article_comments where id = p_id and owner = auth.uid();
end $$;

create or replace function public.set_vote(p_kind text, p_item text, p_on boolean)
returns void language plpgsql security definer set search_path = public as
$$
declare ent text := my_entity(); n int; base int; ms int;
begin
  if auth.uid() is null or ent is null then raise exception 'not allowed'; end if;
  if p_kind not in ('q','a','r') then raise exception 'bad kind'; end if;
  if p_kind = 'q' then perform 1 from public.questions where id = p_item;
  elsif p_kind = 'a' then perform 1 from public.answers where id = p_item;
  else perform 1 from public.articles where id = p_item; end if;
  if not found then raise exception 'not found'; end if;
  if p_on then
    insert into public.votes(kind, item_id, voter, owner) values (p_kind, p_item, ent, auth.uid()) on conflict do nothing;
  else
    delete from public.votes where kind = p_kind and item_id = p_item and voter = ent;
  end if;
  select count(*) into n from public.votes where kind = p_kind and item_id = p_item;
  if p_kind = 'q' then select votes_base, milestone into base, ms from public.questions where id = p_item;
  elsif p_kind = 'a' then select votes_base, milestone into base, ms from public.answers where id = p_item;
  else select votes_base, milestone into base, ms from public.articles where id = p_item; end if;
  n := n + coalesce(base,0);
  if p_on and n in (5,10,25) and n > coalesce(ms,0) then
    if p_kind = 'q' then update public.questions set milestone = n where id = p_item;
    elsif p_kind = 'a' then update public.answers set milestone = n where id = p_item;
    else update public.articles set milestone = n where id = p_item; end if;
  end if;
end $$;

-- ---------- access rules ----------------------------------------------------
alter table public.questions        enable row level security;
alter table public.answers          enable row level security;
alter table public.articles         enable row level security;
alter table public.article_comments enable row level security;
alter table public.votes            enable row level security;

revoke all on public.questions, public.answers, public.articles, public.article_comments, public.votes from anon, authenticated, public;
revoke all on function public._cid(text,text), public._comm_guard(), public._pub_eid(text),
  public.list_community(), public.post_question(text,text,text,text,text,text,boolean), public.post_answer(text,text,text),
  public.accept_answer(text,text,boolean), public.post_article(text,text,text,text,text,text,text),
  public.post_comment(text,text,text), public.delete_comment(text), public.set_vote(text,text,boolean)
  from public, anon, authenticated;

grant execute on function public.list_community() to anon, authenticated;
grant execute on function public.post_question(text,text,text,text,text,text,boolean), public.post_answer(text,text,text),
  public.accept_answer(text,text,boolean), public.post_article(text,text,text,text,text,text,text),
  public.post_comment(text,text,text), public.delete_comment(text), public.set_vote(text,text,boolean) to authenticated;
