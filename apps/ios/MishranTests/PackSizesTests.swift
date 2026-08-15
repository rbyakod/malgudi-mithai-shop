// PackSizesTests.swift — P1 parity (Mishran Mobile Apps v1).
// Table tests for the verbatim port of lib/mithai/packSizes.ts (the single
// source of truth): parser edge cases, the ladder selector with its verbatim
// base rung, en-IN lakh grouping, and the single-chip fallbacks.
import XCTest
@testable import Mishran

final class PackSizesTests: XCTestCase {
    // MARK: parseGrams

    func testParseGramsAcceptsUnitSpellings() {
        XCTAssertEqual(PackSizes.parseGrams("1 kg"), 1000)
        XCTAssertEqual(PackSizes.parseGrams("1kg"), 1000)
        XCTAssertEqual(PackSizes.parseGrams("1 Kg"), 1000, "unit matching is case-insensitive")
        XCTAssertEqual(PackSizes.parseGrams("1 KG"), 1000)
        XCTAssertEqual(PackSizes.parseGrams("250g"), 250)
        XCTAssertEqual(PackSizes.parseGrams("250 g"), 250)
        XCTAssertEqual(PackSizes.parseGrams("480 gm"), 480)
        XCTAssertEqual(PackSizes.parseGrams("700 grams"), 700)
        XCTAssertEqual(PackSizes.parseGrams("700 gram"), 700)
        XCTAssertEqual(PackSizes.parseGrams("0.5 kg"), 500)
        XCTAssertEqual(PackSizes.parseGrams(" 500g "), 500, "leading/trailing whitespace tolerated")
    }

    func testParseGramsRejectsNonWeightUnits() {
        XCTAssertNil(PackSizes.parseGrams("pack"))
        XCTAssertNil(PackSizes.parseGrams("250 ml"))
        XCTAssertNil(PackSizes.parseGrams("12x250g"))
        XCTAssertNil(PackSizes.parseGrams("g"))
        XCTAssertNil(PackSizes.parseGrams(""))
        XCTAssertNil(PackSizes.parseGrams("250 g extra"))
    }

    // MARK: parsePrice

    func testParsePriceReadsLeadingRupeeFigure() {
        XCTAssertEqual(PackSizes.parsePrice("₹920 / 250g") ?? 0, 920, accuracy: 0.001)
        XCTAssertEqual(PackSizes.parsePrice("₹1,084 / 500g") ?? 0, 1084, accuracy: 0.001)
        XCTAssertEqual(PackSizes.parsePrice("₹ 1,084 / 500g") ?? 0, 1084, accuracy: 0.001)
        XCTAssertEqual(PackSizes.parsePrice("₹455") ?? 0, 455, accuracy: 0.001)
        XCTAssertEqual(PackSizes.parsePrice("₹45.50") ?? 0, 45.5, accuracy: 0.001)
    }

    func testParsePriceRejectsNonNumericFigures() {
        XCTAssertNil(PackSizes.parsePrice("₹ on request / pack"))
        XCTAssertNil(PackSizes.parsePrice("on request"))
        XCTAssertNil(PackSizes.parsePrice(""))
    }

    // MARK: round10 + lakh grouping

    func testRound10RoundsToNearestTen() {
        XCTAssertEqual(PackSizes.round10(542), 540)
        XCTAssertEqual(PackSizes.round10(545), 550)
        XCTAssertEqual(PackSizes.round10(554.5), 550, "half away from zero, like JS Math.round")
        XCTAssertEqual(PackSizes.round10(277.25), 280)
        XCTAssertEqual(PackSizes.round10(0), 0)
    }

    func testFormatRupeesUsesEnINLakhGrouping() {
        XCTAssertEqual(PackSizes.formatRupees(1084), "₹1,084")
        XCTAssertEqual(PackSizes.formatRupees(108432), "₹1,08,432", "lakh grouping, not western")
        XCTAssertEqual(PackSizes.formatRupees(920), "₹920")
        XCTAssertEqual(PackSizes.formatRupees(10843.2), "₹10,843", "rounds before grouping")
    }

    // MARK: labelFor

    func testLabelForWholeKilosSpellKg() {
        XCTAssertEqual(PackSizes.labelFor(grams: 250), "250g")
        XCTAssertEqual(PackSizes.labelFor(grams: 500), "500g")
        XCTAssertEqual(PackSizes.labelFor(grams: 1000), "1 kg")
    }

    // MARK: derivePackSizes — full ladder selector

    func testLadderBaseDerivesFullSelectorWithVerbatimBase() {
        let options = PackSizes.derivePackSizes(displayPrice: "₹920 / 250g", weight: nil)
        XCTAssertEqual(options.map(\.label), ["250g", "500g", "1 kg"])
        XCTAssertEqual(options[0].priceLabel, "₹920 / 250g", "base rung keeps displayPrice verbatim")
        XCTAssertEqual(options[0].grams, 250)
        XCTAssertEqual(options[1].priceLabel, "₹1,840 / 500g")
        XCTAssertEqual(options[2].priceLabel, "₹3,680 / 1 kg")
    }

    func testMidLadderBaseScalesBothDirections() {
        let options = PackSizes.derivePackSizes(displayPrice: "₹1,084 / 500g", weight: nil)
        XCTAssertEqual(options.map(\.label), ["250g", "500g", "1 kg"])
        XCTAssertEqual(options[0].priceLabel, "₹540 / 250g", "round10(1084/2)=540")
        XCTAssertEqual(options[1].priceLabel, "₹1,084 / 500g")
        XCTAssertEqual(options[2].priceLabel, "₹2,170 / 1 kg", "round10(2168)=2170")
    }

    func testKilogramBaseKeepsCommaGroupingAndLakhDerivedPrices() {
        // Live-catalog shape ("Gond laddu"): 27108/250g → 1kg rung 108432,
        // then round10 snaps it to 108430 — lakh grouping survives the snap.
        let options = PackSizes.derivePackSizes(displayPrice: "₹27,108 / 250g", weight: nil)
        XCTAssertEqual(options[2].priceLabel, "₹1,08,430 / 1 kg", "en-IN lakh grouping on derived rungs")

        let gond = PackSizes.derivePackSizes(displayPrice: "₹1,109 / 1 kg", weight: nil)
        XCTAssertEqual(gond.map(\.label), ["250g", "500g", "1 kg"])
        XCTAssertEqual(gond[0].priceLabel, "₹280 / 250g", "round10(277.25)=280")
        XCTAssertEqual(gond[1].priceLabel, "₹550 / 500g", "round10(554.5)=550")
        XCTAssertEqual(gond[2].priceLabel, "₹1,109 / 1 kg")
    }

    // MARK: derivePackSizes — fallbacks

    func testOffLadderBaseFallsBackToSingleChip() {
        // Price unit wins over the (disagreeing) weight field — but the
        // single fallback chip shows the WEIGHT label when present.
        let withWeight = PackSizes.derivePackSizes(displayPrice: "₹399 / 700g", weight: "130g")
        XCTAssertEqual(withWeight, [PackSize(label: "130g", priceLabel: "₹399 / 700g")])

        let noWeight = PackSizes.derivePackSizes(displayPrice: "₹399 / 700g", weight: nil)
        XCTAssertEqual(noWeight, [PackSize(label: "700g", priceLabel: "₹399 / 700g")])
    }

    func testBarePriceFallsBackToWeightChipThenNothing() {
        XCTAssertEqual(
            PackSizes.derivePackSizes(displayPrice: "₹455", weight: "250 g"),
            [PackSize(label: "250 g", priceLabel: "₹455")]
        )
        XCTAssertEqual(PackSizes.derivePackSizes(displayPrice: "₹455", weight: nil), [])
        XCTAssertEqual(PackSizes.derivePackSizes(displayPrice: "₹455", weight: "  "), [])
    }

    func testOnRequestPriceRendersUnitChipOrNothing() {
        XCTAssertEqual(
            PackSizes.derivePackSizes(displayPrice: "₹ on request / pack", weight: nil),
            [PackSize(label: "pack", priceLabel: "₹ on request / pack")]
        )
        XCTAssertEqual(PackSizes.derivePackSizes(displayPrice: "₹ on request", weight: nil), [])
        XCTAssertEqual(PackSizes.derivePackSizes(displayPrice: nil, weight: "250g"), [])
        XCTAssertEqual(PackSizes.derivePackSizes(displayPrice: "", weight: "250g"), [])
    }
}
