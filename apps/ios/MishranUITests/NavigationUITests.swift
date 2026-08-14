// Task 14.4 (Mishran Mobile Apps v1): navigation UI tests — push via tap,
// and the mishran:// deep link end-to-end through the app's onOpenURL.
import XCTest

final class NavigationUITests: XCTestCase {
    func testTapProductCardPushesDetail() throws {
        let app = XCUIApplication()
        // Seed the SwiftData catalog so the grid renders without a backend
        // (argument string mirrors SeedData.seedCatalogArgument).
        app.launchArguments = ["-seedCatalog", "-signedInOnce", "false"]
        app.launch()
        // ProductCard surfaces "name, price" as the button's accessibility
        // label (not a static text), so query buttons.
        let card = app.buttons["Kaju Katli, ₹720/kg"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        card.tap()
        XCTAssertTrue(
            app.buttons["Add to cart"].waitForExistence(timeout: 5),
            "Product detail should offer Add to cart"
        )
    }

    func testOrderDeepLinkOpensOrderDetail() throws {
        let app = XCUIApplication()
        // Same argument-domain override as the other home-expecting tests.
        app.launchArguments = ["-signedInOnce", "false"]
        app.launch()
        let url = try XCTUnwrap(URL(string: "mishran://order/ord_ui_1"))
        app.open(url)
        XCTAssertTrue(app.staticTexts["Order ord_ui_1"].waitForExistence(timeout: 5))
    }
}
