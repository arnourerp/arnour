-- =====================================================================
-- 038 · New email design, STEP 1 of 2 (test only)
-- Adds the new look and a "send me a test" function. The emails people
-- get today do NOT change until 039 is run.
--   select public.email_test('your sign-in email');
-- Needs 007/010 (email), 008 (catalog), 009 (lists), 014 (match alerts),
-- 030 (stored scores). Safe to run again.
-- =====================================================================

-- the dark button used everywhere
create or replace function public._email_btn(p_label text, p_url text, p_bg text default '#0F172A', p_fg text default '#FFFFFF') returns text
language sql immutable as
$$ select '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="' || p_bg || '" style="background:' || p_bg || ';border-radius:8px">' ||
     '<a href="' || p_url || '" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:700;color:' || p_fg || ';text-decoration:none;font-family:Inter,Segoe UI,Arial,sans-serif">' ||
     public._email_esc(p_label) || '</a></td></tr></table>' $$;

create or replace function public._email_logo() returns text
language sql immutable as
$$ select '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' ||
     '<td width="30" height="30" align="center" bgcolor="#38BDF8" style="width:30px;height:30px;background:#38BDF8;border-radius:8px;color:#0F172A;font-weight:700;font-size:15px">A</td>' ||
     '<td style="padding-left:10px;font-size:20px;font-weight:700;color:#FFFFFF">Arnour</td></tr></table>' $$;

-- one dark or white block with the same width and rounded corners
create or replace function public._email_card(p_inner text, p_bg text default '#FFFFFF', p_pad text default '20px', p_gap int default 12) returns text
language sql immutable as
$$ select '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ' || p_gap || 'px"><tr><td bgcolor="' || p_bg || '" style="background:' || p_bg ||
     ';border-radius:14px;padding:' || p_pad || ';' || case when p_bg = '#FFFFFF' then 'border:1px solid #E2E8F0;' else '' end || '">' || p_inner || '</td></tr></table>' $$;

-- the page around every email: hidden preview line, 600px column
create or replace function public._email_shell(p_preview text, p_body text) returns text
language sql immutable as
$$ select '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">' || public._email_esc(p_preview) || repeat('&#847;&zwnj;&nbsp;', 60) || '</div>' ||
     '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F1F5F9" style="background:#F1F5F9"><tr><td align="center" style="padding:20px 12px">' ||
     '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F172A;text-align:left"><tr><td>' ||
     p_body || '</td></tr></table></td></tr></table>' $$;

-- the same short labels the site uses on role cards
create or replace function public._email_mod_short(p_name text) returns text
language plpgsql immutable as
$$
declare n text := btrim(coalesce(p_name, '')); a text; o text;
begin
  if position(' - ' in n) > 0 and n !~ '^IS-' and n !~ '^[A-Z]{2,}-' then n := regexp_replace(n, '^.* - ', ''); end if;
  n := regexp_replace(n, '^SAP\s+', '');
  a := substring(n from '^([A-Z0-9&/+ -]{2,12}?)\s\(');
  o := btrim(coalesce(a, split_part(n, ' (', 1)));
  if o = '' then o := n; end if;
  return case when length(o) > 28 then left(o, 27) || '…' else o end;
end $$;

-- required SAP skills of a role as chip texts: "S/4 Private · SD + MM", "Any of: ..."
create or replace function public._email_skills(p_data jsonb) returns text[]
language plpgsql stable security definer set search_path = public as
$$
declare
  r jsonb; prod text; module text; nice boolean; labels text[] := '{}'; prods text[] := '{}'; mods text[] := '{}';
  grp text[] := '{}'; gp text[] := '{}'; gm text[] := '{}'; out text[] := '{}';
begin
  for r in select x from jsonb_array_elements(case when jsonb_typeof(p_data->'requires') = 'array' then p_data->'requires' else '[]'::jsonb end || '[{"end":true}]'::jsonb) x loop
    nice := coalesce(r->>'nice', '') = 'true';
    if nice or (r->>'end') is null and (coalesce(r->>'productId', '') = '' or coalesce(r->>'moduleId', '') = '') then continue; end if;
    if (r->>'end') is null then
      select coalesce(nullif(p.short, ''), p.name) into prod from public.catalog_products p where p.id = r->>'productId';
      prod := regexp_replace(regexp_replace(regexp_replace(coalesce(prod, r->>'productId'), '^S/4HANA Private Cloud.*$', 'S/4 Private'), '^S/4HANA Public Cloud.*$', 'S/4 Public'), ' / On-Prem$', '');
      if r->>'moduleId' = '*' then module := ''; else
        select m.name into module from public.catalog_modules m where m.product_id = r->>'productId' and m.id = r->>'moduleId';
        module := public._email_mod_short(coalesce(module, r->>'moduleId'));
      end if;
      if coalesce(r->>'orPrev', '') = 'true' and cardinality(gp) > 0 then gp := gp || prod; gm := gm || module; continue; end if;
    end if;
    -- close the group before this row
    if cardinality(gp) = 1 then
      if array_position(prods, gp[1]) is null then prods := prods || gp[1]; mods := mods || gm[1];
      elsif gm[1] <> '' then mods[array_position(prods, gp[1])] := concat_ws(' + ', nullif(mods[array_position(prods, gp[1])], ''), gm[1]); end if;
    elsif cardinality(gp) > 1 then
      select array_agg(concat_ws(' · ', a, nullif(b, '')) order by n) into grp from unnest(gp, gm) with ordinality u(a, b, n);
      out := out || ('Any of: ' || array_to_string(grp[1:3], ' / ') || case when cardinality(grp) > 3 then ' +' || (cardinality(grp) - 3) || ' more' else '' end);
    end if;
    if (r->>'end') is null then gp := array[prod]; gm := array[module]; end if;
  end loop;
  select coalesce(array_agg(concat_ws(' · ', a, nullif(b, '')) order by n), '{}') into labels from unnest(prods, mods) with ordinality u(a, b, n);
  return labels || out;
end $$;

-- what one role looks like in an email, for one professional. null = do not show it
create or replace function public._email_job(p_cid text, p_job text) returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  j public.jobs; d jsonb; emp text; country text; city text; loc text; remote boolean; posted timestamp; score int; skills text[];
begin
  select * into j from public.jobs where id = p_job and status = 'open';
  if j.id is null then return null; end if;
  if exists (select 1 from public.applications a where a.job_id = p_job and a.consultant_id = p_cid) then return null; end if;
  d := j.data;
  if j.id like 'x-%' or d->>'external' = 'true' then emp := btrim(coalesce(d->>'extEmployer', ''));
  else emp := public._ent_label_job(j.company_id, p_cid, j.id); end if;
  city := btrim(coalesce(d->>'city', ''));
  select l.name into country from public.list_items l where l.kind = 'country' and l.id = d->>'country';
  country := coalesce(country, upper(coalesce(d->>'country', '')));
  remote := coalesce(d->>'remote', '') = 'true';
  loc := concat_ws(', ', nullif(city, ''), nullif(country, ''));
  if remote then loc := case when city = '' then concat_ws(', ', 'Remote', nullif(country, '')) else loc || ' (remote ok)' end; end if;
  posted := to_timestamp(j.posted_ts / 1000.0) at time zone 'Asia/Dubai';
  select s.score into score from public.match_scores s where s.consultant_id = p_cid and s.job_id = p_job;
  if score is null then select a.score into score from public.match_alerts a where a.consultant_id = p_cid and a.job_id = p_job; end if;
  skills := public._email_skills(d);
  return jsonb_build_object(
    'id', j.id, 'title', coalesce(nullif(btrim(d->>'title'), ''), 'An SAP role'), 'employer', coalesce(emp, ''),
    'loc', loc, 'place', coalesce(nullif(city, ''), nullif(country, ''), ''),
    'type', concat_ws(' · ', nullif(d->>'employmentType', ''), nullif(d->>'level', '')),
    'exp', case when coalesce(d->>'minExp', '') ~ '^[0-9]+$' and d->>'minExp' <> '0' then (d->>'minExp') || '+ yrs' else '' end,
    'langs', coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(case when jsonb_typeof(d->'languages') = 'array' then d->'languages' else '[]'::jsonb end) x), ''),
    'skills', to_jsonb(skills), 'score', score,
    'posted', to_char(posted, case when extract(year from posted) = extract(year from (now() at time zone 'Asia/Dubai')) then 'FMDD Mon' else 'FMDD Mon YYYY' end),
    'is_new', j.posted_ts > (extract(epoch from now()) * 1000)::bigint - 14 * 86400000::bigint,
    'posted_ts', j.posted_ts);
end $$;

create or replace function public._email_chips(p_skills jsonb, p_bg text, p_fg text) returns text
language sql immutable as
$$ select coalesce(string_agg('<span style="display:inline-block;background:' || p_bg || ';color:' || p_fg || ';font-size:12px;font-weight:600;line-height:1.4;padding:5px 10px;border-radius:12px;margin:0 6px 6px 0">' ||
            public._email_esc(case when n = 5 and jsonb_array_length(p_skills) > 5 then '+' || (jsonb_array_length(p_skills) - 4) || ' more' else v end) || '</span>', '' order by n), '')
     from jsonb_array_elements_text(p_skills) with ordinality x(v, n) where n <= 5 $$;

-- the big dark block for the best role
create or replace function public._email_hero(p jsonb, p_url text, p_logo boolean) returns text
language plpgsql stable security definer set search_path = public as
$$
declare h text := ''; facts text := ''; f record; w int; inv boolean := p ? 'invite_by';
  show_score boolean := p->>'score' is not null and (not (p ? 'invite_by') or (p->>'score')::int >= 50);  -- an invitation never leads with a weak score
begin
  if p_logo then h := public._email_logo() || '<div style="height:20px;line-height:20px">&nbsp;</div>'; end if;
  h := h || '<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#38BDF8;margin:0 0 10px">' || case when inv then 'YOU&#39;RE INVITED' else 'YOUR TOP MATCH' end || '</div>' ||
    case when inv then
      '<div style="font-size:16px;font-weight:700;line-height:1.45;color:#FFFFFF;margin:0 0 6px">' || public._email_esc(p->>'invite_by') || ' invited you to apply</div>' ||
      '<div style="font-size:12px;color:#CBD5E1;margin:0 0 16px">Role posted ' || public._email_esc(p->>'posted') || '</div>'
    else
      '<div style="margin:0 0 14px"><span style="display:inline-block;background:#38BDF8;color:#0F172A;font-size:11px;font-weight:800;padding:4px 9px;border-radius:10px">' ||
        case when (p->>'is_new')::boolean then 'NEW ROLE' else 'NEW MATCH' end || '</span>' ||
        '<span style="font-size:12px;color:#CBD5E1;padding-left:8px">Posted ' || public._email_esc(p->>'posted') || '</span></div>'
    end ||
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' ||
    case when show_score then
      '<td width="96" valign="middle" style="width:96px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="72" height="72" align="center" valign="middle" style="width:72px;height:72px;border:5px solid #38BDF8;border-radius:50px;color:#FFFFFF">' ||
      '<div style="font-size:22px;font-weight:800;line-height:1.1">' || (p->>'score') || '%</div><div style="font-size:11px;color:#CBD5E1">match</div></td></tr></table></td>' else '' end ||
    '<td valign="middle"><a href="' || p_url || '" style="font-size:20px;font-weight:800;line-height:1.3;color:#FFFFFF;text-decoration:none">' || public._email_esc(p->>'title') || '</a>' ||
    case when p->>'employer' <> '' and not inv then '<div style="font-size:15px;font-weight:600;color:#CBD5E1;padding-top:6px">' || public._email_esc(p->>'employer') || '</div>' else '' end ||
    '</td></tr></table>';
  w := (select count(*) from (values (p->>'loc'), (p->>'type'), (p->>'exp')) v(x) where x <> '');
  for f in select * from (values (1, 'Location', p->>'loc'), (2, 'Type', p->>'type'), (3, 'Experience', p->>'exp')) v(n, k, x) where x <> '' order by n loop
    facts := facts || '<td width="' || (100 / greatest(w, 1)) || '%" valign="top" style="padding:0 3px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#1E293B" style="background:#1E293B;border-radius:10px;padding:10px">' ||
      '<div style="font-size:11px;color:#94A3B8">' || f.k || '</div><div style="font-size:13px;font-weight:700;color:#FFFFFF;line-height:1.4;padding-top:3px">' || public._email_esc(f.x) || '</div></td></tr></table></td>';
  end loop;
  if facts <> '' then h := h || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 0"><tr>' || facts || '</tr></table>'; end if;
  if p->>'langs' <> '' then h := h || '<div style="font-size:12px;color:#CBD5E1;padding-top:10px">Languages: ' || public._email_esc(p->>'langs') || '</div>'; end if;
  h := h || '<div style="padding:14px 0 8px">' || public._email_chips(p->'skills', '#1E3A5F', '#E0F2FE') || '</div>' || public._email_btn(case when inv then 'View role and apply' else 'View this role' end, p_url, '#38BDF8', '#0F172A');
  return public._email_card(h, '#0F172A', '24px');
end $$;

-- the compact line for the other roles
create or replace function public._email_row(p jsonb, p_url text) returns text
language sql stable security definer set search_path = public as
$$ select public._email_card(
     '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' ||
     case when p->>'score' is not null then '<td width="66" valign="top" style="width:66px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="54" height="54" align="center" valign="middle" bgcolor="#E0F2FE" style="width:54px;height:54px;background:#E0F2FE;border-radius:12px;color:#075985;font-size:16px;font-weight:800">' || (p->>'score') || '%</td></tr></table></td>' else '' end ||
     '<td valign="top"><a href="' || p_url || '" style="font-size:15px;font-weight:700;line-height:1.35;color:#0F172A;text-decoration:none">' || public._email_esc(p->>'title') || '</a>' ||
     '<div style="font-size:13px;line-height:1.5;color:#475569;padding-top:3px">' || public._email_esc(concat_ws(' · ', nullif(p->>'employer', ''), nullif(p->>'loc', ''), nullif(p->>'exp', ''))) || '</div>' ||
     '<div style="font-size:12px;color:#475569;padding-top:6px">' || case when (p->>'is_new')::boolean then '<span style="display:inline-block;background:#DCFCE7;color:#166534;font-size:11px;font-weight:800;padding:2px 7px;border-radius:9px;margin-right:6px">NEW</span>' else '' end ||
     'Posted ' || public._email_esc(p->>'posted') || ' &nbsp; <a href="' || p_url || '" style="color:#0369A1;font-weight:700;text-decoration:none;white-space:nowrap">View role →</a></div></td></tr></table>',
     '#FFFFFF', '16px', 10) $$;

-- the job title for the subject line: no brackets, about 28 characters, cut between words
create or replace function public._email_short_title(p_title text) returns text
language plpgsql immutable as
$$
declare t text; s text;
begin
  t := btrim(regexp_replace(regexp_replace(coalesce(p_title, ''), '\([^)]*\)?', ' ', 'g'), '\s+', ' ', 'g'));
  if length(t) <= 28 then s := t;
  elsif position(' ' in left(t, 29)) = 0 then s := left(t, 28);
  else s := regexp_replace(left(t, 29), '\s+\S*$', ''); end if;
  s := regexp_replace(s, '((\s+(with|and|for|of|in|at|or|to|the))|(\s*[-–—&/|,:+·.]))+$', '', 'i');
  return coalesce(nullif(s, ''), left(coalesce(p_title, ''), 28));
end $$;

-- one email from a person's due items: [{kind, text, link}]. null = nothing left worth sending
create or replace function public._email_render(p_user uuid, p_items jsonb, p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  site text := 'https://arnour.com/'; tag text := '?utm_source=email&amp;utm_medium=notification';
  it jsonb; ent text; jid text; info jsonb; jobs jsonb := '[]'::jsonb; seen text[] := '{}'; kinds text[] := '{}';
  rows text := ''; n_other int := 0; n_jobs int := 0; first_text text; first_link text; first_kind text;
  top jsonb; r record; body text; invites jsonb := '[]'::jsonb; n_rows int := 0; row_link text; row_kind text; subj text; preview text; footer text;
begin
  select pr.entity_id into ent from public.profiles pr where pr.user_id = p_user;
  for it in select x from jsonb_array_elements(p_items) x loop
    if not (it->>'kind' = any(kinds)) then kinds := kinds || (it->>'kind'); end if;
    jid := substring(it->>'link' from '^#/job/([A-Za-z0-9_-]+)$');
    if it->>'kind' = 'matches' and jid is not null then
      if jid = any(seen) then continue; end if;
      seen := seen || jid;
      info := public._email_job(ent, jid);
      if info is not null then jobs := jobs || jsonb_build_array(info); end if;
    else
      n_other := n_other + 1;
      if n_other = 1 then first_text := it->>'text'; first_link := coalesce(it->>'link', ''); first_kind := it->>'kind'; end if;
      -- an invitation to a role that is still open gets the role block (at most 3; the rest stay as lines)
      info := null;
      if it->>'kind' = 'invites' and it->>'text' like '%invited you to apply%' and jid is not null and jsonb_array_length(invites) < 3 and not (jid = any(seen)) then
        info := public._email_job(ent, jid);
      end if;
      if info is not null then
        seen := seen || jid;   -- the same role is not repeated as a match further down
        invites := invites || jsonb_build_array(info || jsonb_build_object('invite_by', coalesce(nullif(it->>'by', ''), nullif(info->>'employer', ''), 'A company')));
        continue;
      end if;
      n_rows := n_rows + 1;
      if n_rows = 1 then row_link := coalesce(it->>'link', ''); row_kind := it->>'kind'; end if;
      rows := rows || '<tr><td style="padding:12px 0;' || case when n_rows > 1 then 'border-top:1px solid #E2E8F0;' else '' end || 'font-size:14px;line-height:1.5;color:#0F172A">' ||
        case when it->>'kind' = 'announcements' then '<b>' || public._email_esc(split_part(it->>'text', E'\n', 1)) || '</b><br>' || public._email_esc(substr(it->>'text', length(split_part(it->>'text', E'\n', 1)) + 2))
             else public._email_esc(it->>'text') end ||
        case when coalesce(it->>'link', '') <> '' then ' <a href="' || site || tag || public._email_esc(it->>'link') || '" style="color:#0369A1;font-weight:700;text-decoration:none;white-space:nowrap">Open →</a>' else '' end || '</td></tr>';
    end if;
  end loop;
  n_jobs := jsonb_array_length(jobs);
  if n_jobs = 0 and n_other = 0 then return null; end if;

  footer := '<div style="font-size:12px;line-height:1.7;color:#475569;padding:12px 4px">You get these emails because you have an Arnour account.<br>' ||
    '<a href="' || site || '#/account" style="color:#475569">Manage email settings</a> · ' ||
    case when array_length(kinds, 1) = 1 then '<a href="' || site || '#/unsubscribe?t=' || p_token || '&amp;k=' || kinds[1] || '" style="color:#475569">Unsubscribe from these emails</a> · ' else '' end ||
    '<a href="' || site || '#/unsubscribe?t=' || p_token || '&amp;k=all" style="color:#475569">Unsubscribe from all</a></div>';

  body := '';
  -- the dark header, unless a dark block carries the logo itself
  if n_rows > 0 then body := public._email_card(public._email_logo(), '#0F172A', '18px 20px'); end if;
  for r in select x, o from jsonb_array_elements(invites) with ordinality z(x, o) order by o loop
    body := body || public._email_hero(r.x, site || tag || '#/job/' || (r.x->>'id'), n_rows = 0 and r.o = 1);
  end loop;
  if n_rows > 0 then
    body := body ||
      public._email_card('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' || rows || '</table>' ||
        '<div style="padding-top:14px">' || public._email_btn(
          case when n_rows = 1 and row_kind = 'messages' then 'Open chat' else 'Open Arnour' end,
          site || tag || case when n_rows = 1 and row_link <> '' then public._email_esc(row_link) else '' end) || '</div>', '#FFFFFF', '10px 20px 20px');
  end if;

  if n_jobs > 0 then
    n_jobs := 0;
    for r in select x from jsonb_array_elements(jobs) x order by (x->>'score')::int desc nulls last, (x->>'posted_ts')::bigint desc loop
      n_jobs := n_jobs + 1;
      if n_jobs = 1 then
        top := r.x;
        body := body || public._email_hero(top, site || tag || '#/job/' || (top->>'id'), n_other = 0);
        if jsonb_array_length(jobs) > 1 then body := body || '<div style="font-size:17px;font-weight:700;padding:6px 4px 10px">Also matching you</div>'; end if;
      elsif n_jobs <= 5 then
        body := body || public._email_row(r.x, site || tag || '#/job/' || (r.x->>'id'));
      end if;
    end loop;
    if n_jobs > 5 then body := body || '<div style="font-size:14px;color:#475569;padding:2px 4px 10px">+' || (n_jobs - 5) || ' more matching role' || case when n_jobs - 5 > 1 then 's' else '' end || '</div>'; end if;
    body := body || '<div style="padding:4px 0">' || public._email_btn('See all matching roles', site || tag || '#/c/jobs') || '</div>';
  end if;

  if n_jobs > 0 and n_other = 0 then
    subj := case when (top->>'is_new')::boolean then 'New role' else 'New match' end ||
      coalesce(', ' || (top->>'score') || '% match', '') || ': ' || public._email_short_title(top->>'title');
    preview := concat_ws(' · ', 'Posted ' || (top->>'posted'), nullif(top->>'type', ''), nullif(top->>'exp', ''),
      nullif((select string_agg(v, ', ') from jsonb_array_elements_text(top->'skills') v), ''));
  elsif n_other + n_jobs = 1 then
    subj := left(split_part(first_text, E'\n', 1), 120); preview := first_text;
    -- an invitation: the job title in the subject is shortened like the match subject
    if position(' invited you to apply for "' in first_text) > 0 then
      subj := split_part(first_text, ' invited you to apply for "', 1) || ' invited you to apply for "' ||
        public._email_short_title(regexp_replace(substr(first_text, position(' invited you to apply for "' in first_text) + length(' invited you to apply for "')), '"\s*$', '')) || '"';
      if jsonb_array_length(invites) = 1 then   -- the inbox preview shows details, not the long title again
        preview := concat_ws(' · ', 'Posted ' || (invites->0->>'posted'), nullif(invites->0->>'type', ''), nullif(invites->0->>'exp', ''),
          nullif((select string_agg(v, ', ') from jsonb_array_elements_text(invites->0->'skills') v), ''));
      end if;
    end if;
  else
    subj := 'You have ' || (n_other + n_jobs) || ' updates on Arnour'; preview := first_text;
  end if;

  return jsonb_build_object('subject', subj, 'html', public._email_shell(preview, body || footer));
end $$;

-- send yourself the new design. Goes ONLY to the address of an existing account, run from the SQL editor.
create or replace function public.email_test(p_email text) returns text
language plpgsql security definer set search_path = public, auth as
$$
declare
  inv jsonb; uid uuid; addr text; ent text; key text; tok uuid; items jsonb; e jsonb; rid bigint; n int := 0; note text := '';
begin
  select u.id, u.email into uid, addr from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if uid is null then return 'No Arnour account signs in with that email. Nothing was sent.'; end if;
  begin execute 'select decrypted_secret from vault.decrypted_secrets where name = ''resend_api_key'' limit 1' into key;
  exception when others then key := null; end;
  if key is null or key = '' then return 'The email key is not set up. Nothing was sent.'; end if;
  tok := (public._email_prefs(uid)).token;
  select pr.entity_id into ent from public.profiles pr where pr.user_id = uid and pr.role = 'consultant';

  -- your latest match alerts, or your best open roles when there are none
  select jsonb_agg(jsonb_build_object('kind', 'matches', 'text', 'New role', 'link', '#/job/' || z.job_id)) into items from (
    select a.job_id from public.match_alerts a join public.jobs j on j.id = a.job_id and j.status = 'open'
     where a.consultant_id = ent order by a.ts desc, a.score desc limit 4) z;
  if items is null then
    select jsonb_agg(jsonb_build_object('kind', 'matches', 'text', 'New role', 'link', '#/job/' || z.job_id)) into items from (
      select s.job_id from public.match_scores s join public.jobs j on j.id = s.job_id and j.status = 'open'
       where s.consultant_id = ent order by s.score desc, j.posted_ts desc limit 4) z;
  end if;
  if items is null then note := ' (no match email: this account is not a professional with matching roles)'; end if;

  -- a sample invitation, for your best open role (no company really invited you)
  select jsonb_build_array(jsonb_build_object('kind', 'invites', 'by', 'Example company',
           'text', 'Example only: A company invited you to apply for "' || coalesce(j.data->>'title', 'a role') || '"', 'link', '#/job/' || j.id)) into inv
    from public.match_scores s join public.jobs j on j.id = s.job_id and j.status = 'open'
   where s.consultant_id = ent and not exists (select 1 from public.applications a where a.job_id = j.id and a.consultant_id = ent)
   order by s.score desc, j.posted_ts desc limit 1;
  inv := coalesce(inv, '[{"kind":"invites","text":"Example only: A company invited you to apply for \"SAP FI Consultant\"","link":"#/c/applied"}]'::jsonb);

  for e in
    select public._email_render(uid, x, tok) from (values (items), (inv)) v(x)
    where x is not null
  loop
    if e is null then continue; end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid using
      'https://api.resend.com/emails',
      jsonb_build_object('from', 'Arnour <notifications@arnour.com>', 'to', jsonb_build_array(addr), 'subject', '[Test] ' || (e->>'subject'), 'html', e->>'html'),
      jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json');
    n := n + 1;
  end loop;
  return 'Sent ' || n || ' test email(s) to ' || addr || note;
end $$;

revoke all on function public._email_btn(text, text, text, text), public._email_logo(), public._email_card(text, text, text, int), public._email_shell(text, text),
  public._email_mod_short(text), public._email_skills(jsonb), public._email_job(text, text), public._email_chips(jsonb, text, text),
  public._email_hero(jsonb, text, boolean), public._email_row(jsonb, text), public._email_short_title(text), public._email_render(uuid, jsonb, uuid), public.email_test(text)
  from public, anon, authenticated;

select 'ok' as release58;
