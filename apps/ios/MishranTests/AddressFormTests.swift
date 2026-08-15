// AddressFormTests.swift — Task 48.2 (Mishran Mobile Apps v1).
// Pure validation rules for the add-address form (no rendering): the Save
// gate mirrors Android's dialog (line1/city/state non-blank + 6-digit
// pincode) and the input mapping trims + drops blank optionals.
import XCTest
@testable import Mishran

final class AddressFormTests: XCTestCase {
    private func validFixture() -> AddressForm {
        var form = AddressForm()
        form.line1 = "12 MG Road"
        form.city = "Bengaluru"
        form.state = "Karnataka"
        form.pincode = "560001"
        return form
    }

    // MARK: Save gate

    func testCompleteFormIsValid() {
        XCTAssertTrue(validFixture().isValid)
    }

    func testBlankRequiredFieldsAreInvalid() {
        for mutate: (inout AddressForm) -> Void in [
            { $0.line1 = "   " },
            { $0.line1 = "" },
            { $0.city = "" },
            { $0.state = " " },
        ] {
            var form = validFixture()
            mutate(&form)
            XCTAssertFalse(form.isValid, "blank required field must gate Save")
        }
    }

    func testPincodeMustBeExactlySixDigits() {
        for pincode in ["", "56000", "5600010", "5600a1", "560 01"] {
            var form = validFixture()
            form.pincode = pincode
            XCTAssertFalse(form.isValid, "pincode \(pincode.debugDescription) must be invalid")
        }
        XCTAssertTrue(AddressForm.pincodeIsValid("560001"))
        XCTAssertFalse(AddressForm.pincodeIsValid("56000"))
    }

    func testOptionalLine2DoesNotAffectValidity() {
        var form = validFixture()
        form.line2 = ""
        XCTAssertTrue(form.isValid)
        form.line2 = "Flat 3"
        XCTAssertTrue(form.isValid)
    }

    // MARK: input mapping

    func testInputTrimsAndDropsBlankLine2() throws {
        var form = validFixture()
        form.line1 = "  12 MG Road  "
        form.line2 = "   "
        form.tag = .work
        form.isDefault = true

        let input = form.input

        XCTAssertEqual(input.line1, "12 MG Road")
        XCTAssertNil(input.line2, "blank line2 must ride nothing")
        XCTAssertEqual(input.city, "Bengaluru")
        XCTAssertEqual(input.tag, .work)
        XCTAssertEqual(input.isDefault, true)
    }

    // MARK: default-first ordering (repository helper)

    func testDefaultFirstKeepsServerOrderAsTiebreak() {
        let a = AddressDTO(id: "a", customerId: nil, line1: "A", line2: nil, city: nil, state: nil,
                           pincode: nil, lat: nil, lng: nil, tag: nil, isDefault: nil)
        let b = AddressDTO(id: "b", customerId: nil, line1: "B", line2: nil, city: nil, state: nil,
                           pincode: nil, lat: nil, lng: nil, tag: nil, isDefault: true)
        let c = AddressDTO(id: "c", customerId: nil, line1: "C", line2: nil, city: nil, state: nil,
                           pincode: nil, lat: nil, lng: nil, tag: nil, isDefault: false)

        XCTAssertEqual(AddressRepository.defaultFirst([a, b, c]).map(\.id), ["b", "a", "c"])
        XCTAssertEqual(AddressRepository.defaultFirst([a, c]).map(\.id), ["a", "c"],
                       "no default → server order preserved")
    }
}
