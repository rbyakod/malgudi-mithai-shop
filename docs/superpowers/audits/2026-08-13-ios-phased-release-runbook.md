# iOS v1 — Phased App Store Release Runbook (Task 21.4)

Console/operational task — **source-complete equivalent, not executed**
(needs a real IPA + App Store Connect + live dashboards; same honesty rule
as the Android 13.4 runbook). Everything below is the procedure to run
once Apple Developer Program enrollment (plan Open Question #8) unlocks
signing (Task 21.1), the listing (21.2), and TestFlight (21.3).

## Preconditions (all must be green before submitting)

- [ ] `APPLE_TEAM_ID=… apps/ios/ci_scripts/ci_archive.sh` produced an IPA **≤ 30 MB** and uploaded to App Store Connect.
- [ ] App Store listing complete in **9 locales** (`pnpm ios:listing:check` green) + screenshots captured (fastlane snapshot: 6.7", 6.5", 5.5").
- [ ] TestFlight external group ran ≥ 1 build for ≥ 48h with beta feedback resolved (Task 21.3 ladder done).
- [ ] **Native-speaker listing/copy review** signed off (Open Question #10 — vendor-gated, gates production).
- [ ] App Review information filled: staging demo phone + OTP, contact info, notes mentioning OTP test mode + Razorpay TEST (in `ci_archive.sh` header + `apps/ios/testflight/VERSION_HISTORY.md`).
- [ ] Privacy policy URL live (`https://mishran.app/privacy`) and matches actual data use (no SMS-read permission; location only for delivery pincode).
- [ ] `ITSAppUsesNonExemptEncryption=false` confirmed (RS256 JWT only — standard exempt encryption).
- [ ] Staging backend green: 442-test suite, k6 contracts (Task 12.6), Razorpay TEST keys swapped for LIVE only at submission.

## Review submission (plan Step 1)

1. Submit for full App Store review from App Store Connect. **Average lead time 24–48h.**
2. Rejection triage: address feedback the same day; the most likely pressure points for this app are **4.8 Sign in with Apple** (implemented — SIWA button is live alongside phone OTP), **3.1.1 payments** (Razorpay external checkout, no IAP-eligible digital goods), and **4.2 minimum functionality** (all v1 screens populated, no placeholders).

## Phased release ladder (plan Step 2)

App Store Connect phased release: **7 days, automatic pause at each step —
1% → 2% → 5% → 10% → 20% → 50% → 100%.** Users who already have the app
on automatic updates get it progressively; a manual App Store "Update"
always grants the new version (that leak is inherent to iOS phased
release — factor it into the monitor readings).

| Day | Cohort | Exit gate (checked BEFORE letting the next step proceed) |
|-----|--------|----------------------------------------------------------|
| 1 | 1% | Crash-free ≥ 99.5% (Xcode Organizer/MetricKit), no payment-blocking defect |
| 2 | 2% | Payment success ≥ 97% (Razorpay dashboard), order_errors < 1% |
| 3 | 5% | Cold launch p95 ≤ 1.5s (MetricKit hang/cold-start percentiles) |
| 4 | 10% | ANR/hang rate < 0.47%-equivalent (MetricKit hangs), battery regression clean |
| 5 | 20% | Live Activity + push delivery sanity: APNs feedback service shows no mass token invalidation |
| 6 | 50% | All monitors stable ≥ 48h cumulative |
| 7 | 100% | Ship confirmed; retro scheduled |

## Monitors (checked at least daily during the ramp)

| Signal | Source | Green |
|--------|--------|-------|
| Crash-free sessions | Xcode Organizer → Crashes / MetricKit | ≥ 99.5% |
| Payment success | Razorpay dashboard (captured/attempted) | ≥ 97% |
| Cold start p95 | MetricKit launch histograms | ≤ 1.5s |
| Order errors | backend `/api/health` + order_errors log rate | < 1% |
| Hangs/ANR-equivalent | MetricKit hang diagnostics | < 0.5% |
| APNs failures | feedback + error logs | no spikes |
| Review sentiment | App Store ratings/versions filter | no 1★ wave on the new version |

## Halt procedure (plan Step 4)

- **Pause phased release** (App Store Connect → the version → "Pause Phased Release") at ANY red monitor — the button halts the ramp within ~1h; already-updated users keep the version.
- Halt-and-fix, never unpublish: server-side fix needs no version bump (resume the ramp after verification); app-side fix bumps `CFBundleVersion`, uploads a new build, and the ramp **restarts at 1%**.
- If the defect is order/payment-blocking, also flip the backend feature flag that disables checkout while fixing.

## Post-launch retro (plan Steps 5–6)

After 100% + 7 clean days:

1. Record the iOS v1 ship date in the `mishran_mobile_sdd_state` memory + the deferred-decisions register (`mishran_deferred_register.md`).
2. File v2 issues for the parked items: iPad layout (`TARGETED_DEVICE_FAMILY` is iPhone-only), Apple Watch, Apple Pay evaluation, courier API integration.
3. Budgets-vs-actuals: IPA size vs 30 MB, cold-start p95 vs 1.5s on real devices, crash-free vs 99.5%.
4. Top defects + review-feedback themes → feed the Android parity backlog where applicable.
