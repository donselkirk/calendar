# Contributing

1. Branch from `main` using `feature/`, `fix/`, or `chore/`.
2. Add or update automated tests with every behavior change.
3. Update `CHANGELOG.md`, `VERSION_NAME`, and the monotonically increasing `VERSION_CODE` for functional changes.
4. Run `./scripts/check.sh` locally.
5. Open a PR and merge only after all required checks pass.

PR CI never receives signing secrets. Releases are created only from protected `main`.

