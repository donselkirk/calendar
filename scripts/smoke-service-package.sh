#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(sed -n 's/^VERSION_NAME=//p' service/version.properties)
temp=$(mktemp -d)
worker=
trap 'if [[ -n $worker ]]; then kill "$worker" || true; wait "$worker" || true; fi; rm -r -- "$temp"' EXIT
mkdir "$temp/release"
python3 scripts/release-assets.py unpack "artifacts/service-v$version/homehq-service-v$version-amd64.tar.gz" "$temp/release"
ln -s "$temp/release" "$temp/current"
export HOMEHQ_DB="$temp/test.sqlite3" HOMEHQ_CONFIG="$temp/config.json" HOMEHQ_PORT=14174
printf '%s\n' '{"people":[{"id":"person-1","name":"Example","color":"#2D5BFF","ink":"#FFFFFF"}]}' > "$HOMEHQ_CONFIG"
"$temp/current/node" "$temp/current/service/server.mjs" migrate
printf '%s\n' '{"events":[{"id":"example","title":"Example event","people":["person-1"],"allDay":true,"start":"2026-11-24T05:00:00.000Z","end":"2026-11-25T05:00:00.000Z"}]}' > "$temp/export.json"
"$temp/current/node" "$temp/current/service/import.mjs" "$temp/export.json" --dry-run > "$temp/report"
grep -F '"applied": false' "$temp/report"
"$temp/current/node" "$temp/current/service/server.mjs" &
worker=$!
curl -fsS --retry 10 --retry-connrefused http://127.0.0.1:14174/readyz | grep '"kioskProtocol":1'
curl -fsS http://127.0.0.1:14174/api/v1/events | grep '"events":\[\]'
"$temp/current/node" "$temp/current/service/import.mjs" "$temp/export.json" --apply > "$temp/report"
grep -F '"applied": true' "$temp/report"
curl -fsS http://127.0.0.1:14174/api/v1/events | grep -F 'Example event'
curl -fsS -H 'Range: bytes=0-7' http://127.0.0.1:14174/weather/clear.mp4 -o "$temp/range"
[[ $(wc -c < "$temp/range") = 8 ]]
