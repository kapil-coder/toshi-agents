#!/bin/bash
# Fake Claude CLI for smoke tests (no real AI calls)
if [ "$1" = "--version" ]; then echo "2.1.296 (Claude Code)"; exit 0; fi
if [[ "$*" == *"--output-format json"* ]]; then echo '{"type":"result","result":"{\"name\":\"Test Bot\",\"job\":\"test\"}"}'; exit 0; fi
echo '{"type":"system","subtype":"init","session_id":"t1","tools":["Read","mcp__playwright__browser_click","mcp__claude_ai_Gmail__send_message"]}'
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Smoke test reply"}]}}'
echo '{"type":"result","subtype":"success","session_id":"t1","permission_denials":[],"total_cost_usd":0.01,"num_turns":1}'
