// EnquiryViewModel.swift — P2 (Mishran Mobile Apps v1).
// Submit state for the enquiry screen: holds the pure EnquiryForm, gates on
// its validation, and swaps to the success panel (leadId reference) once
// POST /api/leads answers.
import Foundation
import Observation

@MainActor
@Observable
final class EnquiryViewModel {
    private let repository: LeadRepository

    var form: EnquiryForm
    private(set) var isSubmitting = false
    /// Set on success — the screen swaps to the thank-you panel.
    private(set) var lead: LeadResponseDTO?
    var errorMessage: String?

    init(repository: LeadRepository, form: EnquiryForm = EnquiryForm()) {
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
            errorMessage = "Something went wrong. Please try again."
        }
    }
}
