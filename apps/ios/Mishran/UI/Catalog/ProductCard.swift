// ProductCard.swift — Task 16.3 (Mishran Mobile Apps v1).
// 2-column catalog card: brand surface, name, price, freshness. P3 parity:
// an optional quick-add button overlays the image corner — base pack, one
// tap, transient "Added" confirmation (mithai catalog grid only; the Home
// rail and other surfaces leave the closure nil and render the plain card).
import SwiftUI

struct ProductCard: View {
    let product: ProductEntity
    var onTap: (() -> Void)? = nil
    /// Quick add: writes the BASE pack line (verbatim displayPrice, bare
    /// productId — merges with PDP base-pack adds by construction). Nil on
    /// surfaces that don't quick-add.
    var onQuickAdd: (() -> Void)? = nil

    /// Transient post-tap confirmation: flips the button to "Added" for a
    /// beat, then back. @State keeps the flag per-card, so only the tapped
    /// card confirms.
    @State private var showsAdded = false

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                ProductRemoteImage(imageURL: product.images?.first)
                    .frame(height: 110)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    // Hidden BEFORE the overlay so the decorative image
                    // stays out of the a11y tree while the quick-add button
                    // riding it stays visible to VoiceOver/XCUITest.
                    .accessibilityHidden(true)
                    .overlay(alignment: .bottomTrailing) {
                        if onQuickAdd != nil {
                            quickAddButton
                        }
                    }

                Text(product.name)
                    .font(.mishranBodyMd.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)

                if let price = product.displayPrice {
                    Text(price)
                        .font(.mishranBodySm)
                        .foregroundStyle(.secondary)
                }

                if let freshness = product.freshnessStatus {
                    Text(freshness)
                        .font(.mishranBodySm)
                        .foregroundStyle(Color.mishranBrandAccent)
                        .lineLimit(1)
                }
            }
            .padding(.mishranSpacingSm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .fill(Color.mishranBrandSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .strokeBorder(Color.mishranBrandAccent.opacity(0.15), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(product.name)\(product.displayPrice.map { ", \($0)" } ?? "")")
        .accessibilityHint("View details")
    }

    /// Compact plus button on the image corner: small visual, 44×44 hit
    /// area (contentShape + fixed frame — the audit reads element frames).
    /// Tapping adds without leaving the grid; the checkmark + "Added" label
    /// confirm for ~1.2s before the button resets.
    private var quickAddButton: some View {
        Button {
            onQuickAdd?()
            showsAdded = true
            Task {
                try? await Task.sleep(nanoseconds: 1_200_000_000)
                showsAdded = false
            }
        } label: {
            Image(systemName: showsAdded ? "checkmark" : "plus")
                .font(.mishranBodyMd.weight(.bold))
                .foregroundStyle(.white)
                .padding(10)
                .background(Circle().fill(Color.mishranBrandAccent))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(showsAdded ? L("catalog.quick_added") : L("catalog.quick_add"))
        .accessibilityHint("Adds one base pack to your cart")
    }
}
