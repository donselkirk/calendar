# Home HQ deployment and recovery

## Install and configure

Use the commit-pinned command in the stable service release notes. The installer creates a container with open LAN access to Home HQ on TCP 8080. It leaves the Proxmox datacenter firewall and existing rules alone. Any device that can reach the container's private address can view and edit the calendar. Keep the address private and confirm both desktop and frame can reach it through your existing network.

Default mode uses Debian 13 amd64, 1 CPU, 1 GiB RAM, and 4 GiB storage. Both modes confirm the container ID, storage for the template and root disk, bridge, guest IP/prefix, and gateway. Advanced mode also asks for hostname, resources, DNS and VLAN. `--plan` validates the inputs and prints the proposed setup. If provisioning fails after creation, inspect the CT, then use the printed `--resume CTID` arguments with the original installer revision.

If package downloads fail with a name resolution error, check the guest's bridge, gateway, and DNS. Compare `getent ahostsv4 deb.debian.org` with `runuser -u _apt -- getent ahostsv4 deb.debian.org`. If only root can resolve it, inspect `namei -l /etc/resolv.conf` inside the guest. Standard permissions are `0755` on `/etc` and `0644` on `/etc/resolv.conf`. Restore the affected path before resuming. If the DNS server inherited from the host is unreachable from the guest, set a reachable server under the container's **DNS** settings or enter the address in **Advanced** mode during a fresh install.

In the guest, populate `/etc/homehq/config.json`, preserve the installer’s host address, and restart `homehq.service`. Keep the configuration owned by `root:homehq` with mode `0640`. Use the same calendar IDs as the installed frame. The optional waste identifier is private and only the service contacts ReCollect.

```json
{
  "host": "192.168.1.20",
  "port": 8080,
  "familyLabel": "Family",
  "people": [
    {"id": "person-1", "name": "Example", "color": "#2D5BFF", "ink": "#FFFFFF"}
  ]
}
```

To enable collection, include `waste` with `placeId` and numeric `serviceId`. If the address or port changes, update the frame configuration and any network rules you manage separately. Use the two-finger Controls menu on the frame or `bash scripts/provision-service-address.sh http://PRIVATE-IP:8080/` over authorized USB/ADB.

## Maintain the service

To serve the dashboard through Caddy, point `reverse_proxy` to the container's private IP and port and retain the original Host and Origin headers. Home HQ accepts any hostname and event writes require a matching HTTP or HTTPS origin.

School PA day markers use the [shared OCDSB iCalendar feed](https://www.ocdsb.ca/ics/10612). The service refreshes it every six hours while the calendar is in use. If a refresh fails, it keeps the last successful result or uses the [published 2026–27 secondary PA dates](https://www.ocdsb.ca/download/556471).

- The installer sets the Proxmox console mode to **Shell**. Open **Console** as a Proxmox user with console permissions to get a root shell in the unprivileged container without a guest login. For an existing Home HQ container, apply the same setting from the host with `pct set CTID --cmode shell`.
- `update --check` reports the installed and newest stable service releases. `update` displays the release notes and prompts before applying. `update --yes` performs an explicit update without prompting.
- `homehq-service doctor` checks readiness, SQLite integrity, and recent service logs. If a failed or interrupted upgrade leaves the service in maintenance, run `homehq-service rollback`. It restores the pre-activation database only while writes are still suspended. After activation it tests the previous release against a copy of the current database and keeps newer events. An incompatible older schema is refused.
- The guest update does not update Debian packages. Apply those separately through your existing package-maintenance process. The root-owned updater and unit are installed by the pinned bootstrap. If either needs an upgrade, review and run the newer bootstrap files in the existing guest without recreating it.
- The bootstrap installs a checksum-pinned GitHub CLI verifier for the release attestations. The guest uses public artifacts and the published verification bundle without a GitHub login.
- Check that the existing Proxmox backup job covers `/var/lib/homehq` and `/etc/homehq` plus the installed release and units. Restore to a test CT on an isolated network, avoid conflicting static addresses, verify the service starts, then compare the event count and calendars. Do not use the update rollback snapshot as the durable backup.

## Migrate the legacy frame after the service is ready

1. Test the LXC with temporary events and confirm desktop access. Remove the test events and stop edits on both sides for the migration.
2. Before installing the split APK, run `bash scripts/backup-device.sh` with the original app installed. It backs up the APK and its private data, including WebView local storage. Reopen the original calendar and run `node scripts/export-frame-events.mjs artifacts/legacy-events.json`. The script uses USB/ADB to read only the legacy calendar key, saves the selected export privately, and removes its debugging port afterward. An absent key requires investigation before cutover.
3. Copy the file privately to the guest. With the household IDs configured, run `/opt/homehq/current/node /opt/homehq/current/service/import.mjs /path/to/legacy-events.json --dry-run`. Resolve reported problems, then run again with `--apply`. Review the event and recurrence counts and compare representative entries in the desktop UI.
4. Install the verified signed split APK over the original package using `adb install -r`, provision the service address, and verify shared events and native controls before reopening edits. Keep the original private export and backup. If the frame rolls back after cutover, use the desktop for changes so the LXC remains authoritative.
5. Test a harmless service update and a harmless signed app update, including a real recovery drill. Enable nightly app updates in Controls only after the manual app update and rollback work on the physical frame.
