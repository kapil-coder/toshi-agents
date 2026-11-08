// Toshi Agents Chat App v0.4 rev A (08-11-2026)
// Local web app on the Mac mini: chat with Claude Code agents, approve actions, add agents.
// No npm packages needed. Run:  node chat-app/server.js   then open http://localhost:3737
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');

const VERSION = 'v0.4 rev D';
const PORT = Number(process.env.PORT || 3737);
const HOST = process.env.HOST || '127.0.0.1'; // local only; use Tailscale later for MacBook/iPhone
const PROJECT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(PROJECT, '.claude', 'agents');
const ICLOUD = path.join(PROJECT, 'icloud');
const DATA = fs.existsSync(ICLOUD) ? path.join(ICLOUD, 'chats') : path.join(PROJECT, '.data', 'chats');
fs.mkdirSync(DATA, { recursive: true });

const SEND_RE = /send|reply|forward|trash|delete|spam|share_file|create|update|upsert|post|remove|approve|purchase|merge/i;
const running = new Map(); // agent -> child process
let claudeVersion = 'checking…';
execFile('claude', ['--version'], (e, out) => { claudeVersion = e ? 'not found' : String(out).trim(); });

// ---------- agents ----------
function listAgents() {
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
  args.push('--append-system-prompt', tone + ' Today is ' + stamp() + ' IST.');
  args.push('--', message);

  const child = spawn('claude', args, { cwd: PROJECT, env: process.env });
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

// ---------- server ----------
const PUBLIC = path.join(__dirname, 'public');
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(path.join(PUBLIC, 'index.html')).pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/api/agents') return json(res, 200, listAgents().map(a => ({ ...a, busy: running.has(a.id) })));
    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, {
        app: VERSION, claude: claudeVersion, host: os.hostname(), uptime: os.uptime(),
        mac: os.release(), freeMem: os.freemem(), totalMem: os.totalmem(),
        icloud: fs.existsSync(ICLOUD), chats: DATA.replace(os.homedir(), '~'), time: stamp(),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/chat') {
      const id = url.searchParams.get('agent') || '';
      if (!validAgent(id)) return json(res, 404, { error: 'Unknown agent' });
      const c = loadChat(id); return json(res, 200, { messages: c.messages, pending: c.pending || [], allow: c.allow || [] });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const b = await readBody(req);
      if (!validAgent(b.agent)) return json(res, 404, { error: 'Unknown agent' });
      if (running.has(b.agent)) return json(res, 409, { error: 'This agent is still working. Wait for it to finish.' });
      const text = String(b.message || '').trim().slice(0, 8000);
      if (!text) return json(res, 400, { error: 'Empty message' });
      const c = loadChat(b.agent);
      if (b.always && Array.isArray(b.allowOnce)) {
        c.allow = [...new Set([...(c.allow || []), ...b.allowOnce.filter(t => !SEND_RE.test(t))])];
      }
      c.messages.push({ who: 'me', text, at: stamp() }); delete c.pending; saveChat(b.agent, c);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
      const child = runClaude(b.agent, text, { tone: b.tone, allowOnce: b.allowOnce || [] }, ev => res.write(JSON.stringify(ev) + '\n'));
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
    json(res, 404, { error: 'Not found' });
  } catch (e) { json(res, 500, { error: e.message }); }
});
server.listen(PORT, HOST, () => {
  console.log(`Toshi Agents app ${VERSION} running: http://localhost:${PORT}`);
  console.log(`Chats saved in: ${DATA}`);
  console.log('Keep this window open. Press Ctrl+C to stop.');
});
