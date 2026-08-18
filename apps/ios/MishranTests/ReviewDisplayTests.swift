// ReviewDisplayTests.swift — Batch B11 (Mishran Mobile Apps v1).
// GET /reviews contract decode (populated + zero-review shapes: nullable
// author, nullable body, string createdAt, nullable averageRating), the
// StarRow glyph math (web Stars.tsx round-and-clamp parity) and the
// one-decimal rating formatter, plus the PDP view model's loadReviews over
// the MockURLProtocol seam (success populates, failure stays hidden).
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class ReviewDisplayTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
    }

    override func tearDown() {
        container = nil
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        super.tearDown()
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let reviewsJSON = """
    {"data":{"items":[
    {"id":"r1","rating":5,"body":"Freshest kaju katli in the city.",
    "authorDisplayName":"Priya","verifiedPurchase":true,
    "createdAt":"2026-08-01T10:30:00.000Z"},
    {"id":"r2","rating":4,"body":null,"authorDisplayName":null,
    "verifiedPurchase":false,"createdAt":"2026-07-15T08:30:00Z"}
    ],"averageRating":4.5,"total":9,"page":1,"pageSize":5}}
    """

    private let emptyReviewsJSON = """
    {"data":{"items":[],"averageRating":null,"total":0,"page":1,"pageSize":5}}
    """

    private func makeViewModel(slug: String) -> ProductDetailViewModel {
        let session = { () -> URLSession in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return URLSession(configuration: config)
        }
        let client = MishranAPIClient(
            session: session(), refreshSession: session(),
            baseURL: baseURL,
            authenticator: Authenticator(
                store: InMemoryTokenStore(), session: session(), baseURL: baseURL
            ),
            retryDelay: 0
        )
        return ProductDetailViewModel(
            slug: slug, client: client, context: container.mainContext
        )
    }

    private let detailJSON = """
    {"data":{"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic",
    "displayPrice":"₹720/kg","freshnessStatus":"made-daily"}}
    """

    // MARK: Decode

    func testReviewListDecodesContractShape() throws {
        let page = try JSONDecoder().decode(
            Envelope<ReviewListDTO>.self, from: json(reviewsJSON)
        ).data
        XCTAssertEqual(page.total, 9)
        XCTAssertEqual(page.averageRating, 4.5)
        XCTAssertEqual(page.items.count, 2)

        let named = try XCTUnwrap(page.items.first)
        XCTAssertEqual(named.rating, 5)
        XCTAssertEqual(named.authorDisplayName, "Priya")
        XCTAssertTrue(named.verifiedPurchase)
        XCTAssertEqual(named.createdAt, "2026-08-01T10:30:00.000Z",
                       "createdAt stays a STRING — parse happens client-side")

        let anonymous = try XCTUnwrap(page.items.last)
        XCTAssertNil(anonymous.authorDisplayName, "null author → Anonymous at render")
        XCTAssertNil(anonymous.body, "null body renders no body block")
        XCTAssertFalse(anonymous.verifiedPurchase)
    }

    func testReviewListDecodesZeroReviewShape() throws {
        let page = try JSONDecoder().decode(
            Envelope<ReviewListDTO>.self, from: json(emptyReviewsJSON)
        ).data
        XCTAssertEqual(page.total, 0)
        XCTAssertNil(page.averageRating, "no approved reviews → null average")
        XCTAssertTrue(page.items.isEmpty)
    }

    // MARK: StarRow (web Stars.tsx parity)

    func testStarRowInitRoundsAndClampsGlyphCount() {
        // ProductCardInitTests precedent: pin the view's init + glyph math.
        XCTAssertEqual(StarRow(rating: 4.5).filledCount, 5, "4.5 rounds up — web Math.round")
        XCTAssertEqual(StarRow(rating: 4.4).filledCount, 4)
        XCTAssertEqual(StarRow(rating: 3).filledCount, 3)
        XCTAssertEqual(StarRow(rating: 0).filledCount, 0)
        XCTAssertEqual(StarRow(rating: 5).filledCount, 5)
        XCTAssertEqual(StarRow(rating: 7).filledCount, 5, "out-of-range high clamps at 5")
        XCTAssertEqual(StarRow(rating: -2).filledCount, 0, "out-of-range low clamps at 0")
    }

    func testRatingFormatterIsOneDecimal() {
        XCTAssertEqual(ReviewFormatting.rating(4.5), "4.5")
        XCTAssertEqual(ReviewFormatting.rating(4), "4.0", "whole ratings keep the .0 (toFixed(1))")
        XCTAssertEqual(ReviewFormatting.rating(4.33), "4.3")
        XCTAssertEqual(ReviewFormatting.rating(0), "0.0")
    }

    func testSummaryLineUsesSingularAndPluralForms() {
        let one = ReviewListDTO(items: [], averageRating: 5, total: 1, page: 1, pageSize: 5)
        let many = ReviewListDTO(items: [], averageRating: 4.5, total: 9, page: 1, pageSize: 5)
        // Labels resolve through L(), so the assertions compare against
        // L()-built expectations — locale-agnostic (DeliveryCheckTests rule).
        XCTAssertEqual(ProductDetailView.reviewSummary(one), L("reviews.summary_one", "5.0"))
        XCTAssertEqual(ProductDetailView.reviewSummary(many), L("reviews.summary_other", "4.5", "9"))
    }

    // MARK: PDP fetch (MockURLProtocol seam)

    func testLoadReviewsPopulatesAfterProductLoads() async throws {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(detailJSON))
        MockURLProtocol.routes["reviews"] = (200, [:], json(reviewsJSON))
        let vm = makeViewModel(slug: "kaju-katli")

        await vm.load()
        await vm.loadReviews()

        let reviews = try XCTUnwrap(vm.reviews)
        XCTAssertEqual(reviews.total, 9)

        // The request targets the loaded product's id, first page of 5.
        let request = try XCTUnwrap(MockURLProtocol.lastRequests["reviews"])
        let query = try XCTUnwrap(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems)
        XCTAssertTrue(query.contains(URLQueryItem(name: "productId", value: "p1")))
        XCTAssertTrue(query.contains(URLQueryItem(name: "pageSize", value: "5")))
        XCTAssertEqual(MockURLProtocol.authHeaders["reviews"], ["-"],
                       "reviews are public — no bearer token")
    }

    func testLoadReviewsFailureKeepsSectionHidden() async throws {
        MockURLProtocol.routes["catalog/products/kaju-katli"] = (200, [:], json(detailJSON))
        MockURLProtocol.routes["reviews"] = (
            500, [:], json(#"{"error":{"code":"INTERNAL","message":"boom"}}"#)
        )
        let vm = makeViewModel(slug: "kaju-katli")

        await vm.load()
        await vm.loadReviews()

        XCTAssertNil(vm.reviews, "a failed fetch hides the section silently")
        XCTAssertNil(vm.errorMessage, "the PDP surfaces no reviews error")
    }
}
