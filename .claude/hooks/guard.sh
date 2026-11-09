#!/bin/bash
# Toshi Bot guard hook v0.4 rev A (10-11-2026)
# v0.4: TOSHI_AUTOSEND=1 (Kapil's decision 10-11-2026) lets bots send email/WhatsApp/replies without the Haan card.
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

# 2a. Auto-send ON for this bot: sends go out directly (deletes, trash, spam, file shares still ask)
if [ "$TOSHI_AUTOSEND" = "1" ]; then
  if printf '%s' "$t" | grep -Eq 'send|reply|forward' && ! printf '%s' "$t" | grep -Eq 'trash|delete|spam|share_file'; then
    decide allow "Auto-send ON (Kapil 10-11-2026): $tool"
  fi
  case "$t" in *playwright__*) exit 0;; esac
fi

# 2b. WhatsApp-type agents (TOSHI_STRICT_SEND=1): a browser "send" (Enter, submit, Send button) needs Kapil's Haan
if [ "$TOSHI_STRICT_SEND" = "1" ]; then
  case "$t" in
    *playwright__browser_press_key*)
      printf '%s' "$input" | grep -Eiq '"key"[[:space:]]*:[[:space:]]*"(enter|numpadenter)"' && decide ask "WhatsApp send needs Kapil's Haan ($tool)";;
    *playwright__browser_type*|*playwright__browser_fill_form*)
      printf '%s' "$input" | grep -Eiq '"submit"[[:space:]]*:[[:space:]]*true' && decide ask "WhatsApp send needs Kapil's Haan ($tool)";;
    *playwright__browser_click*)
      printf '%s' "$input" | grep -Eiq '"element"[[:space:]]*:[[:space:]]*"[^"]*send' && decide ask "WhatsApp send needs Kapil's Haan ($tool)";;
  esac
fi

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
