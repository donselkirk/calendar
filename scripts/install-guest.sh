#!/usr/bin/env bash
set -euo pipefail
umask 027
[[ $EUID = 0 && $# = 1 ]] || { echo "Run the guest install as root with the guest IPv4 address."; exit 1; }
ip=$1
here=$(dirname "$(realpath "$0")")
[[ $(dpkg --print-architecture) = amd64 ]]
. /etc/os-release
[[ $ID = debian && $VERSION_ID = 13 ]] || { echo "Home HQ requires a Debian 13 guest."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git python3 sqlite3
getent passwd homehq >/dev/null || useradd --system --user-group --home-dir /var/lib/homehq --shell /usr/sbin/nologin homehq
install -d -m 0750 -g homehq /opt/homehq /etc/homehq
install -d -m 0750 -o homehq -g homehq /var/lib/homehq
install -d -m 0755 /usr/local/lib/homehq
verifier_version=2.103.3
verifier_hash=4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d
if [[ ! -x /usr/local/lib/homehq/gh ]] ||
   [[ $(/usr/local/lib/homehq/gh --version | awk 'NR==1 {print $3}') != "$verifier_version" ]]; then
  download=$(mktemp -d)
  trap 'rm -r -- "$download"' EXIT
  artifact="gh_${verifier_version}_linux_amd64"
  curl -fsSL --proto '=https' --max-time 120 --max-filesize 50000000 \
    "https://github.com/cli/cli/releases/download/v$verifier_version/$artifact.tar.gz" -o "$download/gh.tar.gz"
  printf '%s  %s\n' "$verifier_hash" "$download/gh.tar.gz" | sha256sum -c -
  tar -xOzf "$download/gh.tar.gz" "$artifact/bin/gh" > "$download/gh"
  install -m 0755 "$download/gh" /usr/local/lib/homehq/gh
fi
install -m 0644 "$here/release-assets.py" /usr/local/lib/homehq/release-assets.py
install -m 0644 "$here/service-recovery.sh" /usr/local/lib/homehq/service-recovery.sh
install -m 0755 "$here/homehq-service" "$here/update" /usr/local/bin/
install -m 0644 "$here/homehq.service" /etc/systemd/system/homehq.service
if [[ ! -f /etc/homehq/config.json ]]; then
  python3 - "$ip" <<'PY'
import ipaddress, json, sys
ip = ipaddress.IPv4Address(sys.argv[1])
if not any(ip in ipaddress.IPv4Network(n) for n in ("192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12")):
    sys.exit("Expected a private IPv4 address")
with open("/etc/homehq/config.json", "x") as f:
    json.dump({"host": str(ip), "port": 8080}, f)
    f.write("\n")
PY
  chgrp homehq /etc/homehq/config.json
  chmod 0640 /etc/homehq/config.json
fi
systemctl daemon-reload
homehq-service update --yes
systemctl enable --now homehq.service
homehq-service status
