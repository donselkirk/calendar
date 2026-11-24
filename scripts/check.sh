#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/privacy-scan.sh
base=$(git merge-base HEAD origin/main)
bash scripts/validate-version.sh app "$base"
bash scripts/validate-version.sh service "$base"
bash scripts/check-service.sh
bash scripts/check-app.sh
