// APIError.swift — Task 14.3 (Mishran Mobile Apps v1).
// Mirrors the backend Error envelope (packages/api-contract/openapi.yaml):
// {error: {code, message, fieldErrors?, traceId?}} with the ErrorCode enum
// kept 1:1 with the contract so pattern-matching stays exhaustive.
import Foundation

/// Backend ErrorCode enum — keep in sync with openapi.yaml.
enum APIErrorCode: String, Decodable, CaseIterable, Sendable {
    case rateLimited = "RATE_LIMITED"
    case otpInvalid = "OTP_INVALID"
    case otpExpired = "OTP_EXPIRED"
    case pincodeNotServiceable = "PINCODE_NOT_SERVICEABLE"
    case cartChanged = "CART_CHANGED"
    case stockInsufficient = "STOCK_INSUFFICIENT"
    case paymentFailed = "PAYMENT_FAILED"
    case paymentAbandoned = "PAYMENT_ABANDONED"
    case orderNotFound = "ORDER_NOT_FOUND"
    case snapshotNotFound = "SNAPSHOT_NOT_FOUND"
    case productNotFound = "PRODUCT_NOT_FOUND"
    /// Generic 404 for resources without a dedicated code (addresses, devices).
    case notFound = "NOT_FOUND"
    case invalidStateTransition = "INVALID_STATE_TRANSITION"
    case tokenExpired = "TOKEN_EXPIRED"
    case tokenRevoked = "TOKEN_REVOKED"
    case conflict = "CONFLICT"
    case validation = "VALIDATION"
    case internalError = "INTERNAL"
    case otpProviderDown = "OTP_PROVIDER_DOWN"
}

/// Every failure the API client surfaces. `api` carries a decoded backend
/// error; the rest are transport/protocol-level.
enum APIError: Error, Equatable, Sendable {
    /// Decoded backend {error:{...}} envelope.
    case api(APIErrorCode, message: String, fieldErrors: [String: String]?, traceId: String?)
    /// Non-retryable HTTP status without a decodable error body.
    case http(status: Int)
    /// 5xx that survived all retries.
    case serverError(status: Int)
    /// Transport-level failure (timeout, connection lost, DNS…).
    case network(code: String)
    /// Response body failed to decode against the contract.
    case decoding(String)

    /// The backend's fieldErrors dictionary when present (VALIDATION).
    var fieldErrors: [String: String]? {
        if case let .api(_, _, fieldErrors, _) = self { return fieldErrors }
        return nil
    }

    var traceId: String? {
        if case let .api(_, _, _, traceId) = self { return traceId }
        return nil
    }
}
