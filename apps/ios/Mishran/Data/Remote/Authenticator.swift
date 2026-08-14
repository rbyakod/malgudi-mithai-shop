// Authenticator.swift — Task 14.3 (Mishran Mobile Apps v1).
// Token storage + single-flight refresh. On 401 the API client asks for a
// fresh access token; concurrent 40s coalesce into ONE /auth/refresh call
// (the backend rotates refresh tokens — racing two refreshes would revoke
// one of them).
//
// TokenStoring is the seam: KeychainTokenStore in production, an in-memory
// store in tests. Access tokens live 15min; refresh tokens 30d rotated.
import Foundation

protocol TokenStoring: AnyObject, Sendable {
    var accessToken: String? { get set }
    var refreshToken: String? { get set }
    func clear()
}

/// In-memory store — tests and preview targets.
final class InMemoryTokenStore: TokenStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var _access: String?
    private var _refresh: String?

    var accessToken: String? {
        get { lock.lock(); defer { lock.unlock() }; return _access }
        set { lock.lock(); defer { lock.unlock() }; _access = newValue }
    }

    var refreshToken: String? {
        get { lock.lock(); defer { lock.unlock() }; return _refresh }
        set { lock.lock(); defer { lock.unlock() }; _refresh = newValue }
    }

    func clear() {
        lock.lock(); defer { lock.unlock() }
        _access = nil
        _refresh = nil
    }
}

/// Keychain-backed store — kSecClassGenericPassword, one item holding both
/// tokens as JSON. Not unit-tested (simulator keychain flakiness); covered
/// implicitly once 15.x flows exercise it.
final class KeychainTokenStore: TokenStoring, @unchecked Sendable {
    private let service: String
    private let account = "mishran.tokens"
    private let lock = NSLock()

    init(service: String = "app.mishran.ios") {
        self.service = service
    }

    private func read() -> (access: String, refresh: String)? {
        var query = baseQuery()
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var data: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &data) == errSecSuccess,
              let json = data as? Data
        else { return nil }
        struct Pair: Codable { let access: String; let refresh: String }
        guard let pair = try? JSONDecoder().decode(Pair.self, from: json) else { return nil }
        return (pair.access, pair.refresh)
    }

    private func write(_ pair: (access: String, refresh: String)) {
        struct Pair: Codable { let access: String; let refresh: String }
        guard let json = try? JSONEncoder().encode(Pair(access: pair.access, refresh: pair.refresh)) else { return }
        var query = baseQuery()
        let update: [String: Any] = [kSecValueData as String: json]
        if SecItemUpdate(query as CFDictionary, update as CFDictionary) != errSecSuccess {
            SecItemAdd(query as CFDictionary, nil)
        }
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    var accessToken: String? {
        get { lock.lock(); defer { lock.unlock() }; return read()?.access }
        set {
            lock.lock(); defer { lock.unlock() }
            let current = read() ?? ("", "")
            write((newValue ?? current.access, current.refresh))
        }
    }

    var refreshToken: String? {
        get { lock.lock(); defer { lock.unlock() }; return read()?.refresh }
        set {
            lock.lock(); defer { lock.unlock() }
            let current = read() ?? ("", "")
            write((current.access, newValue ?? current.refresh))
        }
    }

    func clear() {
        lock.lock(); defer { lock.unlock() }
        SecItemDelete(baseQuery() as CFDictionary)
    }
}

actor Authenticator {
    private let store: TokenStoring
    private let session: URLSession
    private let baseURL: URL
    /// Single-flight refresh: concurrent callers await the same task.
    private var inFlight: Task<String, Error>?

    init(store: TokenStoring, session: URLSession, baseURL: URL) {
        self.store = store
        self.session = session
        self.baseURL = baseURL
    }

    var accessToken: String? { store.accessToken }

    /// Persist tokens after a successful OTP verify (sign-in).
    func storeTokens(access: String, refresh: String) {
        store.accessToken = access
        store.refreshToken = refresh
    }

    /// Sign-out: drop both tokens.
    func clearTokens() {
        store.clear()
    }

    /// POST /auth/refresh with the refresh token; rotates both tokens in the
    /// store and returns the new access token. A 401 clears the store and
    /// throws tokenRevoked — the app returns to the sign-in screen on this.
    func refreshedAccessToken() async throws -> String {
        if let inFlight {
            return try await inFlight.value
        }
        let task = Task<String, Error> { [store, session, baseURL] () throws -> String in
            guard let refresh = store.refreshToken, !refresh.isEmpty else {
                throw APIError.api(.tokenRevoked, message: "No refresh token", fieldErrors: nil, traceId: nil)
            }
            guard let url = Endpoint.authRefresh.url(base: baseURL) else {
                throw APIError.decoding("bad refresh URL")
            }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(refresh)", forHTTPHeaderField: "Authorization")
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.network(code: "bad-response")
            }
            if http.statusCode == 200 {
                let envelope = try JSONDecoder().decode(Envelope<RefreshResponseDTO>.self, from: data)
                store.accessToken = envelope.data.accessToken
                store.refreshToken = envelope.data.refreshToken
                return envelope.data.accessToken
            }
            if http.statusCode == 401 {
                store.clear()
                if let decoded = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                    throw APIError.api(decoded.error.code, message: decoded.error.message,
                                       fieldErrors: decoded.error.fieldErrors, traceId: decoded.error.traceId)
                }
                throw APIError.api(.tokenRevoked, message: "Refresh rejected", fieldErrors: nil, traceId: nil)
            }
            throw APIError.serverError(status: http.statusCode)
        }
        inFlight = task
        defer { inFlight = nil }
        return try await task.value
    }
}
