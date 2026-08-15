// AddressRepositoryTests.swift — Task 48.2 (Mishran Mobile Apps v1).
// Addresses CRUD over the shared URLProtocol mock (APIClientTests'
// MockURLProtocol): envelope decoding, default-first ordering, and the
// Android-parity error collapse (empty list / nil / false, never a throw).
import XCTest
@testable import Mishran

final class AddressRepositoryTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var store: InMemoryTokenStore!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        store = InMemoryTokenStore()
        store.accessToken = "access-1"
        store.refreshToken = "refresh-1"
    }

    private func makeRepository() -> AddressRepository {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: store, session: session(), baseURL: baseURL),
            retryDelay: 0
        )
        return AddressRepository(client: client)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let addressJSON = #"""
    {"id":"a1","customerId":"c1","line1":"12 MG Road","line2":"Flat 3",
    "city":"Bengaluru","state":"Karnataka","pincode":"560001",
    "tag":"home","isDefault":true}
    """#

    // MARK: list

    func testListDecodesEnvelopeAndSortsDefaultFirst() async {
        MockURLProtocol.routes["/addresses"] = (200, [:], json("""
        {"data":{"items":[
            {"id":"a2","line1":"4 Park Street","city":"Kolkata","state":"West Bengal","pincode":"700016","tag":"work"},
            \(addressJSON)
        ]}}
        """))
        let repository = makeRepository()

        let addresses = await repository.list()

        XCTAssertEqual(addresses.map(\.id), ["a1", "a2"], "default-flagged row must lead")
        XCTAssertEqual(addresses.first?.tag, .home)
        XCTAssertEqual(addresses.first?.isDefault, true)
        XCTAssertEqual(addresses.last?.isDefault == true, false)
    }

    func testListCollapsesErrorsToEmpty() async {
        MockURLProtocol.routes["/addresses"] = (500, [:], Data("{}".utf8))
        let repository = makeRepository()

        let addresses = await repository.list()

        XCTAssertEqual(addresses, [], "a failing list must degrade to empty, not throw")
    }

    // MARK: create

    func testCreateDecodesMutationResponseAndSendsInputBody() async throws {
        MockURLProtocol.routes["/addresses"] = (201, [:], json("{\"data\":{\"address\":\(addressJSON)}}"))
        let repository = makeRepository()

        let created = await repository.create(input: AddressInputDTO(
            line1: "12 MG Road", line2: "Flat 3", city: "Bengaluru",
            state: "Karnataka", pincode: "560001", tag: .home, isDefault: true
        ))

        XCTAssertEqual(created?.id, "a1")
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["/addresses"])
        XCTAssertEqual(request.httpMethod, "POST")
        let body = try XCTUnwrap(MockURLProtocol.body(of: request))
        let sent = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        // Required fields ride the wire; nil optionals (lat/lng) are omitted.
        XCTAssertEqual(sent?["line1"] as? String, "12 MG Road")
        XCTAssertEqual(sent?["state"] as? String, "Karnataka")
        XCTAssertEqual(sent?["isDefault"] as? Bool, true)
        XCTAssertNil(sent?["lat"])
    }

    func testCreateCollapsesErrorsToNil() async {
        MockURLProtocol.routes["/addresses"] = (422, [:], json(
            #"{"error":{"code":"VALIDATION","message":"pincode required"}}"#
        ))
        let repository = makeRepository()

        let created = await repository.create(input: AddressInputDTO(
            line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001"
        ))

        XCTAssertNil(created)
    }

    // MARK: update (set-default PATCH)

    func testUpdatePatchesByIdAndFlagsDefault() async throws {
        MockURLProtocol.routes["/addresses/a1"] = (200, [:], json("""
        {"data":{"address":\(addressJSON)}}
        """))
        let repository = makeRepository()

        let existing = AddressDTO(
            id: "a1", customerId: nil, line1: "12 MG Road", line2: nil,
            city: "Bengaluru", state: "Karnataka", pincode: "560001",
            lat: nil, lng: nil, tag: .home, isDefault: false
        )
        let updated = await repository.update(id: "a1", input: AddressInputDTO(address: existing, isDefault: true))

        XCTAssertEqual(updated?.isDefault, true)
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["/addresses/a1"])
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(request.url?.path, "/api/mobile/v1/addresses/a1")
        let body = try XCTUnwrap(MockURLProtocol.body(of: request))
        let sent = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(sent?["isDefault"] as? Bool, true)
    }

    // MARK: delete

    func testDeleteDecodesOkEnvelope() async throws {
        MockURLProtocol.routes["/addresses/a1"] = (200, [:], json(#"{"data":{"ok":true}}"#))
        let repository = makeRepository()

        let deleted = await repository.delete(id: "a1")

        XCTAssertTrue(deleted)
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["/addresses/a1"])
        XCTAssertEqual(request.httpMethod, "DELETE")
    }

    func testDeleteCollapsesErrorsToFalse() async {
        MockURLProtocol.routes["/addresses/a1"] = (404, [:], json(
            #"{"error":{"code":"NOT_FOUND","message":"gone"}}"#
        ))
        let repository = makeRepository()

        let deleted = await repository.delete(id: "a1")

        XCTAssertFalse(deleted)
    }
}
