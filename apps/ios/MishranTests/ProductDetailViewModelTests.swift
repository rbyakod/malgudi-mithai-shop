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

    func testLoadSurfacesError() async {
        MockURLProtocol.routes["catalog/products/ghost"] = (
            404, [:], json(#"{"error":{"code":"NOT_FOUND","message":"No such sweet"}}"#)
        )
        let vm = makeViewModel(slug: "ghost")
        await vm.load()
        XCTAssertNil(vm.product)
        XCTAssertEqual(vm.errorMessage, "No such sweet")
    }
}
