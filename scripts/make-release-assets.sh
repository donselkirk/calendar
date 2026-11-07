#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(sed -n 's/^VERSION_NAME=//p' version.properties)"
code="$(sed -n 's/^VERSION_CODE=//p' version.properties)"
apk="android/app/build/outputs/apk/release/app-release.apk"
out="artifacts/release-$version"
mkdir -p "$out"
cp "$apk" "$out/homehq-v$version.apk"
python3 - "web/dist" "$out/web-v$version.zip" <<'PY'
from pathlib import Path
import sys
import zipfile

source = Path(sys.argv[1])
target = Path(sys.argv[2])
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(source))
PY

sha="$(sha256sum "$out/homehq-v$version.apk" | awk '{print $1}')"
cert="$(sed -n 's/^SIGNING_CERT_SHA256=//p' release.properties | tr '[:upper:]' '[:lower:]')"
notes="$(./scripts/changelog-section.sh "$version" | sed '/^[[:space:]]*$/d')"
python3 - "$version" "$code" "$sha" "$cert" "$notes" "$out/update-manifest.json" <<'PY'
import json, sys
version, code, sha, cert, notes, target = sys.argv[1:]
with open(target, "w", encoding="utf-8") as handle:
    json.dump({"schemaVersion": 1, "versionName": version, "versionCode": int(code),
               "apkAsset": f"homehq-v{version}.apk", "sha256": sha,
               "signingCertSha256": cert, "notes": notes}, handle, indent=2)
    handle.write("\n")
PY
echo "$out"
