// CatalogViewModel.swift — Task 16.3 (Mishran Mobile Apps v1).
// Search + filter + sort state over CatalogRepository. Filtering and
// sorting are PURE static functions so the logic is testable without any
// repository. P3 parity: the search matcher widened beyond name (slug,
// story/ingredients, family, dietary tags — the web catalog's latitude),
// and the grid gained the persisted sort menu.
import Foundation
import Observation

struct CatalogFilters: Equatable {
    var family: ProductFamily? = nil
    /// Subset match: product must carry EVERY selected tag (AND).
    var dietary: Set<String> = []

    var isEmpty: Bool { family == nil && dietary.isEmpty }
}

@MainActor
@Observable
final class CatalogViewModel {
    private let repository: CatalogRepository
    private let defaults: UserDefaults

    private(set) var products: [ProductEntity] = []
    var searchText = ""
    var filters = CatalogFilters()
    /// P3: sort mode (Featured default); every change persists so the
    /// choice survives relaunches.
    var sort: CatalogSort {
        didSet { CatalogSort.store(sort, in: defaults) }
    }

    var isLoading: Bool { repository.isLoading }
    var errorMessage: String? { repository.errorMessage }

    init(repository: CatalogRepository, defaults: UserDefaults = .standard) {
        self.repository = repository
        self.defaults = defaults
        sort = CatalogSort.load(from: defaults)
        products = repository.products
    }

    /// Search + filters first (the user's intent narrows the set), THEN the
    /// sort re-orders whatever survived — same composition as the web grid.
    var filteredProducts: [ProductEntity] {
        sort.sorted(Self.filter(products, searchText: searchText, filters: filters))
    }

    func load(force: Bool = false) async {
        await repository.getCatalog(force: force)
        products = repository.products
    }

    /// Pure — query AND family AND every dietary tag. Empty search/empty
    /// filters pass everything.
    nonisolated static func filter(
        _ products: [ProductEntity],
        searchText: String,
        filters: CatalogFilters
    ) -> [ProductEntity] {
        products.filter {
            passes($0, filters: filters) && matches($0, searchText: searchText)
        }
    }

    /// Query match against the product's searchable text (case/diacritic-
    /// insensitive): name, slug, the long-form story/ingredients copy, the
    /// family raw value, and every dietary tag. The contract has no
    /// description field — story + ingredients are the long-form stand-ins
    /// ("cashew", "sugar-free" find what the name alone would hide).
    nonisolated static func matches(_ product: ProductEntity, searchText: String) -> Bool {
        let query = Self.normalizedQuery(searchText)
        guard !query.isEmpty else { return true }
        return Self.searchKey(product).contains(query)
    }

    /// Case/diacritic-folded query ("" when blank — passes everything).
    nonisolated static func normalizedQuery(_ searchText: String) -> String {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return trimmed.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
    }

    /// One folded haystack per product — the fields above joined, folded
    /// ONCE per pass. The naive per-field range(of:options:) walk measured
    /// ~25ms p95 over 500 rows (each call re-folded every haystack); a
    /// single fold + plain contains keeps the keystroke path inside the
    /// CatalogScrollTests 16ms frame budget.
    nonisolated static func searchKey(_ product: ProductEntity) -> String {
        var parts: [String] = [product.name, product.slug, product.family]
        if let story = product.story, !story.isEmpty { parts.append(story) }
        if let ingredients = product.ingredients, !ingredients.isEmpty { parts.append(ingredients) }
        parts.append(contentsOf: product.dietaryTags ?? [])
        return parts
            .joined(separator: " ")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
    }

    /// Family AND every selected dietary tag (subset).
    nonisolated static func passes(_ product: ProductEntity, filters: CatalogFilters) -> Bool {
        if let family = filters.family, product.family != family.rawValue {
            return false
        }
        if !filters.dietary.isEmpty {
            let tags = Set(product.dietaryTags ?? [])
            if !filters.dietary.isSubset(of: tags) {
                return false
            }
        }
        return true
    }
}
