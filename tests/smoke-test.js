// Toshi Bot smoke test v1.0 (10-11-2026). Run before EVERY push:  node tests/smoke-test.js
// Starts the app on a copy with fake data + fake Claude, opens it in a real browser and checks the key screens.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toshi-smoke-'));
execSync(`cp -a "${ROOT}/." "${tmp}/"`); fs.rmSync(path.join(tmp, '.git'), { recursive: true, force: true });
// v1.9 rev B: on the Mac, icloud/ is a LINK to the real iCloud data. Never let the test touch it.
try { if (fs.lstatSync(path.join(tmp, 'icloud')).isSymbolicLink()) fs.unlinkSync(path.join(tmp, 'icloud')); else fs.rmSync(path.join(tmp, 'icloud'), { recursive: true, force: true }); } catch {}
fs.mkdirSync(path.join(tmp, 'icloud'), { recursive: true });
if (!fs.realpathSync(path.join(tmp, 'icloud')).startsWith(fs.realpathSync(tmp))) { console.error('STOP: test data folder is not private. Not running.'); process.exit(2); }
// two disabled-by-time schedules for one bot (times far from now never fire: the test runs < 2 min) -> one compact panel line
fs.writeFileSync(path.join(tmp, 'icloud', 'schedules.json'), JSON.stringify([{ id: 's1', agent: 'linkedin-desk', task: 't', times: ['09:00'], days: [7], enabled: true }, { id: 's2', agent: 'linkedin-desk', task: 't', times: ['10:00', '09:00'], days: [7], enabled: true }]));
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
    // v1.7 search + pin
    await p.fill('#agentQ', 'linkedin'); await p.waitForTimeout(200);
    const vis = await p.locator('#side .agent[data-id]:visible').count();
    check(vis === 1 && (await p.locator('#side mark').count()) > 0, 'Agent search filters + highlights');
    await p.fill('#agentQ', 'zzzz'); await p.waitForTimeout(150); check(await p.isVisible('#side .nores'), 'Agent search: no result note');
    await p.fill('#agentQ', ''); await p.waitForTimeout(150);
    await p.click('#side .agent[data-id="linkedin-desk"]'); await p.waitForTimeout(800); await p.click('#pinBtn'); await p.waitForTimeout(900);
    check((await p.getAttribute('#side .agent[data-id]:nth-of-type(1)', 'data-id')) === 'mr-c' && (await p.locator('#side .agent[data-id]').nth(1).getAttribute('data-id')) === 'linkedin-desk' && (await p.textContent('#pinBtn')).includes('Pinned'), 'Pin moves bot to top (under Mr. C)');
    await p.click('#pinBtn'); await p.waitForTimeout(700);
    await p.click('#side .agent[data-id="mr-c"]'); await p.waitForTimeout(800);
    check((await p.textContent('#micLang')) === 'EN', 'Mic default is EN');
    // v1.8 groups
    check((await p.textContent('#side')).includes('Software Bots'), 'Default group Software Bots shows');
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'agentGroup', id: 'linkedin-desk', gid: 'grp-software-bots' }) }));
    await p.evaluate(() => loadAgents()); await p.waitForTimeout(600);
    check(await p.isHidden('#side .agent[data-id="linkedin-desk"]'), 'Bot inside a closed group is hidden');
    await p.click('#side .agent[data-grp="grp-software-bots"]'); await p.waitForTimeout(900);
    check(await p.isVisible('#side .agent[data-id="linkedin-desk"]') && (await p.textContent('#hname')) === 'Software Bots', 'Group opens + group chat selected');
    await p.fill('#inp', 'group hello'); await p.click('#sendBtn'); await p.waitForTimeout(1800);
    check((await p.textContent('#msgs')).includes('Smoke test reply: group hello'), 'Group chat send + reply works');
    await p.click('#side .agent[data-grp] .caret'); await p.waitForTimeout(300);
    check(await p.isHidden('#side .agent[data-id="linkedin-desk"]'), 'Group closes with caret');
    await p.click('#side .agent[data-id="mr-c"]'); await p.waitForTimeout(800);
    check(/v\d/.test(await p.textContent('#title')), 'Title shows version');
    await p.fill('#inp', 'hello'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    check((await p.textContent('#msgs')).includes('Smoke test reply'), 'Chat send + reply works');
    check((await p.locator('#schedPanel .sched').count()) === 1 && (await p.textContent('#schedPanel')).includes('09:00 10:00'), 'Scheduled panel: one compact line per bot');
    await p.fill('#inp', 'sessiontest'); await p.click('#sendBtn'); await p.waitForTimeout(2000);
    check((await p.textContent('#msgs')).includes('Smoke test reply:') && (await p.textContent('#msgs')).includes('sessiontest') && !(await p.textContent('#msgs')).includes('No conversation found'), 'Lost session: fresh session + retry works');
    await p.fill('#inp', 'failtest'); await p.click('#sendBtn'); await p.waitForTimeout(1500); await p.evaluate(() => loadChat()); await p.waitForTimeout(500);
    check((await p.textContent('#msgs')).includes('Could not run (code 1). Reason: Claude usage limit reached'), 'Failed run leaves a visible reason in chat');
    // v1.9 rev B: long scheduled message shows short
    await p.evaluate(() => addMsg('me', '⏰ Scheduled 19:00 IST\n' + 'LinkedIn evening desk steps '.repeat(20), 'x'));
    const lm = p.locator('#msgs .m.me').last();
    check((await lm.textContent()).length < 200 && (await lm.locator('.more').count()) === 1, 'Long scheduled message is short');
    await lm.locator('.more').click(); check((await lm.textContent()).length > 400, 'Poora dekhein shows full text');
    // v1.6 queue: type while the bot works
    await p.fill('#inp', 'slowtask one'); await p.click('#sendBtn'); await p.waitForTimeout(400);
    check(!(await p.isDisabled('#sendBtn')) && (await p.isVisible('#stopBtn')), 'Send stays open + stop button while working');
    await p.fill('#inp', 'queued two'); await p.click('#sendBtn'); await p.waitForTimeout(500);
    check((await p.isVisible('#queue')) && (await p.textContent('#queue')).includes('queued two'), 'Message goes to queue while working');
    await p.waitForTimeout(9000);
    const t = await p.textContent('#msgs');
    check(t.includes('slowtask one') && t.includes('Smoke test reply: queued two') && await p.isHidden('#queue'), 'Queued message runs after the current task');
    await p.click('#side >> text=Settings'); await p.waitForTimeout(1500);
    check(await p.inputValue('#nTopic') === 'toshi-smoke123', 'Settings: ntfy topic loads');
    check(await p.inputValue('#tmGroup') === 'Toshi Bot Team', 'Settings: Team Desk group loads');
    check((await p.inputValue('#tmMembers')).includes('Manoj'), 'Settings: team members load');
    check(await p.isChecked('#tmOn'), 'Settings: Team Desk ON loads');
    check(await p.inputValue('#dayAlert') === '60', 'Settings: daily alert loads');
    check(!(await p.isDisabled('#tmSave')), 'Settings: Save buttons enabled');
    check((await p.locator('#agentList .item').count()) >= 3, 'Settings: My agents list loads');
    check(await p.isChecked('#zohoDrafts'), 'Settings: Zoho Books drafts ON by default');
    // v1.9 order: move LinkedIn Desk up -> first after Mr. C (it is ungrouped again after group test? ensure ungrouped)
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'agentGroup', id: 'linkedin-desk', gid: '' }) }));
    for (let k = 0; k < 3; k++) { await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', id: 'linkedin-desk', dir: -1 }) })); }
    const ids = await p.evaluate(() => fetch('/api/agents').then(r => r.json()).then(l => l.map(a => a.id)));
    check(ids[0] === 'mr-c' && ids[1] === 'linkedin-desk', 'Order: Mr. C first, moved bot goes up');
    check(await p.locator('#agentList button.mv').count() >= 2, 'Settings: ▲ ▼ buttons show');
    check((await p.textContent('#groupList')).includes('Software Bots'), 'Settings: groups list loads');
    check((await p.textContent('#usageBox')).includes('₹0'), 'Settings: usage loads');
    await p.click('#tabSched'); await p.waitForTimeout(300); check(await p.isVisible('#sSave'), 'Schedules tab opens');
  } catch (e) { check(false, 'Unexpected: ' + e.message); }
  check(errs.length === 0, 'No JavaScript errors' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(bin, { recursive: true, force: true });
  if (srvErr.trim()) console.log('server stderr:', srvErr.slice(0, 300));
  console.log(fails.length ? `\nSMOKE TEST FAILED (${fails.length}) — do not push.` : '\nSMOKE TEST PASSED');
  process.exit(fails.length ? 1 : 0);
})();
