#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: rollback-device.sh artifacts/device-backup-TIMESTAMP}"
test -f "$backup/homehq-previous.apk"
test -f "$backup/homehq-data.tgz"

sha256sum -c "$backup/SHA256SUMS"
adb shell am force-stop com.wesbos.homehq || true
adb install -r -d "$backup/homehq-previous.apk"
adb shell am force-stop com.wesbos.homehq
uid="$(adb shell dumpsys package com.wesbos.homehq | sed -n 's/.*userId=\([0-9]*\).*/\1/p' | head -n1)"
[[ $uid =~ ^[0-9]+$ ]]
adb shell -T "su -c 'set -e; cd /data/data/com.wesbos.homehq;
  tar -xzf - && chown -R $uid:$uid files shared_prefs app_webview'" < "$backup/homehq-data.tgz"
adb shell monkey -p com.wesbos.homehq 1 >/dev/null
echo "Rollback restored; verify the calendar and Home behavior on the frame."
