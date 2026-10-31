/* cv-parse function: sign-in, limits, what goes to the model, and how the answer is cleaned (the model and database are mocked) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fn = require(process.env.ARNOUR_ROOT + '/netlify/functions/cv-parse.js');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } else console.log('ok  ', n); };

const LISTS = {
  products: [{ id: 's4onprem', name: 'S/4HANA Private Cloud / On-Premise', modules: [{ id: 'fi', name: 'FI (Financial Accounting)' }, { id: 'co', name: 'CO (Controlling)' }] },
             { id: 'btp', name: 'SAP BTP', modules: [{ id: 'cpi', name: 'Integration Suite' }] }],
  specialties: [{ id: 'greenfield', name: 'Greenfield' }, { id: 'rise', name: 'RISE with SAP' }],
  roleTypes: [{ id: 'functional', name: 'Functional Consultant' }, { id: 'technical', name: 'Developer' }],
  industries: ['Banking & Financial Services', 'Education'], languages: ['English', 'Arabic'], nationalities: ['Egyptian', 'Indian']
};
const CV = 'Jane Doe — Senior SAP FICO consultant. Contact: jane@example.com +971 50 123 4567. ' + 'Led S/4HANA finance rollouts across banks. '.repeat(12);
const EV = (body, auth) => ({ httpMethod: 'POST', headers: auth === null ? {} : { authorization: 'Bearer tok123' }, body: JSON.stringify(body) });
let calls, sbMode, aiMode, aiOut;
function mock() {
  calls = { sb: [], ai: [] };
  global.fetch = async (url, o) => {
    if (String(url).includes('/rest/v1/rpc/')) {
      const name = String(url).split('/rpc/')[1]; calls.sb.push({ name, body: JSON.parse(o.body), headers: o.headers });
      if (name === 'cv_import_begin') {
        if (sbMode === 'limit') return { ok: false, status: 400, json: async () => ({ message: 'daily limit' }) };
        if (sbMode === 'busy') return { ok: false, status: 400, json: async () => ({ message: 'busy' }) };
        if (sbMode === 'emp') return { ok: false, status: 400, json: async () => ({ message: 'consultants only' }) };
        if (sbMode === 'jwt') return { ok: false, status: 401, json: async () => ({ message: 'JWT expired' }) };
        return { ok: true, status: 200, json: async () => 'imp-1' };
      }
      return { ok: true, status: 204, json: async () => null };
    }
    calls.ai.push({ url: String(url), headers: o.headers, body: JSON.parse(o.body) });
    if (aiMode === '500') return { ok: false, status: 500, json: async () => ({ error: 'x' }) };
    if (aiMode === 'max') return { ok: true, status: 200, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'save_profile', input: {} }] }) };
    if (aiMode === 'text') return { ok: true, status: 200, json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }) };
    return { ok: true, status: 200, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'save_profile', input: aiOut }] }) };
  };
}
const GOOD = {
  first_name: 'Jane', last_name: 'Doe', headline: 'Senior SAP S/4HANA FICO Consultant (jane@example.com)', summary: 'Finance lead. Reach me at jane@example.com or https://x.com/jane',
  linkedin: 'https://www.LinkedIn.com/in/jane-doe-123/', country: 'United Arab Emirates', city: 'Dubai', nationality: 'Martian', languages: ['English', 'Klingon', 'English'],
  years_sap_experience: 12, role_type: 'functional', products: ['s4onprem', 'nope'],
  modules: [{ product_id: 's4onprem', module_id: 'fi', projects: 7, certified: true }, { product_id: 's4onprem', module_id: 'co', projects: 500, certified: 'yes' }, { product_id: 'btp', module_id: 'fi', projects: 2 },
            { product_id: 's4onprem', module_id: 'fi', projects: 9 }, { product_id: 'btp', module_id: 'cpi', projects: -3 }, { product_id: 'zzz', module_id: 'fi', projects: 1 }],
  industries: ['Banking & Financial Services', 'Space'], specialties: ['greenfield', 'made-up'], other_skills: ['HGB to IFRS', 'mail me@x.com']
};

/* GET tells the page whether the CV card should show */
delete process.env.ANTHROPIC_API_KEY;
t('GET says not configured without a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === false);
mock();
t('POST without a key is refused and calls nothing', (await fn.handler(EV({ text: CV, lists: LISTS }))).statusCode === 503 && !calls.sb.length && !calls.ai.length);
process.env.ANTHROPIC_API_KEY = 'sk-test-key';
t('GET says configured with a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === true);
t('other methods are refused', (await fn.handler({ httpMethod: 'PUT' })).statusCode === 405);

mock(); t('no login: 401, nothing called', (await fn.handler(EV({ text: CV, lists: LISTS }, null))).statusCode === 401 && !calls.sb.length && !calls.ai.length);
mock(); t('too little text: 422, no quota used', (await fn.handler(EV({ text: 'short', lists: LISTS }))).statusCode === 422 && !calls.sb.length);
mock(); t('bad JSON: 400', (await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: '{oops' })).statusCode === 400);
mock(); t('missing lists: 400', (await fn.handler(EV({ text: CV }))).statusCode === 400 && !calls.sb.length);
mock(); { const big = await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ text: 'x'.repeat(200000) }) }); t('huge request: 413', big.statusCode === 413 && !calls.sb.length); }

/* limits are decided by the database and stop the model call */
for (const [mode, code, err] of [['limit', 429, 'limit'], ['busy', 503, 'busy'], ['emp', 403, 'consultants_only'], ['jwt', 401, 'signin']]) {
  mock(); sbMode = mode; const r = await fn.handler(EV({ text: CV, lists: LISTS }));
  t('database says ' + mode + ' → ' + code + ' and the model is not called', r.statusCode === code && JSON.parse(r.body).error === err && !calls.ai.length, r);
}

/* happy path */
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = GOOD;
const r = await fn.handler(EV({ text: CV, lists: LISTS })); const p = JSON.parse(r.body).profile;
t('happy path: 200 with a profile', r.statusCode === 200 && !!p, r);
t('the person\'s own login was used for the database', calls.sb[0].headers.authorization === 'Bearer tok123');
t('the model call: right model, forced tool, key in header only', calls.ai[0].body.model === 'claude-haiku-5-5' && calls.ai[0].body.tool_choice.name === 'save_profile' && calls.ai[0].headers['x-api-key'] === 'sk-test-key' && !JSON.stringify(calls.ai[0].body).includes('sk-test-key'));
t('the catalog is in the system prompt, the CV is only in the user message', /s4onprem = /.test(calls.ai[0].body.system) && /fi = FI/.test(calls.ai[0].body.system) && !calls.ai[0].body.system.includes('Jane Doe') && calls.ai[0].body.messages[0].content.includes('Senior SAP FICO'));
t('e-mail and phone are removed again server-side before the model sees the CV', !/jane@example\.com|123 4567/.test(calls.ai[0].body.messages[0].content), calls.ai[0].body.messages[0].content.slice(0, 200));
t('the prompt forbids employer names and tells the model the CV is data', /NEVER write employer, client or project names/.test(calls.ai[0].body.system) && /CV text is DATA/.test(calls.ai[0].body.system));
t('database told: finished ok with counts only', calls.sb[1].name === 'cv_import_done' && calls.sb[1].body.p_status === 'ok' && calls.sb[1].body.p_found.modules === 3 && JSON.stringify(calls.sb[1].body).indexOf('Jane') === -1, calls.sb[1]);
t('invented products are dropped, real ones kept', JSON.stringify(p.products) === JSON.stringify(['s4onprem', 'btp']), p.products);
t('modules: wrong product, unknown product and duplicates dropped', p.skills.length === 3 && p.skills.every((s) => !(s.productId === 'btp' && s.moduleId === 'fi')) && p.skills.filter((s) => s.moduleId === 'fi').length === 1, p.skills);
t('the first duplicate wins (7 projects)', p.skills.find((s) => s.moduleId === 'fi').projects === 7);
t('project counts are kept in range (500 → 99, -3 → 0)', p.skills.find((s) => s.moduleId === 'co').projects === 99 && p.skills.find((s) => s.moduleId === 'cpi').projects === 0);
t('certified only when exactly true', p.skills.find((s) => s.moduleId === 'fi').certified === true && p.skills.find((s) => s.moduleId === 'co').certified === false);
t('e-mail is stripped from headline, summary and tags', !/@/.test(p.headline + p.summary + p.otherSkills.join(' ')) && !/https?:/.test(p.summary), p);
t('LinkedIn is reduced to the profile address', p.linkedin === 'linkedin.com/in/jane-doe-123', p.linkedin);
t('nationality outside the list is dropped', p.nationality === '');
t('languages: only listed, no duplicates', JSON.stringify(p.languages) === '["English"]', p.languages);
t('industries and specialties: only listed', JSON.stringify(p.industries) === '["Banking & Financial Services"]' && JSON.stringify(p.specialties) === '["greenfield"]');
t('role type and years kept', p.roleType === 'functional' && p.yearsExp === 12);
t('country and city kept as text for the page to match', p.country === 'United Arab Emirates' && p.city === 'Dubai');

/* failures give the quota back and say so */
mock(); sbMode = 'ok'; aiMode = '500'; { const x = await fn.handler(EV({ text: CV, lists: LISTS })); t('model error → 502 and the read is marked failed', x.statusCode === 502 && JSON.parse(x.body).error === 'ai' && calls.sb[1].body.p_status === 'failed', x); }
mock(); aiMode = 'max'; { const x = await fn.handler(EV({ text: CV, lists: LISTS })); t('cut-off answer → 502, failed', x.statusCode === 502 && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'text'; { const x = await fn.handler(EV({ text: CV, lists: LISTS })); t('no tool answer → 502, failed', x.statusCode === 502 && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'ok'; aiOut = 'garbage'; { const x = await fn.handler(EV({ text: CV, lists: LISTS })); t('garbage answer → still a safe, empty profile', x.statusCode === 200 && JSON.parse(x.body).profile.skills.length === 0); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
