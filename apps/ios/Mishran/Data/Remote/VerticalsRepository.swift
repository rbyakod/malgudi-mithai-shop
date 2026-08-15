// VerticalsRepository.swift — P2 (Mishran Mobile Apps v1).
// Actor wrapper over the snacks / QSR / merch routes (same pattern as
// AddressRepository): the catalog's vertical tabs and Home's portal row both
// read through here. List + detail calls throw so the consuming view models
// own loading/error/retry state; portalPages() is the one nil-tolerant
// reader — a dead vertical degrades its Home card to a placeholder tile
// instead of failing the whole home screen.
import Foundation

actor VerticalsRepository {
    private let client: MishranAPIClient

    init(client: MishranAPIClient) {
        self.client = client
    }

    func snacks() async throws -> SnackPageDTO {
        try await client.request(Endpoint.snacksList())
    }

    func qsr() async throws -> QsrPageDTO {
        try await client.request(Endpoint.qsrList())
    }

    func merch() async throws -> MerchPageDTO {
        try await client.request(Endpoint.merchList())
    }

    func snackDetail(slug: String) async throws -> SnackDTO {
        try await client.request(Endpoint.snackDetail(slug: slug))
    }

    func qsrDetail(slug: String) async throws -> QsrItemDTO {
        try await client.request(Endpoint.qsrDetail(slug: slug))
    }

    func merchDetail(slug: String) async throws -> MerchDTO {
        try await client.request(Endpoint.merchDetail(slug: slug))
    }

    /// First pages of all three verticals, fetched in parallel, each
    /// collapsing to nil on failure — Home's portals render counts + lead
    /// imagery off the results and never see an error.
    func portalPages() async -> (snacks: SnackPageDTO?, qsr: QsrPageDTO?, merch: MerchPageDTO?) {
        async let snacksPage = snacks()
        async let qsrPage = qsr()
        async let merchPage = merch()
        return await ((try? snacksPage) ?? nil, (try? qsrPage) ?? nil, (try? merchPage) ?? nil)
    }
}
