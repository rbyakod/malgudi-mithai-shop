// AddressFormView.swift — Task 48.2 (Mishran Mobile Apps v1).
// Add-address sheet (parity with Android's AddAddressDialog): the Android
// field set — line1/line2/city/state/pincode/tag chips/default checkbox.
// Save is enabled when line1/city/state are non-blank and the pincode is
// 6 digits. AddressForm is a plain struct so the validation rules are
// unit-testable without rendering the sheet.
import SwiftUI

/// Editable form state + the pure validation the Save button gates on.
struct AddressForm: Equatable {
    var line1 = ""
    var line2 = ""
    var city = ""
    var state = ""
    var pincode = ""
    var tag: AddressTag = .home
    var isDefault = false

    /// Contract parity: input requires line1/city/state + a 6-digit pincode
    /// (same rules the Android dialog enforces client-side).
    var isValid: Bool {
        !line1.trimmed.isEmpty
            && !city.trimmed.isEmpty
            && !state.trimmed.isEmpty
            && Self.pincodeIsValid(pincode)
    }

    /// Writable body for POST /addresses — trimmed, blank line2 → nil.
    var input: AddressInputDTO {
        AddressInputDTO(
            line1: line1.trimmed,
            line2: line2.trimmed.isEmpty ? nil : line2.trimmed,
            city: city.trimmed,
            state: state.trimmed,
            pincode: pincode,
            tag: tag,
            isDefault: isDefault
        )
    }

    nonisolated static func pincodeIsValid(_ pincode: String) -> Bool {
        pincode.count == 6 && pincode.allSatisfy(\.isNumber)
    }
}

extension String {
    /// Whitespace-only trimming used across the form fields.
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct AddressFormView: View {
    /// Runs the save (repository create); true = created, false = the sheet
    /// stays up and shows the failure. Returning through a closure keeps the
    /// form usable from both the addresses screen and checkout.
    var onSave: ((AddressInputDTO) async -> Bool)? = nil

    @State private var form = AddressForm()
    @State private var isSaving = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(L("checkout.address.line1"), text: $form.line1)
                        .accessibilityLabel("Address line 1")
                    TextField(L("checkout.address.line2"), text: $form.line2)
                        .accessibilityLabel("Address line 2, optional")
                    TextField(L("checkout.address.city"), text: $form.city)
                        .accessibilityLabel("City")
                    TextField(L("checkout.address.state"), text: $form.state)
                        .accessibilityLabel("State")
                    TextField("\(L("checkout.address.pincode")) (6 digits)", text: $form.pincode)
                        .keyboardType(.numberPad)
                        .onChange(of: form.pincode) { _, newValue in
                            form.pincode = String(newValue.filter(\.isNumber).prefix(6))
                        }
                        .accessibilityLabel("Pincode, 6 digits")
                }

                Section {
                    Picker(L("checkout.address.tag"), selection: $form.tag) {
                        ForEach(AddressTag.allCases) { tag in
                            Text(tag.displayName).tag(tag)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityLabel("Address tag")

                    Toggle("Set as default", isOn: $form.isDefault)
                        .accessibilityLabel("Set as default address")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.mishranBodySm)
                            .foregroundStyle(Color.mishranStateError)
                    }
                }
            }
            .navigationTitle("New address")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L("common.cancel")) { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save") {
                            Task { await save() }
                        }
                        .disabled(!form.isValid)
                    }
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let created = await onSave?(form.input) ?? true
        if created {
            dismiss()
        } else {
            errorMessage = "Could not save the address. Try again."
        }
    }
}
