// GiftFormTests.swift — P3 parity (Mishran Mobile Apps v1).
// Pure validation + request mapping for the gift-box builder (EnquiryForm
// pattern — no rendering): the submit gate (name required, email REQUIRED
// + well-formed), the payload's exact key set (occasion/boxSize/budget/
// date always, city/dietary/message only when non-blank), the verbatim
// picker vocabularies, and the LeadInputDTO encoding (type literal
// "gift-builder-draft", nested contact, ios-app source).
import XCTest
@testable import Mishran

final class GiftFormTests: XCTestCase {
    private func validFixture() -> GiftForm {
        var form = GiftForm()
        form.name = "Meera Rao"
        form.email = "meera@example.com"
        form.phone = "+919876543210"
        form.city = "Bengaluru"
        form.dietary = "No khoya, one sugar-free option"
        form.message = "Happy Diwali, Ajjí!"
        return form
    }

    // MARK: Submit gate

    func testCompleteFormIsValid() {
        XCTAssertTrue(validFixture().isValid)
    }

    func testBlankNameGatesSubmit() {
        var form = validFixture()
        form.name = "   "
        XCTAssertFalse(form.isValid)
    }

    func testEmailRequiredAndValidated() {
        var form = validFixture()
        form.email = ""
        XCTAssertFalse(form.isValid, "blank email must gate Submit — the route 400s it")

        for email in ["not-an-email", "a@b", "meera example.com"] {
            form.email = email
            XCTAssertFalse(form.isValid, "malformed email \(email.debugDescription) must gate Submit")
        }
    }

    func testPhoneCityAndNotesStayOptional() {
        var form = validFixture()
        form.phone = ""
        form.city = ""
        form.dietary = ""
        form.message = ""
        XCTAssertTrue(form.isValid)
    }

    // MARK: Picker vocabularies (web configurator's verbatim options)

    func testOptionVocabulariesAreVerbatim() {
        XCTAssertEqual(GiftFormOptions.occasions, ["Diwali", "Wedding", "Corporate", "Birthday", "Housewarming", "Other"])
        XCTAssertEqual(GiftFormOptions.boxSizes, ["4-piece", "8-piece", "16-piece", "Custom"])
        XCTAssertEqual(GiftFormOptions.budgets, ["Under ₹1,000", "₹1,000-₹2,500", "₹2,500-₹5,000", "₹5,000+"])
    }

    // MARK: Request mapping

    func testInputCarriesGiftBuilderDraftTypeAndIosSource() {
        let input = validFixture().input

        XCTAssertEqual(input.type, "gift-builder-draft")
        XCTAssertEqual(input.source, "ios-app")
        XCTAssertEqual(input.contact.name, "Meera Rao")
        XCTAssertEqual(input.contact.email, "meera@example.com")
        XCTAssertEqual(input.contact.phone, "+919876543210")
        XCTAssertNil(input.contact.company, "the gift builder has no company field")
    }

    func testPayloadAlwaysRidesPickersAndDateAndOmitsBlankNotes() {
        var form = validFixture()
        form.occasion = "Wedding"
        form.boxSize = "16-piece"
        form.budget = "₹5,000+"
        form.city = ""
        form.dietary = ""
        form.message = ""

        let payload = form.payload

        XCTAssertEqual(payload["occasion"], .string("Wedding"))
        XCTAssertEqual(payload["boxSize"], .string("16-piece"))
        XCTAssertEqual(payload["budget"], .string("₹5,000+"))
        XCTAssertEqual(payload["date"], .string(EnquiryForm.dayString(form.neededBy)))
        XCTAssertNil(payload["city"], "blank city rides nothing")
        XCTAssertNil(payload["dietary"], "blank dietary rides nothing")
        XCTAssertNil(payload["message"], "blank message rides nothing")
    }

    func testBlankPhoneRidesNothing() {
        var form = validFixture()
        form.phone = "   "

        XCTAssertNil(form.input.contact.phone, "blank phone must be omitted from contact")
    }

    // MARK: Encoding

    func testEncodesGiftLeadShape() throws {
        let data = try JSONEncoder().encode(validFixture().input)
        let object = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["type"] as? String, "gift-builder-draft")
        XCTAssertEqual(object["source"] as? String, "ios-app")
        let contact = try XCTUnwrap(object["contact"] as? [String: Any])
        XCTAssertEqual(contact["name"] as? String, "Meera Rao")
        XCTAssertEqual(contact["email"] as? String, "meera@example.com")
        XCTAssertEqual(contact["phone"] as? String, "+919876543210")
        XCTAssertNil(contact["company"])
        XCTAssertNil(contact["GSTIN"])
        let payload = try XCTUnwrap(object["payload"] as? [String: Any])
        XCTAssertEqual(payload["occasion"] as? String, "Diwali", "pickers ride their verbatim labels")
        XCTAssertEqual(payload["boxSize"] as? String, "4-piece")
        XCTAssertEqual(payload["budget"] as? String, "Under ₹1,000")
        XCTAssertEqual(payload["city"] as? String, "Bengaluru")
        XCTAssertEqual(payload["dietary"] as? String, "No khoya, one sugar-free option")
        XCTAssertEqual(payload["message"] as? String, "Happy Diwali, Ajjí!")
        XCTAssertNotNil(payload["date"] as? String, "the needed-by date always rides")
    }
}
