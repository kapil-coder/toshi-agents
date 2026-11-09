#!/bin/bash
# Toshi Bot browser tool launcher v0.9 rev B (09-11-2026)
# Each agent has its own "computer": a hidden (headless) Chrome with its own profile,
# started once and kept running, so nothing pops up on Kapil's screen.
# The app shows it live in the bot window (🔴 Live). Set TOSHI_SHOW_BROWSER=1 to see the window instead.
P="${TOSHI_BROWSER_PROFILE:-$HOME/.toshi-agents/chrome-profile}"
O="${TOSHI_BROWSER_OUTPUT:-$HOME/.toshi-agents/browser-output}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$P" "$O"
PORT=$(( 9300 + $(printf '%s' "$P" | cksum | cut -d' ' -f1) % 500 ))
up() { curl -s -m 1 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; }
if ! up; then
  # close an old visible window still using this profile (from before v0.9), so the hidden one can start
  pkill -f -- "--user-data-dir=$P" 2>/dev/null; sleep 1
  VER=$("$CHROME" --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)+' | head -1)
  UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${VER:-130.0.0.0} Safari/537.36"
  MODE="--headless=new"; [ "$TOSHI_SHOW_BROWSER" = "1" ] && MODE=""
  nohup "$CHROME" $MODE --remote-debugging-port="$PORT" --remote-debugging-address=127.0.0.1 \
    --user-data-dir="$P" --window-size=1400,900 --no-first-run --no-default-browser-check \
    --user-agent="$UA" about:blank >/dev/null 2>&1 &
  for i in $(seq 1 60); do up && break; sleep 0.25; done
fi
printf '%s' "$PORT" > "$P/.toshi-port" 2>/dev/null
exec npx -y @playwright/mcp@0.0.83 --cdp-endpoint "http://127.0.0.1:$PORT" --output-dir "$O"
