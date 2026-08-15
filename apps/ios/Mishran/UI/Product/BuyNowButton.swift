// BuyNowButton.swift — P1 parity (Mishran Mobile Apps v1).
// Secondary action beside Add to cart: same add-to-cart upsert for the
// selected pack, but the caller routes straight to checkout.
import SwiftUI

struct BuyNowButton: View {
    let action: () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            Label(L("product.buy_now"), systemImage: "bolt")
                .font(.mishranBodyLg.weight(.semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .tint(Color.mishranBrandAccent)
        .controlSize(.large)
        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
        .accessibilityLabel(L("product.buy_now"))
        .accessibilityHint("Adds this to your cart and goes straight to checkout")
    }
}
