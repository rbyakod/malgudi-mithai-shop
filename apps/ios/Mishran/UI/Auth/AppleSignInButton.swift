// AppleSignInButton.swift — Task 15.2 (Mishran Mobile Apps v1).
// SwiftUI SignInWithAppleButton wrapper. The completion callback extracts
// plain values from ASAuthorizationAppleIDCredential and hands them to the
// view model — the same Credential funnel the coordinator's delegate uses,
// so both paths share one tested code path.
import AuthenticationServices
import SwiftUI

struct AppleSignInButton: View {
    @Bindable var viewModel: AuthViewModel
    var onSignedIn: (() -> Void)? = nil

    var body: some View {
        SignInWithAppleButton(onRequest: { request in
            request.requestedScopes = [.fullName]
        }, onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential
                else { return }
                let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")
                Task { @MainActor in
                    await viewModel.signInWithApple(AppleSignInCoordinator.Credential(
                        identityToken: credential.identityToken.flatMap { String(data: $0, encoding: .utf8) },
                        authorizationCode: credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) },
                        fullName: fullName.isEmpty ? nil : fullName
                    ))
                    if viewModel.isSignedIn {
                        onSignedIn?()
                    }
                }
            case .failure(let error):
                Task { @MainActor in
                    viewModel.errorMessage = error.localizedDescription
                }
            }
        })
        .signInWithAppleButtonStyle(.black)
        .frame(height: 54)
        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
        .accessibilityLabel("Sign in with Apple")
    }
}
