// AddressRepository.swift — Task 48.2 (Mishran Mobile Apps v1).
// Thin wrapper over the addresses routes (parity with Android's 10.2
// AddressRepository): checkout's picker and the account addresses screen
// both read through here. Errors collapse to an empty list / nil / false
// so a failing backend degrades the UI instead of dead-ending it — the
// caller decides what "no addresses" means.
import Foundation

actor AddressRepository {
    private let client: MishranAPIClient

    init(client: MishranAPIClient) {
        self.client = client
    }

    /// Saved addresses, default first; empty on any failure (offline-safe).
    func list() async -> [AddressDTO] {
        let page: AddressPageDTO? = try? await client.request(Endpoint.addressList())
        guard let page else { return [] }
        return Self.defaultFirst(page.items)
    }

    /// POST /addresses → the created address, or nil when the call fails.
    func create(input: AddressInputDTO) async -> AddressDTO? {
        let response: AddressMutationResponseDTO? = try? await client.request(
            Endpoint.addressCreate(input: input)
        )
        return response?.address
    }

    /// PATCH /addresses/{id} — full replace (the contract has no partial
    /// update); callers rebuild the input from the fetched address.
    func update(id: String, input: AddressInputDTO) async -> AddressDTO? {
        let response: AddressMutationResponseDTO? = try? await client.request(
            Endpoint.addressUpdate(id: id, input: input)
        )
        return response?.address
    }

    /// DELETE /addresses/{id} — false when the call fails.
    func delete(id: String) async -> Bool {
        let response: OkResponseDTO? = try? await client.request(Endpoint.addressDelete(id: id))
        return response?.ok == true
    }

    /// Default-flagged rows first; server order preserved otherwise (index
    /// tiebreak keeps the sort deterministic — `sorted` is not stable).
    nonisolated static func defaultFirst(_ addresses: [AddressDTO]) -> [AddressDTO] {
        addresses.enumerated()
            .sorted { lhs, rhs in
                let lhsDefault = lhs.element.isDefault == true
                let rhsDefault = rhs.element.isDefault == true
                if lhsDefault != rhsDefault { return lhsDefault }
                return lhs.offset < rhs.offset
            }
            .map(\.element)
    }
}
