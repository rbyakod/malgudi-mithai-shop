// Task 15.1 (Mishran Mobile Apps v1): AuthViewModel tests over the same
// URLProtocol mock as the API client tests — the view model talks to a real
// MishranAPIClient configured with mock sessions.
import XCTest
@testable import Mishran

@MainActor
final class AuthViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var store: InMemoryTokenStore!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        store = InMemoryTokenStore()
    }

    override func tearDown() {
        MockURLProtocol.reset()
        // A successful verify() persists the "signed in once" flag into the
        // HOST APP's real defaults (Task 20.5) — without this cleanup the
        // later UI-test launches would boot to the sign-in gate.
        UserDefaults.standard.removeObject(forKey: AuthViewModel.signedInOnceKey)
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

    // MARK: (a) phone validation — contract: ^\+[1-9]\d{6,14}$

    func testPhoneValidation() {
        let vm = makeViewModel()
        vm.phone = "+919876543210"
        XCTAssertTrue(vm.isPhoneValid)
        vm.phone = "9876543210"   // missing +
        XCTAssertFalse(vm.isPhoneValid)
        vm.phone = "+0123456789"  // leading 0 after +
        XCTAssertFalse(vm.isPhoneValid)
        vm.phone = "+12345"       // too short
        XCTAssertFalse(vm.isPhoneValid)
        vm.phone = ""             // empty
        XCTAssertFalse(vm.isPhoneValid)
    }

    // MARK: (b) OTP request triggers API call + stage moves to code entry

    func testSendCodeRequestsOtpAndAdvances() async {
        MockURLProtocol.routes["/auth/otp/send"] = (
            200, [:], json(#"{"data":{"requestId":"req_1","expiresAt":"2026-08-13T12:00:00Z"}}"#)
        )
        let vm = makeViewModel()
        vm.phone = "+919876543210"
        await vm.sendCode()

        XCTAssertEqual(MockURLProtocol.calls["/auth/otp/send"], 1)
        XCTAssertEqual(vm.requestId, "req_1")
        XCTAssertEqual(vm.stage, .otp)
        XCTAssertNil(vm.errorMessage)
        // Request body carries the phone (URLProtocol exposes it as a stream).
        let request = MockURLProtocol.lastRequests["/auth/otp/send"]
        let body = request.flatMap(MockURLProtocol.body(of:))
        XCTAssertTrue(String(data: body ?? Data(), encoding: .utf8)?.contains("+919876543210") == true)
    }

    func testSendCodeRejectsInvalidPhoneLocally() async {
        let vm = makeViewModel()
        vm.phone = "not-a-phone"
        await vm.sendCode()
        XCTAssertNil(MockURLProtocol.calls["/auth/otp/send"])
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(vm.stage, AuthViewModel.Stage.phone)
    }

    // MARK: (c) verify success stores tokens + customer

    func testVerifySuccessStoresTokensAndCustomer() async {
        MockURLProtocol.routes["/auth/otp/verify"] = (
            200, [:],
            json(#"{"data":{"accessToken":"acc_1","refreshToken":"ref_1","customer":{"id":"c1","phone":"+919876543210","name":null,"email":null,"locale":"en","createdAt":"2026-01-01T00:00:00Z"}}}"#)
        )
        let vm = makeViewModel()
        vm.phone = "+919876543210"
        vm.requestId = "req_1"
        vm.code = "123456"
        await vm.verify()

        XCTAssertEqual(store.accessToken, "acc_1")
        XCTAssertEqual(store.refreshToken, "ref_1")
        XCTAssertEqual(vm.signedInCustomer?.id, "c1")
        XCTAssertTrue(vm.isSignedIn)
        XCTAssertNil(vm.errorMessage)
    }

    // MARK: (d) wrong code surfaces the backend error

    func testVerifyWrongCodeShowsError() async {
        MockURLProtocol.routes["/auth/otp/verify"] = (
            400, [:], json(#"{"error":{"code":"OTP_INVALID","message":"That code didn't match"}}"#)
        )
        let vm = makeViewModel()
        vm.requestId = "req_1"
        vm.stage = .otp
        vm.code = "000000"
        await vm.verify()

        XCTAssertFalse(vm.isSignedIn)
        XCTAssertEqual(vm.errorMessage, "That code didn't match")
        XCTAssertEqual(vm.errorCode, .otpInvalid)
        XCTAssertEqual(vm.stage, .otp) // stays on code entry for retry
    }

    // MARK: (e) rate limit + expired OTP paths

    func testSendCodeRateLimitedSurfacesError() async {
        MockURLProtocol.routes["/auth/otp/send"] = (
            429, [:], json(#"{"error":{"code":"RATE_LIMITED","message":"Too many attempts"}}"#)
        )
        let vm = makeViewModel()
        vm.phone = "+919876543210"
        await vm.sendCode()
        XCTAssertEqual(vm.errorCode, .rateLimited)
        XCTAssertEqual(vm.errorMessage, "Too many attempts")
        XCTAssertEqual(vm.stage, AuthViewModel.Stage.phone)
    }

    func testVerifyExpiredOtpSurfacesErrorAndResets() async {
        MockURLProtocol.routes["/auth/otp/verify"] = (
            400, [:], json(#"{"error":{"code":"OTP_EXPIRED","message":"Code expired"}}"#)
        )
        let vm = makeViewModel()
        vm.requestId = "req_1"
        vm.code = "123456"
        await vm.verify()
        XCTAssertEqual(vm.errorCode, .otpExpired)
        // Expired request id is dead — back to phone entry for a fresh send.
        XCTAssertEqual(vm.stage, AuthViewModel.Stage.phone)
        XCTAssertNil(vm.requestId)
    }
}
