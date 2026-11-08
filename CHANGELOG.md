# Changelog

## 1.11.4 - 2026-11-07

- Make the verified temporary APK readable by Android's package manager when SuperSU applies a private root-shell umask.
- Keep staged recovery APKs and application data private.

## 1.11.3 - 2026-11-07

- Publish a metadata-only release to validate the complete in-app self-update and recovery path on the frame.

## 1.11.2 - 2026-11-07

- Open the native update confirmation dialog from the update badge on Android 6 WebView.

## 1.11.1 - 2026-11-07

- Stage updater backups and APKs through app-owned streams so self-updates work on frames where root cannot traverse app-private storage.
- Keep a versioned, atomic recovery archive before package replacement.

## 1.11.0 - 2026-11-07

- Move the customized calendar to a reproducible Gradle and GitHub release workflow.
- Move household and collection identifiers into private on-device configuration.
- Add verified in-app release discovery and root-assisted installation staging.
- Add the native clock screensaver, nighttime zero-brightness mode, and tap-to-wake behavior.
- Preserve the calendar, recurring events, Ontario holidays, Ottawa collection schedule, and animated eight-day weather forecast.
