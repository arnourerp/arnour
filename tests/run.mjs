/* Arnour test runner: starts two local servers (live config + demo copy), runs every suite, fails on any failure.
   Usage: node tests/run.mjs            (from the repo root or the tests folder) */
import http from 'http'; import fs from 'fs'; import path from 'path'; import os from 'os';
import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const TESTS = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(TESTS, '..');
const DEMO = fs.mkdtempSync(path.join(os.tmpdir(), 'arnour-demo-'));
const SKIP = new Set(['tests', '.git', 'node_modules', '.github']);
(function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(ROOT, DEMO);
fs.copyFileSync(path.join(TESTS, 'fixtures', 'demo_config.js'), path.join(DEMO, 'js', 'config.js'));

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serve(dir, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('not found'); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    }).listen(port, () => res(srv));
  });
}
const PORT_LIVE = 8123, PORT_DEMO = 8124;
const servers = [await serve(ROOT, PORT_LIVE), await serve(DEMO, PORT_DEMO)];

const SQL = ['access_test', 'sqltest', 'sqltest2', 'sqltest3', 'notif_test', 'gender_test', 'applyurl_test', 'exttest', 'fbtest', 'rates_api_test', 'anon_notif_test', 'msgtest', 'emailtest', 'match_model', 'pipeline_test', 'catalog_test', 'lists_test', 'announce_test', 'admin_hidden_test'];
const UI = ['seo_test', 'access_ui', 'e2e', 'e2e2', 'e2e3', 'e2e4', 'nav4', 'roles_test', 'rates_off', 'extapply', 'coedit', 'skills_block', 'exttest_ui', 'longtext', 'fbui', 'fbmenu_live', 'poll_test', 'longwrap', 'polish_test', 'captcha_test', 'anon_preview', 'lead_wizard', 'job_lead', 'job_status', 'msg_ui', 'edit_cancel', 'attn_test', 'peer_profile', 'people_test', 'email_ui', 'nav_back', 'samples_toggle', 'session_lost', 'oauth_test', 'search_test', 'pipeline_ui', 'catalog_ui', 'lists_ui', 'announce_ui', 'profile_ui', 'admin_ux'];
const only = process.argv.slice(2);
const list = (only.length ? only : SQL.concat(UI));
const env = Object.assign({}, process.env, { ARNOUR_ROOT: ROOT, ARNOUR_DEMO: DEMO, ARNOUR_TESTS: TESTS, PORT_LIVE: String(PORT_LIVE), PORT_DEMO: String(PORT_DEMO) });
const results = [];
for (const name of list) {
  const t0 = Date.now();
  const out = await new Promise((res) => {
    let buf = '';
    const ch = spawn(process.execPath, [path.join(TESTS, name + '.mjs')], { cwd: TESTS, env });
    const kill = setTimeout(() => { buf += '\nTIMEOUT'; ch.kill('SIGKILL'); }, 300000);
    ch.stdout.on('data', (d) => { buf += d; }); ch.stderr.on('data', (d) => { buf += d; });
    ch.on('close', (code) => { clearTimeout(kill); res({ code, buf }); });
  });
  const failLines = out.buf.split('\n').filter((l) => /^FAIL\b|FAILURES|FAILS \d|TIMEOUT|PAGEERR|Error:|triggerUncaughtException/.test(l));
  const ok = out.code === 0 && failLines.length === 0;
  results.push({ name, ok, secs: Math.round((Date.now() - t0) / 1000) });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' (' + results[results.length - 1].secs + 's)');
  if (!ok) console.log(out.buf.split('\n').slice(-40).join('\n'));
  if (!ok && process.env.GITHUB_ACTIONS) console.log('::error title=' + name + '::' + out.buf.split('\n').filter((l) => /FAIL|Error|TIMEOUT|PAGEERR/.test(l)).slice(0, 6).join(' ## ').replace(/[\r\n%]/g, ' ').slice(0, 900));
}
servers.forEach((s) => s.close()); fs.rmSync(DEMO, { recursive: true, force: true });
const bad = results.filter((r) => !r.ok);
console.log('\n' + (bad.length ? bad.length + ' suite(s) failed: ' + bad.map((r) => r.name).join(', ') : 'ALL ' + results.length + ' SUITES PASSED'));
process.exit(bad.length ? 1 : 0);
