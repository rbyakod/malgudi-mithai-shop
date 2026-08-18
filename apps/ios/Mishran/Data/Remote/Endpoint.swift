// Endpoint.swift — Task 14.3 (Mishran Mobile Apps v1).
// Typed request builder. Paths are relative to the mobile v1 base URL
// (…/api/mobile/v1) with no leading slash, e.g. "catalog/products".
import Foundation

struct Endpoint: Sendable {
    enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case delete = "DELETE"
    }

    var path: String
    /// Full URL override for routes OUTSIDE the mobile v1 base URL (the only
    /// one today: the public POST /api/leads web route). Wins over `path`
    /// when set; the route factories that need it derive it from the base.
    var absoluteURL: URL? = nil
    var method: Method = .get
    var queryItems: [URLQueryItem] = []
    var body: Data? = nil
    /// Extra headers (If-None-Match, X-Client-Source value already applied by
    /// the client). Values here win.
    var headers: [String: String] = [:]
    /// Attach Authorization + auto-refresh on 401. Catalog routes are public.
    var requiresAuth: Bool = true

    func url(base: URL) -> URL? {
        if let absoluteURL { return absoluteURL }
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

    /// GET /brand — public support contact for the apps' help surfaces
    /// ({data:{whatsappNumber,whatsappDigits}}). No ETag — single tiny doc,
    /// cached client-side (P1 parity).
    static var brand: Endpoint {
        Endpoint(path: "brand", requiresAuth: false)
    }

    /// GET /hero — admin-curated home carousel ({data:{slides,autoplayMs}}).
    /// Network-only on iOS (no SwiftData cache): a fresh fetch per Home
    /// load, ETag-less. Empty slides → the local fallback hero stands.
    static var hero: Endpoint {
        Endpoint(path: "hero", requiresAuth: false)
    }

    /// GET /orders — customer-scoped (JWT), newest first, paginated.
    static func orders(page: Int = 1, pageSize: Int = 20) -> Endpoint {
        Endpoint(
            path: "orders",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ]
        )
    }

    /// GET /orders/{id} — customer-scoped; 404 ORDER_NOT_FOUND if the id
    /// belongs to someone else (service returns null → mapped, not leaked).
    static func orderDetail(id: String) -> Endpoint {
        Endpoint(path: "orders/\(id)")
    }

    /// GET /account/loyalty-pass — eligible customers get a signed .pkpass
    /// URL; 404 NOT_FOUND means "not yet" (handled, not an error banner).
    static var loyaltyPass: Endpoint {
        Endpoint(path: "account/loyalty-pass")
    }

    /// POST /notifications/register-device — idempotent device upsert;
    /// called on APNs token change and whenever a Live Activity push token
    /// appears. liveActivityToken rides the same row (18.3).
    static func registerDevice(
        platform: String,
        pushToken: String,
        liveActivityToken: String? = nil,
        appVersion: String? = nil,
        deviceModel: String? = nil,
        osVersion: String? = nil,
        locale: String? = nil
    ) -> Endpoint {
        struct RegisterDeviceRequestDTO: Encodable {
            let platform: String
            let pushToken: String
            let liveActivityToken: String?
            let appVersion: String?
            let deviceModel: String?
            let osVersion: String?
            let locale: String?
        }
        return Endpoint(
            path: "notifications/register-device",
            method: .post,
            body: try? JSONEncoder().encode(RegisterDeviceRequestDTO(
                platform: platform,
                pushToken: pushToken,
                liveActivityToken: liveActivityToken,
                appVersion: appVersion,
                deviceModel: deviceModel,
                osVersion: osVersion,
                locale: locale
            ))
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

    /// POST /auth/logout — revokes the refresh-token family server-side.
    /// The contract lists the route as unauthenticated, so the bearer rides
    /// a manual header (best effort): requiresAuth stays false on purpose —
    /// a 401 here must NOT kick off a refresh loop on the way out the door.
    static func authLogout(bearerToken: String?) -> Endpoint {
        var endpoint = Endpoint(path: "auth/logout", method: .post, requiresAuth: false)
        if let bearerToken {
            endpoint.headers["Authorization"] = "Bearer \(bearerToken)"
        }
        return endpoint
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
    /// `couponCode` (Batch B8) folds a validated discount into the totals;
    /// an unusable code fails the request with 422 INVALID_COUPON.
    static func cartValidate(
        items: [CartValidateItemDTO],
        pincode: String,
        slot: DeliverySlot?,
        couponCode: String?
    ) -> Endpoint {
        Endpoint(
            path: "cart/validate",
            method: .post,
            body: try? JSONEncoder().encode(CartValidateRequestDTO(
                items: items,
                pincode: pincode,
                slot: slot.map { DeliverySlotDTO(date: $0.date, window: $0.window) },
                couponCode: couponCode
            ))
        )
    }

    /// POST /cart/estimate (Batch B9) — UNAUTHENTICATED pricing preview: the
    /// validate math (line re-pricing, tier fee, threshold waiver) with
    /// nothing persisted, so guest carts show delivery fees before sign-in.
    /// Unlike validate, items keep their pack labels (each chip prices
    /// separately) and an absent/unserviceable pincode is informational —
    /// the response just carries a null tier with no fee to show.
    static func cartEstimate(items: [CartEstimateItemDTO], pincode: String?) -> Endpoint {
        Endpoint(
            path: "cart/estimate",
            method: .post,
            body: try? JSONEncoder().encode(CartEstimateRequestDTO(items: items, pincode: pincode)),
            requiresAuth: false
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

    // MARK: Addresses (Task 48.2) — owner-scoped CRUD

    /// GET /addresses — the caller's saved addresses ({data:{items:[…]}}).
    static func addressList() -> Endpoint {
        Endpoint(path: "addresses")
    }

    /// POST /addresses — 201 {data:{address}}. Input mirrors the contract's
    /// AddressInput (required: line1/city/state/pincode).
    static func addressCreate(input: AddressInputDTO) -> Endpoint {
        Endpoint(
            path: "addresses",
            method: .post,
            body: try? JSONEncoder().encode(input)
        )
    }

    /// PATCH /addresses/{id} — full-replace update ({data:{address}}).
    static func addressUpdate(id: String, input: AddressInputDTO) -> Endpoint {
        Endpoint(
            path: "addresses/\(id)",
            method: .patch,
            body: try? JSONEncoder().encode(input)
        )
    }

    /// DELETE /addresses/{id} — 200 {data:{ok:true}}.
    static func addressDelete(id: String) -> Endpoint {
        Endpoint(path: "addresses/\(id)", method: .delete)
    }

    // MARK: Stories (P2 journal) — public, unauthenticated

    /// GET /stories — published-stories page, newest first
    /// ({data:{items:[…]}}). The optional pillar filter stays unused in v1
    /// (no pillar-tab UI yet).
    static func storiesList(page: Int = 1, pageSize: Int = 50) -> Endpoint {
        Endpoint(
            path: "stories",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
    }

    /// GET /stories/{slug} — reader detail ({data:{…story, body}}).
    static func storyDetail(slug: String) -> Endpoint {
        Endpoint(path: "stories/\(slug)", requiresAuth: false)
    }

    // MARK: Verticals (P2: snacks / QSR / merch) — public, unauthenticated

    /// GET /catalog/snacks — retail snacks page ({data:{items:[…]}}).
    static func snacksList(page: Int = 1, pageSize: Int = 50) -> Endpoint {
        Endpoint(
            path: "catalog/snacks",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
    }

    /// GET /catalog/snacks/{slug} — bare snack object in {data}.
    static func snackDetail(slug: String) -> Endpoint {
        Endpoint(path: "catalog/snacks/\(slug)", requiresAuth: false)
    }

    /// GET /catalog/qsr — counter-menu page ({data:{items:[…]}}).
    static func qsrList(page: Int = 1, pageSize: Int = 50) -> Endpoint {
        Endpoint(
            path: "catalog/qsr",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
    }

    /// GET /catalog/qsr/{slug} — bare QSR item object in {data}.
    static func qsrDetail(slug: String) -> Endpoint {
        Endpoint(path: "catalog/qsr/\(slug)", requiresAuth: false)
    }

    /// GET /catalog/merch — merchandise page ({data:{items:[…]}}).
    static func merchList(page: Int = 1, pageSize: Int = 50) -> Endpoint {
        Endpoint(
            path: "catalog/merch",
            queryItems: [
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
    }

    /// GET /catalog/merch/{slug} — bare merch object in {data}.
    static func merchDetail(slug: String) -> Endpoint {
        Endpoint(path: "catalog/merch/\(slug)", requiresAuth: false)
    }

    // MARK: Reviews (B11 — public review display)

    /// GET /reviews?productId=… — public, moderation-approved reviews,
    /// newest first. The PDP renders the first page (5 rows) plus the
    /// aggregate rating; averageRating/total cover all approved reviews.
    static func reviews(productId: String, page: Int = 1, pageSize: Int = 5) -> Endpoint {
        Endpoint(
            path: "reviews",
            queryItems: [
                URLQueryItem(name: "productId", value: productId),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "pageSize", value: String(pageSize)),
            ],
            requiresAuth: false
        )
    }

    // MARK: Leads (P2 enquiry)

    /// POST /api/leads — the PUBLIC web lead route the Bulk & events form
    /// targets. It lives OUTSIDE the mobile v1 base URL, so the absolute URL
    /// is derived by dropping the base's last two path segments
    /// (…/api/mobile/v1 → …/api): every supported base URL ends in
    /// /api/mobile/v1 (defaultBaseURL + the -apiBaseURL override contract).
    /// The response is BARE {leadId, message} — no {data} envelope — so the
    /// client decodes it through submitLead, not request(_:).
    static func leadCreate(_ input: LeadInputDTO, baseURL: URL) -> Endpoint {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        var segments = components?.path.components(separatedBy: "/").filter { !$0.isEmpty } ?? []
        if segments.count >= 2 {
            segments.removeLast(2)
        }
        segments.append("leads")
        components?.path = "/" + segments.joined(separator: "/")
        return Endpoint(
            path: "leads",
            absoluteURL: components?.url,
            method: .post,
            body: try? JSONEncoder().encode(input),
            requiresAuth: false
        )
    }
}
