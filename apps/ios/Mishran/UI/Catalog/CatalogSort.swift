// CatalogSort.swift — P3 parity (Mishran Mobile Apps v1).
// Sort modes for the mithai catalog grid: Featured (featured-flagged rows
// first, then name — the best-sellers rule) or name A–Z / Z–A. The choice
// persists in UserDefaults so a shopper's preferred ordering survives
// relaunches (web's ?sort= counterpart, minus the URL). The comparator is
// a pure function so ordering rules are unit-testable without a repository.
import Foundation

enum CatalogSort: String, CaseIterable, Identifiable {
    case featured
    case nameAsc
    case nameDesc

    var id: String { rawValue }

    /// UserDefaults key the persisted choice lives under.
    static let defaultsKey = "catalog.sort"

    var displayName: String {
        switch self {
        case .featured: L("catalog.sort.featured")
        case .nameAsc: L("catalog.sort.name_asc")
        case .nameDesc: L("catalog.sort.name_desc")
        }
    }

    /// True when `lhs` orders before `rhs` under this mode. Name compares
    /// are case/diacritic-insensitive (same latitude as the search matcher).
    var areInIncreasingOrder: (ProductEntity, ProductEntity) -> Bool {
        switch self {
        case .featured:
            return { lhs, rhs in
                let lhsFeatured = lhs.featured == true
                let rhsFeatured = rhs.featured == true
                if lhsFeatured != rhsFeatured { return lhsFeatured }
                return Self.nameAscending(lhs, rhs)
            }
        case .nameAsc:
            return Self.nameAscending
        case .nameDesc:
            return { lhs, rhs in Self.nameAscending(rhs, lhs) }
        }
    }

    /// Sorted copy under this mode, with the fold keys computed ONCE per
    /// row (areInIncreasingOrder re-folds both names on every comparison —
    /// fine for a handful of rows, O(n log n) folds for a 500-row grid).
    nonisolated func sorted(_ products: [ProductEntity]) -> [ProductEntity] {
        products
            .map { product -> (featured: Bool, key: String, product: ProductEntity) in
                (product.featured == true, Self.folded(product.name), product)
            }
            .sorted { lhs, rhs in
                switch self {
                case .featured:
                    if lhs.featured != rhs.featured { return lhs.featured }
                    return lhs.key < rhs.key
                case .nameAsc:
                    return lhs.key < rhs.key
                case .nameDesc:
                    return lhs.key > rhs.key
                }
            }
            .map(\.product)
    }

    /// Folded, case/diacritic-insensitive name comparison.
    nonisolated private static func nameAscending(_ lhs: ProductEntity, _ rhs: ProductEntity) -> Bool {
        folded(lhs.name) < folded(rhs.name)
    }

    nonisolated private static func folded(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
    }

    /// Persisted choice (Featured when nothing valid was stored — a raw
    /// value from a future mode falls back, never crashes).
    nonisolated static func load(from defaults: UserDefaults) -> CatalogSort {
        guard let raw = defaults.string(forKey: defaultsKey),
              let sort = CatalogSort(rawValue: raw) else { return .featured }
        return sort
    }

    nonisolated static func store(_ sort: CatalogSort, in defaults: UserDefaults) {
        defaults.set(sort.rawValue, forKey: defaultsKey)
    }
}
