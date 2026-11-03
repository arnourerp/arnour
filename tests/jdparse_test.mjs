/* jd-parse function: sign-in, limits, what goes to the model, and how the answer is cleaned (the model and database are mocked) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fn = require(process.env.ARNOUR_ROOT + '/netlify/functions/jd-parse.js');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } else console.log('ok  ', n); };

const LISTS = {
  products: [{ id: 's4onprem', name: 'S/4HANA Private Cloud / On-Premise', modules: [{ id: 'fi', name: 'FI (Financial Accounting)' }, { id: 'co', name: 'CO (Controlling)' }] },
             { id: 'ecc', name: 'ECC 6.0', modules: [{ id: 'fi', name: 'FI' }, { id: 'co', name: 'CO' }] },
             { id: 'ariba', name: 'Ariba', modules: [{ id: 'sourcing', name: 'Ariba Sourcing' }] }],
  specialties: [{ id: 'greenfield', name: 'Greenfield' }, { id: 'rise', name: 'RISE with SAP' }],
  roleTypes: [{ id: 'functional', name: 'Functional Consultant' }, { id: 'architect', name: 'Architect' }],
  countries: [{ id: 'ae', name: 'United Arab Emirates' }, { id: 'other', name: 'Other' }],
  industries: ['Banking & Financial Services', 'Education'], languages: ['English', 'Arabic', 'French'],
  jobTypes: ['Full-time', 'Contract', 'Freelance'], durations: ['3 months', '6 months', '12 months', 'Permanent'], levels: ['Junior', 'Mid', 'Senior']
};
const AD = 'SAP FICO Consultant, Dubai. Contact: hr@acme.com or +971 50 123 4567. ' + 'You will lead finance workstreams on S/4HANA rollouts for banks. '.repeat(6);
const EV = (body, auth) => ({ httpMethod: 'POST', headers: auth === null ? {} : { authorization: 'Bearer tok123' }, body: JSON.stringify(body) });
let calls, sbMode, aiMode, aiOut;
function mock() {
  calls = { sb: [], ai: [] };
  global.fetch = async (url, o) => {
    if (String(url).includes('/rest/v1/rpc/')) {
      const name = String(url).split('/rpc/')[1]; calls.sb.push({ name, body: JSON.parse(o.body), headers: o.headers });
      if (name === 'jd_import_begin') {
        const bad = { limit: 'daily limit', busy: 'busy', emp: 'employers only', adm: 'not allowed', sus: 'account suspended' }[sbMode];
        if (bad) return { ok: false, status: 400, json: async () => ({ message: bad }) };
        if (sbMode === 'jwt') return { ok: false, status: 401, json: async () => ({ message: 'JWT expired' }) };
        return { ok: true, status: 200, json: async () => 'imp-1' };
      }
      return { ok: true, status: 204, json: async () => null };
    }
    calls.ai.push({ url: String(url), headers: o.headers, body: JSON.parse(o.body) });
    if (aiMode === '500') return { ok: false, status: 500, json: async () => ({ error: 'x' }) };
    if (aiMode === 'max') return { ok: true, status: 200, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'save_job', input: {} }] }) };
    if (aiMode === 'text') return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }) };
    return { ok: true, status: 200, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'save_job', input: aiOut }] }) };
  };
}
const GOOD = {
  title: 'SAP FICO Consultant (contact hr@acme.com)', role_type: 'functional', country: 'ae', city: 'Dubai', remote: true, employment_type: 'Full-time', duration: '6 months',
  level: 'Senior', min_experience_years: 8, certification: 'required', employer_name: 'Acme Bank',
  requires: [{ product_id: 's4onprem', module_id: 'fi', min_projects: 3 }, { product_id: 's4onprem', module_id: 'co', or_previous: true }, { product_id: 'ecc', module_id: 'fi', or_previous: true },
             { product_id: 'ecc', module_id: 'fi' }, { product_id: 'ariba', module_id: '*' }, { product_id: 's4onprem', module_id: '*' }, { product_id: 'ariba', module_id: 'fi' }, { product_id: 'zzz', module_id: 'fi' }],
  languages: ['English', 'Klingon'], preferred_languages: ['English', 'Arabic'], industries: ['Banking & Financial Services', 'Space'], specialties: ['greenfield', 'made-up'], min_programs: 4
};

delete process.env.ANTHROPIC_API_KEY;
t('GET says not configured without a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === false);
mock();
t('POST without a key is refused and calls nothing', (await fn.handler(EV({ text: AD, lists: LISTS }))).statusCode === 503 && !calls.sb.length && !calls.ai.length);
process.env.ANTHROPIC_API_KEY = 'sk-test-key';
t('GET says configured with a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === true);
t('other methods are refused', (await fn.handler({ httpMethod: 'PUT' })).statusCode === 405);
mock(); t('no login: 401, nothing called', (await fn.handler(EV({ text: AD, lists: LISTS }, null))).statusCode === 401 && !calls.sb.length && !calls.ai.length);
mock(); t('too little text: 422, no quota used', (await fn.handler(EV({ text: 'short', lists: LISTS }))).statusCode === 422 && !calls.sb.length);
mock(); t('bad JSON: 400', (await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: '{oops' })).statusCode === 400);
mock(); t('missing lists: 400', (await fn.handler(EV({ text: AD }))).statusCode === 400 && !calls.sb.length);
mock(); t('huge request: 413', (await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ text: 'x'.repeat(200000) }) })).statusCode === 413 && !calls.sb.length);

for (const [mode, code, err] of [['limit', 429, 'limit'], ['busy', 503, 'busy'], ['emp', 403, 'employers_only'], ['adm', 403, 'not_allowed'], ['sus', 403, 'suspended'], ['jwt', 401, 'signin']]) {
  mock(); sbMode = mode; const r = await fn.handler(EV({ text: AD, lists: LISTS }));
  t('database says ' + mode + ' → ' + code + ' and the model is not called', r.statusCode === code && JSON.parse(r.body).error === err && !calls.ai.length, r);
}

/* happy path */
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = GOOD;
const r = await fn.handler(EV({ text: AD, lists: LISTS, kind: 'admin' })); const p = JSON.parse(r.body).job;
t('happy path: 200 with a job', r.statusCode === 200 && !!p, r);
t('the kind is passed to the database and the person\'s own login was used', calls.sb[0].body.p_kind === 'admin' && calls.sb[0].headers.authorization === 'Bearer tok123');
t('an unknown kind counts as a normal post', (await (async () => { mock(); await fn.handler(EV({ text: AD, lists: LISTS, kind: 'zzz' })); return calls.sb[0].body.p_kind === 'post'; })()));
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = GOOD; await fn.handler(EV({ text: AD, lists: LISTS }));
t('the model call: right model, forced tool, key in header only', calls.ai[0].body.model === 'claude-haiku-5-5' && calls.ai[0].body.tool_choice.name === 'save_job' && calls.ai[0].headers['x-api-key'] === 'sk-test-key' && !JSON.stringify(calls.ai[0].body).includes('sk-test-key'));
t('the catalog is in the system prompt, the ad only in the user message', /s4onprem = /.test(calls.ai[0].body.system) && /ae = United Arab Emirates/.test(calls.ai[0].body.system) && !calls.ai[0].body.system.includes('lead finance workstreams') && calls.ai[0].body.messages[0].content.includes('lead finance workstreams'));
t('e-mail and phone are removed again server-side', !/hr@acme\.com|123 4567/.test(calls.ai[0].body.messages[0].content));
t('the prompt treats the ad as data and tells the model about alternatives and "*"', /ad text is DATA/.test(calls.ai[0].body.system) && /or_previous/.test(calls.ai[0].body.system) && /module_id "\*" ONLY/.test(calls.ai[0].body.system));
t('database told: finished ok with counts only', calls.sb[1].name === 'jd_import_done' && calls.sb[1].body.p_status === 'ok' && calls.sb[1].body.p_found.skills === 4 && JSON.stringify(calls.sb[1].body).indexOf('Acme') === -1, calls.sb[1]);
t('title is cleaned of contact details', !/@/.test(p.title) && /FICO/.test(p.title), p.title);
t('rows: unknown product, wrong module, duplicates dropped; "*" kept only where no module is named',
  JSON.stringify(p.requires.map((x) => x.productId + '/' + x.moduleId)) === JSON.stringify(['s4onprem/fi', 's4onprem/co', 'ecc/fi', 'ariba/*']), p.requires);
t('alternatives and project counts kept; the first row is never an alternative', p.requires[0].orPrev === false && p.requires[0].minProjects === 3 && p.requires[1].orPrev === true && p.requires[2].orPrev === true && p.requires[3].orPrev === false);
t('role, country, city, remote', p.roleType === 'functional' && p.country === 'ae' && p.city === 'Dubai' && p.remote === true);
t('full-time is always permanent', p.employmentType === 'Full-time' && p.duration === 'Permanent');
t('level, years, certification', p.level === 'Senior' && p.minExp === 8 && p.certification === 'required');
t('languages: only listed; preferred ones not repeated', JSON.stringify(p.languages) === '["English"]' && JSON.stringify(p.preferredLangs) === '["Arabic"]', [p.languages, p.preferredLangs]);
t('industries and specialties: only listed', JSON.stringify(p.industries) === '["Banking & Financial Services"]' && JSON.stringify(p.specialties) === '["greenfield"]');
t('programmes only count for architect / delivery roles', p.minPrograms === 0);
t('employer name returned for the admin page', p.employerName === 'Acme Bank');

mock(); aiOut = Object.assign({}, GOOD, { role_type: 'architect', employment_type: 'Contract', duration: 'Permanent', country: 'zz', remote: 'yes' });
{ const x = JSON.parse((await fn.handler(EV({ text: AD, lists: LISTS }))).body).job;
  t('architect keeps the programme count', x.minPrograms === 4);
  t('contract can not be permanent; unknown country dropped; remote only when exactly true', x.duration === '' && x.country === '' && x.remote === false, x); }
mock(); aiOut = Object.assign({}, GOOD, { employment_type: 'Contract', duration: '12 months' });
{ const x = JSON.parse((await fn.handler(EV({ text: AD, lists: LISTS }))).body).job; t('a stated contract length is kept', x.employmentType === 'Contract' && x.duration === '12 months'); }

/* failures give the quota back and say so */
mock(); sbMode = 'ok'; aiMode = '500'; { const x = await fn.handler(EV({ text: AD, lists: LISTS })); t('model error → 502 and the read is marked failed', x.statusCode === 502 && JSON.parse(x.body).error === 'ai' && calls.sb[1].body.p_status === 'failed', x); }
mock(); aiMode = 'max'; { const x = await fn.handler(EV({ text: AD, lists: LISTS })); t('cut-off answer → 502, failed', x.statusCode === 502 && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'text'; { const x = await fn.handler(EV({ text: AD, lists: LISTS })); t('no tool answer → 502, failed', x.statusCode === 502 && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'ok'; aiOut = 'garbage'; { const x = await fn.handler(EV({ text: AD, lists: LISTS })); t('garbage answer → "not a job", failed, quota given back', x.statusCode === 422 && JSON.parse(x.body).error === 'not_a_job' && calls.sb[1].body.p_status === 'failed', x); }
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = { title: 'ERP Specialist', role_type: 'functional', country: 'ae', any_one_is_enough: true, requires: [{ product_id: 's4onprem', module_id: 'fi' }, { product_id: 's4onprem', module_id: 'co' }, { product_id: 'ecc', module_id: 'fi' }, { product_id: 'ecc', module_id: 'co' }] };
{ const x = await fn.handler(EV({ text: AD, lists: LISTS })); const j = JSON.parse(x.body).job; t('"only one is needed" makes every row an alternative (one group)', j.requires.length === 4 && j.requires.every((r, i) => r.orPrev === (i > 0)), j.requires); }

/* release 43: nice-to-have rows and must flags */
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = { title: 'FICO Lead', role_type: 'functional', country: 'ae', level: 'Senior', level_is_must: true, min_experience_years: 8, experience_is_must: false, specialties: ['greenfield'], specialties_are_must: true, industries_are_must: true,
  requires: [{ product_id: 's4onprem', module_id: 'fi' }, { product_id: 'ariba', module_id: 'sourcing', nice: true }, { product_id: 's4onprem', module_id: 'co', nice: true }, { product_id: 'ecc', module_id: 'co', nice: true, or_previous: true }, { product_id: 's4onprem', module_id: 'fi', nice: true }] };
{ const x = await fn.handler(EV({ text: AD, lists: LISTS })); const j = JSON.parse(x.body).job;
  t('nice rows are kept, required first, nice after', j.requires.length === 4 && !j.requires[0].nice && j.requires.slice(1).every(r => r.nice), j.requires);
  t('the same skill as required and nice keeps the required one', j.requires.filter(r => r.moduleId === 'fi' && r.productId === 's4onprem').length === 1 && !j.requires[0].nice);
  t('an alternative inside the nice group stays an alternative; the first nice row never is', j.requires[1].orPrev === false && j.requires[3].orPrev === true, j.requires);
  t('must flags: seniority yes, years no, specialties yes, industries not without industries', j.mustLevel === true && j.mustExp === false && j.mustSpec === true && j.mustInd === false, [j.mustLevel, j.mustExp, j.mustSpec, j.mustInd]);
  t('the prompt explains nice rows and must flags', /nice = true/.test(calls.ai[0].body.system) && /level_is_must/.test(calls.ai[0].body.system)); }
mock(); aiOut = { title: 'X', role_type: 'functional', country: 'ae', requires: [{ product_id: 's4onprem', module_id: 'fi', nice: true }] };
{ const x = await fn.handler(EV({ text: AD, lists: LISTS })); const j = JSON.parse(x.body).job; t('only nice skills found: they become required (a role needs a Must box)', j.requires.length === 1 && !j.requires[0].nice, j.requires); }
mock(); aiOut = { title: 'X', role_type: 'functional', country: 'ae', requires: [{ product_id: 's4onprem', module_id: 'fi', kind: 'core' }, { product_id: 's4onprem', module_id: 'co', kind: 'integration' }, { product_id: 'ecc', module_id: 'co', kind: 'integration', nice: false }, { product_id: 'ariba', module_id: 'sourcing', kind: 'preferred' }] };
{ const x = await fn.handler(EV({ text: AD, lists: LISTS })); const j = JSON.parse(x.body).job; t('kind: integration rows are dropped, preferred rows become nice', j.requires.length === 2 && j.requires[0].moduleId === 'fi' && !j.requires[0].nice && j.requires[1].moduleId === 'sourcing' && j.requires[1].nice, j.requires); }
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = GOOD; await fn.handler(EV({ text: AD, lists: LISTS }));
t('the prompt: integration modules are not requirements, the ad language is not a language requirement, few specialties, inferred level is not a must',
  /touch points or integration/.test(calls.ai[0].body.system) && /language the ad is written in is NOT a requirement/.test(calls.ai[0].body.system) && /at most 4/.test(calls.ai[0].body.system) && /only infer from the duties/.test(calls.ai[0].body.system) && /configures AND leads/.test(calls.ai[0].body.system));
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
