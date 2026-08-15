// HomeViewModelTests.swift — P1 parity (Mishran Mobile Apps v1).
// Pure derivations off the catalog rows: the featured-first best-sellers
// rule with its first-8-by-name fallback, and — since P2 — the
// shop-by-vertical portal assembly (counts + lead imagery, one portal per
// vertical, dead verticals degrade to placeholders). P3 adds the curated
// hero: /hero success populates the carousel state; failure or empty
// slides keep the static featured-hero path (hasHeroSlides false).
import SwiftData
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

    // MARK: Admin-curated hero (P3 parity)

    private let heroBaseURL = URL(string: "https://api.test/api/mobile/v1")!

    /// Real HomeViewModel over the MockURLProtocol seam (VerticalCatalog
    /// ViewModelTests' client setup): the catalog route stays unrouted so
    /// only the hero feed answers — load() must tolerate that. Routes are
    /// registered by each test BEFORE building the model (the reset here
    /// only clears state leaked from earlier classes).
    @MainActor
    private func makeHomeViewModel() -> HomeViewModel {
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: heroBaseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: heroBaseURL),
            retryDelay: 0
        )
        let container = try! ModelContainerFactory.makeContainer(inMemory: true)
        return HomeViewModel(
            repository: CatalogRepository(
                client: client,
                cache: CatalogCache(context: container.mainContext)
            ),
            heroRepository: HeroRepository(client: client)
        )
    }

    @MainActor
    func testHeroPopulatesOnSuccessWithoutBlockingTheCatalog() async {
        MockURLProtocol.reset()
        MockURLProtocol.routes["hero"] = (
            200, [:],
            Data(#"{"data":{"slides":[{"id":"p1","vertical":"mithai","slug":"kaju-katli","name":"Kaju Katli","priceLabel":"₹720/kg","imageURL":"https://cdn.test/kaju.jpg","imageAlt":"Kaju katli"}],"autoplayMs":7000}}"#.utf8)
        )
        let viewModel = makeHomeViewModel()

        await viewModel.load()

        XCTAssertTrue(viewModel.hasHeroSlides)
        XCTAssertEqual(viewModel.heroSlides.map(\.slug), ["kaju-katli"])
        XCTAssertEqual(viewModel.heroAutoplayMs, 7000)
        // The unrouted catalog failed silently — hero state is independent.
        XCTAssertEqual(viewModel.products.isEmpty, true)
    }

    @MainActor
    func testHeroFailureKeepsTheFeaturedFallback() async {
        MockURLProtocol.reset()
        MockURLProtocol.routes["hero"] = (500, [:], Data("{}".utf8))
        let viewModel = makeHomeViewModel()

        await viewModel.load()

        XCTAssertFalse(viewModel.hasHeroSlides, "a dead /hero must leave the static hero in place")
        XCTAssertEqual(viewModel.heroAutoplayMs, 5000, "default interval survives a failure")
    }

    @MainActor
    func testEmptySlidesKeepTheFeaturedFallback() async {
        MockURLProtocol.reset()
        MockURLProtocol.routes["hero"] = (200, [:], Data(#"{"data":{"slides":[],"autoplayMs":8000}}"#.utf8))
        let viewModel = makeHomeViewModel()

        await viewModel.load()

        XCTAssertFalse(viewModel.hasHeroSlides, "an unset global means the local hero, never a blank screen")
    }
}
