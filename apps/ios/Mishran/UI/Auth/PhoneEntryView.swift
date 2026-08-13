// PhoneEntryView.swift — Task 15.1 (Mishran Mobile Apps v1).
// Phone-entry half of the sign-in flow. Brand-themed; loads the keyboard as
// a phone pad. Sign in with Apple joins this screen in Task 15.2.
import SwiftUI

struct PhoneEntryView: View {
    @Bindable var viewModel: AuthViewModel
    var onSent: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: .mishranSpacingLg) {
            Spacer()
            Image(systemName: "circle.hexagongrid.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.mishranBrandAccent)
            Text("Mishran")
                .font(.mishranDisplay.weight(.bold))
            Text("Sign in to order fresh mithai.")
                .font(.mishranBodyLg)
                .foregroundStyle(.secondary)

            TextField("Phone number", text: $viewModel.phone)
                .font(.mishranBodyXl)
                .keyboardType(.phonePad)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.mishranSpacingMd)
                .background(
                    RoundedRectangle(cornerRadius: .mishranRadiusMd)
                        .fill(Color.mishranBrandSurface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: .mishranRadiusMd)
                        .strokeBorder(Color.mishranBrandAccent.opacity(0.4), lineWidth: 1)
                )
                .accessibilityLabel("Phone number with country code")
                .accessibilityHint("Example: +919876543210")
                .onSubmit { Task { await submitTapped() } }

            if let message = viewModel.errorMessage {
                Text(message)
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranStateError)
                    .multilineTextAlignment(.center)
                    .accessibilityLabel("Error: \(message)")
            }

            Button {
                Task { await submitTapped() }
            } label: {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(Color.mishranBrandCanvas)
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Send code")
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
            .accessibilityLabel("Send code")

            Spacer()
        }
        .padding(.mishranSpacingLg)
    }

    private func submitTapped() async {
        await viewModel.sendCode()
        if viewModel.stage == .otp {
            onSent?()
        }
    }
}
