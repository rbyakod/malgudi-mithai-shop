// CartViewModel.swift — Task 17.1 (Mishran Mobile Apps v1).
// Cart mutations + totals over the singleton CartEntity. The view layer
// observes rows via @Query; this view model owns the writes and math.
import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class CartViewModel {
    private let context: ModelContext

    private(set) var items: [CartItemEntity] = []

    init(context: ModelContext) {
        self.context = context
        reload()
    }

    func reload() {
        items = ProductDetailViewModel.findOrCreateCart(in: context).items.sorted { $0.name < $1.name }
    }

    var totalPaise: Int {
        Self.totalPaise(of: items)
    }

    var itemCount: Int {
        items.reduce(0) { $0 + $1.quantity }
    }

    /// Stepper changes from the cart floor at 1 (0 = remove instead).
    func setQuantity(productId: String, quantity: Int) {
        guard let line = items.first(where: { $0.productId == productId }) else { return }
        line.quantity = max(1, min(quantity, ProductDetailViewModel.maxQuantity))
        try? context.save()
        reload()
    }

    func removeLine(productId: String) {
        guard let line = items.first(where: { $0.productId == productId }) else { return }
        context.delete(line)
        try? context.save()
        reload()
    }

    /// Empty the cart but keep the singleton row (see CartEntity.delete note
    /// in SwiftDataModels — the cart itself never needs deleting in v1).
    func clear() {
        for line in items {
            context.delete(line)
        }
        try? context.save()
        reload()
    }

    /// Pure — sum of unitPricePaise × quantity over the lines.
    nonisolated static func totalPaise(of items: [CartItemEntity]) -> Int {
        items.reduce(0) { $0 + $1.unitPricePaise * $1.quantity }
    }
}
