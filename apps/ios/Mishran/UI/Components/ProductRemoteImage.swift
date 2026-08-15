// ProductRemoteImage.swift — Task 48.3 (Mishran Mobile Apps v1).
// Product imagery without a third-party dep: AsyncImage (iOS 17) with
// .fill content mode. Nil/empty URLs, in-flight loads, and failures all
// fall back to the "photo" SF Symbol tile that used to live inline in
// ProductCard / ProductDetailView / CartLineItem. Callers size and shape
// it (.frame + .clipShape/.cornerRadius); the image is decorative, so the
// whole component is hidden from accessibility (the old call sites marked
// their placeholder tiles the same way).
import SwiftUI

struct ProductRemoteImage: View {
    let imageURL: String?

    var body: some View {
        if let imageURL, !imageURL.isEmpty, let url = URL(string: imageURL) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                Self.placeholderTile
            }
            .clipped()
        } else {
            Self.placeholderTile
        }
    }

    /// The tinted tile every non-success state renders (brand accent wash +
    /// photo glyph, sizing itself to whatever frame the caller proposes).
    private static var placeholderTile: some View {
        ZStack {
            Color.mishranBrandAccent.opacity(0.10)
            Image(systemName: "photo")
                .resizable()
                .scaledToFit()
                .padding(.mishranSpacingLg)
                .foregroundStyle(Color.mishranBrandAccent.opacity(0.6))
        }
    }
}
