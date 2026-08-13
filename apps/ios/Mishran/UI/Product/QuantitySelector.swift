// QuantitySelector.swift — Task 16.4 (Mishran Mobile Apps v1).
import SwiftUI

struct QuantitySelector: View {
    @Binding var quantity: Int
    var bounds: ClosedRange<Int> = 1...20

    var body: some View {
        HStack(spacing: .mishranSpacingMd) {
            Button {
                quantity = max(quantity - 1, bounds.lowerBound)
            } label: {
                Image(systemName: "minus.circle.fill")
                    .font(.mishranBodyXxl)
                    .foregroundStyle(Color.mishranBrandAccent)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .disabled(quantity <= bounds.lowerBound)
            .accessibilityLabel("Decrease quantity")

            Text("\(quantity)")
                .font(.mishranBodyXxl.weight(.semibold))
                .monospacedDigit()
                .frame(minWidth: 44)
                .accessibilityLabel("Quantity, \(quantity)")

            Button {
                quantity = min(quantity + 1, bounds.upperBound)
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.mishranBodyXxl)
                    .foregroundStyle(Color.mishranBrandAccent)
                    .frame(minWidth: 44, minHeight: 44)
            }
            .disabled(quantity >= bounds.upperBound)
            .accessibilityLabel("Increase quantity")
        }
    }
}
