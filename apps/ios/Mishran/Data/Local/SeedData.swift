// SeedData.swift — UI-test seam (same convention as `-authScreen`): the
// `-seedCatalog` launch argument seeds two ProductEntity rows so headless
// UI tests can drive the catalog grid + product detail without a backend.
// `-resetStore` wipes persisted rows first — the SwiftData store survives
// app relaunches on the simulator, so a live-API run earlier in the suite
// would otherwise leak its catalog into seeded tests (the home rail only
// shows 8 rows, so stale rows break seed expectations). Neither ever runs
// in production: the arguments are absent on real launches.
import Foundation
import SwiftData

enum SeedData {
    static let seedCatalogArgument = "-seedCatalog"
    static let resetStoreArgument = "-resetStore"

    @MainActor
    static func seedCatalogIfNeeded(context: ModelContext) {
        let samples = [
            ("p_seed_1", "kaju-katli", "Kaju Katli", "dryfruit", "₹720/kg"),
            ("p_seed_2", "motichoor-laddoo", "Motichoor Laddoo", "classic", "₹480/kg"),
        ]
        let existing = (try? context.fetch(FetchDescriptor<ProductEntity>())) ?? []
        let existingSlugs = Set(existing.map(\.slug))
        var inserted = false
        for (id, slug, name, family, price) in samples where !existingSlugs.contains(slug) {
            context.insert(ProductEntity(
                id: id,
                slug: slug,
                name: name,
                family: family,
                displayPrice: price
            ))
            inserted = true
        }
        if inserted {
            try? context.save()
        }
    }

    /// Delete every persisted entity + the catalog ETag. Runs before
    /// `-seedCatalog` seeding so a launch starts from a known-empty store.
    @MainActor
    static func resetStoreIfNeeded(context: ModelContext) {
        guard ProcessInfo.processInfo.arguments.contains(resetStoreArgument) else { return }
        for cart in (try? context.fetch(FetchDescriptor<CartEntity>())) ?? [] {
            // Items too — iOS 17.2 SwiftData ignores the cascade rule
            // (see CartEntity.delete).
            cart.delete(in: context)
        }
        for product in (try? context.fetch(FetchDescriptor<ProductEntity>())) ?? [] {
            context.delete(product)
        }
        for address in (try? context.fetch(FetchDescriptor<AddressEntity>())) ?? [] {
            context.delete(address)
        }
        for order in (try? context.fetch(FetchDescriptor<OrderEntity>())) ?? [] {
            context.delete(order)
        }
        for category in (try? context.fetch(FetchDescriptor<CategoryEntity>())) ?? [] {
            context.delete(category)
        }
        UserDefaults.standard.removeObject(forKey: CatalogCache.etagKey)
        try? context.save()
    }
}
