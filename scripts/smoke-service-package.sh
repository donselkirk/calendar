#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(sed -n 's/^VERSION_NAME=//p' service/version.properties)
temp=$(mktemp -d)
worker=
trap 'if [[ -n $worker ]]; then kill "$worker" || true; wait "$worker" || true; fi; rm -r -- "$temp"' EXIT
python3 scripts/release-assets.py unpack "artifacts/service-v$version/homehq-service-v$version-amd64.tar.gz" "$temp"
export HOMEHQ_DB="$temp/test.sqlite3" HOMEHQ_CONFIG="$temp/absent.json" HOMEHQ_PORT=14174
"$temp/node" "$temp/service/server.mjs" migrate
"$temp/node" "$temp/service/server.mjs" &
worker=$!
curl -fsS --retry 10 --retry-connrefused http://127.0.0.1:14174/readyz | grep '"kioskProtocol":1'
curl -fsS http://127.0.0.1:14174/api/v1/events | grep '"events":\[\]'
curl -fsS -H 'Range: bytes=0-7' http://127.0.0.1:14174/weather/clear.mp4 -o "$temp/range"
[[ $(wc -c < "$temp/range") = 8 ]]
