#!/bin/bash
# Toshi Agents guard hook v0.1 rev A (08-11-2026)
# Runs before every MCP tool call (PreToolUse).
#  - Blocks any Zoho Books / Zoho CRM write (rule book: read-only).
#  - Forces Kapil's approval prompt for sends, replies, forwards, deletes,
#    trash, spam marks, file shares and Apollo writes.
# Plain bash 3.2 + grep/sed so it works on a stock Mac (no jq/python needed).

input=$(cat)
tool=$(printf '%s' "$input" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
t=$(printf '%s' "$tool" | tr '[:upper:]' '[:lower:]')

decide() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' "$1" "$2"
  exit 0
}

case "$t" in
  *zoho*)
    if printf '%s' "$t" | grep -Eq 'create|update|delete|upsert|convert|post|add|delink|insert|remove|merge'; then
      decide deny "Toshi rule book: Zoho Books and Zoho CRM are read-only. Blocked: $tool"
    fi
    ;;
esac

if printf '%s' "$t" | grep -Eq 'send|reply|forward|trash|delete|spam|share_file'; then
  decide ask "Toshi rule book: outgoing or destructive action, Kapil must approve: $tool"
fi

case "$t" in
  *apollo*)
    if printf '%s' "$t" | grep -Eq 'create|update|add|remove|approve|purchase|merge'; then
      decide ask "Toshi rule book: Apollo write, Kapil must approve: $tool"
    fi
    ;;
esac

exit 0
