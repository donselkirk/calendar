#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/service-recovery.sh

sandbox=$(mktemp -d)
trap 'rm -r -- "$sandbox"' EXIT
root="$sandbox/root"
data="$sandbox/data"
state="$sandbox/state"
temp="$sandbox/work"
recovery="$state/recovery"
flag="$state/maintenance"
journal="$state/transaction"
active="$root/current"
db="$data/homehq.sqlite3"
unit=homehq.service
current=1.0.1
mkdir -p "$root/releases/1.0.0" "$root/releases/$current" "$temp" "$recovery" "$data"
touch "$flag"
printf '1.0.0\n' > "$journal"
printf 'older database\n' > "$recovery/previous.sqlite3"
printf 'active database\n' > "$db"
ln -s "$root/releases/$current" "$active"

# Simulate external failures without touching a real database or systemd service.
install() {
  [[ ${fail_copy:-1} = 0 ]] || return 1
  cp "$7" "$8"
}
systemctl() {
  [[ $2 = "$unit" ]] || return 1
  printf '%s\n' "$1" >> "$sandbox/calls"
  [[ $1 != start || ${fail_start:-0} = 0 ]]
}
wait_health() { [[ $1 = 1.0.0 && ${fail_health:-0} = 0 ]]; }

if recover; then echo "Recovery ignored a failed backup copy." >&2; exit 1; fi
[[ -f $flag && -f $journal && $(readlink "$active") = "$root/releases/$current" ]]
[[ $(<"$db") = 'active database' && $(<"$sandbox/calls") = stop ]]

fail_copy=0
fail_start=1
if recover; then echo "Recovery ignored a failed restart." >&2; exit 1; fi
[[ -f $flag && -f $journal && $(readlink "$active") = "$root/releases/1.0.0" ]]
[[ $(<"$db") = 'older database' ]]

fail_start=0
fail_health=1
if recover; then echo "Recovery ignored a failed health check." >&2; exit 1; fi
[[ -f $flag && -f $journal ]]

fail_health=0
recover
[[ ! -e $flag && ! -e $journal && $(<"$db") = 'older database' ]]

# A command failing inside the update function must reach the ERR handler.
touch "$flag"
printf '1.0.0\n' > "$journal"
if bash -c '
  set -Eeuo pipefail
  source scripts/service-recovery.sh
  flag=$1; journal=$2
  recover() { rm -- "$flag"; }
  trap "if ((BASH_SUBSHELL == 0)); then failure; fi" ERR
  migrate() { false; return 0; }
  migrate
' recovery-test "$flag" "$journal"; then
  echo "Failed migration returned success." >&2; exit 1
fi
[[ ! -e $flag ]]
echo "Service recovery checks passed."
