# Mishran iOS — TestFlight Version History

<!-- Task 21.3 (Mishran Mobile Apps v1). Append one row per uploaded build;
     App Store Connect keeps the authoritative copy — this file is the
     in-repo record. GATED on Apple Developer Program enrollment (Open
     Question #8): no build can be uploaded until the 21.1 prerequisites
     (real team ID, distribution cert, app record) are in place. -->

| Version | Build | Date | What to Test (summary) | Outcome |
|---------|-------|------|------------------------|---------|
| 0.1.0 | — | — | First TestFlight build once enrollment lands. Full journey per `beta-info.json` (en): sign-in with staging OTP, catalog search/filter, cart + slot checkout via Razorpay TEST, order tracking + Live Activity, language switch, Wallet pass. | pending |

## Procedure (Steps 1-5 of the plan task)

1. **Archive + upload**: `APPLE_TEAM_ID=<id> apps/ios/ci_scripts/ci_archive.sh`
   → `xcrun altool --upload-app -f build/Mishran-<ver>-<build>.ipa`
   (or Xcode → Product → Archive → Distribute App → App Store Connect).
   The 30 MB IPA budget is enforced by the script.
2. **Beta info per locale**: paste each locale's `betaAppDescription` /
   `whatToTest` from `beta-info.json` into TestFlight → Test Information.
   Feedback email: `support@mishran.app`.
3. **Internal testers (5)**: App Store Connect users group; builds are
   available in minutes (no beta review). Resolve feedback by bumping
   versionCode + re-upload.
4. **External group (50 invited)**: requires beta app review (~24-48h);
   public link optional. Same `whatToTest` note ships with the invite.
5. **Record the build here** (row above) and note any beta-review feedback.

## Review notes to attach (shared with 21.1 Step 4)

- Demo account: staging phone number + fixed OTP (backend OTP_PROVIDER=fake
  on staging; credentials live in the ops vault, NOT in this repo).
- Razorpay runs in TEST mode on staging — no real charges are possible.
- Sign in with Apple is configured against the staging APPLE_CLIENT_ID.
