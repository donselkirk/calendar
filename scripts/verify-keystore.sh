#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

keystore="${HOMEHQ_KEYSTORE_PATH:?HOMEHQ_KEYSTORE_PATH is required}"
alias_name="${HOMEHQ_KEY_ALIAS:?HOMEHQ_KEY_ALIAS is required}"
: "${HOMEHQ_KEYSTORE_PASSWORD:?HOMEHQ_KEYSTORE_PASSWORD is required}"
test -f "$keystore"

expected="$(sed -n 's/^SIGNING_CERT_SHA256=//p' release.properties | tr '[:lower:]' '[:upper:]')"
actual="$(
  keytool -list -v \
    -keystore "$keystore" \
    -storepass:env HOMEHQ_KEYSTORE_PASSWORD \
    -alias "$alias_name" |
    sed -n 's/^[[:space:]]*SHA256: //p' |
    head -n1 |
    tr -d ':' |
    tr '[:lower:]' '[:upper:]'
)"

if [ "$actual" != "$expected" ]; then
  echo "Signing keystore mismatch: expected $expected, got ${actual:-<unreadable>}" >&2
  exit 1
fi

echo "Verified signing keystore certificate $actual"
