// PushPermissionRequester.swift — Task 18.3 (Mishran Mobile Apps v1).
// Requests notification authorization once per install (UserDefaults flag);
// the closure seam keeps it testable the same way BiometricGate is.
// Permission denial is respected — the system settings app is the only
// path back, and we don't nag.
import Foundation
import UserNotifications

struct PushPermissionRequester: Sendable {
    /// Asks the system; true when authorized. Injectable for tests.
    var request: @Sendable () async -> Bool

    static let requestedFlagKey = "pushPermissionRequested"

    /// Fires the request only if this install hasn't asked before.
    @MainActor
    func requestIfNeeded() async {
        guard !UserDefaults.standard.bool(forKey: Self.requestedFlagKey) else { return }
        UserDefaults.standard.set(true, forKey: Self.requestedFlagKey)
        _ = await request()
    }

    /// Real authorization request (alert + badge + sound).
    static let live = PushPermissionRequester(
        request: {
            (try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        }
    )
}
