// Route.swift — Task 14.4 (Mishran Mobile Apps v1).
// Navigation destinations. Cases grow as screens land (catalog 16.x,
// checkout 17.x); the enum is the single source of truth for the stack.
import Foundation

enum Route: Hashable {
    case productDetail(slug: String)
    case cart
    case checkout
    case orderConfirmed(id: String)
    case orders
    case orderDetail(id: String)
    case account
}
