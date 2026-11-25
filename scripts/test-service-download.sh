#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/homehq-service

temp=$(mktemp -d)
trap 'rm -r -- "$temp"' EXIT
repo=donselkirk/calendar
available=1.0.3
commit=0123456789abcdef0123456789abcdef01234567
artifact="homehq-service-v$available-amd64.tar.gz"
url="https://github.com/$repo/releases/download/service-v$available"
helper=release-assets.py
digest=$(printf 'fixture archive\n' | sha256sum | cut -d ' ' -f 1)

git() {
  [[ "$*" = "ls-remote https://github.com/$repo.git refs/tags/service-v$available refs/tags/service-v$available^{}" ]]
  printf '%s\trefs/tags/service-v%s\n' "$commit" "$available"
}
curl() {
  local output=${@: -1} source=${@: -3:1}
  case $source in
    "$url/$artifact") printf 'fixture archive\n' > "$output" ;;
    "$url/$artifact.attestation.jsonl")
      [[ $output = "$temp/$artifact.attestation.jsonl" ]]
      printf 'fixture attestation\n' > "$output"
      ;;
    *) return 1 ;;
  esac
}
function /usr/local/lib/homehq/gh() {
  [[ "$*" = "attestation verify $temp/$artifact --bundle $temp/$artifact.attestation.jsonl --repo $repo --signer-workflow $repo/.github/workflows/service-release.yml --source-ref refs/heads/main --source-digest $commit --deny-self-hosted-runners" ]]
  [[ $(<"$temp/$artifact.attestation.jsonl") = 'fixture attestation' ]]
  touch "$temp/verified"
}
python3() {
  [[ "$*" = "$helper unpack $temp/$artifact $temp/release-files" && -f $temp/verified ]]
  mkdir -p "$4/service" "$4/web/dist"
  printf 'VERSION_NAME=%s\n' "$available" > "$4/service/version.properties"
  touch "$4/node" "$4/web/dist/index.html"
  chmod +x "$4/node"
}
chgrp() { [[ "$*" = "-R homehq $temp/release-files" ]]; }

download
[[ -f $temp/release-files/web/dist/index.html ]]
printf 'Service download verifies the JSONL bundle before unpacking.\n'
