#!/usr/bin/env bash
set -euo pipefail
version="${1:?usage: changelog-section.sh VERSION}"
awk -v version="$version" '
  $0 ~ "^## " version "([ -]|$)" { found=1; next }
  found && /^## / { exit }
  found { print }
  END { if (!found) exit 2 }
' CHANGELOG.md
