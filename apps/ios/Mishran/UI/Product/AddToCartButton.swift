// AddToCartButton.swift — Task 16.4 (Mishran Mobile Apps v1).
import SwiftUI

struct AddToCartButton: View {
    let action: () -> Void
    var isAdded: Bool = false

    var body: some View {
        Button {
            action()
        } label: {
            Label(
                isAdded ? "Added to cart" : "Add to cart",
                systemImage: isAdded ? "checkmark.circle.fill" : "cart.badge.plus"
            )
            .font(.mishranBodyLg.weight(.semibold))
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.mishranBrandAccent)
        .foregroundStyle(Color.mishranBrandCanvas)
        .controlSize(.large)
        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
        .animation(.easeInOut(duration: 0.15), value: isAdded)
        .accessibilityLabel(isAdded ? "Added to cart" : "Add to cart")
    }
}
