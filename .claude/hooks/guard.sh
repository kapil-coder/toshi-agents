#!/bin/bash
# Toshi Agents guard hook v0.2 rev A (09-11-2026)
# Runs before every MCP tool call (PreToolUse).
#  1. Zoho Books / Zoho CRM writes: always BLOCKED (rule book: read-only).
#  2. Tools Kapil approved with "Haan" in the chat app (env TOSHI_ALLOW): allowed.
#  3. Sends, replies, forwards, deletes, trash, spam, file shares, Apollo writes: ask Kapil.
#  4. Gmail drafts (create/update) and read-only Gmail/Zoho lookups: allowed, no prompt.
# Plain bash 3.2 + grep/sed so it works on a stock Mac (no jq/python needed).

input=$(cat)
tool=$(printf '%s' "$input" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
t=$(printf '%s' "$tool" | tr '[:upper:]' '[:lower:]')

decide() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}\n' "$1" "$2"
  exit 0
}

# 1. Zoho writes: never
case "$t" in
  *zoho*)
    if printf '%s' "$t" | grep -Eq 'create|update|delete|upsert|convert|post|add|delink|insert|remove|merge'; then
      decide deny "Toshi rule book: Zoho Books and Zoho CRM are read-only. Blocked: $tool"
    fi
    ;;
esac

# 2. Approved by Kapil in the chat app for this one run
for a in $TOSHI_ALLOW; do
  [ "$a" = "$tool" ] && decide allow "Approved by Kapil (Haan): $tool"
done

# 3. Outgoing or destructive: ask Kapil
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

# 4. Drafts and read-only lookups: allowed without a prompt
case "$t" in
  *gmail*)
    if printf '%s' "$t" | grep -Eq 'create_draft|update_draft|get_draft|list_drafts|search|get_|list_'; then
      decide allow "Toshi rule book: Gmail drafts and reading are allowed: $tool"
    fi
    ;;
  *zoho*)
    if printf '%s' "$t" | grep -Eq 'get|list|search|query|fetch'; then
      decide allow "Toshi rule book: Zoho read-only lookup: $tool"
    fi
    ;;
esac

exit 0
