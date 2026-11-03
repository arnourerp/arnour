-- Release 43: "Must have" / "Nice to have" requirements.
--  * Nice-to-have products (requires rows with nice = true) add up to 10 points, never subtract.
--  * A must-have seniority / minimum years (job.mustLevel / job.mustExp) that is not met keeps the score at 74 or below.
-- Required languages and required certification no longer hide a role: not met -> flagged and capped (like seniority / years / specialties).
-- Same rules as APP.matchDetail in js/core.js (proved equal by tests/match_alerts_test.mjs). Existing roles score exactly as before.
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
  mi_ text[]; ask_ text[]; sp_ok boolean; id_ text;
  ngroups jsonb := '[]'::jsonb; nn int; nacc double precision := 0; nfit double precision := 0; bonus double precision := 0; capd boolean := false; lord double precision; jord double precision;
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
    if (r->>'nice') in ('true','1') then
      nn := jsonb_array_length(ngroups);
      if (r->>'orPrev') in ('true','1') and nn > 0 then
        ngroups := jsonb_set(ngroups, array[(nn - 1)::text], (ngroups->(nn - 1)) || jsonb_build_array(r));
      else
        ngroups := ngroups || jsonb_build_array(jsonb_build_array(r));
      end if;
      continue;
    end if;
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

  -- nice-to-have products: a modest bonus, never a penalty
  nn := jsonb_array_length(ngroups);
  if nn > 0 then
    for g in select e from jsonb_array_elements(ngroups) e loop
      best := 0;
      for r in select e from jsonb_array_elements(g) e loop
        cr := case when is_strict then public._m_fit_module(sk, r, rt, tracked, mine, fl) else public._m_fit_product(sk, r) end;
        if cr > best then best := cr; end if;
      end loop;
      nacc := nacc + best;
    end loop;
    nfit := nacc / nn;
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

  bonus := 10 * nfit * core * rf * ready;

  -- must-have seniority / minimum years: not met -> the score stays below Strong
  if (j->>'mustLevel') in ('true','1') and coalesce(j->>'level','') <> '' then
    jord := case j->>'level' when 'Junior' then 1 when 'Mid' then 2 when 'Senior' then 3 end;
    lord := case coalesce(c->>'level','') when 'Junior' then 1 when 'Mid' then 2 when 'Senior' then 3 end;
    if lord is null or lord < jord then capd := true; end if;
  end if;
  mn := public._m_num(j->'minExp');
  if (j->>'mustExp') in ('true','1') and mn > 0 then
    known := (c ? 'yearsExp') and jsonb_typeof(c->'yearsExp') <> 'null' and (c->>'yearsExp') <> '';
    if not known or public._m_num(c->'yearsExp') < mn then capd := true; end if;
  end if;

  -- must-have languages / certification / specialties: not met -> flagged, score stays below Strong (the role is never hidden)
  if cardinality(public._m_arr(j->'languages')) > 0 and not (public._m_arr(j->'languages') <@ public._m_arr(c->'languages')) then capd := true; end if;
  if coalesce(j->>'certification','') = 'required' and not public._m_cert_in_job(c, j) then capd := true; end if;
  if (j->>'mustSpec') in ('true','1') and cardinality(public._m_arr(j->'preferredSpecialties')) > 0 then
    mi_ := public._m_arr(c->'specialties'); sp_ok := false;
    foreach id_ in array public._m_arr(j->'preferredSpecialties') loop
      if id_ = any (mi_) or exists (select 1 from public.catalog_specs sp where sp.id = any (mi_) and sp.area_id = id_) then sp_ok := true; end if;
    end loop;
    if not sp_ok then capd := true; end if;
  end if;

  f := greatest(0, least(100, floor(core * rf * ready * ctxf * 100 + bonus + 0.5)));
  if capd then f := least(f, 74); end if;
  return f::int;
end $$;

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
    sig_old := jsonb_build_array(old.data->'requires', old.data->'country', old.data->'city', old.data->'remote', old.data->'languages', old.data->'certification', old.data->'roleType', old.data->'minExp', old.data->'level', old.data->'mustLevel', old.data->'mustExp');
    sig_new := jsonb_build_array(new.data->'requires', new.data->'country', new.data->'city', new.data->'remote', new.data->'languages', new.data->'certification', new.data->'roleType', new.data->'minExp', new.data->'level', new.data->'mustLevel', new.data->'mustExp');
    if sig_old is distinct from sig_new then
      insert into public.match_queue(job_id) values (new.id) on conflict (job_id) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists jobs_match_queue on public.jobs;
create trigger jobs_match_queue after insert or update on public.jobs for each row execute function public._match_job_changed();

revoke execute on function public.match_score(jsonb, jsonb), public._match_job_changed() from public, anon, authenticated;

create or replace function public._m_visible(c jsonb, j jsonb) returns boolean
language sql immutable as
$$ select true $$;
revoke execute on function public._m_visible(jsonb, jsonb) from public, anon, authenticated;

select 'ok' as release43;
