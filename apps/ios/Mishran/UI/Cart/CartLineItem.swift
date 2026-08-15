// CartLineItem.swift — Task 17.1 (Mishran Mobile Apps v1).
import SwiftUI

struct CartLineItem: View {
    let line: CartItemEntity
    var onQuantityChange: (Int) -> Void
    var onRemove: () -> Void

    var body: some View {
        HStack(spacing: .mishranSpacingMd) {
            // Cart lines carry no image URL yet (CartItemEntity has no image
            // field) — nil keeps the placeholder tile until that lands.
            ProductRemoteImage(imageURL: nil)
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusSm))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                // Derived pack lines carry their chip in the label ("500g");
                // base lines render the bare product name as before.
                Text(line.packLabel.map { "\(line.name) (\($0))" } ?? line.name)
                    .font(.mishranBodyMd.weight(.semibold))
                Text(rupees(from: line.unitPricePaise))
                    .font(.mishranBodySm)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            QuantitySelector(quantity: Binding(
                get: { line.quantity },
                set: { onQuantityChange($0) }
            ))
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .contain)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                onRemove()
            } label: {
                Label("Remove", systemImage: "trash")
            }
            .accessibilityLabel("Remove \(line.name) from cart")
        }
    }

    private func rupees(from paise: Int) -> String {
        let rupees = Double(paise) / 100
        return "₹\(rupees.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(rupees)) : String(format: "%.2f", rupees))"
    }
}
