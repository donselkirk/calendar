# Home HQ Calendar

A calendar and Ottawa weather dashboard for a Pastigio M10R7 (Rockchip RK3126C) photo frame running Android 6. The web UI is bundled into a signed kiosk APK and served to its WebView from `http://127.0.0.1:8765/`.

The repository is public. Household names, the address-derived ReCollect identifier, signing keys, APKs, device backups, and serial numbers must never be committed.

## Development

Requirements: Node 20+, pnpm 10+, JDK 17, Android SDK platform/build-tools 34, and (for device work) ADB.

```bash
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev
./scripts/check.sh
```

The local preview is fixed at the frame's 1280×800 viewport. Production JavaScript targets Chrome/WebView 106 and CSS targets Chrome 61 to avoid unsupported minifier output observed on the frame.

## Private device configuration

Copy `device-config.example.json` to `device-config.json`, replace the example values, and provision it with:

```bash
./scripts/provision-device-config.sh device-config.json
```

The file is stored as `/data/data/com.wesbos.homehq/files/device-config.json`. Stable person IDs must not change after events have been created.

## Releases

Every functional PR bumps `version.properties` and adds a matching `CHANGELOG.md` section. A merge to protected `main` reruns checks and publishes a signed GitHub release. Signing values are supplied only through the `release` GitHub Environment; see `docs/releasing.md`.

The first GitHub-managed release is 1.11.0 (13) and must be installed once through ADB. Later releases are discovered by the native updater.

This project is derived from [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard) and retains its MIT license.

