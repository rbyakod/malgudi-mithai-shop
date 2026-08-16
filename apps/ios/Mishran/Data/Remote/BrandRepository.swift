// BrandRepository.swift — P1 parity (Mishran Mobile Apps v1); P3 adds the
// brand-copy reads. Cached fetch of GET /brand (whatsappNumber +
// whatsappDigits + the optional brandName/tagline/positioning trio) for the
// apps' help surfaces, the Home announcement strip, and the static hero's
// live copy. Mirrors AddressRepository's actor pattern: errors collapse to
// the shared placeholder number / nil copy so a failing backend degrades
// the affected row instead of dead-ending it. The Brand doc is tiny and
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

    /// Full cached brand doc — cache first, one fetch on miss, nil when both
    /// fail (the copy fields ride the same BrandDTO + UserDefaults cache the
    /// WhatsApp digits always have). A doc is only cached once its required
    /// WhatsApp pair decodes, so a nil return means "use the bundled
    /// app.name/app.tagline strings", never a half-populated row.
    func brand() async -> BrandDTO? {
        if let cached = Self.cachedBrand(from: defaults) {
            return cached
        }
        guard let fetched: BrandDTO = try? await client.request(Endpoint.brand),
              !fetched.whatsappDigits.isEmpty else {
            return nil
        }
        Self.cache(fetched, in: defaults)
        return fetched
    }

    /// Digits for wa.me deep links — the cached doc, one fetch on miss, the
    /// fallback number when both fail.
    func whatsappDigits() async -> String {
        await brand()?.whatsappDigits ?? Self.fallbackDigits
    }

    /// wa.me link for a digits string (fallback included); an optional text
    /// prefill rides ?text= percent-encoded (URLQueryItem owns the escaping,
    /// so newlines in the composed message survive the round trip).
    nonisolated static func whatsappURL(digits: String, text: String? = nil) -> URL? {
        guard var components = URLComponents(string: "https://wa.me/\(digits)") else { return nil }
        if let text, !text.isEmpty {
            components.queryItems = [URLQueryItem(name: "text", value: text)]
        }
        return components.url
    }

    /// Cached BrandDTO, nil when nothing (or garbage) was stored. Optional
    /// copy fields decode as nil, so pre-P3 cached JSON stays readable.
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
