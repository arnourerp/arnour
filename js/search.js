/* ARNOUR — one search for everything: roles, people, companies and community posts.
   Header box → live suggestions while typing; Enter → #/search?q=… with sections, tabs, highlights and filters.
   Privacy: private professionals and confidential roles are found by skills only, never by a name. */
(function () {
  const SECTIONS = { roles: 'Roles', people: 'People', companies: 'Companies', community: 'Community' };
  const ORDER = { consultant: ['roles', 'community', 'people', 'companies'], employer: ['people', 'roles', 'companies', 'community'], visitor: ['roles', 'companies', 'community'] };
  const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const words = (q) => norm(q).replace(/[^\p{L}\p{N}/.+#&-]+/gu, ' ').split(/\s+/).filter(w => w.length >= 1).slice(0, 8);
  const who = () => { const s = APP.db && APP.db.session; return s ? s.role : 'visitor'; };
  /* search text for skills: product + module names and codes; FI or CO also answer to "FICO" */
  const skillText = (list) => (list || []).map(r => APP.productShort(r.productId) + ' ' + (r.moduleId && r.moduleId !== '*' ? APP.skillName(r.productId, r.moduleId) + ' ' + r.moduleId + (r.moduleId === 'fi' || r.moduleId === 'co' ? ' fico' : '') : '') + ' ' + r.productId).join(' ');
  const skillLabels = (list) => { const seen = {}; return (list || []).map(r => (r.moduleId && r.moduleId !== '*' ? APP.skillName(r.productId, r.moduleId) + ' · ' : '') + APP.productShort(r.productId)).filter(x => !seen[x] && (seen[x] = 1)).join('  ·  '); };
  const KIND = { roles: 'Role', people: 'Person', companies: 'Company', community: 'Community' };
  APP.searchOrder = () => ORDER[who()] || ORDER.visitor;

  /* fields: [[text, weight], …]; every word must appear somewhere; title-like fields count more */
  function scoreOf(fields, ws) {
    let total = 0;
    for (const w of ws) {
      let best = 0;
      for (const f of fields) {
        const t = norm(f[0]); if (!t) continue;
        const i = t.indexOf(w); if (i === -1) continue;
        const start = i === 0 || /[^\p{L}\p{N}]/u.test(t[i - 1]);
        const v = f[1] * (start ? 1.3 : 1);
        if (v > best) best = v;
      }
      if (!best) return 0;
      total += best;
    }
    return total;
  }
  /* the words that matched, highlighted; long text becomes a snippet around the first match */
  APP.hl = function (text, ws, max) {
    let s = String(text == null ? '' : text);
    if (max && s.length > max) {
      const n = norm(s); let at = -1;
      for (const w of ws) { const i = n.indexOf(w); if (i !== -1 && (at === -1 || i < at)) at = i; }
      const from = Math.max(0, (at === -1 ? 0 : at) - Math.round(max / 3));
      s = (from > 0 ? '…' : '') + s.slice(from, from + max).trim() + (from + max < s.length ? '…' : '');
    }
    const n = norm(s), marks = new Array(s.length).fill(false);
    if (n.length === s.length) for (const w of ws) { let i = n.indexOf(w); while (i !== -1) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = n.indexOf(w, i + w.length); } }
    let out = '', open = false;
    for (let i = 0; i < s.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += APP.h(s[i]);
    }
    return out + (open ? '</mark>' : '');
  };

  APP.searchAll = function (q) {
    const ws = words(q), res = { roles: [], people: [], companies: [], community: [] };
    if (!ws.length) return res;
    const s = APP.db.session, role = who();
    const meC = s && s.role === 'consultant' ? APP.consultant(s.consultantId) : null;
    /* roles */
    Object.values(APP.db.jobs || {}).forEach(j => {
      if (j.status !== 'open') return;
      if (meC && APP.jobVisibleToConsultant && !APP.jobVisibleToConsultant(meC, j)) return;
      const co = APP.coFor(APP.company(j.companyId), j);
      const coName = j.external ? (j.extEmployer || '') : (co && !co._anon ? co.name : '');
      const sc = scoreOf([[j.title, 3], [coName, 2.5], [skillText(j.requires), 2], [(j.preferredSpecialties || []).map(APP.specialtyName).join(' '), 1.2],
        [[j.city, APP.countryName && APP.countryName(j.country), j.remote ? 'remote' : ''].join(' '), 1], [APP.jobIndustries ? APP.jobIndustries(j).join(' ') : '', 1], [j.description, 0.6]], ws);
      if (!sc) return;
      const boost = meC ? APP.matchScore(meC, j) / 50 : 0;
      res.roles.push({ kind: 'roles', id: j.id, score: sc + boost, title: j.title, sub: [coName || (co && co._anon ? 'Confidential company' : ''), APP.locText(j, j.remote ? 'Remote' : undefined)].filter(Boolean).join(' · '),
        snippet: j.description, skills: skillLabels(j.requires), href: (s && s.role === 'employer' && s.companyId === j.companyId) ? '#/e/jobs/' + j.id : '#/job/' + j.id,
        products: (j.requires || []).map(r => r.productId), country: j.country || '', match: meC ? APP.matchScore(meC, j) : null, obj: j });
    });
    /* people (signed-in only) */
    if (role !== 'visitor') Object.values(APP.db.consultants || {}).forEach(c => {
      if (!c || c.suspended || (meC && c.id === meC.id)) return;
      const see = APP.canSeePerson(c), a = see ? c : APP.cv(c, true);
      const name = see ? (c.firstName + ' ' + c.lastName).trim() : APP.anonLabel(c);
      const sc = scoreOf([[see ? c.firstName + ' ' + c.lastName : '', 3], [see ? c.headline : a._title || '', 2], [skillText(c.skills), 2],
        [(c.specialties || []).map(APP.specialtyName).join(' ') + ' ' + (c.otherSkills || []).join(' '), 1.5], [(c.industries || []).join(' '), 1], [APP.countryName ? APP.countryName(c.country) : '', 0.8]], ws);
      if (!sc) return;
      res.people.push({ kind: 'people', id: c.id, score: sc + ((APP.reputation(c.id).points || 0) / 500), title: name, anon: !see, sub: [a.headline, APP.countryName ? APP.countryName(c.country) : ''].filter(Boolean).join(' · '),
        skills: skillLabels(c.skills), href: (s && s.role === 'employer' ? '#/e/talent/' : '#/talent/') + c.id, products: (c.skills || []).map(k => k.productId), roleTypes: APP.rtList(c), country: c.country || '', obj: c });
    });
    /* companies */
    Object.values(APP.db.companies || {}).forEach(co => {
      if (!co || co._anon || co.anon || /^c[jx]:/.test(co.id) || (s && s.role === 'employer' && s.companyId === co.id && false)) return;
      const sc = scoreOf([[co.name, 3], [co.industry, 1.5], [(co.sapSystems || []).map(p => APP.productShort(p) + ' ' + p).join(' '), 1.5], [[co.city, APP.countryName && APP.countryName(co.country)].join(' '), 1], [co.about, 0.6]], ws);
      if (!sc) return;
      const open = Object.values(APP.db.jobs || {}).filter(j => j.companyId === co.id && j.status === 'open' && !j.confidential).length;
      res.companies.push({ kind: 'companies', id: co.id, score: sc, title: co.name, sub: [co.industry, APP.locText(co), open ? open + ' open role' + (open > 1 ? 's' : '') : ''].filter(Boolean).join(' · '),
        snippet: co.about, href: APP.authorHref ? APP.authorHref(co.id) : '#/company/' + co.id, industry: co.industry || '', products: co.sapSystems || [], obj: co });
    });
    /* imported (external) employers appear as companies too, so a search for their name finds their roles */
    const ext = {};
    res.roles.forEach(r => { const j = r.obj; if (j.external && j.extEmployer && scoreOf([[j.extEmployer, 3]], ws)) { const k = norm(j.extEmployer); (ext[k] = ext[k] || { name: j.extEmployer, n: 0 }).n++; } });
    Object.keys(ext).forEach(k => res.companies.push({ kind: 'companies', id: 'ext:' + k, score: scoreOf([[ext[k].name, 3]], ws), title: ext[k].name,
      sub: 'Hiring through its own career site · ' + ext[k].n + ' role' + (ext[k].n > 1 ? 's' : '') + ' on Arnour', href: '#/search?q=' + encodeURIComponent(ext[k].name) + '&t=roles', external: true, industry: '', products: [] }));
    /* community */
    const comm = (x, kind) => {
      const sc = scoreOf([[x.title, 3], [x.productId ? APP.productShort(x.productId) + ' ' + (x.moduleId ? APP.skillName(x.productId, x.moduleId) : '') : APP.topicName ? APP.topicName(x.topic) : '', 1.5],
        [x.anonymous ? '' : (APP.communityAuthorName ? APP.communityAuthorName(x.authorId) : ''), 1], [x.body, 0.8]], ws);
      if (!sc) return;
      res.community.push({ kind: 'community', id: x.id, score: sc + Math.min(1, (x.upvotes || 0) / 20), title: x.title,
        sub: (kind === 'q' ? 'Question · ' + (x.answers || []).length + ' answer' + ((x.answers || []).length === 1 ? '' : 's') : 'Article') + (x.productId ? ' · ' + APP.productShort(x.productId) : ''),
        snippet: x.body, href: '#/community/' + kind + '/' + x.id, products: x.productId ? [x.productId] : [], obj: x });
    };
    Object.values(APP.db.questions || {}).forEach(x => comm(x, 'q'));
    Object.values(APP.db.articles || {}).forEach(x => comm(x, 'a'));
    Object.keys(res).forEach(k => res[k].sort((a, b) => b.score - a.score));
    res.words = ws;
    return res;
  };

  /* ---------- results page ---------- */
  const params = () => { const o = {}; (location.hash.split('?')[1] || '').split('&').forEach(kv => { const i = kv.indexOf('='); if (i > 0) o[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); }); return o; };
  APP.searchHref = (q, t) => '#/search?q=' + encodeURIComponent(q || '') + (t && t !== 'all' ? '&t=' + t : '');
  function itemHtml(r, ws) {
    const E = APP.h;
    const right = r.kind === 'roles' && r.match != null ? '<span class="match ' + APP.matchBand(r.match).cls + '">' + r.match + '% match</span>' : '';
    const skills = r.skills && r.kind !== 'community' && r.kind !== 'companies' ? '<p class="sr-skills">' + APP.hl(r.skills, ws, 160) + '</p>' : '';
    const snip = r.snippet && r.kind !== 'people' ? '<p class="sr-snip">' + APP.hl(r.snippet, ws, 160) + '</p>' : '';
    return '<div class="card sr-item" data-card-href="' + E(r.href) + '"><div class="sr-top"><span class="pill sr-kind">' + KIND[r.kind] + '</span>' +
      '<a class="sr-title" href="' + E(r.href) + '">' + APP.hl(r.title, ws) + '</a>' + (r.anon ? ' <span class="pill muted-pill">' + APP.icon('lock', 11) + ' Private</span>' : '') + right + '</div>' +
      (r.sub ? '<p class="muted small sr-sub">' + APP.hl(r.sub, ws) + '</p>' : '') + skills + snip + '</div>';
  }
  APP.views.search = function () {
    const p = params(), q = (p.q || '').trim(), tab = SECTIONS[p.t] ? p.t : 'all';
    APP.state.navQ = q;
    const st = APP.state.searchF = APP.state.searchF && APP.state.searchF.q === q ? APP.state.searchF : { q: q, product: '', country: '', industry: '', roleType: '', show: 20 };
    document.title = (q ? '“' + q + '” — ' : '') + 'Search · Arnour';
    const order = APP.searchOrder();
    const all = APP.searchAll(q), ws = all.words || [];
    /* filters inside a tab */
    const pass = (r) => (!st.product || (r.products || []).indexOf(st.product) !== -1) && (!st.country || !r.country || r.country === st.country || r.kind === 'community' || r.kind === 'companies') &&
      (!st.industry || r.kind !== 'companies' || r.industry === st.industry) && (!st.roleType || r.kind !== 'people' || (r.roleTypes || []).indexOf(st.roleType) !== -1);
    const counts = {}; order.forEach(k => { counts[k] = all[k].filter(pass).length; });
    const total = order.reduce((n, k) => n + counts[k], 0);
    const tabs = '<div class="seg-tabs sr-tabs" role="tablist" aria-label="Search results">' +
      [['all', 'All', total]].concat(order.map(k => [k, SECTIONS[k], counts[k]])).map(x =>
        '<a role="tab" aria-selected="' + (tab === x[0]) + '" class="seg-tab' + (tab === x[0] ? ' on' : '') + '" href="' + APP.searchHref(q, x[0]) + '">' + x[1] + ' <span class="seg-n">' + x[2] + '</span></a>').join('') + '</div>';
    const opt = (pairs, v, any) => '<option value="">' + any + '</option>' + APP.opt(pairs, v);
    let filters = '';
    if (tab !== 'all') {
      const f = [];
      f.push('<select name="product" class="input sm" aria-label="Product">' + opt(CATALOG.products.map(x => [x.id, x.name]), st.product, 'Any product') + '</select>');
      if (tab === 'roles' || tab === 'people') f.push('<select name="country" class="input sm" aria-label="Country">' + opt(APP.countries.map(c => [c.id, c.name]), st.country, 'Any country') + '</select>');
      if (tab === 'people') f.push('<select name="roleType" class="input sm" aria-label="Role type">' + opt(APP.roleTypes.map(r => [r.id, r.name]), st.roleType, 'Any role type') + '</select>');
      if (tab === 'companies') f.push('<select name="industry" class="input sm" aria-label="Industry">' + opt(APP.industries.map(i => [i, i]), st.industry, 'Any industry') + '</select>');
      filters = '<form data-form="search-filters" class="filter-inline sr-filters">' + f.join('') + (st.product || st.country || st.industry || st.roleType ? '<button type="button" class="btn btn-ghost btn-sm" data-action="search-reset">Clear filters</button>' : '') + '</form>';
    }
    let body;
    if (!q) body = '<div class="card empty">Type a role, a name, a company, a product or a module — for example “S/4HANA FICO”, “SuccessFactors” or “Aramco”.</div>';
    else if (!total) body = '<div class="card empty">Nothing matches “' + APP.h(q) + '”' + (tab !== 'all' && (st.product || st.country || st.industry || st.roleType) ? ' with these filters' : '') + '. Try fewer words, or a product or module name.</div>';
    else if (tab === 'all') body = order.filter(k => counts[k]).map(k => '<section class="sr-sec"><div class="sr-sec-h"><h2>' + SECTIONS[k] + ' <span class="muted">' + counts[k] + '</span></h2>' +
      (counts[k] > 4 ? '<a class="link" href="' + APP.searchHref(q, k) + '">See all ' + counts[k] + ' →</a>' : '') + '</div>' + all[k].filter(pass).slice(0, 4).map(r => itemHtml(r, ws)).join('') + '</section>').join('');
    else {
      const list = all[tab].filter(pass);
      body = list.slice(0, st.show).map(r => itemHtml(r, ws)).join('') + (list.length > st.show ? '<div class="btn-row center"><button type="button" class="btn btn-outline" data-action="search-more">Show more</button></div>' : '');
    }
    const priv = who() === 'visitor' ? '<p class="muted small mt8">Sign in to search SAP professionals too.</p>' : '<p class="muted small mt8">' + APP.icon('lock', 12) + ' Private profiles and confidential roles are found by their skills, never by a name.</p>';
    return '<div class="narrow sr-page">' + APP.crumbHtml(APP.db.session ? (APP.db.session.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard') : '#/', 'Home') +
      '<form data-form="search-page" class="sr-box"><input name="q" class="input" value="' + APP.h(q) + '" placeholder="Search roles, people, companies, products, modules…" aria-label="Search"><button class="btn btn-primary" type="submit">' + APP.icon('search', 15) + ' Search</button></form>' +
      tabs + filters + body + priv + '</div>';
  };

  /* ---------- live suggestions under the header box ---------- */
  let sugT = null, sugIdx = -1;
  function closeSug() { const b = document.getElementById('sr-sug'); if (b) b.remove(); sugIdx = -1; }
  function showSug(input) {
    const q = input.value.trim(); APP.state.navQ = input.value;
    if (q.length < 2) { closeSug(); return; }
    const all = APP.searchAll(q), ws = all.words || [], picks = [];
    APP.searchOrder().forEach(k => all[k].slice(0, 3).forEach(r => picks.push(r)));
    const top = picks.slice(0, 6);
    let box = document.getElementById('sr-sug');
    const form = input.closest('form'); if (!form) return;
    if (!box) { box = document.createElement('div'); box.id = 'sr-sug'; box.className = 'sr-sug'; box.setAttribute('role', 'listbox'); form.appendChild(box); }
    box.innerHTML = (top.length ? top.map((r, i) => '<a class="sr-sug-item" role="option" data-i="' + i + '" href="' + APP.h(r.href) + '"><span class="sr-sug-kind">' + KIND[r.kind] + '</span><span class="sr-sug-t">' + APP.hl(r.title, ws) + '</span><small class="muted">' + APP.hl(r.sub || '', ws) + '</small></a>').join('')
      : '<div class="sr-sug-none muted small">No quick matches — press Enter to search everything</div>') +
      '<a class="sr-sug-all" href="' + APP.searchHref(q) + '">' + APP.icon('search', 13) + ' See all results for “' + APP.h(q) + '”</a>';
    sugIdx = -1;
  }
  document.addEventListener('input', function (e) {
    const t = e.target; if (!t || t.name !== 'q' || !t.closest || !t.closest('form[data-form=nav-search]')) return;
    clearTimeout(sugT); sugT = setTimeout(function () { showSug(t); }, 120);
  });
  document.addEventListener('keydown', function (e) {
    const box = document.getElementById('sr-sug'); if (!box) return;
    const items = box.querySelectorAll('a'); if (!items.length) return;
    if (e.key === 'Escape') { closeSug(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((a, i) => a.classList.toggle('on', i === sugIdx));
    } else if (e.key === 'Enter' && sugIdx >= 0 && items[sugIdx]) { e.preventDefault(); const h = items[sugIdx].getAttribute('href'); closeSug(); APP.go(h); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#sr-sug a')) { const h = e.target.closest('a').getAttribute('href'); e.preventDefault(); closeSug(); APP.go(h); return; }
    if (!(e.target.closest && e.target.closest('form[data-form=nav-search]'))) closeSug();
  });
  window.addEventListener('hashchange', closeSug);
})();
