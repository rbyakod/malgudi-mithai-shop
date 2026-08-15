// Task 17.3 (Mishran Mobile Apps v1): Razorpay coordinator + payment flow.
// Coordinator funnels are plain-value seams (the SDK's delegate callbacks
// aren't constructible in tests); the CheckoutViewModel flow runs over the
// URLProtocol mock: cart/validate → create-order → sheet outcome → verify.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class RazorpayCoordinatorTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!
    private var context: ModelContext!
    /// Idempotency-Key headers per create-order call, in order.
    private nonisolated(unsafe) var createOrderKeys: [String] = []

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        createOrderKeys = []
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
        context = container.mainContext
    }

    override func tearDown() {
        container = nil
        context = nil
        super.tearDown()
    }

    // MARK: coordinator funnel (SDK delegate → RazorpayOutcome)

    func testDismissedErrorCodeMapsToDismissedOutcome() {
        let outcome = RazorpayCoordinator.outcome(failedCode: 0, description: "User cancelled")
        XCTAssertEqual(outcome, .dismissed)
    }

    func testNonZeroErrorCodeMapsToFailedOutcome() {
        let outcome = RazorpayCoordinator.outcome(failedCode: 2, description: "Payment failed")
        XCTAssertEqual(outcome, .failed(code: 2, description: "Payment failed"))
    }

    func testSuccessFunnelCarriesSignature() {
        let outcome = RazorpayCoordinator.outcome(paymentId: "pay_123", signature: "sig_abc")
        XCTAssertEqual(outcome, .success(paymentId: "pay_123", signature: "sig_abc"))
    }

    // MARK: end-to-end flow through CheckoutViewModel

    private func makeViewModel(launcher: RazorpayLaunching) -> CheckoutViewModel {
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

    private func seedReadyToPay(_ vm: CheckoutViewModel) async {
        let product = ProductEntity(dto: ProductDTO(
            id: "p1", slug: "sweet-p1", name: "Sweet", family: .classic
        ))
        product.freshnessStatus = "batch-frozen"
        context.insert(product)

        let cart = ProductDetailViewModel.findOrCreateCart(in: context)
        let line = CartItemEntity(
            productId: "p1", name: "Sweet", slug: "sweet-p1",
            unitPricePaise: 50000, quantity: 1
        )
        context.insert(line)
        line.cart = cart
        try? context.save()

        vm.address = AddressEntity(
            id: "addr_1", line1: "12 MG Road", city: "Delhi",
            state: "Delhi", pincode: "110001", tag: "home"
        )
        vm.paymentMethod = .razorpay

        // Serviceability comes through the real path (validatePincode).
        MockURLProtocol.routes["catalog/serviceable"] = (200, [:], Data(
            #"{"data":{"serviceable":true,"tier":"shelf","city":"Delhi","slaDays":1}}"#.utf8
        ))
        await vm.validatePincode("110001")
    }

    private func routeHappyPath() {
        let json = { (string: String) in Data(string.utf8) }
        MockURLProtocol.routes["cart/validate"] = (200, [:], json(
            #"{"data":{"snapshotId":"snap_1","customerId":"cust_1","items":[],"pincodeTier":"shelf","expiresAt":"2026-08-13T12:00:00Z"}}"#
        ))
        MockURLProtocol.routeOverride["payments/razorpay/create-order"] = { [weak self] request in
            self?.createOrderKeys.append(request.value(forHTTPHeaderField: "Idempotency-Key") ?? "-")
            return (200, [:], json(
                #"{"data":{"orderId":"order_1","razorpayOrderId":"rzp_order_1","amountInPaise":50000,"keyId":"rzp_test_key"}}"#
            ))
        }
        MockURLProtocol.routes["payments/razorpay/verify"] = (200, [:], json(
            #"{"data":{"order":{"id":"order_1","customerId":"cust_1","items":[],"totals":{"itemsTotalInPaise":0,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":0},"status":"confirmed","paymentStatus":"paid","createdAt":"2026-08-13T10:00:00Z","updatedAt":"2026-08-13T10:05:00Z"}}}"#
        ))
    }

    func testSuccessfulPaymentVerifiesAndConfirms() async {
        routeHappyPath()
        let launcher = StubRazorpayLauncher()
        launcher.outcome = .success(paymentId: "pay_123", signature: "sig_abc")
        let vm = makeViewModel(launcher: launcher)
        await seedReadyToPay(vm)

        await vm.placeOrder()

        XCTAssertEqual(vm.paymentState, .confirmed(orderId: "order_1"))
        XCTAssertEqual(MockURLProtocol.calls["payments/razorpay/verify"], 1)

        // The sheet saw the server's Razorpay order, not ours.
        XCTAssertEqual(launcher.capturedOptions?.razorpayOrderId, "rzp_order_1")
        XCTAssertEqual(launcher.capturedOptions?.amountInPaise, 50000)
        XCTAssertEqual(launcher.capturedOptions?.keyId, "rzp_test_key")

        // Verify body carries the sheet's payment id + signature.
        let verifyBody = MockURLProtocol.lastRequests["payments/razorpay/verify"].flatMap(MockURLProtocol.body(of:))
        let object = try! JSONSerialization.jsonObject(with: verifyBody ?? Data()) as? [String: Any]
        XCTAssertEqual(object?["orderId"] as? String, "order_1")
        XCTAssertEqual(object?["razorpayPaymentId"] as? String, "pay_123")
        XCTAssertEqual(object?["signature"] as? String, "sig_abc")
    }

    func testAbandonedPaymentSkipsVerifyAndReturnsToCart() async {
        routeHappyPath()
        let launcher = StubRazorpayLauncher()
        launcher.outcome = .dismissed
        let vm = makeViewModel(launcher: launcher)
        await seedReadyToPay(vm)

        await vm.placeOrder()

        XCTAssertEqual(vm.paymentState, .abandoned)
        XCTAssertNil(MockURLProtocol.calls["payments/razorpay/verify"])
        // Cart untouched — the customer can retry.
        let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
        XCTAssertEqual(lines.count, 1)
    }

    func testEachAttemptUsesAFreshIdempotencyKey() async {
        // First attempt: create-order fails after the client's retries.
        // Second attempt: succeeds. The two attempts must use different
        // Idempotency-Keys (the backend caches error responses per key).
        let json = { (string: String) in Data(string.utf8) }
        MockURLProtocol.routes["cart/validate"] = (200, [:], json(
            #"{"data":{"snapshotId":"snap_1","customerId":"cust_1","items":[],"pincodeTier":"shelf","expiresAt":"2026-08-13T12:00:00Z"}}"#
        ))
        nonisolated(unsafe) var failFirst = true
        MockURLProtocol.routeOverride["payments/razorpay/create-order"] = { [weak self] request in
            self?.createOrderKeys.append(request.value(forHTTPHeaderField: "Idempotency-Key") ?? "-")
            if failFirst {
                return (500, [:], Data(#"{"error":{"code":"INTERNAL","message":"boom"}}"#.utf8))
            }
            return (200, [:], json(
                #"{"data":{"orderId":"order_1","razorpayOrderId":"rzp_order_1","amountInPaise":50000,"keyId":"rzp_test_key"}}"#
            ))
        }
        MockURLProtocol.routes["payments/razorpay/verify"] = (200, [:], json(
            #"{"data":{"order":{"id":"order_1","customerId":"cust_1","items":[],"totals":{"itemsTotalInPaise":0,"deliveryFeeInPaise":0,"taxesInPaise":0,"discountInPaise":0,"totalInPaise":0},"status":"confirmed","paymentStatus":"paid","createdAt":"2026-08-13T10:00:00Z","updatedAt":"2026-08-13T10:05:00Z"}}}"#
        ))

        let launcher = StubRazorpayLauncher()
        launcher.outcome = .success(paymentId: "pay_123", signature: "sig_abc")
        let vm = makeViewModel(launcher: launcher)
        await seedReadyToPay(vm)

        await vm.placeOrder()
        if case .failed = vm.paymentState {} else {
            XCTFail("expected .failed after create-order error, got \(vm.paymentState)")
        }

        failFirst = false
        launcher.outcome = .success(paymentId: "pay_124", signature: "sig_def")
        await vm.placeOrder()
        XCTAssertEqual(vm.paymentState, .confirmed(orderId: "order_1"))

        // First attempt burned 3 requests (1 + 2 retries) on one key; the
        // retry attempt used a fresh key.
        XCTAssertEqual(Set(createOrderKeys).count, 2, "keys: \(createOrderKeys)")
        XCTAssertNotNil(MockURLProtocol.lastRequests["payments/razorpay/create-order"]?
            .value(forHTTPHeaderField: "Idempotency-Key"))
    }
}

/// Sheet stub — records launch options, answers with a preset outcome.
@MainActor
final class StubRazorpayLauncher: RazorpayLaunching {
    var capturedOptions: RazorpayLaunchOptions?
    var outcome: RazorpayOutcome?

    func launch(options: RazorpayLaunchOptions, onResult: @escaping (RazorpayOutcome) -> Void) {
        capturedOptions = options
        if let outcome {
            onResult(outcome)
        }
    }
}
