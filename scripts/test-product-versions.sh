#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

fixture=$(mktemp -d)
trap 'rm -r -- "$fixture"' EXIT
mkdir -p "$fixture/scripts" "$fixture/android/app/src/main" "$fixture/web/js" "$fixture/service"
cp scripts/{changelog-section.sh,validate-version.sh} "$fixture/scripts/"
(
  cd "$fixture"
  printf 'VERSION_NAME=1.2.0\nVERSION_CODE=3\n' > android/version.properties
  printf 'VERSION_NAME=2.3.0\n' > service/version.properties
  printf '%s\n' '{"version":"2.3.0"}' > web/package.json
  printf '# Test\n\n## 1.2.0\n\n- App fixture\n' > CHANGELOG.app.md
  printf '# Test\n\n## 2.3.0\n\n- Service fixture\n' > CHANGELOG.service.md
  touch README.md android/app/src/main/Example.java web/js/example.js service/example.test.mjs
  git init -q
  git add .
  git -c user.name=HomeHQ -c user.email=homehq@example.invalid -c commit.gpgsign=false commit -qm Fixture
  base=$(git rev-parse HEAD)

  printf 'Documentation only\n' > README.md
  printf '// Test only\n' > service/example.test.mjs
  bash scripts/validate-version.sh app "$base"
  bash scripts/validate-version.sh service "$base"

  printf '// App behavior changed\n' > android/app/src/main/Example.java
  if bash scripts/validate-version.sh app "$base"; then echo "Missing app bump was accepted." >&2; exit 1; fi
  bash scripts/validate-version.sh service "$base"
  printf '\n## 1.2.1\n\n- Updated app\n' >> CHANGELOG.app.md
  printf 'VERSION_NAME=1.2.1\nVERSION_CODE=4\n' > android/version.properties
  bash scripts/validate-version.sh app "$base"

  printf '// Service UI changed\n' > web/js/example.js
  if bash scripts/validate-version.sh service "$base"; then echo "Missing service bump was accepted." >&2; exit 1; fi
  printf '\n## 2.3.1\n\n- Updated web UI\n' >> CHANGELOG.service.md
  printf 'VERSION_NAME=2.3.1\n' > service/version.properties
  printf '%s\n' '{"version":"2.3.1"}' > web/package.json
  bash scripts/validate-version.sh service "$base"
)
