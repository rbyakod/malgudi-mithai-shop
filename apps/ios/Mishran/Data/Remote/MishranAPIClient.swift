// MishranAPIClient.swift — Task 14.3 (Mishran Mobile Apps v1).
// Actor API client over URLSession async/await. Contract:
//   - every payload wrapped in {data: ...}; errors in {error: {...}}
//   - camelCase JSON (no key conversion)
//   - Authorization: Bearer <access> on authed routes; 401 → single-flight
//     /auth/refresh (refresh token in header) → retry once
//   - 5xx retried twice (tiny backoff); transport failures surface as .network
//   - ETag/If-None-Match on catalog list → CatalogResult.notModified on 304
import Foundation

actor MishranAPIClient {
    #if DEBUG
    /// Simulator hits the host's dev server directly.
    static let defaultBaseURL = URL(string: "http://localhost:3000/api/mobile/v1")!
    #else
    static let defaultBaseURL = URL(string: "https://api.mishran.app/api/mobile/v1")!
    #endif

    private let session: URLSession
    private let baseURL: URL
    private let authenticator: Authenticator
    private let decoder = JSONDecoder()
    /// Nanoseconds between retries — injectable so tests retry instantly.
    private let retryDelay: UInt64
    private let maxRetries = 2

    init(
        session: URLSession? = nil,
        refreshSession: URLSession? = nil,
        baseURL: URL = MishranAPIClient.defaultBaseURL,
        authenticator: Authenticator? = nil,
        retryDelay: UInt64 = 200_000_000
    ) {
        let makeSession: () -> URLSession = {
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 15
            config.waitsForConnectivity = false
            return URLSession(configuration: config)
        }
        let session = session ?? makeSession()
        self.session = session
        self.baseURL = baseURL
        self.authenticator = authenticator ?? Authenticator(
            store: KeychainTokenStore(),
            session: refreshSession ?? session,
            baseURL: baseURL
        )
        self.retryDelay = retryDelay
    }

    // MARK: - Public API (grows with the screens that consume it)

    func catalogProducts(
        family: ProductFamily? = nil,
        q: String? = nil,
        page: Int = 1,
        pageSize: Int = 50,
        ifNoneMatch: String? = nil
    ) async throws -> CatalogResult {
        let endpoint = Endpoint.catalogProducts(
            family: family, q: q, page: page, pageSize: pageSize, ifNoneMatch: ifNoneMatch
        )
        let (data, response): (Data, HTTPURLResponse)
        do {
            (data, response) = try await send(endpoint)
        } catch let error as APIError {
            // ETag matched: caller keeps its cached page.
            if case .http(status: 304) = error { return .notModified }
            throw error
        }
        let page = try decode(ProductPageDTO.self, from: data)
        return .fresh(page, etag: response.value(forHTTPHeaderField: "ETag"))
    }

    func productDetail(slug: String) async throws -> ProductDTO {
        try await send(Endpoint.productDetail(slug: slug), as: ProductDTO.self)
    }

    func authOtpSend(phone: String) async throws -> OtpSendResponseDTO {
        try await send(Endpoint.otpSend(phone: phone), as: OtpSendResponseDTO.self)
    }

    /// Generic authed/unauthed request for routes without a typed wrapper yet.
    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        try await send(endpoint, as: T.self)
    }

    func authOtpVerify(requestId: String, code: String) async throws -> OtpVerifyResponseDTO {
        let response = try await send(Endpoint.otpVerify(requestId: requestId, code: code), as: OtpVerifyResponseDTO.self)
        // Successful sign-in rotates tokens into the store.
        await authenticator.storeTokens(access: response.accessToken, refresh: response.refreshToken)
        return response
    }

    // MARK: - Core transport

    /// Raw send returning data + response, applying auth + retries.
    private func send(_ endpoint: Endpoint) async throws -> (Data, HTTPURLResponse) {
        var attempt = 0
        var refreshed = false
        while true {
            var request = try buildRequest(endpoint)
            if endpoint.requiresAuth, let token = await authenticator.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            let data: Data
            let response: HTTPURLResponse
            do {
                let (raw, urlResponse) = try await session.data(for: request)
                guard let http = urlResponse as? HTTPURLResponse else {
                    throw APIError.network(code: "bad-response")
                }
                data = raw
                response = http
            } catch let error as APIError {
                throw error
            } catch {
                throw APIError.network(code: String(describing: error))
            }

            switch response.statusCode {
            case 200..<300:
                return (data, response)

            case 401 where endpoint.requiresAuth && !refreshed:
                // Token expired: single-flight refresh, retry once.
                refreshed = true
                _ = try await authenticator.refreshedAccessToken()
                continue

            case 500...599 where attempt < maxRetries:
                attempt += 1
                if retryDelay > 0 {
                    try? await Task.sleep(nanoseconds: retryDelay)
                }
                continue

            default:
                throw Self.mapError(status: response.statusCode, data: data)
            }
        }
    }

    private func send<T: Decodable>(_ endpoint: Endpoint, as type: T.Type) async throws -> T {
        let (data, _) = try await send(endpoint)
        return try decode(T.self, from: data)
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(Envelope<T>.self, from: data).data
        } catch {
            throw APIError.decoding(String(describing: type))
        }
    }

    private func buildRequest(_ endpoint: Endpoint) throws -> URLRequest {
        guard let url = endpoint.url(base: baseURL) else {
            throw APIError.decoding("bad URL for \(endpoint.path)")
        }
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.httpBody = endpoint.body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if endpoint.body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        // Analytics taxonomy parity with the Android client.
        request.setValue("ios", forHTTPHeaderField: "X-Client-Source")
        for (name, value) in endpoint.headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        return request
    }

    static func mapError(status: Int, data: Data) -> APIError {
        if let decoded = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
            return .api(decoded.error.code, message: decoded.error.message,
                        fieldErrors: decoded.error.fieldErrors, traceId: decoded.error.traceId)
        }
        if (500...599).contains(status) {
            return .serverError(status: status)
        }
        return .http(status: status)
    }
}
