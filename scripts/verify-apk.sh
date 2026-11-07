#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

apk="${1:?usage: verify-apk.sh APK [debug|release]}"
mode="${2:-release}"
test -f "$apk"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$sdk" ]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT is required" >&2
  exit 1
fi

tools="$(find "$sdk/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n1)"
badging="$($tools/aapt dump badging "$apk")"
grep -q "package: name='com.wesbos.homehq'" <<<"$badging"
grep -q "sdkVersion:'23'" <<<"$badging"
grep -q "targetSdkVersion:'28'" <<<"$badging"

verify="$($tools/apksigner verify --verbose --print-certs "$apk")"
grep -q 'Verified using v1 scheme (JAR signing): true' <<<"$verify"
grep -q 'Verified using v2 scheme (APK Signature Scheme v2): true' <<<"$verify"

if [ "$mode" = release ]; then
  expected="$(sed -n 's/^SIGNING_CERT_SHA256=//p' release.properties | tr '[:lower:]' '[:upper:]')"
  actual="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<<"$verify" | tr -d ':' | tr '[:lower:]' '[:upper:]')"
  test "$actual" = "$expected" || { echo "Signing certificate mismatch" >&2; exit 1; }
fi

echo "Verified package, SDK levels, and v1/v2 signatures for $apk"
