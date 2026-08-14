// CatalogViewModel.swift — Task 16.3 (Mishran Mobile Apps v1).
// Search + filter state over CatalogRepository. Filtering is a PURE static
// function so the logic is testable without any repository.
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

    private(set) var products: [ProductEntity] = []
    var searchText = ""
    var filters = CatalogFilters()

    var isLoading: Bool { repository.isLoading }
    var errorMessage: String? { repository.errorMessage }

    init(repository: CatalogRepository) {
        self.repository = repository
        products = repository.products
    }

    var filteredProducts: [ProductEntity] {
        Self.filter(products, searchText: searchText, filters: filters)
    }

    func load(force: Bool = false) async {
        await repository.getCatalog(force: force)
        products = repository.products
    }

    /// Pure — name search (case/diacritic-insensitive) AND family AND
    /// every dietary tag. Empty search/empty filters pass everything.
    nonisolated static func filter(
        _ products: [ProductEntity],
        searchText: String,
        filters: CatalogFilters
    ) -> [ProductEntity] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return products.filter { product in
            if !query.isEmpty,
               product.name.range(of: query, options: [.caseInsensitive, .diacriticInsensitive]) == nil {
                return false
            }
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
}
