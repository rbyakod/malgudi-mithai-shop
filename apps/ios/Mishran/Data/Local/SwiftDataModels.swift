// SwiftDataModels.swift — Task 16.1 (Mishran Mobile Apps v1).
// Offline-first local store (parity with Android's Room entities in 9.1).
// Arrays are stored as [String] (SwiftData supports native arrays of
// primitives); enums cached as raw value-strings (same convention as
// Android). Money is Int paise — never floats.
import Foundation
import SwiftData

@Model
final class ProductEntity {
    @Attribute(.unique) var id: String
    @Attribute(.unique) var slug: String
    var name: String
    var family: String
    var displayPrice: String?
    /// Net pack weight as display text ("250 g") — the pack-size fallback
    /// (P1 parity). Optional add → SwiftData lightweight migration.
    var weight: String?
    /// Flags the Best sellers rail (nil = unflagged; P1 parity).
    var featured: Bool?
    var freshnessStatus: String?
    var dietaryTags: [String]?
    var allergens: [String]?
    var ingredients: String?
    var shelfLife: String?
    var storage: String?
    var images: [String]?
    var story: String?
    var updatedAt: String?

    init(
        id: String,
        slug: String,
        name: String,
        family: String,
        displayPrice: String? = nil,
        weight: String? = nil,
        featured: Bool? = nil,
        freshnessStatus: String? = nil,
        dietaryTags: [String]? = nil,
        allergens: [String]? = nil,
        ingredients: String? = nil,
        shelfLife: String? = nil,
        storage: String? = nil,
        images: [String]? = nil,
        story: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.slug = slug
        self.name = name
        self.family = family
        self.displayPrice = displayPrice
        self.weight = weight
        self.featured = featured
        self.freshnessStatus = freshnessStatus
        self.dietaryTags = dietaryTags
        self.allergens = allergens
        self.ingredients = ingredients
        self.shelfLife = shelfLife
        self.storage = storage
        self.images = images
        self.story = story
        self.updatedAt = updatedAt
    }

    convenience init(dto: ProductDTO) {
        self.init(
            id: dto.id,
            slug: dto.slug,
            name: dto.name,
            family: dto.family.rawValue,
            displayPrice: dto.displayPrice,
            weight: dto.weight,
            featured: dto.featured,
            freshnessStatus: dto.freshnessStatus,
            dietaryTags: dto.dietaryTags,
            allergens: dto.allergens,
            ingredients: dto.ingredients,
            shelfLife: dto.shelfLife,
            storage: dto.storage,
            images: dto.images,
            story: dto.story,
            updatedAt: dto.updatedAt
        )
    }
}

@Model
final class CategoryEntity {
    @Attribute(.unique) var id: String
    @Attribute(.unique) var slug: String
    var name: String
    /// Product families grouped under this category (raw value-strings).
    var families: [String]

    init(id: String, slug: String, name: String, families: [String] = []) {
        self.id = id
        self.slug = slug
        self.name = name
        self.families = families
    }
}

@Model
final class CartEntity {
    /// v1 has one local cart — a singleton row keyed by this constant.
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \CartItemEntity.cart)
    var items: [CartItemEntity]

    init(createdAt: Date = Date(), items: [CartItemEntity] = []) {
        self.createdAt = createdAt
        self.items = items
    }

    static let singletonKey = "main"

    /// Delete the cart AND its items. The .cascade rule above is honored on
    /// newer OS runtimes but IGNORED by iOS 17.2's SwiftData (verified by
    /// the 16.1 cascade test + a standalone probe) — repositories must use
    /// this helper so the no-orphans invariant holds on every supported OS.
    func delete(in context: ModelContext) {
        for item in items {
            context.delete(item)
        }
        context.delete(self)
    }
}

@Model
final class CartItemEntity {
    /// No @Attribute(.unique) — iOS 17 SwiftData breaks relationship
    /// cascade rules on children with unique attributes (verified by the
    /// 16.1 cascade test); one-item-per-product is enforced by the
    /// repository, not the store.
    ///
    /// P1 parity (pack sizes): a DERIVED pack line keys itself as
    /// `${productId}:${packLabel}` ("p1:500g") so sibling sizes stack as
    /// separate lines; the base pack keeps the bare productId so pre-pack
    /// carts keep merging. The server CartItem has no variant field — the
    /// place-order path collapses lines by BASE productId (everything
    /// before the first ":") before POST cart/validate.
    var productId: String
    var name: String
    var slug: String
    /// Selected pack chip ("500g"), when the line was added from a derived
    /// one — display metadata only (nil = base pack).
    var packLabel: String?
    /// Paise — integer money, never floats (contract parity).
    var unitPricePaise: Int
    var quantity: Int
    var addedAt: Date
    var cart: CartEntity?

    init(
        productId: String,
        name: String,
        slug: String,
        packLabel: String? = nil,
        unitPricePaise: Int,
        quantity: Int,
        addedAt: Date = Date(),
        cart: CartEntity? = nil
    ) {
        self.productId = productId
        self.name = name
        self.slug = slug
        self.packLabel = packLabel
        self.unitPricePaise = unitPricePaise
        self.quantity = quantity
        self.addedAt = addedAt
        self.cart = cart
    }

    /// The catalog id a line collapses to at place-order time — derived pack
    /// ids carry a ":label" suffix, base ids never do.
    var baseProductId: String {
        guard let separator = productId.firstIndex(of: ":") else { return productId }
        return String(productId[..<separator])
    }
}

@Model
final class AddressEntity {
    // Task 48.2: redefined to mirror the server's Address schema (the old
    // label/phone fields never matched anything real — nothing wrote this
    // entity before the addresses flow landed). SwiftData's lightweight
    // migration handles the field swap on existing pre-launch installs.
    @Attribute(.unique) var id: String
    var line1: String
    var line2: String?
    var city: String
    var state: String
    var pincode: String
    /// Raw value-string ("home"/"work"/"other") — same enum-caching
    /// convention as ProductEntity.family.
    var tag: String?
    var isDefault: Bool

    init(
        id: String,
        line1: String,
        line2: String? = nil,
        city: String,
        state: String,
        pincode: String,
        tag: String? = nil,
        isDefault: Bool = false
    ) {
        self.id = id
        self.line1 = line1
        self.line2 = line2
        self.city = city
        self.state = state
        self.pincode = pincode
        self.tag = tag
        self.isDefault = isDefault
    }

    convenience init(dto: AddressDTO) {
        self.init(
            id: dto.id ?? UUID().uuidString,
            line1: dto.line1 ?? "",
            line2: dto.line2,
            city: dto.city ?? "",
            state: dto.state ?? "",
            pincode: dto.pincode ?? "",
            tag: dto.tag?.rawValue,
            isDefault: dto.isDefault ?? false
        )
    }

    /// Server list → local rows: delete-all + re-insert (no per-row diffing
    /// in v1 — AddressPicker's @Query just needs the current set). The
    /// server is the source of truth; the cache exists so checkout works
    /// the moment it renders.
    static func replaceAll(with addresses: [AddressDTO], in context: ModelContext) {
        for existing in (try? context.fetch(FetchDescriptor<AddressEntity>())) ?? [] {
            context.delete(existing)
        }
        for address in addresses {
            context.insert(AddressEntity(dto: address))
        }
        try? context.save()
    }
}

@Model
final class OrderEntity {
    @Attribute(.unique) var id: String
    /// State-machine stage as raw value-string ("confirmed", …).
    var status: String
    var totalPaise: Int
    /// Order lines serialized as JSON (v1 renders from server DTOs; the
    /// cache only needs enough for the list row + detail offline fallback).
    var itemsJSON: String
    var placedAt: String
    var syncedAt: Date

    init(
        id: String,
        status: String,
        totalPaise: Int,
        itemsJSON: String,
        placedAt: String,
        syncedAt: Date = Date()
    ) {
        self.id = id
        self.status = status
        self.totalPaise = totalPaise
        self.itemsJSON = itemsJSON
        self.placedAt = placedAt
        self.syncedAt = syncedAt
    }
}

/// Journal story cache (P2). Offline read model for the stories list +
/// home rail — the reader's `body` is NOT cached (it only ships on the
/// detail route and would double the row size for a rarely-read field), so
/// an offline reader falls back to title/hero/excerpt off the cached row.
@Model
final class StoryEntity {
    @Attribute(.unique) var id: String
    @Attribute(.unique) var slug: String
    var title: String
    /// Editorial pillar as raw value-string ("sweets", "people", …).
    var pillar: String?
    var excerpt: String?
    var heroImage: String?
    /// ISO-8601 string as the contract ships it — parsed only for sorting
    /// (newest first) and display.
    var publishedAt: String?
    var updatedAt: String?

    init(
        id: String,
        slug: String,
        title: String,
        pillar: String? = nil,
        excerpt: String? = nil,
        heroImage: String? = nil,
        publishedAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.slug = slug
        self.title = title
        self.pillar = pillar
        self.excerpt = excerpt
        self.heroImage = heroImage
        self.publishedAt = publishedAt
        self.updatedAt = updatedAt
    }

    convenience init(dto: StoryDTO) {
        self.init(
            id: dto.id,
            slug: dto.slug,
            title: dto.title,
            pillar: dto.pillar,
            excerpt: dto.excerpt,
            heroImage: dto.heroImage,
            publishedAt: dto.publishedAt,
            updatedAt: dto.updatedAt
        )
    }

    /// Cached rows, newest first (nil/unparseable publishedAt sorts last,
    /// name as the tiebreak so the order stays deterministic).
    static func cachedStories(in context: ModelContext) -> [StoryEntity] {
        let rows = (try? context.fetch(FetchDescriptor<StoryEntity>())) ?? []
        return rows.sorted { lhs, rhs in
            let lhsDate = StoryFormatting.date(fromISO: lhs.publishedAt) ?? .distantPast
            let rhsDate = StoryFormatting.date(fromISO: rhs.publishedAt) ?? .distantPast
            if lhsDate != rhsDate { return lhsDate > rhsDate }
            return lhs.title < rhs.title
        }
    }

    /// Server list → local rows: delete-all + re-insert (the same full-swap
    /// reconcile AddressEntity uses — no per-row diffing in v1, the server
    /// is the source of truth and the set is small).
    static func replaceAll(with stories: [StoryDTO], in context: ModelContext) {
        for existing in (try? context.fetch(FetchDescriptor<StoryEntity>())) ?? [] {
            context.delete(existing)
        }
        for story in stories {
            context.insert(StoryEntity(dto: story))
        }
        try? context.save()
    }

    /// One cached row by slug (reader's offline fallback).
    static func fetch(slug: String, in context: ModelContext) -> StoryEntity? {
        let descriptor = FetchDescriptor<StoryEntity>(predicate: #Predicate { $0.slug == slug })
        return (try? context.fetch(descriptor))?.first
    }
}
