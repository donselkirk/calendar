#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/install-guest.sh

systemctl() { printf 'systemctl %s\n' "$*"; }
function /usr/local/bin/homehq-service() { printf 'homehq-service %s\n' "$*"; }

calls=$(PATH=/usr/bin:/bin activate_homehq)
expected='systemctl daemon-reload
homehq-service update --yes
systemctl enable --now homehq.service
homehq-service status'
[[ $calls = "$expected" ]]
printf 'Guest activation works without /usr/local/bin in PATH.\n'
