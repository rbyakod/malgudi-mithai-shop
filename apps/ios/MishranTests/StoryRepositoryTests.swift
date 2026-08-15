// StoryRepositoryTests.swift — P2 (Mishran Mobile Apps v1).
// Story contract decode (list page + reader detail) and the repository's
// cached-refresh ladder over the MockURLProtocol seam + an in-memory
// SwiftData container: 200 → full-swap cache, failure → cached rows stand
// with the error surfaced. Newest-first ordering rides publishedAt.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class StoryRepositoryTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var container: ModelContainer!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
    }

    override func tearDown() {
        container = nil
        super.tearDown()
    }

    private func makeRepository() -> StoryRepository {
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
        return StoryRepository(client: client, context: container.mainContext)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let storiesJSON = """
    {"data":{"items":[
    {"id":"st1","slug":"karigar-note","title":"The karigar's note","pillar":"people",
    "excerpt":"Five decades at the copper kadhai.","heroImage":"https://cdn.test/hero.jpg",
    "publishedAt":"2026-08-01T10:00:00.000Z","updatedAt":"2026-08-01T10:00:00.000Z"},
    {"id":"st2","slug":"monsoon-mysore-pak","title":"Monsoon Mysore Pak","pillar":"sweets",
    "excerpt":null,"heroImage":null,"publishedAt":"2026-07-15T08:30:00Z","updatedAt":null}
    ],"total":2,"page":1,"pageSize":50}}
    """

    private let storyDetailJSON = """
    {"data":{"id":"st1","slug":"karigar-note","title":"The karigar's note","pillar":"people",
    "excerpt":"Five decades at the copper kadhai.","heroImage":"https://cdn.test/hero.jpg",
    "publishedAt":"2026-08-01T10:00:00.000Z","updatedAt":"2026-08-01T10:00:00.000Z",
    "body":"First paragraph.\\nSecond paragraph."}}
    """

    // MARK: Decode

    func testStoryPageDecodesContractShape() throws {
        let page = try JSONDecoder().decode(Envelope<StoryPageDTO>.self, from: json(storiesJSON)).data
        XCTAssertEqual(page.total, 2)
        let story = try XCTUnwrap(page.items.first)
        XCTAssertEqual(story.slug, "karigar-note")
        XCTAssertEqual(story.pillar, "people")
        XCTAssertEqual(story.heroImage, "https://cdn.test/hero.jpg")
        XCTAssertNil(page.items.last?.excerpt, "null optionals decode to nil")
    }

    func testStoryDetailDecodesFlattenedBody() throws {
        let detail = try JSONDecoder().decode(Envelope<StoryDetailDTO>.self, from: json(storyDetailJSON)).data
        XCTAssertEqual(detail.title, "The karigar's note")
        XCTAssertEqual(detail.body, "First paragraph.\nSecond paragraph.",
                       "the server flattens Lexical to a \\n-joined plain string")
        XCTAssertEqual(detail.story.slug, "karigar-note", "list projection stays derivable")
    }

    // MARK: Cached refresh

    func testRefreshPersistsRowsNewestFirst() async throws {
        MockURLProtocol.routes["stories"] = (200, [:], json(storiesJSON))
        let repository = makeRepository()

        await repository.getStories()

        XCTAssertNil(repository.errorMessage)
        XCTAssertEqual(repository.stories.map(\.slug), ["karigar-note", "monsoon-mysore-pak"],
                      "rows sort newest-first by publishedAt")
        let cached = try container.mainContext.fetch(FetchDescriptor<StoryEntity>())
        XCTAssertEqual(Set(cached.map(\.slug)), ["karigar-note", "monsoon-mysore-pak"])
        // A fresh repository boots off the cache with no network.
        MockURLProtocol.reset()
        XCTAssertEqual(makeRepository().stories.count, 2, "cache is the starting state")
    }

    func testRefreshSwapsStaleRows() async throws {
        MockURLProtocol.routes["stories"] = (200, [:], json(storiesJSON))
        let repository = makeRepository()
        await repository.getStories()

        // Server now carries only one story — the stale row must not survive.
        let singleStoryJSON = """
        {"data":{"items":[{"id":"st3","slug":"fresh-note","title":"Fresh note","pillar":"sweets",
        "excerpt":null,"heroImage":null,"publishedAt":"2026-08-10T10:00:00Z","updatedAt":null}],
        "total":1,"page":1,"pageSize":50}}
        """
        MockURLProtocol.routes["stories"] = (200, [:], json(singleStoryJSON))
        await repository.getStories()

        XCTAssertEqual(repository.stories.map(\.slug), ["fresh-note"])
        XCTAssertEqual(try container.mainContext.fetch(FetchDescriptor<StoryEntity>()).count, 1)
    }

    func testFailureKeepsCachedRowsAndSurfacesError() async throws {
        MockURLProtocol.routes["stories"] = (200, [:], json(storiesJSON))
        let repository = makeRepository()
        await repository.getStories()
        XCTAssertEqual(repository.stories.count, 2)

        MockURLProtocol.routes["stories"] = (
            500, [:], json(#"{"error":{"code":"INTERNAL","message":"down"}}"#)
        )
        await repository.getStories()

        XCTAssertEqual(repository.errorMessage, "down")
        XCTAssertEqual(repository.stories.count, 2, "offline-first: cached rows stand")
    }

    // MARK: Reader detail

    func testStoryDetailFetchesLiveBody() async throws {
        MockURLProtocol.routes["stories/karigar-note"] = (200, [:], json(storyDetailJSON))
        let repository = makeRepository()

        let detail = try await repository.storyDetail(slug: "karigar-note")

        XCTAssertEqual(detail.body, "First paragraph.\nSecond paragraph.")
        XCTAssertNil(repository.errorMessage)
    }

    func testCachedRowFetchBySlug() throws {
        StoryEntity.replaceAll(
            with: [
                StoryDTO(id: "st1", slug: "karigar-note", title: "The karigar's note",
                         pillar: "people", excerpt: "Five decades…", heroImage: nil,
                         publishedAt: nil, updatedAt: nil),
            ],
            in: container.mainContext
        )

        XCTAssertEqual(StoryEntity.fetch(slug: "karigar-note", in: container.mainContext)?.title,
                       "The karigar's note")
        XCTAssertNil(StoryEntity.fetch(slug: "missing", in: container.mainContext))
    }

    // MARK: Date helpers

    func testISO8601ParsingHandlesFractionalAndPlainSeconds() {
        XCTAssertNotNil(StoryFormatting.date(fromISO: "2026-08-01T10:00:00.000Z"))
        XCTAssertNotNil(StoryFormatting.date(fromISO: "2026-08-01T10:00:00Z"))
        XCTAssertNil(StoryFormatting.date(fromISO: nil))
        XCTAssertNil(StoryFormatting.date(fromISO: "not a date"))
        XCTAssertNotNil(StoryFormatting.displayString("2026-08-01T10:00:00Z"))
    }
}
