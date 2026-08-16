// CartBadge.swift — P3 parity (Mishran Mobile Apps v1).
// Live cart-count badge for the toolbar cart entry (HomeView). The count is
// Σ quantity over the SwiftData cart lines, observed reactively through the
// same @Query pattern CartView uses — every cart write (PDP add, quick add,
// cart stepper, clear, checkout) re-renders the badge. Hidden at 0 (an
// empty cart shows the plain cart glyph, no zero bubble). The derivation is
// a pure function so the badge math is unit-testable without rendering.
import SwiftData
import SwiftUI

/// Pure badge math + label derivation (testable without a view).
enum CartBadgeCount {
    /// Σ quantity over cart lines — the badge's live value.
    nonisolated static func total(of lines: [CartItemEntity]) -> Int {
        lines.reduce(0) { $0 + $1.quantity }
    }

    /// Toolbar accessibility label: the localized "{count} items" form when
    /// the cart has lines, the plain nav label at 0.
    nonisolated static func label(count: Int) -> String {
        count > 0 ? L("cart.badge.count", "\(count)") : L("nav.cart")
    }
}

/// Cart glyph + count capsule for the Home toolbar's cart entry. Drop-in
/// replacement for the bare `Label(L("nav.cart"), systemImage: "cart")` —
/// the NavigationLink wrapping it keeps driving the push.
struct CartToolbarLabel: View {
    @Query private var lines: [CartItemEntity]

    private var count: Int { CartBadgeCount.total(of: lines) }

    var body: some View {
        Label(L("nav.cart"), systemImage: "cart")
            .overlay(alignment: .topTrailing) {
                if count > 0 {
                    Text("\(count)")
                        .font(.mishranBodySm.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(Capsule().fill(Color.mishranStateError))
                        .offset(x: 8, y: -6)
                        .accessibilityHidden(true)
                }
            }
            // Count rides the label, not the glyph — VoiceOver announces
            // "Cart, 3 items" instead of a bare "Cart" + stray "3".
            .accessibilityLabel(CartBadgeCount.label(count: count))
    }
}
