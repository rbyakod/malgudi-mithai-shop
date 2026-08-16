// DeliveryCheckTests.swift — P3 parity (Mishran Mobile Apps v1).
// Pure formatting + persistence rules for the PDP's pincode delivery
// check: the field sanitizer (digits only, first 6), the 6-digit gate, the
// tier/day/result-line composition (labels resolve through L(), so the
// assertions compare against L()-built expectations — locale-agnostic),
// and the one-shot UserDefaults round trip (stored → restored → cleared;
// garbage never surfaces as a restored result).
import XCTest
@testable import Mishran

final class DeliveryCheckTests: XCTestCase {
    private let result = DeliveryCheckResult(
        pincode: "560001",
        tier: "fresh",
        city: "Bengaluru",
        slaDays: 1
    )

    // MARK: Formatting

    func testFormattedStripsNonDigitsAndCapsAtSix() {
        XCTAssertEqual(DeliveryCheckModel.formatted("560 0a2"), "56002")
        XCTAssertEqual(DeliveryCheckModel.formatted("560001239"), "560001", "only the first six digits ride")
        XCTAssertEqual(DeliveryCheckModel.formatted(""), "")
        XCTAssertEqual(DeliveryCheckModel.formatted("+91 98765 43210"), "919876")
    }

    func testIsValidRequiresExactlySixDigits() {
        XCTAssertTrue(DeliveryCheckModel.isValid("560001"))
        XCTAssertFalse(DeliveryCheckModel.isValid("56000"))
        XCTAssertFalse(DeliveryCheckModel.isValid("5600012"))
        XCTAssertFalse(DeliveryCheckModel.isValid("56000a"))
    }

    func testTierLabelFreshVsShelf() {
        XCTAssertEqual(DeliveryCheckModel.tierLabel("fresh"), L("product.delivery.tier_fresh"))
        XCTAssertEqual(DeliveryCheckModel.tierLabel("shelf"), L("product.delivery.tier_shelf"))
        XCTAssertEqual(DeliveryCheckModel.tierLabel("mystery"), L("product.delivery.tier_shelf"), "unknown tiers read as Shelf")
    }

    func testDaysLabelFreshIsSameDayAndShelfCounts() {
        XCTAssertEqual(DeliveryCheckModel.daysLabel(tier: "fresh", slaDays: 3), L("product.delivery.same_day"), "fresh ignores the SLA count")
        XCTAssertEqual(DeliveryCheckModel.daysLabel(tier: "shelf", slaDays: 1), "1 day")
        XCTAssertEqual(DeliveryCheckModel.daysLabel(tier: "shelf", slaDays: 4), "4 days")
    }

    func testResultLineComposesCityTierDays() {
        let expected = L(
            "product.delivery.result",
            "Bengaluru",
            L("product.delivery.tier_fresh"),
            L("product.delivery.same_day")
        )
        XCTAssertEqual(DeliveryCheckModel.resultLine(result), expected)
    }

    // MARK: Persistence

    private var suiteName: String { "delivery-check-tests-\(UUID().uuidString)" }

    func testStoreThenRestoreRoundTripsAndClears() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        XCTAssertNil(DeliveryCheckModel.storedResult(from: defaults), "nothing stored → nil")

        DeliveryCheckModel.store(result, in: defaults)
        XCTAssertEqual(DeliveryCheckModel.storedResult(from: defaults), result)

        DeliveryCheckModel.clearStorage(in: defaults)
        XCTAssertNil(DeliveryCheckModel.storedResult(from: defaults), "cleared → nil")
    }

    func testStoredResultRejectsGarbageAndUnserviceableShapes() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        // Undecodable bytes.
        defaults.set(Data("not json".utf8), forKey: DeliveryCheckModel.storageKey)
        XCTAssertNil(DeliveryCheckModel.storedResult(from: defaults))

        // A result whose pincode/city fail the sanity checks never restores.
        let badPin = DeliveryCheckResult(pincode: "5600", tier: "fresh", city: "Bengaluru", slaDays: 1)
        DeliveryCheckModel.store(badPin, in: defaults)
        XCTAssertNil(DeliveryCheckModel.storedResult(from: defaults), "invalid pincode → nil, not a broken chip")

        let noCity = DeliveryCheckResult(pincode: "560001", tier: "fresh", city: "", slaDays: 1)
        DeliveryCheckModel.store(noCity, in: defaults)
        XCTAssertNil(DeliveryCheckModel.storedResult(from: defaults), "empty city → nil")
    }

    @MainActor
    func testModelRestoresStoredResultOnInit() throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        DeliveryCheckModel.store(result, in: defaults)

        let model = DeliveryCheckModel(
            client: MishranAPIClient(baseURL: URL(string: "https://api.test")!),
            defaults: defaults
        )

        XCTAssertEqual(model.phase, .ok(result), "a saved result renders immediately, no refetch")
        XCTAssertEqual(model.pincode, "560001")
    }
}
