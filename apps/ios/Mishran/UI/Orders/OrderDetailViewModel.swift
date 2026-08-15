// OrderDetailViewModel.swift — Task 18.1 (Mishran Mobile Apps v1).
// Single-order projection from GET /orders/{id}. 18.2 will hang the Live
// Activity start off order == .confirmed here.
import Foundation
import Observation

@MainActor
@Observable
final class OrderDetailViewModel {
    let orderId: String

    private let client: MishranAPIClient
    /// Task 18.2: starts the delivery Live Activity for in-flight orders
    /// (no-op when Live Activities are toggled off or unsupported).
    private let liveActivity = LiveActivityManager()

    private(set) var order: OrderDTO?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    init(orderId: String, client: MishranAPIClient) {
        self.orderId = orderId
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            order = try await client.request(Endpoint.orderDetail(id: orderId))
            // Happy-path stages keep a Live Activity on the lock screen;
            // backend pushes drive its state from here on (18.3 registers
            // the push token).
            if let order, OrderTimeline.stageIndex(for: order.status) != nil {
                await liveActivity.startActivity(orderId: order.id, status: order.status)
            }
        } catch let error as APIError {
            errorMessage = Self.friendlyMessage(for: error)
        } catch {
            errorMessage = "Couldn't load this order. Try again."
        }
        isLoading = false
    }

    /// Surface the server's message when we have one (ORDER_NOT_FOUND etc.).
    nonisolated static func friendlyMessage(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error, !message.isEmpty {
            return message
        }
        return "Couldn't load this order. Try again."
    }
}

/// OrdersViewModel.swift — Task 18.1 (Mishran Mobile Apps v1).
/// GET /orders page 1; pull-to-refresh re-runs load(). Errors keep the
/// previously loaded rows on screen (same contract as the catalog repo).
@MainActor
@Observable
final class OrdersViewModel {
    private let client: MishranAPIClient

    private(set) var orders: [OrderDTO] = []
    private(set) var total: Int = 0
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    init(client: MishranAPIClient) {
        self.client = client
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let page: OrderPageDTO = try await client.request(Endpoint.orders())
            orders = page.items
            total = page.total
        } catch {
            errorMessage = "Couldn't load your orders. Pull to retry."
        }
        isLoading = false
    }
}

/// OrderTimeline — Task 18.1. Pure rendering helpers (Android OrderTimeline
/// parity): the contract carries only the CURRENT status, so the detail
/// screen renders the canonical happy path with the live stage highlighted;
/// side states render a banner instead.
enum OrderTimeline {
    /// Canonical happy-path stages, in order.
    nonisolated static let stages: [OrderStatus] = [
        .confirmed, .packed, .dispatched, .outForDelivery, .delivered,
    ]

    /// Index of the live stage, or nil for pre-confirmation + side states.
    nonisolated static func stageIndex(for status: OrderStatus) -> Int? {
        stages.firstIndex(of: status)
    }

    /// Friendly copy per status (orders.status.* keys; the three side
    /// states without keys stay English until the contract's wording
    /// lands in the i18n source of truth).
    nonisolated static func label(for status: OrderStatus) -> String {
        switch status {
        case .created: L("orders.status.created")
        case .pendingPayment: L("orders.status.pending_payment")
        case .confirmed: L("orders.status.confirmed")
        case .packed: L("orders.status.packed")
        case .dispatched: L("orders.status.dispatched")
        case .outForDelivery: L("orders.status.out_for_delivery")
        case .delivered: L("orders.status.delivered")
        case .paymentFailed: L("orders.status.payment_failed")
        case .cancelled: L("orders.status.cancelled")
        case .returned: "Returned"
        case .failedDelivery: "Delivery failed"
        case .abandoned: "Abandoned"
        }
    }

    /// Visual tone for chips/banners.
    enum Tone: Equatable {
        case progress, positive, negative
    }

    nonisolated static func tone(for status: OrderStatus) -> Tone {
        switch status {
        case .delivered: .positive
        case .cancelled, .paymentFailed, .returned, .failedDelivery, .abandoned: .negative
        default: .progress
        }
    }

    /// ISO-8601 instant → "13 Aug, 3:05 PM" (device zone); raw if unparseable.
    nonisolated static func formatDate(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM, h:mm a"
        return formatter.string(from: date)
    }
}
