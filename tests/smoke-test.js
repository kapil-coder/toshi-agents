// Toshi Bot smoke test v1.0 (10-11-2026). Run before EVERY push:  node tests/smoke-test.js
// Starts the app on a copy with fake data + fake Claude, opens it in a real browser and checks the key screens.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toshi-smoke-'));
execSync(`cp -a "${ROOT}/." "${tmp}/"`); fs.rmSync(path.join(tmp, '.git'), { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, 'icloud'), { recursive: true });
const fixture = { ntfyTopic: 'toshi-smoke123', notify: true, autoSend: true, dailyAlertRuns: 60,
  team: { enabled: true, group: 'Toshi Bot Team', trigger: '@Toshi', members: 'Manoj, 9315950722\nBobby, 9315950739', topics: 'Order status', interval: 120, model: 'sonnet',
    refreshOn: true, refreshTimes: '08:00', refreshAgent: 'mr-c', sources: 'Zoho', lastRefresh: 'x' } };
fs.writeFileSync(path.join(tmp, 'icloud', 'app-settings.json'), JSON.stringify(fixture));
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'toshi-bin-')); fs.copyFileSync(path.join(ROOT, 'tests', 'fake-claude.sh'), path.join(bin, 'claude')); fs.chmodSync(path.join(bin, 'claude'), 0o755);
const PORT = 3990 + Math.floor(Math.random() * 9);
const srv = spawn('node', ['chat-app/server.js'], { cwd: tmp, env: { ...process.env, PORT: String(PORT), PATH: bin + ':' + process.env.PATH, HOME: tmp } });
let srvErr = ''; srv.stderr.on('data', d => srvErr += d);
const fails = []; const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails.push(what); };
(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  try {
    await p.goto(`http://localhost:${PORT}`); await p.waitForTimeout(1000);
    check((await p.locator('#side .agent').count()) >= 3, 'Sidebar shows agents');
    check(/v\d/.test(await p.textContent('#title')), 'Title shows version');
    await p.fill('#inp', 'hello'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    check((await p.textContent('#msgs')).includes('Smoke test reply'), 'Chat send + reply works');
    await p.click('#side >> text=Settings'); await p.waitForTimeout(1500);
    check(await p.inputValue('#nTopic') === 'toshi-smoke123', 'Settings: ntfy topic loads');
    check(await p.inputValue('#tmGroup') === 'Toshi Bot Team', 'Settings: Team Desk group loads');
    check((await p.inputValue('#tmMembers')).includes('Manoj'), 'Settings: team members load');
    check(await p.isChecked('#tmOn'), 'Settings: Team Desk ON loads');
    check(await p.inputValue('#dayAlert') === '60', 'Settings: daily alert loads');
    check(!(await p.isDisabled('#tmSave')), 'Settings: Save buttons enabled');
    check((await p.locator('#agentList .item').count()) >= 3, 'Settings: My agents list loads');
    check((await p.textContent('#usageBox')).includes('₹0'), 'Settings: usage loads');
    await p.click('#tabSched'); await p.waitForTimeout(300); check(await p.isVisible('#sSave'), 'Schedules tab opens');
  } catch (e) { check(false, 'Unexpected: ' + e.message); }
  check(errs.length === 0, 'No JavaScript errors' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(bin, { recursive: true, force: true });
  if (srvErr.trim()) console.log('server stderr:', srvErr.slice(0, 300));
  console.log(fails.length ? `\nSMOKE TEST FAILED (${fails.length}) — do not push.` : '\nSMOKE TEST PASSED');
  process.exit(fails.length ? 1 : 0);
})();
