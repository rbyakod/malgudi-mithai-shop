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

    private func makeViewModel(launcher: RazorpayLaunching? = nil) -> CheckoutViewModel {
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
        return CheckoutViewModel(client: client, context: context, launcher: launcher)
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

    private func routeValidate(_ body: String, status: Int = 200) {
        MockURLProtocol.routes["cart/validate"] = (status, [:], json(body))
    }

    /// POST /cart/validate 200 with TEST100 folded in (flat ₹100 off a
    /// ₹500 cart: totals mirror computeTotals' shape).
    private var validateBodyWithCoupon: String {
        #"{"data":{"snapshotId":"snap_1","customerId":"cust_1","items":[],"pincodeTier":"shelf","couponCode":"TEST100","totals":{"itemsTotalInPaise":50000,"deliveryFeeInPaise":9900,"taxesInPaise":0,"discountInPaise":10000,"totalInPaise":49900},"expiresAt":"2026-08-17T12:00:00Z"}}"#
    }

    /// POST /cart/validate 200 with NO coupon (full-price totals).
    private var validateBodyWithoutCoupon: String {
        #"{"data":{"snapshotId":"snap_2","customerId":"cust_1","items":[],"pincodeTier":"shelf","couponCode":null,"totals":{"itemsTotalInPaise":50000,"deliveryFeeInPaise":9900,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":59900},"expiresAt":"2026-08-17T12:00:00Z"}}"#
    }

    /// 422 the server sends for an unusable code (EXPIRED5).
    private var invalidCouponBody: String {
        #"{"error":{"code":"INVALID_COUPON","message":"Coupon code \"EXPIRED5\" is not valid"}}"#
    }

    /// create-order → sheet success → verify, so placeOrder runs end-to-end.
    private func routePaymentHappyPath() {
        MockURLProtocol.routes["payments/razorpay/create-order"] = (200, [:], json(
            #"{"data":{"orderId":"order_1","razorpayOrderId":"rzp_order_1","amountInPaise":49900,"keyId":"rzp_test_key"}}"#
        ))
        MockURLProtocol.routes["payments/razorpay/verify"] = (200, [:], json(
            #"{"data":{"order":{"id":"order_1","customerId":"cust_1","items":[],"totals":{"itemsTotalInPaise":0,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":0},"status":"confirmed","paymentStatus":"paid","createdAt":"2026-08-17T10:00:00Z","updatedAt":"2026-08-17T10:05:00Z"}}}"#
        ))
    }

    /// Address + pincode serviceability so apply/validate have a pincode.
    private func makeReadyViewModel(launcher: RazorpayLaunching? = nil) async -> CheckoutViewModel {
        seedCart(freshness: nil)
        routeServiceable(#"{"data":{"serviceable":true,"tier":"shelf","city":"Delhi","slaDays":2}}"#)
        let vm = makeViewModel(launcher: launcher)
        vm.address = AddressEntity(
            id: "a1", line1: "12 MG Road", city: "Delhi", state: "Delhi", pincode: "110001", tag: "home"
        )
        await vm.validatePincode("110001")
        return vm
    }

    /// Decoded JSON body of the last cart/validate request.
    private func lastValidateBody() throws -> [String: Any] {
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["cart/validate"])
        let data = try XCTUnwrap(MockURLProtocol.body(of: request))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
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

    // MARK: P1 pack sizes — place-order collapse by BASE productId

    func testCollapsedCartItemsSumsPackLinesByBaseProductId() {
        let cart = ProductDetailViewModel.findOrCreateCart(in: context)
        let lines = [
            CartItemEntity(productId: "p1:250g", name: "Kaju Katli", slug: "kaju-katli", packLabel: "250g", unitPricePaise: 46000, quantity: 2),
            CartItemEntity(productId: "p2", name: "Laddoo", slug: "laddoo", unitPricePaise: 30000, quantity: 3),
            CartItemEntity(productId: "p1:1 kg", name: "Kaju Katli", slug: "kaju-katli", packLabel: "1 kg", unitPricePaise: 184000, quantity: 1),
        ]
        for line in lines {
            context.insert(line)
            line.cart = cart
        }

        let items = CheckoutViewModel.collapsedCartItems(lines)

        // Server CartItem has no variant field: two pack lines of p1 become
        // ONE row summed by base id; untouched base lines pass through.
        XCTAssertEqual(items, [
            CartValidateItemDTO(productId: "p1", quantity: 3),
            CartValidateItemDTO(productId: "p2", quantity: 3),
        ], "first-seen order preserved")
    }

    func testBaseProductIdStripsOnlyThePackSuffix() {
        XCTAssertEqual(CartItemEntity(productId: "p1:500g", name: "n", slug: "s", unitPricePaise: 0, quantity: 1).baseProductId, "p1")
        XCTAssertEqual(CartItemEntity(productId: "p1", name: "n", slug: "s", unitPricePaise: 0, quantity: 1).baseProductId, "p1", "base lines have no suffix to strip")
    }

    // MARK: coupon (Batch B8) — apply / reject / remove / ride-along

    func testNormalizeCouponCodeTrimsUppercasesAndCapsAtForty() {
        XCTAssertEqual(CheckoutViewModel.normalizeCouponCode("  test100 "), "TEST100")
        XCTAssertEqual(CheckoutViewModel.normalizeCouponCode("test100"), "TEST100")
        XCTAssertEqual(
            CheckoutViewModel.normalizeCouponCode(String(repeating: "A", count: 60)).count,
            40,
            "the route rejects codes longer than 40 chars"
        )
    }

    func testApplyCouponSendsCodeAndStoresDiscount() async throws {
        routeValidate(validateBodyWithCoupon)
        let vm = await makeReadyViewModel()

        await vm.applyCoupon(" test100 ")

        XCTAssertEqual(vm.appliedCouponCode, "TEST100", "server-normalized uppercase echo")
        XCTAssertEqual(vm.couponDiscountPaise, 10000)
        XCTAssertNotNil(vm.couponMessage, "the applied row has confirmation text")
        XCTAssertNil(vm.couponErrorMessage)

        // The request carried the NORMALIZED code against the address pincode.
        let body = try lastValidateBody()
        XCTAssertEqual(body["couponCode"] as? String, "TEST100")
        XCTAssertEqual(body["pincode"] as? String, "110001")
        let items = try XCTUnwrap(body["items"] as? [[String: Any]])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0]["productId"] as? String, "p1")
        XCTAssertEqual(items[0]["quantity"] as? Int, 1)
    }

    func testInvalidCouponSurfacesErrorKeepsTotalsAndClearsCode() async throws {
        let vm = await makeReadyViewModel()

        // A good code first, so "keeps the last good totals" is observable.
        routeValidate(validateBodyWithCoupon)
        await vm.applyCoupon("TEST100")
        XCTAssertEqual(vm.couponDiscountPaise, 10000)

        routeValidate(invalidCouponBody, status: 422)
        await vm.applyCoupon("EXPIRED5")

        XCTAssertNil(vm.appliedCouponCode, "rejected code is cleared")
        XCTAssertEqual(vm.couponDiscountPaise, 10000, "last good totals are kept")
        XCTAssertTrue(
            vm.couponErrorMessage?.contains("EXPIRED5") == true,
            "server detail rides along: \(vm.couponErrorMessage ?? "<nil>")"
        )
        XCTAssertNil(vm.couponMessage)
        // Not blocking checkout: the pay flow state was never touched.
        XCTAssertEqual(vm.paymentState, .idle)
    }

    func testRemoveCouponRevalidatesWithoutTheCode() async throws {
        routeValidate(validateBodyWithCoupon)
        let vm = await makeReadyViewModel()
        await vm.applyCoupon("TEST100")
        XCTAssertEqual(vm.appliedCouponCode, "TEST100")

        routeValidate(validateBodyWithoutCoupon)
        await vm.removeCoupon()

        XCTAssertNil(vm.appliedCouponCode)
        XCTAssertEqual(vm.couponDiscountPaise, 0, "discount disappears with the code")
        XCTAssertNil(vm.couponErrorMessage)

        // The re-validate ran WITHOUT the code (nil encodes to an omitted key).
        let body = try lastValidateBody()
        XCTAssertNil(body["couponCode"], "removed code must not ride along")
        XCTAssertEqual(body["pincode"] as? String, "110001")
        let items = try XCTUnwrap(body["items"] as? [[String: Any]])
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0]["productId"] as? String, "p1")
        XCTAssertEqual(items[0]["quantity"] as? Int, 1)
    }

    /// Requirement: the applied code rides along on the re-validates the
    /// flow already performs — placeOrder's validate must carry it.
    func testAppliedCouponRidesAlongOnPlaceOrderValidate() async throws {
        let launcher = StubRazorpayLauncher()
        launcher.outcome = .success(paymentId: "pay_123", signature: "sig_abc")
        routeValidate(validateBodyWithCoupon)
        routePaymentHappyPath()
        let vm = await makeReadyViewModel(launcher: launcher)
        vm.paymentMethod = .razorpay

        await vm.applyCoupon("TEST100")
        await vm.placeOrder()

        XCTAssertEqual(vm.paymentState, .confirmed(orderId: "order_1"))
        let body = try lastValidateBody()
        XCTAssertEqual(body["couponCode"] as? String, "TEST100", "placeOrder's validate carries the applied code")
        XCTAssertEqual(vm.appliedCouponCode, "TEST100")
    }

    /// A code that applied fine but expired by Pay time: the attempt stops
    /// with a clear message, the code is dropped, and the customer can pay
    /// immediately at full price (checkout is NOT blocked).
    func testExpiredCouponAtPayIsClearedWithoutBlockingCheckout() async throws {
        let launcher = StubRazorpayLauncher()
        launcher.outcome = .success(paymentId: "pay_123", signature: "sig_abc")
        routeValidate(validateBodyWithCoupon)
        routePaymentHappyPath()
        let vm = await makeReadyViewModel(launcher: launcher)
        vm.paymentMethod = .razorpay

        await vm.applyCoupon("TEST100")
        XCTAssertEqual(vm.appliedCouponCode, "TEST100")

        // The coupon dies server-side between Apply and Pay.
        routeValidate(invalidCouponBody, status: 422)
        await vm.placeOrder()

        if case .failed = vm.paymentState {} else {
            XCTFail("expected .failed, got \(vm.paymentState)")
        }
        XCTAssertNil(vm.appliedCouponCode)
        XCTAssertNotNil(vm.couponErrorMessage)

        // Retry pays clean at full price — nothing is locked.
        routeValidate(validateBodyWithoutCoupon)
        await vm.placeOrder()
        XCTAssertEqual(vm.paymentState, .confirmed(orderId: "order_1"))
        XCTAssertEqual(vm.couponDiscountPaise, 0, "totals re-synced off the code-less validate")
        let body = try lastValidateBody()
        XCTAssertNil(body["couponCode"])
    }
}
