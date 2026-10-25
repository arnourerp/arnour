-- =====================================================================
-- 009 · Lists (regions, countries, cities, nationalities, languages) kept in the database
-- The admin edits them in Admin > Lists; the app reads them with get_lists().
-- Nothing is ever hard-deleted: items are hidden (still shown wherever someone
-- already uses them) or merged into another item. Ids never change.
-- Needs 008 (uses its _cat_slug / _cat_remap_ids helpers). Safe to run again.
-- Stored values: country = id, city / nationality / language = the name.
-- =====================================================================

create table if not exists public.list_items (
  kind text not null check (kind in ('region','country','city','nationality','language')),
  id text not null,
  parent text not null default '',          -- country: its region id; city: its country id
  name text not null,
  pos int not null default 0,
  hidden boolean not null default false,
  merged_into text,
  primary key (kind, id)
);
create table if not exists public.list_log (
  id bigserial primary key, ts bigint not null default (extract(epoch from now())*1000)::bigint,
  admin text not null default '', action text not null, summary text not null default '',
  undo jsonb, undone boolean not null default false
);
alter table public.list_items enable row level security;
alter table public.list_log   enable row level security;
revoke all on public.list_items, public.list_log from public, anon, authenticated;

-- ---------- helpers ----------------------------------------------------------
create or replace function public._lst_log(p_action text, p_summary text, p_undo jsonb) returns void
language plpgsql security definer set search_path = public, auth as
$$
begin
  insert into public.list_log(admin, action, summary, undo)
  values (coalesce((select email from auth.users where id = auth.uid()), '?'), p_action, left(coalesce(p_summary, ''), 300), p_undo);
  perform public._audit('lists ' || p_action, '', p_summary);
end $$;

/* Move every stored use of one value to another. Returns {profiles, roles}. Countries are stored by id, the rest by name. */
create or replace function public._lst_rewrite(p_kind text, p_parent text, p_from text, p_to text) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare np int := 0; nj int := 0;
begin
  if p_from is null or p_to is null or p_from = p_to then return jsonb_build_object('profiles', 0, 'roles', 0); end if;
  if p_kind = 'country' then
    update public.consultants set data = jsonb_set(data, '{country}', to_jsonb(p_to)) where data->>'country' = p_from; get diagnostics np = row_count;
    update public.jobs set data = jsonb_set(data, '{country}', to_jsonb(p_to)) where data->>'country' = p_from; get diagnostics nj = row_count;
    update public.companies set data = jsonb_set(data, '{country}', to_jsonb(p_to)) where data->>'country' = p_from;
  elsif p_kind = 'city' then
    update public.consultants set data = jsonb_set(data, '{city}', to_jsonb(p_to)) where data->>'country' = p_parent and data->>'city' = p_from; get diagnostics np = row_count;
    update public.jobs set data = jsonb_set(data, '{city}', to_jsonb(p_to)) where data->>'country' = p_parent and data->>'city' = p_from; get diagnostics nj = row_count;
    update public.companies set data = jsonb_set(data, '{city}', to_jsonb(p_to)) where data->>'country' = p_parent and data->>'city' = p_from;
  elsif p_kind = 'nationality' then
    update public.consultants set data = jsonb_set(data, '{nationality}', to_jsonb(p_to)) where data->>'nationality' = p_from; get diagnostics np = row_count;
  elsif p_kind = 'language' then
    update public.consultants set data = jsonb_set(data, '{languages}', public._cat_remap_ids(data->'languages', p_from, p_to))
      where jsonb_typeof(data->'languages') = 'array' and data->'languages' ? p_from; get diagnostics np = row_count;
    update public.jobs set data = jsonb_set(jsonb_set(data,
        '{languages}', case when jsonb_typeof(data->'languages') = 'array' then public._cat_remap_ids(data->'languages', p_from, p_to) else coalesce(data->'languages', 'null'::jsonb) end),
        '{preferredLangs}', case when jsonb_typeof(data->'preferredLangs') = 'array' then public._cat_remap_ids(data->'preferredLangs', p_from, p_to) else coalesce(data->'preferredLangs', 'null'::jsonb) end)
      where (jsonb_typeof(data->'languages') = 'array' and data->'languages' ? p_from) or (jsonb_typeof(data->'preferredLangs') = 'array' and data->'preferredLangs' ? p_from);
    get diagnostics nj = row_count;
  end if;
  return jsonb_build_object('profiles', np, 'roles', nj);
end $$;

-- ---------- seed (only when empty) -------------------------------------------
do $$
declare s jsonb; r jsonb; c jsonb; i int; j int; cid text; old text; nw text; maps jsonb;
begin
  if exists (select 1 from public.list_items) then return; end if;
  s := $json$
  {"regions":[["middle-east","Middle East"],["north-africa","North Africa"],["india","India & Pakistan"],["other","Other"]],
   "countries":[
    ["eg","Egypt","middle-east",["Cairo","Alexandria","Giza"],"Egyptian"],
    ["jo","Jordan","middle-east",["Amman","Zarqa","Irbid"],"Jordanian"],
    ["ps","Palestine","middle-east",["Ramallah","Gaza","Jerusalem","Bethlehem"],"Palestinian"],
    ["lb","Lebanon","middle-east",["Beirut","Tripoli","Sidon"],"Lebanese"],
    ["iq","Iraq","middle-east",["Baghdad","Basra","Erbil"],"Iraqi"],
    ["tr","Turkey","middle-east",["Istanbul","Ankara","Izmir"],"Turkish"],
    ["ae","United Arab Emirates","middle-east",["Dubai","Abu Dhabi","Sharjah","Ajman","Ras Al Khaimah","Al Ain","Fujairah","Umm Al Quwain"],"Emirati"],
    ["sa","Saudi Arabia","middle-east",["Riyadh","Jeddah","Dammam","Mecca","Medina"],"Saudi"],
    ["qa","Qatar","middle-east",["Doha","Al Wakrah"],"Qatari"],
    ["kw","Kuwait","middle-east",["Kuwait City","Al Ahmadi","Al Jubail"],"Kuwaiti"],
    ["bh","Bahrain","middle-east",["Manama","Muharraq"],"Bahraini"],
    ["om","Oman","middle-east",["Muscat","Salalah","Sohar"],"Omani"],
    ["ma","Morocco","north-africa",["Casablanca","Rabat","Marrakech"],"Moroccan"],
    ["tn","Tunisia","north-africa",["Tunis","Sfax","Sousse"],"Tunisian"],
    ["dz","Algeria","north-africa",["Algiers","Oran","Constantine"],"Algerian"],
    ["in","India","india",["Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Pune","Gurgaon","Kolkata"],"Indian"],
    ["pk","Pakistan","india",["Karachi","Lahore","Islamabad"],"Pakistani"],
    ["gb","United Kingdom","other",["London","Manchester","Birmingham"],"British"],
    ["de","Germany","other",["Munich","Frankfurt","Hamburg","Berlin"],"German"],
    ["us","United States","other",["New York","Chicago","Austin"],"American"],
    ["fr","France","other",["Paris","Lyon","Marseille"],"French"],
    ["other","Other","other",[],"Other"]],
   "languages":["English","Arabic","Hindi","Urdu","French"]}
  $json$::jsonb;
  i := 0;
  for r in select * from jsonb_array_elements(s->'regions') loop
    i := i + 1; insert into public.list_items(kind, id, name, pos) values ('region', r->>0, r->>1, i);
  end loop;
  i := 0; j := 0; maps := '{}'::jsonb;
  for c in select * from jsonb_array_elements(s->'countries') loop
    i := i + 1;
    insert into public.list_items(kind, id, parent, name, pos) values ('country', c->>0, c->>2, c->>1, i);
    j := 0;
    for r in select * from jsonb_array_elements(c->3) loop
      j := j + 1; insert into public.list_items(kind, id, parent, name, pos) values ('city', (c->>0) || ':' || public._cat_slug(r #>> '{}', '-'), c->>0, r #>> '{}', j);
    end loop;
    insert into public.list_items(kind, id, name, pos) values ('nationality', public._cat_slug(c->>4, '-'), c->>4, i);
    maps := maps || jsonb_build_object(c->>1, c->>4);
  end loop;
  i := 0;
  for r in select * from jsonb_array_elements(s->'languages') loop
    i := i + 1; insert into public.list_items(kind, id, name, pos) values ('language', public._cat_slug(r #>> '{}', '-'), r #>> '{}', i);
  end loop;
  /* nationalities used to be the country name ("Egypt"); now they are demonyms ("Egyptian"). Move saved profiles across once. */
  for old, nw in select key, value #>> '{}' from jsonb_each(maps) loop
    if old <> nw then
      update public.consultants set data = jsonb_set(data, '{nationality}', to_jsonb(nw)) where data->>'nationality' = old;
    end if;
  end loop;
end $$;

-- ---------- public read -------------------------------------------------------
create or replace function public.get_lists() returns jsonb
language sql stable security definer set search_path = public as
$$
select jsonb_build_object(
  'v', coalesce((select max(id) from public.list_log), 0),
  'regions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'hidden', hidden) order by pos, id) from public.list_items where kind = 'region'), '[]'::jsonb),
  'countries', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'region', c.parent, 'hidden', c.hidden,
      'cities', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'hidden', t.hidden) order by t.pos, t.id)
                          from public.list_items t where t.kind = 'city' and t.parent = c.id), '[]'::jsonb)) order by c.pos, c.id)
                        from public.list_items c where c.kind = 'country'), '[]'::jsonb),
  'nationalities', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'hidden', hidden) order by pos, id) from public.list_items where kind = 'nationality'), '[]'::jsonb),
  'languages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'hidden', hidden) order by pos, id) from public.list_items where kind = 'language'), '[]'::jsonb),
  'mergedCountries', coalesce((select jsonb_agg(jsonb_build_array(id, merged_into)) from public.list_items where kind = 'country' and merged_into is not null), '[]'::jsonb)
)
$$;

-- ---------- usage counts (admin) --------------------------------------------
create or replace function public.admin_lists_usage() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare r jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object(
    'country', coalesce((select jsonb_object_agg(k, v) from (
        select k, jsonb_build_object('pros', count(*) filter (where side = 'c'), 'roles', count(*) filter (where side = 'j')) as v from (
          select data->>'country' as k, 'c' as side from public.consultants where not sample and data->>'country' is not null
          union all select data->>'country', 'j' from public.jobs where not sample and data->>'country' is not null) z group by k) y), '{}'::jsonb),
    'city', coalesce((select jsonb_object_agg(k, v) from (
        select k, jsonb_build_object('pros', count(*) filter (where side = 'c'), 'roles', count(*) filter (where side = 'j')) as v from (
          select (data->>'country') || '|' || (data->>'city') as k, 'c' as side from public.consultants where not sample and coalesce(data->>'city', '') <> ''
          union all select (data->>'country') || '|' || (data->>'city'), 'j' from public.jobs where not sample and coalesce(data->>'city', '') <> '') z group by k) y), '{}'::jsonb),
    'nationality', coalesce((select jsonb_object_agg(k, v) from (
        select data->>'nationality' as k, jsonb_build_object('pros', count(*)) as v from public.consultants where not sample and coalesce(data->>'nationality', '') <> '' group by 1) y), '{}'::jsonb),
    'language', coalesce((select jsonb_object_agg(k, v) from (
        select k, jsonb_build_object('pros', count(*) filter (where side = 'c'), 'roles', count(*) filter (where side = 'j')) as v from (
          select l as k, 'c' as side from public.consultants, jsonb_array_elements_text(case when jsonb_typeof(data->'languages') = 'array' then data->'languages' else '[]'::jsonb end) l where not sample
          union all select l, 'j' from public.jobs, jsonb_array_elements_text(case when jsonb_typeof(data->'languages') = 'array' then data->'languages' else '[]'::jsonb end) l where not sample) z group by k) y), '{}'::jsonb)
  ) into r;
  return r;
end $$;

create or replace function public.admin_lists_log(p_limit int default 40) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare lastid bigint;
begin
  perform public._require_admin();
  select id into lastid from public.list_log where not undone order by id desc limit 1;
  return coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'ts', l.ts, 'admin', l.admin, 'action', l.action, 'summary', l.summary,
                                                      'undone', l.undone, 'canUndo', (l.id = lastid and l.undo is not null)) order by l.id desc)
                     from (select * from public.list_log order by id desc limit greatest(1, least(coalesce(p_limit, 40), 200))) l), '[]'::jsonb);
end $$;

-- ---------- editing (admin) -------------------------------------------------
-- ops: save {kind,id?,name,parent,hidden}, reorder {kind,parent,ids}, merge {kind,from,to}, undo
create or replace function public.admin_lists_save(p_op text, p_args jsonb) returns jsonb
language plpgsql security definer set search_path = public, auth as
$$
declare
  a jsonb := coalesce(p_args, '{}'::jsonb);
  k text := a->>'kind';
  nm text := btrim(coalesce(a->>'name', ''));
  par text := coalesce(a->>'parent', '');
  hid boolean := coalesce((a->>'hidden')::boolean, false);
  rid text := nullif(a->>'id', '');
  lbl text; row0 jsonb; newid text; base text; n int; summary text; undo jsonb; rw jsonb := null; ids jsonb; rt text; i int;
  fr record; to_r record; lg record; e jsonb; cr record; res jsonb;
  kinds text[] := array['region','country','city','nationality','language'];
begin
  perform public._require_admin();
  if p_op in ('save', 'reorder', 'merge') and not (k = any (kinds)) then raise exception 'Unknown list'; end if;
  lbl := case k when 'region' then 'region' when 'country' then 'country' when 'city' then 'city' when 'nationality' then 'nationality' else 'language' end;

  if p_op = 'save' then
    if nm = '' then raise exception 'Please give it a name'; end if;
    if length(nm) > 80 then raise exception 'That name is too long'; end if;
    if k = 'country' and not exists (select 1 from public.list_items where kind = 'region' and id = par) then raise exception 'Choose a region'; end if;
    if k = 'city' and rid is not null then par := coalesce((select parent from public.list_items where kind = 'city' and id = rid), par); end if;
    if k = 'city' and not exists (select 1 from public.list_items where kind = 'country' and id = par) then raise exception 'Choose a country'; end if;
    if k not in ('country', 'city') then par := ''; end if;
    if exists (select 1 from public.list_items where kind = k and lower(name) = lower(nm) and (k <> 'city' or parent = par) and id is distinct from rid) then
      raise exception 'That % already exists. To combine two, use Merge.', lbl;
    end if;
    if rid is null then
      base := case when k = 'city' then par || ':' || public._cat_slug(nm, '-') when k = 'country' then public._cat_slug(nm, '') else public._cat_slug(nm, '-') end;
      newid := base; n := 1;
      while exists (select 1 from public.list_items where kind = k and id = newid) loop n := n + 1; newid := base || n; end loop;
      insert into public.list_items(kind, id, parent, name, pos, hidden)
      values (k, newid, par, nm, coalesce((select max(pos) from public.list_items where kind = k and (k <> 'city' or parent = par)), 0) + 1, hid);
      undo := jsonb_build_array(jsonb_build_object('t', 'item', 'kind', k, 'id', newid, 'row', null));
      summary := 'Added ' || lbl || ' "' || nm || '"';
    else
      select to_jsonb(x) into row0 from public.list_items x where kind = k and id = rid;
      if row0 is null then raise exception 'Unknown %', lbl; end if;
      if hid and k = 'region' and exists (select 1 from public.list_items where kind = 'country' and parent = rid and not hidden) then
        raise exception 'This region still has visible countries. Move or hide them first.';
      end if;
      if k = 'city' then par := row0->>'parent'; end if;
      update public.list_items set name = nm, parent = case when k = 'country' then par else parent end, hidden = hid where kind = k and id = rid;
      newid := rid;
      undo := jsonb_build_array(jsonb_build_object('t', 'item', 'kind', k, 'id', rid, 'row', row0));
      if k in ('city', 'nationality', 'language') and row0->>'name' <> nm then
        rw := public._lst_rewrite(k, case when k = 'city' then par else '' end, row0->>'name', nm);
        undo := undo || jsonb_build_array(jsonb_build_object('t', 'rename', 'kind', k, 'parent', case when k = 'city' then par else '' end, 'from', nm, 'to', row0->>'name'));
      end if;
      summary := case when hid and not coalesce((row0->>'hidden')::boolean, false) then 'Hid ' || lbl || ' "' || nm || '"'
                      when not hid and coalesce((row0->>'hidden')::boolean, false) then 'Unhid ' || lbl || ' "' || nm || '"'
                      when row0->>'name' <> nm then 'Renamed ' || lbl || ' "' || (row0->>'name') || '" to "' || nm || '"'
                      else 'Edited ' || lbl || ' "' || nm || '"' end;
    end if;
    perform public._lst_log(k, summary, undo);
    return jsonb_build_object('lists', public.get_lists(), 'id', newid, 'rewrite', rw);

  elsif p_op = 'reorder' then
    ids := a->'ids';
    if jsonb_typeof(ids) <> 'array' then raise exception 'Nothing to reorder'; end if;
    undo := jsonb_build_array(jsonb_build_object('t', 'reorder', 'kind', k, 'parent', par,
      'ids', (select jsonb_agg(id order by pos, id) from public.list_items where kind = k and (k not in ('city', 'country') or parent = par or (k = 'country' and par = '')))));
    i := 0;
    for rt in select jsonb_array_elements_text(ids) loop i := i + 1; update public.list_items set pos = i where kind = k and id = rt; end loop;
    perform public._lst_log('reorder', 'Changed the order of ' || lbl || 's', undo);
    return jsonb_build_object('lists', public.get_lists());

  elsif p_op = 'merge' then
    select * into fr from public.list_items where kind = k and id = a->>'from';
    select * into to_r from public.list_items where kind = k and id = a->>'to';
    if fr.id is null then raise exception 'Unknown % to merge', lbl; end if;
    if to_r.id is null or to_r.hidden then raise exception 'The % to merge into must exist and be visible', lbl; end if;
    if fr.id = to_r.id then raise exception 'Choose a different % to merge into', lbl; end if;
    if k = 'city' and fr.parent <> to_r.parent then raise exception 'Cities can only be merged within the same country'; end if;
    if k = 'region' then raise exception 'Regions cannot be merged. Move the countries to another region, then hide it.'; end if;
    if k = 'country' then
      res := public._lst_rewrite('country', '', fr.id, to_r.id);
      for cr in select * from public.list_items where kind = 'city' and parent = fr.id loop
        if exists (select 1 from public.list_items where kind = 'city' and parent = to_r.id and lower(name) = lower(cr.name)) then
          update public.list_items set hidden = true, merged_into = (select id from public.list_items where kind = 'city' and parent = to_r.id and lower(name) = lower(cr.name) limit 1) where kind = 'city' and id = cr.id;
        else
          update public.list_items set parent = to_r.id, pos = pos + 1000 where kind = 'city' and id = cr.id;
        end if;
      end loop;
    elsif k = 'city' then
      res := public._lst_rewrite('city', fr.parent, fr.name, to_r.name);
    else
      res := public._lst_rewrite(k, '', fr.name, to_r.name);
    end if;
    update public.list_items set hidden = true, merged_into = to_r.id where kind = k and id = fr.id;
    perform public._lst_log('merge', 'Merged ' || lbl || ' "' || fr.name || '" into "' || to_r.name || '" (' || (res->>'profiles') || ' profiles, ' || (res->>'roles') || ' roles)', null);
    return jsonb_build_object('lists', public.get_lists(), 'profiles', (res->>'profiles')::int, 'roles', (res->>'roles')::int);

  elsif p_op = 'undo' then
    select * into lg from public.list_log where not undone order by id desc limit 1;
    if lg.id is null then raise exception 'Nothing to undo'; end if;
    if lg.undo is null then raise exception 'The last change was a merge. Merges cannot be undone.'; end if;
    for e in select * from jsonb_array_elements(lg.undo) loop
      if e->>'t' = 'item' then
        if e->'row' = 'null'::jsonb then delete from public.list_items where kind = e->>'kind' and id = e->>'id';
        else update public.list_items x set name = r.name, parent = r.parent, pos = r.pos, hidden = r.hidden, merged_into = r.merged_into
               from jsonb_populate_record(null::public.list_items, e->'row') r where x.kind = r.kind and x.id = r.id; end if;
      elsif e->>'t' = 'rename' then
        perform public._lst_rewrite(e->>'kind', e->>'parent', e->>'from', e->>'to');
      elsif e->>'t' = 'reorder' then
        i := 0;
        for rt in select jsonb_array_elements_text(e->'ids') loop i := i + 1; update public.list_items set pos = i where kind = e->>'kind' and id = rt; end loop;
      end if;
    end loop;
    update public.list_log set undone = true where id = lg.id;
    perform public._audit('lists undo', '', lg.summary);
    return jsonb_build_object('lists', public.get_lists(), 'undone', lg.summary);
  else
    raise exception 'Unknown action';
  end if;
end $$;

revoke all on function public._lst_log(text,text,jsonb), public._lst_rewrite(text,text,text,text), public.admin_lists_usage(), public.admin_lists_log(int),
  public.admin_lists_save(text,jsonb), public.get_lists() from public, anon, authenticated;
grant execute on function public.get_lists() to anon, authenticated;
grant execute on function public.admin_lists_usage(), public.admin_lists_log(int), public.admin_lists_save(text,jsonb) to authenticated;
