// Route.swift — Task 14.4 (Mishran Mobile Apps v1).
// Navigation destinations. Cases grow as screens land (catalog 16.x,
// checkout 17.x); the enum is the single source of truth for the stack.
import Foundation

enum Route: Hashable {
    case productDetail(slug: String)
    /// P1: the full catalog grid (Home keeps the marketing surface; family
    /// seeds the catalog tab's filter — the iOS stand-in for Android's
    /// SavedStateHandle deep link). P2: the grid grew vertical tabs, so the
    /// route now also carries the preselected tab (Home's portals push with
    /// snacks/qsr/merch).
    case catalog(vertical: Vertical, family: ProductFamily?)
    /// P2: per-vertical detail screen (snack / QSR item / merch).
    case verticalDetail(vertical: Vertical, slug: String)
    case cart
    case checkout
    case orderConfirmed(id: String)
    case orders
    case orderDetail(id: String)
    case account
    /// Task 48.2: saved-address management (Account → Delivery addresses).
    case addresses
    /// P2: journal list + reader (Home rail and Account both push here).
    /// P3 parity: an optional pillar preselects the list's filter chip —
    /// Home's "Why Mishran" strip deep-links each pillar card to its stories
    /// (nil = the unfiltered list; the default keeps existing call sites
    /// reading as before).
    case stories(pillar: String? = nil)
    case story(slug: String)
    /// P2: bulk & events enquiry. Merch detail pushes with .corporate
    /// pre-set; Account's row defaults to .wedding.
    case enquiry(type: EnquiryType)
    /// P3 parity: the gift-box builder (Account's "Build a gift" row) —
    /// posts a "gift-builder-draft" lead through the same LeadRepository.
    case gift
}
