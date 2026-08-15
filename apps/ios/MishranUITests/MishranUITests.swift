// Task 14.1 (Mishran Mobile Apps v1): boot smoke test — the app must render
// the wordmark. This was written BEFORE the Xcode project existed (TDD red
// step) and must pass on an iPhone SE (3rd generation) simulator.
import XCTest

final class MishranUITests: XCTestCase {
    func testAppBoots() throws {
        let app = XCUIApplication()
        // Argument-domain override: even if a leftover persistent
        // "signed in once" flag exists, this launch must land on the home
        // surface (the Task 20.5 sign-in gate must only trip when a session
        // really died, never on a pristine boot).
        app.launchArguments = ["-signedInOnce", "false"]
        app.launch()
        // P1: home restructured to the Android shape (hero + best-sellers
        // rail + family chips); the catalog grid is one push away.
        XCTAssertTrue(
            app.buttons["Browse sweets"].waitForExistence(timeout: 5),
            "App should boot to the home hero"
        )
        XCTAssertTrue(app.staticTexts["Best sellers"].exists)
        XCTAssertTrue(app.buttons["Your orders"].exists)
    }
}
