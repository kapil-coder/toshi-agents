#!/usr/bin/env node
// Toshi Bot v1.9 rev B (11-11-2026): restore app-settings.json after the smoke-test accident.
// Finds the newest settings backup that is NOT test data and shows it. Run with --apply to restore it.
// The current (test) file is kept as backups/settings/broken-<time>.json first. Nothing is deleted.
const fs = require('fs'), path = require('path');
const STORE = path.join(__dirname, '..', 'icloud');
const FILE = path.join(STORE, 'app-settings.json'), DIR = path.join(STORE, 'backups', 'settings');
const isTest = o => o.ntfyTopic === 'toshi-smoke123' || /9315950722|9315950739/.test(JSON.stringify((o.team || {}).members || ''));
const sum = o => `ntfy=${o.ntfyTopic || '-'} | renamed bots=${Object.keys(o.names || {}).length} | icons=${Object.keys(o.icons || {}).length} | models=${Object.keys(o.models || {}).length} | team members=${String((o.team || {}).members || '').split('\n').filter(Boolean).length} | team ON=${!!(o.team || {}).enabled}`;
let cur = {}; try { cur = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
console.log('NOW    : ' + (isTest(cur) ? 'TEST DATA ✗  ' : 'looks real ✓ ') + sum(cur));
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(x => /^app-settings-\d+\.json$/.test(x)).sort().reverse() : [];
let pick = null;
for (const f of files) { try { const o = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); if (!isTest(o)) { pick = { f, o }; break; } } catch {} }
if (!pick) { console.log('No real backup found in ' + DIR + ' (' + files.length + ' backups, all test data). Tell Mr. C (cloud).'); process.exit(1); }
const when = new Date(Number(pick.f.match(/\d+/)[0])).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
console.log('BACKUP : ' + when + ' IST  ' + sum(pick.o));
if (process.argv[2] !== '--apply') { console.log('\nLooks right? Run again with --apply to restore it.'); process.exit(0); }
fs.writeFileSync(path.join(DIR, 'broken-' + Date.now() + '.json'), JSON.stringify(cur, null, 1));
fs.writeFileSync(FILE + '.tmp', JSON.stringify(pick.o, null, 1)); fs.renameSync(FILE + '.tmp', FILE);
console.log('Restored ✓ (the test file is kept as broken-*.json). Reload the app.');
