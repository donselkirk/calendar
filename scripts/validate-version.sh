#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

name="$(sed -n 's/^VERSION_NAME=//p' version.properties)"
code="$(sed -n 's/^VERSION_CODE=//p' version.properties)"
[[ "$name" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION_NAME is not semantic" >&2; exit 1; }
[[ "$code" =~ ^[1-9][0-9]*$ ]] || { echo "VERSION_CODE is not positive" >&2; exit 1; }
grep -q "^## $name\([ -]\|$\)" CHANGELOG.md || { echo "CHANGELOG has no $name section" >&2; exit 1; }
grep -q "\"version\": \"$name\"" web/package.json || { echo "web/package.json version differs" >&2; exit 1; }

if git rev-parse "v$name" >/dev/null 2>&1; then
  echo "Tag v$name already exists" >&2
  exit 1
fi

latest="$(git tag -l 'v[0-9]*' --sort=-version:refname | head -n1)"
if [ -n "$latest" ]; then
  latest_name="${latest#v}"
  test "$(printf '%s\n%s\n' "$latest_name" "$name" | sort -V | tail -n1)" = "$name" || {
    echo "$name is not newer than $latest_name" >&2; exit 1;
  }
fi

echo "Validated version $name ($code)"
