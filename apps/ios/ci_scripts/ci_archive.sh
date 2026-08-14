#!/bin/bash
# ci_archive.sh — Task 21.1 (Mishran Mobile Apps v1).
# Archive + export the App Store IPA. Xcode Cloud can call this from a
# "Archive" post-action or CI runs it standalone; locally it doubles as
# the release dry-run.
#
# PREREQUISITES — all gated on Apple Developer Program enrollment (plan
# Open Question #8), NONE verifiable until it lands:
#   1. App ID com.mishran.app registered with capabilities:
#      Sign in with Apple, Push Notifications (APNs .p8 key-based),
#      Live Activity (NSSupportsLiveActivities already in Info.plist),
#      Wallet (pass type id for the loyalty .pkpass).
#   2. Apple Distribution certificate in the calling keychain, automatic
#      signing resolves the App Store provisioning profile.
#   3. REAL Team ID replacing TEAMIDPLACEHOLDER in Mishran/ExportOptions.plist.
#   4. App Store Connect app record for com.mishran.app created (manual —
#      Task 21.1 Step 3) with review info: demo phone credentials
#      (staging OTP mode), contact info, review notes mentioning OTP test
#      mode + Razorpay TEST keys.
#
# Plan constraint enforced below: IPA < 30 MB.
set -euo pipefail

cd "$(dirname "$0")/.." # apps/ios

TEAM_ID="${APPLE_TEAM_ID:-}"
if [ -z "$TEAM_ID" ]; then
  echo "SKIP: APPLE_TEAM_ID not set — Apple Developer Program enrollment" >&2
  echo "      (plan Open Question #8) gates real signing. Set APPLE_TEAM_ID" >&2
  echo "      to the 10-char Team ID and fix TEAMIDPLACEHOLDER in" >&2
  echo "      Mishran/ExportOptions.plist, then re-run." >&2
  exit 0
fi

if grep -q TEAMIDPLACEHOLDER Mishran/ExportOptions.plist; then
  echo "ERROR: Mishran/ExportOptions.plist still carries TEAMIDPLACEHOLDER." >&2
  echo "       Replace it with the real Team ID ($TEAM_ID) first." >&2
  exit 1
fi

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' Mishran/Info.plist)"
BUILD="${GITHUB_RUN_NUMBER:-$(date +%Y%m%d%H%M)}"
ARCHIVE="build/Mishran-${VERSION}-${BUILD}.xcarchive"
IPA="build/Mishran-${VERSION}-${BUILD}.ipa"

mkdir -p build

# Regenerate the project first (same hygiene as ci_post_clone.sh: the
# committed .xcodeproj tracks project.yml, but never archive a stale one).
if command -v xcodegen >/dev/null 2>&1; then
  xcodegen --spec project.yml
fi

xcodebuild archive \
  -project Mishran.xcodeproj \
  -scheme Mishran \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_IDENTITY="Apple Development" \
  -allowProvisioningUpdates \
  | tee build/archive.log | grep -E "^\*\* ARCHIVE" || {
    echo "ERROR: archive failed — see build/archive.log" >&2; exit 1;
  }

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist Mishran/ExportOptions.plist \
  -exportPath build \
  -allowProvisioningUpdates \
  | tee build/export.log | grep -E "^\*\* EXPORT" || {
    echo "ERROR: export failed — see build/export.log" >&2; exit 1;
  }

mv build/Mishran.ipa "$IPA"

# Plan budget: IPA < 30 MB (matches the Android 25 MB AAB gate).
IPA_BYTES=$(stat -f%z "$IPA")
IPA_MB=$(( (IPA_BYTES + 524287) / 1048576 ))
echo "[ios:release] IPA $IPA_MB MB ($IPA_BYTES bytes) — budget 30 MB"
if [ "$IPA_BYTES" -ge 31457280 ]; then
  echo "ERROR: IPA exceeds the 30 MB budget — strip assets before upload." >&2
  exit 1
fi

echo "[ios:release] ready: $IPA"
echo "[ios:release] upload via 'xcrun altool --upload-app -f $IPA' or Xcode Cloud / TestFlight (Task 21.3)."
