// AuthViewModel.swift — Task 15.1 (Mishran Mobile Apps v1).
// Phone → OTP sign-in state machine. Talks to MishranAPIClient; tokens land
// in the shared TokenStoring via the client's verify wrapper.
import Foundation
import Observation

@MainActor
@Observable
final class AuthViewModel {
    enum Stage: Equatable {
        case phone
        case otp
    }

    private let client: MishranAPIClient

    // MARK: input state

    var phone = ""
    var code = ""
    var requestId: String?

    // MARK: output state

    var stage: Stage = .phone
    var isLoading = false
    var errorMessage: String?
    var errorCode: APIErrorCode?
    var signedInCustomer: CustomerDTO?
    /// Set once after a successful verify — the view switches to the app.
    var isSignedIn = false

    init(client: MishranAPIClient) {
        self.client = client
    }

    /// Contract: E.164-ish ^\+[1-9]\d{6,14}$.
    var isPhoneValid: Bool {
        AuthViewModel.phoneIsValid(phone)
    }

    var canSubmit: Bool {
        !isLoading && (stage == .phone ? isPhoneValid : !code.isEmpty)
    }

    nonisolated static func phoneIsValid(_ phone: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: #"^\+[1-9]\d{6,14}$"#)
        else { return false }
        let range = NSRange(phone.startIndex..., in: phone)
        return regex.firstMatch(in: phone, options: [], range: range) != nil
    }

    func sendCode() async {
        guard isPhoneValid else {
            errorMessage = "Enter your phone number with country code, e.g. +919876543210."
            errorCode = .validation
            return
        }
        isLoading = true
        errorMessage = nil
        errorCode = nil
        defer { isLoading = false }
        do {
            let response = try await client.authOtpSend(phone: phone)
            requestId = response.requestId
            code = ""
            stage = .otp
        } catch let error as APIError {
            apply(error)
        } catch {
            errorMessage = "Something went wrong. Try again."
        }
    }

    func verify() async {
        guard let requestId, !code.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        errorCode = nil
        defer { isLoading = false }
        do {
            let response = try await client.authOtpVerify(requestId: requestId, code: code)
            signedInCustomer = response.customer
            self.requestId = nil
            markSignedIn()
        } catch let error as APIError {
            apply(error)
            // An expired request id is dead — start a fresh send.
            if case .api(.otpExpired, _, _, _) = error {
                self.requestId = nil
                stage = .phone
            }
        } catch {
            errorMessage = "Something went wrong. Try again."
        }
    }

    /// Sign in with Apple — credential values come from the coordinator
    /// funnel (or the SIWA button's own callback). A missing identity token
    /// means Apple didn't hand one over; surface it like a failed request.
    func signInWithApple(_ credential: AppleSignInCoordinator.Credential) async {
        guard let identityToken = credential.identityToken, !identityToken.isEmpty else {
            errorMessage = "Apple sign-in didn't return a token. Try again."
            errorCode = .tokenExpired
            return
        }
        isLoading = true
        errorMessage = nil
        errorCode = nil
        defer { isLoading = false }
        do {
            let response = try await client.authApple(identityToken: identityToken, name: credential.fullName)
            signedInCustomer = response.customer
            markSignedIn()
        } catch let error as APIError {
            apply(error)
        } catch {
            errorMessage = "Something went wrong. Try again."
        }
    }

    /// Back to phone entry (user tapped "wrong number").
    func restart() {
        stage = .phone
        requestId = nil
        code = ""
        errorMessage = nil
        errorCode = nil
    }

    /// Successful sign-in: session state + the persisted "signed in once"
    /// flag the launch gate reads (Task 20.5). When a refresh token later
    /// dies (server-side revocation or logout), flag-set + no-token is what
    /// routes the next launch to sign-in instead of silently continuing.
    /// P2: the customer's phone (when the session has one) is cached for the
    /// enquiry form's pre-fill — the only customer-shaped datum persisted.
    private func markSignedIn() {
        isSignedIn = true
        UserDefaults.standard.set(true, forKey: AuthViewModel.signedInOnceKey)
        if let phone = signedInCustomer?.phone, !phone.isEmpty {
            UserDefaults.standard.set(phone, forKey: AuthViewModel.sessionPhoneKey)
        } else {
            // Apple-only sessions have no phone — don't leak the previous
            // customer's number into their form.
            UserDefaults.standard.removeObject(forKey: AuthViewModel.sessionPhoneKey)
        }
    }

    /// UserDefaults key: true once any sign-in has succeeded on this install.
    static let signedInOnceKey = "signedInOnce"

    /// UserDefaults key: the signed-in customer's phone (enquiry pre-fill).
    /// nonisolated: read from EnquiryView's nonisolated default argument.
    nonisolated static let sessionPhoneKey = "sessionPhone"

    private func apply(_ error: APIError) {
        if case let .api(code, message, _, _) = error {
            errorCode = code
            errorMessage = message
        } else {
            errorCode = nil
            errorMessage = "Something went wrong. Try again."
        }
    }
}
