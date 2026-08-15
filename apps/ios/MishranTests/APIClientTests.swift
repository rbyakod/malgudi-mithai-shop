// Task 14.3 (Mishran Mobile Apps v1): API client tests over a URLProtocol
// mock — no real network. Contracts mirror packages/api-contract/openapi.yaml:
// {data: ...} envelope, camelCase JSON, refresh token via Authorization header.
import XCTest
@testable import Mishran

/// Minimal thread-safe URLProtocol stub: routes by path suffix.
final class MockURLProtocol: URLProtocol {
    static let lock = NSLock()
    /// path suffix -> handler returning (status, headers, body). Handlers may
    /// throw to simulate transport failures.
    nonisolated(unsafe) static var routes: [String: (Int, [String: String], Data)] = [:]
    /// path suffix -> dynamic route (stateful responses, e.g. 401 then 200).
    nonisolated(unsafe) static var routeOverride: [String: (URLRequest) -> (Int, [String: String], Data)] = [:]
    /// path suffix -> error to simulate a transport-level failure.
    nonisolated(unsafe) static var errors: [String: Error] = [:]
    /// Captured Authorization headers per path suffix, in call order.
    nonisolated(unsafe) static var authHeaders: [String: [String]] = [:]
    /// Captured request counts per path suffix.
    nonisolated(unsafe) static var calls: [String: Int] = [:]
    /// Last captured request per path suffix.
    nonisolated(unsafe) static var lastRequests: [String: URLRequest] = [:]

    static func reset() {
        lock.lock(); defer { lock.unlock() }
        routes = [:]; routeOverride = [:]; errors = [:]
        authHeaders = [:]; calls = [:]; lastRequests = [:]
    }

    static func record(_ request: URLRequest, path: String) {
        lock.lock(); defer { lock.unlock() }
        calls[path, default: 0] += 1
        authHeaders[path, default: []].append(request.value(forHTTPHeaderField: "Authorization") ?? "-")
        lastRequests[path] = request
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else { return }
        let path = url.path
        let suffix = MockURLProtocol.longestSuffix(matching: path)

        // Record under the route suffix so tests can key on "catalog/products".
        MockURLProtocol.record(request, path: suffix ?? path)
        if let suffix, let error = MockURLProtocol.errors[suffix] {
            client?.urlProtocol(self, didFailWithError: error)
            return
        }
        let result: (Int, [String: String], Data)
        if let suffix, let override = MockURLProtocol.routeOverride[suffix] {
            result = override(request)
        } else if let suffix, let route = MockURLProtocol.routes[suffix] {
            result = route
        } else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data("no mock for \(path)".utf8))
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        let (status, headers, body) = result
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func longestSuffix(matching path: String) -> String? {
        lock.lock(); defer { lock.unlock() }
        let all = Array(routes.keys) + Array(errors.keys) + Array(routeOverride.keys)
        return all.filter { path.hasSuffix($0) }.max(by: { $0.count < $1.count })
    }

    override func stopLoading() {}

    /// Drain a request's httpBodyStream (URLSession re-encodes the body).
    static func body(of request: URLRequest) -> Data? {
        if let data = request.httpBody { return data }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

final class APIClientTests: XCTestCase {
    private let baseURL = URL(string: "https://api.test/api/mobile/v1")!
    private var store: InMemoryTokenStore!

    override func setUp() {
        super.setUp()
        MockURLProtocol.reset()
        store = InMemoryTokenStore()
        store.accessToken = "old-access"
        store.refreshToken = "refresh-1"
    }

    private func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }

    private func makeClient(retryDelay: UInt64 = 0) -> MishranAPIClient {
        MishranAPIClient(
            session: makeSession(),
            refreshSession: makeSession(),
            baseURL: baseURL,
            authenticator: Authenticator(store: store, session: makeSession(), baseURL: baseURL),
            retryDelay: retryDelay
        )
    }

    /// Authed throwaway route for exercising the 401/refresh machinery —
    /// catalog endpoints are public (requiresAuth: false) so they never
    /// trigger refresh by design.
    private let authedEndpoint = Endpoint(path: "orders", requiresAuth: true)

    private func json(_ string: String) -> Data { Data(string.utf8) }

    private let productJSON = """
    {"data":{"items":[{"id":"p1","slug":"kaju-katli","name":"Kaju Katli","family":"classic",
    "displayPrice":"₹720/kg","freshnessStatus":"made-daily","dietaryTags":["gluten-free"],
    "allergens":["nuts"],"images":["https://cdn.test/kaju.jpg"]}],"total":1,"page":1,"pageSize":50}}
    """

    // MARK: Step 1 — decode

    func testCatalogProductsDecodesEnvelope() async throws {
        MockURLProtocol.routes["/catalog/products"] = (200, [:], json(productJSON))
        let client = makeClient()
        let result = try await client.catalogProducts()
        guard case let .fresh(page, _) = result else { return XCTFail("expected fresh page") }
        XCTAssertEqual(page.total, 1)
        let product = try XCTUnwrap(page.items.first)
        XCTAssertEqual(product.slug, "kaju-katli")
        XCTAssertEqual(product.family, .classic)
        XCTAssertEqual(product.freshnessStatus, "made-daily")
        XCTAssertEqual(product.allergens, ["nuts"])
    }

    // MARK: 401 -> refresh -> retry

    func testUnauthorizedRefreshesAndRetries() async throws {
        MockURLProtocol.routes["/auth/refresh"] = (
            200, [:], json(#"{"data":{"accessToken":"new-access","refreshToken":"refresh-2"}}"#)
        )
        // First authed call 401s, second succeeds: a counter flips the status.
        var ordersCalls = 0
        MockURLProtocol.routeOverride["/orders"] = { [self] _ in
            ordersCalls += 1
            return (ordersCalls == 1 ? 401 : 200, [:], json(#"{"data":[]}"#))
        }

        let client = makeClient()
        let orders: [String] = try await client.request(authedEndpoint)

        XCTAssertEqual(orders, [])
        XCTAssertEqual(ordersCalls, 2)
        XCTAssertEqual(MockURLProtocol.calls["/auth/refresh"], 1)
        XCTAssertEqual(store.accessToken, "new-access")
        XCTAssertEqual(store.refreshToken, "refresh-2")
        // Retry after refresh must carry the NEW access token.
        let ordersAuths = MockURLProtocol.authHeaders["/orders"]!
        XCTAssertEqual(ordersAuths, ["Bearer old-access", "Bearer new-access"])
        // Refresh call must present the refresh token, not the access token.
        XCTAssertEqual(MockURLProtocol.authHeaders["/auth/refresh"], ["Bearer refresh-1"])
    }

    func testRefreshFailureClearsTokensAndThrows() async {
        MockURLProtocol.routes["/orders"] = (401, [:], json(#"{"error":{"code":"TOKEN_EXPIRED","message":"expired"}}"#))
        MockURLProtocol.routes["/auth/refresh"] = (
            401, [:], json(#"{"error":{"code":"TOKEN_REVOKED","message":"revoked"}}"#)
        )

        let client = makeClient()
        do {
            _ = try await client.request(authedEndpoint) as [String]
            XCTFail("Expected tokenRevoked")
        } catch let error as APIError {
            XCTAssertEqual(error, .api(.tokenRevoked, message: "revoked", fieldErrors: nil, traceId: nil))
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
        XCTAssertNil(store.accessToken)
        XCTAssertNil(store.refreshToken)
    }

    // MARK: 5xx retry

    func testServerErrorsAreRetried() async throws {
        var calls = 0
        MockURLProtocol.routeOverride["/catalog/products"] = { [productJSON] _ in
            calls += 1
            return (calls == 1 ? 503 : 200, [:], Data(productJSON.utf8))
        }
        let client = makeClient()
        let result = try await client.catalogProducts()
        guard case .fresh = result else { return XCTFail("expected fresh page") }
        XCTAssertEqual(calls, 2)
    }

    func testPersistentServerErrorExhaustsRetries() async {
        MockURLProtocol.routes["/catalog/products"] = (500, [:], Data("{}".utf8))
        let client = makeClient()
        do {
            _ = try await client.catalogProducts()
            XCTFail("Expected serverError")
        } catch let error as APIError {
            guard case .serverError = error else { return XCTFail("got \(error)") }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
        // 1 initial + 2 retries
        XCTAssertEqual(MockURLProtocol.calls["/catalog/products"], 3)
    }

    // MARK: transport failure

    func testTransportFailureSurfacesAsNetworkError() async {
        MockURLProtocol.errors["/catalog/products"] = URLError(.timedOut)
        let client = makeClient()
        do {
            _ = try await client.catalogProducts()
            XCTFail("Expected network")
        } catch let error as APIError {
            guard case .network = error else { return XCTFail("got \(error)") }
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: backend error envelope

    func testBackendErrorEnvelopeDecodes() async {
        MockURLProtocol.routes["/catalog/products"] = (
            429, [:], json(#"{"error":{"code":"RATE_LIMITED","message":"slow down","traceId":"t1"}}"#)
        )
        let client = makeClient()
        do {
            _ = try await client.catalogProducts()
            XCTFail("Expected rateLimited")
        } catch let error as APIError {
            XCTAssertEqual(error, .api(.rateLimited, message: "slow down", fieldErrors: nil, traceId: "t1"))
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: ETag plumbing

    func testCatalogSendsIfNoneMatchAndSurfaces304() async throws {
        MockURLProtocol.routes["/catalog/products"] = (304, [:], Data())
        let client = makeClient()
        let result = try await client.catalogProducts(ifNoneMatch: "\"abc123\"")
        guard case .notModified = result else { return XCTFail("expected notModified") }
        let etagRequest = try XCTUnwrap(MockURLProtocol.lastRequests["/catalog/products"])
        XCTAssertEqual(etagRequest.value(forHTTPHeaderField: "If-None-Match"), "\"abc123\"")
    }

    // MARK: sign-out (Task 48.1)

    func testSignOutPostsLogoutWithBearerThenClearsTokens() async {
        MockURLProtocol.routes["/auth/logout"] = (200, [:], json(#"{"data":{"ok":true}}"#))
        let client = makeClient()

        await client.signOut()

        XCTAssertEqual(MockURLProtocol.calls["/auth/logout"], 1)
        XCTAssertEqual(MockURLProtocol.authHeaders["/auth/logout"], ["Bearer old-access"])
        XCTAssertNil(store.accessToken, "local tokens must drop after sign-out")
        XCTAssertNil(store.refreshToken)
    }

    func testSignOutClearsTokensEvenWhenLogoutCallFails() async {
        MockURLProtocol.routes["/auth/logout"] = (500, [:], Data("{}".utf8))
        let client = makeClient()

        await client.signOut()

        XCTAssertNil(store.accessToken, "a failed logout call must never keep the session")
        XCTAssertNil(store.refreshToken)
    }
}
