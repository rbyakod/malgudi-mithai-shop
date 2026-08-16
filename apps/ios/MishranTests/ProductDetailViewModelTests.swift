// Task 16.4 (Mishran Mobile Apps v1): ProductDetailViewModel tests —
// Add-to-Cart must upsert the singleton CartEntity + CartItemEntity in the
// SwiftData store (product detail fetched through the MockURLProtocol seam).
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class ProductDetailViewModelTests: XCTestCase {
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

    private func makeViewModel(slug: String) -> ProductDetailViewModel {
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
        return ProductDetailViewModel(slug: slug, client: client, context: container.mainContext)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let detailJSON = """
    {"data":{"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic",
    "displayPrice":"₹720/kg","freshnessStatus":"made-daily","dietaryTags":["gluten-free"],
    "allergens":["nuts"],"ingredients":"Cashews, sugar","shelfLife":"7 days",
    "storage":"Refrigerate","story":"The festive classic"}}
    """

    func testLoadFetchesDetailBySlug() async {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(detailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()

        XCTAssertEqual(vm.product?.name, "Kaju Katli")
        XCTAssertEqual(vm.product?.family, "classic")
        XCTAssertNil(vm.errorMessage)
        XCTAssertEqual(MockURLProtocol.calls["catalog/products/kaju-katli"], 1)
    }

    func testAddToCartUpsertsCartItem() async throws {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(detailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()

        vm.quantity = 2
        vm.addToCart()

        let carts = try container.mainContext.fetch(FetchDescriptor<CartEntity>())
        XCTAssertEqual(carts.count, 1, "exactly one singleton cart row")
        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].productId, "p1")
        XCTAssertEqual(items[0].quantity, 2)

        // Adding again from the detail screen INCREMENTS the existing line.
        vm.quantity = 1
        vm.addToCart()
        let itemsAfter = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(itemsAfter.count, 1, "same product merges into one line")
        XCTAssertEqual(itemsAfter[0].quantity, 3)
    }

    func testQuantityClampsToSaneRange() {
        let vm = makeViewModel(slug: "x")
        vm.setQuantity(0)
        XCTAssertEqual(vm.quantity, 1, "minimum quantity is 1")
        vm.setQuantity(100)
        XCTAssertEqual(vm.quantity, 20, "maximum quantity is 20")
    }

    // MARK: P1 pack sizes

    private let packDetailJSON = """
    {"data":{"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic",
    "displayPrice":"₹920 / 250g","weight":"250 g","featured":true,
    "freshnessStatus":"made-daily","dietaryTags":["gluten-free"],
    "allergens":["nuts"],"ingredients":"Cashews, sugar","shelfLife":"7 days",
    "storage":"Refrigerate","story":"The festive classic"}}
    """

    func testLoadDerivesPackSizesAndDefaultsToBaseRung() async {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(packDetailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()

        XCTAssertEqual(vm.packSizes.map(\.label), ["250g", "500g", "1 kg"])
        XCTAssertEqual(vm.selectedPack?.label, "250g", "the verbatim-priced rung is selected by default")
        XCTAssertEqual(vm.priceLine, "₹920 / 250g")
        XCTAssertEqual(vm.product?.weight, "250 g", "weight rides the DTO into the entity")
        XCTAssertEqual(vm.product?.featured, true)

        vm.selectPack(vm.packSizes[1])
        XCTAssertEqual(vm.priceLine, "₹1,840 / 500g", "selecting a chip swaps the price line")
    }

    func testAddToCartKeysDerivedPacksAsSeparateLines() async throws {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(packDetailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()

        // Base rung → bare productId; derived rungs → `${productId}:${label}`.
        vm.addToCart()
        vm.selectPack(vm.packSizes[1])
        vm.addToCart()
        vm.addToCart() // same derived pack again → merges

        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 2, "sibling sizes stack as separate lines")
        let byId = Dictionary(uniqueKeysWithValues: items.map { ($0.productId, $0) })
        XCTAssertEqual(byId["p1"]?.quantity, 1)
        XCTAssertEqual(byId["p1"]?.packLabel, nil, "base line carries no pack label")
        XCTAssertEqual(byId["p1:500g"]?.quantity, 2, "repeat adds increment the pack line")
        XCTAssertEqual(byId["p1:500g"]?.packLabel, "500g")
        XCTAssertEqual(byId["p1:500g"]?.unitPricePaise, 184000, "₹1,840 estimated for the derived rung")
    }

    func testAddToCartWithoutParsablePriceKeepsSingleLine() async throws {
        let unparsable = """
        {"data":{"id":"p9","slug":"on-request","name":"On Request Halwa","family":"seasonal",
        "displayPrice":"₹ on request"}}
        """
        MockURLProtocol.routes["catalog/products/on-request"] = (200, [:], json(unparsable))
        let vm = makeViewModel(slug: "on-request")
        await vm.load()

        XCTAssertEqual(vm.packSizes, [], "unparseable weight/price → no chips")
        XCTAssertEqual(vm.priceLine, "₹ on request")
        XCTAssertEqual(vm.product?.featured, nil)

        vm.quantity = 2
        vm.addToCart()
        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.map(\.productId), ["p9"], "bare id, no pack suffix")
        XCTAssertEqual(items[0].quantity, 2)
    }

    func testPricePaiseParsesPerGramDisplayPrices() async {
        // The old digit-scrape read "₹1,109 / 1 kg" as 1109100 paise.
        XCTAssertEqual(ProductDetailViewModel.pricePaise(from: "₹1,109 / 1 kg"), 110900)
        XCTAssertEqual(ProductDetailViewModel.pricePaise(from: "₹720/kg"), 72000)
        XCTAssertEqual(ProductDetailViewModel.pricePaise(from: "₹ on request / pack"), nil)
        XCTAssertEqual(ProductDetailViewModel.pricePaise(from: nil), nil)
    }

    func testLoadSurfacesError() async {
        MockURLProtocol.routes["catalog/products/ghost"] = (
            404, [:], json(#"{"error":{"code":"NOT_FOUND","message":"No such sweet"}}"#)
        )
        let vm = makeViewModel(slug: "ghost")
        await vm.load()
        XCTAssertNil(vm.product)
        XCTAssertEqual(vm.errorMessage, "No such sweet")
    }

    // MARK: P3 quick add (catalog card)

    private func quickAddFixture() -> ProductEntity {
        ProductEntity(
            id: "p1", slug: "kaju-katli", name: "Kaju Katli", family: "classic",
            displayPrice: "₹720/kg"
        )
    }

    func testQuickAddCreatesBareBasePackLine() throws {
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), in: container.mainContext)

        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].productId, "p1", "base pack keys as the bare productId")
        XCTAssertEqual(items[0].packLabel, nil, "quick-add lines carry no pack chip")
        XCTAssertEqual(items[0].quantity, 1)
        XCTAssertEqual(items[0].unitPricePaise, 72_000, "the verbatim displayPrice parses into paise")
    }

    func testQuickAddMergesWithItselfAndPDPBasePack() async throws {
        // Two card taps → one line at 2.
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), in: container.mainContext)
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), in: container.mainContext)

        // A PDP base-pack add on the same product merges by construction
        // (both key the bare productId).
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(detailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()
        vm.quantity = 3
        vm.addToCart()

        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 1, "quick adds and the PDP base pack share one line")
        XCTAssertEqual(items[0].quantity, 5)
    }

    func testQuickAddStacksSeparatelyFromDerivedPackLines() async throws {
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), in: container.mainContext)

        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(packDetailJSON))
        let vm = makeViewModel(slug: "kaju-katli")
        await vm.load()
        vm.selectPack(vm.packSizes[1]) // derived 500g rung
        vm.addToCart()

        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 2, "a derived-pack line stacks beside the quick-add base line")
        let byId = Dictionary(uniqueKeysWithValues: items.map { ($0.productId, $0) })
        XCTAssertEqual(byId["p1"]?.quantity, 1)
        XCTAssertEqual(byId["p1:500g"]?.quantity, 1)
    }

    func testQuickAddClampsAtMaxQuantity() throws {
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), quantity: 25, in: container.mainContext)
        ProductDetailViewModel.quickAddToCart(quickAddFixture(), quantity: 25, in: container.mainContext)

        let items = try container.mainContext.fetch(FetchDescriptor<CartItemEntity>())
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].quantity, 20, "the stepper's max rides the quick-add upsert too")
    }
}
