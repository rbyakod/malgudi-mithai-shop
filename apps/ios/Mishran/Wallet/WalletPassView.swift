// WalletPassView.swift — Task 19.3 (Mishran Mobile Apps v1).
// Loyalty-pass promotion card for the Account screen: tier, "Add to Wallet"
// CTA over PassKit, and honest per-state copy. Brand styling per the
// boutique tokens (marigold accent, surface card).
import SwiftUI

struct WalletPassView: View {
    @Bindable var viewModel: AccountViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: .mishranSpacingMd) {
            HStack(alignment: .top) {
                Image(systemName: "wallet.gift")
                    .font(.mishranDisplay)
                    .foregroundStyle(Color.mishranBrandAccent)
                    .accessibilityHidden(true)
                Spacer()
                if case let .eligible(_, tier, _) = viewModel.passState {
                    Text(tier.displayName)
                        .font(.mishranBodySm.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(
                            Capsule().fill(Color.mishranBrandAccent.opacity(0.15))
                        )
                        .accessibilityLabel("Loyalty tier \(tier.displayName)")
                }
            }

            Text("Mishran Loyalty")
                .font(.mishranBodyLg.weight(.semibold))

            stateContent
        }
        .padding(.mishranSpacingLg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.mishranBrandSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.mishranBrandAccent.opacity(0.3))
        )
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var stateContent: some View {
        switch viewModel.passState {
        case .unknown, .checking:
            ProgressView("Checking your rewards…")
                .font(.mishranBodySm)
        case .notEligible:
            Text("Order twice to unlock your Mishran loyalty pass in Apple Wallet.")
                .font(.mishranBodySm)
                .foregroundStyle(.secondary)
        case let .failed(message):
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text(message)
                    .font(.mishranBodySm)
                    .foregroundStyle(Color.mishranStateError)
                Button("Try again") {
                    Task { await viewModel.loadLoyaltyPass() }
                }
                .font(.mishranBodySm.weight(.semibold))
            }
        case .eligible:
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text("Enjoy member rewards every time you order.")
                    .font(.mishranBodySm)
                    .foregroundStyle(.secondary)
                Button {
                    Task { await viewModel.addPassToWallet() }
                } label: {
                    if viewModel.isAddingPass {
                        ProgressView()
                    } else {
                        Label("Add to Wallet", systemImage: "plus.circle.fill")
                            .font(.mishranBodyMd.weight(.semibold))
                    }
                }
                .buttonStyle(.borderedProminent)
                .frame(minHeight: 44)
                .disabled(viewModel.isAddingPass)
                if let message = viewModel.passErrorMessage {
                    Text(message)
                        .font(.mishranBodySm)
                        .foregroundStyle(Color.mishranStateError)
                }
            }
        }
    }
}
