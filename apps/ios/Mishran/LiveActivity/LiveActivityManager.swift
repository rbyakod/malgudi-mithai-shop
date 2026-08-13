// LiveActivityManager.swift — Task 18.2 (Mishran Mobile Apps v1).
// Starts/updates/ends the delivery Live Activity. Guarded by the user's
// Live Activities toggle — a disabled setting returns nil instead of
// throwing; callers treat that as "no activity", never an error. The
// push token for backend-driven updates is registered with
// /notifications/register-device in Task 18.3.
import ActivityKit
import Foundation

@MainActor
final class LiveActivityManager {
    private var activity: Activity<DeliveryAttributes>?

    /// Current activity id, if one is running for this manager.
    var activityId: String? { activity?.id }

    @discardableResult
    func startActivity(
        orderId: String,
        status: OrderStatus = .confirmed
    ) async -> Activity<DeliveryAttributes>? {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        // Replace any previous activity for this manager (one order at a
        // time in v1).
        await endActivity()
        do {
            let state = DeliveryAttributes.initialState(for: status)
            let activity = try Activity.request(
                attributes: DeliveryAttributes(orderId: orderId),
                content: ActivityContent(state: state, staleDate: nil)
            )
            self.activity = activity
            // Hand the ActivityKit push token to the registrar so the
            // backend can drive .liveactivity content-state updates
            // (Task 18.3 sink; set by the app shell).
            if let tokenData = activity.pushToken {
                DeviceRegistrar.liveActivityTokenSink?(DeviceRegistrar.hexString(from: tokenData))
            }
            return activity
        } catch {
            // Request failures (quota, unsupported device) degrade to none.
            return nil
        }
    }

    /// Local stage update (server pushes drive the same state over APNs).
    func updateActivity(status: OrderStatus) async {
        guard let activity else { return }
        let state = DeliveryAttributes.initialState(for: status)
        await activity.update(ActivityContent(state: state, staleDate: nil))
        if DeliveryAttributes.isTerminal(status.rawValue) {
            await endActivity()
        }
    }

    /// End and dismiss immediately (order delivered / user-cancelled).
    func endActivity() async {
        guard let activity else { return }
        self.activity = nil
        await activity.end(dismissalPolicy: .immediate)
    }
}
