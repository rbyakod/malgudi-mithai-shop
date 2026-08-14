// BiometricGateView.swift — Task 15.4 (Mishran Mobile Apps v1).
// Presented on app launch when a refresh token is present AND the user
// enabled biometric unlock (BiometricSettings). Success → home; failure →
// sign-in. Token loading needs no action here — the tokens are already in
// the keychain; the gate only decides whether the session is revealed.
import SwiftUI

struct BiometricGateView: View {
    @State private var viewModel = BiometricUnlockViewModel()
    var gate: BiometricGate = .live
    var onUnlocked: (() -> Void)? = nil
    var onFallbackToSignIn: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: .mishranSpacingLg) {
            Spacer()
            Image(systemName: viewModel.isEvaluating ? "lock.fill" : "faceid")
                .font(.system(size: 48))
                .foregroundStyle(Color.mishranBrandAccent)
            Text("Mishran is locked")
                .font(.mishranDisplay.weight(.semibold))
            Text("Confirm it's you to continue.")
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)

            Button("Try again") {
                Task { await runGate() }
            }
            .font(.mishranBodyLg.weight(.semibold))
            .buttonStyle(.borderedProminent)
            .tint(Color.mishranBrandAccent)
            .controlSize(.large)
            .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
            .accessibilityLabel("Retry biometric unlock")

            Button("Sign in instead") {
                onFallbackToSignIn?()
            }
            .font(.mishranBodyMd)
            .foregroundStyle(Color.mishranBrandAccent)
            .accessibilityLabel("Fall back to phone sign-in")
            Spacer()
        }
        .padding(.mishranSpacingLg)
        .task { await runGate() }
        .onChange(of: viewModel.isUnlocked) { _, unlocked in
            if unlocked { onUnlocked?() }
        }
        .onChange(of: viewModel.shouldFallBackToSignIn) { _, fallback in
            if fallback { onFallbackToSignIn?() }
        }
    }

    private func runGate() async {
        await viewModel.attemptUnlock(gate: gate)
    }
}
