// BrandRepository.swift — P1 parity (Mishran Mobile Apps v1).
// Cached fetch of GET /brand (whatsappNumber + whatsappDigits) for the
// apps' help surfaces. Mirrors AddressRepository's actor pattern: errors
// collapse to the shared placeholder number so a failing backend degrades
// the "Need help" row instead of dead-ending it. The Brand doc is tiny and
// ETag-less, so a UserDefaults cache serves every read after the first.
import Foundation

actor BrandRepository {
    /// Placeholder support number the backend itself falls back to — used
    /// when neither cache nor fetch produces digits.
    static let fallbackDigits = "919876543210"
    static let cacheKey = "brand.cached"

    private let client: MishranAPIClient
    private let defaults: UserDefaults

    init(client: MishranAPIClient, defaults: UserDefaults = .standard) {
        self.client = client
        self.defaults = defaults
    }

    /// Digits for wa.me deep links — cache first, one fetch on miss, the
    /// fallback number when both fail.
    func whatsappDigits() async -> String {
        if let cached = Self.cachedBrand(from: defaults) {
            return cached.whatsappDigits
        }
        guard let brand: BrandDTO = try? await client.request(Endpoint.brand),
              !brand.whatsappDigits.isEmpty else {
            return Self.fallbackDigits
        }
        Self.cache(brand, in: defaults)
        return brand.whatsappDigits
    }

    /// wa.me link for a digits string (fallback included).
    nonisolated static func whatsappURL(digits: String) -> URL? {
        URL(string: "https://wa.me/\(digits)")
    }

    /// Cached BrandDTO, nil when nothing (or garbage) was stored.
    nonisolated static func cachedBrand(from defaults: UserDefaults) -> BrandDTO? {
        guard let data = defaults.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder().decode(BrandDTO.self, from: data)
    }

    nonisolated static func cache(_ brand: BrandDTO, in defaults: UserDefaults) {
        if let data = try? JSONEncoder().encode(brand) {
            defaults.set(data, forKey: cacheKey)
        }
    }
}
