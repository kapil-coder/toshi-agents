#!/bin/bash
# Fake Claude CLI for smoke tests (no real AI calls)
if [ "$1" = "--version" ]; then echo "2.1.296 (Claude Code)"; exit 0; fi
if [[ "$*" == *"--output-format json"* ]]; then echo '{"type":"result","result":"{\"name\":\"Test Bot\",\"job\":\"test\"}"}'; exit 0; fi
# v1.6 queue test: a message containing "slowtask" takes 3 s; reply echoes the message
last="${@: -1}"; [[ "$last" == *slowtask* ]] && sleep 3
[[ "$last" == *sessiontest* && "$*" == *--resume* ]] && { echo "No conversation found with session ID: t1" >&2; exit 1; }
if [[ "$last" == *yaadtest* ]]; then echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Theek hai\n🧠 MEMORY+: GST 18% alag dikhana\n🧠 MEMORY+ shared: Saurabh Nigam partner hai"}]}}'; echo '{"type":"result","subtype":"success","session_id":"t1","permission_denials":[]}'; exit 0; fi
if [[ "$last" == *memcheck* ]]; then m=no; [[ "$*" == *"GST 18% alag dikhana"* && "$*" == *"Saurabh Nigam partner"* ]] && m=yes; echo '{"type":"assistant","message":{"content":[{"type":"text","text":"memory seen '$m'"}]}}'; echo '{"type":"result","subtype":"success","session_id":"t1","permission_denials":[]}'; exit 0; fi
[[ "$last" == *failtest* ]] && { echo "Claude usage limit reached (fake)" >&2; exit 1; }
echo '{"type":"system","subtype":"init","session_id":"t1","tools":["Read","mcp__playwright__browser_click","mcp__claude_ai_Gmail__send_message"]}'
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Smoke test reply: '"${last//[^a-z0-9 ]/}"'"}]}}'
echo '{"type":"result","subtype":"success","session_id":"t1","permission_denials":[],"total_cost_usd":0.01,"num_turns":1}'
