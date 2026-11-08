#!/bin/bash
# Toshi Agents chat app launcher v0.4 rev B (08-11-2026)
# Port 3737 (3000 is used by Open WebUI on this Mac). Override: PORT=xxxx
cd "$(dirname "$0")/.."
PORT="${PORT:-3737}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. If Toshi Agents is already running, just open http://localhost:$PORT"
  echo "Otherwise run:  PORT=3838 $0"
  exit 1
fi
( sleep 2; open "http://localhost:$PORT" ) &
PORT="$PORT" exec node chat-app/server.js
