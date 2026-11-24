#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

stamp="$(date +%Y%m%d-%H%M%S)"
out="artifacts/device-backup-$stamp"
mkdir -p "$out"

adb shell pm path com.wesbos.homehq | sed 's/^package://' | tr -d '\r' > "$out/apk-path.txt"
apk_path="$(cat "$out/apk-path.txt")"
adb pull "$apk_path" "$out/homehq-previous.apk"
adb shell am force-stop com.wesbos.homehq
adb exec-out "su -c 'tar -C /data/data/com.wesbos.homehq -czf - files shared_prefs app_webview'" > "$out/homehq-data.tgz"
tar -tzf "$out/homehq-data.tgz" | grep -i 'app_webview/.*local storage' >/dev/null
sha256sum "$out"/* > "$out/SHA256SUMS"
chmod -R go-rwx "$out"
echo "Backup written to $out (ignored by Git)"
