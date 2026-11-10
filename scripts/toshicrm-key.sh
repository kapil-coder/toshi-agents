#!/bin/bash
# Toshi Bot: save the Prabhu ToshiCrm (Supabase) secret key in macOS Keychain (v1.0 rev A, 10-11-2026)
# The key is typed hidden, stored only in Keychain, never in files or git.
echo "Supabase → project 'toshicrm' → Project Settings → API Keys → copy the SECRET key (service_role / sb_secret_...)."
printf "Paste the key here (it will not show) and press Enter: "
read -rs KEY; echo
[ -z "$KEY" ] && { echo "No key entered. Nothing saved."; exit 1; }
security add-generic-password -U -s toshicrm-supabase -a toshibot -w "$KEY" && echo "Saved in Keychain ✓"
unset KEY
# quick test (reads 1 account name)
TOSHICRM_TEST=1 node "$(dirname "$0")/../chat-app/toshicrm-mcp.js" --test
