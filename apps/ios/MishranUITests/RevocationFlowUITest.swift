// RevocationFlowUITest.swift — Task 20.5 (Mishran Mobile Apps v1).
// Client half of the Apple revocation contract: when the refresh token is
// dead (server revoked it via /webhooks/apple/auth-events — the next
// refresh 401s and the authenticator clears the keychain), the NEXT
// LAUNCH must land on sign-in, not silently continue as the revoked user.
// The `-signedInOnce true` launch argument populates the argument-domain
// UserDefaults (ephemeral — nothing persists to poison later runs), and
// the keychain carries no token: exactly the post-401 state.
import XCTest

final class RevocationFlowUITest: XCTestCase {
    func testRevokedSessionNextLaunchShowsSignIn() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-signedInOnce", "true"]
        app.launch()
        XCTAssertTrue(
            app.staticTexts["Sign in to order fresh mithai."].waitForExistence(timeout: 5),
            "a revoked session must boot to the sign-in surface"
        )
        XCTAssertTrue(app.staticTexts["Mishran"].exists)
    }
}
