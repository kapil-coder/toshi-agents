#!/bin/bash
# Toshi Agents: auto-start + phone access v0.5 rev A (09-11-2026)
# - Starts the chat app automatically at login, restarts it if it stops (launchd)
# - Shares it privately to your Tailscale devices (iPhone, MacBook Air)
# Safe to run again. To remove auto-start: ./scripts/install-autostart.sh --remove

set -e
cd "$(dirname "$0")/.."
PROJECT="$(pwd -P)"
LABEL="com.toshi.agents"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/.toshi-agents/app.log"
PORT=3737
ok()  { printf '  [OK]   %s\n' "$1"; }
bad() { printf '  [FIX]  %s\n' "$1"; }

if [ "$1" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"; echo "Auto-start removed."; exit 0
fi

echo "Toshi Agents auto-start v0.5 rev A"
NODE="$(command -v node || true)"; CLAUDE="$(command -v claude || true)"
[ -n "$NODE" ] && ok "Node: $NODE" || { bad "Node.js not found"; exit 1; }
[ -n "$CLAUDE" ] && ok "Claude Code: $CLAUDE" || { bad "Claude Code not found"; exit 1; }
mkdir -p "$HOME/.toshi-agents" "$HOME/Library/LaunchAgents"
APP_PATH="$(dirname "$NODE"):$(dirname "$CLAUDE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Stop a copy started by hand in Terminal, so the port is free
pkill -f "$PROJECT/chat-app/server.js" 2>/dev/null || pkill -f "node chat-app/server.js" 2>/dev/null || true
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 1

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$PROJECT/chat-app/server.js</string></array>
  <key>WorkingDirectory</key><string>$PROJECT</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$APP_PATH</string>
    <key>HOME</key><string>$HOME</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
launchctl bootstrap "gui/$(id -u)" "$PLIST"
ok "Auto-start installed (starts at login, restarts if it stops)"

printf '  ....   Waiting for the app'
for i in 1 2 3 4 5 6 7 8; do sleep 1; printf '.'; curl -s -o /dev/null "http://127.0.0.1:$PORT/api/status" && break; done; echo
if curl -s -o /dev/null "http://127.0.0.1:$PORT/api/status"; then
  ok "App running: http://localhost:$PORT"
else
  bad "App did not start. Last log lines:"; tail -n 15 "$LOG" 2>/dev/null | sed 's/^/         /'
  if grep -q "EPERM\|Operation not permitted" "$LOG" 2>/dev/null; then
    echo "         macOS blocked iCloud access. Fix: System Settings > Privacy & Security >"
    echo "         Full Disk Access > + > press Cmd+Shift+G, paste $NODE > Open, turn it ON. Then run this script again."
  fi
  exit 1
fi

TS="$(command -v tailscale || true)"
[ -z "$TS" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
if [ -z "$TS" ]; then bad "Tailscale not found. Install it from the Mac App Store, then run this again."; exit 1; fi
if "$TS" serve --bg "$PORT"; then
  ok "Shared privately on Tailscale"
  NAME="$("$TS" status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)\.\{0,1\}"$/\1/' | sed 's/\.$//')"
  echo
  echo "  Open on iPhone / MacBook Air (Tailscale ON):"
  echo "     https://${NAME:-kapils-mac-mini.tailac1d46.ts.net}"
else
  bad "Tailscale serve failed. If it printed a link to enable HTTPS, open it, click Enable, and run this again."
fi
