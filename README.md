# Home HQ Calendar

Home HQ runs on a Proxmox LXC and serves a shared calendar and Ottawa weather dashboard. The Android frame opens the same dashboard as a desktop browser and handles the screensaver, touch, and native controls.

## Install on Proxmox

Open the newest stable **Home HQ Service** entry on the [GitHub releases page](https://github.com/donselkirk/calendar/releases). Copy its one-line installer command into the **Proxmox host shell**. The command includes the reviewed commit in both the download URL and the `--ref` argument. Select **Default** or **Advanced**, then confirm the network and storage settings. If you want to preview the changes first, add `--plan`.

The default is an unprivileged Debian 13 amd64 LXC with 1 CPU, 1 GiB RAM and a 4 GiB disk. Have a free private address, gateway, and Proxmox storage ready. Any client that can reach the container's private address can open the calendar. You can leave the Proxmox datacenter firewall off. Open the printed URL on desktop. On the frame, hold two fingers on the display, choose **Calendar service address**, and enter that same URL.

## Maintain the LXC

Run `update` in the **LXC console**, or run `update --check` to check without applying anything. From the Proxmox host, use `pct exec CTID -- /usr/local/bin/update --check`. See the [deployment runbook](docs/deployment.md) for setup, backups, recovery, and the one-time transfer of existing events.

## Develop

Use Node 24 with pnpm 11.25.0. Android checks also use JDK 17 and Android SDK 34.

```bash
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
bash scripts/check-service.sh
bash scripts/check-app.sh
```

The Vite preview uses disposable browser-local data. To test the production browser-to-service path locally after a web build, point `HOMEHQ_DB` at a new temporary SQLite file, run `node service/server.mjs migrate`, then `node service/server.mjs`. The default URL is `http://127.0.0.1:8080/`.

Derived from [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard) under the MIT license.
