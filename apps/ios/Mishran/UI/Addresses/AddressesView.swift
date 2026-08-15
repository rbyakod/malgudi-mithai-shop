// AddressesView.swift — Task 48.2 (Mishran Mobile Apps v1).
// Account → Delivery addresses (parity with Android's AddressesScreen):
// rows with tag/Default labels + radio set-default + swipe-to-delete,
// "Add address" opens the shared AddressFormView sheet. The view model
// builds only once the ambient model context exists (HomeView pattern).
import SwiftData
import SwiftUI

struct AddressesView: View {
    @Environment(\.modelContext) private var context
    @State private var viewModel: AddressesViewModel?
    @State private var showingForm = false

    var body: some View {
        Group {
            if let viewModel {
                List {
                    if viewModel.isLoading && viewModel.addresses.isEmpty {
                        HStack {
                            ProgressView()
                            Text(L("common.loading"))
                                .font(.mishranBodyMd)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
                    }


                    if !viewModel.isLoading, viewModel.addresses.isEmpty {
                        Text("No saved addresses yet — add one for faster checkout.")
                            .font(.mishranBodyMd)
                            .foregroundStyle(.secondary)
                    }

                    ForEach(viewModel.addresses) { address in
                        AddressRow(address: address) {
                            Task { await viewModel.setDefault(address) }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { await viewModel.delete(address) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                            .accessibilityLabel("Delete address \(address.line1 ?? "")")
                        }
                    }

                    Section {
                        Button {
                            showingForm = true
                        } label: {
                            Label(L("checkout.address.add_new"), systemImage: "plus.circle")
                                .font(.mishranBodyLg.weight(.semibold))
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .accessibilityLabel(L("checkout.address.add_new"))
                    }

                    if let message = viewModel.message {
                        Text(message)
                            .font(.mishranBodySm)
                            .foregroundStyle(Color.mishranStateError)
                    }
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle(L("account.addresses"))
        .task {
            guard viewModel == nil else { return }
            viewModel = AddressesViewModel(
                repository: AddressRepository(client: MishranAPIClient()),
                context: context
            )
            await viewModel?.refresh()
        }
        .sheet(isPresented: $showingForm) {
            AddressFormView { input in
                await viewModel?.create(input) ?? false
            }
        }
    }
}

/// One saved address: radio-style default toggle on the left, tag +
/// "Default" labels over the multiline address (Android's AddressRow).
private struct AddressRow: View {
    let address: AddressDTO
    var onSetDefault: () -> Void

    private var isDefault: Bool { address.isDefault == true }

    var body: some View {
        Button {
            onSetDefault()
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: .mishranSpacingMd) {
                Image(systemName: isDefault ? "checkmark.circle.fill" : "circle")
                    .font(.mishranBodyLg)
                    .foregroundStyle(Color.mishranBrandAccent)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: .mishranSpacingSm) {
                        if let tag = address.tag {
                            Text(tag.displayName)
                                .font(.mishranBodySm.weight(.semibold))
                                .foregroundStyle(Color.mishranBrandAccent)
                        }
                        if isDefault {
                            Text("Default")
                                .font(.mishranBodySm)
                                .foregroundStyle(Color.mishranBrandAccent)
                        }
                    }

                    Text(multilineAddress)
                        .font(.mishranBodyMd)
                        .foregroundStyle(Color.mishranBrandInk)
                        .multilineTextAlignment(.leading)
                }
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .accessibilityLabel(accessibilityText)
        .accessibilityHint(isDefault ? "Default delivery address" : "Sets this as the default delivery address")
    }

    /// line1 / line2 / city, state / pincode — one part per line, blanks skipped.
    private var multilineAddress: String {
        let cityState = [address.city, address.state]
            .compactMap(\.self)
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        return [address.line1, address.line2, cityState.isEmpty ? nil : cityState, address.pincode]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: "\n")
    }

    private var accessibilityText: String {
        var parts: [String] = []
        if let tag = address.tag { parts.append(tag.displayName) }
        if isDefault { parts.append("Default address") }
        parts.append(address.line1 ?? "Address")
        return parts.joined(separator: ", ")
    }
}
