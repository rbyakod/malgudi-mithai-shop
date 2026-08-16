// GiftView.swift — P3 parity (Mishran Mobile Apps v1).
// Gift-box builder (EnquiryView pattern): contact fields + the occasion/
// box-size/budget picker trio + needed-by date + dietary/message-card
// notes, submit gated on GiftForm's pure validation, success panel showing
// the leadId reference. Entry point: Account's "Build a gift" row
// (Route.gift). Labels resolve from packages/i18n-strings (gift.* plus the
// shared enquiry.field.* strings) via the L() helper.
import SwiftUI

struct GiftView: View {
    @State private var viewModel: GiftViewModel

    /// `initialPhone` pre-fills from the session phone (AuthViewModel's
    /// signed-in cache) so a signed-in user types less — same as Enquiry.
    init(
        repository: LeadRepository = LeadRepository(client: MishranAPIClient()),
        initialPhone: String = UserDefaults.standard.string(forKey: AuthViewModel.sessionPhoneKey) ?? ""
    ) {
        var form = GiftForm()
        form.phone = initialPhone
        _viewModel = State(initialValue: GiftViewModel(repository: repository, form: form))
    }

    var body: some View {
        Group {
            if let lead = viewModel.lead {
                successPanel(lead)
            } else {
                formBody
            }
        }
        .navigationTitle(L("gift.title"))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Form

    private var formBody: some View {
        Form {
            Section {
                Text(L("gift.subtitle"))
                    .font(.mishranBodySm)
                    .foregroundStyle(.secondary)
            }

            Section("Contact") {
                TextField(L("enquiry.field.name"), text: $viewModel.form.name)
                    .accessibilityLabel("Your name")
                TextField(L("enquiry.field.email"), text: $viewModel.form.email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Email address")
                TextField(L("enquiry.field.phone"), text: $viewModel.form.phone)
                    .keyboardType(.phonePad)
                    .accessibilityLabel("Phone number")
                TextField(L("enquiry.field.city"), text: $viewModel.form.city)
                    .accessibilityLabel("City")
            }

            Section("The box") {
                Picker(L("gift.field.occasion"), selection: $viewModel.form.occasion) {
                    ForEach(GiftFormOptions.occasions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .accessibilityLabel(L("gift.field.occasion"))
                Picker(L("gift.field.box_size"), selection: $viewModel.form.boxSize) {
                    ForEach(GiftFormOptions.boxSizes, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .accessibilityLabel(L("gift.field.box_size"))
                Picker(L("gift.field.budget"), selection: $viewModel.form.budget) {
                    ForEach(GiftFormOptions.budgets, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
                .accessibilityLabel(L("gift.field.budget"))
                DatePicker(L("enquiry.field.deadline"), selection: $viewModel.form.neededBy, displayedComponents: .date)
                    .accessibilityLabel("Needed by date")
            }

            Section("Notes") {
                TextField(L("gift.field.dietary"), text: $viewModel.form.dietary, axis: .vertical)
                    .lineLimit(1...3)
                    .accessibilityLabel("Dietary notes")
                TextField(L("gift.field.message"), text: $viewModel.form.message, axis: .vertical)
                    .lineLimit(1...3)
                    .accessibilityLabel("Message card")
            }

            Section {
                Button {
                    Task { await viewModel.submit() }
                } label: {
                    HStack {
                        if viewModel.isSubmitting {
                            ProgressView()
                        } else {
                            Text(L("gift.submit"))
                                .font(.mishranBodyLg.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(!viewModel.canSubmit)
                .accessibilityLabel(L("gift.submit"))

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

    /// Thank-you panel (EnquiryView's submitted state): gift.success copy +
    /// the leadId reference ops quotes back, with a send-another reset.
    private func successPanel(_ lead: LeadResponseDTO) -> some View {
        VStack(spacing: .mishranSpacingMd) {
            Spacer()
            Image(systemName: "gift.fill")
                .font(.mishranDisplay)
                .foregroundStyle(Color.mishranBrandAccent)
                .accessibilityHidden(true)
            Text(lead.message)
                .font(.mishranBodyXl.weight(.semibold))
                .multilineTextAlignment(.center)
            Text(L("enquiry.reference", lead.leadId))
                .font(.mishranBodySm)
                .foregroundStyle(.secondary)
            Text(L("gift.success"))
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                viewModel.sendAnother()
            } label: {
                Text(L("enquiry.send_another"))
                    .font(.mishranBodyMd.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .tint(Color.mishranBrandAccent)
            .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
            .accessibilityLabel(L("enquiry.send_another"))
            Spacer()
        }
        .padding(.mishranSpacingLg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
