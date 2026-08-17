// ProductCardInitTests.swift — guards the trailing-closure trap that broke
// the Home rail (2026-08-17): with two optional closure params, a single
// UNLABELED trailing closure binds onQuickAdd (the LAST closure param —
// Swift's legacy backward scan), leaving onTap nil. That wired quick-add
// onto the rail and made card taps dead. Rail-style call sites must label
// onTap; this test pins both behaviors so a revert fails loudly.
import XCTest
@testable import Mishran

@MainActor
final class ProductCardInitTests: XCTestCase {
    private func makeProduct() -> ProductEntity {
        ProductEntity(
            id: "p1", slug: "kaju-katli", name: "Kaju Katli", family: "classic",
            displayPrice: "₹720/kg", freshnessStatus: "made-daily"
        )
    }

    func testLabeledOnTapLeavesQuickAddNil() {
        var tapRan = false
        let card = ProductCard(product: makeProduct(), onTap: { tapRan = true })
        XCTAssertNotNil(card.onTap, "labeled onTap must bind the tap closure")
        XCTAssertNil(card.onQuickAdd, "rail surfaces must not render quick-add")
        card.onTap?()
        XCTAssertTrue(tapRan)
    }

    func testUnlabeledTrailingClosureBindsQuickAddNotOnTap() {
        // Documents the language rule the rail call sites must avoid — if
        // this ever flips to binding onTap, the labeled-init guard above
        // still holds, but rail sites written with a trailing closure
        // would silently regress; keep them labeled regardless.
        let unlabeled = ProductCard(product: makeProduct()) { }
        XCTAssertNil(unlabeled.onTap, "unlabeled trailing closure binds onQuickAdd, not onTap")
        XCTAssertNotNil(unlabeled.onQuickAdd)
    }
}
