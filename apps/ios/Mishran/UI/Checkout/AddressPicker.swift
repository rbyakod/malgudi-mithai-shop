// AddressPicker.swift — Task 17.2 (Mishran Mobile Apps v1).
import SwiftData
import SwiftUI

struct AddressPicker: View {
    @Query(sort: \AddressEntity.label) private var addresses: [AddressEntity]
    @Binding var selection: AddressEntity?
    var onAddAddress: (() -> Void)? = nil

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
                Picker("Address", selection: $selection) {
                    Text("Choose…").tag(AddressEntity?.none)
                    ForEach(addresses, id: \.id) { address in
                        VStack(alignment: .leading) {
                            Text("\(address.label) — \(address.line1)")
                            Text("\(address.city) \(address.pincode)")
                                .font(.mishranBodySm)
                                .foregroundStyle(.secondary)
                        }
                        .tag(AddressEntity?.some(address))
                    }
                }
                .pickerStyle(.navigationLink)
                .accessibilityLabel("Delivery address")
            }
        }
    }
}
