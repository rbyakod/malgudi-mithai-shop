// CatalogRepository.swift — Task 16.2 (Mishran Mobile Apps v1).
// Offline-first catalog: 200 → cache swap + etag stored; 304 → cached page
// stands; failure → cached page still surfaced with errorMessage set.
import Foundation
import Observation

@MainActor
@Observable
final class CatalogRepository {
    private let client: MishranAPIClient
    private let cache: CatalogCache

    private(set) var products: [ProductEntity] = []
    private(set) var isLoading = false
    var errorMessage: String?

    init(client: MishranAPIClient, cache: CatalogCache) {
        self.client = client
        self.cache = cache
        // Offline-first: the cached page is the starting state, always.
        products = cache.cachedProducts()
    }

    /// - Parameter force: skip If-None-Match (pull-to-refresh).
    func getCatalog(force: Bool = false) async {
        isLoading = true
        defer { isLoading = false }
        errorMessage = nil
        do {
            let etag = force ? nil : cache.etag
            let result = try await client.catalogProducts(ifNoneMatch: etag)
            switch result {
            case let .fresh(page, etag):
                cache.replaceAll(with: page.items)
                cache.etag = etag
                products = cache.cachedProducts()
            case .notModified:
                // Cache is valid — leave rows and etag untouched.
                products = cache.cachedProducts()
            }
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
            products = cache.cachedProducts()
        } catch {
            errorMessage = "Couldn't load the catalog. Showing saved sweets."
            products = cache.cachedProducts()
        }
    }

    private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load the catalog. Showing saved sweets."
    }
}
