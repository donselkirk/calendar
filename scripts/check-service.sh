#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm_cmd="${PNPM_CMD:-pnpm}"
for script in scripts/install-proxmox.sh scripts/install-guest.sh scripts/homehq-service scripts/update; do bash -n "$script"; done
python3 scripts/test-release-assets.py
node --test service/*.test.mjs
"$pnpm_cmd" --dir web lint
"$pnpm_cmd" --dir web test
if [[ ${RUN_E2E:-1} = 1 ]]; then
  "$pnpm_cmd" --dir web build --mode preview
  "$pnpm_cmd" --dir web test:e2e --grep-invert '@service'
fi
"$pnpm_cmd" --dir web build
if [[ ${RUN_E2E:-1} = 1 ]]; then
  "$pnpm_cmd" --dir web test:e2e --grep '@service'
fi
