// HomeViewModel.swift — P1 parity (Mishran Mobile Apps v1).
// Home-tab state off the offline-first catalog (Android HomeViewModel
// parity): the screen derives its hero image, best-seller rail, and — since
// P2 — the "Shop by vertical" portal row from the one list, with the story
// repository feeding the "From the journal" rail. Derivations are
// nonisolated pure functions so the featured/fallback and portal rules are
// unit-testable without a repository.
import Foundation
import Observation

@MainActor
@Observable
final class HomeViewModel {
    /// Best-sellers rail length when nothing is featured-flagged.
    nonisolated static let fallbackRailCount = 8
    /// "From the journal" rail length (en.json home.journal).
    nonisolated static let journalRailCount = 3

    private let repository: CatalogRepository
    /// P2 journal + verticals feeds — optional so tests (and a nil SwiftData
    /// container) can build the model without them.
    private let storyRepository: StoryRepository?
    private let verticalsRepository: VerticalsRepository?
    /// Admin-curated hero carousel (optional for the same reason).
    private let heroRepository: HeroRepository?

    private(set) var products: [ProductEntity] = []
    private(set) var stories: [StoryEntity] = []
    private(set) var portals: [VerticalPortal] = []
    /// Curated hero slides — empty (or a failed fetch) keeps the static
    /// featured-product hero exactly as before.
    private(set) var heroSlides: [HeroSlideDTO] = []
    private(set) var heroAutoplayMs: Int = 5000

    init(
        repository: CatalogRepository,
        storyRepository: StoryRepository? = nil,
        verticalsRepository: VerticalsRepository? = nil,
        heroRepository: HeroRepository? = nil
    ) {
        self.repository = repository
        self.storyRepository = storyRepository
        self.verticalsRepository = verticalsRepository
        self.heroRepository = heroRepository
        products = repository.products
        stories = storyRepository?.stories ?? []
    }

    func load() async {
        // The hero fetch rides alongside the offline-first content — one
        // parallel hop, never a gate: a slow/failed /hero can't delay the
        // catalog, and its failure collapses to nil (static hero stays).
        async let hero = heroRepository?.hero()
        await repository.getCatalog()
        products = repository.products
        if let storyRepository {
            await storyRepository.getStories()
            stories = storyRepository.stories
        }
        if let verticalsRepository {
            let pages = await verticalsRepository.portalPages()
            portals = Self.portals(
                products: products, snacks: pages.snacks, qsr: pages.qsr, merch: pages.merch
            )
        }
        if let fetched = await hero {
            heroSlides = fetched.slides
            heroAutoplayMs = fetched.autoplayMs
        }
    }

    /// Whether the curated carousel replaces the static hero (false until
    /// /hero resolves with at least one slide; a failed first fetch leaves
    /// it off, and a later refresh failure keeps the last good slides).
    var hasHeroSlides: Bool {
        !heroSlides.isEmpty
    }

    var bestSellers: [ProductEntity] {
        Self.bestSellers(from: products)
    }

    /// Newest three stories for the home rail (empty hides the section).
    var latestStories: [StoryEntity] {
        Array(stories.prefix(Self.journalRailCount))
    }

    /// `featured == true` rows in server order; when nothing is flagged the
    /// rail falls back to the first 8 products alphabetically (mirrors
    /// Android's HomeScreen slicing, deterministic across launches).
    nonisolated static func bestSellers(from products: [ProductEntity]) -> [ProductEntity] {
        let featured = products.filter { $0.featured == true }
        if !featured.isEmpty { return featured }
        return Array(products.sorted { $0.name < $1.name }.prefix(fallbackRailCount))
    }

    /// Shop-by-vertical portals: mithai derives off the offline catalog
    /// (count + the hero image), the other three off their fetched first
    /// pages — a failed vertical degrades to count 0 / placeholder tile,
    /// never fails the row.
    nonisolated static func portals(
        products: [ProductEntity],
        snacks: SnackPageDTO?,
        qsr: QsrPageDTO?,
        merch: MerchPageDTO?
    ) -> [VerticalPortal] {
        [
            VerticalPortal(
                vertical: .mithai,
                count: products.count,
                imageURL: bestSellers(from: products).first?.images?.first
            ),
            VerticalPortal(
                vertical: .snacks,
                count: snacks?.total ?? 0,
                imageURL: snacks?.items.first?.images?.first
            ),
            VerticalPortal(
                vertical: .qsr,
                count: qsr?.total ?? 0,
                imageURL: qsr?.items.first?.image
            ),
            VerticalPortal(
                vertical: .merch,
                count: merch?.total ?? 0,
                imageURL: merch?.items.first?.images?.first
            ),
        ]
    }
}
