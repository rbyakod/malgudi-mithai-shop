// Task 16.3 (Mishran Mobile Apps v1): CatalogViewModel tests — 3 products
// through the MockURLProtocol seam, then search/family/dietary filter logic
// (pure function) over them.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CatalogViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
    }

    override func tearDown() {
        container = nil
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        super.tearDown()
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let productsJSON = """
    {"data":{"items":[
    {"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic",
     "dietaryTags":["gluten-free"]},
    {"id":"p2","slug":"sugarfree-kaju","name":"Sugar-Free Kaju Katli","family":"sugar-free",
     "dietaryTags":["sugar-free","gluten-free"]},
    {"id":"p3","slug":"nolen-gurer-sandesh","name":"Nolen Gurer Sandesh","family":"regional",
     "dietaryTags":["eggless"]}
    ],"total":3,"page":1,"pageSize":50}}
    """

    private func makeViewModel() -> CatalogViewModel {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: baseURL),
            retryDelay: 0
        )
        let repository = CatalogRepository(client: client, cache: CatalogCache(context: container.mainContext))
        return CatalogViewModel(repository: repository)
    }

    func testLoadFillsProducts() async {
        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"e1\""], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()
        XCTAssertEqual(vm.products.count, 3)
        XCTAssertNil(vm.errorMessage)
    }

    func testSearchTextFiltersByName() async {
        MockURLProtocol.routes["catalog/products"] = (200, [:], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()

        vm.searchText = "kaju"
        XCTAssertEqual(vm.filteredProducts.count, 2)

        vm.searchText = "sandesh"
        XCTAssertEqual(vm.filteredProducts.map(\.name), ["Nolen Gurer Sandesh"])

        vm.searchText = ""
        XCTAssertEqual(vm.filteredProducts.count, 3)
    }

    func testFamilyFilter() async {
        MockURLProtocol.routes["catalog/products"] = (200, [:], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()

        vm.filters.family = .sugarFree
        XCTAssertEqual(vm.filteredProducts.map(\.slug), ["sugarfree-kaju"])

        vm.filters.family = nil
        XCTAssertEqual(vm.filteredProducts.count, 3)
    }

    func testDietaryFilterMatchesTags() async {
        MockURLProtocol.routes["catalog/products"] = (200, [:], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()

        vm.filters.dietary = ["eggless"]
        XCTAssertEqual(vm.filteredProducts.map(\.slug), ["nolen-gurer-sandesh"])

        vm.filters.dietary = ["gluten-free"]
        XCTAssertEqual(vm.filteredProducts.count, 2)
    }

    func testFiltersCombineAsAnd() async {
        MockURLProtocol.routes["catalog/products"] = (200, [:], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()

        vm.searchText = "kaju"
        vm.filters.family = .sugarFree
        XCTAssertEqual(vm.filteredProducts.map(\.slug), ["sugarfree-kaju"])

        vm.filters.dietary = ["eggless"] // AND — nothing matches all three
        XCTAssertEqual(vm.filteredProducts.count, 0)
    }

    func testPureFilterFunctionIsSearchable() {
        // The pure function is the unit under test — independent of any repo.
        let products = [
            ProductEntity(dto: ProductDTO(id: "a", slug: "a", name: "Alpha Mithai", family: .classic,
                                          displayPrice: "₹100")),
        ]
        let out = CatalogViewModel.filter(products, searchText: "alpha", filters: CatalogFilters())
        XCTAssertEqual(out.count, 1)
        XCTAssertEqual(CatalogViewModel.filter(products, searchText: "zzz", filters: CatalogFilters()).count, 0)
    }

    // MARK: P3 — widened search matcher

    func testMatcherHitsNameSlugStoryIngredientsFamilyAndTags() {
        let product = ProductEntity(
            id: "p9", slug: "rose-barfi", name: "Gulab Petal Barfi", family: "classic",
            displayPrice: "₹480",
            dietaryTags: ["rose", "eggless"],
            ingredients: "Cashews, rose petals, cane sugar",
            story: "A Lucknowi karigari classic perfumed with damask rose."
        )
        for query in [
            "gulab",        // name
            "rose-barfi",   // slug
            "damask",       // story (long-form copy)
            "cashews",      // ingredients
            "classic",      // family raw value
            "eggless",      // dietary tag
            "ROSE",         // case-insensitive
        ] {
            XCTAssertTrue(CatalogViewModel.matches(product, searchText: query), "query \(query) should hit")
        }
        XCTAssertFalse(CatalogViewModel.matches(product, searchText: "laddoo"), "no haystack carries this")
        XCTAssertTrue(CatalogViewModel.matches(product, searchText: "  "), "blank-ish query passes everything")
        XCTAssertTrue(CatalogViewModel.matches(product, searchText: ""), "empty query passes everything")
    }

    func testMatcherIsDiacriticInsensitive() {
        let product = ProductEntity(id: "p10", slug: "cafe-barfi", name: "Café Barfi", family: "classic")
        XCTAssertTrue(CatalogViewModel.matches(product, searchText: "cafe"))
    }

    // MARK: P3 — sort composition

    func testFilteredProductsNarrowsThenSorts() async {
        MockURLProtocol.routes["catalog/products"] = (200, [:], json(productsJSON))
        let vm = makeViewModel()
        await vm.load()

        vm.searchText = "kaju"
        vm.sort = .nameDesc
        XCTAssertEqual(vm.filteredProducts.map(\.name), ["Sugar-Free Kaju Katli", "Kaju Katli"], "survivors re-order under the active sort")
        XCTAssertEqual(CatalogSort.load(from: UserDefaults.standard), .nameDesc, "the choice persists on change")
        UserDefaults.standard.removeObject(forKey: CatalogSort.defaultsKey)
    }
}
