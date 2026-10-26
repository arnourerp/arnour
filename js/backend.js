/* ============================================================================
   ARNOUR — live backend (Supabase)
   Active only when js/config.js provides a project URL and key. Without it the
   site keeps running as the local demo.

   How it works: the pages keep reading and writing the in-memory database
   (APP.db). This file fills APP.db from Supabase after sign-in, and after every
   APP.save() it works out what changed and sends exactly that to the server
   through functions that check who is asking. The server decides what each
   person may see (anonymous profiles, confidential companies).
   ============================================================================ */
(function () {
  'use strict';
  var CFG = window.ARNOUR_CONFIG || {};
  APP.LIVE = !!(CFG.url && CFG.key && window.supabase && window.supabase.createClient);
  if (!APP.LIVE) return;

  var B = APP.backend = { sb: null, user: null, profile: null, snap: null, outbox: [], running: false, ready: false, notice: '', pollN: 0 };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i;
  var POLL_MS = 15000;

  /* ------------------------------ helpers ------------------------------ */
  function clean(o) { var c = JSON.parse(JSON.stringify(o)); delete c._anon; delete c.sample; delete c.mine; delete c.certRevoked; return c; }
  function jobSig(j) {
    var c = JSON.parse(JSON.stringify(j));
    ['applicants', 'appliedTs', 'applyNotes', 'invited', 'postedTs', 'sample', 'mine', 'appStage', 'appViewed', 'hiredId'].forEach(function (k) { delete c[k]; });
    return JSON.stringify(c);
  }
  function unwrap(res, fn) {
    if (res.error) throw res.error;
    return (res.data || []).map(function (r) {
      return (r && typeof r === 'object' && !Array.isArray(r) && Object.keys(r).length === 1 && fn in r) ? r[fn] : r;
    });
  }
  function rpc(fn, args) {
    return B.sb.rpc(fn, args || {}).then(function (r) { if (r.error) { if (/account suspended/i.test(r.error.message || '')) B.onSuspended(); if (B.onRpcError) { try { B.onRpcError(fn, r.error); } catch (e) { /* ignore */ } } throw r.error; } return r.data; });
  }
  B.rpc = rpc;
  /* an account suspended while the page is open: reload so the notice shows */
  B.onSuspended = function () { if (B._susp) return; B._susp = true; try { location.hash = '#/suspended'; } catch (e) { /* ignore */ } setTimeout(function () { location.reload(); }, 50); };
  function isTransient(e) {
    if (!e) return true;
    if (e.code && /^PGRST30[0-9]$/.test(e.code)) return true; /* expired login — refreshed on retry */
    if (typeof e.status === 'number' && e.status >= 500) return true;
    if (e.status === 0 || e.name === 'TypeError') return true;
    if (!e.code && /fetch|network|timeout|load failed/i.test(String(e.message))) return true;
    return false;
  }
  function friendly(e) {
    var m = String((e && e.message) || e || '');
    if (/daily limit/i.test(m)) return 'You can start up to 10 new conversations a day. Try again tomorrow.';
    if (/wait for a reply/i.test(m)) return 'You can send 2 messages until they reply.';
    if (/edit window over/i.test(m)) return 'Messages can be edited for 15 minutes after sending.';
    if (/conversation closed|not available/i.test(m)) return 'This conversation is closed.';
    if (/introduction required/i.test(m)) return 'This person or company is private — send an introduction request first.';
    if (/role not open/i.test(m)) return 'That role is no longer open.';
    if (/not allowed|not your/i.test(m)) return 'That action is not allowed for your account.';
    return 'Your last change could not be saved, so it was undone. Please try again.';
  }
  function authError(e) {
    var m = String((e && e.message) || '');
    if (/captcha/i.test(m)) return 'The security check did not pass. Please try again.';
    if (/invalid login/i.test(m)) return 'Email or password is incorrect.';
    if (/not confirmed/i.test(m)) return 'NOT_CONFIRMED';
    if (/rate limit|too many|seconds/i.test(m)) return 'Too many attempts — please wait a minute and try again.';
    if (/password/i.test(m) && /(short|least|weak|characters)/i.test(m)) return 'Choose a longer password — at least 8 characters.';
    if (/valid email|invalid.*email/i.test(m)) return 'Please enter a valid email address.';
    if (/network|fetch/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
    return m || 'Something went wrong. Please try again.';
  }
  B.emptyDb = function () {
    var db = { v: 10, session: null, consultants: {}, companies: {}, jobs: {}, conversations: {}, notifications: {}, intros: {}, questions: {}, articles: {} };
    return db;
  };

  /* ------------------------------ loading ------------------------------ */
  B.fetchPublic = function () {
    return Promise.all([B.sb.rpc('list_jobs'), B.sb.rpc('list_companies'), B.fetchCommunity(), B.fetchCatalog(), B.fetchLists(), B.fetchBanner()]).then(function (r) {
      /* the announcement banner for whoever is signed in (null for visitors and when there is none) */
      var nb = r[5] || null;
      if ((nb ? nb.id : 0) !== (APP.banner ? APP.banner.id : 0)) { APP.banner = nb; if (APP.render && APP.db && APP.db.session !== undefined) { setTimeout(function () { try { APP.render(); } catch (e) { /* ignore */ } }, 0); } }
      if (r[4] && r[4].v !== APP.LISTS_V && APP.applyLists) { try { APP.applyLists(r[4]); } catch (e) { /* keep what we have */ } }
      /* the catalog (products, modules, specialties) is kept in the database; the built-in copy is the fallback */
      if (r[3] && r[3].v !== APP.CATALOG_V && APP.applyCatalog) { try { APP.applyCatalog(r[3]); } catch (e) { /* keep what we have */ } }
      return { jobs: unwrap(r[0], 'list_jobs'), companies: unwrap(r[1], 'list_companies'), community: r[2] };
    });
  };
  B.fetchCatalog = function () {
    return B.sb.rpc('get_catalog').then(function (r) {
      var d = r && r.data;
      if (r.error || !d || typeof d !== 'object' || !Array.isArray(d.products)) return null;
      return d;
    }, function () { return null; });
  };
  B.fetchBanner = function () {
    if (!B.user) return Promise.resolve(null);
    return B.sb.rpc('my_banner').then(function (r) {
      var d = r && r.data;
      return r.error || !d || typeof d !== 'object' || !d.id ? null : d;
    }, function () { return null; });
  };
  B.fetchLists = function () {
    return B.sb.rpc('get_lists').then(function (r) {
      var d = r && r.data;
      if (r.error || !d || typeof d !== 'object' || !Array.isArray(d.countries)) return null;
      return d;
    }, function () { return null; });
  };
  /* community posts: a failure here must never stop the rest of the site from loading */
  B.fetchCommunity = function () {
    return B.sb.rpc('list_community').then(function (r) {
      var d = r && r.data;
      if (r.error || !d || typeof d !== 'object') return null;
      return d;
    }, function () { return null; });
  };
  B.applyCommunity = function (db, c) {
    if (!c) return;
    db.questions = {}; db.articles = {};
    (c.questions || []).forEach(function (q) { db.questions[q.id] = q; });
    (c.articles || []).forEach(function (a) { db.articles[a.id] = a; });
    /* authors who are no longer listed (for example sample content switched off) leave too, unless the directory still has them */
    var was = B._authors || {}, dir = B._dirIds || null;
    B._authors = {}; (c.authors || []).forEach(function (a) { B._authors[a.id] = 1; if (!db.consultants[a.id] || was[a.id]) db.consultants[a.id] = a; });
    Object.keys(was).forEach(function (id) { if (!B._authors[id] && !(dir && dir[id]) && !(B.profile && B.profile.entity_id === id)) delete db.consultants[id]; });
  };
  B.fetchPrivate = function (noDir) {
    return Promise.all([
      noDir ? Promise.resolve({ data: null }) : B.sb.rpc('list_consultants'),
      B.sb.from('applications').select('*'),
      B.sb.from('invites').select('*'),
      B.sb.rpc('my_intros'),
      B.sb.rpc('my_conversations'),
      B.sb.from('messages').select('*').order('ts', { ascending: false }).limit(5000), /* newest first, so a long history never hides new messages */
      B.sb.from('notifications').select('*').order('ts', { ascending: false }).limit(200),
      /* company only (the rules return nothing to others); a missing table must not stop the rest loading */
      B.profile && B.profile.role === 'employer' ? B.sb.from('app_review').select('*').then(function (x) { return x.error ? { data: [] } : x; }, function () { return { data: [] }; }) : Promise.resolve({ data: [] }),
      B.profile && B.profile.role === 'employer' ? B.sb.from('jobs').select('id,hired_id').then(function (x) { return x.error ? { data: [] } : x; }, function () { return { data: [] }; }) : Promise.resolve({ data: [] })
    ]).then(function (r) {
      r.slice(0, 7).forEach(function (x) { if (x.error) throw x.error; });
      return { consultants: r[0].data === null ? null : unwrap(r[0], 'list_consultants'), apps: r[1].data || [], invs: r[2].data || [], intros: r[3].data || [], convs: r[4].data || [], msgs: (r[5].data || []).slice().reverse(), nots: r[6].data || [], reviews: r[7].data || [], hired: r[8].data || [] };
    });
  };

  B.applyPrivate = function (db, p) {
    var ent = B.profile.entity_id, role = B.profile.role, side = role === 'consultant' ? 'c' : 'e';
    Object.values(db.jobs).forEach(function (j) { j.applicants = []; j.appliedTs = {}; j.applyNotes = {}; j.invited = []; j.appStage = {}; j.appViewed = {}; });
    p.apps.forEach(function (a) {
      var j = db.jobs[a.job_id]; if (!j) return;
      j.applicants.push(a.consultant_id); j.appliedTs[a.consultant_id] = +a.ts; j.applyNotes[a.consultant_id] = a.note || '';
      if (a.viewed_ts) j.appViewed[a.consultant_id] = +a.viewed_ts;
      if (a.shortlisted_ts) j.appStage[a.consultant_id] = 'shortlisted';
    });
    (p.reviews || []).forEach(function (rv) { var j = db.jobs[rv.job_id]; if (j && !j.appStage[rv.consultant_id]) j.appStage[rv.consultant_id] = 'declined'; });
    (p.hired || []).forEach(function (h) { var j = db.jobs[h.id]; if (j) j.hiredId = h.hired_id || ''; });
    p.invs.forEach(function (i) { var j = db.jobs[i.job_id]; if (j) j.invited.push(i.consultant_id); });
    db.intros = {};
    p.intros.forEach(function (i) {
      db.intros[i.id] = { id: i.id, from: i.from_side, cid: i.cid, eid: i.eid, jobId: i.job_id || '', note: i.note || '', status: i.status, ts: +i.ts, respTs: i.resp_ts ? +i.resp_ts : undefined };
    });
    db.conversations = {};
    p.convs.forEach(function (c) {
      db.conversations[c.id] = { id: c.id, cId: c.c_id, eId: c.e_id || null, c2Id: c.c2_id || null, jobId: c.job_id || '', messages: [], unread: { c: 0, e: 0 }, lastTs: +c.last_ts, botReplyUsed: true,
        revC: !!c.rev_c, revE: !!c.rev_e, mine: !!c.mine, blockedByMe: !!c.blocked_by_me, blockedMe: !!c.blocked_me, _r: { c: +c.c_read, e: +c.e_read } };
    });
    p.msgs.forEach(function (m) {
      var cv = db.conversations[m.conv_id]; if (!cv) return;
      var o = { id: m.id, side: m.side, text: m.text, ts: +m.ts, cv: m.cv ? m.cv : false };
      if (m.deleted) o.deleted = true; if (m.edited_ts) o.editedTs = +m.edited_ts;
      if (m.call) o.call = m.call;
      cv.messages.push(o);
      if (m.side === 'c' && +m.ts > cv._r.e) cv.unread.e++;
      if (m.side === 'e' && +m.ts > cv._r.c) cv.unread.c++;
    });
    Object.values(db.conversations).forEach(function (cv) { delete cv._r; });
    db.notifications = {};
    db.notifications[ent] = p.nots.map(function (n) { return { id: n.id, type: n.type, text: n.text, ts: +n.ts, read: !!n.read, link: n.link || null }; });
  };

  B.hydrate = function (session) {
    B.user = session ? session.user : null; B.profile = null; B.suspended = null; B.isAdmin = false; B.emailPrefs = null; B._epLoading = false;
    var db = B.emptyDb(), pub, priv = null;
    var first = B.user ? B.sb.from('profiles').select('*').maybeSingle() : Promise.resolve(null);
    return first.then(function (r0) {
      if (r0 && r0.error) throw r0.error;
      var prof = r0 ? r0.data : null;
      if (prof && prof.suspended) { /* suspended: nothing else is loaded, the person sees the notice */
        B.suspended = { reason: prof.suspended_reason || '' };
        APP.db = db; B.snap = B.makeSnap(); B.ready = true;
        return 'suspended';
      }
      return Promise.all([B.fetchPublic(), B.user ? rpc('am_i_admin').catch(function () { return false; }) : false]).then(function (xs) {
        pub = xs[0]; B.isAdmin = xs[1] === true;
        if (!B.user) return null;
        /* the admin is not a user of the marketplace: any profile this account once had is ignored (and hidden from everyone else on the server) */
        B.profile = (B.isAdmin ? null : prof) || null;
        return B.profile ? B.fetchPrivate() : null;
      }).then(function (p) {
        priv = p;
        return hydrateRest();
      });
    });
    function hydrateRest() {
      pub.companies.forEach(function (c) { db.companies[c.id] = c; });
      B.applyCommunity(db, pub.community);
      pub.jobs.forEach(function (j) { delete j.mine; j.applicants = []; j.appliedTs = {}; j.applyNotes = {}; j.invited = []; db.jobs[j.id] = j; });
      if (priv) {
        priv.consultants.forEach(function (c) { db.consultants[c.id] = c; });
        var ent = B.profile.entity_id;
        if (B.profile.role === 'consultant' && db.consultants[ent]) db.session = { role: 'consultant', consultantId: ent };
        else if (B.profile.role === 'employer' && db.companies[ent]) db.session = { role: 'employer', companyId: ent };
        else B.profile = null;
        if (B.profile) { B.applyPrivate(db, priv); B._lastPrivate = priv; }
      }
      if (APP.migrateSpecialties) { try { APP.migrateSpecialties(db); } catch (e) { /* ignore */ } }
      APP.db = db;
      B.snap = B.makeSnap();
      B.ready = true;
    }
  };

  /* what the server already has — compared against APP.db after every save */
  B.makeSnap = function () {
    var s = { profile: null, jobs: {}, invited: {}, applied: {}, intros: {}, convs: {}, notifs: {} };
    var db = APP.db, ses = db.session;
    if (!ses || !B.profile) return s;
    var ent = B.profile.entity_id, role = ses.role, side = role === 'consultant' ? 'c' : 'e';
    var me = role === 'consultant' ? db.consultants[ent] : db.companies[ent];
    s.profile = JSON.stringify(clean(me));
    Object.values(db.jobs).forEach(function (j) {
      if (role === 'employer' && j.companyId === ent) { s.jobs[j.id] = jobSig(j); s.invited[j.id] = (j.invited || []).slice(); }
      if (role === 'consultant' && (j.applicants || []).indexOf(ent) !== -1) s.applied[j.id] = 1;
    });
    Object.values(APP.intros()).forEach(function (i) { s.intros[i.id] = i.status; });
    Object.values(db.conversations).forEach(function (cv) {
      var calls = {};
      cv.messages.forEach(function (m) { if (m.id && m.call) calls[m.id] = m.call.status; });
      s.convs[cv.id] = { n: cv.messages.length, unread: cv.unread[APP.convSide(cv)] || 0, calls: calls };
    });
    (db.notifications[ent] || []).forEach(function (n) { s.notifs[n.id] = n.read; });
    return s;
  };

  /* ------------------------------ saving ------------------------------ */
  B.diff = function () {
    var ops = [], db = APP.db, ses = db.session;
    if (!ses || !B.profile || !B.snap) return ops;
    var S = B.snap, ent = B.profile.entity_id, role = ses.role, side = role === 'consultant' ? 'c' : 'e';

    var me = role === 'consultant' ? db.consultants[ent] : db.companies[ent];
    if (me) {
      var psig = JSON.stringify(clean(me));
      if (psig !== S.profile) {
        var oldCv = null; try { oldCv = role === 'consultant' && S.profile ? (JSON.parse(S.profile).cv || {}).path : null; } catch (e) { oldCv = null; }
        ops.push({ run: function () { return rpc('save_profile', { p_data: JSON.parse(psig) }); }, done: function () { S.profile = psig; },
          after: function () { B.dropOldCv(oldCv, (JSON.parse(psig).cv || {}).path); } });
      }
    }

    if (role === 'employer') {
      var mine = {};
      Object.values(db.jobs).forEach(function (j) {
        if (j.companyId !== ent) return;
        mine[j.id] = 1;
        var sg = jobSig(j);
        if (S.jobs[j.id] !== sg) ops.push({ run: function () { return rpc('save_job', { p_id: j.id, p_data: JSON.parse(sg) }); }, done: function () { S.jobs[j.id] = sg; if (!S.invited[j.id]) S.invited[j.id] = []; } });
        (j.invited || []).forEach(function (cid) {
          if ((S.invited[j.id] || []).indexOf(cid) === -1 || !S.jobs[j.id]) {
            ops.push({ run: function () { return rpc('invite_to_job', { p_job: j.id, p_cid: cid }); }, done: function () { (S.invited[j.id] = S.invited[j.id] || []).push(cid); } });
          }
        });
      });
      Object.keys(S.jobs).forEach(function (id) {
        if (!mine[id]) ops.push({ run: function () { return rpc('delete_job', { p_id: id }); }, done: function () { delete S.jobs[id]; delete S.invited[id]; } });
      });
    } else {
      Object.values(db.jobs).forEach(function (j) {
        var has = (j.applicants || []).indexOf(ent) !== -1, was = !!S.applied[j.id];
        if (has && !was) ops.push({ run: function () { return rpc('apply_to_job', { p_job: j.id, p_note: (j.applyNotes || {})[ent] || '' }); }, done: function () { S.applied[j.id] = 1; }, fail: function () { j.applicants = j.applicants.filter(function (x) { return x !== ent; }); } });
        if (!has && was) ops.push({ run: function () { return rpc('withdraw_application', { p_job: j.id }); }, done: function () { delete S.applied[j.id]; } });
      });
    }

    Object.values(APP.intros()).forEach(function (i) {
      var was = S.intros[i.id];
      if (was === undefined) {
        var mineSide = (i.from === 'e' && role === 'employer' && i.eid === ent) || (i.from === 'c' && role === 'consultant' && i.cid === ent);
        if (!mineSide) { S.intros[i.id] = i.status; return; }
        ops.push({
          run: function () {
            return rpc('create_intro', { p_from: i.from, p_cid: i.cid, p_eid: i.eid, p_job: i.jobId || null, p_note: i.note || '', p_id: i.id }).then(function (id) {
              if (id && id !== i.id) { delete APP.intros()[i.id]; i.id = id; APP.intros()[id] = i; }
            });
          },
          done: function () { S.intros[i.id] = 'pending'; },
          fail: function () { delete APP.intros()[i.id]; }
        });
      } else if (was !== i.status && i.status !== 'pending') {
        ops.push({ run: function () { return rpc('respond_intro', { p_id: i.id, p_accept: i.status === 'accepted' }); }, done: function () { S.intros[i.id] = i.status; } });
      }
    });

    Object.values(db.conversations).forEach(function (cv) {
      if (!(cv.cId === ent || cv.eId === ent || cv.c2Id === ent)) return;
      var side = APP.convSide(cv);
      if (!S.convs[cv.id]) {
        if (!cv.messages.length) return; /* a conversation is created on the server with its first message */
        ops.push({
          run: function () {
            var start = cv.c2Id ? rpc('start_peer_conversation', { p_other: cv.c2Id === ent ? cv.cId : cv.c2Id, p_id: cv.id })
              : rpc('start_conversation', { p_cid: cv.cId, p_eid: cv.eId, p_job: cv.jobId || null, p_id: cv.id });
            return start.then(function (sid) {
              if (sid && sid !== cv.id) { delete db.conversations[cv.id]; cv.id = sid; db.conversations[sid] = cv; }
            });
          },
          done: function () { S.convs[cv.id] = { n: 0, unread: cv.unread[side] || 0, calls: {} }; },
          fail: function () { delete db.conversations[cv.id]; }
        });
      }
      var st = S.convs[cv.id] || { n: 0, unread: 0, calls: {} };
      for (var idx = st.n; idx < cv.messages.length; idx++) {
        (function (idx) {
          var m = cv.messages[idx];
          if (m.side !== side) { ops.push({ run: function () { return Promise.resolve(); }, done: function () { if (S.convs[cv.id]) S.convs[cv.id].n = idx + 1; } }); return; }
          ops.push({
            run: function () { return rpc('send_message', { p_conv: cv.id, p_text: m.text || '', p_cv: m.cv ? m.cv : null, p_call: m.call || null }); },
            done: function () { if (S.convs[cv.id]) S.convs[cv.id].n = idx + 1; }
          });
        })(idx);
      }
      cv.messages.forEach(function (m) {
        if (m.id && UUID.test(m.id) && m.call && st.calls[m.id] === 'proposed' && (m.call.status === 'accepted' || m.call.status === 'declined')) {
          ops.push({ run: function () { return rpc('answer_call', { p_msg: m.id, p_status: m.call.status }); }, done: function () { if (S.convs[cv.id]) S.convs[cv.id].calls[m.id] = m.call.status; } });
        }
      });
      if ((cv.unread[side] || 0) === 0 && st.unread > 0 && S.convs[cv.id]) {
        ops.push({ run: function () { return rpc('mark_read', { p_conv: cv.id }); }, done: function () { if (S.convs[cv.id]) S.convs[cv.id].unread = 0; } });
      }
    });

    var list = db.notifications[ent] || [], ids = {}, toRead = [];
    list.forEach(function (n) { ids[n.id] = 1; if (UUID.test(n.id) && S.notifs[n.id] === false && n.read) toRead.push(n.id); });
    if (toRead.length) ops.push({ run: function () { return B.sb.from('notifications').update({ read: true }).in('id', toRead).then(function (r) { if (r.error) throw r.error; }); }, done: function () { toRead.forEach(function (id) { S.notifs[id] = true; }); } });
    var gone = Object.keys(S.notifs).filter(function (id) { return !ids[id]; });
    if (gone.length) ops.push({ run: function () { return B.sb.from('notifications').delete().in('id', gone).then(function (r) { if (r.error) throw r.error; }); }, done: function () { gone.forEach(function (id) { delete S.notifs[id]; }); } });

    B.outbox.slice().forEach(function (n) {
      ops.push({ run: function () { return rpc('send_notification', { p_key: n.key, p_type: n.type, p_text: n.text, p_link: n.link || '' }); }, done: function () { var k = B.outbox.indexOf(n); if (k >= 0) B.outbox.splice(k, 1); } });
    });
    return ops;
  };

  B.schedule = function () { clearTimeout(B._t); B._t = setTimeout(B.flush, 350); };
  /* small "Saving… / Saved" note while changes go to the server */
  B.saveState = function (st) {
    var el = document.getElementById('save-ind');
    if (!el) { el = document.createElement('div'); el.id = 'save-ind'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    clearTimeout(B._siT); clearTimeout(B._siShow);
    if (st === 'saving') { B._siShow = setTimeout(function () { el.textContent = 'Saving…'; el.className = 'show'; }, 250); }
    else if (st === 'saved') { if (el.className === 'show') { el.textContent = 'Saved ✓'; B._siT = setTimeout(function () { el.className = ''; }, 1400); } }
    else el.className = '';
  };
  B.flush = function () {
    if (B.running) { B._again = true; return Promise.resolve(); }
    if (!B.profile) return Promise.resolve();
    B.running = true; B._again = false;
    B._flushFailed = false;
    if (B.diff().length) B.saveState('saving');
    var loop = function () {
      var ops = B.diff();
      if (!ops.length) return Promise.resolve();
      var i = 0, failed = false;
      var next = function () {
        if (i >= ops.length) return Promise.resolve();
        var op = ops[i++];
        return op.run().then(function () { if (op.done) op.done(); if (op.after) { try { op.after(); } catch (x) { /* ignore */ } } return next(); }, function (e) {
          if (isTransient(e)) { var err = new Error('transient'); err.transient = true; throw err; }
          if (op.done) op.done();
          if (op.fail) op.fail();
          APP.toast(friendly(e)); failed = true; B._flushFailed = true;
          B._realign = true;
          return null; /* stop this batch; the next diff starts clean */
        });
      };
      return next().then(function () { return loop(); });
    };
    return loop().then(function () { B._retry = 0; B.saveState(B._flushFailed ? 'off' : 'saved'); }, function (e) {
      B.saveState('off');
      if (e && e.transient) {
        B._retry = Math.min((B._retry || 0) + 1, 6);
        B.sb.auth.refreshSession().catch(function () {});
        clearTimeout(B._rt); B._rt = setTimeout(B.flush, Math.min(30000, 2000 * Math.pow(2, B._retry)));
        if (!B._offlineShown) { B._offlineShown = true; APP.toast('Connection problem — your changes will be saved when it is back.'); }
      }
    }).then(function () {
      B.running = false;
      if (B._retry === 0 || B._retry === undefined) B._offlineShown = false;
      if (B._realign) { B._realign = false; B.refresh(); }
      else if (B._again) B.flush();
    });
  };
  B.pending = function () { return B.running || (B.profile && B.diff().length > 0) || B.outbox.length > 0; };
  window.addEventListener('beforeunload', function (e) { if (B.pending()) { e.preventDefault(); e.returnValue = ''; } });

  /* notifications to other people go through the server; our own are created by the server */
  APP.addNotif = function (key, type, text, link) {
    if (!key || !B.profile) return;
    if (key === B.profile.entity_id) return;
    B.outbox.push({ key: key, type: type, text: text, link: link || '' });
    B.schedule();
  };
  APP.save = function () { B.schedule(); };
  APP.load = function () { /* nothing stored on this device in live mode */ };

  /* "revealed" is decided by accepted introductions only (the server uses the same rule) */
  APP.revealed = function (cid, eid) {
    if (!cid || !eid) return false;
    return Object.values(APP.intros()).some(function (i) { return i.cid === cid && i.eid === eid && i.status === 'accepted'; });
  };

  /* ------------------------------ refreshing ------------------------------ */
  B.refresh = function () {
    return B.sb.auth.getSession().then(function (r) { return B.hydrate(r.data.session); }).then(function () { APP.render(); }).catch(function () { /* next poll retries */ });
  };

  B.viewSig = function () {
    var db = APP.db, ent = B.profile && B.profile.entity_id;
    return JSON.stringify([
      Object.values(db.conversations).map(function (c) { return [c.id, c.messages.length, c.unread.c, c.unread.e, c.eId]; }),
      Object.values(APP.intros()).map(function (i) { return [i.id, i.status, i.eid]; }),
      (db.notifications[ent] || []).map(function (n) { return [n.id, n.read]; }),
      Object.values(db.jobs).map(function (j) { return [j.id, (j.applicants || []).length, (j.invited || []).length, j.companyId]; })
    ]);
  };

  /* Background refresh, light by default:
     - every 15 s: one tiny check (my_pulse). Messages, introductions, applications and notifications are reloaded only when it changes.
     - every 2 min (or when the tab comes back after a while): roles, companies, community and the professionals directory.
     - every 5 min: a full private reload as a safety net.
     Anything the server no longer returns (deleted, closed to me, expired) is removed here too. */
  var PUB_EVERY = 8, SAFE_EVERY = 20;
  B.applyPublic = function (db, pub) {
    var me = B.profile.entity_id;
    var jobIds = {}, coIds = {};
    pub.companies.forEach(function (c) { coIds[c.id] = 1; if (c.id !== me) db.companies[c.id] = c; });
    Object.keys(db.companies).forEach(function (id) { if (id !== me && !coIds[id]) delete db.companies[id]; });
    if (!B.commBusy && pub.community) B.applyCommunity(db, pub.community);
    pub.jobs.forEach(function (j) {
      jobIds[j.id] = 1;
      var old = db.jobs[j.id];
      if (old && old.companyId === me) return;
      delete j.mine; j.applicants = []; j.appliedTs = {}; j.applyNotes = {}; j.invited = [];
      db.jobs[j.id] = j;
    });
    Object.keys(db.jobs).forEach(function (id) { if (!jobIds[id]) delete db.jobs[id]; });
  };
  B.applyDirectory = function (db, list) {
    var me = B.profile.entity_id, ids = {};
    list.forEach(function (c) { ids[c.id] = 1; if (c.id !== me) db.consultants[c.id] = c; });
    B._dirIds = ids;
    Object.keys(db.consultants).forEach(function (id) { if (id !== me && !ids[id] && !(B._authors && B._authors[id])) delete db.consultants[id]; });
  };
  /* load roles, companies and community right now (used when a link points to a role this tab has not loaded yet) */
  B.refreshPublicNow = function () {
    if (!B.sb) return Promise.resolve();
    return B.fetchPublic().then(function (pub) {
      if (!B.profile) { /* signed out (or an admin without a profile): what came back is the whole picture */
        var jIds = {}, cIds = {};
        pub.jobs.forEach(function (j) { jIds[j.id] = 1; delete j.mine; j.applicants = []; j.appliedTs = {}; j.applyNotes = {}; j.invited = []; APP.db.jobs[j.id] = j; });
        pub.companies.forEach(function (c) { cIds[c.id] = 1; APP.db.companies[c.id] = c; });
        Object.keys(APP.db.jobs).forEach(function (id) { if (!jIds[id]) delete APP.db.jobs[id]; });
        Object.keys(APP.db.companies).forEach(function (id) { if (!cIds[id]) delete APP.db.companies[id]; });
        if (pub.community && !B.commBusy) B.applyCommunity(APP.db, pub.community);
        return;
      }
      if (B.pending()) return;
      B.applyPublic(APP.db, pub);
      if (B._lastPrivate) B.applyPrivate(APP.db, B._lastPrivate);
      B.snap = B.makeSnap();
    }, function () { /* offline: the page says not found */ });
  };
  B.poll = function (force) {
    if (B.suspended || !B.profile || document.hidden || B.running || B.polling || B.pending()) return;
    B.polling = true; B.pollN++;
    var pub = force || B.pollN % PUB_EVERY === 0, safe = B.pollN % SAFE_EVERY === 0;
    var before = B.viewSig();
    var pulse = B.noPulse ? Promise.resolve(null) : B.sb.rpc('my_pulse').then(function (r) {
      if (r.error) { if (/my_pulse|PGRST202|does not exist|not find/i.test((r.error.code || '') + ' ' + (r.error.message || ''))) B.noPulse = true; return null; }
      return r.data;
    }, function () { return null; });
    pulse.then(function (sig) {
      var changed = B.noPulse || sig === null || sig !== B._pulse;
      if (!changed && !pub && !safe) return null;
      return Promise.all([B.fetchPrivate(), pub ? B.fetchPublic() : null]).then(function (r) {
        if (B.pending()) return; /* the user did something meanwhile — keep their changes, try again next time */
        var db = APP.db;
        if (r[1]) B.applyPublic(db, r[1]);
        if (r[0]) {
          if (r[0].consultants) B.applyDirectory(db, r[0].consultants);
          B.applyPrivate(db, r[0]);
        } else if (r[1]) {
          /* roles were rebuilt: put applications and invitations back from the last private load */
          if (B._lastPrivate) B.applyPrivate(db, B._lastPrivate);
        }
        if (r[0]) B._lastPrivate = r[0];
        if (sig !== null) B._pulse = sig;
        B.snap = B.makeSnap();
        if (B.viewSig() !== before || r[1]) B.softRefresh();
      });
    }).catch(function (e) { if (e && /account suspended/i.test(e.message || '')) B.onSuspended(); /* otherwise offline: next poll */ }).then(function () { B.polling = false; });
  };
  B.softRefresh = function () {
    var h = location.hash, active = document.activeElement;
    var m = h.match(/^#\/[ce]\/messages\/(.+)$/);
    if (m && APP.conv(m[1])) {
      var isC = APP.db.session.role === 'consultant';
      var sc = document.querySelector('.chat-scroll');
      if (sc && APP.chatMessagesHtml) {
        var near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
        sc.innerHTML = APP.chatMessagesHtml(APP.conv(m[1]), isC);
        if (near) sc.scrollTop = sc.scrollHeight;
      }
      if (APP.inboxRefresh) APP.inboxRefresh();
      APP.openConversation(m[1]);
    } else if (/^#\/[ce]\/messages$/.test(h) && APP.inboxRefresh) {
      APP.inboxRefresh();
    } else if (!(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) && !document.querySelector('.dlg-back, .dialog, .modal')) {
      if (/^#\/(c|e)\//.test(h) || h === '#/' || h === '') APP.render();
    }
    var nav = document.querySelector('header.nav');
    if (nav && !document.querySelector('.menu.open, .notif-panel.open') && APP.db.session) {
      var t = document.createElement('div'); t.innerHTML = APP.navbar();
      var fresh = t.querySelector('header.nav'); if (fresh) nav.replaceWith(fresh);
    }
  };
  B.startPolling = function () {
    setInterval(function () { B.poll(); }, POLL_MS);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { B._hiddenAt = Date.now(); return; }
      B.poll(B._hiddenAt && Date.now() - B._hiddenAt > 120000);
    });
  };

  /* ------------------------------ auth ------------------------------ */
  B.cleanUrl = function () {
    try { history.replaceState(null, '', location.pathname + (location.hash || '#/')); } catch (e) { /* ignore */ }
  };
  B.boot = function () {
    B.sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } });
    var q = new URLSearchParams(location.search), step = Promise.resolve();
    var hashQ = new URLSearchParams((location.hash.split('?')[1]) || '');
    var errDesc = q.get('error_description') || hashQ.get('error_description');
    var pendingOAuth = null; try { pendingOAuth = localStorage.getItem('arnour-oauth-pending'); } catch (e) { /* ignore */ }
    if (errDesc && pendingOAuth) { try { localStorage.removeItem('arnour-oauth-pending'); } catch (e) { /* ignore */ } B.notice = 'Sign-in with ' + (OAUTH_NAMES[pendingOAuth] || 'that account') + ' was cancelled or did not finish. You can try again, or use your email.'; try { history.replaceState(null, '', location.pathname + '#/login'); } catch (e) { /* ignore */ } }
    else if (errDesc) { B.notice = /expired|invalid/i.test(errDesc) ? 'That link has expired or was already used. Please sign in, or request a new one.' : errDesc; B.cleanUrl(); }
    if (q.get('token_hash') && q.get('type')) {
      var type = q.get('type');
      step = B.sb.auth.verifyOtp({ token_hash: q.get('token_hash'), type: type }).then(function (r) {
        if (r.error) { B.notice = 'That link has expired or was already used. Please sign in, or request a new one.'; }
        else if (type === 'recovery') { B.recovery = true; location.hash = '#/reset'; }
        else { B.justConfirmed = true; }
        B.cleanUrl();
      });
    } else if (q.get('code')) {
      var viaOAuth = null; try { viaOAuth = localStorage.getItem('arnour-oauth-pending'); localStorage.removeItem('arnour-oauth-pending'); } catch (e) { /* ignore */ }
      var oauthFail = 'Sign-in with ' + (OAUTH_NAMES[viaOAuth] || 'that account') + ' did not finish. Please try again, or use your email.';
      step = B.sb.auth.exchangeCodeForSession(q.get('code')).then(function (r) {
        if (r.error) { if (viaOAuth) { B.notice = oauthFail; B.cleanUrl(); try { history.replaceState(null, '', location.pathname + '#/login'); } catch (e) { /* ignore */ } return; } else { B.justConfirmedElsewhere = true; B.notice = 'Your email is confirmed. Please sign in to continue.'; } }
        else { B.justConfirmed = true; }
        B.cleanUrl();
      }, function () { B.notice = viaOAuth ? oauthFail : 'Your email is confirmed. Please sign in to continue.'; B.cleanUrl(); });
    }
    B.sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'SIGNED_OUT' && B.profile) { /* signed out elsewhere or session expired */ B.user = null; B.profile = null; APP.db = B.emptyDb(); B.snap = B.makeSnap(); location.hash = '#/login'; APP.render(); }
    });
    return step.then(function () { return B.sb.auth.getSession(); }).then(function (r) { return B.hydrate(r.data.session); });
  };

  B.afterSignedIn = function () {
    var back = APP.state.afterAuth || ''; APP.state.afterAuth = '';
    /* only return to a page this person's role can open */
    if (B.profile && ((/^#\/c\//.test(back) && B.profile.role !== 'consultant') || (/^#\/e\//.test(back) && B.profile.role !== 'employer'))) back = '';
    if (/^#\/(login|register|forgot|reset|check-email|onboard)/.test(back)) back = '';
    if (/^#\/admin/.test(back) && !B.isAdmin) back = '';
    if (!B.profile && !B.suspended) { var dr = B.restoreWizardDraft(); if (dr) { APP.toast('Welcome back — your answers are still here'); APP.go(dr === 'employer' ? '#/onboard-e' : '#/onboard'); return; } }
    if (B.suspended) APP.go('#/suspended');
    else if (B.profile) { B.clearWizardDraft(); APP.go(back || (B.profile.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard')); }
    else if (B.isAdmin) APP.go(/^#\/admin/.test(back) ? back : '#/admin');
    else APP.go(B.metaRole() === 'e' ? '#/onboard-e' : '#/onboard');
  };
  B.metaRole = function () {
    var r = B.user && B.user.user_metadata && B.user.user_metadata.role;
    if (!r) { try { r = localStorage.getItem('arnour-oauth-role'); } catch (e) { r = null; } }
    return r === 'employer' || r === 'e' ? 'e' : 'c';
  };
  B.hasRole = function () {
    if (B.user && B.user.user_metadata && B.user.user_metadata.role) return true;
    try { return !!localStorage.getItem('arnour-oauth-role'); } catch (e) { return false; }
  };
  /* ---------- Continue with Google / LinkedIn (shown only for providers switched on in config.js) ---------- */
  var OAUTH_NAMES = { google: 'Google', linkedin_oidc: 'LinkedIn' };
  B.oauthList = function () { return (CFG.oauth || []).filter(function (p) { return OAUTH_NAMES[p]; }); };
  B.oauthHtml = function (role) {
    var list = B.oauthList(); if (!list.length) return '';
    return '<div class="oauth-btns">' + list.map(function (p) {
      return '<button type="button" class="btn btn-outline btn-block oauth-btn oauth-' + p.replace('_oidc', '') + '" data-action="live-oauth" data-provider="' + p + '"' + (role ? ' data-role="' + role + '"' : '') + '>Continue with ' + OAUTH_NAMES[p] + '</button>';
    }).join('') + (role ? '<p class="muted small center">By continuing with ' + list.map(function (p) { return OAUTH_NAMES[p]; }).join(' or ') + ' you agree to the <a href="#/terms" target="_blank" rel="noopener">Terms</a> and the <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>' : '') +
      '<div class="oauth-or"><span>or use your email</span></div></div>';
  };
  B.startOAuth = function (provider, role) {
    try { if (role) localStorage.setItem('arnour-oauth-role', role); localStorage.setItem('arnour-oauth-pending', provider); } catch (e) { /* ignore */ }
    B.sb.auth.signInWithOAuth({ provider: provider, options: { redirectTo: location.origin + location.pathname.replace(/index\.html$/, '') } }).then(function (r) {
      if (r && r.error) APP.toast('Could not open ' + OAUTH_NAMES[provider] + '. Please try again or use your email.');
    }, function () { APP.toast('Could not open ' + OAUTH_NAMES[provider] + '. Please try again or use your email.'); });
  };
  /* names from Google / LinkedIn prefill the profile steps (never the photo) */
  B.oauthNames = function () {
    var m = (B.user && B.user.user_metadata) || {};
    var first = m.given_name || m.first_name || '', last = m.family_name || m.last_name || '';
    if (!first && !last && (m.full_name || m.name)) { var parts = String(m.full_name || m.name).trim().split(/\s+/); first = parts.shift() || ''; last = parts.join(' '); }
    return { first: String(first).slice(0, 60), last: String(last).slice(0, 60) };
  };

  /* ---------- bot check (Cloudflare Turnstile) ----------
     Shown only on the real site (arnour.com). Supabase verifies the token when CAPTCHA protection is switched on there;
     until then the token is simply ignored, so turning it on later needs no code change. */
  var TS_HOSTS = /(^|\.)arnour\.com$/i;
  B.tsToken = null; B.tsWidgets = [];
  B.captchaOn = function () { return !!(CFG.turnstileSiteKey && (TS_HOSTS.test(location.hostname) || window.ARNOUR_FORCE_CAPTCHA)); };
  function tsBox() { return B.captchaOn() ? '<div class="ts-box" data-ts></div>' : ''; }
  function loadTs() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (B._tsP) return B._tsP;
    B._tsP = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true;
      sc.onload = function () { if (window.turnstile) res(window.turnstile); else rej(new Error('no turnstile')); };
      sc.onerror = function () { B._tsP = null; rej(new Error('turnstile blocked')); };
      document.head.appendChild(sc);
    });
    return B._tsP;
  }
  B.mountCaptcha = function () {
    if (!B.captchaOn()) return;
    var boxes = [].slice.call(document.querySelectorAll('[data-ts]:not([data-ts-on])'));
    if (!boxes.length) return;
    boxes.forEach(function (el) { el.setAttribute('data-ts-on', '1'); });
    B.tsToken = null;
    loadTs().then(function (ts) {
      B.tsFailed = false;
      boxes.forEach(function (el) {
        if (!document.body.contains(el)) return;
        try {
          B.tsWidgets.push(ts.render(el, { sitekey: CFG.turnstileSiteKey, action: 'auth',
            callback: function (t) { B.tsToken = t; var er = document.getElementById('live-err'); if (er && /security check/i.test(er.textContent)) er.textContent = ''; },
            'expired-callback': function () { B.tsToken = null; }, 'error-callback': function () { B.tsToken = null; } }));
        } catch (e) { /* ignore */ }
      });
    }, function () { B.tsFailed = true; });
  };
  B.captchaToken = function () { return B.captchaOn() ? (B.tsToken || undefined) : undefined; };
  B.captchaReset = function () {
    B.tsToken = null;
    if (window.turnstile) B.tsWidgets = B.tsWidgets.filter(function (id) { try { window.turnstile.reset(id); return true; } catch (e) { return false; } });
  };
  /* returns an error message when the check is needed but not done yet */
  B.captchaMissing = function () {
    if (!B.captchaOn() || B.tsToken) return '';
    return B.tsFailed ? 'The security check could not load. Please turn off any ad blocker or try another browser.' : 'Please wait a moment for the security check to finish, then try again.';
  };
  if (window.MutationObserver) new MutationObserver(function () { if (document.querySelector('[data-ts]:not([data-ts-on])')) B.mountCaptcha(); }).observe(document.documentElement, { childList: true, subtree: true });

  B.signIn = function (email, password) {
    return B.sb.auth.signInWithPassword({ email: email, password: password, options: { captchaToken: B.captchaToken() } }).then(function (r) {
      B.captchaReset();
      if (r.error) throw r.error;
      return B.hydrate(r.data.session);
    });
  };
  B.signUp = function (email, password, role) {
    return B.sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: location.origin + '/', data: { role: role === 'e' ? 'employer' : 'consultant' }, captchaToken: B.captchaToken() } }).then(function (r) {
      B.captchaReset();
      if (r.error) throw r.error;
      return r.data;
    });
  };
  B.signOut = function () {
    return B.sb.auth.signOut().catch(function () {}).then(function () { return B.hydrate(null); });
  };
  APP.logout = function () {
    var go = function () { location.hash = '#/'; APP.render(); };
    (B.pending() ? B.flush() : Promise.resolve()).catch(function () {}).then(function () { return B.signOut(); }).then(go, go);
  };
  APP.login = function () { /* demo accounts do not exist in live mode */ };

  /* CV files live in a private storage bucket; only the owner and people they send it to can open it */
  B.uploadCv = function (file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['pdf', 'doc', 'docx'].indexOf(ext) === -1) { APP.toast('Please upload a PDF, DOC or DOCX file'); return Promise.resolve(null); }
    if (file.size > 5 * 1024 * 1024) { APP.toast('That file is larger than 5 MB'); return Promise.resolve(null); }
    var path = B.user.id + '/' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.' + ext;
    APP.toast('Uploading your CV…');
    /* some systems give Word files no type at all; storage only accepts PDF and Word types, so name it from the extension */
    var TYPE = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    return B.sb.storage.from('cvs').upload(path, file, { contentType: TYPE[ext] || file.type || undefined, upsert: false }).then(function (r) {
      if (r.error) { APP.toast('Could not upload the CV. Please try again.'); return null; }
      return { name: file.name, size: APP.fmtSize(file.size), path: path };
    }, function () { APP.toast('Could not upload the CV. Please try again.'); return null; });
  };
  /* a replaced CV file is deleted, unless it was sent in a message (companies may still open it from the chat) */
  B.dropOldCv = function (oldPath, newPath) {
    if (!oldPath || oldPath === newPath || !B.user || oldPath.indexOf(B.user.id + '/') !== 0) return;
    var used = Object.values(APP.db.conversations || {}).some(function (cv) { return (cv.messages || []).some(function (m) { return m.cv && m.cv.path === oldPath; }); });
    if (used) return;
    B.sb.storage.from('cvs').remove([oldPath]).then(null, function () { /* best effort */ });
  };
  B.downloadCv = function (path, name) {
    B.sb.storage.from('cvs').createSignedUrl(path, 120, { download: name || true }).then(function (r) {
      if (r.error || !r.data) { APP.toast('Could not open the file. It may have been removed.'); return; }
      var a = document.createElement('a'); a.href = r.data.signedUrl; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    }, function () { APP.toast('Could not download the file — check your connection and try again.'); });
  };

  /* wizards end here: the server creates the profile and gives it its id */
  /* Google / LinkedIn names fill the first step (only when the person has not typed anything yet) */
  var origCDef = APP.wizCDefaults, origEDef = APP.wizEDefaults;
  if (origCDef) APP.wizCDefaults = function () { var d = origCDef.apply(this, arguments), n = B.user ? B.oauthNames() : null; if (n) { if (!d.firstName) d.firstName = n.first; if (!d.lastName) d.lastName = n.last; } return d; };
  if (origEDef) APP.wizEDefaults = function () { var d = origEDef.apply(this, arguments), n = B.user ? B.oauthNames() : null; if (n && !d.contactName && (n.first || n.last)) d.contactName = (n.first + ' ' + n.last).trim(); return d; };

  /* the sign-in can be lost between the email link and the last step (another tab, an in-app mail browser, a phone
     that cleared its storage). Before saving, make sure it is still there; if not, keep the answers and ask to sign in. */
  var WIZ_KEY = 'arnour-wizard-draft';
  B.ensureSession = function () {
    return B.sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (s && s.access_token) return s;
      return B.sb.auth.refreshSession().then(function (r2) { return (r2 && r2.data && r2.data.session) || null; }, function () { return null; });
    }, function () { return null; });
  };
  function noSession(e) {
    var m = String((e && (e.message || e.code)) || '');
    return (e && (e.status === 401 || e.code === '42501' || e.code === 'PGRST301')) || /permission denied|not signed in|JWT|401/i.test(m);
  }
  B.saveWizardDraft = function (role) {
    try {
      var w = role === 'employer' ? APP.wizE : APP.wizC;
      if (w && B.user) localStorage.setItem(WIZ_KEY, JSON.stringify({ uid: B.user.id, email: B.user.email, role: role, wiz: w, ts: Date.now() }));
    } catch (e) { /* storage blocked: nothing to keep */ }
  };
  B.restoreWizardDraft = function () {
    try {
      var d = JSON.parse(localStorage.getItem(WIZ_KEY) || 'null');
      if (!d || !B.user || B.profile || Date.now() - d.ts > 7 * 864e5) return null;
      if (d.uid !== B.user.id && String(d.email || '').toLowerCase() !== String(B.user.email || '').toLowerCase()) return null;
      if (d.role === 'employer') APP.wizE = d.wiz; else APP.wizC = d.wiz;
      return d.role;
    } catch (e) { return null; }
  };
  B.clearWizardDraft = function () { try { localStorage.removeItem(WIZ_KEY); } catch (e) { /* ignore */ } };
  B.sessionLost = function (role) {
    B.saveWizardDraft(role);
    APP.state.afterAuth = role === 'employer' ? '#/onboard-e' : '#/onboard';
    B.notice = 'Please sign in again to save your profile. Your answers are kept.';
    var email = B.user && B.user.email;
    B.sb.auth.signOut({ scope: 'local' }).then(null, function () { /* ignore */ }).then(function () {
      B.user = null; B.profile = null; APP.state.liveEmail = email || APP.state.liveEmail;
      APP.go('#/login');
    });
  };

  B.finishWizard = function (role, obj) {
    var btn = document.querySelector('form button[type="submit"]'); if (btn) { btn.disabled = true; btn.textContent = 'Creating your profile…'; }
    var fail = function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Finish'; }
      if (noSession(e)) { B.sessionLost(role); return; }
      APP.toast(isTransient(e) ? 'Could not reach the server — please try again.' : 'Could not create your profile. Please try again.');
    };
    B.saveWizardDraft(role);
    return B.ensureSession().then(function (s) {
      if (!s) throw { status: 401, message: 'not signed in' };
      return rpc('claim_profile', { p_role: role, p_data: clean(obj) });
    }).then(function () {
      B.clearWizardDraft();
      return B.sb.auth.getSession();
    }).then(function (r) { return B.hydrate(r.data.session); }).then(function () {
      APP.wizC = null; APP.wizE = null;
      var back = APP.state.afterAuth || ''; APP.state.afterAuth = '';
      APP.go(back || (role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard'));
      APP.toast(role === 'consultant' ? 'Welcome to Arnour 🎉' : 'Company profile created 🎉');
    }).catch(fail);
  };

  /* route protection for signed-in-but-unfinished, signed-out and recovery states */
  B.guard = function (route) {
    var v = route.view;
    if (B.recovery) return v === 'reset' ? null : '#/reset';
    if (B.suspended) return (v === 'suspended' || v === 'terms' || v === 'privacy') ? null : '#/suspended';
    if (v === 'suspended') return '#/';
    /* admin pages: decided by APP.canAccessRoute (one central gate) */
    if (B.user && !B.profile) {
      if (B.isAdmin && v === 'landing' && !/^#\/home/.test(location.hash)) return '#/admin';
      var ok = ['wiz-c', 'wiz-e', 'account', 'terms', 'privacy', 'reset', 'unsubscribe', 'start'].concat(B.isAdmin ? ['admin', 'landing', 'jobs', 'job-detail', 'community', 'community-q', 'community-a', 'talent-public', 'company-public'] : []);
      if (ok.indexOf(v) === -1) return B.isAdmin ? '#/admin' : (B.metaRole() === 'e' ? '#/onboard-e' : '#/onboard'); /* an admin never has to create a profile */
      if (v === 'wiz-c' && B.metaRole() === 'e') return '#/onboard-e';
      if (v === 'wiz-e' && B.metaRole() === 'c') return '#/onboard';
      return null;
    }
    if (!B.user && (v === 'wiz-c' || v === 'wiz-e')) return v === 'wiz-e' ? '#/register/e' : '#/register/c';
    if (!B.user && v === 'start') return '#/login';
    if (B.profile && ['login', 'register', 'wiz-c', 'wiz-e', 'forgot', 'check-email', 'start'].indexOf(v) !== -1) return B.profile.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard';
    if (!B.user && v === 'account') return '#/login';
    return null;
  };

  /* ------------------------------ views ------------------------------ */
  var esc = function (s) { return APP.h(s == null ? '' : s); };
  function card(inner) { return '<div class="auth-wrap"><div class="card auth-card">' + '<a class="brand-logo lg" href="#/" aria-label="Arnour home" style="text-decoration:none">A</a>' + inner + '</div></div>'; }
  function noticeHtml() {
    var n = B.notice; B.notice = '';
    return n ? '<p class="live-note">' + esc(n) + '</p>' : '';
  }
  function pwHint() { return '<span class="muted small">At least 8 characters.</span>'; }

  APP.views.login = function () {
    document.title = 'Sign in — Arnour';
    var email = (APP.state.liveEmail || '');
    var nc = APP.state.liveNotConfirmed ? '<p class="live-note warn">Please confirm your email first — we sent you a link. <button type="button" class="link-btn" data-action="live-resend">Send it again</button></p>' : '';
    return card('<h1>Sign in to Arnour</h1>' + noticeHtml() + nc + B.oauthHtml(null) +
      '<form data-form="live-login" novalidate>' +
      '<label class="field"><span class="label">Email</span><input class="input" type="email" name="email" autocomplete="email" value="' + esc(email) + '" required></label>' +
      '<label class="field"><span class="label">Password</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>' +
      tsBox() + '<p class="field-error" id="live-err" role="alert"></p>' +
      '<button class="btn btn-primary btn-block" type="submit">Sign in</button></form>' +
      '<p class="center small"><a href="#/forgot">Forgot your password?</a></p>' +
      '<div class="or"><span>New to Arnour?</span></div>' +
      '<a class="btn btn-outline btn-block" href="#/register">Create an account</a>');
  };

  APP.views.register = function (ctx) {
    document.title = 'Join Arnour';
    var role = ctx && ctx.p && ctx.p[0] === 'e' ? 'e' : 'c';
    var finishing = B.user && !B.profile;
    return card('<h1>Join Arnour</h1>' +
      '<div class="seg-tabs live-roles" role="tablist">' +
      '<a role="tab" aria-selected="' + (role === 'c') + '" class="seg-tab' + (role === 'c' ? ' on' : '') + '" href="#/register/c">I\'m an SAP professional</a>' +
      '<a role="tab" aria-selected="' + (role === 'e') + '" class="seg-tab' + (role === 'e' ? ' on' : '') + '" href="#/register/e">I\'m hiring</a></div>' +
      '<p class="muted small center">' + (role === 'c' ? 'Build your SAP profile and get roles ranked by fit.' : 'Create your company profile and post precise SAP roles.') + '</p>' +
      B.oauthHtml(role) +
      '<form data-form="live-register" data-role="' + role + '" novalidate>' +
      '<label class="field"><span class="label">Work or personal email</span><input class="input" type="email" name="email" autocomplete="email" required></label>' +
      '<label class="field"><span class="label">Password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required>' + pwHint() + '</label>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;opacity:0">' +
      '<label class="chk-line"><input type="checkbox" name="terms" required> <span>I agree to the <a href="#/terms" target="_blank" rel="noopener">Terms</a> and the <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>' +
      tsBox() + '<p class="field-error" id="live-err" role="alert"></p>' +
      '<button class="btn btn-primary btn-block" type="submit">Create account</button></form>' +
      '<p class="center small">Already have an account? <a href="#/login">Sign in</a></p>');
  };

  APP.views.start = function () {
    document.title = 'Welcome to Arnour';
    var nm = B.oauthNames();
    return card('<h1>Welcome' + (nm.first ? ', ' + esc(nm.first) : '') + '</h1><p class="muted center">How will you use Arnour?</p>' +
      '<button type="button" class="btn btn-primary btn-block" data-action="live-pick-role" data-role="c">I\'m an SAP professional</button>' +
      '<button type="button" class="btn btn-outline btn-block" data-action="live-pick-role" data-role="e">I\'m hiring for a company</button>');
  };

  APP.views['check-email'] = function () {
    document.title = 'Check your email — Arnour';
    var email = APP.state.liveEmail || 'your email';
    return card('<h1>Check your email</h1>' +
      '<p class="center">We sent a confirmation link to <strong>' + esc(email) + '</strong>.</p>' +
      '<p class="muted small center">Open it on any device to confirm, then come back and sign in. It can take a minute — check your spam folder too.</p>' +
      tsBox() + '<button class="btn btn-outline btn-block" data-action="live-resend">Send the email again</button>' +
      '<a class="btn btn-ghost btn-block" href="#/login">Back to sign in</a>');
  };

  APP.views.forgot = function () {
    document.title = 'Reset password — Arnour';
    return card('<h1>Reset your password</h1>' +
      '<p class="muted small center">Enter your email and we will send you a link to choose a new password.</p>' +
      '<form data-form="live-forgot" novalidate>' +
      '<label class="field"><span class="label">Email</span><input class="input" type="email" name="email" autocomplete="email" value="' + esc(APP.state.liveEmail || '') + '" required></label>' +
      tsBox() + '<p class="field-error" id="live-err" role="alert"></p>' +
      '<button class="btn btn-primary btn-block" type="submit">Send reset link</button></form>' +
      '<p class="center small"><a href="#/login">Back to sign in</a></p>');
  };

  APP.views.reset = function () {
    document.title = 'New password — Arnour';
    if (!B.user) return card('<h1>Link expired</h1><p class="muted center">This reset link has expired or was already used.</p><a class="btn btn-primary btn-block" href="#/forgot">Request a new link</a>');
    return card('<h1>Choose a new password</h1>' +
      '<form data-form="live-reset" novalidate>' +
      '<label class="field"><span class="label">New password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required>' + pwHint() + '</label>' +
      '<p class="field-error" id="live-err" role="alert"></p>' +
      '<button class="btn btn-primary btn-block" type="submit">Save password</button></form>');
  };

  APP.views.suspended = function () {
    document.title = 'Account suspended — Arnour';
    var why = B.suspended && B.suspended.reason ? '<p class="live-note warn"><strong>Reason:</strong> ' + esc(B.suspended.reason) + '</p>' : '';
    return card('<h1>Your account is suspended</h1>' +
      '<p class="muted center">Your profile, roles and messages are hidden from other members while the suspension is in place, and you cannot post or send messages.</p>' + why +
      '<p class="center">If you think this is a mistake, write to <a href="mailto:contact@arnour.com?subject=Suspended%20account%20' + encodeURIComponent((B.user && B.user.email) || '') + '">contact@arnour.com</a> from the email address you signed up with and we will look at it.</p>' +
      '<button class="btn btn-outline btn-block" data-action="sign-out">Sign out</button>' +
      '<p class="center small mt16"><a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a></p>');
  };

  /* ---------- email notifications (settings on the Account page, unsubscribe page) ---------- */
  var EMAIL_KINDS = { matches: 'new matching roles', invites: 'invitation and introduction', messages: 'new message', applicants: 'new applicant', community: 'community answer', announcements: 'news and announcement', all: 'all Arnour' };
  function emailPrefsHtml(role) {
    var head = '<div class="card-h" style="margin-top:24px">Email notifications</div>';
    if (!role) return '';
    var p = B.emailPrefs;
    if (!p) {
      if (!B._epLoading) { B._epLoading = true; rpc('my_email_prefs').then(function (x) { B.emailPrefs = x || {}; B._epLoading = false; APP.render(); }, function () { B._epLoading = false; B.emailPrefs = { error: true }; APP.render(); }); }
      return head + '<p class="muted small">Loading your email settings…</p>';
    }
    if (p.error) return head + '<p class="muted small">Your email settings could not be loaded. Please refresh the page.</p>';
    var opt = function (pairs, v) { return pairs.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
    var sw = function (name, label, hint, on) { return '<label class="ep-row"><input type="checkbox" name="ep_' + name + '"' + (on ? ' checked' : '') + '><span><b>' + label + '</b><small class="muted">' + hint + '</small></span></label>'; };
    return head + '<p class="muted small">Sent to <strong>' + esc(p.email || (B.user && B.user.email)) + '</strong>. Every email has a one-click unsubscribe link.</p>' +
      '<form data-form="live-email" class="ep-form">' +
      (role === 'consultant'
        ? '<label class="field"><span class="label">New roles that match you (75%+)</span><select name="ep_matches" class="input">' + opt([['daily', 'Daily summary (8 am UAE time)'], ['instant', 'Right away'], ['weekly', 'Weekly summary (Mondays)'], ['off', 'Off']], p.matches || 'daily') + '</select></label>'
        : '<label class="field"><span class="label">New applicants on your roles</span><select name="ep_applicants" class="input">' + opt([['instant', 'Right away'], ['daily', 'Daily summary (8 am UAE time)'], ['off', 'Off']], p.applicants || 'instant') + '</select></label>') +
      sw('invites', role === 'consultant' ? 'Invitations, introductions and application updates' : 'Introduction requests', role === 'consultant' ? 'A company invites you to apply, wants to connect, or shortlists you' : 'A professional wants to connect, or accepts your request', p.invites !== false) +
      sw('messages', 'New messages', 'Only if unread after 15 minutes — at most one email per chat per hour', p.messages !== false) +
      sw('community', 'Community answers', 'Someone answers your question, or your answer is accepted', p.community !== false) +
      sw('announcements', 'News and announcements', 'New features and important notices from Arnour', p.announcements !== false) +
      '<button class="btn btn-outline" type="submit">Save email settings</button></form>';
  }
  APP.views.unsubscribe = function () {
    document.title = 'Email settings — Arnour';
    var qs = (location.hash.split('?')[1] || ''), prm = {};
    qs.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) prm[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    var key = (prm.t || '') + '|' + (prm.k || '');
    var st = B.unsub && B.unsub.key === key ? B.unsub : null;
    if (!st) {
      B.unsub = st = { key: key, state: 'busy' };
      rpc('email_unsubscribe', { p_token: prm.t || '', p_kind: prm.k || 'all' }).then(function (r) { st.state = r === 'invalid' ? 'invalid' : 'done'; st.kind = r; B.emailPrefs = null; APP.render(); }, function () { st.state = 'error'; APP.render(); });
    }
    var body = st.state === 'busy' ? '<p class="muted center">Updating your email settings…</p>'
      : st.state === 'done' ? '<h1>You are unsubscribed</h1><p class="muted center">You will no longer get ' + esc(EMAIL_KINDS[st.kind] || 'these') + ' emails from Arnour. Notifications still appear on the site.</p>'
      : st.state === 'invalid' ? '<h1>Link not valid</h1><p class="muted center">This unsubscribe link is not valid any more. You can change your email settings on your Account page.</p>'
      : '<h1>Something went wrong</h1><p class="muted center">Please try the link again in a moment, or change your email settings on your Account page.</p>';
    return card(body + '<a class="btn btn-outline btn-block mt16" href="#/account">Manage all email settings</a>');
  };

  APP.views.account = function () {
    document.title = 'Account — Arnour';
    var role = B.profile ? B.profile.role : null;
    return '<div class="auth-wrap wide"><div class="card auth-card" style="max-width:520px">' +
      '<h1>Your account</h1>' +
      '<p class="muted center">Signed in as <strong>' + esc(B.user && B.user.email) + '</strong>' + (role ? ' · ' + (role === 'consultant' ? 'SAP professional' : 'Company') : '') + '</p>' +
      '<div class="card-h" style="margin-top:20px">Change password</div>' +
      '<form data-form="live-reset" novalidate>' +
      '<label class="field"><span class="label">New password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required>' + pwHint() + '</label>' +
      '<p class="field-error" id="live-err" role="alert"></p>' +
      '<button class="btn btn-outline" type="submit">Update password</button></form>' +
      emailPrefsHtml(role) +
      '<div class="card-h" style="margin-top:24px">Delete my account</div>' +
      '<p class="muted small">This permanently removes your profile, messages and applications. It cannot be undone.</p>' +
      '<button class="btn btn-danger" data-action="live-delete">Delete my account…</button>' +
      '<button class="btn btn-ghost btn-block mt16" data-action="sign-out">Sign out</button>' +
      '<p class="center small mt16"><a href="#/">Back</a></p>' +
      '</div></div>';
  };

  var legal = function (title, body) { return '<div class="auth-wrap wide"><div class="card auth-card legal" style="max-width:760px;text-align:left"><h1>' + title + '</h1>' + body + '<p class="center small mt16"><a href="#/">Back to Arnour</a></p></div></div>'; };
  APP.views.terms = function () {
    document.title = 'Terms — Arnour';
    return legal('Terms of Use',
      '<p class="muted small">Last updated: ' + esc(CFG.legalDate || 'October 2026') + '</p>' +
      '<p>Arnour is a marketplace that connects SAP professionals with companies that need them. By creating an account you agree to these terms.</p>' +
      '<h3>Your account</h3><p>You must be at least 18 and provide accurate information. You are responsible for your password and for what happens under your account. One person, one account.</p>' +
      '<h3>What you may do</h3><p>Use Arnour to find work or hire SAP expertise. Do not post false profiles or roles, harass others, scrape the site, send spam, or share other people\'s details without permission.</p>' +
      '<h3>Privacy modes</h3><p>If you choose to keep your identity or company private, we hide it from the other side until you accept an introduction. Once you accept, the details you chose to share become visible to that person or company.</p>' +
      '<h3>Content</h3><p>You keep ownership of what you post. You allow Arnour to display it to other users as described on the site. We may remove content that breaks these terms.</p>' +
      '<h3>No guarantees</h3><p>Arnour does not guarantee jobs, candidates or the accuracy of what users post. Agreements between professionals and companies are between them. The service is provided as is, and our liability is limited to the extent the law allows.</p>' +
      '<h3>Ending your account</h3><p>You can delete your account at any time from the Account page. We may suspend accounts that break these terms.</p>' +
      '<h3>Contact</h3><p><a href="mailto:contact@arnour.com">contact@arnour.com</a></p>');
  };
  APP.views.privacy = function () {
    document.title = 'Privacy — Arnour';
    return legal('Privacy Policy',
      '<p class="muted small">Last updated: ' + esc(CFG.legalDate || 'October 2026') + '</p>' +
      '<p>This explains what Arnour collects and how it is used.</p>' +
      '<h3>What we collect</h3><p>Your email address and password (stored securely, never in readable form); the profile information you enter (for example name, skills, experience, rates, company details, roles); your messages, applications and introductions; and basic technical data needed to run the site.</p>' +
      '<h3>Who sees it</h3><p>Other members see your profile according to your privacy choice. If you turn on private mode, your name, photo, LinkedIn, summary, city, nationality and CV are hidden until you accept an introduction. Companies can hide their name and details the same way, for the whole company or per role. Messages are only visible to the two people in the conversation.</p>' +
      '<h3>How it is used</h3><p>To run the marketplace: match roles and professionals, deliver messages and notifications, and keep the site secure. We do not sell your data.</p>' +
      '<h3>Where it is stored</h3><p>Data is stored with our hosting and database providers (Supabase and Netlify). Emails are sent from noreply@arnour.com.</p>' +
      '<h3>Your rights</h3><p>You can edit your profile at any time and delete your account from the Account page, which removes your profile, messages and applications. To ask for a copy of your data or raise a concern, write to <a href="mailto:contact@arnour.com">contact@arnour.com</a>.</p>' +
      '<h3>Cookies</h3><p>We use browser storage only to keep you signed in. We do not use advertising cookies.</p>'+
      '<h3>Problem reports and error logs</h3><p>If you send us a problem report we keep it with the page, browser and your account email so we can fix the issue and reply. For visitors who are not signed in we keep a scrambled form of the network address only, to stop spam. We also record technical errors from the site (the message and page, never what you typed) and anonymous page-view counts, with no cookies and no personal data.</p>');
  };

  /* footer: real wording */
  APP.footerHtml = function () {
    return '<footer class="site-footer"><div class="site-footer-inner">' +
      '<span class="brand sm"><span class="brand-logo" aria-hidden="true">A</span>Arnour</span>' +
      '<nav aria-label="Footer">' + (B.user ? '<a href="#/home">Home page</a>' : '') + '<a href="#/jobs">Open roles</a><a href="#/community">Community</a>' +
      (B.user ? '<a href="#/account">Account</a>' : '<a href="#/login">Sign in</a><a href="#/register">Join</a>') +
      '<a href="#/terms">Terms</a><a href="#/privacy">Privacy</a><a href="mailto:contact@arnour.com">Contact</a><a href="#" data-action="fb-open">Report a problem</a></nav>' +
      '<small>© Arnour. The talent network for the SAP ecosystem.</small></div></footer>';
  };

  /* ------------------------------ actions & forms ------------------------------ */
  var origClick = APP.onClick, origSubmit = APP.onSubmit;
  var COMM_ACTIONS = ['q-upvote', 'article-upvote', 'answer-upvote', 'accept-answer', 'comment-delete'];
  var COMM_FORMS = ['community-ask', 'community-share', 'community-answer', 'community-comment'];
  function setErr(msg) { var e = document.getElementById('live-err'); if (e) e.textContent = msg || ''; }
  function busy(f, on, label) { var b = f.querySelector('button[type="submit"]'); if (!b) return; if (on) { b.dataset.t = b.textContent; b.disabled = true; b.textContent = label || 'Please wait…'; } else { b.disabled = false; b.textContent = b.dataset.t || b.textContent; } }

  /* community writes: the page updates at once, the server call follows; if it fails the page is put back from the server */
  B.commBusy = 0;
  function commResync() {
    return B.fetchCommunity().then(function (c) { if (c && !B.commBusy) { B.applyCommunity(APP.db, c); APP.render(); } });
  }
  function commCall(fn, args, onFail) {
    B.commBusy++;
    return rpc(fn, args).then(function (r) { B.commBusy--; return r; }, function (e) {
      B.commBusy--;
      if (typeof onFail === 'function') onFail(e);
      var m = String((e && e.message) || '');
      APP.toast(/too many posts/i.test(m) ? 'You are posting very quickly. Please wait a little and try again.' : isTransient(e) ? 'Could not reach the server. Please try again.' : 'That could not be saved. Please try again.');
      commResync();
    });
  }
  function commSubmit(type, f) {
    var db = APP.db, k;
    if (type === 'community-ask') {
      var before = Object.keys(db.questions);
      origSubmit.call(APP, f);
      var nid = Object.keys(db.questions).filter(function (x) { return before.indexOf(x) === -1; })[0];
      if (!nid) return;
      var q = db.questions[nid];
      commCall('post_question', { p_id: q.id, p_title: q.title, p_body: q.body, p_product: q.productId || '', p_module: q.moduleId || '', p_topic: q.topic || '', p_anon: !!q.anonymous }, function () { delete db.questions[nid]; if (location.hash.indexOf(nid) !== -1) APP.go('#/community'); });
    } else if (type === 'community-share') {
      var bef = Object.keys(db.articles);
      origSubmit.call(APP, f);
      var aid = Object.keys(db.articles).filter(function (x) { return bef.indexOf(x) === -1; })[0];
      if (!aid) return;
      var a = db.articles[aid];
      commCall('post_article', { p_id: a.id, p_title: a.title, p_url: a.url, p_body: a.body || '', p_product: a.productId || '', p_module: a.moduleId || '', p_topic: a.topic || '' }, function () { delete db.articles[aid]; if (location.hash.indexOf(aid) !== -1) APP.go('#/community'); });
    } else if (type === 'community-answer') {
      var qn = APP.question(f.dataset.qid); if (!qn) return;
      var n0 = (qn.answers || []).length;
      origSubmit.call(APP, f);
      if ((qn.answers || []).length <= n0) return;
      var an = qn.answers[qn.answers.length - 1];
      commCall('post_answer', { p_q: qn.id, p_id: an.id, p_body: an.body }, function () { qn.answers = (qn.answers || []).filter(function (x) { return x.id !== an.id; }); });
    } else if (type === 'community-comment') {
      var ar = APP.article(f.dataset.aid); if (!ar) return;
      var c0 = (ar.comments || []).length;
      origSubmit.call(APP, f);
      if ((ar.comments || []).length <= c0) return;
      var cm = ar.comments[ar.comments.length - 1];
      commCall('post_comment', { p_article: ar.id, p_id: cm.id, p_body: cm.body }, function () { ar.comments = (ar.comments || []).filter(function (x) { return x.id !== cm.id; }); });
    }
  }

  APP.onClick = function (el, e) {
    var a = el.dataset.action;
    if (a === 'live-resend') {
      var em = APP.state.liveEmail; if (!em) { APP.go('#/login'); return; }
      if (B._resendAt && Date.now() - B._resendAt < 30000) { APP.toast('Please wait a few seconds before asking again'); return; }
      if (B.captchaMissing()) { APP.toast(B.captchaMissing()); return; }
      B._resendAt = Date.now();
      B.sb.auth.resend({ type: 'signup', email: em, options: { emailRedirectTo: location.origin + '/', captchaToken: B.captchaToken() } }).then(function (r) { B.captchaReset(); APP.toast(r.error ? authError(r.error) : 'Confirmation email sent'); }, function () { B._resendAt = 0; APP.toast('Could not send the email — check your connection and try again.'); });
      return;
    }
    if (a === 'live-oauth') { B.startOAuth(el.dataset.provider, el.dataset.role || ''); return; }
    if (a === 'live-pick-role') {
      try { localStorage.setItem('arnour-oauth-role', el.dataset.role === 'e' ? 'e' : 'c'); } catch (e) { /* ignore */ }
      APP.go(el.dataset.role === 'e' ? '#/onboard-e' : '#/onboard'); return;
    }
    if (a === 'live-delete') {
      APP.openDialog({
        title: 'Delete your account?',
        sub: 'This permanently deletes your profile, messages and applications. Type DELETE to confirm.',
        body: '<label class="field"><input id="live-del" class="input" placeholder="DELETE" autocomplete="off"></label>',
        confirmLabel: 'Delete my account', danger: true,
        onConfirm: function () {
          var v = document.getElementById('live-del');
          if (!v || v.value.trim() !== 'DELETE') { APP.toast('Type DELETE to confirm'); return false; }
          B.sb.storage.from('cvs').list(B.user.id).then(function (l) { var f = (l.data || []).map(function (x) { return B.user.id + '/' + x.name; }); return f.length ? B.sb.storage.from('cvs').remove(f) : null; }).catch(function () {}).then(function () { return rpc('delete_my_account'); }).then(function () { return B.signOut(); }).then(function () { location.hash = '#/'; APP.render(); APP.toast('Your account was deleted'); }, function () { APP.toast('Could not delete the account. Please try again.'); });
        }
      });
      return;
    }
    if (a === 'sign-out') { APP.logout(); return; }
    if (a === 'cv-download') { B.downloadCv(el.dataset.path, el.dataset.name); return; }
    if (COMM_ACTIONS.indexOf(a) !== -1) {
      if (!B.profile) { APP.toast('Sign in to take part in the community'); return; }
      var d = el.dataset, r0;
      if (a === 'q-upvote' || a === 'article-upvote' || a === 'answer-upvote') {
        var item = a === 'q-upvote' ? APP.question(d.id) : a === 'article-upvote' ? APP.article(d.id) : ((APP.question(d.qid) || {}).answers || []).filter(function (x) { return x.id === d.aid; })[0];
        if (!item) return;
        var kind = a === 'q-upvote' ? 'q' : a === 'article-upvote' ? 'r' : 'a', iid = a === 'answer-upvote' ? d.aid : d.id;
        r0 = origClick.apply(this, arguments);
        var on = APP.isUpvoted(item);
        commCall('set_vote', { p_kind: kind, p_item: iid, p_on: on });
        return r0;
      }
      if (a === 'accept-answer') {
        var qq = APP.question(d.qid), ac = qq && (qq.answers || []).filter(function (x) { return x.id === d.aid; })[0], was = ac && ac.accepted;
        r0 = origClick.apply(this, arguments);
        if (ac && ac.accepted !== was) commCall('accept_answer', { p_q: d.qid, p_a: d.aid, p_on: !!ac.accepted });
        return r0;
      }
      if (a === 'comment-delete') {
        var art = APP.article(d.aid), had = art && (art.comments || []).some(function (x) { return x.id === d.cid; });
        r0 = origClick.apply(this, arguments);
        if (had && !(art.comments || []).some(function (x) { return x.id === d.cid; })) commCall('delete_comment', { p_id: d.cid });
        return r0;
      }
    }
    return origClick.apply(this, arguments);
  };

  APP.onSubmit = function (f) {
    var type = f.dataset.form;
    if (COMM_FORMS.indexOf(type) !== -1) {
      if (!B.profile) { APP.toast('Sign in to take part in the community'); return; }
      return commSubmit(type, f);
    }
    if (!type || type.indexOf('live-') !== 0) return origSubmit.apply(this, arguments);
    var fd = new FormData(f), g = function (n) { var v = fd.get(n); return v == null ? '' : String(v).trim(); };
    setErr('');
    if (type === 'live-login') {
      var email = g('email'), pw = String(fd.get('password') || '');
      if (!email || !pw) return setErr('Enter your email and password.');
      if (B.captchaMissing()) return setErr(B.captchaMissing());
      APP.state.liveEmail = email; APP.state.liveNotConfirmed = false; busy(f, true, 'Signing in…');
      B.signIn(email, pw).then(function () { B.afterSignedIn(); }, function (e) {
        busy(f, false); var m = authError(e);
        if (m === 'NOT_CONFIRMED') { APP.state.liveNotConfirmed = true; APP.render(); } else setErr(m);
      });
    } else if (type === 'live-register') {
      if (g('website')) return; /* bots fill the hidden field */
      var em = g('email'), p = String(fd.get('password') || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setErr('Please enter a valid email address.');
      if (p.length < 8) return setErr('Choose a password with at least 8 characters.');
      if (!fd.get('terms')) return setErr('Please accept the Terms and Privacy Policy to continue.');
      if (B.captchaMissing()) return setErr(B.captchaMissing());
      APP.state.liveEmail = em; busy(f, true, 'Creating account…');
      B.signUp(em, p, f.dataset.role).then(function (d) {
        if (d && d.session) { return B.hydrate(d.session).then(function () { B.afterSignedIn(); }); }
        APP.go('#/check-email');
      }, function (e) { busy(f, false); setErr(authError(e)); });
    } else if (type === 'live-forgot') {
      var fe = g('email'); if (!fe) return setErr('Enter your email.');
      if (B.captchaMissing()) return setErr(B.captchaMissing());
      APP.state.liveEmail = fe; busy(f, true, 'Sending…');
      B.sb.auth.resetPasswordForEmail(fe, { redirectTo: location.origin + '/', captchaToken: B.captchaToken() }).then(function (r) {
        B.captchaReset(); busy(f, false);
        if (r.error && /captcha/i.test(r.error.message)) return setErr(authError(r.error));
        if (r.error && /rate|seconds/i.test(r.error.message)) return setErr(authError(r.error));
        f.innerHTML = '<p class="center">If an account exists for <strong>' + esc(fe) + '</strong>, a reset link is on its way. Check your inbox and spam folder.</p><a class="btn btn-ghost btn-block" href="#/login">Back to sign in</a>';
      });
    } else if (type === 'live-email') {
      var pd = { invites: !!f.querySelector('[name=ep_invites]:checked'), messages: !!f.querySelector('[name=ep_messages]:checked'), community: !!f.querySelector('[name=ep_community]:checked'), announcements: !!f.querySelector('[name=ep_announcements]:checked') };
      if (fd.get('ep_matches')) pd.matches = g('ep_matches');
      if (fd.get('ep_applicants')) pd.applicants = g('ep_applicants');
      busy(f, true, 'Saving…');
      rpc('set_email_prefs', { p_data: pd }).then(function () { busy(f, false); B.emailPrefs = Object.assign({}, B.emailPrefs, pd); APP.toast('Email settings saved ✓'); }, function () { busy(f, false); APP.toast('Could not save your email settings. Please try again.'); });
    } else if (type === 'live-reset') {
      var np = String(fd.get('password') || ''); if (np.length < 8) return setErr('Choose a password with at least 8 characters.');
      busy(f, true, 'Saving…');
      B.sb.auth.updateUser({ password: np }).then(function (r) {
        busy(f, false);
        if (r.error) return setErr(authError(r.error));
        APP.toast('Password updated'); B.recovery = false;
        if (location.hash === '#/reset') B.afterSignedIn();
        else f.reset();
      });
    }
  };


  /* a signed-out visitor opening a shared profile link: ask the server (it refuses private profiles) */
  var origTalent = APP.views['talent-public'];
  B.fetched = {};
  APP.views['talent-public'] = function (ctx) {
    var id = ctx && ctx.p && ctx.p[0];
    if (id && !APP.db.consultants[id]) {
      if (!B.fetched[id]) {
        B.fetched[id] = true;
        rpc('get_public_profile', { p_id: id }).then(function (p) {
          if (p && p.private) APP.db.consultants[id] = { id: id, anon: true, firstName: '', lastName: '', headline: '', skills: [], languages: [] };
          else if (p) APP.db.consultants[id] = p;
          else B.fetched[id] = 'none';
          if (location.hash.indexOf(id) !== -1) APP.render();
        }, function () { B.fetched[id] = false; });
        return '<div class="live-splash"><p class="muted">Loading profile…</p></div>';
      }
      if (B.fetched[id] === true) return '<div class="live-splash"><p class="muted">Loading profile…</p></div>';
    }
    return origTalent.apply(this, arguments);
  };

  /* ------------------------------ start ------------------------------ */
  APP.start = function () {
    var root = document.getElementById('app');
    root.innerHTML = '<div class="live-splash"><span class="brand-logo lg">A</span><p class="muted">Loading Arnour…</p></div>';
    APP.db = B.emptyDb();
    B.boot().then(function () {
      if (B.justConfirmed && B.user && !B.profile && B.isAdmin) location.hash = '#/admin';
      else if (B.justConfirmed && B.user && !B.profile) { /* freshly confirmed: go straight to the profile steps (or pick a side first, after Google / LinkedIn from the sign-in page) */
        if (B.restoreWizardDraft()) location.hash = B.metaRole() === 'e' ? '#/onboard-e' : '#/onboard';
        else location.hash = B.hasRole() ? (B.metaRole() === 'e' ? '#/onboard-e' : '#/onboard') : '#/start';
      }
      else if (B.justConfirmed && B.profile && /^#?\/?(login|register)?$/.test(location.hash)) { try { localStorage.removeItem('arnour-oauth-role'); } catch (e) { /* ignore */ } location.hash = B.profile.role === 'consultant' ? '#/c/dashboard' : '#/e/dashboard'; }
    }, function () {
      root.innerHTML = '<div class="live-splash"><span class="brand-logo lg">A</span><h2>We could not reach Arnour right now</h2><p class="muted">Check your connection and try again.</p><button class="btn btn-primary" onclick="location.reload()">Reload</button></div>';
      throw new Error('boot failed');
    }).then(function () {
      window.addEventListener('hashchange', function () { if (APP.editNavGuard()) return; APP.closeMatchDrawer(true); APP.closeDialog(true); APP.render(); });
      APP.bindGlobal();
      APP.render();
      B.startPolling();
    }, function () { /* splash already shows the error */ });
  };
})();
