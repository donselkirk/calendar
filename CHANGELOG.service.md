# Calendar service changelog

## 1.0.0

- Serve a shared calendar and Ottawa forecast from a Proxmox LXC.
- Store events in SQLite and install or update the service from the console.
- Validate the active Proxmox firewall, recover failed upgrades safely, and protect recurring events from stale deletes.
- Keep today in the forecast hero and show the seven following Ottawa dates, rolling the list forward at midnight.
