# Calendar service changelog

## 1.0.4

- Allow access through any hostname, including Caddy reverse proxies.

## 1.0.3

- Finish setting up Home HQ when the Proxmox guest command environment omits `/usr/local/bin`.
- Keep the attestation bundle’s `.jsonl` extension during download so the release verifier can read it.
- Check that APT can read the container’s DNS configuration before trying package downloads.

## 1.0.2

- Open the Proxmox Console directly to a shell for new Home HQ containers, with access governed by Proxmox permissions.
- Resume setup on containers whose installer marker includes an encoded newline in the Proxmox configuration.
- Keep Proxmox-generated DNS configuration readable by guest package downloads and stop setup when Debian's package indexes cannot be refreshed.

## 1.0.1

- Create new Home HQ containers with open LAN access, without an allowed-clients prompt or a Proxmox datacenter firewall prerequisite.
- Start each week on Sunday in the month calendar on desktop and the frame.

## 1.0.0

- Serve a shared calendar and Ottawa forecast from a Proxmox LXC.
- Store events in SQLite and install or update the service from the console.
- Validate the active Proxmox firewall, recover failed upgrades safely, and protect recurring events from stale deletes.
- Keep today in the forecast hero and show the seven following Ottawa dates, rolling the list forward at midnight.
