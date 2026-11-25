#!/usr/bin/env bash

require_proxmox_host() {
  local cmd
  [[ $EUID = 0 && $(uname -m) = x86_64 ]] ||
    { echo "Run as root on a Proxmox amd64 host."; return 1; }
  for cmd in pct pveam pvesh pvesm curl python3 ip; do command -v "$cmd" >/dev/null; done
}

ask() {
  local result
  read -r -p "$1 [$2]: " result </dev/tty
  printf '%s' "${result:-$2}"
}

install_homehq() (
  set -euo pipefail
  umask 077

  ref=
  plan=0
  resume=
  while (($#)); do
    case $1 in
      --ref) ref=${2:?Missing installer commit}; shift 2 ;;
      --plan) plan=1; shift ;;
      --resume) resume=${2:?Missing container ID}; shift 2 ;;
      *) echo "Usage: install-proxmox.sh --ref <commit> [--plan | --resume CTID]"; exit 2 ;;
    esac
  done
  [[ $ref =~ ^[a-f0-9]{40}$ ]] || { echo "Supply the reviewed installer commit with --ref."; exit 2; }
  require_proxmox_host
  if [[ -n $resume ]]; then
    [[ $plan = 0 && $resume =~ ^[1-9][0-9]{2,8}$ ]]
    ct=$resume
    existing=$(pct config "$ct")
    grep -qx 'unprivileged: 1' <<< "$existing"
    # pct config encodes the newline Proxmox adds to description comments.
    marker="description: homehq-installer-$ref"
    grep -Fxq -e "$marker" -e "$marker%0A" <<< "$existing" ||
      { echo "Container is not marked as created by this installer revision."; exit 1; }
    address=$(sed -n 's/^net0: .*ip=\([0-9.]*\)\/.*/\1/p' <<< "$existing")
    [[ -n $address ]]
    if ! pct status "$ct" | grep -qx 'status: running'; then pct start "$ct"; fi
  else
    echo "Home HQ Calendar · Proxmox installer"
    mode=$(ask 'Mode (Default or Advanced)' Default)
    [[ $mode = Default || $mode = Advanced ]]
    ct=$(ask 'Container ID' "$(pvesh get /cluster/nextid)")
    disk=$(ask 'Root disk storage' local-lvm)
    templates=$(ask 'Template storage' local)
    bridge=$(ask 'LAN bridge' vmbr0)
    addr=$(ask 'Static IPv4 address with prefix' "")
    gateway=$(ask 'IPv4 gateway' "")
    hostname_value=homehq
    cpu=1
    ram=1024
    disk_size=4
    dns=
    vlan=
    if [[ $mode = Advanced ]]; then
      hostname_value=$(ask 'Hostname' "$hostname_value")
      cpu=$(ask 'CPU cores' "$cpu")
      ram=$(ask 'Memory in MiB' "$ram")
      disk_size=$(ask 'Disk in GiB' "$disk_size")
      dns=$(ask 'DNS IPv4 address (blank uses host defaults)' "")
      vlan=$(ask 'VLAN ID (blank uses untagged)' "")
    fi
    [[ $ct =~ ^[1-9][0-9]{2,8}$ && $disk =~ ^[A-Za-z0-9_-]+$ && $templates =~ ^[A-Za-z0-9_-]+$ &&
       $bridge =~ ^[A-Za-z0-9_-]+$ && $hostname_value =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$ &&
       $cpu =~ ^[1-9][0-9]{0,1}$ && $ram =~ ^[1-9][0-9]{2,5}$ && $disk_size =~ ^[1-9][0-9]{0,3}$ ]]
    ((ram >= 512 && disk_size >= 4))
    [[ -z $vlan || $vlan =~ ^[1-9][0-9]{0,3}$ ]]
    [[ -z $vlan ]] || ((vlan <= 4094))
    address=$(python3 - "$addr" "$gateway" "$dns" <<'PY'
import ipaddress, sys
address = ipaddress.IPv4Interface(sys.argv[1])
gateway = ipaddress.IPv4Address(sys.argv[2])
private = [ipaddress.IPv4Network(n) for n in ("192.168.0.0/16","10.0.0.0/8","172.16.0.0/12")]
if not any(address.network.subnet_of(n) for n in private):
    sys.exit("Use a private IPv4 network for the guest.")
if "/" not in sys.argv[1] or gateway not in address.network or gateway == address.ip:
    sys.exit("Check the guest IPv4 prefix and gateway.")
if address.ip in (address.network.network_address, address.network.broadcast_address):
    sys.exit("Choose a usable guest address.")
if sys.argv[3]:
    ipaddress.IPv4Address(sys.argv[3])
print(address.ip)
PY
  )
    pvesh get /cluster/nextid --vmid "$ct" >/dev/null
    ip link show dev "$bridge" >/dev/null
    pvesm status --storage "$disk" --content rootdir | awk 'NR>1 && $3=="active" {ok=1} END{exit !ok}'
    pvesm status --storage "$templates" --content vztmpl | awk 'NR>1 && $3=="active" {ok=1} END{exit !ok}'
    printf '\nHome HQ %s (%s) · %s · CPU %s · RAM %s MiB · disk %s GiB (%s)\n' \
      "$ct" "$hostname_value" "$mode" "$cpu" "$ram" "$disk_size" "$disk"
    printf 'Template storage %s · bridge %s · address %s · gateway %s\n' \
      "$templates" "$bridge" "$addr" "$gateway"
    printf 'Calendar access: any client that can reach http://%s:8080/\n' "$address"
    printf 'DNS %s · VLAN %s\n' "${dns:-host default}" "${vlan:-untagged}"
    printf 'Proxmox Console opens a shell without a guest login.\n'
    if ((plan)); then exit 0; fi
    answer=$(ask 'Create this container? (y/N)' N)
    [[ $answer =~ ^[yY]$ ]] || exit 0
    step='refreshing the template catalogue'
    trap 'echo "Failed while ${step:-preparing Home HQ} (CT ${ct:-unknown}). If the CT was created, inspect it before retrying." >&2' ERR
    pveam update
    template=$(pveam available --section system | awk '$2 ~ /^debian-13-standard_.*_amd64\.tar\./ {print $2}' | sort -V | tail -1)
    [[ -n $template ]] || { echo "Debian 13 amd64 template not found."; exit 1; }
    step='downloading Debian 13'
    if ! pveam list "$templates" | awk '{print $1}' | grep -Fxq "$templates:vztmpl/$template"; then
      pveam download "$templates" "$template"
    fi
    step='creating the unprivileged container'
    net="name=eth0,bridge=$bridge,ip=$addr,gw=$gateway,firewall=0"
    [[ -z $vlan ]] || net="$net,tag=$vlan"
    extra=()
    [[ -z $dns ]] || extra+=(--nameserver "$dns")
    pct create "$ct" "$templates:vztmpl/$template" --hostname "$hostname_value" --unprivileged 1 \
      --cores "$cpu" --memory "$ram" --swap 256 --rootfs "$disk:$disk_size" --net0 "$net" \
      --onboot 1 --cmode shell --tags homehq --description "homehq-installer-$ref" "${extra[@]}"
    step='starting the container'
    pct start "$ct"
  fi
  printf 'If provisioning fails, retry this CT explicitly with --ref %s --resume %s.\n' "$ref" "$ct"
  step='installing the verified service in the guest'
  trap 'echo "Failed while $step (CT $ct)." >&2' ERR
  tmp=$(mktemp -d)
  trap 'rm -r -- "$tmp"' EXIT
  dest=/root/homehq-installer
  pct exec "$ct" -- install -d -m 0700 "$dest"
  for file in install-guest.sh release-assets.py service-recovery.sh homehq-service update homehq.service; do
    curl -fsSL --proto '=https' --max-time 30 \
      "https://raw.githubusercontent.com/donselkirk/calendar/$ref/scripts/$file" -o "$tmp/$file"
    pct push "$ct" "$tmp/$file" "$dest/$file" --perms 0600
  done
  pct exec "$ct" -- bash "$dest/install-guest.sh" "$address"
  printf '\nHome HQ is ready at http://%s:8080/ (CT %s).\n' "$address" "$ct"
  printf 'Maintain it with update in the guest console, or pct exec %s -- /usr/local/bin/update --check.\n' "$ct"
)

if [[ ${BASH_SOURCE[0]} = "$0" ]]; then
  install_homehq "$@"
fi
