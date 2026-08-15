// SnackDetailView.swift — P2 (Mishran Mobile Apps v1).
// Snack detail: hero, name, MSRP + weight chip, description, and the
// "Where to buy" retailer rows — each opens the retailer's site externally
// (openURL); retail snacks never enter the app's cart. Labels match
// packages/i18n-strings/en.json (vertical.snacks.retailers) — TODO(i18n):
// hardcode sweep wires String(localized:) later.
import SwiftUI

struct SnackDetailView: View {
    let slug: String
    @State private var repository = VerticalsRepository(client: MishranAPIClient())
    @State private var snack: SnackDTO?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            if let snack {
                content(snack)
            } else if isLoading {
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, .mishranSpacingXl)
            } else {
                ContentUnavailableView {
                    Label("Couldn't load this snack", systemImage: "exclamationmark.triangle")
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
        .navigationTitle(snack?.name ?? "Snack")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if snack == nil { await load() }
        }
    }

    private func content(_ snack: SnackDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingLg) {
            ProductRemoteImage(imageURL: snack.images?.first)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text(snack.name)
                    .font(.mishranDisplay.weight(.semibold))
                HStack(spacing: .mishranSpacingSm) {
                    if let msrp = snack.msrp {
                        Text(msrp)
                            .font(.mishranBodyXl)
                    }
                    if let weight = snack.weight, !weight.isEmpty {
                        Text(weight)
                            .font(.mishranBodySm)
                            .padding(.horizontal, .mishranSpacingSm)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                    }
                }
                .foregroundStyle(Color.mishranBrandInk)
            }

            if let description = snack.description, !description.isEmpty {
                Text(description)
                    .font(.mishranBodyLg)
                    .foregroundStyle(.secondary)
            }

            if let retailers = snack.retailers, !retailers.isEmpty {
                VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                    Text("Where to buy")
                        .font(.mishranBodyLg.weight(.semibold))
                    ForEach(retailers) { retailer in
                        Button {
                            if let url = URL(string: retailer.url) {
                                openURL(url)
                            }
                        } label: {
                            HStack {
                                Label(retailer.label, systemImage: "cart")
                                    .font(.mishranBodyMd)
                                    .foregroundStyle(Color.mishranBrandInk)
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.mishranBodySm)
                                    .foregroundStyle(Color.mishranBrandAccent)
                            }
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Buy at \(retailer.label)")
                        .accessibilityHint("Opens the retailer's website")
                    }
                }
            }
        }
        .padding(.mishranSpacingLg)
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            snack = try await repository.snackDetail(slug: slug)
        } catch let error as APIError {
            errorMessage = Self.message(for: error)
        } catch {
            errorMessage = "Couldn't load this snack. Try again."
        }
    }

    private static func message(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error {
            return message
        }
        return "Couldn't load this snack. Try again."
    }
}
