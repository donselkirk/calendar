# Changelog

## 1.11.8 - 2026-11-08

- Balance the calendar and forecast headers, make weather and update actions visually consistent, and keep the date display noninteractive.
- Add mouse-and-touch month swiping with matching horizontal transitions for arrow navigation.
- Replace synthetic forecast scenes with condition-matched photographic loops, integrate the daily details into the hero, and improve seven-day precipitation and icon visibility.
- Use a softly animated native clock screensaver with randomized movement and colours that continue changing while dimmed, plus faded calendar and black-screen transitions.
- Simplify the native controls and update dialogs; choosing Later now schedules the verified update for the nightly window.

## 1.11.7 - 2026-11-08

- Keep the floating Back and Dashboard controls alive in a dedicated process when this frame kills the dashboard process on entry to Android Settings.
- Repair navigation-service connectivity across processes without granting access to screen content.
- Show a Done action on the event-name keyboard and close the keyboard without losing the entered title.

## 1.11.6 - 2026-11-08

- Enable unattended nightly installation by default now that rollback and in-app self-update validation have succeeded on the frame.

## 1.11.5 - 2026-11-07

- Publish the final metadata-only release for the complete no-ADB self-update acceptance test.

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
