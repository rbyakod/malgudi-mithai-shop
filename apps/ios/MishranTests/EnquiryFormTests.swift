// EnquiryFormTests.swift — P2 (Mishran Mobile Apps v1).
// Pure validation + request mapping for the Bulk & events form (AddressForm
// pattern — no rendering): the submit gate (name/phone/message required,
// email well-formed when present), the per-type payload extras, and the
// LeadInputDTO encoding (nested contact, nil optionals omitted). Plus the
// submitLead transport contract: the /api/leads route is PUBLIC, sits at
// the site root (outside /api/mobile/v1), and answers BARE JSON.
import XCTest
@testable import Mishran

final class EnquiryFormTests: XCTestCase {
    private func validFixture(type: EnquiryType = .wedding) -> EnquiryForm {
        var form = EnquiryForm()
        form.type = type
        form.name = "Meera Rao"
        form.phone = "+919876543210"
        form.email = "meera@example.com"
        form.message = "300 boxes of kaju katli for a November wedding."
        return form
    }

    // MARK: Submit gate

    func testCompleteFormIsValid() {
        XCTAssertTrue(validFixture().isValid)
        XCTAssertTrue(validFixture(type: .corporate).isValid)
    }

    func testBlankRequiredFieldsAreInvalid() {
        for mutate: (inout EnquiryForm) -> Void in [
            { $0.name = "   " },
            { $0.name = "" },
            { $0.phone = "" },
            { $0.phone = "  " },
            { $0.message = "" },
        ] {
            var form = validFixture()
            mutate(&form)
            XCTAssertFalse(form.isValid, "blank required field must gate Submit")
        }
    }

    func testEmailOptionalButValidatedWhenPresent() {
        var form = validFixture()
        form.email = ""
        XCTAssertTrue(form.isValid, "blank email passes the client gate")

        for email in ["not-an-email", "a@b", "a b@example.com", "@example.com"] {
            form.email = email
            XCTAssertFalse(form.isValid, "malformed email \(email.debugDescription) must gate Submit")
        }
        form.email = "meera.raa@example.co.in"
        XCTAssertTrue(form.isValid)
    }

    func testEmailValidationRegex() {
        XCTAssertTrue(EnquiryForm.emailIsValid("a@b.co"))
        XCTAssertTrue(EnquiryForm.emailIsValid("  a@b.co  "), "surrounding whitespace is trimmed")
        XCTAssertFalse(EnquiryForm.emailIsValid(""))
        XCTAssertFalse(EnquiryForm.emailIsValid("a@b"))
        XCTAssertFalse(EnquiryForm.emailIsValid("a b@c.com"))
    }

    // MARK: Request mapping

    func testWeddingInputNestsContactAndRidesExtrasInPayload() throws {
        var form = validFixture()
        form.city = "Mysuru  "
        form.guests = "300"

        let input = form.input

        XCTAssertEqual(input.type, "wedding")
        XCTAssertEqual(input.contact.name, "Meera Rao")
        XCTAssertEqual(input.contact.email, "meera@example.com")
        XCTAssertEqual(input.contact.phone, "+919876543210")
        XCTAssertNil(input.contact.company, "blank company rides nothing")
        XCTAssertEqual(input.source, "ios-app")
        XCTAssertEqual(input.payload["city"], "Mysuru", "extras are trimmed")
        XCTAssertEqual(input.payload["guests"], "300")
        XCTAssertNotNil(input.payload["eventDate"], "the DatePicker always carries a date")
        XCTAssertEqual(input.payload["message"], form.message)
        XCTAssertNil(input.payload["quantity"], "corporate-only extra never rides a wedding lead")
    }

    func testCorporateInputCarriesCompanyAndNeededBy() throws {
        var form = validFixture(type: .corporate)
        form.company = "Vertex Labs"
        form.quantity = "500"
        form.email = ""

        let input = form.input

        XCTAssertEqual(input.type, "corporate")
        XCTAssertEqual(input.contact.company, "Vertex Labs")
        XCTAssertNil(input.contact.email, "blank email rides nothing")
        XCTAssertEqual(input.payload["quantity"], "500")
        XCTAssertNotNil(input.payload["neededBy"])
        XCTAssertNil(input.payload["eventDate"], "wedding-only extra never rides a corporate lead")
    }

    func testLeadInputEncodesNestedContactAndOmitsBlankOptionals() throws {
        var form = validFixture(type: .corporate)
        form.company = ""
        form.email = ""

        let data = try JSONEncoder().encode(form.input)
        let object = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )

        XCTAssertEqual(object["type"] as? String, "corporate")
        XCTAssertEqual(object["source"] as? String, "ios-app")
        let contact = try XCTUnwrap(object["contact"] as? [String: Any])
        XCTAssertEqual(contact["name"] as? String, "Meera Rao")
        XCTAssertEqual(contact["phone"] as? String, "+919876543210")
        XCTAssertNil(contact["email"], "blank email must be omitted")
        XCTAssertNil(contact["company"], "blank company must be omitted")
        let payload = try XCTUnwrap(object["payload"] as? [String: Any])
        XCTAssertEqual(payload["message"] as? String, form.message)
    }

    func testLeadResponseDecodesBareJSON() throws {
        // No {data} envelope on this route — decode must work on the bare body.
        let response = try JSONDecoder().decode(
            LeadResponseDTO.self,
            from: Data(#"{"leadId":"lead_42","message":"Lead received. We'll be in touch."}"#.utf8)
        )
        XCTAssertEqual(response.leadId, "lead_42")
        XCTAssertEqual(response.message, "Lead received. We'll be in touch.")
    }

    // MARK: Transport (public root-level route, bare response)

    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    private func makeClient() -> MishranAPIClient {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        return MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: baseURL),
            retryDelay: 0
        )
    }

    func testSubmitLeadWalksUpToSiteRootAndDecodesBareResponse() async throws {
        MockURLProtocol.routes["leads"] = (
            201, [:], Data(#"{"leadId":"lead_42","message":"Lead received. We'll be in touch."}"#.utf8)
        )
        let client = makeClient()

        let response = try await client.submitLead(validFixture().input)

        XCTAssertEqual(response.leadId, "lead_42")
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["leads"])
        XCTAssertEqual(
            request.url?.absoluteString, "https://api.test/api/leads",
            "/api/leads sits outside the mobile v1 base — the URL walks two segments up"
        )
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"), nil,
            "the leads route is public — no bearer, no refresh loop"
        )
        let body = try XCTUnwrap(MockURLProtocol.body(of: request))
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertNotNil(object["contact"], "the request body nests the contact fields")
    }
}
