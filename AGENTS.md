# Home HQ Calendar engineering context

Read this file before changing the project.

## Product and device

- The application is a local-first month calendar and Ottawa weather/forecast display.
- Target hardware: Pastigio M10R7, Rockchip RK3126C, Android 6, firmware 1.32.16.
- Target viewport: 1280×800 landscape. Target WebView: Chromium 106; CSS must remain Chrome 61-compatible.
- Android package and WebView origin are compatibility contracts: `com.wesbos.homehq` and `http://127.0.0.1:8765/`.
- Current first GitHub-managed version is in `version.properties`.

## Security and privacy invariants

- This is a public repository. Never add household names, street addresses, ReCollect place IDs, device serials, APK/data backups, credentials, keystores, or passwords.
- Private values belong only in the ignored `device-config.json` and on-device `files/device-config.json`.
- Do not add a JavaScript native bridge. Web code may read only constrained same-origin endpoints; installation, signatures, root calls, scheduling, and brightness remain native.
- An update is installable only when versionCode increases and its SHA-256, package ID, and signing certificate all verify.
- Preserve the existing signing key outside Git. A different signer cannot upgrade the installed application.
- `sources/` in the enclosing ChatGPT project is read-only and must never be modified.

## Workflow

- Work on `feature/*`, `fix/*`, or `chore/*` branches and merge by squash PR.
- Functional changes require tests, a semantic version/versionCode bump, and a `CHANGELOG.md` entry.
- Run `./scripts/check.sh` before opening a PR. CI must pass without secrets.
- Native updater or display changes also require a signed release-candidate smoke test on the physical frame before merge.
- Keep migrations idempotent. Add a saved fixture for every released storage schema and test direct migration to current.

## Release and recovery

- Main-branch CI rebuilds and tests before using the branch-restricted `release` Environment.
- Release assets are the signed APK, `update-manifest.json`, and web archive.
- Automatic nightly installation remains disabled until the on-frame 1.11.1 self-update and rollback drill succeeds.
- Keep the previous APK plus an atomic app-data export. Recovery is a tested ADB rollback, not a companion watchdog.

