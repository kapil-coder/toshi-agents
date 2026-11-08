#!/bin/bash
# Toshi Agents chat app launcher v0.4 rev A (08-11-2026)
cd "$(dirname "$0")/.."
( sleep 2; open "http://localhost:3000" ) &
exec node chat-app/server.js
