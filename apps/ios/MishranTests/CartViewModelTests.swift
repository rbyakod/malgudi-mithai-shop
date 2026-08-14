// Task 17.1 (Mishran Mobile Apps v1): CartViewModel tests — totals, line
// mutations, and clearing over the in-memory SwiftData store.
import SwiftData
import XCTest
@testable import Mishran

@MainActor
final class CartViewModelTests: XCTestCase {
    private var container: ModelContainer!
    private var context: ModelContext!

    override func setUp() {
        super.setUp()
        container = try! ModelContainerFactory.makeContainer(inMemory: true)
        context = container.mainContext
    }

    override func tearDown() {
        container = nil
        context = nil
        super.tearDown()
    }

    @discardableResult
    private func seedCart(lines: [(id: String, price: Int, qty: Int)]) -> CartEntity {
        let cart = ProductDetailViewModel.findOrCreateCart(in: context)
        for line in lines {
            let item = CartItemEntity(
                productId: line.id, name: "Sweet \(line.id)", slug: line.id,
                unitPricePaise: line.price, quantity: line.qty
            )
            context.insert(item)
            item.cart = cart
        }
        try? context.save()
        return cart
    }

    func testTotalIsSumOfPriceTimesQuantity() {
        seedCart(lines: [("p1", price: 72000, qty: 2), ("p2", price: 36000, qty: 1)])
        let vm = CartViewModel(context: context)

        XCTAssertEqual(vm.items.count, 2)
        XCTAssertEqual(vm.totalPaise, 72000 * 2 + 36000)
    }

    func testEmptyCartTotalsZero() {
        _ = ProductDetailViewModel.findOrCreateCart(in: context)
        let vm = CartViewModel(context: context)
        XCTAssertEqual(vm.items.count, 0)
        XCTAssertEqual(vm.totalPaise, 0)
    }

    func testChangeQuantityUpdatesLineAndTotal() {
        seedCart(lines: [("p1", price: 50000, qty: 1)])
        let vm = CartViewModel(context: context)

        vm.setQuantity(productId: "p1", quantity: 3)
        XCTAssertEqual(vm.totalPaise, 150000)

        // Floor at 1 from the cart UI too.
        vm.setQuantity(productId: "p1", quantity: 0)
        XCTAssertEqual(vm.items.first?.quantity, 1)
    }

    func testRemoveLineDeletesRow() throws {
        seedCart(lines: [("p1", price: 50000, qty: 1), ("p2", price: 10000, qty: 1)])
        let vm = CartViewModel(context: context)

        vm.removeLine(productId: "p1")
        XCTAssertEqual(vm.items.count, 1)
        XCTAssertEqual(vm.items.first?.productId, "p2")
        XCTAssertEqual(try context.fetch(FetchDescriptor<CartItemEntity>()).count, 1)
    }

    func testClearCartRemovesAllLinesButKeepsCartRow() throws {
        seedCart(lines: [("p1", price: 50000, qty: 1), ("p2", price: 10000, qty: 2)])
        let vm = CartViewModel(context: context)

        vm.clear()
        XCTAssertEqual(vm.items.count, 0)
        XCTAssertEqual(vm.totalPaise, 0)
        XCTAssertEqual(try context.fetch(FetchDescriptor<CartItemEntity>()).count, 0)
        XCTAssertEqual(try context.fetch(FetchDescriptor<CartEntity>()).count, 1,
                       "the singleton cart row survives, emptied")
    }

    func testPureTotalComputation() {
        let lines = [
            CartItemEntity(productId: "a", name: "A", slug: "a", unitPricePaise: 100, quantity: 2),
            CartItemEntity(productId: "b", name: "B", slug: "b", unitPricePaise: 250, quantity: 4),
        ]
        XCTAssertEqual(CartViewModel.totalPaise(of: lines), 1200)
        XCTAssertEqual(CartViewModel.totalPaise(of: []), 0)
    }
}
