// SearchBar.swift — Task 16.3 (Mishran Mobile Apps v1).
import SwiftUI

struct SearchBar: View {
    @Binding var text: String
    var onFilterTap: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: .mishranSpacingSm) {
            HStack(spacing: .mishranSpacingSm) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                TextField(L("catalog.search.placeholder"), text: $text)
                    .font(.mishranBodyMd)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel(L("catalog.search.placeholder"))
                    .accessibilityHint("Filter by name")
                if !text.isEmpty {
                    Button {
                        self.text = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .mishranIconAction(label: "Clear search")
                }
            }
            .padding(.mishranSpacingSm)
            .background(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .fill(Color.mishranBrandSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .strokeBorder(Color.mishranBrandAccent.opacity(0.25), lineWidth: 1)
            )

            Button {
                onFilterTap?()
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.mishranBodyXxl)
                    .foregroundStyle(Color.mishranBrandAccent)
            }
            .mishranIconAction(
                label: L("catalog.filter.title"),
                hint: "Filter by category and dietary needs"
            )
        }
        .padding(.horizontal, .mishranSpacingMd)
        .padding(.top, .mishranSpacingSm)
    }
}
