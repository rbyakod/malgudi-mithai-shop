// AccountViewModel.swift — Task 19.3 (Mishran Mobile Apps v1).
// Loyalty eligibility: GET /account/loyalty-pass — 200 = eligible (signed
// .pkpass URL + tier), 404 = not yet (a state, not an error), anything else
// surfaces the server's message.
import Foundation
import Observation

@MainActor
@Observable
final class AccountViewModel {
    enum PassState: Equatable {
        case unknown
        case checking
        case eligible(url: URL, tier: LoyaltyTier, serialNumber: String)
        case notEligible
        case failed(message: String)
    }

    private(set) var passState: PassState = .unknown
    /// Set while an add-pass attempt runs so the button can show progress.
    private(set) var isAddingPass = false
    private(set) var passErrorMessage: String?

    private let client: MishranAPIClient
    let passManager: LoyaltyPassManager

    init(
        client: MishranAPIClient,
        passManager: LoyaltyPassManager? = nil
    ) {
        self.client = client
        // Default-arg position is nonisolated — resolve inside the body
        // (same pattern as CheckoutViewModel's Razorpay launcher).
        self.passManager = passManager ?? LoyaltyPassManager()
    }

    func loadLoyaltyPass() async {
        passState = .checking
        do {
            let response: LoyaltyPassResponseDTO = try await client.request(.loyaltyPass)
            guard let url = URL(string: response.url) else {
                passState = .failed(message: "Couldn't load your loyalty pass. Try again.")
                return
            }
            passState = .eligible(
                url: url,
                tier: response.tier,
                serialNumber: response.serialNumber
            )
        } catch let error as APIError {
            if case let .api(code, _, _, _) = error, code == .notFound {
                passState = .notEligible
            } else {
                passState = .failed(message: Self.friendlyMessage(for: error))
            }
        } catch {
            passState = .failed(message: "Couldn't load your loyalty pass. Try again.")
        }
    }

    /// Download + present the add-pass sheet for an eligible customer.
    func addPassToWallet() async {
        guard case let .eligible(url, _, _) = passState else { return }
        isAddingPass = true
        passErrorMessage = nil
        defer { isAddingPass = false }
        do {
            try await passManager.addPass(from: url)
        } catch let error as LoyaltyPassError {
            passErrorMessage = "This pass couldn't be added. Try again in a moment."
        } catch {
            passErrorMessage = "Couldn't download your pass. Check your connection and try again."
        }
    }

    /// Surface the server's message when we have one.
    nonisolated static func friendlyMessage(for error: APIError) -> String {
        if case let .api(_, message, _, _) = error, !message.isEmpty {
            return message
        }
        return "Couldn't load your loyalty pass. Try again."
    }
}
