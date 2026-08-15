// QsrDetailView.swift — P2 (Mishran Mobile Apps v1).
// QSR counter-menu item detail: hero, name, veg/spice badges, description,
// and the stores the item is available at. Deliberately NO cart CTA — the
// vertical is walk-in only (no price ships on the contract either). Labels
// match packages/i18n-strings/en.json (vertical.qsr.*) — TODO(i18n):
// hardcode sweep wires String(localized:) later.
import SwiftUI

struct QsrDetailView: View {
    let slug: String
    @State private var repository = VerticalsRepository(client: MishranAPIClient())
    @State private var item: QsrItemDTO?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if let item {
                content(item)
            } else if isLoading {
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, .mishranSpacingXl)
            } else {
                ContentUnavailableView {
                    Label("Couldn't load this item", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage ?? "")
                } actions: {
                    Button("Try again") {
                        Task { await load() }
                    }
                }
                .padding(.top, .mishranSpacingXl)
            }
        }
        .navigationTitle(item?.name ?? "Menu item")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if item == nil { await load() }
        }
    }

    private func content(_ item: QsrItemDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingLg) {
            ProductRemoteImage(imageURL: item.image)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text(item.name)
                    .font(.mishranDisplay.weight(.semibold))
                if let category = item.category {
                    Text(category.capitalized)
                        .font(.mishranBodySm)
                        .foregroundStyle(.secondary)
                }
                badgeRow(item)
            }

            if let description = item.description, !description.isEmpty {
                Text(description)
                    .font(.mishranBodyLg)
                    .foregroundStyle(.secondary)
            }

            if let stores = item.availableAtStores, !stores.isEmpty {
                VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                    Text("Available at")
                        .font(.mishranBodyLg.weight(.semibold))
                    ForEach(stores, id: \.self) { store in
                        HStack(spacing: .mishranSpacingSm) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.mishranBodyMd)
                                .foregroundStyle(Color.mishranBrandAccent)
                            Text(store.capitalized)
                                .font(.mishranBodyMd)
                                .foregroundStyle(Color.mishranBrandInk)
                        }
                        .frame(minHeight: 44)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
        .padding(.mishranSpacingLg)
    }

    /// Veg dot + word, spice chip — card language, at detail size.
    private func badgeRow(_ item: QsrItemDTO) -> some View {
        HStack(spacing: .mishranSpacingSm) {
            if item.veg == true {
                HStack(spacing: .mishranSpacingXs) {
                    Circle()
                        .fill(Color.mishranStateSuccess)
                        .frame(width: 8, height: 8)
                    Text("Vegetarian")
                        .font(.mishranBodySm)
                }
                .padding(.horizontal, .mishranSpacingSm)
                .padding(.vertical, 4)
                .background(Capsule().strokeBorder(Color.mishranStateSuccess.opacity(0.6)))
                .accessibilityElement(children: .combine)
            }
            if let spice = item.spiceLevel, !spice.isEmpty {
                Text("Spice · \(spice)")
                    .font(.mishranBodySm)
                    .padding(.horizontal, .mishranSpacingSm)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                    .accessibilityLabel("Spice level: \(spice)")
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            item = try await repository.qsrDetail(slug: slug)
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
        } catch {
            errorMessage = "Couldn't load this item. Try again."
        }
    }

    private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load this item. Try again."
    }
}
