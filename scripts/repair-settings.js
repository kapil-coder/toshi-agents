#!/usr/bin/env node
// Toshi Bot v1.9 rev C (11-11-2026): repair app-settings.json after the smoke-test accident (all backups were test data).
// Puts back what is known (bot names + icons from Kapil's screenshot of 11-11-2026), removes test data
// (fake team members, test ntfy topic, test pin/order). Usage: node scripts/repair-settings.js [your-ntfy-topic]
// The current file is kept as backups/settings/broken-<time>.json first. Nothing is deleted.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), STORE = path.join(ROOT, 'icloud');
const FILE = path.join(STORE, 'app-settings.json'), DIR = path.join(STORE, 'backups', 'settings');
const AG = path.join(ROOT, '.claude', 'agents'), AV = path.join(STORE, 'avatars');
const exists = id => id === 'mr-c' || fs.existsSync(path.join(AG, id + '.md'));
const hasPhoto = id => ['png', 'jpg', 'jpeg', 'webp'].some(e => fs.existsSync(path.join(AV, id + '.' + e)));
let s = {}; try { s = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(path.join(DIR, 'broken-' + Date.now() + '.json'), JSON.stringify(s, null, 1));
const names = { 'diwali-bot': 'Whatsapp Bot', 'investor-desk': 'Investor Bot', 'linkedin-desk': 'LinkedIn Bot', 'cash-softy': 'Cash Softy', 'greentech-bot': 'Greentech Bot',
  'mac-mini-organizer': 'Mac Mini Organizer Bot', 'opor-bot': 'OPOR Bot', 'santosh-attendence-bot': 'Santosh Attendence Bot', 'toshicrm-prabhu-bot': 'ToshiCrm - Prabhu Bot', 'zoho-bot': 'Zoho Bot' };
const icons = { 'cash-softy': 'cash', 'diwali-bot': 'chat', 'greentech-bot': 'leaf', 'investor-desk': 'chart', 'linkedin-desk': 'linkedin', 'mac-mini-organizer': 'screen',
  'opor-bot': 'opor', 'santosh-attendence-bot': 'attendance', 'toshicrm-prabhu-bot': hasPhoto('toshicrm-prabhu-bot') ? 'photo' : 'prabhu' };
s.names = {}; for (const [k, v] of Object.entries(names)) if (exists(k)) s.names[k] = v;
s.icons = {}; for (const [k, v] of Object.entries(icons)) if (exists(k)) s.icons[k] = v;
const topic = process.argv[2] || '';
if (topic && !/^[A-Za-z0-9_-]{8,64}$/.test(topic)) { console.log('ntfy topic looks wrong (8-64 letters/numbers). Skipped it.'); }
if (s.ntfyTopic === 'toshi-smoke123' || topic) { s.ntfyTopic = /^[A-Za-z0-9_-]{8,64}$/.test(topic) ? topic : ''; s.notify = !!s.ntfyTopic; }
s.team = Object.assign({}, s.team || {}, { enabled: false, members: '', refreshOn: false }); // Kapil re-enters team members, then turns Team Desk ON
delete s.pins; delete s.order; s.autoSend = true; s.zohoDrafts = true;
fs.writeFileSync(FILE + '.tmp', JSON.stringify(s, null, 1)); fs.renameSync(FILE + '.tmp', FILE);
console.log('Repaired ✓  names=' + Object.keys(s.names).length + ' icons=' + Object.keys(s.icons).length + ' ntfy=' + (s.ntfyTopic || 'NOT SET') + ' | Team Desk OFF (re-enter members) | Zoho Books drafts ON | Auto-send ON');
