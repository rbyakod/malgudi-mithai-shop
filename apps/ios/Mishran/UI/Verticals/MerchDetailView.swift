// MerchDetailView.swift — P2 (Mishran Mobile Apps v1).
// Merch detail: hero, name, price + availability chips, description, and
// the "Enquire" CTA — merch is enquiry-led (no cart), so the button pushes
// the enquiry screen with the type pre-set to corporate. Label matches
// packages/i18n-strings/en.json (merch.enquire) — TODO(i18n): hardcode
// sweep wires String(localized:) later.
import SwiftUI

struct MerchDetailView: View {
    let slug: String
    let router: Router
    @State private var repository = VerticalsRepository(client: MishranAPIClient())
    @State private var merch: MerchDTO?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            if let merch {
                content(merch)
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
        .navigationTitle(merch?.name ?? "Merch")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if merch == nil { await load() }
        }
    }

    private func content(_ merch: MerchDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingLg) {
            ProductRemoteImage(imageURL: merch.images?.first)
                .frame(height: 240)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text(merch.name)
                    .font(.mishranDisplay.weight(.semibold))
                HStack(spacing: .mishranSpacingSm) {
                    if let price = merch.price {
                        Text(price)
                            .font(.mishranBodyXl)
                    }
                    if let availability = merch.availability, !availability.isEmpty {
                        Text(Self.titleCase(availability))
                            .font(.mishranBodySm)
                            .padding(.horizontal, .mishranSpacingSm)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                    }
                }
                .foregroundStyle(Color.mishranBrandInk)
            }

            if let description = merch.description, !description.isEmpty {
                Text(description)
                    .font(.mishranBodyLg)
                    .foregroundStyle(.secondary)
            }

            Button {
                router.push(.enquiry(type: .corporate))
            } label: {
                Label("Enquire", systemImage: "ellipsis.bubble")
                    .font(.mishranBodyLg.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
            .accessibilityLabel("Enquire about \(merch.name)")
            .accessibilityHint("Opens the bulk and events enquiry form")
        }
        .padding(.mishranSpacingLg)
    }

    private static func titleCase(_ value: String) -> String {
        value.prefix(1).uppercased() + value.dropFirst()
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            merch = try await repository.merchDetail(slug: slug)
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
