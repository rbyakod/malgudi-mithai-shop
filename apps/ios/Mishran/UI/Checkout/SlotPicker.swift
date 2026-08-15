// SlotPicker.swift — Task 17.2 (Mishran Mobile Apps v1).
// Fresh-tier only: Delhi NCR same-day delivery windows.
import SwiftUI

struct SlotPicker: View {
    let options: [DeliverySlot]
    @Binding var selection: DeliverySlot?

    var body: some View {
        Picker(L("checkout.slot.title"), selection: $selection) {
            ForEach(options) { slot in
                Text(slot.label).tag(DeliverySlot?.some(slot))
            }
        }
        .pickerStyle(.inline)
        .labelsHidden()
        .accessibilityLabel(L("checkout.slot.title"))
        .accessibilityHint("Choose a delivery window")
    }
}
