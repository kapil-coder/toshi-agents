#!/bin/bash
# Toshi Agents Mac mini setup v0.1 rev B (08-11-2026)
# Location: iCloud Drive/ToshiAgents/app (private, synced). Local git for version history.
# Safe to run more than once. Creates folders and links only; installs nothing.

set -e
cd "$(dirname "$0")/.."
PROJECT="$(pwd)"
ICLOUD="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
BASE="$ICLOUD/ToshiAgents"
ok()   { printf '  [OK]   %s\n' "$1"; }
todo() { printf '  [TODO] %s\n' "$1"; MISSING=1; }
MISSING=0

echo "Toshi Agents setup v0.1 rev B"
echo "Project: $PROJECT"
echo
echo "1. Software check"
[ "$(uname)" = "Darwin" ] && ok "macOS $(sw_vers -productVersion)" || { echo "  This script is for macOS only."; exit 1; }
if command -v claude >/dev/null 2>&1; then ok "Claude Code $(claude --version 2>/dev/null | head -1)"
else todo "Install Claude Code:  curl -fsSL https://claude.ai/install.sh | bash"; fi
if command -v npx >/dev/null 2>&1; then ok "Node.js $(node --version)"
else todo "Install Node.js LTS from https://nodejs.org (needed for the browser tool)"; fi
if [ -d "/Applications/Google Chrome.app" ]; then ok "Google Chrome found"
else todo "Install Google Chrome (the LinkedIn agent uses its own Chrome profile)"; fi

echo
echo "2. iCloud folders"
if [ ! -d "$ICLOUD" ]; then
  echo "  iCloud Drive not found at: $ICLOUD"
  echo "  Turn on iCloud Drive in System Settings > Apple Account > iCloud, then run again."
  exit 1
fi
mkdir -p "$BASE/investor-desk/docs" "$BASE/linkedin-desk/status" "$BASE/shared"
ok "iCloud Drive/ToshiAgents ready"
ln -sfn "$BASE" "$PROJECT/icloud"
ok "Link created: icloud -> iCloud Drive/ToshiAgents"
mkdir -p "$HOME/.toshi-agents/chrome-profile" "$HOME/.toshi-agents/browser-output"
ok "Agent Chrome profile folder ready (~/.toshi-agents)"
if [ ! -e "$HOME/toshi-agents" ]; then
  ln -s "$PROJECT" "$HOME/toshi-agents"
  ok "Shortcut created: ~/toshi-agents -> this app folder"
else
  ok "Shortcut ~/toshi-agents already exists"
fi
echo "  Tip: in Finder, right-click iCloud Drive > ToshiAgents > Keep Downloaded, so files never go cloud-only."

echo
echo "3. Local settings"
if [ ! -f "$PROJECT/.claude/settings.local.json" ]; then
  cat > "$PROJECT/.claude/settings.local.json" <<JSON
{
  "permissions": {
    "additionalDirectories": ["$BASE"]
  }
}
JSON
  ok "Created .claude/settings.local.json (agents may read/write iCloud/ToshiAgents)"
else
  ok ".claude/settings.local.json already exists (left unchanged)"
fi
chmod +x "$PROJECT/.claude/hooks/guard.sh"
ok "Guard hook ready"

echo
echo "4. Version history (local git, no GitHub needed)"
if xcode-select -p >/dev/null 2>&1 && command -v git >/dev/null 2>&1; then
  if [ ! -d "$PROJECT/.git" ]; then
    git -C "$PROJECT" init -q
    git -C "$PROJECT" add -A
    git -C "$PROJECT" -c user.name="Kapil Sachdev" -c user.email="kapil@toshiautomation.com" commit -q -m "Toshi Agents v0.1 rev B"
    ok "Version history started (first save: v0.1 rev B)"
  else
    ok "Version history already on ($(git -C "$PROJECT" log --oneline | wc -l | tr -d ' ') saves)"
  fi
else
  todo "Install Apple developer tools for git:  xcode-select --install   (then run this again)"
fi

echo
echo "5. Private files (copy these into iCloud Drive/ToshiAgents)"
check() { [ -f "$BASE/$1" ] && ok "$1" || todo "$1   ($2)"; }
check "investor-desk/charter.md"  "Toshi_Investor_Handover_08-11-2026.md, renamed"
check "linkedin-desk/charter.md"  "LinkedIn_Prospecting_Handover_Charter_08-11-2026.md, renamed"
check "linkedin-desk/Toshi_Automation_Introduction.pdf" "intro PDF"
check "linkedin-desk/Toshi_Product_Catalogue_2026_Concise.jpg" "concise catalogue"
[ -f "$BASE/linkedin-desk/leads.md" ] && ok "linkedin-desk/leads.md" || echo "  [opt]  linkedin-desk/leads.md (open leads; the agent can create it from the charter)"

echo
if [ "$MISSING" = "0" ]; then
  echo "All set. Start with:  cd ~/toshi-agents && claude"
else
  echo "Finish the [TODO] items above, then run this script again."
fi
