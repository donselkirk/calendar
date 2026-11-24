#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/install-proxmox.sh

fixture=$(mktemp -d)
trap 'rm -r -- "$fixture"' EXIT
commit=0123456789abcdef0123456789abcdef01234567

require_proxmox_host() { :; }
ask() {
  case $1 in
    'Mode (Default or Advanced)') printf '%s' "$mode_fixture" ;;
    'Container ID'|'Root disk storage'|'Template storage'|'LAN bridge'|Hostname|'CPU cores'|'Memory in MiB'|'Disk in GiB')
      printf '%s' "$2" ;;
    'Static IPv4 address with prefix') printf '10.0.0.10/24' ;;
    'IPv4 gateway') printf '10.0.0.1' ;;
    'DNS IPv4 address (blank uses host defaults)') printf '10.0.0.2' ;;
    'VLAN ID (blank uses untagged)') printf '25' ;;
    'Create this container? (y/N)') printf 'y' ;;
    *) printf 'Unexpected prompt: %s\n' "$1" >&2; return 1 ;;
  esac
}
pvesh() {
  [[ "$*" = 'get /cluster/nextid' || "$*" = 'get /cluster/nextid --vmid 105' ]] || return 1
  printf '105\n'
}
ip() { [[ "$*" = 'link show dev vmbr0' ]]; }
pvesm() { printf 'Name Type Status\nfixture type active\n'; }
pveam() {
  case $1 in
    update) : ;;
    available) printf 'system debian-13-standard_13.0-1_amd64.tar.zst\n' ;;
    list) printf 'local:vztmpl/debian-13-standard_13.0-1_amd64.tar.zst\n' ;;
    *) return 1 ;;
  esac
}
pct() {
  printf 'pct %s\n' "$*" >> "$fixture/calls"
  case $1 in
    create|start|exec|push) : ;;
    config)
      printf 'unprivileged: 1\ndescription: homehq-installer-%s\n' "$commit"
      printf 'net0: name=eth0,bridge=vmbr0,ip=10.0.0.10/24,gw=10.0.0.1,firewall=0\n'
      ;;
    status) printf 'status: running\n' ;;
    *) return 1 ;;
  esac
}
curl() { [[ "$*" = *"raw.githubusercontent.com/donselkirk/calendar/$commit/scripts/"* ]]; }
systemctl() { printf 'Unexpected firewall management\n' >&2; return 1; }

mode_fixture=Default
install_homehq --ref "$commit" --plan > "$fixture/plan"
grep -Fq 'Calendar access: any client that can reach http://10.0.0.10:8080/' "$fixture/plan"
grep -Fq 'Proxmox Console opens a shell without a guest login.' "$fixture/plan"
[[ ! -e $fixture/calls ]]

install_homehq --ref "$commit" > "$fixture/install"
grep -Eq '^pct create 105 .*--net0 name=eth0,bridge=vmbr0,ip=10\.0\.0\.10/24,gw=10\.0\.0\.1,firewall=0 --onboot 1 --cmode shell --tags homehq' "$fixture/calls"
grep -Fxq 'pct exec 105 -- bash /root/homehq-installer/install-guest.sh 10.0.0.10' "$fixture/calls"
grep -Fq 'Home HQ is ready at http://10.0.0.10:8080/ (CT 105).' "$fixture/install"

mode_fixture=Advanced
: > "$fixture/calls"
install_homehq --ref "$commit" > "$fixture/install"
grep -Eq '^pct create 105 .*firewall=0,tag=25 .*--cmode shell .*--nameserver 10\.0\.0\.2$' "$fixture/calls"

: > "$fixture/calls"
install_homehq --ref "$commit" --resume 105 > "$fixture/install"
grep -Fxq 'pct config 105' "$fixture/calls"
grep -Fxq 'pct exec 105 -- bash /root/homehq-installer/install-guest.sh 10.0.0.10' "$fixture/calls"
if grep -Eq '^pct (create|start|set) ' "$fixture/calls"; then exit 1; fi
printf 'Proxmox installer tests passed.\n'
