// WhatsAppMessages.swift — P3 parity (Mishran Mobile Apps v1).
// Pure wa.me message builders for the two support/order surfaces that
// prefill text: the PDP's "Ask on WhatsApp" row (product + selected pack +
// quantity) and the cart's "Send order on WhatsApp" button (enumerated
// lines + total). Builders are pure string functions so the exact prefill
// copy is unit-testable without a URL/openURL harness — the views only pair
// them with BrandRepository.whatsappURL(digits:text:).
import Foundation

enum WhatsAppMessages {
    /// PDP prefill: greeting, product name, the selected pack + price line
    /// (pack chip prefixing the price when a derived rung is selected), and
    /// the quantity — everything ops needs to answer in one reply.
    ///
    ///     Hi Mishran! I'd like to ask about:
    ///     Kaju Katli
    ///     500g — ₹1,840 / 500g
    ///     Quantity: 2
    nonisolated static func productEnquiry(
        name: String,
        packLabel: String?,
        priceLine: String?,
        quantity: Int
    ) -> String {
        var lines = ["Hi Mishran! I'd like to ask about:", name]
        // Pack chip and price share one line when both exist; either alone
        // still rides (a price-less merch-style row keeps its chip, a base
        // pack keeps its bare price line).
        var detail = packLabel ?? ""
        if let priceLine {
            detail = detail.isEmpty ? priceLine : "\(detail) — \(priceLine)"
        }
        if !detail.isEmpty {
            lines.append(detail)
        }
        lines.append("Quantity: \(quantity)")
        return lines.joined(separator: "\n")
    }

    /// One cart line's WhatsApp row: "1. Kaju Katli (500g) × 2 — ₹1,840"
    /// (the pack chip rides in parens only on derived-pack lines, matching
    /// the cart row's own label). Pure so the enumeration is testable.
    nonisolated static func cartLine(
        index: Int,
        name: String,
        packLabel: String?,
        quantity: Int,
        unitPricePaise: Int
    ) -> String {
        let label = packLabel.map { "\(name) (\($0))" } ?? name
        return "\(index). \(label) × \(quantity) — \(CartView.rupees(unitPricePaise))"
    }

    /// Cart prefill: enumerated lines (cart-row order) + the total. The
    /// per-line price is the unit price the cart row itself shows; the total
    /// is Σ unit × qty so the operator can sanity-check the list.
    ///
    ///     Hi Mishran! I'd like to order:
    ///     1. Kaju Katli (500g) × 2 — ₹1,840
    ///     2. Motichoor Laddoo × 1 — ₹480
    ///     Total: ₹4,160
    nonisolated static func cartOrder(
        lines: [(name: String, packLabel: String?, quantity: Int, unitPricePaise: Int)],
        totalPaise: Int
    ) -> String {
        var rows = ["Hi Mishran! I'd like to order:"]
        for (offset, line) in lines.enumerated() {
            rows.append(cartLine(
                index: offset + 1,
                name: line.name,
                packLabel: line.packLabel,
                quantity: line.quantity,
                unitPricePaise: line.unitPricePaise
            ))
        }
        rows.append("Total: \(CartView.rupees(totalPaise))")
        return rows.joined(separator: "\n")
    }
}
