// Task 15.2 (Mishran Mobile Apps v1): Sign in with Apple UI smoke test.
// Tapping the real SIWA sheet requires an Apple ID login — that half is a
// MANUAL check on a simulator/device. What we assert automatically: the
// button renders on the phone-entry screen with its accessibility label.
import XCTest

final class AuthUITests: XCTestCase {
    func testSignInWithAppleButtonExistsOnPhoneEntry() throws {
        let app = XCUIApplication()
        // -AppleLanguages pins the English copy the assertion expects
        // (Task 20.3 wired the CTA to auth.phone.cta = "Send OTP").
        app.launchArguments = ["-authScreen", "-AppleLanguages", "(en)"]
        app.launch()

        let button = app.buttons["Sign in with Apple"]
        let other = app.otherElements["Sign in with Apple"]
        let exists = button.waitForExistence(timeout: 5) || other.waitForExistence(timeout: 2)
        XCTAssertTrue(
            exists,
            "Sign in with Apple button should render on the phone-entry screen"
        )
        XCTAssertTrue(app.staticTexts["Send OTP"].waitForExistence(timeout: 2) || app.buttons["Send OTP"].exists)
    }
}
