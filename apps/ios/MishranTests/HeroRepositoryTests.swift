// HeroRepositoryTests.swift — admin-curated home hero (Mishran Mobile Apps v1).
// GET /hero decode through the {data} envelope (slides + autoplayMs, the
// optional priceLabel) and the nil-tolerance contract: any failure —
// transport or 5xx — collapses to nil so Home keeps its static hero.
// Same MockURLProtocol seam as BrandRepositoryTests.
import XCTest
@testable import Mishran

final class HeroRepositoryTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
    }

    private func makeRepository() -> HeroRepository {
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
        return HeroRepository(client: client)
    }

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let heroJSON = """
    {"data":{"slides":[
    {"id":"p1","vertical":"mithai","slug":"kaju-katli","name":"Kaju Katli",
     "priceLabel":"₹720/kg","imageURL":"https://cdn.test/kaju.jpg",
     "imageAlt":"Kaju katli on a brass plate"},
    {"id":"q1","vertical":"qsr","slug":"masala-dosa","name":"Masala Dosa",
     "imageURL":"https://cdn.test/dosa.jpg","imageAlt":"Masala dosa"}
    ],"autoplayMs":6000}}
    """

    func testFetchDecodesSlidesAndAutoplayThroughTheEnvelope() async {
        MockURLProtocol.routes["hero"] = (200, [:], json(heroJSON))

        let hero = await makeRepository().hero()

        XCTAssertEqual(hero, HeroDTO(
            slides: [
                HeroSlideDTO(
                    id: "p1", vertical: "mithai", slug: "kaju-katli", name: "Kaju Katli",
                    priceLabel: "₹720/kg", imageURL: "https://cdn.test/kaju.jpg",
                    imageAlt: "Kaju katli on a brass plate"
                ),
                HeroSlideDTO(
                    id: "q1", vertical: "qsr", slug: "masala-dosa", name: "Masala Dosa",
                    priceLabel: nil, imageURL: "https://cdn.test/dosa.jpg",
                    imageAlt: "Masala dosa"
                ),
            ],
            autoplayMs: 6000
        ))
        XCTAssertEqual(MockURLProtocol.calls["hero"] ?? 0, 1)
    }

    func testFailureCollapsesToNilNeverThrows() async {
        MockURLProtocol.routes["hero"] = (500, [:], json(#"{"error":{"code":"INTERNAL","message":"boom"}}"#))

        let hero = await makeRepository().hero()

        XCTAssertNil(hero, "a dead /hero must degrade to nil (static hero), not an error")
    }

    func testUnroutedEndpointCollapsesToNil() async {
        // No mock registered — the 404 body below is MockURLProtocol's own
        // "no mock" reply, exercising the not-JSON decode path too. With no
        // routes registered the call records under the FULL path (suffix
        // matching needs a registered key to key on).
        let hero = await makeRepository().hero()

        XCTAssertNil(hero)
        XCTAssertEqual(MockURLProtocol.calls["/api/mobile/v1/hero"] ?? 0, 1, "the fetch fired; failure stayed silent")
    }
}
