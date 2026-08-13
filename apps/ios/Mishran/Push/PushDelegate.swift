// PushDelegate.swift — Task 18.3 (Mishran Mobile Apps v1).
// UNUserNotificationCenter delegate: foreground pushes show a banner
// (order updates shouldn't be silent while the app is open), taps route to
// the order's detail screen via the shared router. Payload data carries
// {orderId, stage, event_id} (OrderEventEmitter contract).
import Foundation
import UserNotifications

final class PushDelegate: NSObject, UNUserNotificationCenterDelegate {
    let router: Router

    init(router: Router) {
        self.router = router
    }

    /// Foreground: show the banner (default would silently drop it).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    /// Tap: route to the order the notification is about.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let route = Self.route(forUserInfo: response.notification.request.content.userInfo) {
            router.reset(to: route)
        }
        completionHandler()
    }

    /// {orderId, stage, event_id} → .orderDetail(orderId); nil when the
    /// payload isn't an order event.
    nonisolated static func route(forUserInfo userInfo: [AnyHashable: Any]) -> Route? {
        guard let orderId = userInfo["orderId"] as? String, !orderId.isEmpty else { return nil }
        return .orderDetail(id: orderId)
    }
}
