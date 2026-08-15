// LiveApiUITests — Task 47 smoke: the app against the LIVE production API
// (https://mishran.pranavb.com/api/mobile/v1). Not part of the committed
// xctestplan's offline guarantees — run on demand:
//
//   xcodebuild test -project apps/ios/Mishran.xcodeproj -scheme Mishran \
//     -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation),OS=17.2' \
//     -only-testing:MishranUITests/LiveApiUITests
//
// Flow covered: catalog loads real products → search filters → product
// detail fetch by slug → quantity stepper → add to cart. The
// `-apiBaseURL` launch argument (MishranAPIClient.defaultBaseURL) points
// every default-constructed client at production; `-pushPermissionRequested`
// suppresses the once-per-install notification prompt so no system alert
// steals focus mid-test.
import XCTest

final class LiveApiUITests: XCTestCase {
    private static let liveBaseURL = "https://mishran.pranavb.com/api/mobile/v1"

    private func launchApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-apiBaseURL", Self.liveBaseURL,
            "-pushPermissionRequested", "true",
            "-signedInOnce", "false",
            // Pin the English copy the label assertions expect (Task 20.3
            // wired the search placeholder to catalog.search.placeholder).
            "-AppleLanguages", "(en)",
        ]
        app.launch()
        return app
    }

    func testCatalogSearchDetailAndCartAgainstLiveApi() throws {
        let app = launchApp()

        // 1. Home boots (P1 hero + rail), then the CTA pushes the catalog
        //    tab which loads the LIVE catalog (91 seeded products — far more
        //    than one screen, so search must work to reach a known product
        //    deterministically).
        let browse = app.buttons["Browse sweets"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10), "App should boot to the home hero")
        browse.tap()
        let navBar = app.navigationBars["Sweets"]
        XCTAssertTrue(navBar.waitForExistence(timeout: 10), "Hero CTA should push the catalog")

        // 2. Search narrows to a known live product (Gond laddu, scraped
        //    catalog). The saved-catalog error message must never appear.
        // The query matches on the placeholder prefix so wording tweaks to
        // catalog.search.placeholder can't break the lookup.
        let searchField = app.textFields.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Search sweets")
        ).firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 5), "Search bar should exist")
        searchField.tap()
        searchField.typeText("Gond")

        let card = app.staticTexts["Gond laddu"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), "Live catalog should surface Gond laddu")
        XCTAssertFalse(
            app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS %@", "saved sweets")
            ).firstMatch.exists,
            "Live fetch must succeed — no saved-catalog fallback"
        )

        // 3. Product detail — fetched by slug from the live API.
        card.tap()
        let price = app.staticTexts["₹1,109 / 1 kg"]
        XCTAssertTrue(price.waitForExistence(timeout: 10), "Detail should show the live price")

        // 4. Quantity stepper (default 1 → 2), then add to cart.
        let increment = app.buttons["Increase quantity"]
        XCTAssertTrue(increment.waitForExistence(timeout: 5), "Stepper should exist")
        increment.tap()
        let addToCart = app.buttons["Add to cart"]
        XCTAssertTrue(addToCart.waitForExistence(timeout: 5), "Add-to-cart button should exist")
        addToCart.tap()

        let added = app.staticTexts["Added to cart"]
        XCTAssertTrue(added.waitForExistence(timeout: 5), "Button should flip to Added")
    }
}
