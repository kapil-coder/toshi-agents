# Toshi Agents: Golden Rule Book

Version: v0.1 rev D | Date: 08-11-2026 | Owner: Kapil Sachdev | Time zone: IST | Dates: dd-mm-yyyy

This rule book applies to every Toshi agent run with Claude Code on the Mac mini.
Each agent's own charter (kept privately in iCloud) adds detail. If they disagree, the stricter rule wins.

## 1. Software and versions

| Item | Version |
|---|---|
| Mac mini | Apple M4, 16 GB, macOS Tahoe 26.5.1 |
| Claude Code | 2.1.x (keep updated with `claude update`) |
| Node.js | Current LTS (needed for the browser tool) |
| Playwright MCP (browser tool) | 0.0.83 (pinned) |
| Rule book | v0.1 rev D |
| Agents | Investor Desk v0.1, LinkedIn Desk v0.1 |
| Chat app | v0.4 rev D |

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
12. **WhatsApp to leads or third parties:** the agent drafts the text, and Kapil sends it from his own regular WhatsApp. Never from WhatsApp Business.
13. **Confidential data never goes into GitHub.** Even though kapil-coder/toshi-agents is private, charters, leads, figures and contacts live only in iCloud.

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
| Create Gmail draft | Allowed |
| Send, reply or forward email | Ask Kapil (guard hook forces the prompt) |
| Delete or trash any email or draft | Ask Kapil |
| Zoho Books / Zoho CRM create, edit, delete | Blocked |
| LinkedIn standing approvals (section 3) | Allowed within limits |
| Any other LinkedIn message | Ask Kapil |
| Payments, bids, signing anything | Never |

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

## 7. Roadmap

- v0.1: two agents, run by hand from Claude Code on the Mac mini.
- v0.2: schedules (launchd): LinkedIn evening 19:00 IST, prospecting 10:20 IST weekdays. Remote Control from iPhone and MacBook Air.
- v0.3: chat app on the Mac mini + WhatsApp Business bot for Kapil.
- Next: import 5 more Grok agents.

## Revision log

| Rev | Date | Change |
|---|---|---|
| v0.1 rev A | 08-11-2026 | First rule book. Investor Desk and LinkedIn Desk. Decisions 1 to 4. |
| v0.1 rev D | 08-11-2026 | Chat app v0.4 rev C: file upload (📎 / drag and drop) for every agent; upload folders added to agent instructions. |
| v0.1 rev C | 08-11-2026 | Chat app v0.4 rev A added (localhost:3737), same look as the approved mock. |
| v0.1 rev B | 08-11-2026 | App home moved to iCloud Drive/ToshiAgents/app with local git version history (Option A). |
