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
{ // v2.4 weekly usage fixture (now, IST)
  const st = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  const d = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const row = (agent, kind, tok) => JSON.stringify({ d, t: st, agent, kind, usd: 0, turns: 1, ms: 1, inTok: tok, outTok: 0 });
  fs.writeFileSync(path.join(tmp, 'icloud', 'usage.jsonl'), [row('mr-c', 'chat', 600), row('linkedin-desk', 'schedule', 200), row('linkedin-desk', 'handoff', 100), row('mr-c', 'team', 100)].join('\n') + '\n');
}
const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'toshi-bin-')); fs.copyFileSync(path.join(ROOT, 'tests', 'fake-claude.sh'), path.join(bin, 'claude')); fs.chmodSync(path.join(bin, 'claude'), 0o755);
const PORT = 3990 + Math.floor(Math.random() * 9);
const srv = spawn('node', ['chat-app/server.js'], { cwd: tmp, env: { ...process.env, PORT: String(PORT), PATH: bin + ':' + process.env.PATH, HOME: tmp, TOSHI_WATCH_MS: '2000', TOSHI_TEST_LOGIN: 'kapil@test.in' } });
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
    // v2.3 rev B: a fake saved session ("t1") is dropped before the run (fixes LinkedIn Bot 13-11 error)
    await p.evaluate(() => fetch('/api/chat?agent=mr-c').then(r => r.json()));
    require('fs').writeFileSync(require('path').join(tmp, 'icloud', 'chats', 'investor-desk.json'), JSON.stringify({ sessionId: 't1', messages: [] }));
    const r1 = await p.evaluate(() => fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'investor-desk', message: 'resumecheck' }) }).then(r => r.text()));
    check(r1.includes('Smoke test reply') && !r1.includes('requires a valid session'), 'Bad saved session "t1" is dropped, run works');
    // v2.0 memory
    await p.fill('#inp', 'yaadtest'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    const mt = await p.textContent('#msgs');
    check(mt.includes('🧠 Saved to') && mt.includes('shared memory (all bots): Saurabh') && !mt.includes('MEMORY+'), 'Memory: yaad rakho saves (own + shared)');
    await p.fill('#inp', 'memcheck'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    check((await p.textContent('#msgs')).includes('memory seen yes'), 'Memory: next run gets the memory');
    await p.fill('#inp', 'failtest'); await p.click('#sendBtn'); await p.waitForTimeout(1500); await p.evaluate(() => loadChat()); await p.waitForTimeout(500);
    check((await p.locator('#msgs .redo').count()) >= 1, 'Failed run shows ↻ Dobara chalao');
    // v2.5 voice: speechSynthesis stub records what is spoken
    await p.evaluate(() => { window.__spoken = []; speechSynthesis.speak = u => window.__spoken.push(u.text); speechSynthesis.cancel = () => {}; });
    check(await p.isVisible('#vbar'), 'Voice bar shows');
    const lb = p.locator('#msgs .m.bot').last(); await lb.locator('.acts button.spk').click(); await p.waitForTimeout(200);
    check(await p.evaluate(() => window.__spoken.join(' ').length > 0 && !/\*\*|https?:/.test(window.__spoken.join(' '))), '🔊 Suno speaks clean text');
    await p.click('#vAuto'); await p.evaluate(() => { window.__spoken = []; });
    await p.fill('#inp', 'voicetest'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    check(await p.evaluate(() => window.__spoken.join(' ').includes('voicetest')), 'Auto voice speaks the new reply');
    await p.click('#vAuto');
    // v2.7 bot-made schedule: card in chat + side panel + edit + delete
    await p.fill('#inp', 'schedtest'); await p.click('#sendBtn'); await p.waitForTimeout(1800);
    const sc = await p.evaluate(() => fetch('/api/schedules').then(r => r.json()).then(l => l.find(x => x.byBot && x.agent === 'mr-c')));
    check(sc && sc.times.join() === '09:30,10:10' && sc.days.join() === '1,2,3,4,5,6', 'Bot schedule saved (09:30, 10:10, Mon-Sat)');
    await p.waitForTimeout(500);
    check((await p.locator('#msgs .scard .sbtns button').count()) === 4 && !(await p.textContent('#msgs')).includes('[s:'), 'Schedule card with Edit / Pause / Delete / Run');
    check((await p.textContent('#botSched')).includes('09:30 10:10'), 'Side panel shows this bot\'s schedule');
    await p.evaluate(id => fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id, times: '09:45', task: 'edited', days: [1] }) }), sc.id);
    const sc2 = await p.evaluate(id => fetch('/api/schedules').then(r => r.json()).then(l => l.find(x => x.id === id)), sc.id);
    check(sc2.times.join() === '09:45' && sc2.task === 'edited', 'Schedule edit works');
    await p.evaluate(id => fetch('/api/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) }), sc.id);
    // v2.7 rev C: remove an attached file before sending
    await p.evaluate(() => { attached = [{ name: 'a.xlsx', path: 'x/a.xlsx' }, { name: 'b.xlsm', path: 'x/b.xlsm' }]; showFiles(); });
    await p.locator('#files .file .fx').first().click(); await p.waitForTimeout(100);
    check((await p.locator('#files .file').count()) === 1 && (await p.textContent('#files')).includes('b.xlsm'), 'Attachment ✕ removes one file');
    await p.evaluate(() => { attached = []; showFiles(); });
    // v2.1 actions
    await p.fill('#inp', 'codetest'); await p.click('#sendBtn'); await p.waitForTimeout(1500);
    const lastBot = p.locator('#msgs .m.bot').last();
    check((await lastBot.locator('pre.cb .cbcopy').count()) === 1 && (await lastBot.locator('.acts button').count()) >= 4, 'Reply has 📋 Copy (box + whole), 👍 👎, Retry');
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await lastBot.locator('pre.cb .cbcopy').click(); await p.waitForTimeout(300);
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check(clip === 'POINT SIX TEXT', 'Box copy gives only the box text');
    await lastBot.locator('.acts button', { hasText: '👎' }).click(); await lastBot.locator('.fb input[type=text]').fill('GST alag nahi dikhaya'); await lastBot.locator('.fb button').click(); await p.waitForTimeout(600);
    check((await lastBot.textContent()).includes('Lesson saved to memory'), '👎 with reason saves a lesson to memory');
    await p.evaluate(() => loadChat()); await p.waitForTimeout(500);
    check(await p.locator('#msgs .m.bot').last().locator('.acts button.on').count() === 1, 'Vote stays after reload');
    await p.fill('#inp', 'sessiontest'); await p.click('#sendBtn'); await p.waitForTimeout(2000);
    check((await p.textContent('#msgs')).includes('Smoke test reply:') && (await p.textContent('#msgs')).includes('sessiontest') && !(await p.textContent('#msgs')).includes('No conversation found'), 'Lost session: fresh session + retry works');
    await p.fill('#inp', 'failtest'); await p.click('#sendBtn'); await p.waitForTimeout(1500); await p.evaluate(() => loadChat()); await p.waitForTimeout(500);
    check((await p.textContent('#msgs')).includes('Could not run (code 1). Reason: Claude usage limit reached'), 'Failed run leaves a visible reason in chat');
    // v2.2 bot-to-bot badge (Mr. C hands work to LinkedIn Desk while Kapil is in Mr. C)
    await p.click('#side .agent[data-id="mr-c"]'); await p.waitForTimeout(500);
    await p.evaluate(() => fetch('/api/handoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'mr-c', to: 'linkedin-desk', msg: 'Kapil\'s request (via Mr. C): check Haldiram lead', hop: 0 }) }));
    await p.waitForTimeout(2500); await p.evaluate(() => loadAgentsQuiet()); await p.waitForTimeout(600);
    const li = p.locator('#side .agent[data-id="linkedin-desk"]');
    check((await li.locator('.bbadge').count()) === 1 && (await li.textContent()).includes('📨 From Mr. C: check Haldiram lead') && (await li.locator('.udot').count()) === 1, 'Handoff shows 🤖 badge + "From" preview + blue dot');
    await p.evaluate(() => selectChat('linkedin-desk')); await p.waitForTimeout(800); await p.evaluate(() => selectChat('mr-c')); await p.waitForTimeout(800);
    check((await p.locator('#side .agent[data-id="linkedin-desk"] .bbadge').count()) === 0, 'Badge goes after opening the bot');
    // v2.3 watch mode: 'nothing new' leaves no trace
    const before = await p.evaluate(() => fetch('/api/chat?agent=investor-desk').then(r => r.json()).then(d => d.messages.length));
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'watch', id: 'investor-desk', cfg: { on: true, every: 10, from: '00:00', to: '23:59', days: [0,1,2,3,4,5,6], gmail: true, summary: '' } }) }));
    await p.waitForTimeout(6000);
    const wst = await p.evaluate(() => fetch('/api/settings').then(r => r.json()).then(s => s.watch['investor-desk']));
    const after = await p.evaluate(() => fetch('/api/chat?agent=investor-desk').then(r => r.json()).then(d => d.messages.length));
    check(wst.lastRun > 0 && after === before, 'Watch mode ran; NO_NEW left no trace in chat');
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'watch', id: 'investor-desk', cfg: { on: false } }) }));
    // v2.6 Mac screen control: request goes with mac:true (on Linux test machine it answers 'Mac mini only')
    const mr = await p.evaluate(() => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'mr-c', mac: true, type: 'click', x: .5, y: .5 }) }).then(r => r.json()));
    check(/Mac mini only/.test(mr.error || ''), 'Mac screen control routes to Mac control');
    // v2.8 guest access (test header stands in for the Tailscale login)
    const H = l => ({ 'Content-Type': 'application/json', 'x-test-login': l });
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guestAdd', name: 'Ritvik', login: 'ritvik@test.in', bots: ['linkedin-desk'], until: '2099-12-31' }) }));
    const gA = await p.evaluate(h => fetch('/api/agents', { headers: h }).then(r => r.json()), H('ritvik@test.in'));
    check(gA.length === 1 && gA[0].id === 'linkedin-desk', 'Guest sees only their bot');
    const gS = await p.evaluate(h => fetch('/api/settings', { headers: h }).then(r => r.status), H('ritvik@test.in'));
    const gC = await p.evaluate(h => fetch('/api/chat?agent=mr-c', { headers: h }).then(r => r.status), H('ritvik@test.in'));
    const gX = await p.evaluate(h => fetch('/api/agents', { headers: h }).then(r => r.status), H('stranger@test.in'));
    const gO = await p.evaluate(h => fetch('/api/settings', { headers: h }).then(r => r.status), H('kapil@test.in'));
    check(gS === 403 && gC === 403 && gX === 403 && gO === 200, 'Guest blocked from Settings / other bots; stranger blocked; owner OK');
    const wi = await p.evaluate(h => fetch('/api/whoami', { headers: h }).then(r => r.json()), H('ritvik@test.in'));
    check(wi.role === 'guest' && wi.name === 'Ritvik', 'whoami shows guest');
    const gctx = await b.newContext({ viewport: { width: 1200, height: 900 }, extraHTTPHeaders: { 'x-test-login': 'ritvik@test.in' } }); const gp = await gctx.newPage();
    await gp.goto(`http://localhost:${PORT}`); await gp.waitForTimeout(1200);
    check((await gp.locator('#side .agent[data-id]').count()) === 1 && !(await gp.isVisible('#sideSet')) && !(await gp.isVisible('#liveBtn')) && (await gp.textContent('body')).includes('Guest: Ritvik'), 'Guest screen: one bot, no Settings / Live');
    // v2.9 rev B: Kapil's message must show as Kapil on the guest screen
    await p.evaluate(() => fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'linkedin-desk', message: 'owner note' }) }).then(r => r.text()));
    await gp.evaluate(() => loadChat()); await gp.waitForTimeout(500);
    const lab = await gp.evaluate(() => [...document.querySelectorAll('#msgs .m.me')].map(m => (m.querySelector('.byl') || {}).textContent + '|' + m.textContent).filter(t => t.includes('owner note')).pop() || '');
    check(lab.startsWith('Kapil|'), 'Guest screen labels Kapil\'s message as Kapil');
    await gp.fill('#inp', 'guest hello'); await gp.click('#sendBtn'); await gp.waitForTimeout(1800); await gp.evaluate(() => loadChat()); await gp.waitForTimeout(400);
    const lc = await p.evaluate(() => fetch('/api/chat?agent=linkedin-desk').then(r => r.json()).then(d => d.messages.filter(m => m.who === 'me').pop()));
    check(lc && lc.by === 'Ritvik' && lc.text === 'guest hello', 'Guest message saved with their name');
    const lbot = await p.evaluate(() => fetch('/api/chat?agent=linkedin-desk').then(r => r.json()).then(d => d.messages.filter(m => m.who === 'bot').pop()));
    check(lbot && lbot.text === 'guestmode yes', 'Guest run: no connectors, nothing pre-approved');
    // v2.9 rev E: the guest sees live progress of a task Kapil started
    p.evaluate(() => fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'linkedin-desk', message: 'slowprogress' }) }).then(r => r.text()));
    await gp.waitForTimeout(5500);
    check((await gp.locator('#msgs .m.livep').count()) >= 1 && (await gp.textContent('#msgs')).includes('step one done'), 'Guest sees live progress of Kapil\'s task');
    await gp.waitForTimeout(4500);
    // v2.9 1-tap submit: guest asks, owner approves
    await gp.fill('#inp', 'submittest'); await gp.click('#sendBtn'); await gp.waitForTimeout(1800); await gp.evaluate(() => loadChat()); await gp.waitForTimeout(500);
    check((await gp.textContent('#msgs')).includes('Waiting for Kapil') && (await gp.locator('#msgs .sreq .okb').count()) === 0, 'Guest sees submit request waiting (no approve button)');
    const rq = await p.evaluate(() => fetch('/api/chat?agent=linkedin-desk').then(r => r.json()).then(d => d.requests.pop()));
    check(rq && rq.by === 'Ritvik' && rq.status === 'waiting', 'Submit request saved for Kapil');
    const gq = await gp.evaluate(id => fetch('/api/submitreq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'linkedin-desk', id, action: 'approve' }) }).then(r => r.status), rq.id);
    check(gq === 403, 'Guest cannot approve');
    await p.evaluate(() => selectChat('linkedin-desk')); await p.waitForTimeout(1200);
    await p.locator('#msgs .sreq .okb').last().click(); await p.waitForTimeout(2000);
    const rq2 = await p.evaluate(id => fetch('/api/chat?agent=linkedin-desk').then(r => r.json()).then(d => ({ r: d.requests.find(x => x.id === id), last: d.messages.filter(m => m.who === 'me').pop().text })), rq.id);
    check(rq2.r.status === 'approved' && rq2.last.includes('Kapil approved submit'), 'Kapil ✅ starts the submit run');
    await p.evaluate(() => selectChat('mr-c')); await p.waitForTimeout(600);
    await gctx.close();
    // v3.0 scroll stays while reading + search
    await p.evaluate(() => selectChat('linkedin-desk')); await p.waitForTimeout(900);
    await p.evaluate(() => { const m = document.getElementById('msgs'); m.scrollTop = 0; m.dispatchEvent(new Event('scroll')); });
    await p.evaluate(() => fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'linkedin-desk', message: 'from other device' }) }).then(r => r.text()));
    await p.waitForTimeout(4800);
    const scv = await p.evaluate(() => ({ top: document.getElementById('msgs').scrollTop, pill: !document.getElementById('newPill').hidden, has: document.getElementById('msgs').textContent.includes('from other device') }));
    check(scv.has && scv.top < 50 && scv.pill, 'Reading position kept when a reply arrives + ⬇ pill shows');
    await p.click('#newPill'); await p.waitForTimeout(200);
    check(await p.evaluate(() => atBottom()) && await p.isHidden('#newPill'), '⬇ pill jumps to the bottom');
    await p.click('#findBtn'); await p.fill('#findQ', 'other device'); await p.waitForTimeout(500);
    check((await p.locator('#msgs mark.fm').count()) >= 1 && /of/.test(await p.textContent('#findN')), '🔍 search highlights matches with count');
    await p.click('#findX'); check((await p.locator('#msgs mark.fm').count()) === 0, '🔍 close clears highlights');
    await p.evaluate(() => selectChat('mr-c')); await p.waitForTimeout(600);
    // v3.1 ⚡ parallel while the main task runs, ➕ add to the running task
    await p.fill('#inp', 'slowtask main'); await p.click('#sendBtn'); await p.waitForTimeout(600);
    check(await p.isVisible('#parBtn') && await p.isVisible('#steerBtn'), '⚡ and ➕ show while the bot works');
    await p.fill('#inp', 'partest quick'); await p.click('#parBtn'); await p.waitForTimeout(1500);
    const par = await p.evaluate(() => fetch('/api/chat?agent=mr-c').then(r => r.json()));
    check(par.busy && par.messages.some(m => m.side && m.who === 'bot' && m.text === 'par answer fork yes'), '⚡ parallel answer arrives while main task still runs (forked session)');
    check(par.messages.some(m => m.side) && !/^2222/.test(par.sessionId || ''), 'Parallel does not change the main session');
    await p.fill('#inp', 'use montserrat'); await p.click('#steerBtn'); await p.waitForTimeout(5500);
    const st = await p.evaluate(() => fetch('/api/chat?agent=mr-c').then(r => r.json()));
    check(st.messages.some(m => m.who === 'me' && m.text.startsWith('➕ Added to task') && m.text.includes('use montserrat')), '➕ add-to-task continues the task with the new instruction');
    await p.waitForTimeout(1500);
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
    await p.evaluate(() => fetch('/api/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: 'mr-c', action: 'add', message: 'added elsewhere' }) }));
    await p.waitForTimeout(4600);
    check((await p.textContent('#queue')).includes('added elsewhere'), 'Queue added from another device shows while my task runs');
    await p.waitForTimeout(9000);
    const t = await p.textContent('#msgs');
    check(t.includes('slowtask one') && t.includes('Smoke test reply: queued two'), 'Queued message runs after the current task');
    await p.click('#side >> text=Settings'); await p.waitForTimeout(1500);
    check(await p.inputValue('#nTopic') === 'toshi-smoke123', 'Settings: ntfy topic loads');
    check(await p.inputValue('#tmGroup') === 'Toshi Bot Team', 'Settings: Team Desk group loads');
    check((await p.inputValue('#tmMembers')).includes('Manoj'), 'Settings: team members load');
    check(await p.isChecked('#tmOn'), 'Settings: Team Desk ON loads');
    check(await p.inputValue('#dayAlert') === '60', 'Settings: daily alert loads');
    check(!(await p.isDisabled('#tmSave')), 'Settings: Save buttons enabled');
    check((await p.locator('#agentList .item').count()) >= 3, 'Settings: My agents list loads');
    check((await p.textContent('#usageBox')).includes('Schedules + 👁 Watch') && (await p.locator('#usageBox .wkchart svg polygon').count()) === 4, 'Weekly usage: by source + chart');
    await p.locator('#usageBox .wkseg button', { hasText: 'By bot' }).click(); await p.waitForTimeout(200);
    check((await p.locator('#usageBox .wkrow').count()) >= 2, 'Weekly usage: by bot');
    check(await p.isChecked('#zohoDrafts'), 'Settings: Zoho Books drafts ON by default');
    // v1.9 order: move LinkedIn Desk up -> first after Mr. C (it is ungrouped again after group test? ensure ungrouped)
    await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'agentGroup', id: 'linkedin-desk', gid: '' }) }));
    for (let k = 0; k < 3; k++) { await p.evaluate(() => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', id: 'linkedin-desk', dir: -1 }) })); }
    const ids = await p.evaluate(() => fetch('/api/agents').then(r => r.json()).then(l => l.map(a => a.id)));
    check(ids[0] === 'mr-c' && ids[1] === 'linkedin-desk', 'Order: Mr. C first, moved bot goes up');
    check(await p.locator('#agentList button.mv').count() >= 2, 'Settings: ▲ ▼ buttons show');
    await p.locator('#agentList button', { hasText: '👁 Watch' }).first().click(); await p.waitForTimeout(300);
    check(await p.locator('#agentList .watchbox').count() === 1, 'Settings: 👁 Watch panel opens');
    await p.evaluate(() => openAdd()); await p.waitForTimeout(300);
    check(await p.evaluate(() => [...document.querySelectorAll('#fTools input:checked')].map(i => i.parentElement.textContent).join('|').includes('Prabhu ToshiCrm')), 'Add agent: Prabhu ToshiCrm ticked by default');
    await p.evaluate(() => { document.getElementById('overlay').hidden = true; });
    check((await p.textContent('#groupList')).includes('Software Bots'), 'Settings: groups list loads');
    await p.waitForTimeout(400); check((await p.textContent('#memList')).includes('Shared (all bots)') && (await p.textContent('#memList')).includes('points'), 'Settings: memory list loads');
    check((await p.textContent('#usageBox')).includes('₹0'), 'Settings: usage loads');
    await p.click('#tabSched'); await p.waitForTimeout(300); check(await p.isVisible('#sSave'), 'Schedules tab opens');
  } catch (e) { check(false, 'Unexpected: ' + e.message); }
  check(errs.length === 0, 'No JavaScript errors' + (errs.length ? ': ' + errs.join(' | ').slice(0, 300) : ''));
  await b.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(bin, { recursive: true, force: true });
  if (srvErr.trim()) console.log('server stderr:', srvErr.slice(0, 300));
  console.log(fails.length ? `\nSMOKE TEST FAILED (${fails.length}) — do not push.` : '\nSMOKE TEST PASSED');
  process.exit(fails.length ? 1 : 0);
})();
