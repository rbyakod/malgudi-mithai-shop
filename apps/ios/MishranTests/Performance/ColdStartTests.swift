// ColdStartTests.swift — Task 20.2 (Mishran Mobile Apps v1).
// Cold-start budget: p95 ≤ 1.5s on iPhone SE 3 (plan global constraint).
// The unit-level critical path is everything that runs before first paint:
// SwiftData container construction, the cached-catalog read, and the
// CatalogRepository/CatalogViewModel build (MishranApp.init + HomeView.task
// do exactly this). The SwiftUI render itself is covered by the UI boot
// smoke; here we wall-clock the pre-UI path so a regression in container
// setup or cache reads fails fast instead of showing up as launch jank.
import XCTest
@testable import Mishran

@MainActor
final class ColdStartTests: XCTestCase {
    /// The whole pre-UI cold path, single-shot, must sit far inside the
    /// 1.5s budget (sim numbers are not device numbers, but a sim failure
    /// is always a real regression).
    func testColdStartCriticalPathUnderBudget() throws {
        let started = CFAbsoluteTimeGetCurrent()
        let container = try ModelContainerFactory.makeContainer(inMemory: true)
        SeedData.seedCatalogIfNeeded(context: container.mainContext)
        let cache = CatalogCache(context: container.mainContext)
        let repository = CatalogRepository(client: MishranAPIClient(), cache: cache)
        let viewModel = CatalogViewModel(repository: repository)
        let elapsed = CFAbsoluteTimeGetCurrent() - started

        XCTAssertGreaterThan(viewModel.products.count, 0, "cached catalog should be the launch state")
        XCTAssertLessThan(elapsed, 1.5, "cold-start critical path exceeded the 1.5s budget")
    }

    /// XCTest baseline machinery over the dominant cold cost (container
    /// construction). CI compares against the stored baseline.
    func testContainerConstructionBaseline() throws {
        let options = XCTMeasureOptions()
        options.iterationCount = 5
        measure(options: options) {
            _ = try? ModelContainerFactory.makeContainer(inMemory: true)
        }
    }
}
