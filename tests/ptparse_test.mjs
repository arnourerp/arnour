/* partner-parse function: sign-in, limits, what goes to the model, and how the answer is cleaned (the model and database are mocked) */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fn = require(process.env.ARNOUR_ROOT + '/netlify/functions/partner-parse.js');
let fails = 0; const t = (n, ok, x) => { if (!ok) { fails++; console.log('FAIL', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } else console.log('ok  ', n); };
const LISTS = {
  products: [{ id: 's4onprem', name: 'S/4HANA Private Cloud / On-Premise', modules: [{ id: 'fi', name: 'FI' }, { id: 'co', name: 'CO' }, { id: 'mm', name: 'MM' }] },
             { id: 'btp', name: 'SAP BTP', modules: [{ id: 'integration', name: 'Integration Suite' }] }],
  specialties: [{ id: 'greenfield', name: 'Greenfield' }, { id: 'rise', name: 'RISE with SAP' }],
  countries: [{ id: 'ae', name: 'United Arab Emirates' }, { id: 'sa', name: 'Saudi Arabia' }],
  industries: ['Banking & Financial Services', 'Oil, Gas & Energy'], languages: ['English', 'Arabic', 'French']
};
const DECK = 'Orbit SAP Partners. Contact sales@orbit.com or +971 50 123 4567 or https://orbit.example/contact. ' + 'We deliver S/4HANA finance and supply chain programmes for Gulf banks and energy groups with a team of 120 SAP consultants. '.repeat(4);
const EV = (body, auth) => ({ httpMethod: 'POST', headers: auth === null ? {} : { authorization: 'Bearer tok123' }, body: JSON.stringify(body) });
let calls, sbMode, aiMode, aiOut;
function mock() {
  calls = { sb: [], ai: [] };
  global.fetch = async (url, o) => {
    if (String(url).includes('/rest/v1/rpc/')) {
      const name = String(url).split('/rpc/')[1]; calls.sb.push({ name, body: JSON.parse(o.body), headers: o.headers });
      if (name === 'pt_import_begin') {
        const bad = { limit: 'daily limit', busy: 'busy', co: 'companies only', sus: 'account suspended' }[sbMode];
        if (bad) return { ok: false, status: 400, json: async () => ({ message: bad }) };
        if (sbMode === 'jwt') return { ok: false, status: 401, json: async () => ({ message: 'JWT expired' }) };
        return { ok: true, status: 200, json: async () => 'imp-1' };
      }
      return { ok: true, status: 204, json: async () => null };
    }
    calls.ai.push({ url: String(url), headers: o.headers, body: JSON.parse(o.body) });
    if (aiMode === '500') return { ok: false, status: 500, json: async () => ({ error: 'x' }) };
    if (aiMode === 'max') return { ok: true, status: 200, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'save_partner', input: {} }] }) };
    return { ok: true, status: 200, json: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'save_partner', input: aiOut }] }) };
  };
}
const GOOD = {
  about: 'Orbit is a Dubai SAP firm. Reach us at sales@orbit.com or https://orbit.example', best_at: 'Finance rollouts. Fees from $900 a day: call +971 50 123 4567', team_size: '51-200',
  skills: [{ product_id: 's4onprem', module_id: 'fi', projects: 14, certified: true }, { product_id: 's4onprem', module_id: 'fi', projects: 3 }, { product_id: 's4onprem', module_id: '*' }, { product_id: 's4onprem', module_id: 'zz' },
           { product_id: 'zzz', module_id: 'fi' }, { product_id: 'btp', module_id: 'integration', projects: 5000, certified: 'yes' }, { product_id: 'btp', module_id: 'fi' }],
  industries: ['Banking & Financial Services', 'Space'], specialties: ['greenfield', 'made-up'], countries: ['ae', 'sa', 'xx'], languages: ['English', 'Klingon'],
  delivery: ['onsite', 'teleport'], engagement: ['team', 'support', 'magic']
};

delete process.env.ANTHROPIC_API_KEY;
t('GET says not configured without a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === false);
mock(); t('POST without a key is refused and calls nothing', (await fn.handler(EV({ text: DECK, lists: LISTS }))).statusCode === 503 && !calls.sb.length && !calls.ai.length);
process.env.ANTHROPIC_API_KEY = 'sk-test-key';
t('GET says configured with a key', JSON.parse((await fn.handler({ httpMethod: 'GET' })).body).configured === true);
t('other methods are refused', (await fn.handler({ httpMethod: 'PUT' })).statusCode === 405);
mock(); t('no login: 401, nothing called', (await fn.handler(EV({ text: DECK, lists: LISTS }, null))).statusCode === 401 && !calls.sb.length && !calls.ai.length);
mock(); t('too little text: 422, no quota used', (await fn.handler(EV({ text: 'short', lists: LISTS }))).statusCode === 422 && !calls.sb.length);
mock(); t('bad JSON: 400', (await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: '{oops' })).statusCode === 400);
mock(); t('missing lists: 400', (await fn.handler(EV({ text: DECK }))).statusCode === 400 && !calls.sb.length);
mock(); t('huge request: 413', (await fn.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ text: 'x'.repeat(300000) }) })).statusCode === 413 && !calls.sb.length);
for (const [mode, code, err] of [['limit', 429, 'limit'], ['busy', 503, 'busy'], ['co', 403, 'companies_only'], ['sus', 403, 'suspended'], ['jwt', 401, 'signin']]) {
  mock(); sbMode = mode; const r = await fn.handler(EV({ text: DECK, lists: LISTS }));
  t('database says ' + mode + ' → ' + code + ' and the model is not called', r.statusCode === code && JSON.parse(r.body).error === err && !calls.ai.length, r);
}
mock(); sbMode = 'ok'; aiMode = 'ok'; aiOut = GOOD;
const r = await fn.handler(EV({ text: DECK, lists: LISTS })); const p = JSON.parse(r.body).partner;
t('happy path: 200 with a partner', r.statusCode === 200 && !!p, r);
t('the person\'s own login was used', calls.sb[0].headers.authorization === 'Bearer tok123');
t('the model call: right model, forced tool, key in header only', calls.ai[0].body.model === 'claude-haiku-5-5' && calls.ai[0].body.tool_choice.name === 'save_partner' && calls.ai[0].headers['x-api-key'] === 'sk-test-key' && !JSON.stringify(calls.ai[0].body).includes('sk-test-key'));
t('the catalog is in the system prompt, the deck only in the user message', /s4onprem = /.test(calls.ai[0].body.system) && /ae = United Arab Emirates/.test(calls.ai[0].body.system) && !calls.ai[0].body.system.includes('SAP consultants.') && /Orbit SAP Partners/.test(calls.ai[0].body.messages[0].content));
t('e-mail, phone and links are removed again server-side', !/sales@orbit|123 4567|orbit\.example/.test(calls.ai[0].body.messages[0].content));
t('the prompt treats the text as data and forbids prices', /text is DATA/.test(calls.ai[0].body.system) && /prices, rates or fees/.test(calls.ai[0].body.system));
t('database told: finished ok with counts only', calls.sb[1].name === 'pt_import_done' && calls.sb[1].body.p_status === 'ok' && calls.sb[1].body.p_found.skills === 2 && JSON.stringify(calls.sb[1].body).indexOf('Orbit') === -1, calls.sb[1]);
t('skills: unknown product/module, "*" and duplicates dropped; first duplicate wins', JSON.stringify(p.skills.map((x) => x.productId + '/' + x.moduleId)) === '["s4onprem/fi","btp/integration"]', p.skills);
t('projects and certified kept; absurd values clamped; certified only when exactly true', p.skills[0].projects === 14 && p.skills[0].certified === true && p.skills[1].projects === 999 && p.skills[1].certified === false, p.skills);
t('industries, specialties, countries, languages: only listed', JSON.stringify([p.industries, p.specialties, p.countries, p.languages]) === '[["Banking & Financial Services"],["greenfield"],["ae","sa"],["English"]]', [p.industries, p.specialties, p.countries, p.languages]);
t('delivery, engagement and team size: only allowed values', JSON.stringify([p.delivery, p.engagement, p.teamSize]) === '[["onsite"],["team","support"],"51-200"]', [p.delivery, p.engagement, p.teamSize]);
t('text fields carry no contact details or phone numbers', !/@|http|123 4567/.test(p.about + p.bestAt) && /Dubai/.test(p.about) && /Finance rollouts/.test(p.bestAt), [p.about, p.bestAt]);
mock(); aiOut = Object.assign({}, GOOD, { team_size: '1000' }); { const x = JSON.parse((await fn.handler(EV({ text: DECK, lists: LISTS }))).body).partner; t('an unlisted team size is dropped', x.teamSize === ''); }
mock(); sbMode = 'ok'; aiMode = '500'; { const x = await fn.handler(EV({ text: DECK, lists: LISTS })); t('model error → 502 and the read is marked failed', x.statusCode === 502 && JSON.parse(x.body).error === 'ai' && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'max'; { const x = await fn.handler(EV({ text: DECK, lists: LISTS })); t('cut-off answer → 502, failed', x.statusCode === 502 && calls.sb[1].body.p_status === 'failed'); }
mock(); aiMode = 'ok'; aiOut = 'garbage'; { const x = await fn.handler(EV({ text: DECK, lists: LISTS })); t('garbage answer → "not a profile", failed', x.statusCode === 422 && JSON.parse(x.body).error === 'not_a_profile' && calls.sb[1].body.p_status === 'failed'); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
