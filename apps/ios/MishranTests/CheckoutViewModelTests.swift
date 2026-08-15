// Task 17.2 (Mishran Mobile Apps v1): CheckoutViewModel tests — pincode
// serviceability via GET /catalog/serviceable, with the client-side matrix:
// fresh-requiring items (made-daily/made-to-order) need tier "fresh".
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CheckoutViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
        context = container.mainContext
    }

    override func tearDown() {
        container = nil
        context = nil
        super.tearDown()
    }

    private func makeViewModel() -> CheckoutViewModel {
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
        return CheckoutViewModel(client: client, context: context)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    /// Cart line + catalog row so freshness is resolvable per product.
    private func seedCart(freshness: String?, productId: String = "p1") {
        let product = ProductEntity(dto: ProductDTO(
            id: productId, slug: "sweet-\(productId)", name: "Sweet", family: .classic
        ))
        product.freshnessStatus = freshness
        context.insert(product)

        let cart = ProductDetailViewModel.findOrCreateCart(in: context)
        let line = CartItemEntity(
            productId: productId, name: "Sweet", slug: "sweet-\(productId)",
            unitPricePaise: 50000, quantity: 1
        )
        context.insert(line)
        line.cart = cart
        try? context.save()
    }

    private func routeServiceable(_ body: String, status: Int = 200) {
        MockURLProtocol.routes["catalog/serviceable"] = (status, [:], json(body))
    }

    // MARK: serviceability matrix (plan Step 1)

    func testFreshTierPincodeWithShelfStableItemIsServiceable() async {
        seedCart(freshness: "batch-frozen")
        routeServiceable(#"{"data":{"serviceable":true,"tier":"fresh","city":"Delhi","slaDays":0}}"#)
        let vm = makeViewModel()

        await vm.validatePincode("110001")

        XCTAssertEqual(vm.serviceability, .serviceable(tier: "fresh", city: "Delhi", slaDays: 0))
        XCTAssertTrue(vm.isServiceable)
    }

    func testFreshTierPincodeWithFreshItemIsServiceable() async {
        seedCart(freshness: "made-daily")
        routeServiceable(#"{"data":{"serviceable":true,"tier":"fresh","city":"Delhi","slaDays":0}}"#)
        let vm = makeViewModel()

        await vm.validatePincode("110001")

        XCTAssertTrue(vm.isServiceable)
    }

    func testShelfTierPincodeWithFreshItemIsBlocked() async {
        seedCart(freshness: "made-daily")
        routeServiceable(#"{"data":{"serviceable":true,"tier":"shelf","city":"Bengaluru","slaDays":2}}"#)
        let vm = makeViewModel()

        await vm.validatePincode("560001")

        XCTAssertFalse(vm.isServiceable)
        XCTAssertEqual(vm.blockingReason, .freshItemOutsideFreshTier)
    }

    func testShelfTierPincodeWithShelfStableItemIsServiceable() async {
        seedCart(freshness: "batch-frozen")
        routeServiceable(#"{"data":{"serviceable":true,"tier":"shelf","city":"Bengaluru","slaDays":2}}"#)
        let vm = makeViewModel()

        await vm.validatePincode("560001")

        XCTAssertTrue(vm.isServiceable)
        XCTAssertEqual(vm.serviceability, .serviceable(tier: "shelf", city: "Bengaluru", slaDays: 2))
    }

    func testOutOfZonePincodeIsBlocked() async {
        seedCart(freshness: nil)
        routeServiceable(#"{"data":{"serviceable":false}}"#)
        let vm = makeViewModel()

        await vm.validatePincode("577001")

        XCTAssertFalse(vm.isServiceable)
        XCTAssertEqual(vm.blockingReason, .notServiceable)
    }

    func testRequestCarriesPincodeQuery() async {
        seedCart(freshness: nil)
        routeServiceable(#"{"data":{"serviceable":true,"tier":"shelf","city":"Bengaluru","slaDays":2}}"#)
        let vm = makeViewModel()
        await vm.validatePincode("560001")

        let request = MockURLProtocol.lastRequests["catalog/serviceable"]
        XCTAssertEqual(request?.url?.query ?? "", "pincode=560001")
    }

    // MARK: slot picker — fresh tier only

    func testSlotsOnlyForFreshTier() async {
        seedCart(freshness: nil)
        routeServiceable(#"{"data":{"serviceable":true,"tier":"shelf","city":"Bengaluru","slaDays":2}}"#)
        let vm = makeViewModel()
        await vm.validatePincode("560001")
        XCTAssertTrue(vm.slotOptions.isEmpty, "shelf tier has no slot picker")

        routeServiceable(#"{"data":{"serviceable":true,"tier":"fresh","city":"Delhi","slaDays":0}}"#)
        await vm.validatePincode("110001")
        XCTAssertFalse(vm.slotOptions.isEmpty, "fresh tier gets today/tomorrow windows")
    }

    func testCanPlaceOrderRequiresAddressSlotAndPayment() async {
        seedCart(freshness: nil)
        routeServiceable(#"{"data":{"serviceable":true,"tier":"fresh","city":"Delhi","slaDays":0}}"#)
        let vm = makeViewModel()
        await vm.validatePincode("110001")

        XCTAssertFalse(vm.canPlaceOrder)
        vm.address = AddressEntity(id: "a1", line1: "12 MG Road", city: "Delhi", state: "Delhi", pincode: "110001", tag: "home")
        XCTAssertFalse(vm.canPlaceOrder)
        vm.selectedSlot = vm.slotOptions.first
        XCTAssertFalse(vm.canPlaceOrder)
        vm.paymentMethod = .razorpay
        XCTAssertTrue(vm.canPlaceOrder)
    }
}
