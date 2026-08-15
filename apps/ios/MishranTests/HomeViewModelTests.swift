// HomeViewModelTests.swift — P1 parity (Mishran Mobile Apps v1).
// Pure derivations off the catalog rows: the featured-first best-sellers
// rule with its first-8-by-name fallback, and the family chip counts.
import XCTest
@testable import Mishran

final class HomeViewModelTests: XCTestCase {
    private func product(
        _ id: String,
        name: String,
        family: ProductFamily = .classic,
        featured: Bool? = nil
    ) -> ProductEntity {
        ProductEntity(dto: ProductDTO(
            id: id, slug: id, name: name, family: family, featured: featured
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

    func testFamilyChipsCountEveryFamily() {
        let products = [
            product("p1", name: "A", family: .classic),
            product("p2", name: "B", family: .classic),
            product("p3", name: "C", family: .regional),
        ]

        let chips = HomeViewModel.familyChips(from: products)

        XCTAssertEqual(chips.map(\.family), ProductFamily.allCases, "every family chips, declared order")
        XCTAssertEqual(chips.first { $0.family == .classic }?.count, 2)
        XCTAssertEqual(chips.first { $0.family == .regional }?.count, 1)
        XCTAssertEqual(chips.first { $0.family == .seasonal }?.count, 0, "empty families still chip with count 0")
        XCTAssertEqual(chips.first { $0.family == .seasonal }?.label, "Seasonal", "zero-count chips drop the count suffix")
        XCTAssertEqual(chips.first { $0.family == .classic }?.label, "Classic · 2")
    }
}
