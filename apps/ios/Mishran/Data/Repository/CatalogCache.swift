// CatalogCache.swift — Task 16.2 (Mishran Mobile Apps v1).
// SwiftData-backed catalog cache + ETag persistence (UserDefaults
// "catalogEtag" per plan). Main-actor: shares the container's mainContext.
import Foundation
import SwiftData

@MainActor
final class CatalogCache {
    static let etagKey = "catalogEtag"

    private let context: ModelContext
    private let defaults: UserDefaults

    init(context: ModelContext, defaults: UserDefaults = .standard) {
        self.context = context
        self.defaults = defaults
    }

    // MARK: ETag

    var etag: String? {
        get { defaults.string(forKey: Self.etagKey) }
        set {
            if let newValue {
                defaults.set(newValue, forKey: Self.etagKey)
            } else {
                defaults.removeObject(forKey: Self.etagKey)
            }
        }
    }

    // MARK: Products

    func cachedProducts() -> [ProductEntity] {
        let descriptor = FetchDescriptor<ProductEntity>(sortBy: [SortDescriptor(\.name)])
        return (try? context.fetch(descriptor)) ?? []
    }

    /// Full swap: rows not in the fresh page are deleted (no zombies).
    func replaceAll(with products: [ProductDTO]) {
        for existing in cachedProducts() {
            context.delete(existing)
        }
        for dto in products {
            context.insert(ProductEntity(dto: dto))
        }
        try? context.save()
    }
}
