#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(sed -n 's/^VERSION_NAME=//p' android/version.properties)"
code="$(sed -n 's/^VERSION_CODE=//p' android/version.properties)"
out="artifacts/app-v$version"
mkdir -p "$out"
cp android/app/build/outputs/apk/release/app-release.apk "$out/homehq-v$version.apk"
python3 - "$out" "$version" "$code" "$(sed -n 's/^SIGNING_CERT_SHA256=//p' release.properties)" <<'PY'
import hashlib, json, subprocess, sys
from pathlib import Path
out, version, code, cert = sys.argv[1:]
name = f"homehq-v{version}.apk"
digest = hashlib.file_digest((Path(out) / name).open("rb"), "sha256").hexdigest()
notes = subprocess.check_output(["bash", "scripts/changelog-section.sh", version, "app"], text=True).strip()
(Path(out) / "app-update-manifest.json").write_text(json.dumps({
    "schemaVersion": 1, "versionName": version, "versionCode": int(code),
    "apkAsset": name, "sha256": digest, "signingCertSha256": cert.lower(), "notes": notes,
}, indent=2) + "\n")
PY
