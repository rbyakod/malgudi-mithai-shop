// Endpoint.swift — Task 14.3 (Mishran Mobile Apps v1).
// Typed request builder. Paths are relative to the mobile v1 base URL
// (…/api/mobile/v1) with no leading slash, e.g. "catalog/products".
import Foundation

struct Endpoint: Sendable {
    enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
        case delete = "DELETE"
    }

    var path: String
    var method: Method = .get
    var queryItems: [URLQueryItem] = []
    var body: Data? = nil
    /// Extra headers (If-None-Match, X-Client-Source value already applied by
    /// the client). Values here win.
    var headers: [String: String] = [:]
    /// Attach Authorization + auto-refresh on 401. Catalog routes are public.
    var requiresAuth: Bool = true

    func url(base: URL) -> URL? {
        var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        return components?.url
    }
}

// MARK: - Route catalog (grows with the screens that consume them)

extension Endpoint {
    static func catalogProducts(
        family: ProductFamily? = nil,
        q: String? = nil,
        page: Int = 1,
        pageSize: Int = 50,
        ifNoneMatch: String? = nil
    ) -> Endpoint {
        var endpoint = Endpoint(
            path: "catalog/products",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
        if let family {
            endpoint.queryItems.append(URLQueryItem(name: "family", value: family.rawValue))
        }
        if let q, !q.isEmpty {
            endpoint.queryItems.append(URLQueryItem(name: "q", value: q))
        }
        if let ifNoneMatch {
            endpoint.headers["If-None-Match"] = ifNoneMatch
        }
        return endpoint
    }

    static func productDetail(slug: String) -> Endpoint {
        Endpoint(path: "catalog/products/\(slug)", requiresAuth: false)
    }

    /// GET /catalog/serviceable?pincode=XXXXXX (public; non-serviceable is
    /// a 200 with serviceable:false, not an error).
    static func catalogServiceable(pincode: String) -> Endpoint {
        Endpoint(
            path: "catalog/serviceable",
            queryItems: [URLQueryItem(name: "pincode", value: pincode)],
            requiresAuth: false
        )
    }

    static func otpSend(phone: String) -> Endpoint {
        Endpoint(
            path: "auth/otp/send",
            method: .post,
            body: try? JSONEncoder().encode(OtpSendRequestDTO(phone: phone)),
            requiresAuth: false
        )
    }

    static func otpVerify(requestId: String, code: String) -> Endpoint {
        Endpoint(
            path: "auth/otp/verify",
            method: .post,
            body: try? JSONEncoder().encode(OtpVerifyRequestDTO(requestId: requestId, code: code)),
            requiresAuth: false
        )
    }

    /// Refresh token travels via Authorization header — empty body per contract.
    static var authRefresh: Endpoint {
        Endpoint(path: "auth/refresh", method: .post, requiresAuth: false)
    }

    static func authApple(identityToken: String, name: String?) -> Endpoint {
        Endpoint(
            path: "auth/apple",
            method: .post,
            body: try? JSONEncoder().encode(AppleAuthRequestDTO(identityToken: identityToken, name: name)),
            requiresAuth: false
        )
    }

    /// POST /cart/validate — persists a server-side cart snapshot and hands
    /// back the snapshotId create-order re-reads (tamper-evident cart).
    static func cartValidate(
        items: [CartValidateItemDTO],
        pincode: String,
        slot: DeliverySlot?
    ) -> Endpoint {
        Endpoint(
            path: "cart/validate",
            method: .post,
            body: try? JSONEncoder().encode(CartValidateRequestDTO(
                items: items,
                pincode: pincode,
                slot: slot.map { DeliverySlotDTO(date: $0.date, window: $0.window) }
            ))
        )
    }

    /// POST /payments/razorpay/create-order. The Idempotency-Key must be
    /// FRESH per user attempt — the backend caches error responses per key,
    /// so a retry with a reused key replays the cached failure.
    static func paymentCreateOrder(
        snapshotId: String,
        deliveryAddressId: String,
        idempotencyKey: String
    ) -> Endpoint {
        var endpoint = Endpoint(
            path: "payments/razorpay/create-order",
            method: .post,
            body: try? JSONEncoder().encode(CreateOrderRequestDTO(
                snapshotId: snapshotId,
                deliveryAddressId: deliveryAddressId
            ))
        )
        endpoint.headers["Idempotency-Key"] = idempotencyKey
        return endpoint
    }

    /// POST /payments/razorpay/verify — HMAC check, then pending_payment →
    /// confirmed (idempotent server-side; the key guards client replays).
    static func paymentVerify(
        orderId: String,
        razorpayPaymentId: String,
        signature: String,
        idempotencyKey: String
    ) -> Endpoint {
        var endpoint = Endpoint(
            path: "payments/razorpay/verify",
            method: .post,
            body: try? JSONEncoder().encode(VerifyPaymentRequestDTO(
                orderId: orderId,
                razorpayPaymentId: razorpayPaymentId,
                signature: signature
            ))
        )
        endpoint.headers["Idempotency-Key"] = idempotencyKey
        return endpoint
    }
}
