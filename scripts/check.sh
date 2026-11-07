#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PNPM_CMD="${PNPM_CMD:-pnpm}"

./scripts/privacy-scan.sh
"$PNPM_CMD" --dir web lint
"$PNPM_CMD" --dir web test
"$PNPM_CMD" --dir web build
./gradlew lintDebug testDebugUnitTest jacocoTestCoverageVerification assembleDebug
./scripts/verify-apk.sh android/app/build/outputs/apk/debug/app-debug.apk debug

if [ "${RUN_E2E:-1}" = "1" ]; then
  "$PNPM_CMD" --dir web test:e2e
fi
