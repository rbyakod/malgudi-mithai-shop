// BrandRepositoryTests.swift — P1 parity (Mishran Mobile Apps v1).
// GET /brand decode + the cached-fetch ladder: cache hit (no network),
// fetch + cache write, and the placeholder-number fallback on failure.
// Same MockURLProtocol seam as AddressRepositoryTests.
import XCTest
@testable import Mishran

final class BrandRepositoryTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        UserDefaults.standard.removeObject(forKey: BrandRepository.cacheKey)
    }

    override func tearDown() {
        UserDefaults.standard.removeObject(forKey: BrandRepository.cacheKey)
        super.tearDown()
    }

    private func makeRepository() -> BrandRepository {
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
        return BrandRepository(client: client)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    func testFetchDecodesEnvelopeAndCachesForLaterReads() async {
        MockURLProtocol.routes["brand"] = (
            200, [:], json(#"{"data":{"whatsappNumber":"+91-98765-43210","whatsappDigits":"919876543210"}}"#)
        )
        let repository = makeRepository()

        let digits = await repository.whatsappDigits()

        XCTAssertEqual(digits, "919876543210")
        let cached = BrandRepository.cachedBrand(from: UserDefaults.standard)
        XCTAssertEqual(cached, BrandDTO(whatsappNumber: "+91-98765-43210", whatsappDigits: "919876543210"))

        // Cache hit: a second repository instance must not hit the network
        // even with the route now failing.
        MockURLProtocol.routes["brand"] = (500, [:], json("{}"))
        MockURLProtocol.reset()
        let cachedDigits = await makeRepository().whatsappDigits()
        XCTAssertEqual(cachedDigits, "919876543210", "cached digits survive a dead backend")
        XCTAssertEqual(MockURLProtocol.calls["brand"] ?? 0, 0, "cache serves the read without a request")
    }

    func testFetchFailureFallsBackToPlaceholderNumber() async {
        MockURLProtocol.routes["brand"] = (500, [:], json("{}"))
        let repository = makeRepository()

        let digits = await repository.whatsappDigits()

        XCTAssertEqual(digits, BrandRepository.fallbackDigits, "offline help still opens a WhatsApp chat")
        XCTAssertNil(BrandRepository.cachedBrand(from: UserDefaults.standard), "failures must not poison the cache")
    }

    func testBrandDTODecodesContractShape() throws {
        let dto = try JSONDecoder().decode(
            Envelope<BrandDTO>.self,
            from: json(#"{"data":{"whatsappNumber":"+91-98765-43210","whatsappDigits":"919876543210"}}"#)
        ).data
        XCTAssertEqual(dto.whatsappNumber, "+91-98765-43210")
        XCTAssertEqual(dto.whatsappDigits, "919876543210")
    }

    func testWhatsappURLBuildsWaMeLink() {
        XCTAssertEqual(
            BrandRepository.whatsappURL(digits: "919876543210"),
            URL(string: "https://wa.me/919876543210")
        )
    }
}
