// EnquiryView.swift — P2 (Mishran Mobile Apps v1).
// Bulk & events enquiry (single screen, Wedding | Corporate toggle):
// contact fields + type-specific extras, submit gated on EnquiryForm's pure
// validation, success panel showing the leadId reference. Entry points:
// merch detail's "Enquire" (corporate pre-set) and Account's row (wedding).
// Labels resolve from packages/i18n-strings (enquiry.*) via the L()
// helper — Task 20.3 wiring.
import SwiftUI

struct EnquiryView: View {
    @State private var viewModel: EnquiryViewModel

    /// `initialPhone` pre-fills from the session phone (AuthViewModel's
    /// signed-in cache) so a signed-in user types less.
    init(
        repository: LeadRepository = LeadRepository(client: MishranAPIClient()),
        initialType: EnquiryType = .wedding,
        initialPhone: String = UserDefaults.standard.string(forKey: AuthViewModel.sessionPhoneKey) ?? ""
    ) {
        var form = EnquiryForm()
        form.type = initialType
        form.phone = initialPhone
        _viewModel = State(initialValue: EnquiryViewModel(repository: repository, form: form))
    }

    var body: some View {
        Group {
            if let lead = viewModel.lead {
                successPanel(lead)
            } else {
                formBody
            }
        }
        .navigationTitle(L("enquiry.title"))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Form

    private var formBody: some View {
        Form {
            Section {
                Picker("Type", selection: $viewModel.form.type) {
                    ForEach(EnquiryType.allCases) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Enquiry type")
            }

            Section("Contact") {
                TextField(L("enquiry.field.name"), text: $viewModel.form.name)
                    .accessibilityLabel("Your name")
                TextField(L("enquiry.field.phone"), text: $viewModel.form.phone)
                    .keyboardType(.phonePad)
                    .accessibilityLabel("Phone number")
                TextField(L("enquiry.field.email"), text: $viewModel.form.email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Email address")
                TextField(L("enquiry.field.message"), text: $viewModel.form.message, axis: .vertical)
                    .lineLimit(3...6)
                    .accessibilityLabel("Message")
            }

            switch viewModel.form.type {
            case .wedding:
                Section("Wedding details") {
                    DatePicker(L("enquiry.field.date"), selection: $viewModel.form.eventDate, displayedComponents: .date)
                        .accessibilityLabel("Event date")
                    TextField(L("enquiry.field.city"), text: $viewModel.form.city)
                        .accessibilityLabel("City")
                    TextField(L("enquiry.field.guests"), text: $viewModel.form.guests)
                        .keyboardType(.numberPad)
                        .accessibilityLabel("Number of guests")
                }
            case .corporate:
                Section("Corporate details") {
                    TextField(L("enquiry.field.company"), text: $viewModel.form.company)
                        .textInputAutocapitalization(.words)
                        .accessibilityLabel("Company name")
                    TextField(L("enquiry.field.quantity"), text: $viewModel.form.quantity)
                        .keyboardType(.numberPad)
                        .accessibilityLabel("Quantity")
                    DatePicker(L("enquiry.field.deadline"), selection: $viewModel.form.neededBy, displayedComponents: .date)
                        .accessibilityLabel("Needed by date")
                }
            }

            Section {
                Button {
                    Task { await viewModel.submit() }
                } label: {
                    HStack {
                        if viewModel.isSubmitting {
                            ProgressView()
                        } else {
                            Text(L("enquiry.submit"))
                                .font(.mishranBodyLg.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(!viewModel.canSubmit)
                .accessibilityLabel("Submit enquiry")

                if let message = viewModel.errorMessage {
                    Text(message)
                        .font(.mishranBodySm)
                        .foregroundStyle(Color.mishranStateError)
                        .accessibilityLabel("Error: \(message)")
                }
            }
        }
    }

    // MARK: Success

    /// Thank-you panel (web LeadForm's submitted state): enquiry.success
    /// copy + the leadId reference ops quotes back.
    private func successPanel(_ lead: LeadResponseDTO) -> some View {
        VStack(spacing: .mishranSpacingMd) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.mishranDisplay)
                .foregroundStyle(Color.mishranStateSuccess)
                .accessibilityHidden(true)
            Text(lead.message)
                .font(.mishranBodyXl.weight(.semibold))
                .multilineTextAlignment(.center)
            Text("Reference: \(lead.leadId)")
                .font(.mishranBodySm)
                .foregroundStyle(.secondary)
            Text(L("enquiry.success"))
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.mishranSpacingLg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }
}
