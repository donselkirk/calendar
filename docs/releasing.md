# Releases and recovery

## One-time GitHub setup

Create the `release` Environment and restrict it to the protected `main` branch. Add:

- `HOMEHQ_KEYSTORE_BASE64`
- `HOMEHQ_KEYSTORE_PASSWORD`
- `HOMEHQ_KEY_ALIAS`
- `HOMEHQ_KEY_PASSWORD`

The keystore must contain the certificate fingerprint recorded in `release.properties`. Configure required branch checks only after the first PR has produced their status contexts.

## First managed release

1. Run `scripts/backup-device.sh` against version 1.10.
2. Stop the application and provision the ignored private configuration.
3. Build and inspect the signed 1.11.0 release candidate.
4. Install it with `adb install -r` and complete the acceptance checklist in `docs/frame-acceptance.md`.
5. Run `scripts/rollback-device.sh` and prove that the prior APK and data restore.
6. Reinstall 1.11.0. Do not enable unattended updates until a harmless 1.11.1 release self-installs successfully.

The recovery procedure is intentionally ADB-assisted. The application stages the current APK and an export before installation, but there is no second watchdog process capable of repairing an APK that cannot start.
