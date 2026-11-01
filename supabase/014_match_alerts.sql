-- =====================================================================
-- 014 · Match alerts on the server (release 31)
-- Until now the employer's own browser scored every professional and sent the
-- alerts one by one (limited to 60 an hour, lost if the tab was closed, and never
-- sent for imported roles). From here the database does it:
--   * a role that is posted, imported, re-opened or edited (skills, place, languages,
--     certification) is put in a queue; a worker scores it against every professional
--     with the same Match v19 rules as the website (function match_score)
--   * a professional is told about a role at most once, and at most 5 times in 24 hours
--     (best matches first). Employer-posted roles alert from 70%, imported roles from 80%
--   * when a professional changes their skills or role types, they hear about their top 3
--     open roles (at most once a week)
-- The wording, the confidential-company rule and the e-mail settings are unchanged
-- (the alert is an ordinary notification, so the e-mail rules in 007 apply as before).
-- Needs 001–010. Safe to run again. Ends with:  select 'ok' as release31;
-- =====================================================================

-- ---------- small helpers ---------------------------------------------------
create or replace function public._m_num(v jsonb) returns double precision
language sql immutable as
$$ select case jsonb_typeof(v)
     when 'number' then (v #>> '{}')::double precision
     when 'string' then case when (v #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then btrim(v #>> '{}')::double precision else 0 end
     else 0 end $$;

create or replace function public._m_arr(v jsonb) returns text[]
language sql immutable as
$$ select case when jsonb_typeof(v) = 'array' then coalesce(array(select jsonb_array_elements_text(v)), array[]::text[]) else array[]::text[] end $$;

create or replace function public._m_xfer(jp text, cp text) returns double precision
language sql immutable as
$$ select case jp
     when 'ecc'      then case cp when 'ecc' then 1 when 's4onprem' then 0.80 when 's4public' then 0.60 end
     when 's4onprem' then case cp when 'ecc' then 0.75 when 's4onprem' then 1 when 's4public' then 0.70 end
     when 's4public' then case cp when 'ecc' then 0.65 when 's4onprem' then 0.80 when 's4public' then 1 end
   end $$;

create or replace function public._m_equiv(m text) returns text[]
language sql immutable as
$$ select case m when 'fico' then array['fico','fi','co'] when 'fi' then array['fi','fico'] when 'co' then array['co','fico'] else array[m] end $$;

-- module family as the catalog stores it (what the website uses once the catalog is loaded)
create or replace function public._m_fam(mod text) returns text
language sql stable security definer set search_path = public as
$$ select family from public.catalog_modules where id = mod and family <> '' order by (select pos from public.catalog_products p where p.id = product_id), product_id limit 1 $$;

create or replace function public._m_rt_list(c jsonb) returns text[]
language plpgsql immutable as
$$
declare l jsonb; o text[] := array[]::text[]; x text;
begin
  if jsonb_typeof(c->'roleTypes') = 'array' and jsonb_array_length(c->'roleTypes') > 0 then l := c->'roleTypes';
  elsif coalesce(c->>'roleType', '') <> '' then l := jsonb_build_array(c->>'roleType');
  else return o; end if;
  for x in select jsonb_array_elements_text(l) loop
    if x = any (array['functional','technical','basis','architect','delivery','support','keyuser','junior']) and not (x = any (o)) then o := o || x; end if;
  end loop;
  return o[1:3];
end $$;

create or replace function public._m_job_rt(j jsonb) returns text
language plpgsql immutable as
$$
declare t text := coalesce(j->>'title', '');
begin
  if (j->>'roleType') = any (array['functional','technical','basis','architect','delivery','support','keyuser','junior']) then return j->>'roleType'; end if;
  if t ~* '\y(project|programme|program|delivery|pmo|scrum master)\y.*\y(manager|lead|director|head)\y|\y(manager|director)\y.*\y(project|programme|program|delivery)\y|\ypmo\y' then return 'delivery'; end if;
  if t ~* '\yarchitect' then return 'architect'; end if;
  if t ~* '\ybasis\y|\yhana (admin|dba)|\ycloud infrastructure|\ydevops\y' then return 'basis'; end if;
  if t ~* '\y(abap|developer|technical|fiori developer|btp developer|integration developer|programmer)\y' then return 'technical'; end if;
  if t ~* '\y(support|ams|application lead|incident)\y' then return 'support'; end if;
  if t ~* '\y(key user|business expert|business analyst)\y' then return 'keyuser'; end if;
  if t ~* '\y(junior|trainee|graduate|intern)\y' then return 'junior'; end if;
  return 'functional';
end $$;

-- per role type: strict, floor, slope, swing, ready{exp,lvl,prog}, ctx{ind,spec,lang,cert,loc}
create or replace function public._m_pf(rt text) returns jsonb
language sql immutable as
$$ select case rt
  when 'technical' then '{"strict":true,"floor":0.70,"slope":0.50,"swing":0.25,"exp":0.7,"lvl":0.3,"prog":0,"ind":1,"spec":4,"lang":1,"cert":1,"loc":1}'
  when 'basis'     then '{"strict":true,"floor":0.70,"slope":0.50,"swing":0.30,"exp":0.7,"lvl":0.3,"prog":0,"ind":0,"spec":4,"lang":1,"cert":3,"loc":1}'
  when 'support'   then '{"strict":true,"floor":0.70,"slope":0.45,"swing":0.30,"exp":0.5,"lvl":0.2,"prog":0,"ind":2,"spec":2,"lang":3,"cert":1,"loc":3}'
  when 'keyuser'   then '{"strict":true,"floor":0.70,"slope":0.40,"swing":0.40,"exp":0.5,"lvl":0,"prog":0,"ind":5,"spec":4,"lang":2,"cert":1,"loc":3}'
  when 'architect' then '{"strict":false,"floor":0.70,"slope":0.60,"swing":0.35,"exp":0.25,"lvl":0.35,"prog":0.4,"ind":4,"spec":4,"lang":1,"cert":1,"loc":1}'
  when 'delivery'  then '{"strict":false,"floor":0.70,"slope":0.60,"swing":0.30,"exp":0.4,"lvl":0.15,"prog":0.45,"ind":4,"spec":4,"lang":3,"cert":0,"loc":2}'
  when 'junior'    then '{"strict":false,"floor":0.70,"slope":0,"swing":0.25,"exp":0,"lvl":1,"prog":0,"ind":1,"spec":3,"lang":2,"cert":0,"loc":3}'
  else                  '{"strict":true,"floor":0.55,"slope":0.55,"swing":0.30,"exp":0.6,"lvl":0.4,"prog":0,"ind":3,"spec":2,"lang":2,"cert":2,"loc":2}'
  end::jsonb $$;

create or replace function public._m_depth(p double precision, mn double precision, fl double precision) returns double precision
language sql immutable as
$$ select case when mn = 0 then 1 when p >= mn then 1 else fl + (1 - fl) * (p / mn) end $$;

-- ---------- skills ------------------------------------------------------------
-- one requirement row, read module by module (Functional, Technical, Basis, Support, Key User)
create or replace function public._m_fit_module(sk jsonb, r jsonb, rt text, tracked boolean, mine text[], fl double precision) returns double precision
language plpgsql stable security definer set search_path = public as
$$
declare
  pid text := r->>'productId'; mid text := r->>'moduleId'; mn double precision := public._m_num(r->'minProjects');
  d double precision := 0; t double precision := 0; v double precision; w double precision; p double precision; cr double precision;
  a double precision; b double precision; k jsonb; mods text[]; core text[] := array['s4onprem','ecc','s4public'];
begin
  if mid = 'fico' and not exists (select 1 from jsonb_array_elements(sk) e where e->>'productId' = pid and e->>'moduleId' = 'fico') then
    a := public._m_fit_module(sk, jsonb_build_object('productId', pid, 'moduleId', 'fi', 'minProjects', mn), rt, tracked, mine, fl);
    b := public._m_fit_module(sk, jsonb_build_object('productId', pid, 'moduleId', 'co', 'minProjects', mn), rt, tracked, mine, fl);
    cr := (a + b) / 2;
    if cr > 0 then return cr; end if;
  end if;
  for k in select e from jsonb_array_elements(sk) e loop
    if k->>'productId' is distinct from pid then continue; end if;
    p := case when tracked then public._m_num(k->'projects') else 1e18 end;
    if mid = '*' or k->>'moduleId' = mid then
      v := public._m_depth(p, mn, fl); if v > d then d := v; end if;
    elsif k->>'moduleId' = '*' and rt = any (array['basis','junior']) and rt = any (mine) then
      if 0.85 > d then d := 0.85; end if;
    end if;
  end loop;
  if pid = any (core) then
    mods := case when mid = '*' then null else public._m_equiv(mid) end;
    for k in select e from jsonb_array_elements(sk) e loop
      if not ((k->>'productId') = any (core)) or k->>'productId' = pid then continue; end if;
      if mods is not null and not ((k->>'moduleId') = any (mods)) then continue; end if;
      w := public._m_xfer(pid, k->>'productId');
      p := case when tracked then public._m_num(k->'projects') else 1e18 end;
      v := case when mid = '*' then w else w * public._m_depth(p * w, mn, fl) end;
      if v > t then t := v; end if;
    end loop;
  end if;
  cr := greatest(d, t);
  if d > 0 and t > 0 then cr := least(1, cr + 0.2 * least(d, t)); end if;
  return cr;
end $$;

-- one requirement row, read at product level (Architect, Delivery Manager, Junior)
create or replace function public._m_fit_product(sk jsonb, r jsonb) returns double precision
language plpgsql stable security definer set search_path = public as
$$
declare
  pid text := r->>'productId'; mid text := r->>'moduleId'; cr double precision := 0; w double precision := 0; x double precision;
  k jsonb; own boolean := false; any_mod boolean := false; same_fam boolean := false; all_star boolean := true; core text[] := array['s4onprem','ecc','s4public'];
  fr text := public._m_fam(r->>'moduleId'); fk text;
begin
  for k in select e from jsonb_array_elements(sk) e where e->>'productId' = pid loop
    own := true;
    if k->>'moduleId' = mid then any_mod := true; end if;
    fk := public._m_fam(k->>'moduleId');
    if fk is not null and fk = fr then same_fam := true; end if;
    if k->>'moduleId' <> '*' then all_star := false; end if;
  end loop;
  if own then
    if mid = '*' or any_mod then cr := 1;
    elsif same_fam then cr := 0.9;
    elsif all_star then cr := 0.85;
    else cr := 0.6; end if;
  end if;
  if pid = any (core) then
    for k in select e from jsonb_array_elements(sk) e loop
      if (k->>'productId') = any (core) and k->>'productId' <> pid then
        x := public._m_xfer(pid, k->>'productId'); if x > w then w := x; end if;
      end if;
    end loop;
    if 0.85 * w > cr then cr := 0.85 * w; end if;
  end if;
  return cr;
end $$;

-- certified in one of the role's required modules (any module when the role lists none)
create or replace function public._m_cert_in_job(c jsonb, j jsonb) returns boolean
language sql immutable as
$$ select case
     when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(j->'requires') = 'array' then j->'requires' else '[]'::jsonb end) r
                  where coalesce(r->>'productId','') <> '' and coalesce(r->>'moduleId','') <> '')
     then exists (select 1 from jsonb_array_elements(case when jsonb_typeof(j->'requires') = 'array' then j->'requires' else '[]'::jsonb end) r,
                         jsonb_array_elements(case when jsonb_typeof(c->'skills') = 'array' then c->'skills' else '[]'::jsonb end) k
                  where coalesce(r->>'productId','') <> '' and coalesce(r->>'moduleId','') <> ''
                    and k->>'productId' = r->>'productId' and (r->>'moduleId' = '*' or k->>'moduleId' = r->>'moduleId') and (k->'certified') = 'true'::jsonb)
     else exists (select 1 from jsonb_array_elements(case when jsonb_typeof(c->'skills') = 'array' then c->'skills' else '[]'::jsonb end) k where (k->'certified') = 'true'::jsonb)
   end $$;

-- may this professional see the role at all? (required certification and required languages)
create or replace function public._m_visible(c jsonb, j jsonb) returns boolean
language sql immutable as
$$ select (coalesce(j->>'certification','') <> 'required' or public._m_cert_in_job(c, j))
      and (coalesce(jsonb_array_length(case when jsonb_typeof(c->'languages') = 'array' then c->'languages' else '[]'::jsonb end), 0) = 0
           or public._m_arr(j->'languages') <@ public._m_arr(c->'languages')) $$;

-- ---------- the score (same rules as APP.matchDetail in js/core.js) ------------
create or replace function public.match_score(c jsonb, j jsonb) returns integer
language plpgsql stable security definer set search_path = public as
$$
declare
  rt text := public._m_job_rt(j); pf jsonb := public._m_pf(rt); is_strict boolean := (pf->>'strict')::boolean; fl double precision := (pf->>'floor')::double precision;
  mine text[] := public._m_rt_list(c); sk jsonb := case when jsonb_typeof(c->'skills') = 'array' then c->'skills' else '[]'::jsonb end;
  tracked boolean; rf double precision; core double precision := 1; ready double precision := 1; other double precision := 1; ctxf double precision;
  groups jsonb := '[]'::jsonb; g jsonb; r jsonb; n int; gl int; best double precision; gc double precision; hits int; cr double precision; acc double precision := 0;
  rw double precision := 0; rs double precision := 0; cw double precision := 0; cs double precision := 0;
  w double precision; f double precision; y double precision; mn double precision; u double precision; ratio double precision; known boolean; have double precision;
  ind text[]; mi text[]; asked text[]; m int; disc double precision; langs text[]; lr double precision[] := array[]::double precision[]; miss boolean; ok boolean;
  jc text; cc text; jreg text; creg text; cityj text; cityc text; x text; adj boolean; ev_tech boolean; ev_mod boolean; lv double precision; jl text; cl text; it text;
  adjmap jsonb := '{"functional":["keyuser","support","junior"],"keyuser":["functional"],"support":["functional","technical","basis"],"technical":["basis","support","architect"],"basis":["technical","support"],"architect":["delivery","functional","technical"],"delivery":["architect"],"junior":["functional","technical"]}';
  m_ text;
begin
  -- are project counts recorded for this person? (only Functional / Technical record them; nobody-set counts as yes)
  tracked := (cardinality(mine) = 0) or ('functional' = any (mine)) or ('technical' = any (mine));

  -- role type fit
  if cardinality(mine) = 0 then rf := 0.6;
  elsif rt = any (mine) then rf := 1;
  else
    adj := false;
    foreach m_ in array mine loop
      if (adjmap->m_) ? rt or (adjmap->rt) ? m_ then adj := true; end if;
    end loop;
    if not adj and ((rt = 'technical' and 'functional' = any (mine)) or (rt = 'functional' and 'technical' = any (mine))) then
      ev_tech := exists (select 1 from jsonb_array_elements(sk) k where public._m_fam(k->>'moduleId') = 'tech' or k->>'productId' = 'btp');
      ev_mod  := exists (select 1 from jsonb_array_elements(sk) k where k->>'moduleId' <> '*' and public._m_fam(k->>'moduleId') is distinct from 'tech');
      if (rt = 'technical' and ev_tech) or (rt = 'functional' and ev_mod) then adj := true; end if;
    end if;
    rf := case when adj then 0.75 else 0.5 end;
  end if;

  -- skills: rows joined by "or" form one requirement
  for r in select e from jsonb_array_elements(case when jsonb_typeof(j->'requires') = 'array' then j->'requires' else '[]'::jsonb end) e loop
    if coalesce(r->>'productId','') = '' or coalesce(r->>'moduleId','') = '' then continue; end if;
    n := jsonb_array_length(groups);
    if (r->>'orPrev') in ('true','1') and n > 0 then
      groups := jsonb_set(groups, array[(n - 1)::text], (groups->(n - 1)) || jsonb_build_array(r));
    else
      groups := groups || jsonb_build_array(jsonb_build_array(r));
    end if;
  end loop;
  n := jsonb_array_length(groups);
  if n > 0 then
    for g in select e from jsonb_array_elements(groups) e loop
      best := 0; hits := 0; gl := jsonb_array_length(g);
      for r in select e from jsonb_array_elements(g) e loop
        cr := case when is_strict then public._m_fit_module(sk, r, rt, tracked, mine, fl) else public._m_fit_product(sk, r) end;
        if cr > best then best := cr; end if;
        if cr >= 0.5 then hits := hits + 1; end if;
      end loop;
      gc := best;
      if gl >= 4 and hits < 2 then gc := least(gc, 0.9); end if;
      acc := acc + gc;
    end loop;
    core := acc / n;
  end if;

  -- experience and seniority
  w := (pf->>'exp')::double precision; mn := public._m_num(j->'minExp');
  if w > 0 and mn > 0 then
    known := (c ? 'yearsExp') and jsonb_typeof(c->'yearsExp') <> 'null' and (c->>'yearsExp') <> '';
    y := public._m_num(c->'yearsExp'); u := least(1, y / mn); ratio := y / mn;
    f := case when not known then 0.6 when y < mn then 1 - (pf->>'slope')::double precision * (1 - u)
              when ratio <= 2 then 1 else greatest(0.85, 1 - 0.05 * (ratio - 2)) end;
    rw := rw + w; rs := rs + w * f;
  end if;
  w := (pf->>'lvl')::double precision; jl := coalesce(j->>'level', '');
  if w > 0 and jl <> '' then
    cl := coalesce(c->>'level', '');
    lv := case jl when 'Junior' then case cl when 'Junior' then 1 when 'Mid' then 0.92 when 'Senior' then 0.8 end
                  when 'Mid'    then case cl when 'Junior' then 0.7 when 'Mid' then 1 when 'Senior' then 0.92 end
                  when 'Senior' then case cl when 'Junior' then 0.45 when 'Mid' then 0.8 when 'Senior' then 1 end end;
    f := coalesce(lv, 0.8);
    rw := rw + w; rs := rs + w * f;
  end if;
  w := (pf->>'prog')::double precision; mn := public._m_num(j->'minPrograms');
  if w > 0 and mn > 0 then
    have := public._m_num(c->'programs');
    f := case when have >= mn then 1 when have > 0 then 0.4 + 0.6 * have / mn else 0.4 end;
    rw := rw + w; rs := rs + w * f;
  end if;
  if rw > 0 then ready := rs / rw; end if;

  -- context: nudges, never decides
  -- industry
  w := (pf->>'ind')::double precision;
  ind := case when jsonb_typeof(j->'industries') = 'array' and jsonb_array_length(j->'industries') > 0 then public._m_arr(j->'industries')
              when coalesce(j->>'industry','') <> '' then array[j->>'industry'] else array[]::text[] end;
  if w > 0 and cardinality(ind) > 0 then
    mi := public._m_arr(c->'industries'); m := 0;
    foreach it in array ind loop if it = any (mi) then m := m + 1; end if; end loop;
    disc := greatest(0.4, least(1, 8.0 / greatest(1, cardinality(mi))));
    f := least(1, m * disc / least(cardinality(ind), 3));
    cw := cw + w; cs := cs + w * f;
  end if;
  -- specialties (a job may ask for a whole area)
  w := (pf->>'spec')::double precision; asked := public._m_arr(j->'preferredSpecialties');
  if w > 0 and cardinality(asked) > 0 then
    mi := public._m_arr(c->'specialties'); m := 0;
    foreach it in array asked loop
      if it = any (mi) or exists (select 1 from public.catalog_specs s where s.id = any (mi) and s.area_id = it) then m := m + 1; end if;
    end loop;
    disc := greatest(0.4, least(1, 12.0 / greatest(1, cardinality(mi))));
    f := least(1, m * disc / least(cardinality(asked), 3));
    cw := cw + w; cs := cs + w * f;
  end if;
  -- languages
  w := (pf->>'lang')::double precision; langs := public._m_arr(c->'languages');
  if cardinality(public._m_arr(j->'languages')) > 0 then
    lr := lr || (case when public._m_arr(j->'languages') <@ langs then 1 else 0 end)::double precision;
  end if;
  if cardinality(public._m_arr(j->'preferredLangs')) > 0 then
    lr := lr || (case when public._m_arr(j->'preferredLangs') && langs then 1 else 0 end)::double precision;
  end if;
  if w > 0 and cardinality(lr) > 0 then
    f := (select sum(z) from unnest(lr) z) / cardinality(lr);
    cw := cw + w; cs := cs + w * f;
  end if;
  -- certification
  w := (pf->>'cert')::double precision;
  if w > 0 and coalesce(j->>'certification','') <> '' then
    ok := public._m_cert_in_job(c, j);
    f := case when ok then 1 when j->>'certification' = 'required' then 0 else 0.3 end;
    cw := cw + w; cs := cs + w * f;
  end if;
  -- location
  w := (pf->>'loc')::double precision;
  if w > 0 then
    if (j->'remote') = 'true'::jsonb then
      cw := cw + w; cs := cs + w * 1;
    else
      jc := j->>'country'; cc := c->>'country';
      select parent into jreg from public.list_items where kind = 'country' and id = jc;
      if found then
        select parent into creg from public.list_items where kind = 'country' and id = cc;
        cityj := coalesce(j->>'city',''); cityc := c->>'city';
        f := case when not found then 0.4 when cityj <> '' and cityc = cityj then 1 when cc = jc then 0.9 when creg = jreg then 0.6 else 0.3 end;
        cw := cw + w; cs := cs + w * f;
      end if;
    end if;
  end if;
  if cw > 0 then other := cs / cw; end if;
  ctxf := 1 - (pf->>'swing')::double precision * (1 - other);

  return greatest(0, least(100, floor(core * rf * ready * ctxf * 100 + 0.5)))::int;
end $$;

-- ---------- queue, memory, worker -----------------------------------------------
create table if not exists public.match_queue (        -- roles waiting to be scored
  job_id text primary key references public.jobs(id) on delete cascade,
  queued_ts bigint not null default (extract(epoch from now())*1000)::bigint,
  tries int not null default 0
);
create table if not exists public.match_queue_c (      -- professionals whose skills changed
  consultant_id text primary key references public.consultants(id) on delete cascade,
  queued_ts bigint not null default (extract(epoch from now())*1000)::bigint,
  tries int not null default 0
);
create table if not exists public.match_alerts (       -- who was told about what (once), and when
  job_id text not null references public.jobs(id) on delete cascade,
  consultant_id text not null references public.consultants(id) on delete cascade,
  ts bigint not null default (extract(epoch from now())*1000)::bigint,
  score int not null, why text not null default 'job',
  primary key (job_id, consultant_id)
);
create index if not exists match_alerts_c_idx on public.match_alerts(consultant_id, ts desc);
create table if not exists public.match_c_state (      -- last time a professional got "your top roles"
  consultant_id text primary key references public.consultants(id) on delete cascade,
  last_ts bigint not null default 0
);
alter table public.match_queue   enable row level security;
alter table public.match_queue_c enable row level security;
alter table public.match_alerts  enable row level security;
alter table public.match_c_state enable row level security;
revoke all on public.match_queue, public.match_queue_c, public.match_alerts, public.match_c_state from public, anon, authenticated;

-- a role is queued when it is new, opened again, or its matching-relevant fields change
create or replace function public._match_job_changed() returns trigger
language plpgsql security definer set search_path = public as
$$
declare sig_old jsonb; sig_new jsonb;
begin
  if new.status <> 'open' then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.match_queue(job_id) values (new.id) on conflict (job_id) do nothing;
  elsif old.status is distinct from 'open' then
    insert into public.match_queue(job_id) values (new.id) on conflict (job_id) do nothing;
  else
    sig_old := jsonb_build_array(old.data->'requires', old.data->'country', old.data->'city', old.data->'remote', old.data->'languages', old.data->'certification', old.data->'roleType', old.data->'minExp', old.data->'level');
    sig_new := jsonb_build_array(new.data->'requires', new.data->'country', new.data->'city', new.data->'remote', new.data->'languages', new.data->'certification', new.data->'roleType', new.data->'minExp', new.data->'level');
    if sig_old is distinct from sig_new then
      insert into public.match_queue(job_id) values (new.id) on conflict (job_id) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists jobs_match_queue on public.jobs;
create trigger jobs_match_queue after insert or update on public.jobs for each row execute function public._match_job_changed();

-- a professional is queued when skills or role types change
create or replace function public._match_consultant_changed() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if (new.data->'skills') is distinct from (old.data->'skills') or (new.data->'roleTypes') is distinct from (old.data->'roleTypes') or (new.data->'roleType') is distinct from (old.data->'roleType') then
    insert into public.match_queue_c(consultant_id) values (new.id) on conflict (consultant_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists consultants_match_queue on public.consultants;
create trigger consultants_match_queue after update on public.consultants for each row execute function public._match_consultant_changed();

-- the worker: score what is queued, keep the best few per person, write the notifications
create or replace function public.match_alerts_run() returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  now_ms bigint := (extract(epoch from now())*1000)::bigint;
  daily_cap constant int := 5; profile_top constant int := 3; own_min constant int := 70; imported_min constant int := 80; profile_gap constant bigint := 7 * 86400000;
  n_jobs int := 0; n_cons int := 0; n_sent int := 0; rec record; who text;
begin
  if not pg_try_advisory_xact_lock(7140014) then return jsonb_build_object('skipped', true); end if;

  -- give up on anything that keeps failing; count this attempt first so a failure is remembered
  delete from public.match_queue   where tries >= 5;
  delete from public.match_queue_c where tries >= 5;
  update public.match_queue   set tries = tries + 1 where job_id in (select job_id from public.match_queue where tries = 0 order by queued_ts limit 25);
  update public.match_queue_c set tries = tries + 1 where consultant_id in (select consultant_id from public.match_queue_c where tries = 0 order by queued_ts limit 20);

  begin
    for rec in
      with
      -- (a) queued roles x every eligible professional
      a as (
        select c.id consultant_id, j.id job_id, public.match_score(c.data, j.data) score, 'job'::text why, j.posted_ts
        from public.match_queue q
        join public.jobs j on j.id = q.job_id and j.status = 'open'
        join public.consultants c on not c.sample
        join public.profiles p on p.entity_id = c.id and not p.suspended
        where q.tries > 0 and public._m_visible(c.data, j.data)
      ),
      -- (b) queued professionals x every open role (at most once a week)
      b0 as (
        select c.id consultant_id, j.id job_id, public.match_score(c.data, j.data) score, j.posted_ts, (j.id like 'x-%' or j.data->>'external' = 'true') imp
        from public.match_queue_c q
        join public.consultants c on c.id = q.consultant_id and not c.sample
        join public.profiles p on p.entity_id = c.id and not p.suspended
        join public.jobs j on j.status = 'open'
        where q.tries > 0
          and coalesce((select s.last_ts from public.match_c_state s where s.consultant_id = c.id), 0) < now_ms - profile_gap
          and jsonb_typeof(c.data->'skills') = 'array' and jsonb_array_length(c.data->'skills') > 0 and cardinality(public._m_rt_list(c.data)) > 0
          and public._m_visible(c.data, j.data)
      ),
      b as (
        select consultant_id, job_id, score, 'profile'::text why, posted_ts from (
          select b0.*, row_number() over (partition by consultant_id order by score desc, posted_ts desc) rn
          from b0 where score >= case when imp then imported_min else own_min end
        ) z where rn <= profile_top
      ),
      cand as (select * from a union all select * from b),
      -- real matches only, not already told, not already applied or invited
      good as (
        select m.*, j.company_id, coalesce(j.data->>'title', 'a role') ttl
        from cand m join public.jobs j on j.id = m.job_id
        where m.score >= case when (j.id like 'x-%' or j.data->>'external' = 'true') then imported_min else own_min end
          and not exists (select 1 from public.match_alerts x where x.job_id = m.job_id and x.consultant_id = m.consultant_id)
          and not exists (select 1 from public.applications x where x.job_id = m.job_id and x.consultant_id = m.consultant_id)
          and not exists (select 1 from public.invites x where x.job_id = m.job_id and x.consultant_id = m.consultant_id)
      ),
      uniq as (select distinct on (consultant_id, job_id) * from good order by consultant_id, job_id, score desc),
      ranked as (
        select u.*, row_number() over (partition by consultant_id order by score desc, posted_ts desc) rn,
               daily_cap - (select count(*) from public.match_alerts x where x.consultant_id = u.consultant_id and x.ts > now_ms - 86400000) room
        from uniq u
      )
      select * from ranked where rn <= room order by consultant_id, rn
    loop
      who := public._ent_label_job(rec.company_id, rec.consultant_id, rec.job_id);
      insert into public.match_alerts(job_id, consultant_id, score, why) values (rec.job_id, rec.consultant_id, rec.score, rec.why) on conflict do nothing;
      if found then
        insert into public.notifications(user_key, type, text, link)
        values (rec.consultant_id, 'job', left('New role matches your profile: ' || left(rec.ttl, 200) || ' — ' || who, 500), '#/job/' || rec.job_id);
        n_sent := n_sent + 1;
      end if;
    end loop;

    -- professionals who were looked at start their one-week pause (those already paused keep their date)
    insert into public.match_c_state(consultant_id, last_ts)
    select q.consultant_id, now_ms from public.match_queue_c q where q.tries > 0
    on conflict (consultant_id) do update set last_ts = excluded.last_ts where public.match_c_state.last_ts < now_ms - profile_gap;

    select count(*) into n_jobs from public.match_queue where tries > 0;
    select count(*) into n_cons from public.match_queue_c where tries > 0;
    delete from public.match_queue   where tries > 0;
    delete from public.match_queue_c where tries > 0;
  exception when others then
    raise warning 'match_alerts_run failed: %', sqlerrm;
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object('roles', n_jobs, 'professionals', n_cons, 'alerts', n_sent);
end $$;

revoke all on function public.match_score(jsonb, jsonb), public.match_alerts_run(), public._m_fit_module(jsonb, jsonb, text, boolean, text[], double precision),
  public._m_fit_product(jsonb, jsonb), public._m_fam(text), public._match_job_changed(), public._match_consultant_changed() from public, anon, authenticated;

-- run every 5 minutes
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'arnour-match-alerts';
    perform cron.schedule('arnour-match-alerts', '*/5 * * * *', 'select public.match_alerts_run()');
  end if;
end $cron$;

select 'ok' as release31;
