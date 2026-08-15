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
        // -AppleLanguages pins the English copy the assertions expect
        // (Task 20.3: the subtitle line is auth.phone.title /
        // auth.phone.subtitle; the wordmark is app.name).
        app.launchArguments = ["-signedInOnce", "true", "-AppleLanguages", "(en)"]
        app.launch()
        XCTAssertTrue(
            app.staticTexts["Enter your phone number"].waitForExistence(timeout: 5),
            "a revoked session must boot to the sign-in surface"
        )
        XCTAssertTrue(app.staticTexts["Mishran"].exists)
    }
}
