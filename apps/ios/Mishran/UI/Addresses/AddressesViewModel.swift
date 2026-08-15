// AddressesViewModel.swift — Task 48.2 (Mishran Mobile Apps v1).
// Account → Delivery addresses state (parity with Android's 10.2
// AddressesViewModel): list/set-default/create/delete over
// AddressRepository, mirroring every mutation back into the SwiftData
// AddressEntity cache so checkout's @Query-backed picker stays in sync.
import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class AddressesViewModel {
    private let repository: AddressRepository
    private let context: ModelContext

    private(set) var addresses: [AddressDTO] = []
    private(set) var isLoading = false
    /// One-line status for the screen ("Could not set the default. Try
    /// again.") — mirrors Android's snackbar copy.
    var message: String?

    init(repository: AddressRepository, context: ModelContext) {
        self.repository = repository
        self.context = context
    }

    /// Refetch the server list, then swap the local cache to match.
    func refresh() async {
        isLoading = true
        defer { isLoading = false }
        addresses = await repository.list()
        AddressEntity.replaceAll(with: addresses, in: context)
    }

    /// Create via the form; refreshes the list or reports the failure.
    func create(_ input: AddressInputDTO) async -> Bool {
        guard await repository.create(input: input) != nil else {
            message = "Could not save the address. Try again."
            return false
        }
        message = nil
        await refresh()
        return true
    }

    /// PATCH the address with isDefault=true (the server demotes the
    /// previous default; refresh picks the change up).
    func setDefault(_ address: AddressDTO) async {
        guard let id = address.id, address.isDefault != true else { return }
        let updated = await repository.update(id: id, input: AddressInputDTO(address: address, isDefault: true))
        if updated != nil {
            message = nil
            await refresh()
        } else {
            message = "Could not set the default. Try again."
        }
    }

    /// Swipe-to-delete; a failure keeps the row and reports why.
    func delete(_ address: AddressDTO) async {
        guard let id = address.id else { return }
        if await repository.delete(id: id) {
            message = nil
            await refresh()
        } else {
            message = "Could not delete the address. Try again."
        }
    }
}
