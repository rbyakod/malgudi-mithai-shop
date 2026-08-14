// DeliveryAttributes.swift — Task 18.2 (Mishran Mobile Apps v1).
// ActivityKit attributes for the delivery Live Activity. This file is
// compiled into BOTH the app target (starts/updates activities) and the
// MishranWidgets extension (renders them) — it must not import app-target
// code, so OrderStatus lives here too.
//
// ContentState mirrors the backend's `.liveactivity` push content-state
// EXACTLY (OrderEventEmitter → ApnsPushService: {status, statusLabel,
// body, updatedAt}) — a mismatch would make push updates fail to decode
// into the running activity. (Plan Step 3 sketched {status, eta,
// lastUpdate}; the shipped contract carries statusLabel/body i18n keys
// instead — contract wins, no eta in v1.)
import ActivityKit
import Foundation
import SwiftUI

/// Order lifecycle (contract OrderStatus — 12 states, side states included).
enum OrderStatus: String, Decodable, Equatable, CaseIterable, Hashable {
    case created
    case pendingPayment = "pending_payment"
    case confirmed
    case packed
    case dispatched
    case outForDelivery = "out_for_delivery"
    case delivered
    case paymentFailed = "payment_failed"
    case cancelled
    case returned
    case failedDelivery = "failed_delivery"
    case abandoned
}

struct DeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// Order stage key (confirmed/packed/dispatched/out_for_delivery/delivered).
        let status: String
        /// i18n key for the milestone label ("order.status.out_for_delivery").
        let statusLabel: String
        /// i18n key for the detail body.
        let body: String
        /// ISO timestamp of this update.
        let updatedAt: String
    }

    let orderId: String
}

extension DeliveryAttributes {
    /// Initial state for a client-started activity (backend pushes take
    /// over from there).
    static func initialState(for status: OrderStatus) -> ContentState {
        ContentState(
            status: status.rawValue,
            statusLabel: "order.status.\(status.rawValue)",
            body: "order.body.\(status.rawValue)",
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
    }

    /// Stage accent per plan Step 4: marigold (brand pop) for dispatched,
    /// saffron (state warning) for out_for_delivery.
    static func stageTint(for status: String) -> Color {
        switch status {
        case "dispatched": .mishranBrandPop
        case "out_for_delivery": .mishranStateWarning
        case "delivered": .mishranStateSuccess
        default: .mishranBrandAccent
        }
    }

    /// Terminal stages end the activity (backend sends a dismissal-date for
    /// delivered; cancelled has no emission path yet — see ledger note).
    static func isTerminal(_ status: String) -> Bool {
        ["delivered", "cancelled", "returned", "failed_delivery"].contains(status)
    }
}
