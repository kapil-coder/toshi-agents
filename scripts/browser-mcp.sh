#!/bin/bash
# Toshi Agents browser tool launcher v0.7 rev A (09-11-2026)
# Each agent gets its own Chrome profile (set by the chat app in TOSHI_BROWSER_PROFILE),
# so two agents browsing at the same time don't clash. Default = the shared profile
# (keeps the existing LinkedIn login for LinkedIn Desk, Mr. C and Terminal use).
P="${TOSHI_BROWSER_PROFILE:-$HOME/.toshi-agents/chrome-profile}"
O="${TOSHI_BROWSER_OUTPUT:-$HOME/.toshi-agents/browser-output}"
mkdir -p "$P" "$O"
exec npx -y @playwright/mcp@0.0.83 --browser chrome --user-data-dir "$P" --output-dir "$O"
