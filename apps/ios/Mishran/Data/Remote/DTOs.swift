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
    let phone: String
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

// MARK: - Catalog

/// Product (openapi Product schema — required: id, slug, name, family).
struct ProductDTO: Decodable, Equatable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let family: ProductFamily
    let displayPrice: String?
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
