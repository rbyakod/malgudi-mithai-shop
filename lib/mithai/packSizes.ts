// lib/mithai/packSizes.ts
// Derive the PDP's pack-size options from a product's display price + weight.
//
// Commerce (real per-variant pricing) is Phase 8 — until then the catalog
// carries exactly ONE real price per product as a display string, e.g.
// "₹920 / 250g". The reference sweet-shop PDPs show a 250g/500g/1kg
// selector, so for products priced per gram we derive the sibling sizes
// linearly from the single real price (rounded to the nearest ₹10). The
// derived numbers are display-only estimates; the BASE option always keeps
// the verbatim displayPrice so nothing real is rewritten.
//
// Rules:
//   - Price unit is authoritative (it's what the customer actually pays
//     against), not the `weight` field — the two disagree on some scraped
//     products ("130g" weight, "₹399 / pack" price).
//   - Base sizes on the 250g / 500g / 1kg ladder get the full 3-option
//     selector; off-ladder bases (700g, 480 gm, …) keep a single chip —
//     scaling those to made-up neighbors looks worse than not offering them.
//   - Per-pack, bare ("₹455"), or on-request prices never derive: they
//     render the single real chip (or nothing if there's no weight either).

export type PackSize = {
  label: string;
  priceLabel: string;
  /** Grams, when the option is gram-priced — used for the linear scale. */
  grams?: number;
};

const LADDER = [250, 500, 1000];

// "1 kg" / "1kg" / "1 Kg" → 1000; "250g" / "480 gm" / "700 grams" → n.
function parseGrams(unit: string): number | null {
  const m = unit.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|gm|grams?)$/i);
  if (!m) return null;
  const value = Number(m[1]);
  return m[2].toLowerCase() === "kg" ? Math.round(value * 1000) : Math.round(value);
}

function labelFor(grams: number): string {
  return grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams}g`;
}

// "₹920 / 250g" → 920; "₹1,084 / 500g" → 1084; "₹ on request / pack" → null.
function parsePrice(displayPrice: string): number | null {
  const pricePart = displayPrice.split("/")[0]!;
  const m = pricePart.replace(/[₹,\s]/g, "").match(/^\d+(\.\d+)?$/);
  return m ? Number(m[0]) : null;
}

function formatRupees(value: number): string {
  // en-IN grouping matches the scraped catalog strings ("₹1,084 / 500g").
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function derivePackSizes(
  displayPrice: string,
  weight?: string | null,
): PackSize[] {
  if (!displayPrice) return [];

  // Unit suffix after the price, e.g. "₹920 / 250g" → "250g".
  const unitMatch = displayPrice.match(/\/\s*(.+)$/);
  const unitGrams = unitMatch ? parseGrams(unitMatch[1]!) : null;
  const basePrice = parsePrice(displayPrice);

  if (unitGrams !== null && basePrice !== null && LADDER.includes(unitGrams)) {
    // Full selector over the ladder, base option verbatim.
    return LADDER.map((grams) =>
      grams === unitGrams
        ? {label: labelFor(grams), priceLabel: displayPrice, grams}
        : {
            label: labelFor(grams),
            priceLabel: `${formatRupees(round10((basePrice * grams) / unitGrams))} / ${labelFor(grams)}`,
            grams,
          },
    );
  }

  // No derivation possible — fall back to a single informational chip.
  if (weight && weight.trim()) {
    return [{label: weight.trim(), priceLabel: displayPrice}];
  }
  if (unitMatch) {
    return [{label: unitMatch[1]!.trim(), priceLabel: displayPrice}];
  }
  return [];
}

function round10(value: number): number {
  return Math.round(value / 10) * 10;
}
