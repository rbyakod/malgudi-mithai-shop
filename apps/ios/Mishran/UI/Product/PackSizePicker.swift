// PackSizePicker.swift — P1 parity (Mishran Mobile Apps v1).
// The PDP's pack-size chip row, in the SlotPicker idiom: a small focused
// view over a Binding with label + hint. Capsule chips instead of a
// segmented control so each option clears the 44pt tap-target floor the
// a11y audit enforces (UISegmentedControl segments render 32pt tall).
import SwiftUI

struct PackSizePicker: View {
    let options: [PackSize]
    @Binding var selection: PackSize?

    var body: some View {
        if options.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingSm) {
                    ForEach(options) { option in
                        chip(option)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Pack size")
            .accessibilityHint("Prices for other sizes are estimates")
        } else if let only = options.first {
            // Single informational chip (off-ladder base / per-pack pricing) —
            // nothing to choose, so it renders inert like the dietary tags.
            Text(only.label)
                .font(.mishranBodySm)
                .padding(.horizontal, .mishranSpacingSm)
                .padding(.vertical, 4)
                .background(Capsule().strokeBorder(Color.mishranBrandAccent.opacity(0.4)))
                .accessibilityLabel("Pack size: \(only.label)")
        }
    }

    private func chip(_ option: PackSize) -> some View {
        let isSelected = selection == option
        return Button {
            selection = option
        } label: {
            Text(option.label)
                .font(.mishranBodyMd.weight(isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Color.mishranBrandCanvas : Color.mishranBrandInk)
                .padding(.horizontal, .mishranSpacingMd)
                .frame(minHeight: 44)
                .background(
                    Capsule().fill(isSelected ? Color.mishranBrandAccent : Color.mishranBrandSurface)
                )
                .overlay(
                    Capsule().strokeBorder(
                        isSelected ? Color.mishranBrandAccent : Color.mishranBrandAccent.opacity(0.4),
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Pack size \(option.label)")
        .accessibilityValue(option.priceLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
