// CheckoutViewModel.swift — Task 17.2 (Mishran Mobile Apps v1).
// Address + slot + payment state. Pincode serviceability via GET
// /catalog/serviceable, with client-side gating: fresh-requiring items
// (made-daily / made-to-order) only ship in the fresh tier (Delhi NCR
// same-day network). Slot picker exists for the fresh tier only.
import Foundation
import Observation
import SwiftData

struct ServiceabilityDTO: Decodable, Equatable {
    let serviceable: Bool
    let tier: String?
    let city: String?
    let slaDays: Int?
}

struct DeliverySlot: Equatable, Identifiable, Hashable {
    let id: String
    let label: String
    /// Snapshot-contract parts: {date, window} as POSTed to /cart/validate.
    let date: String
    let window: String

    /// Fresh-tier windows: today + tomorrow, morning + evening (parity with
    /// Android's slot factory).
    static func freshTierOptions() -> [DeliverySlot] {
        [
            DeliverySlot(id: "today-morning", label: "Today, morning", date: "today", window: "morning"),
            DeliverySlot(id: "today-evening", label: "Today, evening", date: "today", window: "evening"),
            DeliverySlot(id: "tomorrow-morning", label: "Tomorrow, morning", date: "tomorrow", window: "morning"),
            DeliverySlot(id: "tomorrow-evening", label: "Tomorrow, evening", date: "tomorrow", window: "evening"),
        ]
    }
}

@MainActor
@Observable
final class CheckoutViewModel {
    enum ServiceabilityState: Equatable {
        case unknown
        case checking
        case serviceable(tier: String, city: String, slaDays: Int)
        case blocked(reason: BlockingReason)

        var isServiceable: Bool {
            if case .serviceable = self { return true }
            return false
        }
    }

    enum BlockingReason: Equatable {
        case notServiceable
        case freshItemOutsideFreshTier
        case network
    }

    enum PaymentMethod: String, CaseIterable, Identifiable {
        case razorpay
        var id: String { rawValue }

        var displayName: String {
            switch self {
            case .razorpay: "Razorpay (UPI / cards / netbanking)"
            }
        }
    }

    /// Where a placeOrder attempt is. Confirmed/abandoned are terminals the
    /// view routes on (order confirmation vs back to cart).
    enum PaymentFlowState: Equatable {
        case idle
        case validatingCart
        case creatingOrder
        case awaitingPayment
        case verifyingPayment
        case confirmed(orderId: String)
        /// Sheet dismissed — no money moved; the cart is intact for retry.
        case abandoned
        case failed(message: String)
    }

    static let tierFresh = "fresh"
    /// Freshness values that require the same-day fresh-tier network.
    static let freshRequiringFreshness: Set<String> = ["made-daily", "made-to-order"]

    private let client: MishranAPIClient
    private let context: ModelContext
    private let launcher: RazorpayLaunching

    var address: AddressEntity?
    var selectedSlot: DeliverySlot?
    var paymentMethod: PaymentMethod?
    private(set) var serviceability: ServiceabilityState = .unknown
    private(set) var slotOptions: [DeliverySlot] = []
    private(set) var errorMessage: String?
    private(set) var paymentState: PaymentFlowState = .idle

    init(
        client: MishranAPIClient,
        context: ModelContext,
        launcher: RazorpayLaunching? = nil
    ) {
        // Default-arg position can't construct a @MainActor coordinator —
        // resolve it inside the (isolated) init body instead.
        self.client = client
        self.context = context
        self.launcher = launcher ?? RazorpayCoordinator()
    }

    var isServiceable: Bool { serviceability.isServiceable }

    var blockingReason: BlockingReason? {
        if case let .blocked(reason) = serviceability { return reason }
        return nil
    }

    var isFreshTier: Bool {
        if case let .serviceable(tier, _, _) = serviceability {
            return tier == Self.tierFresh
        }
        return false
    }

    /// Address chosen + serviceable + (fresh tier) slot picked + payment.
    var canPlaceOrder: Bool {
        guard address != nil, isServiceable, paymentMethod != nil else { return false }
        if isFreshTier, selectedSlot == nil { return false }
        return true
    }

    /// True while a placeOrder attempt is in flight (sheet included).
    var isPlacingOrder: Bool {
        switch paymentState {
        case .validatingCart, .creatingOrder, .awaitingPayment, .verifyingPayment:
            true
        case .idle, .confirmed, .abandoned, .failed:
            false
        }
    }

    /// Progress-line text for the in-flight states.
    var placingOrderStatus: String {
        switch paymentState {
        case .validatingCart: "Checking your cart…"
        case .creatingOrder: "Creating your order…"
        case .awaitingPayment: "Waiting for payment…"
        case .verifyingPayment: "Confirming payment…"
        default: ""
        }
    }

    /// GET /catalog/serviceable?pincode=… then apply the fresh-item matrix.
    func validatePincode(_ pincode: String) async {
        serviceability = .checking
        errorMessage = nil
        slotOptions = []
        do {
            let endpoint = Endpoint.catalogServiceable(pincode: pincode)
            let result: ServiceabilityDTO = try await client.request(endpoint)
            if !result.serviceable {
                serviceability = .blocked(reason: .notServiceable)
                return
            }
            // Fresh-requiring lines can't ship to a shelf-tier city.
            if result.tier != Self.tierFresh, cartContainsFreshRequiringItem() {
                serviceability = .blocked(reason: .freshItemOutsideFreshTier)
                return
            }
            serviceability = .serviceable(
                tier: result.tier ?? "",
                city: result.city ?? "",
                slaDays: result.slaDays ?? 0
            )
            slotOptions = (result.tier == Self.tierFresh) ? Self.freshTierSlots() : []
            if !slotOptions.isEmpty, selectedSlot == nil {
                selectedSlot = slotOptions.first
            }
        } catch {
            serviceability = .blocked(reason: .network)
            errorMessage = "Couldn't check delivery for this pincode. Try again."
        }
    }

    /// Cart lines whose catalog row carries a fresh-requiring freshness.
    private func cartContainsFreshRequiringItem() -> Bool {
        Self.cartContainsFreshRequiringItem(in: context)
    }

    nonisolated static func cartContainsFreshRequiringItem(in context: ModelContext) -> Bool {
        let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
        guard !lines.isEmpty else { return false }
        let products = (try? context.fetch(FetchDescriptor<ProductEntity>())) ?? []
        // Flatten optionals: rows without freshness can't block anything.
        let freshnessByProduct = Dictionary(
            products.compactMap { row in row.freshnessStatus.map { (row.id, $0) } },
            uniquingKeysWith: { first, _ in first }
        )
        return lines.contains { line in
            guard let freshness = freshnessByProduct[line.productId] else { return false }
            return freshRequiringFreshness.contains(freshness)
        }
    }

    nonisolated static func freshTierSlots() -> [DeliverySlot] {
        DeliverySlot.freshTierOptions()
    }

    // MARK: place order (Task 17.3)

    /// validate → create-order → Razorpay sheet → verify.
    ///
    /// Each attempt mints a fresh Idempotency-Key: the backend caches error
    /// responses per key, so reusing one after a failure replays the cached
    /// failure forever. The client's built-in 5xx retries share an attempt's
    /// key (same logical request — a cached replay there is harmless).
    func placeOrder() async {
        guard canPlaceOrder, let address else {
            paymentState = .failed(message: "Pick an address, delivery slot, and payment method first.")
            return
        }
        errorMessage = nil
        do {
            let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
            guard !lines.isEmpty else {
                paymentState = .failed(message: "Your cart is empty.")
                return
            }

            paymentState = .validatingCart
            let validate: CartValidateResponseDTO = try await client.request(Endpoint.cartValidate(
                items: lines.map { CartValidateItemDTO(productId: $0.productId, quantity: $0.quantity) },
                pincode: address.pincode,
                slot: selectedSlot
            ))

            paymentState = .creatingOrder
            let create: CreateOrderResponseDTO = try await client.request(Endpoint.paymentCreateOrder(
                snapshotId: validate.snapshotId,
                deliveryAddressId: address.id,
                idempotencyKey: UUID().uuidString
            ))

            paymentState = .awaitingPayment
            let outcome = await withCheckedContinuation { continuation in
                launcher.launch(
                    options: RazorpayLaunchOptions(
                        keyId: create.keyId,
                        razorpayOrderId: create.razorpayOrderId,
                        amountInPaise: create.amountInPaise
                    )
                ) { outcome in
                    continuation.resume(returning: outcome)
                }
            }

            switch outcome {
            case let .success(paymentId, signature):
                guard let signature, !signature.isEmpty else {
                    // Without the HMAC signature the verify route fail-closes;
                    // a success we can't prove is not a success.
                    paymentState = .failed(
                        message: "Payment succeeded but the signature was missing. Support can reconcile order \(create.orderId)."
                    )
                    return
                }
                paymentState = .verifyingPayment
                let verified: VerifyPaymentResponseDTO = try await client.request(Endpoint.paymentVerify(
                    orderId: create.orderId,
                    razorpayPaymentId: paymentId,
                    signature: signature,
                    idempotencyKey: UUID().uuidString
                ))
                paymentState = .confirmed(orderId: verified.order.id)
                clearCartLines()

            case .dismissed:
                // No money moved, nothing to verify — back to the cart.
                paymentState = .abandoned

            case let .failed(code, description):
                paymentState = .failed(message: "Payment didn't go through (code \(code)). \(description)")
                errorMessage = "Payment didn't go through. You haven't been charged — try again."
            }
        } catch {
            paymentState = .failed(message: String(describing: error))
            errorMessage = "Something went wrong placing the order. Try again."
        }
    }

    /// Confirmed orders consume the cart (singleton row stays for reuse).
    private func clearCartLines() {
        let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
        for line in lines {
            context.delete(line)
        }
        try? context.save()
    }
}
