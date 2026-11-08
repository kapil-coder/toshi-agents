# Toshi Agents

Version: v0.1 rev B | 08-11-2026 | Runs on: Mac mini M4 (macOS Tahoe 26.5.1) with Claude Code

Claude Code agents migrated from Grok. Rules are in [RULEBOOK.md](RULEBOOK.md).

| Agent | File | Status |
|---|---|---|
| Investor Desk v0.1 | `.claude/agents/investor-desk.md` | Paused until you run `/investor-resume` |
| LinkedIn Desk v0.1 | `.claude/agents/linkedin-desk.md` | Manual runs |

**This repo is public.** Charters, leads, figures and contacts stay in iCloud Drive only (`icloud/` is a local link and is never committed).

## One-time setup on the Mac mini (baby steps, about 20 minutes)

Home of the app: **iCloud Drive → ToshiAgents → app** (private, synced, backed up). No GitHub needed.

1. Download `toshi-agents-v0.1-revB.zip` on the Mac mini.
2. Double-click the zip. You get a folder called `toshi-agents`.
3. Open **Finder → iCloud Drive**. Make a folder **ToshiAgents**. Inside it, drag the `toshi-agents` folder and rename it **app**.
4. Right-click **ToshiAgents** → **Keep Downloaded**.
5. Copy your private files into **iCloud Drive → ToshiAgents** (the setup script creates the subfolders on the first run; then copy):
   - `investor-desk/charter.md` = Toshi_Investor_Handover_08-11-2026.md (renamed)
   - `linkedin-desk/charter.md` = LinkedIn_Prospecting_Handover_Charter_08-11-2026.md (renamed)
   - `linkedin-desk/Toshi_Automation_Introduction.pdf`
   - `linkedin-desk/Toshi_Product_Catalogue_2026_Concise.jpg`
6. Open **Terminal** (Cmd + Space, type Terminal, Enter) and paste:
   ```
   cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/ToshiAgents/app && ./scripts/setup-mac.sh
   ```
7. Fix every `[TODO]` it shows, then run it again with:
   ```
   ~/toshi-agents/scripts/setup-mac.sh
   ```
8. Start Claude Code:
   ```
   cd ~/toshi-agents && claude
   ```
   - Sign in with your Claude account. Approve the **playwright** browser tool once.
   - Type `/mcp` to check Gmail, Zoho CRM, Zoho Books, Apollo. Missing one? claude.ai → Settings → Connectors.
9. Type `open linkedin.com in the browser`. A Chrome window opens. **You** log in to LinkedIn yourself.
10. Test: type `/investor-resume` or `/linkedin-evening`.

## Chat app (looks like the mock)

```
~/toshi-agents/scripts/start-app.sh
```
- Opens **http://localhost:3000** in your browser: agents sidebar, chat window, live panel, Add Agent screen.
- Keep that Terminal window open while you use the app. Ctrl+C stops it.
- "Needs your OK" cards = your Haan. "Always allow" only works for read-only tools; sends always ask.
- Chats are saved in iCloud Drive/ToshiAgents/chats.
- Phone and MacBook access comes in v0.5 (Tailscale).

## Daily use (Terminal way)

Open Terminal, then:
```
cd ~/toshi-agents && claude
```

| Type this | What happens |
|---|---|
| `/linkedin-evening` | Connects (Mon/Wed/Fri, 9 to 11), comment replies, up to 5 doors notes, inbound list, status saved to iCloud |
| `/prospecting-morning` | Arjun's report → CRM/Gmail check → Apollo → cold intro drafts (nothing sent) |
| `/investor-resume` | Wakes Investor Desk; it asks you 3 first-step questions |
| Plain Hinglish | e.g. "aaj kaun se leads pending hain?" Claude picks the right agent |

When Claude asks permission for a send, reply or delete, that prompt **is** your "Haan". Choose Yes to send, No to stop.

## Safety built in

- **Guard hook** (`.claude/hooks/guard.sh`): blocks every Zoho Books / Zoho CRM write, and forces your approval for any send, reply, forward, delete, trash, file share or Apollo write.
- **Browser** runs in its own Chrome profile (`~/.toshi-agents/chrome-profile`), separate from your personal Chrome.
- The browser tool is pre-approved so the standing LinkedIn actions (doors notes, connects, comment replies) can run without a prompt for every click. The agent stops on any CAPTCHA, limit or warning.

## Versions

| Component | Version |
|---|---|
| Rule book | v0.1 rev A |
| Guard hook | v0.1 rev A |
| Setup script | v0.1 rev B |
| Chat app | v0.4 rev A |
| Playwright MCP | 0.0.83 (pinned in `.mcp.json`) |
| Claude Code | 2.1.x (run `claude update`) |

## Updates and version history

- New revisions arrive as a zip. Copy the files over the app folder, then save a version:
  ```
  cd ~/toshi-agents && git add -A && git commit -m "v0.x rev Y"
  ```
- See all saved versions: `git log --oneline`
- GitHub (private repo) can be added later; the full history goes up in one push.

## Roadmap

- v0.2: automatic schedules (launchd), Remote Control from iPhone and MacBook Air.
- v0.3: chat app + WhatsApp bot for you.
- Next: 5 more Grok agents.
