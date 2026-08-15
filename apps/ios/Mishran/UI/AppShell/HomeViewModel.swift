// HomeViewModel.swift — P1 parity (Mishran Mobile Apps v1).
// Home-tab state off the offline-first catalog (Android HomeViewModel
// parity): the screen derives its hero image, best-seller rail, and family
// counts from the one list — no dedicated home endpoint exists in the
// mobile v1 contract. Derivations are nonisolated pure functions so the
// featured/fallback rules are unit-testable without a repository.
import Foundation
import Observation

@MainActor
@Observable
final class HomeViewModel {
    /// Best-sellers rail length when nothing is featured-flagged.
    static let fallbackRailCount = 8

    private let repository: CatalogRepository

    private(set) var products: [ProductEntity] = []

    init(repository: CatalogRepository) {
        self.repository = repository
        products = repository.products
    }

    func load() async {
        await repository.getCatalog()
        products = repository.products
    }

    var bestSellers: [ProductEntity] {
        Self.bestSellers(from: products)
    }

    var familyChips: [FamilyChip] {
        Self.familyChips(from: products)
    }

    /// `featured == true` rows in server order; when nothing is flagged the
    /// rail falls back to the first 8 products alphabetically (mirrors
    /// Android's HomeScreen slicing, deterministic across launches).
    nonisolated static func bestSellers(from products: [ProductEntity]) -> [ProductEntity] {
        let featured = products.filter { $0.featured == true }
        if !featured.isEmpty { return featured }
        return Array(products.sorted { $0.name < $1.name }.prefix(fallbackRailCount))
    }

    /// Every family with its catalog count (declared order, Android
    /// FAMILY_LABELS parity) — chips seed the catalog tab's family filter.
    nonisolated static func familyChips(from products: [ProductEntity]) -> [FamilyChip] {
        ProductFamily.allCases.map { family in
            FamilyChip(
                family: family,
                count: products.filter { $0.family == family.rawValue }.count
            )
        }
    }
}

/// One Shop-by-family chip: family + how many catalog rows it would show.
struct FamilyChip: Equatable, Identifiable {
    let family: ProductFamily
    let count: Int

    var id: String { family.rawValue }

    /// "Classic · 12" when stocked, bare label otherwise (Android parity).
    var label: String {
        count > 0 ? "\(family.displayName) · \(count)" : family.displayName
    }
}
