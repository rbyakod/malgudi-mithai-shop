// ProductDetailViewModel.swift — Task 16.4 (Mishran Mobile Apps v1).
// Fetches a product by slug and upserts the singleton CartEntity +
// CartItemEntity on add-to-cart (same product merges into one line).
import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class ProductDetailViewModel {
    static let minQuantity = 1
    static let maxQuantity = 20

    private let slug: String
    private let client: MishranAPIClient
    private let context: ModelContext

    private(set) var product: ProductEntity?
    private(set) var isLoading = false
    private(set) var addedToCart = false
    var errorMessage: String?
    /// Plain stored property — @Observable's macro miscompiles property
    /// observers (runtime crash on mutation); clamping lives in setQuantity.
    var quantity = 1

    /// Clamp-aware setter (1...20).
    func setQuantity(_ value: Int) {
        quantity = min(max(value, Self.minQuantity), Self.maxQuantity)
    }

    init(slug: String, client: MishranAPIClient, context: ModelContext) {
        self.slug = slug
        self.client = client
        self.context = context
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let dto = try await client.productDetail(slug: slug)
            product = ProductEntity(dto: dto)
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
        } catch {
            errorMessage = "Couldn't load this sweet. Try again."
        }
    }

    /// Upsert: one CartEntity row (singleton), one line per product —
    /// repeat adds increment the existing quantity.
    func addToCart() {
        guard let product else { return }
        setQuantity(quantity) // never store an out-of-range line
        let cart = Self.findOrCreateCart(in: context)
        if let line = cart.items.first(where: { $0.productId == product.id }) {
            line.quantity = min(line.quantity + quantity, Self.maxQuantity)
        } else {
            let line = CartItemEntity(
                productId: product.id,
                name: product.name,
                slug: product.slug,
                unitPricePaise: Self.pricePaise(from: product.displayPrice) ?? 0,
                quantity: quantity
            )
            context.insert(line)
            line.cart = cart
        }
        try? context.save()
        addedToCart = true
    }

    /// Find the singleton cart, creating it on first add.
    nonisolated static func findOrCreateCart(in context: ModelContext) -> CartEntity {
        if let existing = (try? context.fetch(FetchDescriptor<CartEntity>()))?.first {
            return existing
        }
        let cart = CartEntity()
        context.insert(cart)
        return cart
    }

    /// "₹720/kg" → 72000 paise. Prices come display-formatted from the
    /// contract; parse the leading rupee figure. Returns nil when absent.
    nonisolated static func pricePaise(from displayPrice: String?) -> Int? {
        guard let displayPrice else { return nil }
        let digits = displayPrice.filter { $0.isNumber }
        guard let rupees = Int(digits) else { return nil }
        return rupees * 100
    }

    nonisolated private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load this sweet. Try again."
    }
}
