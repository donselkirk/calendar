# Contributing

1. Branch from `main` using `feature/`, `fix/`, or `chore/`.
2. Add regression tests and update the impacted product’s version and changelog. App versions live in `android/version.properties`; service versions live in `service/version.properties` and match `web/package.json`.
3. Run `bash scripts/check.sh`. A native change also needs a signed smoke test on Android 6 before merge.
4. Open a PR and squash-merge after the required checks pass. The matching release workflow runs on protected `main`.
