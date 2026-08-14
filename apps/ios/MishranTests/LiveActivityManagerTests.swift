// Task 18.2 (Mishran Mobile Apps v1): LiveActivityManager tests. Content
// state mirrors the backend's push contract (OrderEventEmitter → APNs
// `.liveactivity` content-state: {status, statusLabel, body, updatedAt}) so
// a push update decodes into the running activity. Real activity requests
// are environment-gated (Live Activities toggle); the state machinery is
// pure and fully tested.
import ActivityKit
import XCTest
@testable import Mishran

@MainActor
final class LiveActivityManagerTests: XCTestCase {
    func testStartActivityReturnsActivityWhenEnabled() async throws {
        let info = ActivityAuthorizationInfo()
        let manager = LiveActivityManager()

        let activity = await manager.startActivity(orderId: "order_1", status: .confirmed)

        if info.areActivitiesEnabled {
            XCTAssertNotNil(activity, "enabled Live Activities should yield an activity")
            XCTAssertEqual(activity?.attributes.orderId, "order_1")
            XCTAssertEqual(activity?.content.state.status, OrderStatus.confirmed.rawValue)
            await manager.endActivity()
        } else {
            // Toggled off in Settings (or sim default) — gated, not failed.
            XCTAssertNil(activity, "disabled Live Activities must return nil, not throw")
        }
    }

    func testInitialStateCarriesStatusKeyAndTimestamp() {
        let state = DeliveryAttributes.initialState(for: .outForDelivery)
        XCTAssertEqual(state.status, "out_for_delivery")
        XCTAssertEqual(state.statusLabel, "order.status.out_for_delivery")
        XCTAssertFalse(state.updatedAt.isEmpty)
    }

    func testStateFromStatusMapsEveryHappyPathStage() {
        for status in OrderTimeline.stages {
            let state = DeliveryAttributes.initialState(for: status)
            XCTAssertEqual(state.status, status.rawValue)
            XCTAssertEqual(state.statusLabel, "order.status.\(status.rawValue)")
        }
    }

    func testStageColorUsesMarigoldForDispatchedAndSaffronForOutForDelivery() {
        XCTAssertEqual(DeliveryAttributes.stageTint(for: "dispatched"), .mishranBrandPop)
        XCTAssertEqual(DeliveryAttributes.stageTint(for: "out_for_delivery"), .mishranStateWarning)
        XCTAssertEqual(DeliveryAttributes.stageTint(for: "confirmed"), .mishranBrandAccent)
        XCTAssertEqual(DeliveryAttributes.stageTint(for: "delivered"), .mishranStateSuccess)
    }

    func testIsTerminalStage() {
        XCTAssertTrue(DeliveryAttributes.isTerminal("delivered"))
        XCTAssertFalse(DeliveryAttributes.isTerminal("dispatched"))
        XCTAssertFalse(DeliveryAttributes.isTerminal("bogus"))
    }
}
