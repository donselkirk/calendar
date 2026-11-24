#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./gradlew lintDebug testDebugUnitTest jacocoTestCoverageVerification assembleDebug
bash scripts/verify-apk.sh android/app/build/outputs/apk/debug/app-debug.apk debug
