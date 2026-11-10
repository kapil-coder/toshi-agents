#!/bin/bash
# Fake Claude CLI for smoke tests (no real AI calls)
if [ "$1" = "--version" ]; then echo "2.1.296 (Claude Code)"; exit 0; fi
if [[ "$*" == *"--output-format json"* ]]; then echo '{"type":"result","result":"{\"name\":\"Test Bot\",\"job\":\"test\"}"}'; exit 0; fi
# v1.6 queue test: a message containing "slowtask" takes 3 s; reply echoes the message
last="${@: -1}"; [[ "$last" == *slowtask* ]] && sleep 3
echo '{"type":"system","subtype":"init","session_id":"t1","tools":["Read","mcp__playwright__browser_click","mcp__claude_ai_Gmail__send_message"]}'
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Smoke test reply: '"${last//[^a-z0-9 ]/}"'"}]}}'
echo '{"type":"result","subtype":"success","session_id":"t1","permission_denials":[],"total_cost_usd":0.01,"num_turns":1}'
