// GiftViewModel.swift — P3 parity (Mishran Mobile Apps v1).
// Submit state for the gift-box builder (EnquiryViewModel pattern): holds
// the pure GiftForm, gates on its validation, and swaps to the success
// panel (leadId reference) once POST /api/leads answers.
import Foundation
import Observation

@MainActor
@Observable
final class GiftViewModel {
    private let repository: LeadRepository

    var form: GiftForm
    private(set) var isSubmitting = false
    /// Set on success — the screen swaps to the thank-you panel.
    private(set) var lead: LeadResponseDTO?
    var errorMessage: String?

    init(repository: LeadRepository, form: GiftForm = GiftForm()) {
        self.repository = repository
        self.form = form
    }

    var canSubmit: Bool {
        !isSubmitting && form.isValid
    }

    func submit() async {
        guard form.isValid, lead == nil else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        if let response = await repository.submit(form.input) {
            lead = response
        } else {
            errorMessage = L("enquiry.error")
        }
    }

    /// "Send another" — back to a clean form, keeping the contact trio the
    /// shopper already typed (the next gift rarely changes hands).
    func sendAnother() {
        var fresh = GiftForm()
        fresh.name = form.name
        fresh.email = form.email
        fresh.phone = form.phone
        form = fresh
        lead = nil
        errorMessage = nil
    }
}
