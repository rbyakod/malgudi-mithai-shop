#!/usr/bin/env bash
# apps/ios/maestro/run-flows.sh — Task 20.1.
# Builds + installs the app on the iPhone SE 3 simulator, then runs the
# Maestro E2E flows. Offline flows (seeded catalog) always run; the
# staging-gated flows are skipped with an explicit SKIP line unless their
# env is present, so a missing gate never reads as a pass.
set -euo pipefail
cd "$(dirname "$0")"

UDID="0229589A-E101-4C57-9DB6-5C1828C9B615"

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro not found — install with: curl -fsSL https://get.maestro.mobile.dev | bash" >&2
  exit 1
fi

# Build + install the app under test (fresh build products → simctl).
echo "==> Building Mishran for simulator…"
DERIVED="$(xcodebuild -project ../Mishran.xcodeproj -scheme Mishran \
  -destination "platform=iOS Simulator,name=iPhone SE (3rd generation),OS=17.2" \
  -showBuildSettings 2>/dev/null | awk '/ BUILT_PRODUCTS_DIR = /{print $3; exit}')"
xcodebuild -project ../Mishran.xcodeproj -scheme Mishran \
  -destination "platform=iOS Simulator,name=iPhone SE (3rd generation),OS=17.2" \
  build >/dev/null
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$DERIVED/Mishran.app"
echo "==> Installed Mishran.app ($DERIVED)"

STATUS=0

run_flow() {
  local flow="$1"
  echo "==> maestro test $flow"
  maestro test "$flow" || STATUS=1
}

skip_flow() {
  local flow="$1"; local reason="$2"
  echo "==> SKIP $flow — $reason"
}

# Offline catalog flows: always run (self-seeding via -seedCatalog).
run_flow browse_catalog.yaml
run_flow search_narrows_grid.yaml
run_flow product_detail_add_to_cart.yaml

# Staging + OTP gated (Razorpay TEST mode, real backend).
if [[ -n "${MAESTRO_OTP:-}" && -n "${MAESTRO_PHONE:-}" ]]; then
  run_flow sign_in_with_otp.yaml
  run_flow checkout_razorpay_test.yaml
else
  skip_flow sign_in_with_otp.yaml "staging backend + MAESTRO_PHONE/MAESTRO_OTP not set"
  skip_flow checkout_razorpay_test.yaml "staging backend + MAESTRO_PHONE/MAESTRO_OTP not set (Razorpay TEST mode)"
fi

# Staging + ops token gated (real order + ops status push).
if [[ -n "${MISHRAN_OPS_TOKEN:-}" && -n "${MISHRAN_STAGING_API:-}" && -n "${MISHRAN_ORDER_ID:-}" ]]; then
  run_flow track_order_live_activity.yaml
else
  skip_flow track_order_live_activity.yaml "staging + MISHRAN_OPS_TOKEN/MISHRAN_STAGING_API/MISHRAN_ORDER_ID not set (ops status push + APNs)"
fi

exit "$STATUS"
