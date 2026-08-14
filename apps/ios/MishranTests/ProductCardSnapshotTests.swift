// Task 16.3 (Mishran Mobile Apps v1): ProductCard render smoke test in
// light + dark. No pixel-diff infra in v1 — we assert the card RENDERS in
// both schemes at a stable size (catches theme-token crashes and layout
// blowups, not 1px regressions).
import SwiftUI
import UIKit
import XCTest
@testable import Mishran

@MainActor
final class ProductCardSnapshotTests: XCTestCase {
    private func makeCard() -> ProductCard {
        let product = ProductEntity(
            id: "p1", slug: "kaju-katli", name: "Kaju Katli", family: "classic",
            displayPrice: "₹720/kg", freshnessStatus: "made-daily"
        )
        return ProductCard(product: product)
    }

    private func render(_ scheme: ColorScheme) -> UIImage? {
        let renderer = ImageRenderer(content: makeCard().environment(\.colorScheme, scheme))
        renderer.scale = 2
        return renderer.uiImage
    }

    func testProductCardRendersInLightAndDark() {
        let light = render(.light)
        let dark = render(.dark)
        XCTAssertNotNil(light)
        XCTAssertNotNil(dark)
        XCTAssertEqual(light?.size, dark?.size, "scheme must not change card metrics")
        XCTAssertGreaterThan(light?.size.width ?? 0, 0)
        XCTAssertGreaterThan(light?.size.height ?? 0, 0)
    }
}
