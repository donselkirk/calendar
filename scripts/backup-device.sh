#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

stamp="$(date +%Y%m%d-%H%M%S)"
out="artifacts/device-backup-$stamp"
mkdir -p "$out"

adb shell pm path com.wesbos.homehq | sed 's/^package://' | tr -d '\r' > "$out/apk-path.txt"
apk_path="$(cat "$out/apk-path.txt")"
adb pull "$apk_path" "$out/homehq-previous.apk"
adb shell su -c "am force-stop com.wesbos.homehq; tar -C /data/data/com.wesbos.homehq -czf /data/local/tmp/homehq-data.tgz files shared_prefs app_webview/databases 2>/dev/null || tar -C /data/data/com.wesbos.homehq -czf /data/local/tmp/homehq-data.tgz files shared_prefs"
adb pull /data/local/tmp/homehq-data.tgz "$out/homehq-data.tgz"
adb shell su -c "rm /data/local/tmp/homehq-data.tgz"
sha256sum "$out"/* > "$out/SHA256SUMS"
chmod -R go-rwx "$out"
echo "Backup written to $out (ignored by Git)"
