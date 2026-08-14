// SeedData.swift — UI-test seam (same convention as `-authScreen`): the
// `-seedCatalog` launch argument seeds two ProductEntity rows so headless
// UI tests can drive the catalog grid + product detail without a backend.
// Never runs in production: the argument is absent on real launches.
import Foundation
import SwiftData

enum SeedData {
    static let seedCatalogArgument = "-seedCatalog"

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
}
