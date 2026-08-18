// OTPView.swift — Task 15.1 (Mishran Mobile Apps v1).
// Code-entry half of the sign-in flow: 6 digits, in-place resend with a
// 30 s cooldown, and a wrong-number escape back to phone entry.
import SwiftUI

struct OTPView: View {
    @Bindable var viewModel: AuthViewModel
    var onVerified: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: .mishranSpacingLg) {
            Spacer()
            Text(L("auth.otp.title"))
                .font(.mishranBodyXxl.weight(.semibold))
            Text(L("auth.otp.subtitle", viewModel.phone))
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)

            TextField(L("auth.otp.placeholder"), text: $viewModel.code)
                .font(.mishranDisplay.weight(.semibold))
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .padding(.mishranSpacingMd)
                .background(
                    RoundedRectangle(cornerRadius: .mishranRadiusMd)
                        .fill(Color.mishranBrandSurface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .mishranRadiusMd)
                        .strokeBorder(Color.mishranBrandAccent.opacity(0.4), lineWidth: 1)
                )
                .accessibilityLabel("One-time code")
                .onChange(of: viewModel.code) { _, newValue in
                    // Digits only, 6 max — matches the contract pattern.
                    let filtered = String(newValue.filter(\.isNumber).prefix(6))
                    if filtered != newValue {
                        viewModel.code = filtered
                    }
                }
                .onSubmit { Task { await verifyTapped() } }

            if let message = viewModel.errorMessage {
                Text(message)
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranStateError)
                    .multilineTextAlignment(.center)
                    .accessibilityLabel("Error: \(message)")
            }

            Button {
                Task { await verifyTapped() }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(Color.mishranBrandCanvas)
                        .frame(maxWidth: .infinity)
                } else {
                    Text(L("auth.otp.cta"))
                        .font(.mishranBodyLg.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.mishranBrandAccent)
            .foregroundStyle(Color.mishranBrandCanvas)
            .controlSize(.large)
            .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
            .disabled(!viewModel.canSubmit)
            .accessibilityLabel(L("auth.otp.cta"))

            Button {
                Task { await viewModel.resend() }
            } label: {
                Text(viewModel.resendCountdown > 0
                     ? L("auth.otp.countdown", "\(viewModel.resendCountdown)")
                     : L("auth.otp.resend"))
            }
            .font(.mishranBodyMd)
            .foregroundStyle(Color.mishranBrandAccent)
            .disabled(viewModel.resendCountdown > 0 || viewModel.isLoading)
            .accessibilityLabel(L("auth.otp.resend"))

            Button(L("auth.otp.wrong_number")) {
                viewModel.restart()
            }
            .font(.mishranBodyMd)
            .foregroundStyle(Color.mishranBrandAccent)
            .accessibilityLabel(L("auth.otp.wrong_number"))

            Spacer()
        }
        .padding(.mishranSpacingLg)
    }

    private func verifyTapped() async {
        await viewModel.verify()
        if viewModel.isSignedIn {
            onVerified?()
        }
    }
}
