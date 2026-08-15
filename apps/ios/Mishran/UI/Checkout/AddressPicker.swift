// AddressPicker.swift — Task 17.2 (Mishran Mobile Apps v1).
// Task 48.2: rows now come from the addresses flow's SwiftData mirror
// (AddressEntity.replaceAll) and default-first ordering replaced the old
// label sort that died with the label field.
//
// The picker tags by address id (non-optional String): optional-typed
// `.tag(Optional<AddressEntity>)` crashes the Swift 6.3.3 type-checker
// under the SwiftUI 26 SDK (unhandled coercion in tag(_:includeOptional:)
// — verified with explicit `as AddressEntity?` coercions too).
import SwiftData
import SwiftUI

struct AddressPicker: View {
    @Query private var addresses: [AddressEntity]
    @Binding var selection: AddressEntity?
    var onAddAddress: (() -> Void)? = nil

    /// Default-flagged rows first (the server list already arrives this
    /// way; the local sort keeps it true if the cache gets out of step).
    private var sortedAddresses: [AddressEntity] {
        addresses.sorted { $0.isDefault && !$1.isDefault }
    }

    var body: some View {
        Group {
            if addresses.isEmpty {
                Button {
                    onAddAddress?()
                } label: {
                    Label("Add delivery address", systemImage: "plus.circle")
                }
                .accessibilityLabel("Add delivery address")
            } else {
                Picker("Address", selection: idSelection) {
                    Text("Choose…").tag("")
                    ForEach(sortedAddresses, id: \.id) { address in
                        VStack(alignment: .leading) {
                            Text(Self.rowTitle(address))
                            Text("\(address.city) \(address.pincode)")
                                .font(.mishranBodySm)
                                .foregroundStyle(.secondary)
                        }
                        .tag(address.id)
                    }
                }
                .pickerStyle(.navigationLink)
                .accessibilityLabel("Delivery address")
            }
        }
    }

    /// Bridges the id-based picker selection to the entity binding; the
    /// empty-string tag maps back to "no selection".
    private var idSelection: Binding<String> {
        Binding(
            get: { selection?.id ?? "" },
            set: { id in selection = addresses.first { $0.id == id } }
        )
    }

    /// "Home — 12 MG Road" (tag missing → "Address").
    private static func rowTitle(_ address: AddressEntity) -> String {
        let label = address.tag?.capitalized ?? "Address"
        return "\(label) — \(address.line1)"
    }
}
