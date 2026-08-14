// ProductCard.swift — Task 16.3 (Mishran Mobile Apps v1).
// 2-column catalog card: brand surface, name, price, freshness.
import SwiftUI

struct ProductCard: View {
    let product: ProductEntity
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                ZStack {
                    RoundedRectangle(cornerRadius: .mishranRadiusMd)
                        .fill(Color.mishranBrandAccent.opacity(0.10))
                    Image(systemName: "photo")
                        .font(.mishranBodyXxl)
                        .foregroundStyle(Color.mishranBrandAccent.opacity(0.6))
                }
                .frame(height: 110)
                .accessibilityHidden(true)

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
}
