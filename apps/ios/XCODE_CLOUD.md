# Xcode Cloud Setup (Task 14.5 — manual console steps)

Xcode Cloud is configured in App Store Connect, not in-repo; these are the
steps a human runs once. **Blocked until Apple Developer Program enrollment
lands (plan Open Question #8)** — record the workflow here so setup is
copy-paste when it does.

## One-time setup

1. App Store Connect → **Users and Access** → keys/Xcode Cloud tab; connect
   the repo (GitHub App or personal access key with read access).
2. App Store Connect → **My Apps** → (create app `com.mishran.app` if absent)
   → **Xcode Cloud** → **Create workflow**:
   - Repository: this repo; branch: `main`.
   - Start condition: PRs targeting `main` + nightly schedule on `main`.
   - Build configuration: Debug; **test action enabled**, test plan
     `Mishran.xctestplan` (unit + UI tests).
   - Environment: macOS image default; **Post-clone script**: runs
     `ci_scripts/ci_post_clone.sh` automatically (Xcode Cloud convention —
     no configuration needed once the file exists).
   - Actions: run tests; archive for the delivery action only after
     enrollment (signing needs a team + distribution cert).
3. Secret-free: nothing needed in Xcode Cloud variables for tests. The
   workflow talks to no external services (API base URL defaults to
   localhost in Debug; UI tests exercise local navigation only).
4. First green run on a PR validates the setup (parity with the
   `ios-pr` GitHub Actions job, which runs the same tests on a hosted
   `macos-14` runner).

## Relationship to ios-pr.yml

`ios-pr.yml` is the always-available GitHub-hosted CI (no Apple account
needed). Xcode Cloud is the pre-release gate that also produces signed
archives once signing identities exist. Both run the same
`Mishran.xctestplan`; keep them in sync when targets are added.

## ci_post_clone.sh contract

- Runs from the repo root (`$CI_PRIMARY_REPOSITORY_PATH`).
- `corepack`-activated pnpm → `pnpm install --frozen-lockfile` →
  `pnpm --filter @mishran/brand-tokens run codegen:swift` → `xcodegen`.
- Fails the build loudly if codegen or project generation fails.
