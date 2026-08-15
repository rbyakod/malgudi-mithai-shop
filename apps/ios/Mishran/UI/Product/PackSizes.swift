// PackSizes.swift — P1 parity (Mishran Mobile Apps v1).
// VERBATIM port of lib/mithai/packSizes.ts — that file is the single source
// of truth for the pack-size algorithm (the Android app ports it too); do not
// re-derive or "fix" semantics here without changing the web first.
//
// Commerce (real per-variant pricing) is Phase 8 — until then the catalog
// carries exactly ONE real price per product as a display string, e.g.
// "₹920 / 250g". The reference sweet-shop PDPs show a 250g/500g/1kg
// selector, so for products priced per gram we derive the sibling sizes
// linearly from the single real price (rounded to the nearest ₹10). The
// derived numbers are DISPLAY-ONLY estimates; the BASE option always keeps
// the verbatim displayPrice so nothing real is rewritten (the server's
// cart/validate prices the base product either way — commerce is deferred
// server-side).
//
// Rules (mirroring packSizes.ts):
//   - Price unit is authoritative (it's what the customer actually pays
//     against), not the `weight` field — the two disagree on some scraped
//     products ("130g" weight, "₹399 / pack" price).
//   - Base sizes on the 250g / 500g / 1kg ladder get the full 3-option
//     selector; off-ladder bases (700g, 480 gm, …) keep a single chip —
//     scaling those to made-up neighbors looks worse than not offering them.
//   - Per-pack, bare ("₹455"), or on-request prices never derive: they
//     render the single real chip (or nothing if there's no weight either).
import Foundation

struct PackSize: Equatable, Identifiable {
    let label: String
    let priceLabel: String
    /// Grams, when the option is gram-priced — used for the linear scale.
    var grams: Int? = nil

    var id: String { label }
}

enum PackSizes {
    static let ladder = [250, 500, 1000]

    /// "1 kg" / "1kg" / "1 Kg" → 1000; "250g" / "480 gm" / "700 grams" → n.
    /// Case-insensitive `^(\d+(?:\.\d+)?)\s*(kg|g|gm|grams?)$` (packSizes.ts).
    static func parseGrams(_ unit: String) -> Int? {
        guard let match = try? Self.gramsRegex.wholeMatch(in: unit.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }
        guard let value = Double(match.1) else { return nil }
        return match.2.lowercased() == "kg" ? Int((value * 1000).rounded()) : Int(value.rounded())
    }

    private static let gramsRegex = /(?i)^(\d+(?:\.\d+)?)\s*(kg|g|gm|grams?)$/

    static func labelFor(grams: Int) -> String {
        grams >= 1000 && grams % 1000 == 0 ? "\(grams / 1000) kg" : "\(grams)g"
    }

    /// "₹920 / 250g" → 920; "₹1,084 / 500g" → 1084; "₹ on request / pack" → nil.
    /// Everything before the first "/", ₹/commas/spaces stripped, must then be
    /// fully numeric (packSizes.ts parsePrice).
    static func parsePrice(_ displayPrice: String) -> Double? {
        let pricePart = displayPrice.split(separator: "/", omittingEmptySubsequences: false).first ?? ""
        let digits = pricePart.filter { $0 != "₹" && $0 != "," && !$0.isWhitespace }
        guard let match = try? Self.priceRegex.wholeMatch(in: digits) else { return nil }
        return Double(match.1)
    }

    private static let priceRegex = /^(\d+(?:\.\d+)?)$/

    /// en-IN lakh grouping matches the scraped catalog strings ("₹1,08,432").
    static func formatRupees(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_IN")
        formatter.usesGroupingSeparator = true
        formatter.maximumFractionDigits = 0
        return "₹\(formatter.string(from: NSNumber(value: value.rounded())) ?? String(Int(value.rounded())))"
    }

    /// Nearest ₹10 (packSizes.ts round10; JS Math.round is half-away-from-zero
    /// for positives — .rounded()'s default matches).
    static func round10(_ value: Double) -> Int {
        Int((value / 10).rounded() * 10)
    }

    static func derivePackSizes(displayPrice: String?, weight: String?) -> [PackSize] {
        guard let displayPrice, !displayPrice.isEmpty else { return [] }

        // Unit suffix after the price, e.g. "₹920 / 250g" → "250g".
        let unit = Self.unitSuffix(of: displayPrice)
        let unitGrams = unit.flatMap { Self.parseGrams($0) }
        let basePrice = Self.parsePrice(displayPrice)

        if let unitGrams, let basePrice, ladder.contains(unitGrams) {
            // Full selector over the ladder, base option verbatim.
            return ladder.map { grams in
                if grams == unitGrams {
                    return PackSize(label: labelFor(grams: grams), priceLabel: displayPrice, grams: grams)
                }
                return PackSize(
                    label: labelFor(grams: grams),
                    priceLabel: "\(formatRupees(Double(round10(basePrice * Double(grams) / Double(unitGrams))))) / \(labelFor(grams: grams))",
                    grams: grams
                )
            }
        }

        // No derivation possible — fall back to a single informational chip.
        if let weight, !weight.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return [PackSize(label: weight.trimmingCharacters(in: .whitespacesAndNewlines), priceLabel: displayPrice)]
        }
        if let unit {
            return [PackSize(label: unit.trimmingCharacters(in: .whitespacesAndNewlines), priceLabel: displayPrice)]
        }
        return []
    }

    /// `/\/\s*(.+)$/` — the text after the first "/", leading whitespace
    /// skipped (packSizes.ts unitMatch). Nil when there is no "/".
    private static func unitSuffix(of displayPrice: String) -> String? {
        guard let slash = displayPrice.firstIndex(of: "/") else { return nil }
        let rest = displayPrice[displayPrice.index(after: slash)...]
        return String(rest.drop { $0.isWhitespace }).nilIfEmpty
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
