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
    /// Android's slot factory). Labels localize the day word
    /// (checkout.slot.today/tomorrow); the window suffix stays English
    /// until slot-window keys land.
    static func freshTierOptions() -> [DeliverySlot] {
        [
            DeliverySlot(id: "today-morning", label: "\(L("checkout.slot.today")), morning", date: "today", window: "morning"),
            DeliverySlot(id: "today-evening", label: "\(L("checkout.slot.today")), evening", date: "today", window: "evening"),
            DeliverySlot(id: "tomorrow-morning", label: "\(L("checkout.slot.tomorrow")), morning", date: "tomorrow", window: "morning"),
            DeliverySlot(id: "tomorrow-evening", label: "\(L("checkout.slot.tomorrow")), evening", date: "tomorrow", window: "evening"),
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
            // B15: localized (was a hardcoded string); UPI leads because the
            // sheet opens with every method available — the iOS SDK exposes
            // no method preselect, so the label is the only emphasis.
            case .razorpay: L("checkout.payment.methods_label")
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

    // MARK: coupon (Batch B8)

    /// Coupon the last SUCCESSFUL validate folded in (server-normalized
    /// uppercase). Rides along on every later validate until removed or
    /// rejected. Nil = no code applied.
    private(set) var appliedCouponCode: String?
    /// Discount from the last successful validate. A rejected code never
    /// touches it — the UI must not show totals from a failed request.
    private(set) var couponDiscountPaise = 0
    /// "Coupon {code} applied" confirmation for the coupon row.
    private(set) var couponMessage: String?
    /// Why the last apply/re-validate was rejected (localized + server detail).
    private(set) var couponErrorMessage: String?
    /// True while an Apply/Remove validate round-trip is in flight.
    private(set) var isValidatingCoupon = false

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

    /// Display-only cart total for the Pay CTA (checkout.pay {amount});
    /// delivery/taxes are quoted server-side at validation.
    var cartTotalPaise: Int {
        let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
        return lines.reduce(0) { $0 + $1.unitPricePaise * $1.quantity }
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

    /// Pack lines stack as separate rows ("p1:250g", "p1:1 kg") but the
    /// server CartItem has no variant field — collapse by BASE productId
    /// (everything before the first ":"), summing quantities. First-seen
    /// order is preserved so the validate body is deterministic.
    nonisolated static func collapsedCartItems(_ lines: [CartItemEntity]) -> [CartValidateItemDTO] {
        var quantities: [String: Int] = [:]
        var order: [String] = []
        for line in lines {
            let base = line.baseProductId
            if quantities[base] == nil { order.append(base) }
            quantities[base, default: 0] += line.quantity
        }
        return order.map { CartValidateItemDTO(productId: $0, quantity: quantities[$0] ?? 0) }
    }

    // MARK: coupon (Batch B8)

    /// Apply input → server shape: trim, uppercase, cap at 40 chars (the
    /// route's own z.string().max(40)).
    nonisolated static func normalizeCouponCode(_ raw: String) -> String {
        String(raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().prefix(40))
    }

    nonisolated static func isInvalidCoupon(_ error: Error) -> Bool {
        if case let .api(code, _, _, _) = error as? APIError { return code == .invalidCoupon }
        return false
    }

    /// checkout.coupon.invalid + the server's reason when it sent one
    /// (e.g. `Coupon code "EXPIRED5" is not valid`).
    nonisolated static func invalidCouponMessage(_ error: Error) -> String {
        var message = L("checkout.coupon.invalid")
        if case let .api(_, serverMessage, _, _) = error as? APIError, !serverMessage.isEmpty {
            message += " \(serverMessage)"
        }
        return message
    }

    /// Validate with the typed code. On success the server-priced discount
    /// replaces the local guess; on INVALID_COUPON the code is dropped, the
    /// error is surfaced, the LAST GOOD totals are kept, and checkout stays
    /// open at full price.
    func applyCoupon(_ rawCode: String) async {
        let code = Self.normalizeCouponCode(rawCode)
        guard !code.isEmpty else { return }
        guard let address else {
            couponMessage = nil
            couponErrorMessage = "Pick a delivery address first — the code is checked against it."
            return
        }
        guard hasCartLines() else {
            couponMessage = nil
            couponErrorMessage = "Your cart is empty."
            return
        }
        couponMessage = nil
        couponErrorMessage = nil
        isValidatingCoupon = true
        defer { isValidatingCoupon = false }
        do {
            let response = try await validateCart(pincode: address.pincode, couponCode: code)
            guard let applied = response.couponCode else {
                // 200 with no coupon folded in — the contract prefers a 422
                // for unusable codes; treat the silent no-op the same way.
                appliedCouponCode = nil
                couponErrorMessage = L("checkout.coupon.invalid")
                return
            }
            appliedCouponCode = applied
            couponDiscountPaise = response.totals.discountInPaise
            couponMessage = L("checkout.coupon.applied", applied)
        } catch let error as APIError where Self.isInvalidCoupon(error) {
            appliedCouponCode = nil
            couponErrorMessage = Self.invalidCouponMessage(error)
            // couponDiscountPaise untouched: last good totals stand.
        } catch {
            appliedCouponCode = nil
            couponErrorMessage = "Couldn't check this code. Try again."
        }
    }

    /// Drop the code and re-validate WITHOUT it so the totals lose the
    /// discount (Remove is local truth; a failed refresh is fine — Pay
    /// re-validates anyway).
    func removeCoupon() async {
        guard appliedCouponCode != nil else { return }
        appliedCouponCode = nil
        couponMessage = nil
        couponErrorMessage = nil
        guard let address, hasCartLines() else {
            couponDiscountPaise = 0
            return
        }
        isValidatingCoupon = true
        defer { isValidatingCoupon = false }
        do {
            let response = try await validateCart(pincode: address.pincode, couponCode: nil)
            appliedCouponCode = response.couponCode
            couponDiscountPaise = response.totals.discountInPaise
        } catch {
            // Nothing to surface — the code IS removed; the next validate
            // (Apply or Pay) refreshes the totals.
        }
    }

    private func hasCartLines() -> Bool {
        let count = (try? context.fetchCount(FetchDescriptor<CartItemEntity>())) ?? 0
        return count > 0
    }

    /// POST /cart/validate with the CURRENT cart lines + slot. The applied
    /// code rides along on every validate the flow performs.
    private func validateCart(pincode: String, couponCode: String?) async throws -> CartValidateResponseDTO {
        let lines = (try? context.fetch(FetchDescriptor<CartItemEntity>())) ?? []
        return try await client.request(Endpoint.cartValidate(
            items: Self.collapsedCartItems(lines),
            pincode: pincode,
            slot: selectedSlot,
            couponCode: couponCode
        ))
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
            let validate: CartValidateResponseDTO
            do {
                validate = try await validateCart(pincode: address.pincode, couponCode: appliedCouponCode)
            } catch let error as APIError where Self.isInvalidCoupon(error) {
                // The code that applied earlier is no longer usable (expired
                // since). Drop it, say why, and stop THIS attempt — checkout
                // is not blocked: the next Pay runs clean at full price.
                appliedCouponCode = nil
                couponMessage = nil
                couponErrorMessage = Self.invalidCouponMessage(error)
                paymentState = .failed(message: couponErrorMessage ?? "")
                errorMessage = couponErrorMessage
                return
            }
            // The validate round-trip is the coupon's source of truth —
            // sync what the server actually folded in.
            appliedCouponCode = validate.couponCode
            couponDiscountPaise = validate.totals.discountInPaise

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
