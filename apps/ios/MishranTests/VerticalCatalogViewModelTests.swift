// VerticalCatalogViewModelTests.swift — P2 (Mishran Mobile Apps v1).
// Tab/error state machine over the MockURLProtocol seam: first visit loads
// + memoizes a vertical, failures surface the error with an empty grid,
// retry recovers, and the card mapping carries each vertical's one-line
// discriminator (snacks MSRP · weight, QSR veg dot + category, merch
// type · availability).
import XCTest
@testable import Mishran

@MainActor
final class VerticalCatalogViewModelTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    private func makeViewModel(selected: Vertical = .snacks) -> VerticalCatalogViewModel {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(store: InMemoryTokenStore(), session: session(), baseURL: baseURL),
            retryDelay: 0
        )
        return VerticalCatalogViewModel(
            repository: VerticalsRepository(client: client),
            selected: selected
        )
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private func snack(_ id: String, name: String, msrp: String?, weight: String?) -> SnackDTO {
        SnackDTO(id: id, slug: id, name: name, category: "namkeen", description: nil,
                 images: ["https://cdn.test/\(id).jpg"], weight: weight, msrp: msrp,
                 retailers: nil, updatedAt: nil)
    }

    private func snackPage(_ items: [SnackDTO]) -> String {
        let rows = items.map { item in
            #"{"id":"\#(item.id)","slug":"\#(item.slug)","name":"\#(item.name)","category":"namkeen","images":["https://cdn.test/\#(item.id).jpg"],"msrp":"\#(item.msrp ?? "")","weight":"\#(item.weight ?? "")"}"#
        }.joined(separator: ",")
        return #"{"data":{"items":[\#(rows)],"total":\#(items.count),"page":1,"pageSize":50}}"#
    }

    // MARK: Tab loading

    func testFirstVisitLoadsAndMemoizes() async {
        MockURLProtocol.routes["catalog/snacks"] = (
            200, [:], json(snackPage([snack("s1", name: "Bhujia", msrp: "₹60", weight: "200 g")]))
        )
        let viewModel = makeViewModel()

        await viewModel.select(.snacks)
        XCTAssertEqual(viewModel.cards.map(\.name), ["Bhujia"])
        XCTAssertNil(viewModel.errorMessage)

        // Re-selecting the loaded tab is instant — no second request.
        await viewModel.select(.snacks)
        XCTAssertEqual(MockURLProtocol.calls["catalog/snacks"], 1, "loaded tabs are memoized")
    }

    func testSwitchingTabsLoadsTheNewVertical() async {
        MockURLProtocol.routes["catalog/snacks"] = (200, [:], json(snackPage([snack("s1", name: "Bhujia", msrp: nil, weight: nil)])))
        MockURLProtocol.routes["catalog/qsr"] = (
            200, [:],
            json(#"{"data":{"items":[{"id":"q1","slug":"masala-dosa","name":"Masala Dosa","category":"dosa","veg":true,"spiceLevel":"medium","availableAtStores":["indiranagar"]}],"total":1,"page":1,"pageSize":50}}"#)
        )
        let viewModel = makeViewModel()

        await viewModel.select(.snacks)
        await viewModel.select(.qsr)

        XCTAssertEqual(viewModel.selected, .qsr)
        XCTAssertEqual(viewModel.cards.map(\.name), ["Masala Dosa"])
        XCTAssertEqual(MockURLProtocol.calls["catalog/qsr"], 1)
    }

    func testMithaiIsNeverLoadedThroughThisViewModel() async {
        let viewModel = makeViewModel()
        await viewModel.select(.mithai)
        XCTAssertTrue(viewModel.cards.isEmpty, "the mithai tab renders the products flow")
        XCTAssertEqual(MockURLProtocol.calls.count, 0, "no request fired")
    }

    // MARK: Error + retry

    func testFailureSurfacesErrorWithEmptyGrid() async {
        MockURLProtocol.routes["catalog/snacks"] = (
            503, [:], json(#"{"error":{"code":"INTERNAL","message":"down"}}"#)
        )
        let viewModel = makeViewModel()

        await viewModel.select(.snacks)

        XCTAssertEqual(viewModel.errorMessage, "down")
        XCTAssertTrue(viewModel.cards.isEmpty)
        XCTAssertFalse(viewModel.isLoading)
    }

    func testRetryRecoversAfterFailure() async {
        // 400 (not 5xx) so the client's 5xx-retry machinery stays out of the
        // call count — this test is about reload(), not transport retries.
        MockURLProtocol.routes["catalog/snacks"] = (
            400, [:], json(#"{"error":{"code":"VALIDATION","message":"down"}}"#)
        )
        let viewModel = makeViewModel()
        await viewModel.select(.snacks)
        XCTAssertNotNil(viewModel.errorMessage)

        MockURLProtocol.routes["catalog/snacks"] = (
            200, [:], json(snackPage([snack("s1", name: "Bhujia", msrp: "₹60", weight: "200 g")]))
        )
        await viewModel.reload()

        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.cards.map(\.name), ["Bhujia"])
        XCTAssertEqual(MockURLProtocol.calls["catalog/snacks"], 2, "retry re-fetched the tab")
    }

    // MARK: Card mapping

    func testSnackCardDiscriminatorJoinsMsrpAndWeight() async {
        MockURLProtocol.routes["catalog/snacks"] = (
            200, [:], json(snackPage([snack("s1", name: "Bhujia", msrp: "₹60", weight: "200 g")]))
        )
        let viewModel = makeViewModel()

        await viewModel.select(.snacks)

        let card = viewModel.cards[0]
        XCTAssertEqual(card.discriminator, "₹60 · 200 g")
        XCTAssertEqual(card.imageURL, "https://cdn.test/s1.jpg")
        XCTAssertFalse(card.showsVegDot)
        XCTAssertEqual(card.vertical, .snacks)
        XCTAssertEqual(card.slug, "s1")
    }

    func testSnackCardDiscriminatorSkipsMissingParts() async {
        MockURLProtocol.routes["catalog/snacks"] = (
            200, [:], json(snackPage([snack("s2", name: "Chivda", msrp: nil, weight: "150 g")]))
        )
        let viewModel = makeViewModel()

        await viewModel.select(.snacks)

        XCTAssertEqual(viewModel.cards[0].discriminator, "150 g", "missing MSRP drops out")
    }

    func testQsrCardShowsVegDotAndCategory() async {
        MockURLProtocol.routes["catalog/qsr"] = (
            200, [:],
            json(#"{"data":{"items":[{"id":"q1","slug":"masala-dosa","name":"Masala Dosa","category":"dosa","veg":true,"spiceLevel":"medium","availableAtStores":["indiranagar"]}],"total":1,"page":1,"pageSize":50}}"#)
        )
        let viewModel = makeViewModel()

        await viewModel.select(.qsr)

        let card = viewModel.cards[0]
        XCTAssertEqual(card.discriminator, "Dosa", "category capitalizes")
        XCTAssertTrue(card.showsVegDot, "veg:true cards carry the dot")
        XCTAssertEqual(card.imageURL, nil, "no image on this fixture")
    }

    func testMerchCardDiscriminatorJoinsTypeAndAvailability() async {
        MockURLProtocol.routes["catalog/merch"] = (
            200, [:],
            json(#"{"data":{"items":[{"id":"m1","slug":"tote","name":"Mishran Tote","type":"tote","price":"₹450","availability":"enquiry-only"}],"total":1,"page":1,"pageSize":50}}"#)
        )
        let viewModel = makeViewModel()

        await viewModel.select(.merch)

        let card = viewModel.cards[0]
        XCTAssertEqual(card.discriminator, "Tote · Enquiry-only")
        XCTAssertEqual(card.vertical, .merch)
        XCTAssertFalse(card.showsVegDot)
    }
}
