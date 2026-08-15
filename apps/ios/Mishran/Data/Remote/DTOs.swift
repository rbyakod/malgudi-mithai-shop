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
        featured: Bool? = nil
    ) {
        self.init(id: id, slug: slug, name: name, family: family, displayPrice: displayPrice,
                  weight: weight, featured: featured,
                  freshnessStatus: nil, dietaryTags: nil, allergens: nil, ingredients: nil,
                  shelfLife: nil, storage: nil, images: nil, story: nil, updatedAt: nil)
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

// MARK: - Brand (P1 parity: WhatsApp support)

/// GET /brand — public support contact ({data:{whatsappNumber,whatsappDigits}}).
/// Only the WhatsApp fields of the analytics-settings global are exposed;
/// analytics IDs deliberately never appear on this endpoint. Both fields are
/// contract-required, so decoding failures fall to the repository's
/// hardcoded fallback number.
struct BrandDTO: Codable, Equatable {
    /// Display form, e.g. "+91-98765-43210".
    let whatsappNumber: String
    /// Digits only, for wa.me deep links.
    let whatsappDigits: String
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
