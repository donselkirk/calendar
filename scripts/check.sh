#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/privacy-scan.sh
bash scripts/validate-version.sh app
bash scripts/validate-version.sh service
bash scripts/check-service.sh
bash scripts/check-app.sh
