// Task 14.4 (Mishran Mobile Apps v1): navigation UI tests — push via tap,
// and the mishran:// deep link end-to-end through the app's onOpenURL.
import XCTest

final class NavigationUITests: XCTestCase {
    func testTapProductCardPushesDetail() throws {
        let app = XCUIApplication()
        // Seed the SwiftData catalog so the rail renders without a backend;
        // reset first so an earlier live-API run can't leak its rows in
        // (argument strings mirror the SeedData constants). -AppleLanguages
        // pins the English labels these assertions expect (Task 20.3 i18n).
        app.launchArguments = [
            "-resetStore", "-seedCatalog", "-signedInOnce", "false",
            "-AppleLanguages", "(en)",
        ]
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
        app.launchArguments = ["-signedInOnce", "false", "-AppleLanguages", "(en)"]
        app.launch()
        let url = try XCTUnwrap(URL(string: "mishran://order/ord_ui_1"))
        app.open(url)
        XCTAssertTrue(app.staticTexts["Order ord_ui_1"].waitForExistence(timeout: 5))
    }

    /// P2: the Shop-by-vertical portals open the catalog with the vertical's
    /// tab preselected (the family-chip seam's successor — family filtering
    /// still lives in the catalog's filter sheet, covered by unit tests).
    func testVerticalPortalPushesCatalogTab() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-resetStore", "-seedCatalog", "-signedInOnce", "false",
            "-AppleLanguages", "(en)",
        ]
        app.launch()

        // The Mithai portal is deterministic offline: seeded catalog rows
        // back its card, and the tab is the existing products grid.
        let portal = app.buttons["Shop Mithai"]
        XCTAssertTrue(portal.waitForExistence(timeout: 5), "vertical portals should render on home")
        portal.tap()

        XCTAssertTrue(app.navigationBars["Sweets"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Kaju Katli, ₹720/kg"].waitForExistence(timeout: 5))
        // The segmented vertical header rides above the grid.
        XCTAssertTrue(app.buttons["Snacks"].exists, "catalog offers the vertical tabs")
    }
}
