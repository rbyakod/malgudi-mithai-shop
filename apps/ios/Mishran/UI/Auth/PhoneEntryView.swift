// PhoneEntryView.swift — Task 15.1 (Mishran Mobile Apps v1).
// Phone-entry half of the sign-in flow: country dial-code chip + national
// number (the view model composes the E.164). Brand-themed; the national
// field loads a number pad. Sign in with Apple joins below.
import SwiftUI

struct PhoneEntryView: View {
    @Bindable var viewModel: AuthViewModel
    var onSent: (() -> Void)? = nil
    /// SIWA completes the whole sign-in in one step (no OTP stage).
    var onSignedIn: (() -> Void)? = nil

    @State private var showCountryPicker = false

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

            HStack(spacing: .mishranSpacingSm) {
                Button {
                    showCountryPicker = true
                } label: {
                    HStack(spacing: 4) {
                        Text(viewModel.selectedCountry.flagEmoji)
                        Text(viewModel.selectedCountry.dialPrefixed)
                            .foregroundStyle(Color.mishranBrandInk)
                        Image(systemName: "chevron.down")
                            .font(.mishranBodySm.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .font(.mishranBodyLg.weight(.semibold))
                    .padding(.mishranSpacingSm)
                    .frame(minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: .mishranRadiusMd)
                            .fill(Color.mishranBrandSurface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: .mishranRadiusMd)
                            .strokeBorder(Color.mishranBrandAccent.opacity(0.4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L("auth.phone.country.label"))
                .accessibilityHint(L("auth.phone.country.search"))

                TextField(L("auth.phone.national.placeholder"), text: Binding(
                    get: { viewModel.nationalNumber },
                    set: { viewModel.setNationalNumber($0) }
                ))
                .font(.mishranBodyXl)
                .keyboardType(.numberPad)
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
                .accessibilityLabel(L("auth.phone.label"))
                .onSubmit { Task { await submitTapped() } }
            }

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
        .sheet(isPresented: $showCountryPicker) {
            CountryPickerSheet(selected: viewModel.selectedCountry) {
                viewModel.selectCountry($0)
            }
        }
    }

    private func submitTapped() async {
        await viewModel.sendCode()
        if viewModel.stage == .otp {
            onSent?()
        }
    }
}
