#!/usr/bin/env bash

switch_to() {
  if [[ $1 = none ]]; then
    [[ ! -L $active ]] || unlink "$active"
    return
  fi
  [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && -d "$root/releases/$1" ]] || return 1
  ln -s "$root/releases/$1" "$temp/current" || return
  mv -Tf "$temp/current" "$active"
}

restore_database() {
  if [[ -f "$recovery/previous.sqlite3" ]]; then
    install -m 0640 -o homehq -g homehq "$recovery/previous.sqlite3" "$data/restore.sqlite3" || return
    rm -f -- "$db-wal" "$db-shm" || return
    mv -f "$data/restore.sqlite3" "$db" || return
  else
    [[ -f "$recovery/no-database" ]] || return 1
    rm -f -- "$db" "$db-wal" "$db-shm" || return
  fi
  sync -f "$data"
}

wait_health() {
  local endpoint
  endpoint="$(address)/healthz" || return
  for _ in {1..20}; do
    if curl -fsS --max-time 1 "$endpoint" | grep -F "\"version\":\"$1\"" >/dev/null; then return; fi
    sleep 1
  done
  echo "Home HQ $1 did not start." >&2
  return 1
}

finish_maintenance() {
  rm -f -- "$flag" || return
  sync -f "$state" || return
  rm -f -- "$journal"
}

resume_unmodified() {
  if [[ -n $1 && $1 != none ]]; then
    systemctl start "$unit" || return
    wait_health "$1" || return
  fi
  finish_maintenance
}

recover() {
  [[ -f $journal && -f $flag ]] || return 0
  local old
  read -r old < "$journal" || return
  systemctl stop "$unit" || return
  restore_database || return
  switch_to "$old" || return
  sync -f "$root" || return
  resume_unmodified "$old"
}

failure() {
  trap - ERR
  if [[ -f $flag ]]; then
    if [[ -f $journal ]]; then
      recover || echo "Recovery needs attention. Run homehq-service rollback." >&2
    else
      resume_unmodified "${current:-}" || echo "Recovery needs attention. Run homehq-service rollback." >&2
    fi
  fi
  exit 1
}
