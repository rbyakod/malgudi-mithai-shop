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

    /// Fresh-tier windows: today + tomorrow, morning + evening (parity with
    /// Android's slot factory).
    static func freshTierOptions() -> [DeliverySlot] {
        [
            DeliverySlot(id: "today-morning", label: "Today, morning"),
            DeliverySlot(id: "today-evening", label: "Today, evening"),
            DeliverySlot(id: "tomorrow-morning", label: "Tomorrow, morning"),
            DeliverySlot(id: "tomorrow-evening", label: "Tomorrow, evening"),
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

    static let tierFresh = "fresh"
    /// Freshness values that require the same-day fresh-tier network.
    static let freshRequiringFreshness: Set<String> = ["made-daily", "made-to-order"]

    private let client: MishranAPIClient
    private let context: ModelContext

    var address: AddressEntity?
    var selectedSlot: DeliverySlot?
    var paymentMethod: PaymentMethod?
    private(set) var serviceability: ServiceabilityState = .unknown
    private(set) var slotOptions: [DeliverySlot] = []
    private(set) var errorMessage: String?

    init(client: MishranAPIClient, context: ModelContext) {
        self.client = client
        self.context = context
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
}
