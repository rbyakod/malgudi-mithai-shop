// ProductDetailViewModel.swift — Task 16.4 / P1 parity (Mishran Mobile Apps v1).
// Fetches a product by slug and upserts the singleton CartEntity +
// CartItemEntity on add-to-cart. P1: derives the pack-size chips from the
// display price (PackSizes — port of the web algorithm) and keys derived
// pack lines as `${productId}:${label}`; the base pack keeps the bare id so
// pre-pack carts still merge.
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
    /// Pack-size chips derived from the display price + weight (empty when
    /// neither parses — then the PDP renders no chips at all).
    private(set) var packSizes: [PackSize] = []
    /// Selected chip; the base rung (the one priced verbatim) by default.
    var selectedPack: PackSize?
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
            // Offline-first: fall back to the cached/seeded row before
            // surfacing an error (catalog 16.3 does the same via the
            // repository cache; detail reads the store directly).
            if let cached = Self.cachedProduct(slug: slug, in: context) {
                product = cached
            } else {
                errorMessage = Self.message(for: error)
            }
        } catch {
            if let cached = Self.cachedProduct(slug: slug, in: context) {
                product = cached
            } else {
                errorMessage = "Couldn't load this sweet. Try again."
            }
        }
        derivePackSizes()
    }

    /// Price line the PDP renders — the selected chip's label, falling back
    /// to the raw display price when no chips derive.
    var priceLine: String? {
        selectedPack?.priceLabel ?? product?.displayPrice
    }

    func selectPack(_ pack: PackSize) {
        guard packSizes.contains(pack) else { return }
        selectedPack = pack
    }

    /// Derive chips off whichever product row loaded (network or cache) and
    /// default to the base rung — the option carrying the verbatim price.
    private func derivePackSizes() {
        guard let product else {
            packSizes = []
            selectedPack = nil
            return
        }
        packSizes = PackSizes.derivePackSizes(displayPrice: product.displayPrice, weight: product.weight)
        selectedPack = packSizes.first { $0.priceLabel == product.displayPrice } ?? packSizes.first
    }

    /// Fetch the cached catalog row for a slug (nil when never cached).
    nonisolated static func cachedProduct(slug: String, in context: ModelContext) -> ProductEntity? {
        let descriptor = FetchDescriptor<ProductEntity>(
            predicate: #Predicate { $0.slug == slug }
        )
        return (try? context.fetch(descriptor))?.first
    }

    /// Upsert: one CartEntity row (singleton), one line per pack — repeat
    /// adds increment the existing quantity.
    func addToCart() {
        guard let product else { return }
        setQuantity(quantity) // never store an out-of-range line
        let cart = Self.findOrCreateCart(in: context)
        let lineId = Self.lineId(productId: product.id, pack: selectedPack, displayPrice: product.displayPrice)
        if let line = cart.items.first(where: { $0.productId == lineId }) {
            line.quantity = min(line.quantity + quantity, Self.maxQuantity)
        } else {
            let line = CartItemEntity(
                productId: lineId,
                name: product.name,
                slug: product.slug,
                packLabel: Self.packLabel(pack: selectedPack, displayPrice: product.displayPrice),
                unitPricePaise: Self.pricePaise(from: selectedPack?.priceLabel ?? product.displayPrice) ?? 0,
                quantity: quantity
            )
            context.insert(line)
            line.cart = cart
        }
        try? context.save()
        addedToCart = true
    }

    /// Derived pack lines key as `${productId}:${label}`; the base pack (the
    /// chip priced verbatim, or no chips at all) keeps the bare productId.
    nonisolated static func lineId(productId: String, pack: PackSize?, displayPrice: String?) -> String {
        guard let pack, Self.isDerivedPack(pack, displayPrice: displayPrice) else { return productId }
        return "\(productId):\(pack.label)"
    }

    /// Quick add (catalog card, P3 parity): upsert the BASE pack line off a
    /// catalog row — bare productId, verbatim displayPrice, packLabel nil —
    /// so the line merges both with earlier quick adds AND with the PDP's
    /// own base-pack addToCart (same id by construction; a derived-pack line
    /// on the same product stacks separately, exactly like two PDP chips).
    nonisolated static func quickAddToCart(
        _ product: ProductEntity,
        quantity: Int = 1,
        in context: ModelContext
    ) {
        let cart = findOrCreateCart(in: context)
        if let line = cart.items.first(where: { $0.productId == product.id }) {
            line.quantity = min(line.quantity + max(quantity, 1), maxQuantity)
        } else {
            let line = CartItemEntity(
                productId: product.id,
                name: product.name,
                slug: product.slug,
                packLabel: nil,
                unitPricePaise: pricePaise(from: product.displayPrice) ?? 0,
                quantity: max(quantity, 1)
            )
            context.insert(line)
            line.cart = cart
        }
        try? context.save()
    }

    /// Batch B4 (reorder): order lines → cart lines, straight into the local
    /// store (no server round-trip). The composite-id rule mirrors the PDP
    /// add: a derived pack re-keys as `${productId}:${packLabel}` so the
    /// reordered size merges with a fresh add of the same chip, while a nil
    /// packLabel (base pack, or a pre-Batch-A order) falls back to the bare
    /// productId exactly like quick add. Machine paise flows through
    /// unchanged — order lines already carry unit priceInPaise. Returns the
    /// number of lines inserted or merged (0 for an itemless order — the
    /// caller then skips the cart trip).
    nonisolated static func reorderToCart(_ items: [OrderItemDTO], in context: ModelContext) -> Int {
        guard !items.isEmpty else { return 0 }
        let cart = findOrCreateCart(in: context)
        for item in items {
            let lineId = item.packLabel.map { "\(item.productId):\($0)" } ?? item.productId
            if let line = cart.items.first(where: { $0.productId == lineId }) {
                line.quantity = min(line.quantity + max(item.quantity, 1), maxQuantity)
            } else {
                let line = CartItemEntity(
                    productId: lineId,
                    name: item.name,
                    slug: item.slug,
                    packLabel: item.packLabel,
                    unitPricePaise: item.priceInPaise,
                    quantity: min(max(item.quantity, 1), maxQuantity)
                )
                context.insert(line)
                line.cart = cart
            }
        }
        try? context.save()
        return items.count
    }

    /// Pack display label for a line — nil on the base pack (Android parity:
    /// "Null = base pack"), so cart rows show the chip only where it varies.
    nonisolated static func packLabel(pack: PackSize?, displayPrice: String?) -> String? {
        guard let pack, Self.isDerivedPack(pack, displayPrice: displayPrice) else { return nil }
        return pack.label
    }

    /// A chip is "derived" when its price was scaled — the base rung keeps
    /// the verbatim displayPrice, so a different string means a sibling size.
    nonisolated private static func isDerivedPack(_ pack: PackSize, displayPrice: String?) -> Bool {
        pack.priceLabel != displayPrice
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
    /// contract; parse the leading rupee figure via PackSizes.parsePrice —
    /// the old digit-scrape misread per-gram strings ("₹1,109 / 1 kg" →
    /// 1109100 paise instead of 110900). Returns nil when unparseable.
    nonisolated static func pricePaise(from displayPrice: String?) -> Int? {
        guard let displayPrice, let rupees = PackSizes.parsePrice(displayPrice) else { return nil }
        return Int((rupees * 100).rounded())
    }

    nonisolated private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load this sweet. Try again."
    }
}
