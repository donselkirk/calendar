# Physical frame acceptance checklist

- Package is `com.wesbos.homehq`; version and signing fingerprint match the release manifest.
- Existing events, recurrence, calendar ownership, deletion, and undo are intact.
- Private names display but do not appear in logcat, bundled assets, or update requests.
- Waste icons and holiday-adjusted dates match Ottawa's source feed.
- Weather and the animated eight-day forecast load and retain cached data offline.
- Boot with an invalid clock never displays December 1969.
- The app is Home, immersive navigation repair works, and two-finger controls remain available.
- Day and night screensaver thresholds, 7:00 AM transition, zero brightness, and consumed wake tap work.
- Watch the dim screensaver for 30–60 seconds. Confirm that the colors visibly drift and gradually change behind a legible clock, and that floor brightness remains comfortable in the room. After waking and re-entering dim mode, observe a different starting position and palette. Verify the fade to a fully black nighttime screen and the fade back on wake.
- Release detection, Update now/Tonight choices, hash/signer/package validation, and install work.
- Wi-Fi outage, captive portal, reboot, update replacement, and rollback are exercised.
