# Releases and recovery

- `app-v*` contains the signed APK and `app-update-manifest.json`. Preserve the original signer and increasing Android versionCode. The existing branch-restricted GitHub Environment named `release` supplies the keystore, passwords, and alias. APK verification covers package, target/min SDK, certificate, v1/v2 signatures, and the absence of the old bundled dashboard.
- `service-v*` contains the Linux amd64 archive, manifest, checksum, and GitHub provenance bundle. The release notes include the Proxmox installer command pinned to the producing commit. The archive carries the Node runtime used to build it.
- Both publish without moving the legacy latest-release pointer. App and service check their own prefixed streams. The first split APK requires manual in-place installation after the separate event transfer.
- Keep the current required PR check names during rollout. If publication fails, inspect the workflow and release state before retrying. Never overwrite or reuse a published version or tag.

See [deployment.md](deployment.md) for the initial install, update/rollback procedures, and cutover acceptance.
