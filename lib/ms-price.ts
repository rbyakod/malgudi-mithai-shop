// lib/ms-price.ts
// Splits a catalog price label ("₹840 / 1 kg", "₹ 1,300/kg", "₹455") into
// the design system's Price parts: the figures (set in Mono) and the unit
// (set as a weight label). The ₹ itself is drawn by the caller in Tiro,
// because JetBrains Mono has no rupee sign. Returns null when the label has
// no figure (e.g. "₹ on request / pack"), so callers can leave the price out.

export type PriceParts = {amount: string; unit: string};

export function splitPriceLabel(label: string): PriceParts | null {
  const m = label.trim().match(/^₹?\s*([\d][\d,]*(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const unit = m[2].trim().replace(/^\/\s*/, "/ ");
  return {amount: m[1], unit};
}
