// OrderConfirmedView.swift — post-checkout confirmation (Android 10.4
// parity). Order number + track / continue actions; deep-linkable via
// mishran://order pushes straight past it to the detail.
import SwiftUI

struct OrderConfirmedView: View {
    let orderId: String
    var onTrackOrder: () -> Void
    var onContinueShopping: () -> Void

    var body: some View {
        VStack(spacing: .mishranSpacingLg) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.mishranStateSuccess)
                .accessibilityHidden(true)

            Text("Order confirmed")
                .font(.mishranDisplay.weight(.semibold))

            Text("Order \(orderId)")
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)

            Text("We'll notify you as your sweets move through the kitchen and out for delivery.")
                .font(.mishranBodySm)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: .mishranSpacingSm) {
                Button(action: onTrackOrder) {
                    Label("Track order", systemImage: "shippingbox")
                        .font(.mishranBodyMd.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)

                Button("Continue shopping", action: onContinueShopping)
                    .font(.mishranBodyMd)
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, .mishranSpacingLg)
        }
        .padding(.mishranSpacingLg)
        .navigationTitle("Thank you")
        .navigationBarBackButtonHidden(true)
    }
}
