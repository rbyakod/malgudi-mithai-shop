// CartViewModel.swift — Task 17.1 (Mishran Mobile Apps v1).
// Cart mutations + totals over the singleton CartEntity. The view layer
// observes rows via @Query; this view model owns the writes and math.
// Batch B9: delivery estimates — every cart change (debounced) POSTs
// /cart/estimate with the lines + the pincode the PDP delivery check
// persisted, so the cart footer can show the tier fee and the
// free-delivery threshold progress. The route is unauthenticated: guests
// get estimates too, and a failure silently falls back to the
// calculated-at-checkout copy (checkout is never blocked).
import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class CartViewModel {
    /// Threshold progress line the footer renders under the totals — pure
    /// derivation, unit-tested without a view.
    enum FreeDeliveryProgress: Equatable {
        /// Tier has no usable threshold (unknown tier / waiver disabled) —
        /// no progress line at all.
        case none
        /// Still {amount} short of the tier's threshold (paise).
        case remaining(Int)
        /// Subtotal met the threshold — the fee is already zeroed.
        case unlocked
    }

    /// Delivery block the cart summary/footer renders.
    enum DeliveryFooter: Equatable {
        /// No pincode saved, or the estimate failed — the checkout-time
        /// copy plus the check-delivery affordance (the PDP's flow).
        case atCheckout
        /// The saved pincode priced the cart: fee row + threshold progress.
        case priced(deliveryFeePaise: Int, progress: FreeDeliveryProgress)
    }

    private let context: ModelContext
    private let client: MishranAPIClient
    /// Pincode source — the SAME store the PDP delivery check persists to
    /// ("product.delivery.last"), read fresh on every refresh.
    private let defaults: UserDefaults
    /// Nanoseconds the estimate fetch waits after a cart change (steppers
    /// can fire rapidly; the route is rate-limited per IP). 0 in tests.
    private let estimateDebounceNanos: UInt64

    private(set) var items: [CartItemEntity] = []
    /// Latest POST /cart/estimate for the current cart + saved pincode.
    /// nil until the first fetch resolves and again on any failure (the
    /// footer then reads the calculated-at-checkout copy).
    private(set) var estimate: CartEstimateDTO?
    /// In-flight estimate refresh — cancelled and rescheduled on every
    /// cart change; awaited by the tests for deterministic assertions.
    private(set) var estimateTask: Task<Void, Never>?

    init(
        context: ModelContext,
        client: MishranAPIClient = MishranAPIClient(),
        defaults: UserDefaults = .standard,
        estimateDebounceNanos: UInt64 = 500_000_000
    ) {
        self.context = context
        self.client = client
        self.defaults = defaults
        self.estimateDebounceNanos = estimateDebounceNanos
        reload()
    }

    func reload() {
        items = ProductDetailViewModel.findOrCreateCart(in: context).items.sorted { $0.name < $1.name }
        scheduleEstimate()
    }

    var totalPaise: Int {
        Self.totalPaise(of: items)
    }

    var itemCount: Int {
        items.reduce(0) { $0 + $1.quantity }
    }

    /// Stepper changes from the cart floor at 1 (0 = remove instead).
    func setQuantity(productId: String, quantity: Int) {
        guard let line = items.first(where: { $0.productId == productId }) else { return }
        line.quantity = max(1, min(quantity, ProductDetailViewModel.maxQuantity))
        try? context.save()
        reload()
    }

    func removeLine(productId: String) {
        guard let line = items.first(where: { $0.productId == productId }) else { return }
        context.delete(line)
        try? context.save()
        reload()
    }

    /// Empty the cart but keep the singleton row (see CartEntity.delete note
    /// in SwiftDataModels — the cart itself never needs deleting in v1).
    func clear() {
        for line in items {
            context.delete(line)
        }
        try? context.save()
        reload()
    }

    /// Pure — sum of unitPricePaise × quantity over the lines.
    nonisolated static func totalPaise(of items: [CartItemEntity]) -> Int {
        items.reduce(0) { $0 + $1.unitPricePaise * $1.quantity }
    }

    // MARK: Delivery estimate (Batch B9)

    /// Pincode the estimate prices — the PDP delivery check's last
    /// SERVICEABLE result, or nil when none was saved yet.
    var savedPincode: String? {
        DeliveryCheckModel.storedResult(from: defaults)?.pincode
    }

    /// Delivery block the cart renders right now.
    var deliveryFooter: DeliveryFooter {
        Self.deliveryFooter(estimate: estimate, hasSavedPincode: savedPincode != nil)
    }

    /// Re-read the saved pincode and re-estimate (the cart view calls this
    /// when the delivery-check sheet dismisses — a fresh result changes
    /// what the footer can price).
    func refreshEstimate() {
        scheduleEstimate()
    }

    /// Debounced estimate refresh over the CURRENT lines. With no saved
    /// pincode there is nothing the estimate adds (null tier, no fee) and
    /// the route is rate-limited per IP — the call is skipped until one is
    /// saved. An emptied cart drops the estimate outright.
    private func scheduleEstimate() {
        estimateTask?.cancel()
        guard !items.isEmpty, let pincode = savedPincode else {
            estimate = nil
            estimateTask = nil
            return
        }
        // Capture plain values — the Task closure is @Sendable and the
        // SwiftData line objects must not cross it.
        let lines = items.map { line in
            CartEstimateItemDTO(
                productId: line.baseProductId,
                quantity: line.quantity,
                packLabel: line.packLabel
            )
        }
        let nanos = estimateDebounceNanos
        estimateTask = Task { [weak self] in
            if nanos > 0 {
                try? await Task.sleep(nanoseconds: nanos)
            }
            guard !Task.isCancelled, let self else { return }
            do {
                let dto: CartEstimateDTO = try await self.client.request(
                    Endpoint.cartEstimate(items: lines, pincode: pincode)
                )
                guard !Task.isCancelled else { return }
                self.estimate = dto
            } catch {
                // Silent fallback: the footer keeps the checkout copy and
                // never blocks the shopper.
                self.estimate = nil
            }
        }
    }

    // MARK: Pure footer math (testable without a repository)

    /// Footer state from an estimate + whether a pincode is saved. A nil
    /// estimate (not fetched yet, or failed) reads as atCheckout.
    nonisolated static func deliveryFooter(
        estimate: CartEstimateDTO?,
        hasSavedPincode: Bool
    ) -> DeliveryFooter {
        guard hasSavedPincode, let estimate else { return .atCheckout }
        return .priced(
            deliveryFeePaise: estimate.deliveryFeeInPaise,
            progress: progressState(
                itemsTotalPaise: estimate.itemsTotalInPaise,
                thresholdPaise: estimate.freeDeliveryThresholdInPaise
            )
        )
    }

    /// Threshold progress for a subtotal: a nil or zero threshold disables
    /// the waiver (no line); at/over the threshold it is unlocked; below it
    /// the shortfall (threshold − itemsTotal, in paise) remains.
    nonisolated static func progressState(
        itemsTotalPaise: Int,
        thresholdPaise: Int?
    ) -> FreeDeliveryProgress {
        guard let thresholdPaise, thresholdPaise > 0 else { return .none }
        if itemsTotalPaise >= thresholdPaise { return .unlocked }
        return .remaining(thresholdPaise - itemsTotalPaise)
    }

    /// Copy line for a progress state (the footer renders this verbatim).
    nonisolated static func progressLine(_ progress: FreeDeliveryProgress) -> String {
        switch progress {
        case .unlocked: return L("cart.free_delivery_unlocked")
        case let .remaining(paise): return L("cart.free_delivery_progress", CartView.rupees(paise))
        case .none: return L("cart.delivery_at_checkout")
        }
    }
}
