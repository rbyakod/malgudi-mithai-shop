// lib/web/format.ts
// Paise → display label. Ported from the Android app's
// CartScreen.formatPaise so web totals render identically to the apps
// (grouping via Locale.ENGLISH, whole rupees drop the decimals):
//   72000   → "₹720"
//   110950  → "₹1,109.50"
//   4900    → "₹49"

const GROUPED = new Intl.NumberFormat("en-US", {
  // en-US grouping matches Android's String.format(Locale.ENGLISH, "%,d", …).
  // Not en-IN lakh/crore grouping — cross-platform parity wins for now.
  maximumFractionDigits: 0,
});

export function formatPaise(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const remainder = Math.trunc(paise % 100);
  if (remainder === 0) return `₹${GROUPED.format(rupees)}`;
  return `₹${GROUPED.format(rupees)}.${String(remainder).padStart(2, "0")}`;
}
