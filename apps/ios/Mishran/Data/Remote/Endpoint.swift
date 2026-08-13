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
}
