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
    var productId: String
    var name: String
    var slug: String
    /// Paise — integer money, never floats (contract parity).
    var unitPricePaise: Int
    var quantity: Int
    var addedAt: Date
    var cart: CartEntity?

    init(
        productId: String,
        name: String,
        slug: String,
        unitPricePaise: Int,
        quantity: Int,
        addedAt: Date = Date(),
        cart: CartEntity? = nil
    ) {
        self.productId = productId
        self.name = name
        self.slug = slug
        self.unitPricePaise = unitPricePaise
        self.quantity = quantity
        self.addedAt = addedAt
        self.cart = cart
    }
}

@Model
final class AddressEntity {
    @Attribute(.unique) var id: String
    var label: String
    var line1: String
    var line2: String?
    var city: String
    var pincode: String
    var phone: String
    var isDefault: Bool

    init(
        id: String,
        label: String,
        line1: String,
        line2: String? = nil,
        city: String,
        pincode: String,
        phone: String,
        isDefault: Bool = false
    ) {
        self.id = id
        self.label = label
        self.line1 = line1
        self.line2 = line2
        self.city = city
        self.pincode = pincode
        self.phone = phone
        self.isDefault = isDefault
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
