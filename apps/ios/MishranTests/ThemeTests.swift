// Task 14.2 (Mishran Mobile Apps v1): brand tokens + theme tests.
// Pins the Swift codegen surface (Color.mishran* extensions — the Phase 0
// contract, not the plan sketch's MishranBrand enum) and the theme modifier.
// Colors are resolved through UIColor so the assertion checks actual
// component values, not just symbol existence.
import XCTest
import SwiftUI
@testable import Mishran

final class ThemeTests: XCTestCase {
    private func components(of color: Color) -> (red: CGFloat, green: CGFloat, blue: CGFloat, alpha: CGFloat) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (r, g, b, a)
    }

    private func assertColor(_ color: Color, r: Double, g: Double, b: Double, file: StaticString = #filePath, line: UInt = #line) {
        let c = components(of: color)
        XCTAssertEqual(Double(c.red), r, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(Double(c.green), g, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(Double(c.blue), b, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(Double(c.alpha), 1.0, accuracy: 0.001, file: file, line: line)
    }

    func testBrandAccentMatchesToken() {
        // tokens.json: brand.accent #9b4d2a
        assertColor(.mishranBrandAccent, r: 0.6078, g: 0.3020, b: 0.1647)
    }

    func testBrandInkMatchesToken() {
        // tokens.json: brand.ink #2c1810
        assertColor(.mishranBrandInk, r: 0.1725, g: 0.0941, b: 0.0627)
    }

    func testBrandCanvasMatchesToken() {
        // tokens.json: brand.canvas #f7efe0
        assertColor(.mishranBrandCanvas, r: 0.9686, g: 0.9373, b: 0.8784)
    }

    func testStateColorsMatchTokens() {
        assertColor(.mishranStateSuccess, r: 0.1765, g: 0.4157, b: 0.3098) // #2d6a4f
        assertColor(.mishranStateError, r: 0.6157, g: 0.1098, b: 0.1098)   // #9d1c1c
    }

    func testSpacingAndRadiusConstants() {
        XCTAssertEqual(CGFloat.mishranSpacingMd, 16)
        XCTAssertEqual(CGFloat.mishranSpacingXxl, 48)
        XCTAssertEqual(CGFloat.mishranRadiusXl, 20)
    }

    @MainActor
    func testThemeModifierAppliesBrandDefaults() {
        // The modifier must exist and compose — render a themed view through
        // ImageRenderer so a crash/typo in the modifier body fails the test.
        let view = Text("Mishran").mishranTheme()
        let renderer = ImageRenderer(content: view)
        XCTAssertNotNil(renderer.uiImage)
    }
}
