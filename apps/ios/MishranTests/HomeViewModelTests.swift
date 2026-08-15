// HomeViewModelTests.swift — P1 parity (Mishran Mobile Apps v1).
// Pure derivations off the catalog rows: the featured-first best-sellers
// rule with its first-8-by-name fallback, and — since P2 — the
// shop-by-vertical portal assembly (counts + lead imagery, one portal per
// vertical, dead verticals degrade to placeholders).
import XCTest
@testable import Mishran

final class HomeViewModelTests: XCTestCase {
    private func product(
        _ id: String,
        name: String,
        family: ProductFamily = .classic,
        featured: Bool? = nil,
        image: String? = nil
    ) -> ProductEntity {
        ProductEntity(dto: ProductDTO(
            id: id, slug: id, name: name, family: family, displayPrice: nil,
            weight: nil, featured: featured, images: [image].compactMap { $0 }
        ))
    }

    func testBestSellersPrefersFeaturedRowsInServerOrder() {
        let products = [
            product("p1", name: "Alpha"),
            product("p2", name: "Beta", featured: true),
            product("p3", name: "Gamma"),
            product("p4", name: "Delta", featured: true),
        ]

        let rail = HomeViewModel.bestSellers(from: products)

        XCTAssertEqual(rail.map(\.id), ["p2", "p4"], "featured rows only, order preserved")
    }

    func testBestSellersFallsBackToFirstEightAlphabetically() {
        // Nothing flagged → first 8 by NAME (not server order), like Android.
        // Feed server order 9..0 so only the sort can produce 0..7.
        let products = (1...10).map { product("p\($0)", name: "Sweet \(10 - $0)") }

        let rail = HomeViewModel.bestSellers(from: products)

        XCTAssertEqual(rail.count, HomeViewModel.fallbackRailCount)
        XCTAssertEqual(rail.first?.name, "Sweet 0")
        XCTAssertEqual(rail.last?.name, "Sweet 7", "the tail is cut at 8")
    }

    func testFeaturedFalseIsNotFeatured() {
        let products = [
            product("p1", name: "Alpha", featured: false),
            product("p2", name: "Beta"),
        ]
        XCTAssertEqual(
            HomeViewModel.bestSellers(from: products).map(\.id),
            ["p1", "p2"],
            "featured:false + unflagged → fallback (both rows, name-sorted)"
        )
    }

    // MARK: P2 vertical portals

    private func snackPage(total: Int = 39, image: String? = "https://cdn.test/snack.jpg") -> SnackPageDTO {
        SnackPageDTO(
            items: [SnackDTO(
                id: "s1", slug: "bhujia", name: "Bhujia", category: nil, description: nil,
                images: [image].compactMap { $0 }, weight: "200 g", msrp: "₹60", retailers: nil,
                updatedAt: nil
            )],
            total: total, page: 1, pageSize: 50
        )
    }

    func testPortalsCoverEveryVerticalWithCountsAndLeadImagery() {
        let products = [
            product("p1", name: "A", family: .classic),
            product("p2", name: "B", family: .classic),
        ]

        let portals = HomeViewModel.portals(
            products: products, snacks: snackPage(total: 39), qsr: nil, merch: nil
        )

        XCTAssertEqual(portals.map(\.vertical), Vertical.allCases, "one portal per vertical, declared order")
        XCTAssertEqual(portals.first { $0.vertical == .mithai }?.count, 2)
        XCTAssertEqual(portals.first { $0.vertical == .snacks }?.count, 39)
        XCTAssertEqual(
            portals.first { $0.vertical == .snacks }?.imageURL, "https://cdn.test/snack.jpg",
            "snacks portal leads with its first item's image"
        )
        XCTAssertEqual(portals.first { $0.vertical == .snacks }?.label, "Snacks · 39")
    }

    func testDeadVerticalsDegradeToPlaceholderPortals() {
        // All three vertical fetches failed (nil pages) — portals still
        // render with count 0 / no image; the mithai portal stays real.
        let products = [product("p1", name: "A", image: "https://cdn.test/kaju.jpg")]

        let portals = HomeViewModel.portals(products: products, snacks: nil, qsr: nil, merch: nil)

        XCTAssertEqual(portals.count, 4, "a failed vertical never drops its portal card")
        XCTAssertEqual(portals.first { $0.vertical == .qsr }?.count, 0)
        XCTAssertNil(portals.first { $0.vertical == .merch }?.imageURL)
        XCTAssertEqual(portals.first { $0.vertical == .merch }?.label, "Merch", "count 0 drops the suffix")
        XCTAssertEqual(
            portals.first { $0.vertical == .mithai }?.imageURL, "https://cdn.test/kaju.jpg",
            "mithai imagery derives off the offline catalog, untouched by vertical failures"
        )
    }
}
