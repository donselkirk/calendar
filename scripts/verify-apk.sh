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

build_tools_version="${ANDROID_BUILD_TOOLS_VERSION:-34.0.0}"
tools="$sdk/build-tools/$build_tools_version"
test -d "$tools" || {
  echo "Android build-tools $build_tools_version is required" >&2
  exit 1
}
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
  if [ "$actual" != "$expected" ]; then
    echo "Signing certificate mismatch: expected $expected, got ${actual:-<unreadable>}" >&2
    exit 1
  fi
fi

echo "Verified package, SDK levels, and v1/v2 signatures for $apk"
