#!/usr/bin/env node
// Toshi Bot · Prabhu ToshiCrm connector (MCP server) v1.0 rev A (10-11-2026)
// Gives every bot clear CRM tools over Supabase (project "toshicrm").
// Option B (Kapil, 10-11-2026): read + create/update. There is NO delete tool.
// Secret key: macOS Keychain item "toshicrm-supabase" (set with scripts/toshicrm-key.sh). Never stored in git.
'use strict';
const https = require('https');
const { execFileSync } = require('child_process');

const URL_BASE = process.env.TOSHICRM_URL || 'https://ylmgucvpmvzpgcvaqhgq.supabase.co';
function key() {
  if (process.env.TOSHICRM_KEY) return process.env.TOSHICRM_KEY;
  try { return execFileSync('security', ['find-generic-password', '-s', 'toshicrm-supabase', '-w'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

// ---------- tiny PostgREST client ----------
function rest(method, table, query, body, prefer) {
  return new Promise((resolve, reject) => {
    const k = key(); if (!k) return reject(new Error('ToshiCrm key not set. On the Mac run: ~/toshi-agents/scripts/toshicrm-key.sh'));
    const u = new URL(URL_BASE + '/rest/v1/' + table + (query ? '?' + query : ''));
    const lib = u.protocol === 'http:' ? require('http') : https;
    const req = lib.request(u, { method, headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error('CRM error ' + res.statusCode + ': ' + d.slice(0, 300)));
        try { resolve(d ? JSON.parse(d) : []); } catch { resolve(d); }
      });
    });
    req.on('error', reject); req.setTimeout(20000, () => req.destroy(new Error('CRM timeout')));
    if (body) req.write(JSON.stringify(body)); req.end();
  });
}
const enc = encodeURIComponent;
const like = q => '*' + String(q || '').replace(/[*,()]/g, ' ').trim() + '*';
const lim = n => Math.max(1, Math.min(50, Number(n) || 10));
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const LIVE = 'deleted_at=is.null';

// ---------- tools ----------
const T = {};
const tool = (name, description, props, required, run) => { T[name] = { description, inputSchema: { type: 'object', properties: props, required: required || [] }, run }; };
const s = (d) => ({ type: 'string', description: d }), n = (d) => ({ type: 'number', description: d });

tool('search_accounts', 'Find customer/company accounts by name, GSTIN or phone.', { query: s('Name, GSTIN or phone'), limit: n('Max rows (default 10)') }, ['query'],
  a => rest('GET', 'accounts', `select=id,name,industry,tier,sector,category,phone,website,gstin,entity&${LIVE}&or=(name.ilike.${enc(like(a.query))},gstin.ilike.${enc(like(a.query))},phone.ilike.${enc(like(a.query))})&order=name&limit=${lim(a.limit)}`));
tool('get_account', 'One account with its latest deals, quotes, sales orders and unpaid invoices.', { account_id: s('Account id (uuid)') }, ['account_id'], async a => {
  const id = enc(a.account_id);
  const [acc, deals, quotes, sos, inv] = await Promise.all([
    rest('GET', 'accounts', `select=id,name,industry,tier,sector,phone,website,gstin,billing_address&id=eq.${id}`),
    rest('GET', 'deals', `select=id,name,stage,amount,closing_date,next_follow_up&account_id=eq.${id}&${LIVE}&order=zoho_modified_at.desc.nullslast&limit=10`),
    rest('GET', 'quotes', `select=id,quote_no,subject,stage,tc_status,grand_total,quote_date,valid_till&account_id=eq.${id}&${LIVE}&order=quote_date.desc.nullslast&limit=10`),
    rest('GET', 'sales_orders', `select=id,so_no,subject,status,tc_status,grand_total,so_date,customer_po_number&account_id=eq.${id}&${LIVE}&order=so_date.desc.nullslast&limit=10`),
    rest('GET', 'invoices', `select=id,invoice_number,invoice_date,grand_total,balance_due,payment_status&account_id=eq.${id}&${LIVE}&balance_due=gt.0&order=invoice_date.desc.nullslast&limit=10`),
  ]);
  return { account: acc[0] || null, deals, quotes, sales_orders: sos, unpaid_invoices: inv };
});
tool('search_contacts', 'Find contacts by name, email or mobile.', { query: s('Name, email or mobile'), limit: n('Max rows') }, ['query'],
  a => rest('GET', 'contacts', `select=id,first_name,last_name,title,email,mobile,phone,account_id,decision_role&${LIVE}&or=(first_name.ilike.${enc(like(a.query))},last_name.ilike.${enc(like(a.query))},email.ilike.${enc(like(a.query))},mobile.ilike.${enc(like(a.query))})&limit=${lim(a.limit)}`));
tool('search_leads', 'Find leads by company, name, email or phone; optional status filter.', { query: s('Company, name, email or phone'), status: s('Lead status (optional)'), limit: n('Max rows') }, ['query'],
  a => rest('GET', 'leads', `select=id,company,first_name,last_name,email,phone,lead_source,lead_status,sector,zoho_created_at&${LIVE}${a.status ? '&lead_status=eq.' + enc(a.status) : ''}&or=(company.ilike.${enc(like(a.query))},first_name.ilike.${enc(like(a.query))},last_name.ilike.${enc(like(a.query))},email.ilike.${enc(like(a.query))},phone.ilike.${enc(like(a.query))})&limit=${lim(a.limit)}`));
tool('list_deals', 'List deals, optionally by stage or account.', { stage: s('Stage (optional)'), account_id: s('Account id (optional)'), limit: n('Max rows') }, [],
  a => rest('GET', 'deals', `select=id,name,stage,amount,closing_date,next_follow_up,account_id&${LIVE}${a.stage ? '&stage=eq.' + enc(a.stage) : ''}${a.account_id ? '&account_id=eq.' + enc(a.account_id) : ''}&order=zoho_modified_at.desc.nullslast&limit=${lim(a.limit)}`));
tool('followups_due', 'Deals whose next follow-up date is today or earlier (or within N days).', { days_ahead: n('Include the next N days (default 0)'), limit: n('Max rows') }, [], a => {
  const d = new Date(Date.now() + 5.5 * 3600e3 + (Number(a.days_ahead) || 0) * 86400e3).toISOString().slice(0, 10);
  return rest('GET', 'deals', `select=id,name,stage,amount,next_follow_up,account_id&${LIVE}&next_follow_up=lte.${d}&order=next_follow_up&limit=${lim(a.limit || 30)}`);
});
tool('list_quotes', 'List quotations, optionally by status/stage, account or since a date (yyyy-mm-dd).', { status: s('Stage or TC status (optional)'), account_id: s('Account id (optional)'), since: s('From date yyyy-mm-dd (optional)'), limit: n('Max rows') }, [],
  a => rest('GET', 'quotes', `select=id,quote_no,subject,stage,tc_status,approval_status,grand_total,quote_date,valid_till,account_id&${LIVE}${a.status ? '&or=(stage.eq.' + enc(a.status) + ',tc_status.eq.' + enc(a.status) + ')' : ''}${a.account_id ? '&account_id=eq.' + enc(a.account_id) : ''}${a.since ? '&quote_date=gte.' + enc(a.since) : ''}&order=quote_date.desc.nullslast&limit=${lim(a.limit)}`));
tool('list_sales_orders', 'List sales orders, optionally by status or account.', { status: s('Status (optional)'), account_id: s('Account id (optional)'), limit: n('Max rows') }, [],
  a => rest('GET', 'sales_orders', `select=id,so_no,subject,status,tc_status,invoice_status,grand_total,so_date,customer_po_number,account_id&${LIVE}${a.status ? '&status=eq.' + enc(a.status) : ''}${a.account_id ? '&account_id=eq.' + enc(a.account_id) : ''}&order=so_date.desc.nullslast&limit=${lim(a.limit)}`));
tool('list_unpaid_invoices', 'Invoices with balance due, optionally for one account.', { account_id: s('Account id (optional)'), limit: n('Max rows') }, [],
  a => rest('GET', 'invoices', `select=id,invoice_number,invoice_date,grand_total,amount_received,balance_due,payment_status,account_id&${LIVE}&balance_due=gt.0${a.account_id ? '&account_id=eq.' + enc(a.account_id) : ''}&order=invoice_date.asc.nullslast&limit=${lim(a.limit || 20)}`));
tool('search_products', 'Find products by name or code (price, HSN, category).', { query: s('Name or code'), limit: n('Max rows') }, ['query'],
  a => rest('GET', 'products', `select=id,name,code,category,sub_category,unit_price,hsn_code,gst_rates,status&${LIVE}&or=(name.ilike.${enc(like(a.query))},code.ilike.${enc(like(a.query))})&limit=${lim(a.limit)}`));
tool('get_notes', 'Notes on a record (module: leads, accounts, contacts, deals, quotes, sales_orders).', { module: s('Module name'), record_id: s('Record id (uuid)') }, ['module', 'record_id'],
  a => rest('GET', 'crm_notes', `select=title,body,author_name,created_at&module=eq.${enc(a.module)}&record_id=eq.${enc(a.record_id)}&${LIVE}&order=created_at.desc&limit=20`));

// ---------- write tools (option B: create / update, never delete) ----------
tool('add_note', 'Add a note to a CRM record (written as "Toshi Bot").', { module: s('leads, accounts, contacts, deals, quotes or sales_orders'), record_id: s('Record id (uuid)'), title: s('Short title'), body: s('Note text') }, ['module', 'record_id', 'body'],
  a => rest('POST', 'crm_notes', '', { module: a.module, record_id: a.record_id, title: a.title || 'Toshi Bot note', body: String(a.body).slice(0, 5000), author_name: 'Toshi Bot', source: 'tc', created_at: new Date().toISOString() }));
tool('create_lead', 'Create a new lead (saved as ToshiCrm "tc", status Not Contacted). Search first to avoid duplicates.', { company: s('Company'), first_name: s('First name'), last_name: s('Last name'), email: s('Email'), phone: s('Phone'), lead_source: s('e.g. LinkedIn, WhatsApp, Email'), sector: s('Sector (optional)') }, ['company'],
  a => rest('POST', 'leads', '', { company: a.company, first_name: a.first_name, last_name: a.last_name || a.company, email: a.email, phone: a.phone, lead_source: a.lead_source || 'Toshi Bot', sector: a.sector, lead_status: 'Not Contacted', source: 'tc' }));
tool('update_lead_status', 'Change a lead\'s status. Use existing values: Open, Not Contacted, Attempted to Contact, Contacted, Pre-Qualified, Not Qualified, Contact in Future, Lost Lead.', { lead_id: s('Lead id (uuid)'), lead_status: s('New status') }, ['lead_id', 'lead_status'],
  a => rest('PATCH', 'leads', `id=eq.${enc(a.lead_id)}`, { lead_status: a.lead_status }));
tool('update_deal', 'Update a deal\'s stage (Cold, Warm, Hot, Negotiation/Review, Closed Won, Closed Lost, Closed Lost to Competition) and/or next follow-up date (yyyy-mm-dd).', { deal_id: s('Deal id (uuid)'), stage: s('New stage (optional)'), next_follow_up: s('yyyy-mm-dd (optional)') }, ['deal_id'], a => {
  const patch = {}; if (a.stage) patch.stage = a.stage; if (a.next_follow_up) patch.next_follow_up = a.next_follow_up;
  if (!Object.keys(patch).length) throw new Error('Give stage or next_follow_up.');
  return rest('PATCH', 'deals', `id=eq.${enc(a.deal_id)}`, patch);
});

// ---------- quick self-test: node chat-app/toshicrm-mcp.js --test ----------
if (process.argv.includes('--test')) {
  rest('GET', 'accounts', 'select=name&deleted_at=is.null&limit=1').then(r => { console.log('ToshiCrm connection OK ✓ (sample account: ' + ((r[0] || {}).name || 'none') + ')'); process.exit(0); })
    .catch(e => { console.log('ToshiCrm connection FAILED: ' + e.message); process.exit(1); });
} else {
// ---------- MCP over stdio (newline-delimited JSON-RPC) ----------
const send = m => process.stdout.write(JSON.stringify(m) + '\n');
let buf = '';
process.stdin.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    handle(msg);
  }
});
async function handle(m) {
  if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: (m.params && m.params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'toshicrm', version: '1.0.0' } } });
  if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: Object.entries(T).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } });
  if (m.method === 'tools/call') {
    const t = T[m.params && m.params.name];
    if (!t) return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'Unknown tool' }], isError: true } });
    try { const r = await t.run((m.params && m.params.arguments) || {}); return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: JSON.stringify(r).slice(0, 60000) }] } }); }
    catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } }); }
  }
  if (m.id !== undefined && m.method) send({ jsonrpc: '2.0', id: m.id, result: {} }); // ping etc.
}
}
