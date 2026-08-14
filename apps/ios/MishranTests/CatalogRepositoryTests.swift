// Task 16.2 (Mishran Mobile Apps v1): CatalogRepository + CatalogCache
// tests over the MockURLProtocol seam and an in-memory SwiftData container.
// Contract: 200 fresh → cache replaced + etag stored; 304 → cache untouched.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CatalogRepositoryTests: XCTestCase {
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

    private func makeRepository() -> CatalogRepository {
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
        let cache = CatalogCache(context: container.mainContext)
        return CatalogRepository(client: client, cache: cache)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let productsJSON = """
    {"data":{"items":[
    {"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic","displayPrice":"₹720/kg"},
    {"id":"p2","slug":"mesore-hurigadbadu","name":"Mysore Pak","family":"classic"}
    ],"total":2,"page":1,"pageSize":50}}
    """

    func testEmptyCacheWith200PersistsEntitiesAndEtag() async throws {
        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"etag-1\""], json(productsJSON))
        let repository = makeRepository()

        await repository.getCatalog()

        XCTAssertEqual(repository.products.count, 2)
        XCTAssertEqual(repository.errorMessage, nil)
        // Entities actually persisted to the store (fresh context reads them).
        let cached = try container.mainContext.fetch(FetchDescriptor<ProductEntity>())
        XCTAssertEqual(cached.count, 2)
        XCTAssertEqual(cached.map(\.slug).sorted(), ["kaju-katli", "mesore-hurigadbadu"])
        // ETag persisted for the next conditional request.
        XCTAssertEqual(UserDefaults.standard.string(forKey: CatalogCache.etagKey), "\"etag-1\"")
    }

    func testNotModifiedLeavesCacheUntouched() async throws {
        // Seed the cache with a stale-but-valid page + etag.
        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"etag-1\""], json(productsJSON))
        let repository = makeRepository()
        await repository.getCatalog()

        // Server now answers 304 — cache must stay exactly as it was.
        MockURLProtocol.routes["catalog/products"] = (304, [:], Data())
        await repository.getCatalog()

        XCTAssertEqual(repository.products.count, 2)
        XCTAssertEqual(try container.mainContext.fetch(FetchDescriptor<ProductEntity>()).count, 2)
        XCTAssertEqual(UserDefaults.standard.string(forKey: CatalogCache.etagKey), "\"etag-1\"")
        // The conditional request carried the stored etag.
        let request = MockURLProtocol.lastRequests["catalog/products"]
        XCTAssertEqual(request?.value(forHTTPHeaderField: "If-None-Match"), "\"etag-1\"")
    }

    func testForceSkipsEtag() async throws {
        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"etag-1\""], json(productsJSON))
        let repository = makeRepository()
        await repository.getCatalog()

        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"etag-2\""], json(productsJSON))
        await repository.getCatalog(force: true)

        XCTAssertEqual(UserDefaults.standard.string(forKey: CatalogCache.etagKey), "\"etag-2\"")
        let request = MockURLProtocol.lastRequests["catalog/products"]
        XCTAssertNil(request?.value(forHTTPHeaderField: "If-None-Match"))
    }

    func testCacheReplaceAllRemovesStaleRows() async throws {
        let cache = CatalogCache(context: container.mainContext)
        cache.replaceAll(with: [
            ProductDTO(id: "p1", slug: "old-1", name: "Old One", family: .classic),
        ])
        XCTAssertEqual(try container.mainContext.fetch(FetchDescriptor<ProductEntity>()).count, 1)

        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"e\""], json(productsJSON))
        let repository = makeRepository()
        await repository.getCatalog()

        // Rows not in the fresh page are gone — no zombie products.
        let slugs = try container.mainContext.fetch(FetchDescriptor<ProductEntity>()).map(\.slug)
        XCTAssertFalse(slugs.contains("old-1"))
        XCTAssertEqual(slugs.count, 2)
    }

    func testGetCatalogSurfacesErrorAndKeepsCache() async throws {
        MockURLProtocol.routes["catalog/products"] = (200, ["ETag": "\"etag-1\""], json(productsJSON))
        let repository = makeRepository()
        await repository.getCatalog()
        XCTAssertEqual(repository.products.count, 2)

        // Server error — cached page stays available (offline-first).
        MockURLProtocol.routes["catalog/products"] = (503, [:], json(#"{"error":{"code":"INTERNAL","message":"down"}}"#))
        await repository.getCatalog()

        XCTAssertNotNil(repository.errorMessage)
        XCTAssertEqual(repository.products.count, 2)
    }

    // MARK: BGTaskScheduler request factory (submit itself is runtime-gated)

    func testCatalogRefreshTaskRequestFactory() throws {
        let request = CatalogRefreshTask.makeRequest()
        XCTAssertEqual(request.identifier, "com.mishran.app.catalog-refresh")
        let begin = try XCTUnwrap(request.earliestBeginDate)
        XCTAssertEqual(begin.timeIntervalSinceNow, CatalogRefreshTask.refreshInterval, accuracy: 5)
        XCTAssertEqual(CatalogRefreshTask.refreshInterval, 6 * 60 * 60, accuracy: 1)
    }
}
