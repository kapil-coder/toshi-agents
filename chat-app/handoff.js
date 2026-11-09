#!/usr/bin/env node
// Toshi Agents handoff tool v0.8 rev A (09-11-2026)
// Lets one agent pass an instruction to another agent.
//   node chat-app/handoff.js --list
//   node chat-app/handoff.js <agent-id> "instruction text"
'use strict';
const http = require('http');
const port = Number(process.env.TOSHI_PORT || 3737);
const [to, ...rest] = process.argv.slice(2);
const body = to === '--list' ? { list: true }
  : { from: process.env.TOSHI_AGENT || 'mr-c', to, msg: rest.join(' '), hop: Number(process.env.TOSHI_HOP || 0) };
if (!to || (!body.list && !body.msg.trim())) { console.log('Usage: node chat-app/handoff.js <agent-id> "instruction"   |   --list'); process.exit(1); }
const req = http.request({ host: '127.0.0.1', port, path: '/api/handoff', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const r = JSON.parse(d);
      if (Array.isArray(r)) r.forEach(a => console.log(a.id.padEnd(18) + a.name + ' - ' + (a.description || '').slice(0, 90)));
      else if (r.ok) console.log('Handed off to ' + to + '. It will start now (or when it is free). Kapil sees it in both chats.');
      else { console.log('Not sent: ' + r.error); process.exit(1); }
    } catch { console.log('Unexpected reply: ' + d); process.exit(1); }
  });
});
req.on('error', e => { console.log('Toshi Agents app is not running (' + e.message + ').'); process.exit(1); });
req.end(JSON.stringify(body));
