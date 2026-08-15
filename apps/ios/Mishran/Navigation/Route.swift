// Route.swift — Task 14.4 (Mishran Mobile Apps v1).
// Navigation destinations. Cases grow as screens land (catalog 16.x,
// checkout 17.x); the enum is the single source of truth for the stack.
import Foundation

enum Route: Hashable {
    case productDetail(slug: String)
    /// P1: the full catalog grid (Home keeps the marketing surface; family
    /// seeds the catalog tab's filter — the iOS stand-in for Android's
    /// SavedStateHandle deep link).
    case catalog(family: ProductFamily?)
    case cart
    case checkout
    case orderConfirmed(id: String)
    case orders
    case orderDetail(id: String)
    case account
    /// Task 48.2: saved-address management (Account → Delivery addresses).
    case addresses
}
