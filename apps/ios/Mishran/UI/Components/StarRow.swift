// StarRow.swift — Batch B11 (Mishran Mobile Apps v1).
// Display-only 1–5 star row for public review display — the native port
// of the web components/reviews/Stars.tsx: round(rating) gold glyphs,
// muted empties, and a VoiceOver label carrying the numeric rating. The
// interactive star PICKER on the order detail page is a form control and
// stays separate; this is the read-only counterpart (PDP reviews today).
// ReviewFormatting carries the shared one-decimal rating text ("4.5",
// the web's toFixed(1)) for the a11y label and the summary line.
import SwiftUI

struct StarRow: View {
    /// 0–5 rating; rendered rounded to whole glyphs, exactly like the web
    /// row (4.5 reads as 5 filled stars).
    let rating: Double
    /// Glyph scale — the PDP summary header uses the default body size.
    var font: Font = .mishranBodyMd

    /// Filled glyph count: round, clamped to 0…5 (Stars.tsx Math.round).
    var filledCount: Int {
        min(max(Int(rating.rounded()), 0), 5)
    }

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { index in
                Image(systemName: index < filledCount ? "star.fill" : "star")
                    .foregroundStyle(
                        index < filledCount ? Color.mishranBrandPop : Color.mishranNeutral200
                    )
            }
        }
        .font(font)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L("reviews.stars_label", ReviewFormatting.rating(rating)))
    }
}

/// One-decimal rating text ("4.5") — decimal separator pinned so every
/// locale reads the web's toFixed(1) shape (no comma variants).
enum ReviewFormatting {
    private static let formatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    static func rating(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
    }
}
