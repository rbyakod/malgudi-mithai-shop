// Task 15.2 (Mishran Mobile Apps v1): Sign in with Apple tests.
// ASAuthorizationAppleIDCredential can't be constructed in tests, so the
// coordinator's delegate methods funnel into `completed(...)` taking plain
// values — that funnel is the testable seam (same pattern as Android's
// RazorpaySdkLauncher forwarding).
import XCTest
@testable import Mishran

@MainActor
final class AppleSignInTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var store: InMemoryTokenStore!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        store = InMemoryTokenStore()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        super.tearDown()
    }

    private func makeViewModel() -> AuthViewModel {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(),
            refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: store, session: session(), baseURL: baseURL),
            retryDelay: 0
        )
        return AuthViewModel(client: client)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    func testCredentialFunnelCallsAuthAppleWithTokenAndName() async {
        MockURLProtocol.routes["/auth/apple"] = (
            200, [:],
            json(#"{"data":{"accessToken":"acc_a","refreshToken":"ref_a","customer":{"id":"c9","phone":null,"name":"Ravi Kumar","email":"r@example.com","locale":"en","createdAt":null}}}"#)
        )
        let vm = makeViewModel()
        let coordinator = AppleSignInCoordinator()
        coordinator.onCredential = { credential in
            Task { await vm.signInWithApple(credential) }
        }

        // Simulated ASAuthorizationControllerDelegate callback.
        coordinator.completed(identityToken: "apple-jwt-1", authorizationCode: "ac_1", fullName: "Ravi Kumar")
        // Wait for the async hop through the viewModel.
        for _ in 0..<50 where !vm.isSignedIn {
            try? await Task.sleep(nanoseconds: 20_000_000)
        }

        XCTAssertTrue(vm.isSignedIn)
        XCTAssertEqual(store.accessToken, "acc_a")
        XCTAssertEqual(store.refreshToken, "ref_a")
        XCTAssertEqual(vm.signedInCustomer?.id, "c9")
        XCTAssertEqual(MockURLProtocol.calls["/auth/apple"], 1)

        // Request body carries identityToken + name (contract: {identityToken, name?}).
        let request = MockURLProtocol.lastRequests["/auth/apple"]
        let body = request.flatMap(MockURLProtocol.body(of:))
        let bodyString = String(data: body ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(bodyString.contains("apple-jwt-1"))
        XCTAssertTrue(bodyString.contains("Ravi Kumar"))
    }

    func testCredentialWithoutNameOmitsNameField() async {
        MockURLProtocol.routes["/auth/apple"] = (
            200, [:],
            json(#"{"data":{"accessToken":"a","refreshToken":"r","customer":{"id":"c","phone":null,"name":null,"email":null,"locale":"en","createdAt":null}}}"#)
        )
        let vm = makeViewModel()
        await vm.signInWithApple(AppleSignInCoordinator.Credential(
            identityToken: "jwt", authorizationCode: "ac", fullName: nil
        ))
        XCTAssertTrue(vm.isSignedIn)
        let body = MockURLProtocol.lastRequests["/auth/apple"].flatMap(MockURLProtocol.body(of:))
        let bodyString = String(data: body ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(bodyString.contains("identityToken"))
        XCTAssertFalse(bodyString.contains("fullName"))
    }

    func testInvalidTokenSurfacesError() async {
        MockURLProtocol.routes["/auth/apple"] = (
            401, [:], json(#"{"error":{"code":"TOKEN_EXPIRED","message":"Apple sign-in failed"}}"#)
        )
        let vm = makeViewModel()
        await vm.signInWithApple(AppleSignInCoordinator.Credential(
            identityToken: "bad", authorizationCode: nil, fullName: nil
        ))
        XCTAssertFalse(vm.isSignedIn)
        XCTAssertEqual(vm.errorCode, .tokenExpired)
        XCTAssertEqual(vm.errorMessage, "Apple sign-in failed")
    }

    func testCoordinatorForwardsError() {
        let coordinator = AppleSignInCoordinator()
        var message: String?
        coordinator.onError = { message = $0 }
        coordinator.failed(errorDescription: "cancelled")
        XCTAssertEqual(message, "cancelled")
    }
}
