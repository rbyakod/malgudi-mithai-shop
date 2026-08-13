// Task 14.1 (Mishran Mobile Apps v1): boot smoke test — the app must render
// the wordmark. This was written BEFORE the Xcode project existed (TDD red
// step) and must pass on an iPhone SE (3rd generation) simulator.
import XCTest

final class MishranUITests: XCTestCase {
    func testAppBoots() throws {
        let app = XCUIApplication()
        app.launch()
        // The catalog is the home surface since the shell wiring landed.
        XCTAssertTrue(
            app.navigationBars["Sweets"].waitForExistence(timeout: 5),
            "App should boot to the catalog screen"
        )
    }
}
