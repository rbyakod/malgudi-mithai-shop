// LeadRepository.swift — P2 (Mishran Mobile Apps v1).
// Actor wrapper over POST /api/leads (the Bulk & events form's submit).
// AddressRepository idiom: errors collapse to nil so the enquiry view model
// decides what a failed submit looks like — the form stays up with the
// generic error message, never a dead end.
import Foundation

actor LeadRepository {
    private let client: MishranAPIClient

    init(client: MishranAPIClient) {
        self.client = client
    }

    /// Submit a lead → the created leadId + message, nil when the call fails.
    func submit(_ input: LeadInputDTO) async -> LeadResponseDTO? {
        try? await client.submitLead(input)
    }
}
