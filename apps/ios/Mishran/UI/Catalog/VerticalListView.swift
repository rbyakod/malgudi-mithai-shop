// VerticalListView.swift — P2 (Mishran Mobile Apps v1).
// Grid for the catalog's non-mithai tabs: 2-column VerticalCards with the
// shared image + name + one-line discriminator shape, plus the
// loading/error-retry/empty states the mithai grid carries. Label strings
// match packages/i18n-strings/en.json — TODO(i18n): hardcode sweep wires
// String(localized:) later.
import SwiftUI

struct VerticalListView: View {
    @Bindable var viewModel: VerticalCatalogViewModel
    var onOpen: ((VerticalCard) -> Void)? = nil

    private let columns = [
        GridItem(.flexible(), spacing: .mishranSpacingMd),
        GridItem(.flexible(), spacing: .mishranSpacingMd),
    ]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: .mishranSpacingMd) {
                ForEach(viewModel.cards) { card in
                    VerticalCardView(card: card) {
                        onOpen?(card)
                    }
                }
            }
            .padding(.horizontal, .mishranSpacingMd)
            .padding(.bottom, .mishranSpacingLg)

            if viewModel.cards.isEmpty && !viewModel.isLoading {
                if viewModel.errorMessage != nil {
                    ContentUnavailableView {
                        Label("Couldn't load this tab", systemImage: "exclamationmark.triangle")
                    } actions: {
                        Button("Try again") {
                            Task { await viewModel.reload() }
                        }
                    }
                } else {
                    ContentUnavailableView(
                        "Nothing here yet",
                        systemImage: "square.grid.2x2",
                        description: Text("Check back soon.")
                    )
                }
            }
        }
        .overlay {
            if viewModel.isLoading && viewModel.cards.isEmpty {
                ProgressView("Loading…")
            }
        }
        .refreshable {
            await viewModel.reload()
        }
        .navigationTitle(viewModel.selected.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One grid tile: image + name + discriminator (QSR cards prefix the green
/// veg dot). Same surface/border card language as ProductCard.
struct VerticalCardView: View {
    let card: VerticalCard
    var onTap: (() -> Void)? = nil

    var body: some View {
        Button {
            onTap?()
        } label: {
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                ProductRemoteImage(imageURL: card.imageURL)
                    .frame(height: 110)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .accessibilityHidden(true)

                Text(card.name)
                    .font(.mishranBodyMd.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)

                if let discriminator = card.discriminator {
                    HStack(spacing: .mishranSpacingXs) {
                        if card.showsVegDot {
                            Circle()
                                .fill(Color.mishranStateSuccess)
                                .frame(width: 8, height: 8)
                                .accessibilityHidden(true)
                        }
                        Text(discriminator)
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
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
        .accessibilityLabel(accessibilityText)
        .accessibilityHint("View details")
    }

    private var accessibilityText: String {
        var parts = [card.name]
        if let discriminator = card.discriminator {
            parts.append(card.showsVegDot ? "Vegetarian, \(discriminator)" : discriminator)
        }
        return parts.joined(separator: ", ")
    }
}
