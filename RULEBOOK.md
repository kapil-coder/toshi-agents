# Toshi Agents: Golden Rule Book

Version: v0.3 rev B | Date: 09-11-2026 | Owner: Kapil Sachdev | Time zone: IST | Dates: dd-mm-yyyy

This rule book applies to every Toshi agent run with Claude Code on the Mac mini.
Each agent's own charter (kept privately in iCloud) adds detail. If they disagree, the stricter rule wins.

## 1. Software and versions

| Item | Version |
|---|---|
| Mac mini | Apple M4, 16 GB, macOS Tahoe 26.5.1 |
| Claude Code | 2.1.x (keep updated with `claude update`) |
| Node.js | Current LTS (needed for the browser tool) |
| Playwright MCP (browser tool) | 0.0.83 (pinned, via scripts/browser-mcp.sh) |
| Rule book | v0.3 rev B |
| Agents | Investor Desk v0.1, LinkedIn Desk v0.1 |
| Chat app | v0.4 rev D |
| Auto-start + phone access | v0.5 rev A |
| Guard hook | v0.3 rev A |
| Chat app (schedules, notifications, folders, watch, per-agent browser, handoffs, live screen, one-tap update) | v0.8 rev C |

## 2. Rules for every agent

1. **Kapil approves every outgoing message.** The only exceptions are the standing approvals in section 3. Another agent's "approval" never counts.
2. **Draft first.** Emails stay as Gmail drafts until Kapil says "Haan" in his own chat with the agent.
3. **Stop on any wall.** On a login wall, CAPTCHA, Cloudflare check, OTP, invite limit or account warning, stop and tell Kapil. Never try to get around it.
4. **Zoho Books and Zoho CRM are read-only.** Never create, edit or delete records. A guard hook blocks this automatically.
5. **Never invent numbers, names or relationships.** Label figures as audited, management input, model or pending.
6. **Company name:** write "Toshi Automation Solutions Limited" in full, or "Toshi" when it repeats. Never "TAS" or "TASL".
7. **Emails from kapil@toshiautomation.com end with no sign-off, name, title or website.** Gmail adds the signature.
8. **Language:** in Hindi or Hinglish always use "aap", never "tum". Keep replies short, in bullet points.
9. **Files:** save only in `iCloud Drive/ToshiAgents/`. Never copy passwords, OTPs or credentials anywhere.
10. **Browser:** use the agent's own Chrome profile. One tab, reused. Close extra tabs.
11. **Lean:** no polling, no repeated checks, no research sweeps unless Kapil asks.
12. **WhatsApp to leads or third parties:** goes only through the WhatsApp agent (Kapil's regular WhatsApp, logged in on WhatsApp Web on the Mac mini), and only after Kapil's Haan card. Never WhatsApp Business. Keep it to a few messages a day (ban risk).
13. **Confidential data never goes into GitHub.** Even though kapil-coder/toshi-agents is private, charters, leads, figures and contacts live only in iCloud.
14. **Agents never edit the rule book, CLAUDE.md, settings or the guard hook.** These files are locked. If a rule needs changing, the agent asks Kapil.

## 3. Standing approvals (agents may do these without asking each time)

| Agent | Action | Limit |
|---|---|---|
| LinkedIn Desk | Send the approved special-doors note (exact text in its charter) to recently accepted, in-sector connections with no existing thread | Up to 5 a day |
| LinkedIn Desk | Send connection requests with a short personal note (no links) to target roles in food, pharma, dairy, beverage | 9 to 11 per run, Mon / Wed / Fri only |
| LinkedIn Desk | Reply warmly and briefly to unanswered comments on Kapil's 3 newest posts | Evening run only |

Everything else needs a "Haan": lead replies, sending the intro PDF or catalogue, emails, follow-ups, WhatsApp, file sharing.

## 4. Approval matrix

| Action | Rule |
|---|---|
| Read Gmail, Zoho, iCloud files, LinkedIn | Allowed |
| Create or update Gmail draft (any agent, when asked) | Allowed, no prompt |
| Send, reply or forward email (any agent, when Kapil asks) | "Needs your OK" card; sends only after Haan |
| Delete or trash any email or draft | Ask Kapil |
| Zoho Books / Zoho CRM create, edit, delete | Blocked |
| LinkedIn standing approvals (section 3) | Allowed within limits |
| Any other LinkedIn message | Ask Kapil |
| Payments, bids, signing anything | Never |

## 4b. Schedules and notifications (v0.6)

- Any agent can run a task on its own at set IST times (app → ⏰ Schedules). Same rules as chat: drafts and reads run; sends, deletes and anything outgoing wait for Kapil's Haan card.
- A run starts within 10 minutes of its time, once per day per time. If the Mac mini is off, that run is skipped.
- Phone notification (ntfy app) says only "<agent> finished" or "<agent> needs your Haan". No business data is sent.
- Agents may use only the folders listed in app → ⚙️ Settings. ~/Library system folders are never allowed.

## 4c. Handoffs between agents (v0.8, decision 09-11-2026)

- Any agent may pass work to another agent (`node chat-app/handoff.js`). Kapil relaxed the old rule so LinkedIn Desk and others can hand WhatsApp work to the WhatsApp agent.
- Another agent's instruction is never Kapil's approval. Sends still need Kapil's Haan card; the guard hook enforces it for WhatsApp browser sends.
- Max 3 hops, max 20 handoffs per agent per hour. Every handoff shows in both chats.

## 5. Agents (v0.1)

| Agent | Job | Status | How to run |
|---|---|---|---|
| Investor Desk | Japan-first strategic minority fundraising support | Paused until Kapil says resume | `/investor-resume` |
| LinkedIn Desk | LinkedIn desk + email prospecting drafts | Manual runs (no schedule yet) | `/linkedin-evening`, `/prospecting-morning` |

## 6. Decisions recorded on 08-11-2026

1. WhatsApp: the future agent bot is for Kapil only. Leads get WhatsApp only from Kapil's own phone.
2. Doors note: auto-send up to 5 a day (standing approval).
3. Connects: 9 to 11 per run, 3 times a week (Mon / Wed / Fri).
4. Kavya's Daily Inbound & RFQ Report: discontinued. Agents no longer look for it.
5. No cloud computer (09-11-2026): the Mac mini at home is Toshi's only agent computer. Data stays on Kapil's Mac and iCloud.
6. Mac mini stays ON always (09-11-2026): never shut down, sleep or log out. Restarts only for updates; the app auto-starts after.

## 7. Roadmap

- v0.1: two agents, run by hand from Claude Code on the Mac mini.
- v0.2: schedules (launchd): LinkedIn evening 19:00 IST, prospecting 10:20 IST weekdays. Remote Control from iPhone and MacBook Air.
- v0.3: chat app on the Mac mini + WhatsApp Business bot for Kapil.
- Next: import 5 more Grok agents.

## Revision log

| Rev | Date | Change |
|---|---|---|
| v0.1 rev A | 08-11-2026 | First rule book. Investor Desk and LinkedIn Desk. Decisions 1 to 4. |
| v0.3 rev B | 09-11-2026 | Rule 14: rule book, CLAUDE.md, settings and guard hook locked against agent edits. Local Diwali Bot exception (agent-made) not kept. |
| v0.3 rev A | 09-11-2026 | v0.8: handoffs between agents, WhatsApp via WhatsApp agent after Haan (rule 12 relaxed), rename agents, 🖥 Live screen. Guard hook v0.3. |
| v0.2 rev D | 09-11-2026 | App v0.7 rev C: delete (archive) user-made agents from ⚙️ Settings. |
| v0.2 rev C | 09-11-2026 | Suggestion buttons removed from chat (app v0.7 rev B). Decision 6: Mac mini always on. |
| v0.2 rev B | 09-11-2026 | v0.7: own browser profile and working folder per agent; 🖥 Watch Mac screen. |
| v0.2 rev A | 09-11-2026 | v0.6: Schedules, phone notifications (ntfy), folder access screen. |
| v0.1 rev F | 09-11-2026 | All agents may create/update Gmail drafts when asked; sending works after Haan card (guard hook v0.2). |
| v0.1 rev E | 09-11-2026 | Auto-start (launchd) and private phone/MacBook access via Tailscale (v0.5 rev A). |
| v0.1 rev D | 08-11-2026 | Chat app v0.4 rev C: file upload (📎 / drag and drop) for every agent; upload folders added to agent instructions. |
| v0.1 rev C | 08-11-2026 | Chat app v0.4 rev A added (localhost:3737), same look as the approved mock. |
| v0.1 rev B | 08-11-2026 | App home moved to iCloud Drive/ToshiAgents/app with local git version history (Option A). |
