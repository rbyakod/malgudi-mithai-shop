// Task 18.3 (Mishran Mobile Apps v1): APNs device registration + push
// plumbing. DeviceRegistrar observes UIApplication's
// didRegisterForRemoteNotifications and POSTs /notifications/register-device
// with platform "ios"; the token arrives as raw bytes → lowercase hex.
// PushDelegate maps an order push's data payload onto the order-detail
// route (foreground handling is delegate-hosted, untestable headless).
import UIKit
import XCTest
@testable import Mishran

@MainActor
final class PushRegistrationTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        UserDefaults.standard.removeObject(forKey: "pushPermissionRequested")
    }

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: "pushPermissionRequested")
        super.tearDown()
    }

    private func makeClient() -> MishranAPIClient {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        return MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: baseURL),
            retryDelay: 0
        )
    }

    private func postTokenNotification(_ data: Data) {
        NotificationCenter.default.post(
            name: DeviceRegistrar.didRegisterForRemoteNotifications,
            object: nil,
            userInfo: [DeviceRegistrar.deviceTokenUserInfoKey: data]
        )
    }

    /// Poll until the condition holds (APNs delivery is async through the
    /// main queue), bounded at ~2s.
    private func waitUntil(_ condition: @escaping () -> Bool) async {
        for _ in 0..<100 where !condition() {
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
    }

    func testHexStringIsLowercasePairs() {
        XCTAssertEqual(
            DeviceRegistrar.hexString(from: Data([0x0a, 0xbc, 0xff])),
            "0abcff"
        )
        XCTAssertEqual(DeviceRegistrar.hexString(from: Data()), "")
    }

    func testApnsTokenReceiptCallsRegisterDeviceWithIosPlatform() async {
        MockURLProtocol.routes["notifications/register-device"] = (200, [:], Data(#"{"data":{"ok":true}}"#.utf8))
        let registrar = DeviceRegistrar(client: makeClient())
        registrar.startObserving()

        postTokenNotification(Data([0xde, 0xad, 0xbe, 0xef]))
        await waitUntil { MockURLProtocol.calls["notifications/register-device"] == 1 }

        let request = MockURLProtocol.lastRequests["notifications/register-device"]
        XCTAssertEqual(request?.httpMethod, "POST")
        let body = request.flatMap(MockURLProtocol.body(of:)).flatMap {
            (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any]
        }
        XCTAssertEqual(body?["platform"] as? String, "ios")
        XCTAssertEqual(body?["pushToken"] as? String, "deadbeef")
        XCTAssertEqual(registrar.lastRegisteredToken, "deadbeef")
    }

    func testLiveActivityTokenRegistrationPostsSeparately() async {
        MockURLProtocol.routes["notifications/register-device"] = (200, [:], Data(#"{"data":{"ok":true}}"#.utf8))
        let registrar = DeviceRegistrar(client: makeClient())

        // APNs token first (route requires pushToken); the Live Activity
        // token then triggers its own upsert.
        await registrar.register(token: "apns-1")
        await waitUntil { MockURLProtocol.calls["notifications/register-device"] == 1 }
        await registrar.registerLiveActivityToken("la-abc")
        await waitUntil { MockURLProtocol.calls["notifications/register-device"] == 2 }

        let body = MockURLProtocol.lastRequests["notifications/register-device"]
            .flatMap(MockURLProtocol.body(of:))
            .flatMap { (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any] }
        XCTAssertEqual(body?["liveActivityToken"] as? String, "la-abc")
        XCTAssertEqual(body?["pushToken"] as? String, "apns-1")
        XCTAssertEqual(body?["platform"] as? String, "ios")
    }

    func testPushPayloadMapsToOrderDetailRoute() {
        let payload: [AnyHashable: Any] = [
            "orderId": "order_9",
            "stage": "confirmed",
            "event_id": "e-1",
        ]
        XCTAssertEqual(PushDelegate.route(forUserInfo: payload), .orderDetail(id: "order_9"))
        XCTAssertNil(PushDelegate.route(forUserInfo: ["stage": "confirmed"]))
        XCTAssertNil(PushDelegate.route(forUserInfo: [:]))
    }

    func testPermissionRequestedOnlyOnce() async {
        UserDefaults.standard.set(true, forKey: "pushPermissionRequested")
        var calls = 0
        let requester = PushPermissionRequester(
            request: {
                calls += 1
                return true
            }
        )
        await requester.requestIfNeeded()
        await requester.requestIfNeeded()
        XCTAssertEqual(calls, 0, "already-requested flag must suppress repeats")
    }
}
