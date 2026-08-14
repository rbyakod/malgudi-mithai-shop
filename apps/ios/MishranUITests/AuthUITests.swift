// Task 15.2 (Mishran Mobile Apps v1): Sign in with Apple UI smoke test.
// Tapping the real SIWA sheet requires an Apple ID login — that half is a
// MANUAL check on a simulator/device. What we assert automatically: the
// button renders on the phone-entry screen with its accessibility label.
import XCTest

final class AuthUITests: XCTestCase {
    func testSignInWithAppleButtonExistsOnPhoneEntry() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-authScreen"]
        app.launch()

        let button = app.buttons["Sign in with Apple"]
        let other = app.otherElements["Sign in with Apple"]
        let exists = button.waitForExistence(timeout: 5) || other.waitForExistence(timeout: 2)
        XCTAssertTrue(
            exists,
            "Sign in with Apple button should render on the phone-entry screen"
        )
        XCTAssertTrue(app.staticTexts["Send code"].waitForExistence(timeout: 2) || app.buttons["Send code"].exists)
    }
}
