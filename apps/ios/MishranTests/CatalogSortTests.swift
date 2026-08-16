// CatalogSortTests.swift — P3 parity (Mishran Mobile Apps v1).
// Ordering rules + persistence for the catalog's sort menu: Featured puts
// flagged rows first then folds names A–Z, name modes reverse cleanly, and
// the UserDefaults round trip falls back to Featured on missing/garbage
// raw values instead of crashing.
import XCTest
@testable import Mishran

final class CatalogSortTests: XCTestCase {
    private func product(_ name: String, featured: Bool? = nil) -> ProductEntity {
        ProductEntity(
            id: name, slug: name.lowercased(), name: name, family: "classic",
            featured: featured
        )
    }

    private func names(_ products: [ProductEntity]) -> [String] {
        products.map(\.name)
    }

    private var shuffled: [ProductEntity] {
        [product("Kaju Katli"), product("Badam Barfi"), product("Motichoor Laddoo"), product("Anjeer Halwa")]
    }

    // MARK: Comparator

    func testFeaturedOrdersFlaggedFirstThenNameAZ() {
        let rows = shuffled + [
            product("Zz Sugar-Free Barfi", featured: true),
            product("Aa Mysore Pak", featured: true),
            product("Featured Late Alphabet", featured: true),
        ]

        let sorted = rows.sorted(by: CatalogSort.featured.areInIncreasingOrder)

        XCTAssertEqual(
            names(sorted),
            ["Aa Mysore Pak", "Featured Late Alphabet", "Zz Sugar-Free Barfi", "Anjeer Halwa", "Badam Barfi", "Kaju Katli", "Motichoor Laddoo"],
            "flagged rows lead (in name order), unflagged follow (in name order)"
        )
    }

    func testFeaturedWithNoFlagsCollapsesToNameAZ() {
        XCTAssertEqual(
            names(shuffled.sorted(by: CatalogSort.featured.areInIncreasingOrder)),
            ["Anjeer Halwa", "Badam Barfi", "Kaju Katli", "Motichoor Laddoo"]
        )
    }

    func testNameAscFoldsCaseAndDiacritics() {
        let rows = [
            product("éclair Mithai"),
            product("Apple Barfi"),
            product("banana Laddoo"),
        ]
        XCTAssertEqual(names(rows.sorted(by: CatalogSort.nameAsc.areInIncreasingOrder)), ["Apple Barfi", "banana Laddoo", "éclair Mithai"])
    }

    func testNameDescIsTheMirrorOfNameAsc() {
        let asc = shuffled.sorted(by: CatalogSort.nameAsc.areInIncreasingOrder)
        let desc = shuffled.sorted(by: CatalogSort.nameDesc.areInIncreasingOrder)
        XCTAssertEqual(names(desc), names(asc).reversed())
    }

    func testKeyBasedSortAgreesWithTheComparator() {
        var rows = shuffled
        rows.append(product("Zz Sugar-Free Barfi", featured: true))
        for sort in CatalogSort.allCases {
            XCTAssertEqual(
                names(sort.sorted(rows)),
                names(rows.sorted(by: sort.areInIncreasingOrder)),
                "\(sort.rawValue): key-based path and comparator must agree"
            )
        }
    }

    // MARK: Persistence

    private var suiteName: String { "catalog-sort-tests-\(UUID().uuidString)" }

    func testStoreThenLoadRoundTrips() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        for sort in CatalogSort.allCases {
            CatalogSort.store(sort, in: defaults)
            XCTAssertEqual(CatalogSort.load(from: defaults), sort, "\(sort.rawValue) survives the round trip")
        }
    }

    func testLoadFallsBackToFeaturedForMissingOrGarbageRawValue() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        XCTAssertEqual(CatalogSort.load(from: defaults), .featured, "nothing stored → Featured")

        defaults.set("price-desc", forKey: CatalogSort.defaultsKey)
        XCTAssertEqual(CatalogSort.load(from: defaults), .featured, "a future mode's raw value falls back, never crashes")
    }
}
