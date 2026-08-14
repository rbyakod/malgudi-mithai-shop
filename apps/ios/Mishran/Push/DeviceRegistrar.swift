// DeviceRegistrar.swift — Task 18.3 (Mishran Mobile Apps v1).
// Observes the APNs token notification and upserts the device row via
// POST /notifications/register-device (platform "ios", token as lowercase
// hex). Also carries the ActivityKit push token while a delivery Live
// Activity is in flight (same upsert — OrderEventEmitter reads
// devices.liveActivityToken for .liveactivity pushes).
//
// The modern SDK renamed/deprecated the UIApplication notification
// constants (didRegisterForRemoteNotificationsNotification → unavailable);
// the raw values below are the stable wire format.
import Foundation
import UIKit

@MainActor
final class DeviceRegistrar {
    /// Raw name of UIApplicationDidRegisterForRemoteNotifications.
    static let didRegisterForRemoteNotifications =
        Notification.Name("UIApplicationDidRegisterForRemoteNotifications")
    /// Raw userInfo key the token rides under.
    static let deviceTokenUserInfoKey = "deviceToken"

    /// Set by the app shell: LiveActivityManager forwards the ActivityKit
    /// push token here when an activity starts; the sink routes it into
    /// registerLiveActivityToken on the registrar instance.
    @MainActor static var liveActivityTokenSink: (@MainActor (String) -> Void)?

    private let client: MishranAPIClient
    private var observer: (any NSObjectProtocol)?
    private(set) var lastRegisteredToken: String?
    /// Latest Live Activity push token; piggybacks on the next APNs upsert
    /// if the device token hasn't arrived yet (route requires pushToken).
    private var liveActivityToken: String?

    init(client: MishranAPIClient) {
        self.client = client
    }

    deinit {
        if let observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    func startObserving() {
        guard observer == nil else { return }
        observer = NotificationCenter.default.addObserver(
            forName: Self.didRegisterForRemoteNotifications,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let token = (notification.userInfo?[Self.deviceTokenUserInfoKey] as? Data)
                .map(Self.hexString(from:)) ?? ""
            Task { @MainActor in
                await self?.register(token: token)
            }
        }
    }

    /// APNs device token (hex) → register-device upsert. Skips empties and
    /// repeats of the token we already registered.
    func register(token: String) async {
        guard !token.isEmpty, token != lastRegisteredToken else { return }
        lastRegisteredToken = token
        await upsert()
    }

    /// ActivityKit push token — recorded whenever a Live Activity starts;
    /// sent immediately when an APNs token is already registered, else it
    /// rides the next APNs upsert (route requires pushToken).
    func registerLiveActivityToken(_ token: String) async {
        guard !token.isEmpty else { return }
        liveActivityToken = token
        guard lastRegisteredToken != nil else { return }
        await upsert()
    }

    private func upsert() async {
        struct RegisterDeviceRequestDTO: Encodable {
            let platform: String
            let pushToken: String
            let liveActivityToken: String?
            let appVersion: String?
            let deviceModel: String?
            let osVersion: String?
            let locale: String?
        }
        struct RegisterDeviceResponseDTO: Decodable {
            let ok: Bool
        }
        guard let pushToken = lastRegisteredToken else { return }
        let device = UIDevice.current
        let request = RegisterDeviceRequestDTO(
            platform: "ios",
            pushToken: pushToken,
            liveActivityToken: liveActivityToken,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
            deviceModel: device.model,
            osVersion: device.systemVersion,
            locale: Locale.current.identifier
        )
        // Fire-and-forget: registration retries on the next token change /
        // cold start (the backend treats every call as an idempotent upsert).
        let _: RegisterDeviceResponseDTO? = try? await client.request(
            Endpoint.registerDevice(
                platform: request.platform,
                pushToken: request.pushToken,
                liveActivityToken: request.liveActivityToken,
                appVersion: request.appVersion,
                deviceModel: request.deviceModel,
                osVersion: request.osVersion,
                locale: request.locale
            )
        )
    }

    /// Raw APNs token bytes → lowercase hex (the transport encoding).
    nonisolated static func hexString(from data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
}
