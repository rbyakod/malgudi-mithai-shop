// Task 14.4 (Mishran Mobile Apps v1): navigation UI tests — push via tap,
// and the mishran:// deep link end-to-end through the app's onOpenURL.
import XCTest

final class NavigationUITests: XCTestCase {
    func testTapProductRowPushesDetail() throws {
        let app = XCUIApplication()
        app.launch()
        let row = app.staticTexts["Kaju Katli"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        row.tap()
        XCTAssertTrue(app.staticTexts["Product: kaju-katli"].waitForExistence(timeout: 5))
    }

    func testOrderDeepLinkOpensOrderDetail() throws {
        let app = XCUIApplication()
        app.launch()
        let url = try XCTUnwrap(URL(string: "mishran://order/ord_ui_1"))
        app.open(url)
        XCTAssertTrue(app.staticTexts["Order ord_ui_1"].waitForExistence(timeout: 5))
    }
}
