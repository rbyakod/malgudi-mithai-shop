# Android v1 — Staged Rollout Runbook (Task 13.4)

Operational runbook, not code: every step below is executed by a human in
Play Console / the Firebase + Razorpay dashboards once the signed AAB exists
(Task 13.3's `android-release` workflow). Written now so the launch sequence
is reviewable before the first upload; check boxes as the rollout proceeds.

## Preconditions (all must be green before Step 1)

- [ ] `android-release` workflow ran green: signed AAB built, < 25MB, visible
      on the Play Console **internal track**.
- [ ] Store listing assets uploaded for all 9 locales
      (`apps/android/store-listing/*.md` copy + screenshots + feature graphic
      captured from a Pixel 4a-class emulator on the release build).
- [ ] Data safety form filled consistently with
      `apps/android/app/src/main/assets/privacy_policy.html` (hosted at
      https://mishran.app/privacy) — no SMS permission declared, biometric +
      notification permissions only.
- [ ] MSG91 OTP template live **with the app signature hash appended**
      (SMS Retriever depends on it; tracked open item from Task 8.3).
- [ ] Native-speaker review of the 7 new locale translations signed off
      (Task 12.3 caveat — review before production, not before internal).
- [ ] Staging soak: `tests/load/checkout-flow.k6.ts` run against production-
      shaped infra at least once, thresholds green.

## Rollout ladder

| Stage | Track / fraction | Audience | Soak | Exit gate |
|---|---|---|---|---|
| 0 | Internal | ~5 internal testers | 1 day | App installs, OTP + Razorpay test payment + order lifecycle widget all work |
| 1 | Closed testing | Opt-in list, ≤ 100 | 3 days | Crash-free ≥ 99.5%, no blocking reviews |
| 2 | Open testing | Play testers URL | 3 days | Crash-free ≥ 99.5%, payment success ≥ 97% |
| 3 | Production 5% | Staged rollout | 48 h | All three monitors below green |
| 4 | Production 20% | ↑ | 48 h | Same |
| 5 | Production 50% | ↑ | 48 h | Same |
| 6 | Production 100% | ↑ | — | Retro (below) |

Total ramp ≈ 2 weeks as planned. Increase the staged-rollout percentage in
Play Console → Release → Production → Advance rollout; **never** upload a new
AAB mid-ramp to fix an issue — halt, fix, restart at 5%.

## Monitors (checked at least daily during stages 3–6)

| Signal | Source | Green | Halt if |
|---|---|---|---|
| Crash-free sessions | Crashlytics | ≥ 99.5% | < 99.5% over any 24 h window |
| Payment success rate | Razorpay dashboard (captures vs settlements) | ≥ 97% | < 97% or any spike in `payment_failed` with a single Razorpay error code |
| Cold start p95 | Play Console Android vitals (startup) | ≤ 1.5 s | > 1.5 s sustained (cross-check macrobenchmark artifact if unclear) |
| Order funnel | Backend staging→prod logs, order_errors | create-order error rate < 1% | Any 5xx cluster on `/api/mobile/v1/*` |
| ANR rate | Play vitals | < 0.47% (bad-behavior threshold) | Above threshold |

## Halt procedure

1. Play Console → Production release → **Halt staged rollout**.
2. Do NOT unpublish; users who got the build keep it.
3. If the defect is server-side: fix backend, deploy, resume ramp (same AAB).
4. If the defect is app-side: halt, fix, bump `versionCode`, restart at 5%.
5. Record the halt + root cause in the retro section below.

## Post-launch retro (final step of the plan's Phase 13)

Fill after 100% + a few days of steady state:

- Ship date (100%): ____ (also goes into the deferred-decisions memory).
- Actual AAB size / cold-start p95 vs budget: ____ / ____.
- Crash-free at steady state: ____.
- Payment success at steady state: ____.
- Top 3 launch defects + root causes: ____.
- Deferred items worth pulling into v2 planning: courier API, refund
  self-serve, iPad, Apple Watch, Apple Pay (per plan Post-Launch section).
