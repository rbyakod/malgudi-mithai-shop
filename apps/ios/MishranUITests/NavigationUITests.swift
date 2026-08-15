// Task 14.4 (Mishran Mobile Apps v1): navigation UI tests — push via tap,
// and the mishran:// deep link end-to-end through the app's onOpenURL.
import XCTest

final class NavigationUITests: XCTestCase {
    func testTapProductCardPushesDetail() throws {
        let app = XCUIApplication()
        // Seed the SwiftData catalog so the rail renders without a backend;
        // reset first so an earlier live-API run can't leak its rows in
        // (argument strings mirror the SeedData constants).
        app.launchArguments = ["-resetStore", "-seedCatalog", "-signedInOnce", "false"]
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

    /// P1: Shop-by-family chips seed the catalog tab's family filter (the
    /// iOS stand-in for Android's SavedStateHandle deep link).
    func testFamilyChipPushesFilteredCatalog() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-resetStore", "-seedCatalog", "-signedInOnce", "false"]
        app.launch()

        // Seed rows are "dryfruit" + "classic" — only the classic chip has
        // a count; tapping it must land on a catalog filtered to that family.
        let chip = app.buttons["Shop Classic"]
        XCTAssertTrue(chip.waitForExistence(timeout: 5), "family chips should render on home")
        chip.tap()

        XCTAssertTrue(app.navigationBars["Sweets"].waitForExistence(timeout: 5))
        // Kaju Katli (seeded "dryfruit") is filtered out; Motichoor Laddoo
        // (the classic row) remains.
        XCTAssertTrue(app.buttons["Motichoor Laddoo, ₹480/kg"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Kaju Katli, ₹720/kg"].exists, "family filter must hide other families")
    }
}
