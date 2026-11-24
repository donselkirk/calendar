#!/usr/bin/env bash
set -euo pipefail
address="${1:?Pass http://PRIVATE-IP:8080/}"
[[ $address =~ ^http://[0-9.]+:[0-9]+/?$ ]] || { echo "Invalid address."; exit 2; }
pkg=com.wesbos.homehq
uid="$(adb shell dumpsys package "$pkg" | sed -n 's/.*userId=\([0-9]*\).*/\1/p' | head -n1)"
[[ $uid =~ ^[0-9]+$ ]]
dir="/data/data/$pkg/files"
adb shell "su -c 'umask 077; mkdir -p $dir && chown $uid:$uid $dir &&
  printf %s $address > $dir/service-address.stage && chown $uid:$uid $dir/service-address.stage &&
  mv $dir/service-address.stage $dir/service-address'"
adb shell am start -n "$pkg/.MainActivity"
