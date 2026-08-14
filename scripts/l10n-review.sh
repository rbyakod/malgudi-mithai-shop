#!/usr/bin/env bash
# scripts/l10n-review.sh — Task 20.3 (Mishran Mobile Apps v1).
# Drives the native-speaker review pass (plan Open Question #10 — the
# vendor/community gate). Mechanical preflight runs here; the checklist
# itself is for the native speakers of each locale.
#
# Usage:
#   pnpm l10n:review            # preflight + print checklist
#   REVIEW_LOCALES=hi,ta pnpm l10n:review
set -euo pipefail
cd "$(dirname "$0")/.."

LOCALES="${REVIEW_LOCALES:-hi,kn,ta,te,mr,gu,bn,pa}"

echo "== i18n key parity (all locales must match en.json) =="
pnpm --quiet --filter @mishran/i18n-strings run check

echo
echo "== Keys identical to English (translate-or-bless list) =="
node --input-type=module - "$LOCALES" <<'EOF'
import { readFileSync } from 'node:fs';
const locales = process.argv[2].split(',');
const en = JSON.parse(readFileSync('packages/i18n-strings/en.json', 'utf8'));
let flagged = 0;
for (const loc of locales) {
  const dict = JSON.parse(readFileSync(`packages/i18n-strings/${loc}.json`, 'utf8'));
  const same = Object.keys(en).filter((k) => dict[k] === en[k]);
  flagged += same.length;
  console.log(`${loc}: ${same.length} identical-to-en ${same.length ? '→ ' + same.join(', ') : '(clean)'}`);
}
console.log(flagged ? `\n${flagged} keys need a native-speaker verdict: translate, or bless as brand/placeholder.` : '\nAll keys carry translated values.');
EOF

echo
echo "== .strings bundles are current with the JSON source =="
pnpm --quiet --filter @mishran/i18n-strings run codegen:ios >/dev/null
git diff --exit-code -- apps/ios/Mishran/Resources packages/i18n-strings/generated \
  && echo "✓ generated bundles match the JSON source" \
  || echo "✗ STALE BUNDLES — commit the regenerated output above."

cat <<'CHECKLIST'

== Native-speaker checklist (per locale) ==
For each locale in REVIEW_LOCALES, the reviewer confirms:
  1. Every user-visible string reads naturally (not transliterated English).
  2. Honorifics/politeness register is consistent across screens.
  3. Placeholders ({phone}, {minutes}, …) survive verbatim — count them.
  4. Currency renders as ₹ and numbers group per Indian convention.
  5. Food terms match the region's usage (e.g. লাড্ডু/লাড্ডু, ਲੱਡੂ).
  6. UI review on device at Dynamic Type AX1 + AX5 — no truncation that
     changes meaning (en, hi, ta at minimum per plan Step 4).
Reviewer signs off per locale in .superpowers/sdd/progress.md.
CHECKLIST
