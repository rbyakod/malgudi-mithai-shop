// PhoneEntryView.swift — Task 15.1 (Mishran Mobile Apps v1).
// Phone-entry half of the sign-in flow. Brand-themed; loads the keyboard as
// a phone pad. Sign in with Apple joins this screen in Task 15.2.
import SwiftUI

struct PhoneEntryView: View {
    @Bindable var viewModel: AuthViewModel
    var onSent: (() -> Void)? = nil
    /// SIWA completes the whole sign-in in one step (no OTP stage).
    var onSignedIn: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: .mishranSpacingLg) {
            Spacer()
            Image(systemName: "circle.hexagongrid.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.mishranBrandAccent)
            Text(L("app.name"))
                .font(.mishranDisplay.weight(.bold))
            Text(L("auth.phone.title"))
                .font(.mishranBodyLg.weight(.semibold))
            Text(L("auth.phone.subtitle"))
                .font(.mishranBodyLg)
                .foregroundStyle(.secondary)

            TextField(L("auth.phone.placeholder"), text: $viewModel.phone)
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
                    Text(L("auth.phone.cta"))
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
            .accessibilityLabel(L("auth.phone.cta"))

            // Task 15.2: Sign in with Apple sits below the phone path.
            Text("or")
                .font(.mishranBodyMd)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)

            AppleSignInButton(viewModel: viewModel, onSignedIn: onSignedIn)

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
