// HeroRepository.swift — admin-curated home carousel (Mishran Mobile Apps v1).
// Network-only fetch of GET /hero: unlike the catalog/stories there is no
// SwiftData cache to hydrate from, so the static featured-product hero on
// Home is the offline story. Mirrors VerticalsRepository.portalPages()'s
// nil-tolerance: every failure (transport, 5xx, decode) collapses to nil so
// the caller falls back instead of dead-ending the screen.
import Foundation

actor HeroRepository {
    private let client: MishranAPIClient

    init(client: MishranAPIClient) {
        self.client = client
    }

    /// Curated slides + autoplay interval; nil when the fetch or decode
    /// fails (Home keeps its static hero). An empty-slides success is
    /// returned as-is — the view model treats it like the fallback.
    func hero() async -> HeroDTO? {
        try? await client.request(Endpoint.hero)
    }
}
