// AppleSignInCoordinator.swift — Task 15.2 (Mishran Mobile Apps v1).
// Bridge between ASAuthorizationControllerDelegate (UIKit callbacks with
// non-constructible credential objects) and plain values the view model can
// consume. `completed(...)` / `failed(...)` are the testable funnel — same
// seam pattern as Android's RazorpaySdkLauncher forwarding.
import AuthenticationServices
import Foundation
import UIKit

final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    /// Plain-value credential extracted from the ASAuthorization callback.
    struct Credential {
        let identityToken: String?
        let authorizationCode: String?
        let fullName: String?
    }

    /// Fired after a successful Apple authorization with extracted values.
    var onCredential: ((Credential) -> Void)?
    /// Fired when the sheet is cancelled or errors.
    var onError: ((String) -> Void)?

    private var authorizationController: ASAuthorizationController?

    /// Kick off the native sheet (presents over the foreground key window).
    func start() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        authorizationController = controller
        controller.performRequests()
    }

    // MARK: - ASAuthorizationControllerDelegate

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential
        else {
            onError?("Unexpected Apple sign-in credential")
            return
        }
        let tokenData = credential.identityToken
        let codeData = credential.authorizationCode
        let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        completed(
            identityToken: tokenData.flatMap { String(data: $0, encoding: .utf8) },
            authorizationCode: codeData.flatMap { String(data: $0, encoding: .utf8) },
            fullName: fullName.isEmpty ? nil : fullName
        )
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        failed(errorDescription: error.localizedDescription)
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Present over the foreground scene's key window.
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }

    // MARK: - Testable funnel (plain values; safe to call from tests)

    func completed(identityToken: String?, authorizationCode: String?, fullName: String?) {
        onCredential?(Credential(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            fullName: fullName
        ))
    }

    func failed(errorDescription: String) {
        onError?(errorDescription)
    }
}
