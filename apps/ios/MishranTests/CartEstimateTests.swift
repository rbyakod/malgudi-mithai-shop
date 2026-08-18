// CartEstimateTests.swift — Batch B9 (Mishran Mobile Apps v1).
// /cart/estimate contract decode (priced + null-tier shapes), the
// validate snapshot's items/totals decode (B9 stops discarding them), the
// footer/progress math (pure — no repository), the localized progress
// line, and the view model's debounced refresh over the MockURLProtocol
// seam: request body carries the lines + saved pincode, success prices
// the footer, failure/absent pincode fall back to the checkout copy.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CartEstimateTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!
    private var defaults: UserDefaults!
    private let suiteName = "cart-estimate-tests-\(UUID().uuidString)"

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        container = nil
        super.tearDown()
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let pricedEstimateJSON = """
    {"data":{"itemsTotalInPaise":100000,"deliveryFeeInPaise":9900,
    "discountInPaise":0,"totalInPaise":109900,"pincodeTier":"shelf",
    "freeDeliveryThresholdInPaise":199900,"freeDeliveryEligible":false}}
    """

    private let nullTierEstimateJSON = """
    {"data":{"itemsTotalInPaise":225800,"deliveryFeeInPaise":0,
    "discountInPaise":0,"totalInPaise":225800,"pincodeTier":null,
    "freeDeliveryThresholdInPaise":null,"freeDeliveryEligible":false}}
    """

    private func makeViewModel() -> CartViewModel {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(
                store: InMemoryTokenStore(), session: session(), baseURL: baseURL
            ),
            retryDelay: 0
        )
        return CartViewModel(
            context: container.mainContext,
            client: client,
            defaults: defaults,
            estimateDebounceNanos: 0
        )
    }

    @discardableResult
    private func seedCart(lines: [(id: String, price: Int, qty: Int)]) -> CartEntity {
        let cart = ProductDetailViewModel.findOrCreateCart(in: container.mainContext)
        for line in lines {
            let item = CartItemEntity(
                productId: line.id, name: "Sweet \(line.id)", slug: line.id,
                unitPricePaise: line.price, quantity: line.qty
            )
            container.mainContext.insert(item)
            item.cart = cart
        }
        try? container.mainContext.save()
        return cart
    }

    private func savePincode(_ pincode: String) {
        DeliveryCheckModel.store(
            DeliveryCheckResult(pincode: pincode, tier: "shelf", city: "Bengaluru", slaDays: 2),
            in: defaults
        )
    }

    // MARK: Decode

    func testEstimateDecodesPricedShape() throws {
        let estimate = try JSONDecoder().decode(
            Envelope<CartEstimateDTO>.self, from: json(pricedEstimateJSON)
        ).data
        XCTAssertEqual(estimate.itemsTotalInPaise, 100_000)
        XCTAssertEqual(estimate.deliveryFeeInPaise, 9_900)
        XCTAssertEqual(estimate.totalInPaise, 109_900)
        XCTAssertEqual(estimate.pincodeTier, "shelf")
        XCTAssertEqual(estimate.freeDeliveryThresholdInPaise, 199_900)
        XCTAssertFalse(estimate.freeDeliveryEligible)
    }

    func testEstimateDecodesNullTierAndThreshold() throws {
        let estimate = try JSONDecoder().decode(
            Envelope<CartEstimateDTO>.self, from: json(nullTierEstimateJSON)
        ).data
        XCTAssertNil(estimate.pincodeTier, "no/unserviceable pincode → null tier")
        XCTAssertNil(estimate.freeDeliveryThresholdInPaise)
        XCTAssertEqual(estimate.deliveryFeeInPaise, 0)
    }

    func testValidateResponseDecodesItemsAndTotals() throws {
        // B9 regression: the validate response's items + full totals were
        // discarded — they must decode with the server-priced lines.
        let responseJSON = """
        {"data":{"snapshotId":"sn-1","customerId":"c-1",
        "items":[{"productId":"p1","slug":"kaju-katli","name":"Kaju Katli",
        "quantity":2,"freshnessStatus":"made-daily","packLabel":null,
        "unit":"1 kg","priceInPaise":36000,
        "image":"https://cdn.test/kaju.jpg"}],
        "totals":{"itemsTotalInPaise":72000,"deliveryFeeInPaise":4900,
        "taxesInPaise":0,"discountInPaise":5000,"totalInPaise":71900},
        "pincodeTier":"fresh","expiresAt":"2026-08-18T10:00:00Z",
        "couponCode":"SAVE5"}}
        """
        let response = try JSONDecoder().decode(
            Envelope<CartValidateResponseDTO>.self, from: json(responseJSON)
        ).data
        let item = try XCTUnwrap(response.items.first)
        XCTAssertEqual(item.productId, "p1")
        XCTAssertEqual(item.quantity, 2)
        XCTAssertEqual(item.unit, "1 kg")
        XCTAssertEqual(item.priceInPaise, 36_000)
        XCTAssertEqual(response.totals.itemsTotalInPaise, 72_000)
        XCTAssertEqual(response.totals.deliveryFeeInPaise, 4_900)
        XCTAssertEqual(response.totals.discountInPaise, 5_000)
        XCTAssertEqual(response.totals.totalInPaise, 71_900)
        XCTAssertEqual(response.couponCode, "SAVE5")
    }

    // MARK: Progress math (pure)

    func testProgressUnlockedAtOrOverThreshold() {
        XCTAssertEqual(
            CartViewModel.progressState(itemsTotalPaise: 199_900, thresholdPaise: 199_900),
            .unlocked, "exactly at the threshold qualifies"
        )
        XCTAssertEqual(
            CartViewModel.progressState(itemsTotalPaise: 250_000, thresholdPaise: 199_900),
            .unlocked
        )
    }

    func testProgressRemainingIsShortfall() {
        XCTAssertEqual(
            CartViewModel.progressState(itemsTotalPaise: 100_000, thresholdPaise: 199_900),
            .remaining(99_900)
        )
        XCTAssertEqual(
            CartViewModel.progressState(itemsTotalPaise: 0, thresholdPaise: 199_900),
            .remaining(199_900)
        )
    }

    func testProgressNoneWithoutUsableThreshold() {
        XCTAssertEqual(CartViewModel.progressState(itemsTotalPaise: 500_000, thresholdPaise: nil), .none)
        XCTAssertEqual(
            CartViewModel.progressState(itemsTotalPaise: 500_000, thresholdPaise: 0),
            .none, "threshold 0 disables the waiver — no progress line"
        )
    }

    func testProgressLineCopyAndRupeeFormatting() {
        XCTAssertEqual(
            CartViewModel.progressLine(.remaining(99_900)),
            L("cart.free_delivery_progress", "₹999")
        )
        XCTAssertEqual(CartViewModel.progressLine(.unlocked), L("cart.free_delivery_unlocked"))
        XCTAssertEqual(CartViewModel.progressLine(.none), L("cart.delivery_at_checkout"))
    }

    // MARK: Footer state (pure)

    func makeEstimate(
        itemsTotal: Int = 100_000,
        fee: Int = 9_900,
        threshold: Int? = 199_900,
        eligible: Bool = false
    ) -> CartEstimateDTO {
        CartEstimateDTO(
            itemsTotalInPaise: itemsTotal,
            deliveryFeeInPaise: fee,
            discountInPaise: 0,
            totalInPaise: itemsTotal + fee,
            pincodeTier: threshold == nil ? nil : "shelf",
            freeDeliveryThresholdInPaise: threshold,
            freeDeliveryEligible: eligible
        )
    }

    func testFooterWithoutSavedPincodeFallsBackToCheckoutCopy() {
        XCTAssertEqual(
            CartViewModel.deliveryFooter(estimate: makeEstimate(), hasSavedPincode: false),
            .atCheckout,
            "no pincode → checkout copy regardless of any estimate"
        )
    }

    func testFooterWithoutEstimateFallsBackToCheckoutCopy() {
        XCTAssertEqual(
            CartViewModel.deliveryFooter(estimate: nil, hasSavedPincode: true),
            .atCheckout,
            "estimate not fetched (or failed) → checkout copy"
        )
    }

    func testFooterWithEstimateCarriesFeeAndProgress() {
        XCTAssertEqual(
            CartViewModel.deliveryFooter(
                estimate: makeEstimate(itemsTotal: 199_900, fee: 0, threshold: 199_900, eligible: true),
                hasSavedPincode: true
            ),
            .priced(deliveryFeePaise: 0, progress: .unlocked)
        )
        XCTAssertEqual(
            CartViewModel.deliveryFooter(estimate: makeEstimate(), hasSavedPincode: true),
            .priced(deliveryFeePaise: 9_900, progress: .remaining(99_900))
        )
    }

    // MARK: View model refresh (MockURLProtocol seam)

    func testEstimateFetchesWithLinesAndSavedPincode() async throws {
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json(pricedEstimateJSON))
        savePincode("560001")
        seedCart(lines: [("p1", price: 50_000, qty: 2)])
        let vm = makeViewModel()

        await vm.estimateTask?.value

        let estimate = try XCTUnwrap(vm.estimate)
        XCTAssertEqual(estimate.deliveryFeeInPaise, 9_900)
        XCTAssertEqual(vm.savedPincode, "560001")
        XCTAssertEqual(vm.deliveryFooter, .priced(deliveryFeePaise: 9_900, progress: .remaining(99_900)))

        // The request carries the lines + persisted pincode, UNAUTHENTICATED.
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["cart/estimate"])
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(MockURLProtocol.authHeaders["cart/estimate"], ["-"],
                       "guest carts estimate with no bearer token")
        let body = try XCTUnwrap(MockURLProtocol.body(of: request))
        let sent = try XCTUnwrap(
            (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        )
        XCTAssertEqual(sent["pincode"] as? String, "560001")
        let items = try XCTUnwrap(sent["items"] as? [[String: Any]])
        XCTAssertEqual(items.first?["productId"] as? String, "p1")
        XCTAssertEqual(items.first?["quantity"] as? Int, 2)
    }

    func testPackLinesRideBaseProductIdAndPackLabel() async throws {
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json(pricedEstimateJSON))
        savePincode("560001")
        let cart = ProductDetailViewModel.findOrCreateCart(in: container.mainContext)
        let derived = CartItemEntity(
            productId: "p1:500g", name: "Kaju Katli", slug: "kaju-katli",
            packLabel: "500g", unitPricePaise: 40_000, quantity: 1
        )
        container.mainContext.insert(derived)
        derived.cart = cart
        try? container.mainContext.save()

        let vm = makeViewModel()
        await vm.estimateTask?.value

        let request = try XCTUnwrap(MockURLProtocol.lastRequests["cart/estimate"])
        let body = try XCTUnwrap(MockURLProtocol.body(of: request))
        let items = try XCTUnwrap(
            (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        )["items"] as? [[String: Any]]
        let item = try XCTUnwrap(items?.first)
        XCTAssertEqual(item["productId"] as? String, "p1", "composite cart id collapses to the base id")
        XCTAssertEqual(item["packLabel"] as? String, "500g", "the chip prices its derived pack")
    }

    func testFailureFallsBackSilentlyToCheckoutCopy() async throws {
        // 404 (no client retry): estimate → nil, footer → checkout copy.
        MockURLProtocol.routes["cart/estimate"] = (
            404, [:], json(#"{"error":{"code":"NOT_FOUND","message":"gone"}}"#)
        )
        savePincode("560001")
        seedCart(lines: [("p1", price: 50_000, qty: 1)])
        let vm = makeViewModel()

        await vm.estimateTask?.value

        XCTAssertNil(vm.estimate)
        XCTAssertEqual(vm.deliveryFooter, .atCheckout)
    }

    func testNoSavedPincodeSkipsTheCall() async {
        // Nothing stored: no estimate request at all (the response would be
        // a null tier with nothing to render, and the route is rate-limited).
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json(pricedEstimateJSON))
        seedCart(lines: [("p1", price: 50_000, qty: 1)])
        let vm = makeViewModel()

        XCTAssertNil(vm.estimateTask)
        XCTAssertNil(vm.estimate)
        XCTAssertNil(MockURLProtocol.calls["cart/estimate"])
        XCTAssertEqual(vm.deliveryFooter, .atCheckout)
    }

    func testEmptyCartDropsEstimate() async throws {
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json(pricedEstimateJSON))
        savePincode("560001")
        seedCart(lines: [("p1", price: 50_000, qty: 1)])
        let vm = makeViewModel()
        await vm.estimateTask?.value
        XCTAssertNotNil(vm.estimate)

        vm.clear()
        await vm.estimateTask?.value

        XCTAssertNil(vm.estimate, "an emptied cart shows no stale fee row")
        XCTAssertNil(vm.estimateTask)
    }

    func testQuantityChangeReschedulesAndReprices() async throws {
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json(pricedEstimateJSON))
        savePincode("560001")
        seedCart(lines: [("p1", price: 50_000, qty: 1)])
        let vm = makeViewModel()
        await vm.estimateTask?.value
        XCTAssertEqual(vm.deliveryFooter, .priced(deliveryFeePaise: 9_900, progress: .remaining(99_900)))

        // Raise the subtotal past the threshold → unlocked, fee zeroed.
        MockURLProtocol.routes["cart/estimate"] = (200, [:], json("""
        {"data":{"itemsTotalInPaise":220000,"deliveryFeeInPaise":0,
        "discountInPaise":0,"totalInPaise":220000,"pincodeTier":"shelf",
        "freeDeliveryThresholdInPaise":199900,"freeDeliveryEligible":true}}
        """))
        vm.setQuantity(productId: "p1", quantity: 3)
        await vm.estimateTask?.value

        XCTAssertEqual(
            vm.deliveryFooter,
            .priced(deliveryFeePaise: 0, progress: .unlocked),
            "the refreshed estimate flips the footer to unlocked"
        )
    }
}
