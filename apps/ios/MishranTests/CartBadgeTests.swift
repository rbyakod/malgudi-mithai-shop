// CartBadgeTests.swift — P3 parity (Mishran Mobile Apps v1).
// Badge math + accessibility label for the toolbar cart entry: the count is
// Σ quantity over cart lines (hidden at 0 by the view), and the VoiceOver
// label swaps between the localized "{count} items" form and the plain nav
// label (asserted through L() so the test is locale-agnostic).
import XCTest
@testable import Mishran

final class CartBadgeTests: XCTestCase {
    private func line(_ name: String, quantity: Int) -> CartItemEntity {
        CartItemEntity(
            productId: name,
            name: name,
            slug: name.lowercased(),
            packLabel: nil,
            unitPricePaise: 48_000,
            quantity: quantity
        )
    }

    func testTotalSumsQuantitiesAcrossLines() {
        XCTAssertEqual(CartBadgeCount.total(of: []), 0)
        XCTAssertEqual(
            CartBadgeCount.total(of: [line("Kaju Katli", quantity: 2), line("Mysore Pak", quantity: 3)]),
            5
        )
    }

    func testLabelCarriesCountWhenCartHasLines() {
        XCTAssertEqual(CartBadgeCount.label(count: 3), L("cart.badge.count", "3"))
        XCTAssertEqual(CartBadgeCount.label(count: 1), L("cart.badge.count", "1"))
    }

    func testLabelFallsBackToPlainNavTitleAtZero() {
        XCTAssertEqual(CartBadgeCount.label(count: 0), L("nav.cart"), "empty cart announces plain Cart, no zero bubble")
    }
}
