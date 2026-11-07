#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  if git grep -I -n -E "$pattern" -- . ':!scripts/privacy-scan.sh' ':!device-config.example.json'; then
    echo "privacy scan matched prohibited pattern: $pattern" >&2
    fail=1
  fi
done <<'PATTERNS'
api/places/[0-9A-Fa-f-]{20,}
"placeId"[[:space:]]*:[[:space:]]*"[0-9A-Fa-f-]{20,}"
BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY
storePassword[[:space:]]*=[[:space:]]*[^$]
keyPassword[[:space:]]*=[[:space:]]*[^$]
PATTERNS

if git ls-files | grep -E '(^|/)(backups?|diagnostics?|frames?)/|\.(apk|jks|keystore|tar|tgz)$'; then
  echo "privacy scan found a prohibited tracked file" >&2
  fail=1
fi

exit "$fail"
