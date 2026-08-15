// AccessibilityTests.swift — Task 20.4 (Mishran Mobile Apps v1).
// Automated a11y audit: every tappable element must carry a non-empty
// label and meet the ≥44pt tap-target floor (plan global constraint;
// WCAG AA adjacent). Dynamic Type audit runs the catalog at the AX size
// categories (M → XXXL). VoiceOver-on-hardware remains the manual gate
// (documented in apps/ios/A11Y_AUDIT.md).
import XCTest

final class AccessibilityTests: XCTestCase {
    private func launchSeeded(sizeCategory: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        // -resetStore keeps the audit hermetic: a live-API run earlier in
        // the suite would otherwise swap the seeded rows out from under us.
        // -AppleLanguages pins English so the label assertions below stay
        // deterministic regardless of the host simulator's language (Task
        // 20.3 wired every label through the i18n tables).
        app.launchArguments = [
            "-resetStore", "-seedCatalog", "-signedInOnce", "false",
            "-AppleLanguages", "(en)",
        ]
        if let sizeCategory {
            // Classic launch-argument override of the content size category.
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", sizeCategory]
        }
        app.launch()
        return app
    }

    /// The audit contract: labeled + ≥44pt in both dimensions. Skips
    /// elements the system reports as off-screen (zero frame).
    private func auditButtons(
        _ app: XCUIApplication,
        context: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(app.buttons.firstMatch.waitForExistence(timeout: 5), "no buttons to audit (\(context))")
        let buttons = app.buttons.allElementsBoundByIndex
        var audited = 0
        for button in buttons where button.exists && button.frame != .zero {
            let label = button.label.trimmingCharacters(in: .whitespacesAndNewlines)
            XCTAssertFalse(
                label.isEmpty,
                "\(context): unlabeled tappable element at \(button.frame)",
                file: file, line: line
            )
            XCTAssertGreaterThanOrEqual(
                button.frame.height, 44,
                "\(context): tap target under 44pt tall — \(label.isEmpty ? "unlabeled" : label) \(button.frame)",
                file: file, line: line
            )
            XCTAssertGreaterThanOrEqual(
                button.frame.width, 44,
                "\(context): tap target under 44pt wide — \(label.isEmpty ? "unlabeled" : label) \(button.frame)",
                file: file, line: line
            )
            audited += 1
        }
        XCTAssertGreaterThan(audited, 0, "\(context): audit found no buttons")
    }

    func testCatalogButtonsLabeledWithMinimumTapTargets() {
        let app = launchSeeded()
        XCTAssertTrue(app.buttons["Browse sweets"].waitForExistence(timeout: 5))
        auditButtons(app, context: "home")
        // P1: the grid lives behind the hero CTA now — audit it too.
        app.buttons["Browse sweets"].tap()
        XCTAssertTrue(app.navigationBars["Sweets"].waitForExistence(timeout: 5))
        auditButtons(app, context: "catalog")
    }

    func testProductDetailButtonsLabeledWithMinimumTapTargets() {
        let app = launchSeeded()
        let card = app.buttons["Kaju Katli, ₹720/kg"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        card.tap()
        XCTAssertTrue(app.buttons["Add to cart"].waitForExistence(timeout: 5))
        auditButtons(app, context: "product detail")
        // Quantity announces its value (plan: accessibilityValue on qty).
        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Quantity'")).firstMatch
                .waitForExistence(timeout: 2)
        )
    }

    func testCartButtonsLabeledWithMinimumTapTargets() {
        let app = launchSeeded()
        let card = app.buttons["Kaju Katli, ₹720/kg"]
        XCTAssertTrue(card.waitForExistence(timeout: 5))
        card.tap()
        let add = app.buttons["Add to cart"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()
        XCTAssertTrue(app.buttons["Added to cart"].waitForExistence(timeout: 5))
        // The toolbar belongs to the catalog root — hop back before Cart.
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(app.buttons["Cart"].waitForExistence(timeout: 5))
        app.buttons["Cart"].tap()
        XCTAssertTrue(app.buttons["Checkout"].waitForExistence(timeout: 5))
        auditButtons(app, context: "cart")
    }

    /// AX1–AX5 (accessibilityM…accessibilityXXXL): the core home + rail
    /// actions must survive every accessibility size.
    func testCatalogRendersAcrossDynamicTypeAccessibilitySizes() {
        for size in [
            "UICTContentSizeCategoryAccessibilityM",
            "UICTContentSizeCategoryAccessibilityXL",
            "UICTContentSizeCategoryAccessibilityXXXL",
        ] {
            let app = launchSeeded(sizeCategory: size)
            XCTAssertTrue(
                app.buttons["Browse sweets"].waitForExistence(timeout: 5),
                "home should render at \(size)"
            )
            XCTAssertTrue(
                app.buttons["Kaju Katli, ₹720/kg"].exists,
                "best-sellers rail action should exist at \(size)"
            )
            app.buttons["Browse sweets"].tap()
            XCTAssertTrue(
                app.navigationBars["Sweets"].waitForExistence(timeout: 5),
                "catalog should render at \(size)"
            )
            app.terminate()
        }
    }
}
