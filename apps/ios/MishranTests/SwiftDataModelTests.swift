// Task 16.1 (Mishran Mobile Apps v1): SwiftData model tests. Uses an
// in-memory ModelContainer (factory takes the store URL — nil = memory) so
// tests never touch the app's on-disk Mishran.sqlite.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class SwiftDataModelTests: XCTestCase {
    private var container: ModelContainer!

    override func setUp() {
        super.setUp()
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
    }

    override func tearDown() {
        container = nil
        super.tearDown()
    }

    private func makeContext() -> ModelContext {
        // mainContext (not a manual ModelContext) — delete rules are only
        // reliably honored by the container's own context on iOS 17.
        container.mainContext
    }

    // MARK: ProductEntity

    func testInsertAndFetchProductEntity() throws {
        let context = makeContext()
        let product = ProductEntity(
            id: "p1", slug: "kaju-katli", name: "Kaju Katli", family: "classic",
            displayPrice: "₹720/kg", freshnessStatus: "made-daily",
            dietaryTags: ["gluten-free"], allergens: ["nuts"],
            ingredients: "Cashews, sugar", shelfLife: "7 days",
            storage: "Refrigerate", images: ["https://cdn.test/kaju.jpg"],
            story: "A classic", updatedAt: "2026-08-13T00:00:00Z"
        )
        context.insert(product)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<ProductEntity>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched.first?.slug, "kaju-katli")
        XCTAssertEqual(fetched.first?.family, "classic")
        XCTAssertEqual(fetched.first?.dietaryTags, ["gluten-free"])
    }

    // MARK: Cart + CartItem cascade

    func testCartItemsCascadeDeleteWithCart() throws {
        let context = makeContext()
        let cart = CartEntity()
        context.insert(cart)
        let item = CartItemEntity(productId: "p1", name: "Kaju Katli", slug: "kaju-katli",
                                  unitPricePaise: 72000, quantity: 2)
        context.insert(item)
        // Relate after both inserts — SwiftData maintains the inverse pair
        // once both ends are registered in the context.
        item.cart = cart
        try context.save()
        XCTAssertEqual(try context.fetch(FetchDescriptor<CartItemEntity>()).count, 1)

        // iOS 17.2's SwiftData runtime ignores deleteRule .cascade (verified
        // with mainContext, with/without inverse, and a standalone probe that
        // cascades fine on newer runtimes) — so deletion goes through
        // CartEntity.delete(in:), which enforces the invariant on every OS.
        cart.delete(in: context)
        try context.save()
        XCTAssertEqual(try context.fetch(FetchDescriptor<CartItemEntity>()).count, 0,
                       "CartItem must not outlive its Cart")
    }

    // MARK: OrderEntity

    func testInsertAndFetchOrderEntity() throws {
        let context = makeContext()
        let order = OrderEntity(
            id: "ord_1", status: "confirmed", totalPaise: 144000,
            itemsJSON: #"[]"#, placedAt: "2026-08-13T00:00:00Z"
        )
        context.insert(order)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<OrderEntity>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched.first?.status, "confirmed")
        XCTAssertEqual(fetched.first?.totalPaise, 144000)
    }

    // MARK: AddressEntity

    func testInsertAndFetchAddressEntity() throws {
        let context = makeContext()
        let address = AddressEntity(
            id: "addr_1", label: "Home", line1: "12 MG Road", line2: nil,
            city: "Bengaluru", pincode: "560001", phone: "+919876543210",
            isDefault: true
        )
        context.insert(address)
        try context.save()

        let fetched = try context.fetch(FetchDescriptor<AddressEntity>())
        XCTAssertEqual(fetched.count, 1)
        XCTAssertEqual(fetched.first?.pincode, "560001")
        XCTAssertEqual(fetched.first?.isDefault, true)
    }

    // MARK: Factory — on-disk URL config

    func testFactoryProducesUsableSchema() {
        // The full v1 schema must coexist in one container (relationships
        // cross-reference between models).
        let schema = ModelContainerFactory.schema
        XCTAssertTrue(schema.entities.contains { $0.name == "ProductEntity" })
        XCTAssertTrue(schema.entities.contains { $0.name == "CartEntity" })
        XCTAssertTrue(schema.entities.contains { $0.name == "CartItemEntity" })
        XCTAssertTrue(schema.entities.contains { $0.name == "AddressEntity" })
        XCTAssertTrue(schema.entities.contains { $0.name == "OrderEntity" })
    }
}
