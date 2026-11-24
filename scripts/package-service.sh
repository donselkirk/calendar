#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(sed -n 's/^VERSION_NAME=//p' service/version.properties)"
commit="$(git rev-parse HEAD)"
out="artifacts/service-v$version"
file="homehq-service-v$version-amd64.tar.gz"
[[ $(node -p 'process.platform + "/" + process.arch') = linux/x64 && -f web/dist/index.html ]]
mkdir -p "$out"
stage=$(mktemp -d)
trap 'rm -r -- "$stage"' EXIT
install -d "$stage/service" "$stage/web/js"
install -m 0755 "$(node -p process.execPath)" "$stage/node"
install -m 0644 LICENSE "$stage/"
cp service/{server,db,feeds,config,import,entrypoint}.mjs service/version.properties "$stage/service/"
cp web/package.json "$stage/web/"
cp web/js/{toronto,holiday-dates}.js "$stage/web/js/"
cp -r web/dist "$stage/web/"
tar -C "$stage" -czf "$out/$file" LICENSE node service web
(cd "$out" && sha256sum "$file" > SHA256SUMS)
python3 - "$out" "$file" "$version" "$commit" <<'PY'
import json, sys
from pathlib import Path
out, name, version, commit = sys.argv[1:]
root = Path(out)
(root / "service-update-manifest.json").write_text(json.dumps({
    "schemaVersion": 1, "version": version, "artifact": name,
    "commit": commit, "sha256": (root / "SHA256SUMS").read_text().split()[0],
}, indent=2) + "\n")
PY
