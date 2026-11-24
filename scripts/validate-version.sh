#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
product="${1:?Provide app or service}"
case "$product" in
  app) dir=android; prefix=app-v ;;
  service) dir=service; prefix=service-v ;;
  *) exit 2 ;;
esac
path="$dir/version.properties"
name=$(sed -n 's/^VERSION_NAME=//p' "$path")
[[ $name =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
notes=$(bash scripts/changelog-section.sh "$name" "$product")
[[ -n $notes ]]
if [[ $product = service ]]; then
  [[ $(node -p "require('./web/package.json').version") = "$name" ]]
else
  code=$(sed -n 's/^VERSION_CODE=//p' "$path")
  [[ $code =~ ^[1-9][0-9]*$ ]]
fi
prior=
if [[ ${RELEASING:-0} = 1 ]]; then
  if git rev-parse -q --verify "refs/tags/$prefix$name" >/dev/null; then
    echo "Release $prefix$name already exists." >&2
    exit 1
  fi
  prior=$(git tag -l "$prefix[0-9]*" --sort=-version:refname | sed -n '1p')
fi
base=${prior:-${2:-}}
if [[ -n $base ]] && git cat-file -e "$base^{commit}" 2>/dev/null; then
  previous=$(git show "$base:$path" 2>/dev/null || true)
  if [[ $product = app && -z $previous ]]; then previous=$(git show "$base:version.properties" 2>/dev/null || true); fi
  previous_name=$(sed -n 's/^VERSION_NAME=//p' <<< "$previous")
  if [[ -n $previous_name && $previous_name != "$name" ]]; then
    [[ $(printf '%s\n' "$name" "$previous_name" | sort -V | tail -1) = "$name" ]]
    if [[ $product = app ]]; then
      previous_code=$(sed -n 's/^VERSION_CODE=//p' <<< "$previous")
      ((code > previous_code))
    fi
  elif [[ $product = app && -n $previous ]]; then
    [[ $code = "$(sed -n 's/^VERSION_CODE=//p' <<< "$previous")" ]]
  fi
fi
printf 'Validated %s %s\n' "$product" "$name"
