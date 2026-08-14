// CatalogScrollTests.swift — Task 20.2 (Mishran Mobile Apps v1).
// Scroll budget: p95 frame drop < 5% over a 500-item catalog (plan Step 3).
// Frame drops can only be measured with Instruments on a real device, so
// the unit-level honest equivalent pins the main-thread work the scroll
// and search paths actually do — CatalogViewModel.filter over 500 rows —
// to a per-frame budget: if one filter pass costs well under a 60fps
// frame (16ms), LazyVGrid scrolling + typing cannot shed frames from
// data work. The Instruments pass on hardware is recorded as the manual
// gate in the ledger.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CatalogScrollTests: XCTestCase {
    private func makeContainerWith500Products() throws -> ModelContainer {
        let container = try ModelContainerFactory.makeContainer(inMemory: true)
        let context = container.mainContext
        for index in 0..<500 {
            context.insert(ProductEntity(
                id: "p_perf_\(index)",
                slug: "perf-sweet-\(index)",
                name: "Perf Sweet \(index)",
                family: index % 2 == 0 ? "classic" : "dryfruit",
                displayPrice: "₹\(500 + index)/kg",
                dietaryTags: index % 3 == 0 ? ["gluten-free"] : []
            ))
        }
        try context.save()
        return container
    }

    /// p95 filter-pass time over the 500-row grid must stay inside one
    /// 60fps frame (16ms) — the static equivalent of "p95 frame drop < 5%".
    func testFilterPassP95WithinFrameBudget() throws {
        let container = try makeContainerWith500Products()
        let products = CatalogCache(context: container.mainContext).cachedProducts()
        XCTAssertEqual(products.count, 500)

        var samples: [Double] = []
        for _ in 0..<100 {
            let started = CFAbsoluteTimeGetCurrent()
            _ = CatalogViewModel.filter(
                products,
                searchText: "perf sweet 4",
                filters: CatalogFilters(dietary: ["gluten-free"])
            )
            samples.append(CFAbsoluteTimeGetCurrent() - started)
        }
        let sorted = samples.sorted()
        let p95 = sorted[Int(Double(sorted.count - 1) * 0.95)]
        XCTAssertLessThan(
            p95, 0.016,
            "p95 filter pass over 500 items exceeded one 60fps frame (16ms)"
        )
    }

    /// XCTest baseline over the same pass for CI trend tracking.
    func testFilterPassBaseline() throws {
        let container = try makeContainerWith500Products()
        let products = CatalogCache(context: container.mainContext).cachedProducts()
        let options = XCTMeasureOptions()
        options.iterationCount = 10
        measure(options: options) {
            _ = CatalogViewModel.filter(
                products,
                searchText: "perf",
                filters: CatalogFilters()
            )
        }
    }
}
