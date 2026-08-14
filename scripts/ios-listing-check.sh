#!/bin/bash
# ios-listing-check.sh — Task 21.2 (Mishran Mobile Apps v1).
# Machine-verifies the App Store listing JSONs against App Store Connect
# field limits before upload:
#   name ≤ 30, subtitle ≤ 30, keywords ≤ 100 (commas count),
#   promotionalText ≤ 170, description ≤ 4000.
# Also checks the 9-locale roster matches the plan (en hi kn ta te mr gu bn pa)
# and that shared URLs are set in every locale.
# Run: pnpm ios:listing:check
set -euo pipefail

cd "$(dirname "$0")/.."

python3 - <<'PY'
import json, pathlib, sys

LOCALES = ["en", "hi", "kn", "ta", "te", "mr", "gu", "bn", "pa"]
LIMITS = {
    "name": 30,
    "subtitle": 30,
    "keywords": 100,
    "promotionalText": 170,
    "description": 4000,
}
D = pathlib.Path("apps/ios/store-listing")

found = sorted(p.stem for p in D.glob("*.json"))
if found != sorted(LOCALES):
    print(f"ERROR: locale roster mismatch: found {found}, expected {sorted(LOCALES)}")
    sys.exit(1)

failures = 0
for loc in LOCALES:
    data = json.loads((D / f"{loc}.json").read_text())
    for field, limit in LIMITS.items():
        n = len(data[field])
        status = "OK" if n <= limit else "OVER LIMIT"
        if n > limit:
            failures += 1
        print(f"{loc}.{field}: {n}/{limit} {status}")
    for url in ("privacyPolicyUrl", "supportUrl"):
        if not data.get(url, "").startswith("https://"):
            print(f"ERROR: {loc}.{url} missing/not https")
            failures += 1

if failures:
    print(f"FAILED: {failures} listing violations")
    sys.exit(1)
print(f"OK: {len(LOCALES)} locales within all App Store Connect limits")
PY
