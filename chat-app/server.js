// Toshi Agents Chat App v0.4 rev A (08-11-2026)
// Local web app on the Mac mini: chat with Claude Code agents, approve actions, add agents.
// No npm packages needed. Run:  node chat-app/server.js   then open http://localhost:3737
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const VERSION = 'v0.8 rev E';
const PORT = Number(process.env.PORT || 3737);
const HOST = process.env.HOST || '127.0.0.1'; // local only; use Tailscale later for MacBook/iPhone
const PROJECT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(PROJECT, '.claude', 'agents');
const ICLOUD = path.join(PROJECT, 'icloud');
const DATA = fs.existsSync(ICLOUD) ? path.join(ICLOUD, 'chats') : path.join(PROJECT, '.data', 'chats');
fs.mkdirSync(DATA, { recursive: true });
const STORE_DIR = () => path.dirname(DATA);
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

const SEND_RE = /send|reply|forward|trash|delete|spam|share_file|create|update|upsert|post|remove|approve|purchase|merge/i;
const running = new Map(); // agent -> child process
const SHARED_BROWSER = new Set(['mr-c', 'linkedin-desk']);
const BUILT_IN = new Set(['mr-c', 'investor-desk', 'linkedin-desk']);
const STRICT_SEND_RE = /whatsapp|diwali/i; // agents whose browser 'send' clicks need Kapil's Haan
function tailscaleIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && /^100\./.test(n.address)) return n.address;
  return '';
}
let claudeVersion = 'checking…';
execFile('claude', ['--version'], (e, out) => { claudeVersion = e ? 'not found' : String(out).trim(); });

// ---------- agents ----------
function listAgents() {
  const names = readJSON(path.join(STORE_DIR(), 'app-settings.json'), {}).names || {};
  return listAgentsRaw().map(a => names[a.id] ? { ...a, name: names[a.id] } : a);
}
function listAgentsRaw() {
  const out = [{ id: 'mr-c', name: 'Mr. C', description: 'Main assistant. Picks the right agent for you.', paused: false }];
  if (!fs.existsSync(AGENTS_DIR)) return out;
  for (const f of fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort()) {
    const txt = fs.readFileSync(path.join(AGENTS_DIR, f), 'utf8');
    const fm = (txt.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
    const get = k => ((fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm')) || [])[1] || '').trim();
    const id = get('name') || f.replace(/\.md$/, '');
    const title = (txt.match(/You are \*\*(.+?)\*\*/) || [])[1];
    out.push({
      id,
      name: title ? title.replace(/\s+v[\d.]+.*$/, '') : id,
      description: get('description'),
      paused: /paused/i.test(get('description')) || /Status: PAUSED/i.test(txt),
    });
  }
  return out;
}
const validAgent = id => listAgents().some(a => a.id === id);

// ---------- chat history ----------
const chatFile = id => path.join(DATA, id.replace(/[^a-z0-9-]/gi, '') + '.json');
function loadChat(id) {
  try { return JSON.parse(fs.readFileSync(chatFile(id), 'utf8')); }
  catch { return { sessionId: null, allow: [], messages: [] }; }
}
function saveChat(id, chat) {
  chat.messages = chat.messages.slice(-200);
  fs.writeFileSync(chatFile(id), JSON.stringify(chat, null, 1));
}
const stamp = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

// ---------- helpers ----------
function readBody(req) {
  return new Promise((res, rej) => {
    let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } }); req.on('error', rej);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function toolLabel(name) {
  const m = String(name).match(/^mcp__(.+?)__(.+)$/);
  if (!m) return name;
  return m[1].replace(/^claude_ai_/, '').replace(/_/g, ' ') + ': ' + m[2].replace(/_/g, ' ');
}

// ---------- run claude ----------
function runClaude(agent, message, opts, onEvent) {
  const chat = loadChat(agent);
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'default'];
  if (agent !== 'mr-c') args.push('--agent', agent);
  if (chat.sessionId) args.push('--resume', chat.sessionId);
  const allow = [...new Set([...(chat.allow || []), ...(opts.allowOnce || [])])];
  if (allow.length) args.push('--allowedTools', ...allow);
  const tone = opts.tone === 'fun'
    ? 'Tone for this chat: Fun, witty and cheeky (Grok style), still accurate and brief. Hinglish with "aap".'
    : 'Tone for this chat: Professional, brief, bullet points. Hinglish with "aap" when talking to Kapil.';
  args.push('--append-system-prompt', tone + ' Your name in the Toshi Agents app is "' + agentName(agent) + '" (agent id: ' + agent + ').' + ' Today is ' + stamp() + ' IST.');
  args.push('--', message);

  // Tools Kapil approved with Haan for this run: the guard hook allows exactly these
  // Own browser per agent (LinkedIn Desk and Mr. C keep the shared profile with the LinkedIn login)
  const env = { ...process.env, TOSHI_ALLOW: allow.join(' '), TOSHI_AGENT: agent, TOSHI_HOP: String(opts.hop || 0),
    TOSHI_PORT: String(PORT), TOSHI_STRICT_SEND: STRICT_SEND_RE.test(agent + ' ' + agentName(agent)) ? '1' : '' };
  if (!SHARED_BROWSER.has(agent)) {
    env.TOSHI_BROWSER_PROFILE = path.join(os.homedir(), '.toshi-agents', 'chrome-profiles', agent);
    env.TOSHI_BROWSER_OUTPUT = path.join(os.homedir(), '.toshi-agents', 'browser-output', agent);
  }
  if (fs.existsSync(ICLOUD)) fs.mkdirSync(path.join(ICLOUD, agent === 'mr-c' ? 'shared' : agent, 'work'), { recursive: true });
  const child = spawn('claude', args, { cwd: PROJECT, env });
  running.set(agent, child);
  let buf = '', finalText = [], sessionId = chat.sessionId, denials = [], errText = '';
  child.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.session_id) sessionId = ev.session_id;
      if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
        for (const c of ev.message.content) {
          if (c.type === 'text' && c.text.trim()) { finalText.push(c.text); onEvent({ t: 'text', v: c.text }); }
          if (c.type === 'tool_use') onEvent({ t: 'tool', v: toolLabel(c.name) });
        }
      }
      if (ev.type === 'result') {
        denials = (ev.permission_denials || []).map(d => ({ tool: d.tool_name, label: toolLabel(d.tool_name), input: JSON.stringify(d.tool_input || {}).slice(0, 400) }));
        if (ev.is_error && ev.result) errText = String(ev.result);
      }
    }
  });
  child.stderr.on('data', d => { errText += d; });
  child.on('error', e => { errText = 'Could not start Claude Code: ' + e.message; });
  child.on('close', code => {
    running.delete(agent);
    const c = loadChat(agent);
    c.sessionId = sessionId;
    if (finalText.length) c.messages.push({ who: 'bot', text: finalText.join('\n\n'), at: stamp() });
    if (denials.length) c.pending = denials; else delete c.pending;
    saveChat(agent, c);
    if (denials.length) onEvent({ t: 'approve', v: denials });
    if (!finalText.length && code !== 0) onEvent({ t: 'error', v: (errText || 'Claude Code stopped (code ' + code + ').').slice(-600) });
    onEvent({ t: 'done' });
  });
  return child;
}

// ---------- create agent ----------
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); }
function agentFile(f) {
  const id = slugify(f.name);
  const list = a => (Array.isArray(a) && a.length ? a.join(', ') : 'none');
  return { id, text: `---
name: ${id}
description: ${String(f.job || '').replace(/\n/g, ' ').slice(0, 300)}${f.paused ? ' Paused by default; works only after Kapil says resume.' : ''}
model: inherit
---

You are **${f.name}** v0.1 for Kapil Sachdev, Founder & CEO of Toshi Automation Solutions Limited.
Created ${stamp()} IST from the Toshi Agents app${f.source ? ' (imported from Grok)' : ''}.

## Before anything else
1. Read \`RULEBOOK.md\` (golden rule book). It always wins.
2. If \`icloud/${id}/charter.md\` exists, read it.
3. Files Kapil uploads in the chat app land in \`icloud/${id}/uploads/\`.
4. Email: when Kapil asks, write it and save it as a Gmail draft (allowed). Send only when Kapil asks to send; the app then shows him a Haan card.

## Company
${f.company || 'Toshi Automation'}

## Job
${f.job || ''}

## Personality
${f.tone || 'Professional'}

## Tools it may use
${list(f.tools)}

## Runs on its own
${f.schedule || 'Only when Kapil asks'} (schedules start in v0.2; for now only when Kapil asks)

## Must ask Kapil before
${list(f.askBefore)}

## Hard rules
${String(f.rules || '- Follow RULEBOOK.md').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.startsWith('-') ? l : '- ' + l).join('\n')}

## Status
${f.paused ? 'PAUSED. Do nothing until Kapil says resume.' : 'Active. Work only when Kapil asks.'}
` };
}


// ---------- app settings, schedules, notifications (v0.6) ----------
const STORE = path.dirname(DATA); // iCloud/ToshiAgents (or .data)
const SETTINGS_FILE = path.join(STORE, 'app-settings.json');
const SCHED_FILE = path.join(STORE, 'schedules.json');
const LOCAL_SETTINGS = path.join(PROJECT, '.claude', 'settings.local.json');
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1));
function getSettings() {
  return Object.assign({ ntfyTopic: '', notify: false, appUrl: 'https://kapils-mac-mini.tailac1d46.ts.net' }, readJSON(SETTINGS_FILE, {}));
}
const agentName = id => (listAgents().find(a => a.id === id) || { name: id }).name;

// Phone push via the free ntfy app. Only a short, non-confidential line is sent.
function notify(title, body) {
  const s = getSettings();
  if (!s.notify || !/^[A-Za-z0-9_-]{8,64}$/.test(s.ntfyTopic)) return;
  const req = https.request({ hostname: 'ntfy.sh', path: '/' + s.ntfyTopic, method: 'POST',
    headers: { Title: title.replace(/[^\x20-\x7E]/g, ''), Click: s.appUrl, Tags: 'robot' } }, r => r.resume());
  req.on('error', () => {}); req.end(body.slice(0, 200));
}

// IST clock
function nowIST() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) % 24 * 60 + Number(p.minute), dow };
}
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
const loadSchedules = () => readJSON(SCHED_FILE, []);
const saveSchedules = l => writeJSON(SCHED_FILE, l);

// Start one agent run (used by chat and by schedules)
function startRun(agent, text, opts, onEvent, meta = {}) {
  const c = loadChat(agent);
  if (opts.always && Array.isArray(opts.allowOnce)) c.allow = [...new Set([...(c.allow || []), ...opts.allowOnce.filter(t => !SEND_RE.test(t))])];
  c.messages.push({ who: 'me', text: meta.label ? meta.label + '\n' + text : text, at: stamp() }); delete c.pending; saveChat(agent, c);
  const what = meta.handoff ? 'Task from ' + meta.from : 'Scheduled task ' + meta.time;
  return runClaude(agent, text, opts, ev => {
    onEvent(ev);
    if (meta.scheduled && ev.t === 'approve') notify('Toshi: ' + agentName(agent) + ' needs your Haan', what + ' is waiting for your approval.');
    if (meta.scheduled && ev.t === 'done') {
      const cc = loadChat(agent); cc.unread = true; saveChat(agent, cc);
      if (!cc.pending) notify('Toshi: ' + agentName(agent) + ' finished', what + ' is done. Open the app to see the result.');
      if (meta.handoff) setTimeout(drainHandoffs, 1000);
    }
  });
}

// Scheduler: checks every 30 s; runs a task within 10 min of its time, once per day per time.
function tick() {
  const n = nowIST(); const list = loadSchedules(); let changed = false;
  for (const s of list) {
    if (!s.enabled || !validAgent(s.agent)) continue;
    if (Array.isArray(s.days) && s.days.length && !s.days.includes(n.dow)) continue;
    for (const t of s.times || []) {
      const tm = toMin(t); if (tm < 0 || n.min < tm || n.min >= tm + 10) continue;
      s.last = s.last || {}; if (s.last[t] === n.date) continue;
      if (running.has(s.agent)) continue; // busy: try again on the next tick
      s.last[t] = n.date; changed = true;
      startRun(s.agent, s.task, { tone: 'pro', allowOnce: [] }, () => {}, { scheduled: true, time: t, label: '⏰ Scheduled ' + t + ' IST' });
    }
  }
  if (changed) saveSchedules(list);
}
setInterval(tick, 30000); setTimeout(tick, 5000);

// Folder access (Claude Code additionalDirectories in .claude/settings.local.json)
function getFolders() { return ((readJSON(LOCAL_SETTINGS, {}).permissions || {}).additionalDirectories || []); }
function setFolders(list) {
  const s = readJSON(LOCAL_SETTINGS, {}); s.permissions = s.permissions || {}; s.permissions.additionalDirectories = list; writeJSON(LOCAL_SETTINGS, s);
}
function folderOk(p) {
  const home = os.homedir(); const full = path.resolve(String(p || '').replace(/^~(?=\/|$)/, home));
  if (!full.startsWith(home + '/') || full.includes('..')) return { error: 'Folder must be inside your home folder.' };
  const lib = path.join(home, 'Library') + '/';
  if ((full + '/').startsWith(lib) && !full.startsWith(path.join(home, 'Library', 'Mobile Documents'))) return { error: 'System folders (~/Library) are not allowed.' };
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return { error: 'Folder not found: ' + full };
  return { full };
}


// ---------- handoffs between agents (v0.8) ----------
const handoffQueue = []; // { from, to, msg, hop, at }
const handoffLog = new Map(); // from -> [timestamps] (rate limit)
function queueHandoff(from, to, msg, hop) {
  if (!validAgent(to)) return { error: 'Unknown agent: ' + to + '. Run: node chat-app/handoff.js --list' };
  if (to === from) return { error: 'An agent cannot hand off to itself.' };
  if (hop >= 3) return { error: 'Too many hops (max 3). Ask Kapil instead.' };
  const now = Date.now(), recent = (handoffLog.get(from) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 20) return { error: 'Rate limit: max 20 handoffs per hour per agent.' };
  recent.push(now); handoffLog.set(from, recent);
  handoffQueue.push({ from, to, msg: String(msg).slice(0, 4000), hop, at: stamp() });
  // note in the sender's chat so Kapil sees who asked whom
  if (validAgent(from)) { const c = loadChat(from); c.messages.push({ who: 'bot', text: '📨 Sent to ' + agentName(to) + ':\n' + msg, at: stamp() }); saveChat(from, c); }
  setTimeout(drainHandoffs, 500);
  return { ok: true, queued: handoffQueue.length };
}
function drainHandoffs() {
  for (let i = 0; i < handoffQueue.length; i++) {
    const h = handoffQueue[i];
    if (running.has(h.to)) continue;
    handoffQueue.splice(i, 1); i--;
    startRun(h.to, 'Instruction from ' + agentName(h.from) + ' (another Toshi agent, not Kapil). Follow RULEBOOK.md; anything outgoing still needs Kapil\'s Haan.\n\n' + h.msg,
      { tone: 'pro', allowOnce: [], hop: h.hop + 1 }, () => {}, { scheduled: true, handoff: true, from: agentName(h.from), label: '📨 From ' + agentName(h.from) });
  }
}
setInterval(drainHandoffs, 15000);

// ---------- live screen (v0.8): macOS screencapture, cached ----------
let screenCache = { at: 0, buf: null, err: '' }, screenBusy = false;
function captureScreen(cb) {
  if (Date.now() - screenCache.at < 1500 || screenBusy) return cb(screenCache);
  if (process.platform !== 'darwin') { screenCache = { at: Date.now(), buf: null, err: 'Live screen works on the Mac mini only.' }; return cb(screenCache); }
  screenBusy = true; const f = path.join(os.tmpdir(), 'toshi-live.jpg');
  execFile('/usr/sbin/screencapture', ['-x', '-t', 'jpg', f], e1 => {
    if (e1) { screenBusy = false; screenCache = { at: Date.now(), buf: null, err: 'Allow Screen Recording for node: System Settings > Privacy & Security > Screen & System Audio Recording.' }; return cb(screenCache); }
    execFile('/usr/bin/sips', ['-Z', '1400', '-s', 'formatOptions', '60', f], () => {
      fs.readFile(f, (e2, buf) => {
        screenBusy = false;
        // a black/tiny image usually means Screen Recording permission is missing
        screenCache = e2 || !buf || buf.length < 8000 ? { at: Date.now(), buf: buf || null, err: e2 ? e2.message : 'Screen looks empty. Allow Screen Recording for node (System Settings > Privacy & Security).' } : { at: Date.now(), buf, err: '' };
        cb(screenCache);
      });
    });
  });
}

// ---------- server ----------
const PUBLIC = path.join(__dirname, 'public');
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return fs.createReadStream(path.join(PUBLIC, 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/agents') return json(res, 200, listAgents().map(a => ({ ...a, busy: running.has(a.id), unread: !!loadChat(a.id).unread })));
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, {
        app: VERSION, claude: claudeVersion, host: os.hostname(), uptime: os.uptime(),
        mac: os.release(), tsIp: tailscaleIp(), user: os.userInfo().username, freeMem: os.freemem(), totalMem: os.totalmem(),
        icloud: fs.existsSync(ICLOUD), chats: DATA.replace(os.homedir(), '~'), time: stamp(),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/chat') {
      const id = url.searchParams.get('agent') || '';
      if (!validAgent(id)) return json(res, 404, { error: 'Unknown agent' });
      const c = loadChat(id); return json(res, 200, { messages: c.messages, pending: c.pending || [], allow: c.allow || [], busy: running.has(id) });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const b = await readBody(req);
      if (!validAgent(b.agent)) return json(res, 404, { error: 'Unknown agent' });
      if (running.has(b.agent)) return json(res, 409, { error: 'This agent is still working. Wait for it to finish.' });
      const text = String(b.message || '').trim().slice(0, 8000);
      if (!text) return json(res, 400, { error: 'Empty message' });
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
      const child = startRun(b.agent, text, { tone: b.tone, allowOnce: b.allowOnce || [], always: !!b.always }, ev => res.write(JSON.stringify(ev) + '\n'));
      child.on('close', () => setTimeout(() => res.end(), 50));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/stop') {
      const b = await readBody(req); const ch = running.get(b.agent);
      if (ch) ch.kill('SIGINT'); return json(res, 200, { ok: !!ch });
    }
    if (req.method === 'POST' && url.pathname === '/api/clear') {
      const b = await readBody(req); if (!validAgent(b.agent)) return json(res, 404, { error: 'Unknown agent' });
      const c = loadChat(b.agent); saveChat(b.agent, { sessionId: null, allow: c.allow || [], messages: [] }); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/convert') {
      const b = await readBody(req);
      const prompt = 'Convert these Grok agent instructions into a Claude agent form. Reply with ONLY a JSON object, no other text, with keys: ' +
        'name (short), company (one of "Toshi Automation","TRAC Engineering","Toshi Greentech","All"), job (1-2 sentences), tone, ' +
        'tools (array from: Zoho CRM, Zoho Books, Gmail, Google Sheets, Google Drive, Calendar, Web search, Browser, Apollo, WhatsApp), ' +
        'schedule (e.g. "Only when I ask", "Daily 08:30 IST"), askBefore (array), rules (newline separated hard rules), paused (boolean). ' +
        'Never invent facts not in the text.\n\nGROK INSTRUCTIONS:\n' + String(b.text || '').slice(0, 20000);
      const ch = spawn('claude', ['-p', '--output-format', 'json', '--permission-mode', 'default', '--', prompt], { cwd: PROJECT });
      let out = '', err = '';
      ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => err += d);
      ch.on('error', e => json(res, 500, { error: e.message }));
      ch.on('close', () => {
        try {
          const r = JSON.parse(out).result || '';
          const obj = JSON.parse((r.match(/\{[\s\S]*\}/) || [r])[0]);
          json(res, 200, obj);
        } catch { json(res, 500, { error: 'Could not convert. ' + (err || out).slice(-300) }); }
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/agents') {
      const b = await readBody(req);
      if (b.action === 'rename') {
        // Display name only, saved in iCloud app-settings (works for every agent, survives updates)
        const id = String(b.id || ''), name = String(b.name || '').replace(/[*\n\r]/g, '').trim().slice(0, 40);
        if (!validAgent(id)) return json(res, 404, { error: 'Agent not found.' });
        if (!name) return json(res, 400, { error: 'Write the new name.' });
        const st = getSettings(); st.names = st.names || {}; st.names[id] = name; writeJSON(SETTINGS_FILE, st);
        return json(res, 200, { ok: true });
      }
      if (b.action === 'delete') {
        // Archive, never hard-delete. Built-in agents (in GitHub) and Mr. C cannot be removed here.
        const id = String(b.id || '');
        if (BUILT_IN.has(id)) return json(res, 400, { error: 'Built-in agent. It cannot be deleted from the app.' });
        const file = path.join(AGENTS_DIR, id.replace(/[^a-z0-9-]/gi, '') + '.md');
        if (!fs.existsSync(file)) return json(res, 404, { error: 'Agent not found.' });
        if (running.has(id)) return json(res, 409, { error: 'Agent is working right now. Try again when it finishes.' });
        const arch = path.join(PROJECT, '.claude', 'agents-archive'); fs.mkdirSync(arch, { recursive: true });
        fs.renameSync(file, path.join(arch, id + '-' + nowIST().date + '.md'));
        const list = loadSchedules().filter(s => s.agent !== id); saveSchedules(list);
        return json(res, 200, { ok: true });
      }
      if (!b.name || !slugify(b.name)) return json(res, 400, { error: 'Agent name is required.' });
      const { id, text } = agentFile(b);
      const file = path.join(AGENTS_DIR, id + '.md');
      if (fs.existsSync(file) && !b.overwrite) return json(res, 409, { error: 'An agent called "' + id + '" already exists.' });
      fs.mkdirSync(AGENTS_DIR, { recursive: true }); fs.writeFileSync(file, text);
      if (fs.existsSync(ICLOUD)) fs.mkdirSync(path.join(ICLOUD, id), { recursive: true });
      return json(res, 200, { ok: true, id });
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const id = url.searchParams.get('agent') || '';
      if (!validAgent(id)) return json(res, 404, { error: 'Unknown agent' });
      if (!fs.existsSync(ICLOUD)) return json(res, 400, { error: 'iCloud link missing. Run scripts/setup-mac.sh first.' });
      const rel = id === 'investor-desk' ? 'investor-desk/docs' : id === 'mr-c' ? 'shared/uploads' : id + '/uploads';
      const dir = path.join(ICLOUD, rel); fs.mkdirSync(dir, { recursive: true });
      let name = path.basename(String(url.searchParams.get('name') || 'file')).replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'file';
      const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
      for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = base + ' (' + n + ')' + ext;
      const out = fs.createWriteStream(path.join(dir, name)); let size = 0, tooBig = false;
      req.on('data', c => { size += c.length; if (size > 100e6 && !tooBig) { tooBig = true; out.destroy(); fs.rm(path.join(dir, name), () => {}); json(res, 413, { error: 'File is over 100 MB.' }); req.destroy(); } });
      req.pipe(out);
      out.on('finish', () => { if (!tooBig) json(res, 200, { ok: true, path: 'icloud/' + rel + '/' + name, name, size }); });
      out.on('error', e => { if (!tooBig) json(res, 500, { error: e.message }); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/screen') {
      return captureScreen(c => {
        if (!c.buf) return json(res, 503, { error: c.err || 'No screen' });
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'X-Screen-Note': c.err ? 'warn' : 'ok' }); res.end(c.buf);
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/handoff') {
      // only from this Mac (agents call it through chat-app/handoff.js)
      const ra = req.socket.remoteAddress || ''; if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ra)) return json(res, 403, { error: 'Local only' });
      const b = await readBody(req);
      if (b.list) return json(res, 200, listAgents().map(a => ({ id: a.id, name: a.name, description: a.description })));
      const r = queueHandoff(String(b.from || 'mr-c'), String(b.to || ''), String(b.msg || '').trim(), Number(b.hop) || 0);
      return json(res, r.error ? 400 : 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/handoff-ui') {
      const b = await readBody(req); const r = queueHandoff(String(b.from || 'mr-c'), String(b.to || ''), String(b.msg || '').trim(), 0);
      return json(res, r.error ? 400 : 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/update') {
      // One-tap update: git pull, then exit so launchd restarts the app with the new code.
      const b = await readBody(req);
      const git = (args, cb) => execFile('git', args, { cwd: PROJECT, timeout: 60000 }, (e, out, err) => cb(e, String(out || ''), String(err || '')));
      return git(['status', '--porcelain', '--untracked-files=no'], (e0, changed) => {
        const files = changed.split('\n').filter(l => l.trim()).map(l => l.slice(3).trim());
        const go = () => git(['pull', '--ff-only'], (e, out, err) => {
          if (e) return json(res, 500, { error: 'Update failed: ' + (err || e.message).slice(-400) });
          const head = out.includes('Already up to date') ? 'Already up to date.' : 'Updated. Restarting…';
          json(res, 200, { ok: true, msg: head, restart: !out.includes('Already up to date') });
          if (!out.includes('Already up to date')) setTimeout(() => process.exit(0), 800); // launchd KeepAlive starts the new version
        });
        if (!files.length) return go();
        if (!b.discard) return json(res, 409, { error: 'Local changes block the update', files });
        // keep a copy of the local edits in iCloud, then discard them
        git(['diff'], (e1, diff) => {
          const dir = path.join(STORE, 'backups'); fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'local-changes-' + nowIST().date + '-' + Date.now() + '.diff'), diff);
          git(['checkout', '--', ...files], e2 => e2 ? json(res, 500, { error: 'Could not reset local changes: ' + e2.message }) : go());
        });
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/seen') {
      const b = await readBody(req); if (!validAgent(b.agent)) return json(res, 404, { error: 'Unknown agent' });
      const c = loadChat(b.agent); if (c.unread) { delete c.unread; saveChat(b.agent, c); } return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/schedules') {
      if (req.method === 'GET') return json(res, 200, loadSchedules());
      if (req.method === 'POST') {
        const b = await readBody(req); const list = loadSchedules();
        if (b.action === 'delete') { saveSchedules(list.filter(s => s.id !== b.id)); return json(res, 200, { ok: true }); }
        if (b.action === 'toggle') { const s = list.find(s => s.id === b.id); if (s) s.enabled = !s.enabled; saveSchedules(list); return json(res, 200, { ok: true }); }
        if (b.action === 'run') {
          const s = list.find(s => s.id === b.id); if (!s) return json(res, 404, { error: 'Not found' });
          if (running.has(s.agent)) return json(res, 409, { error: 'That agent is busy right now.' });
          startRun(s.agent, s.task, { tone: 'pro', allowOnce: [] }, () => {}, { scheduled: true, time: 'now', label: '⏰ Run now (schedule)' });
          return json(res, 200, { ok: true });
        }
        if (!validAgent(b.agent)) return json(res, 400, { error: 'Choose an agent.' });
        const times = [...new Set(String(b.times || '').split(/[ ,]+/).filter(Boolean))];
        if (!times.length || times.some(t => toMin(t) < 0 || toMin(t) >= 1440)) return json(res, 400, { error: 'Times must look like 06:00, 13:00, 19:00' });
        const task = String(b.task || '').trim().slice(0, 4000); if (!task) return json(res, 400, { error: 'Write the task.' });
        const days = Array.isArray(b.days) ? b.days.map(Number).filter(d => d >= 0 && d <= 6) : [];
        list.push({ id: Date.now().toString(36), agent: b.agent, times: times.map(t => t.padStart(5, '0')), days, task, enabled: true, created: stamp(), last: {} });
        saveSchedules(list); return json(res, 200, { ok: true });
      }
    }
    if (url.pathname === '/api/settings') {
      if (req.method === 'GET') return json(res, 200, { ...getSettings(), folders: getFolders() });
      if (req.method === 'POST') {
        const b = await readBody(req); const s = getSettings();
        if (b.action === 'notify') {
          s.notify = !!b.notify;
          if (b.ntfyTopic !== undefined) { if (b.ntfyTopic && !/^[A-Za-z0-9_-]{8,64}$/.test(b.ntfyTopic)) return json(res, 400, { error: 'Topic: 8-64 letters, numbers, - or _' }); s.ntfyTopic = b.ntfyTopic; }
          writeJSON(SETTINGS_FILE, s); return json(res, 200, { ok: true });
        }
        if (b.action === 'test') { notify('Toshi Agents test', 'Notifications are working. ' + stamp() + ' IST'); return json(res, 200, { ok: true }); }
        if (b.action === 'addFolder') { const r = folderOk(b.path); if (r.error) return json(res, 400, r); setFolders([...new Set([...getFolders(), r.full])]); return json(res, 200, { ok: true }); }
        if (b.action === 'removeFolder') {
          if (String(b.path).includes('com~apple~CloudDocs/ToshiAgents')) return json(res, 400, { error: 'The ToshiAgents iCloud folder is required.' });
          setFolders(getFolders().filter(f => f !== b.path)); return json(res, 200, { ok: true });
        }
      }
    }
    json(res, 404, { error: 'Not found' });
  } catch (e) { json(res, 500, { error: e.message }); }
});
server.listen(PORT, HOST, () => {
  console.log(`Toshi Agents app ${VERSION} running: http://localhost:${PORT}`);
  console.log(`Chats saved in: ${DATA}`);
  console.log('Keep this window open. Press Ctrl+C to stop.');
});
