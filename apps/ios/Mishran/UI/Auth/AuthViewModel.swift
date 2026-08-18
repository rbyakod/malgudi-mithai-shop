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

    /// Dial-code chip selection. India (+91) by default — the storefront's
    /// home market.
    var selectedCountry: CountryCode = CountryCodes.fallback
    /// National number — local digits only, no dial code, no formatting.
    var nationalNumber = ""
    var code = ""
    var requestId: String?

    /// Seconds until the resend control re-enables (0 = can resend now).
    /// Restarted on every successful send, mirroring the server's 30 s
    /// resend cooldown on the web flow.
    var resendCountdown = 0
    private var countdownTask: Task<Void, Never>?

    /// Composed E.164 (e.g. +919876543210) — sent to the API and shown on
    /// the OTP screen subtitle. Derived, so the country chip and the national
    /// field can never drift out of sync.
    var phone: String { selectedCountry.dialPrefixed + nationalNumber }

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

    func selectCountry(_ country: CountryCode) {
        selectedCountry = country
    }

    /// National-number input. ASCII digits only, capped at 15 (E.164 caps the
    /// FULL number at 15; this just guards absurd paste). A pasted full E.164
    /// number ("+919876543210") decomposes via longest dial-prefix match into
    /// a country selection + remainder, so pasting from contacts still lands
    /// on the right E.164 instead of double-prefixing.
    func setNationalNumber(_ raw: String) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("+") {
            let digits = asciiDigits(trimmed)
            if let (country, rest) = CountryCodes.longestDialPrefix(digits) {
                selectedCountry = country
                nationalNumber = String(rest.prefix(Self.maxNationalDigits))
            } else {
                nationalNumber = String(digits.prefix(Self.maxNationalDigits))
            }
            return
        }
        nationalNumber = String(asciiDigits(trimmed).prefix(Self.maxNationalDigits))
    }

    private func asciiDigits(_ s: String) -> String {
        // Character.isNumber accepts non-ASCII digits (Devanagari etc.) —
        // the server contract wants plain ASCII.
        s.filter { c in c.asciiValue.map { (0x30...0x39).contains($0) } == true }
    }

    private static let maxNationalDigits = 15

    func sendCode() async {
        guard isPhoneValid else {
            errorMessage = L("auth.phone.error.invalid")
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
            startResendCountdown()
        } catch let error as APIError {
            apply(error)
        } catch {
            errorMessage = "Something went wrong. Try again."
        }
    }

    /// In-place resend: re-invokes the send with the same composed phone.
    /// sendCode() already stays on the OTP stage and swaps in the fresh
    /// requestId, so this is a cooldown-gated passthrough.
    func resend() async {
        guard resendCountdown == 0, !isLoading else { return }
        await sendCode()
    }

    private func startResendCountdown() {
        countdownTask?.cancel()
        resendCountdown = AuthViewModel.resendCooldownSeconds
        countdownTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.resendCountdown > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { break }
                self.resendCountdown -= 1
            }
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
        countdownTask?.cancel()
        resendCountdown = 0
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

    /// Resend cooldown in seconds — matches the web flow's 30 s countdown.
    static let resendCooldownSeconds = 30

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
