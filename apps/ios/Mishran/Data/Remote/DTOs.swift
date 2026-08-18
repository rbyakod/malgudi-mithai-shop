// DTOs.swift — Task 14.3 (Mishran Mobile Apps v1).
// Decodable mirrors of the mobile v1 contract (openapi.yaml schemas). JSON is
// camelCase end-to-end, so the default key strategy applies — no conversion.
import Foundation

/// {data: ...} response envelope every route wraps its payload in.
struct Envelope<T: Decodable>: Decodable {
    let data: T
}

struct ErrorEnvelope: Decodable {
    struct Body: Decodable {
        let code: APIErrorCode
        let message: String
        let fieldErrors: [String: String]?
        let traceId: String?
    }
    let error: Body
}

// MARK: - Auth

struct OtpSendRequestDTO: Encodable {
    let phone: String
}

struct OtpSendResponseDTO: Decodable {
    let requestId: String
    let expiresAt: String
}

struct OtpVerifyRequestDTO: Encodable {
    let requestId: String
    let code: String
}

struct CustomerDTO: Decodable, Equatable {
    let id: String
    /// Apple-only customers have no phone — nullable in the /auth/apple
    /// response (the 15.2 tests caught the non-optional mismatch).
    let phone: String?
    let name: String?
    let email: String?
    let locale: String?
    let createdAt: String?
}

struct OtpVerifyResponseDTO: Decodable {
    let accessToken: String
    let refreshToken: String
    let customer: CustomerDTO
}

struct RefreshResponseDTO: Decodable {
    let accessToken: String
    let refreshToken: String
}

// MARK: - Addresses (Task 48.2)

/// Address tag (openapi enum: home | work | other).
enum AddressTag: String, Codable, CaseIterable, Identifiable, Hashable {
    case home, work, other

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

/// Saved address (openapi Address schema). Everything is optional on the
/// wire — the client stays lenient and lets the form validation own the
/// required-field rules for input.
struct AddressDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String?
    let customerId: String?
    let line1: String?
    let line2: String?
    let city: String?
    let state: String?
    let pincode: String?
    let lat: Double?
    let lng: Double?
    let tag: AddressTag?
    let isDefault: Bool?
}

/// POST/PATCH body (openapi AddressInput — required: line1, city, state,
/// pincode). Synthesized Encodable omits nil optionals, so blank line2/tag
/// ride nothing, exactly like the Android client's null-skipping serializer.
struct AddressInputDTO: Encodable, Equatable {
    var line1: String
    var line2: String?
    var city: String
    var state: String
    var pincode: String
    var lat: Double?
    var lng: Double?
    var tag: AddressTag?
    var isDefault: Bool?

    /// Rebuild a writable input from a fetched address (PATCH is a full
    /// replace) — only the default flag flips on set-default.
    init(
        address: AddressDTO,
        isDefault: Bool? = nil
    ) {
        self.init(
            line1: address.line1 ?? "",
            line2: address.line2,
            city: address.city ?? "",
            state: address.state ?? "",
            pincode: address.pincode ?? "",
            lat: address.lat,
            lng: address.lng,
            tag: address.tag,
            isDefault: isDefault ?? address.isDefault
        )
    }

    init(
        line1: String,
        line2: String? = nil,
        city: String,
        state: String,
        pincode: String,
        lat: Double? = nil,
        lng: Double? = nil,
        tag: AddressTag? = nil,
        isDefault: Bool? = nil
    ) {
        self.line1 = line1
        self.line2 = line2
        self.city = city
        self.state = state
        self.pincode = pincode
        self.lat = lat
        self.lng = lng
        self.tag = tag
        self.isDefault = isDefault
    }
}

/// GET /addresses page ({data:{items:[…]}}).
struct AddressPageDTO: Decodable, Equatable {
    let items: [AddressDTO]
}

/// POST/PATCH success body ({data:{address}}).
struct AddressMutationResponseDTO: Decodable, Equatable {
    let address: AddressDTO
}

/// {data:{ok:true}} — shared by DELETE /addresses/{id} and POST /auth/logout.
struct OkResponseDTO: Decodable, Equatable {
    let ok: Bool
}

// MARK: - Sign in with Apple

/// POST /auth/apple — {identityToken, name?}. Synthesized Encodable uses
/// encodeIfPresent for optionals, so a nil name is omitted from the body.
struct AppleAuthRequestDTO: Encodable {
    let identityToken: String
    let name: String?
}

/// Same shape as otp/verify: tokens + customer (backend upserts by appleSub).
typealias AppleAuthResponseDTO = OtpVerifyResponseDTO

// MARK: - Catalog

/// Product (openapi Product schema — required: id, slug, name, family).
struct ProductDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let family: ProductFamily
    let displayPrice: String?
    /// Net pack weight as display text, e.g. "250 g", "1 kg" — drives the
    /// pack-size chip fallback (P1 parity; see UI/Product/PackSizes.swift).
    let weight: String?
    /// Flags the product for the apps' Best sellers rail (absent = unflagged).
    let featured: Bool?
    let freshnessStatus: String?
    let dietaryTags: [String]?
    let allergens: [String]?
    let ingredients: String?
    let shelfLife: String?
    let storage: String?
    let images: [String]?
    let story: String?
    /// Karigar display name — only present when the server populated the
    /// relationship (PDP provenance strip; null when the field is a bare id).
    let karigarName: String?
    /// e.g. "Made to order in 24h" — freshness promise + trust strip.
    let leadTime: String?
    let updatedAt: String?
}

enum ProductFamily: String, Decodable, CaseIterable, Hashable {
    case classic, original
    case sugarFree = "sugar-free"
    case regional, seasonal
}

extension ProductDTO {
    /// Test/convenience initializer — optional fields default to nil.
    init(
        id: String,
        slug: String,
        name: String,
        family: ProductFamily,
        displayPrice: String? = nil,
        weight: String? = nil,
        featured: Bool? = nil,
        images: [String]? = nil
    ) {
        self.init(id: id, slug: slug, name: name, family: family, displayPrice: displayPrice,
                  weight: weight, featured: featured,
                  freshnessStatus: nil, dietaryTags: nil, allergens: nil, ingredients: nil,
                  shelfLife: nil, storage: nil, images: images, story: nil,
                  karigarName: nil, leadTime: nil, updatedAt: nil)
    }
}

/// Paginated envelope page (openapi Paginated schema).
struct ProductPageDTO: Decodable, Equatable {
    let items: [ProductDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

/// ETag-aware catalog result: 304 collapses to .notModified (cached copy is
/// still valid), 200 carries the fresh page.
enum CatalogResult: Equatable {
    case fresh(ProductPageDTO, etag: String?)
    case notModified
}

// MARK: - Brand (P1 parity: WhatsApp support; P3 parity: brand copy)

/// GET /brand — public support contact + brand copy
/// ({data:{whatsappNumber,whatsappDigits,brandName?,tagline?,positioning?}}).
/// Only those fields of the analytics-settings global are exposed; analytics
/// IDs deliberately never appear on this endpoint. The WhatsApp pair is
/// contract-required (decoding failures fall to the repository's hardcoded
/// fallback number); the copy trio is nullable — an unset Payload global
/// rides nothing and the callers fall back to the bundled app.* strings.
/// Optionals keep the UserDefaults-cached JSON decodable: JSONDecoder
/// ignores unknowns and missing keys decode as nil.
struct BrandDTO: Codable, Equatable {
    /// Display form, e.g. "+91-98765-43210".
    let whatsappNumber: String
    /// Digits only, for wa.me deep links.
    let whatsappDigits: String
    /// Live wordmark override (Home's static hero + fallbacks); nil = app.name.
    let brandName: String?
    /// Live tagline override (Home's announcement strip + static hero).
    let tagline: String?
    /// Positioning line (surfaced by later marketing surfaces; rides the
    /// cache so it round-trips even while nothing renders it yet).
    let positioning: String?

    init(
        whatsappNumber: String,
        whatsappDigits: String,
        brandName: String? = nil,
        tagline: String? = nil,
        positioning: String? = nil
    ) {
        self.whatsappNumber = whatsappNumber
        self.whatsappDigits = whatsappDigits
        self.brandName = brandName
        self.tagline = tagline
        self.positioning = positioning
    }
}

// MARK: - Hero (admin-curated home carousel)

/// One resolved slide of the admin-curated `home-hero` global (GET /hero —
/// the same list the web hero renders). `vertical` + `slug` is the apps'
/// deep-link vocabulary: mithai pushes Route.productDetail, other verticals
/// push Route.verticalDetail. Draft/imageless products are dropped
/// server-side, so every field the carousel renders is contract-required
/// except priceLabel (mithai displayPrice / merch price only).
struct HeroSlideDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    /// "mithai" | "qsr" | "snacks" | "merch".
    let vertical: String
    let slug: String
    /// captionOverride when the admin set one, else the product name.
    let name: String
    /// Display string, e.g. "₹720/kg"; nil on non-priced verticals.
    let priceLabel: String?
    let imageURL: String
    let imageAlt: String
}

/// GET /hero payload. Empty `slides` means the global is unset or nothing
/// resolved — the app keeps its local fallback hero, never a blank screen.
struct HeroDTO: Decodable, Equatable {
    let slides: [HeroSlideDTO]
    /// Autoplay interval, clamped server-side (3000…15000).
    let autoplayMs: Int
}

// MARK: - Cart snapshot + Razorpay payments (Task 17.3)

/// POST /cart/validate item — the server re-fetches products and prices; the
/// client only asserts what it wants to buy.
struct CartValidateItemDTO: Encodable, Equatable {
    let productId: String
    let quantity: Int
}

/// Slot as the snapshot contract stores it ({date, window}).
struct DeliverySlotDTO: Encodable, Equatable {
    let date: String
    let window: String
}

/// Synthesized Encodable omits a nil slot (optional per contract).
struct CartValidateRequestDTO: Encodable {
    let items: [CartValidateItemDTO]
    let pincode: String
    let slot: DeliverySlotDTO?
}

struct CartValidateResponseDTO: Decodable {
    let snapshotId: String
    let customerId: String
    let pincodeTier: String
    let expiresAt: String
}

struct CreateOrderRequestDTO: Encodable {
    let snapshotId: String
    let deliveryAddressId: String
}

struct CreateOrderResponseDTO: Decodable, Equatable {
    let orderId: String
    let razorpayOrderId: String
    let amountInPaise: Int
    let keyId: String
}

struct VerifyPaymentRequestDTO: Encodable {
    let orderId: String
    let razorpayPaymentId: String
    let signature: String
}

/// Order lifecycle — see LiveActivity/DeliveryAttributes.swift (shared
/// with the widget extension target; kept there so both bundles see it).

struct OrderItemDTO: Decodable, Equatable {
    let productId: String
    let slug: String
    let name: String
    let quantity: Int
    let unit: String?
    /// Pack chip the line sold ("500g") when it was a derived size — the
    /// Batch B4 reorder re-keys the cart line as `${productId}:${packLabel}`
    /// so it merges with a fresh PDP add of the same chip. Nil = base pack
    /// (or a pre-Batch-A order); the server omits/nulls the key there.
    let packLabel: String?
    let priceInPaise: Int
    let image: String?
}

struct OrderTotalsDTO: Decodable, Equatable {
    let itemsTotalInPaise: Int
    let deliveryFeeInPaise: Int
    let taxesInPaise: Int
    let discountInPaise: Int
    let totalInPaise: Int
}

/// Full order projection (GET /orders, GET /orders/{id}, verify response).
struct OrderDTO: Decodable, Equatable, Identifiable {
    let id: String
    let customerId: String
    let items: [OrderItemDTO]
    let totals: OrderTotalsDTO
    let status: OrderStatus
    let paymentStatus: String
    let createdAt: String
    let updatedAt: String
}

/// Paginated orders envelope (mirrors the products page shape).
struct OrderPageDTO: Decodable, Equatable {
    let items: [OrderDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

struct VerifyPaymentResponseDTO: Decodable {
    let order: OrderDTO
}

/// GET /account/loyalty-pass — 200 hands back a 24h signed .pkpass URL the
/// client redeems via PKAddPassesViewController (Task 19.1 backend).
/// LoyaltyTier lives in Wallet/LoyaltyPassManager.swift.
struct LoyaltyPassResponseDTO: Decodable {
    let url: String
    let serialNumber: String
    let tier: LoyaltyTier
}

// MARK: - Stories (P2 journal)

/// Story list projection (openapi Story schema via serializeStory). The
/// [slug] route adds `body` — see StoryDetailDTO.
struct StoryDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let slug: String
    let title: String
    /// Editorial pillar ("sweets", "people", …) — rendered as the row chip.
    let pillar: String?
    let excerpt: String?
    let heroImage: String?
    let publishedAt: String?
    let updatedAt: String?
}

/// GET /stories page ({data:{items:[…]}}) — mirrors ProductPageDTO.
struct StoryPageDTO: Decodable, Equatable {
    let items: [StoryDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

/// GET /stories/{slug} — the list projection plus the flattened body (the
/// server joins Lexical paragraphs into a plain \n-joined string, so the
/// reader renders one Text with system line breaks).
struct StoryDetailDTO: Decodable, Equatable {
    let id: String
    let slug: String
    let title: String
    let pillar: String?
    let excerpt: String?
    let heroImage: String?
    let publishedAt: String?
    let updatedAt: String?
    let body: String?

    /// List-projection view of the detail (cache inserts, rails).
    var story: StoryDTO {
        StoryDTO(
            id: id, slug: slug, title: title, pillar: pillar, excerpt: excerpt,
            heroImage: heroImage, publishedAt: publishedAt, updatedAt: updatedAt
        )
    }
}

// MARK: - Verticals (P2: snacks / QSR / merch)

/// External retailer row on a snack (serializeSnack `retailers[]`) — the
/// "Where to buy" links open outside the app.
struct SnackRetailerDTO: Decodable, Equatable, Identifiable, Hashable {
    let label: String
    let url: String
    var id: String { url }
}

/// Retail snack (SnackProducts schema). MSRP is display-only — purchases
/// happen at external retailers, never in-app.
struct SnackDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    /// Server-computed slugify(name) — no slug field on the collection.
    let slug: String
    let name: String
    let category: String?
    let description: String?
    let images: [String]?
    let weight: String?
    /// Display string, e.g. "₹60" (text field on the collection).
    let msrp: String?
    let retailers: [SnackRetailerDTO]?
    let updatedAt: String?
}

struct SnackPageDTO: Decodable, Equatable {
    let items: [SnackDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

/// QSR counter-menu item (QsrMenuItems schema). Walk-in vertical: no price,
/// no cart CTA — the app only says where to find it.
struct QsrItemDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let category: String?
    let description: String?
    /// Single hero image (unlike snacks/merch's array).
    let image: String?
    let veg: Bool?
    /// "mild" | "medium" | "hot" (collection select).
    let spiceLevel: String?
    /// Plain store-slug strings, e.g. ["indiranagar"].
    let availableAtStores: [String]?
    let updatedAt: String?
}

struct QsrPageDTO: Decodable, Equatable {
    let items: [QsrItemDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

/// Merch product (MerchProducts schema). Enquiry-led vertical: price is
/// display-only and `availability` ("enquiry-only") routes the UI to the
/// leads form instead of a cart CTA.
struct MerchDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let type: String?
    let description: String?
    let images: [String]?
    let price: String?
    let availability: String?
    let updatedAt: String?
}

struct MerchPageDTO: Decodable, Equatable {
    let items: [MerchDTO]
    let total: Int
    let page: Int
    let pageSize: Int
}

// MARK: - Leads (P2 enquiry; P3 wire parity)

/// JSON scalar for a lead's free-form payload — the web lead shapes carry
/// BOTH strings and numbers (wedding `guests`, corporate `quantity` ride as
/// JSON numbers), so a `[String: String]` payload cannot express the
/// contract. Scalars only: no lead field needs nested objects or floats.
enum LeadPayloadValue: Encodable, Equatable, Hashable {
    case string(String)
    case number(Int)

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }

    /// Convenience for callers building the dictionary inline.
    static func stringOrNil(_ value: String?) -> LeadPayloadValue? {
        value.map { .string($0) }
    }
}

/// POST /api/leads request body — mirrors the web LeadSubmission shape
/// (type + nested contact; everything else rides the free-form payload).
/// Required server-side: type, contact.name, contact.email. Synthesized
/// Encodable omits nil optionals, so blank email/company/GSTIN ride nothing.
struct LeadInputDTO: Encodable, Equatable {
    struct Contact: Encodable, Equatable {
        let name: String
        var email: String?
        var phone: String?
        var company: String?
        /// Corporate GSTIN — the server column key is literally "GSTIN"
        /// (uppercase), so the Swift property name matches it verbatim.
        var GSTIN: String?
    }

    /// Lead type literal (collections/Leads.ts options) — the enquiry screen
    /// sends "wedding"/"corporate", the gift builder "gift-builder-draft".
    let type: String
    let contact: Contact
    /// Free-form extras: message + the type-specific fields, in the web
    /// forms' exact shapes (eventDate/deadline ISO yyyy-MM-dd, guests/
    /// quantity as numbers).
    var payload: [String: LeadPayloadValue]
    var source: String?
}

/// POST /api/leads success body — BARE JSON, deliberately NOT wrapped in the
/// mobile v1 {data} envelope (that route predates the contract). Decoded by
/// MishranAPIClient.submitLead, not request(_:).
struct LeadResponseDTO: Decodable, Equatable {
    let leadId: String
    let message: String
}
