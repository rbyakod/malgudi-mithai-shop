// RazorpayCoordinator.swift — Task 17.3 (Mishran Mobile Apps v1).
// Thin seam over the Razorpay Checkout SDK (parity with Android's
// RazorpayLauncher). ViewModels depend on the RazorpayLaunching protocol,
// never on SDK types, so the payment flow is unit-testable; this adapter is
// the only file that imports the SDK.
import Foundation
import RazorpayCheckout

/// What the Razorpay sheet reported. Mirrors Android's RazorpayOutcome.
enum RazorpayOutcome: Equatable, Sendable {
    case success(paymentId: String, signature: String?)
    case failed(code: Int32, description: String)
    /// User closed the sheet — no money moved, nothing to verify.
    case dismissed
}

/// Options the sheet needs; mirrors the create-order response.
struct RazorpayLaunchOptions: Equatable, Sendable {
    let keyId: String
    let razorpayOrderId: String
    let amountInPaise: Int
    var customerName: String? = nil
}

/// Opens the Razorpay sheet. Real impl: RazorpayCoordinator; tests stub it.
protocol RazorpayLaunching: AnyObject {
    func launch(
        options: RazorpayLaunchOptions,
        onResult: @escaping @Sendable (RazorpayOutcome) -> Void
    )
}

/// Adapter over `RazorpaySwift` (the pod's source wrapper around the binary
/// RazorpayCheckout). Uses the with-data delegate variant because the legacy
/// success callback carries only the payment id — the HMAC signature the
/// verify route requires rides in the response dictionary.
@MainActor
final class RazorpayCoordinator: NSObject, RazorpayLaunching, PaymentCompletionWithDataDelegate {
    private var sheet: RazorpaySwift?
    private var onResult: (@Sendable (RazorpayOutcome) -> Void)?

    func launch(
        options: RazorpayLaunchOptions,
        onResult: @escaping @Sendable (RazorpayOutcome) -> Void
    ) {
        self.onResult = onResult
        let sheet = RazorpaySwift.initWithKey(key: options.keyId, andDelegateWithData: self)
        self.sheet = sheet

        var payload: [AnyHashable: Any] = [
            "name": "Mishran",
            "order_id": options.razorpayOrderId,
            "amount": options.amountInPaise,
            "currency": "INR",
            "theme": ["color": "#9b4d2a"], // kakvi brown (Android parity)
        ]
        if let name = options.customerName {
            payload["prefill"] = ["name": name]
        }
        do {
            try sheet.open(withPayload: payload)
        } catch {
            finish(Self.outcome(failedCode: -1, description: "Couldn't open Razorpay: \(error)"))
        }
    }

    // MARK: SDK delegate (data variant)

    func onPaymentSuccess(_ payment_id: String, andData response: [AnyHashable: Any]?) {
        let signature = Self.signature(from: response)
        finish(Self.outcome(paymentId: payment_id, signature: signature))
    }

    func onPaymentError(_ code: Int32, description str: String, andData response: [AnyHashable: Any]?) {
        finish(Self.outcome(failedCode: code, description: str))
    }

    private func finish(_ outcome: RazorpayOutcome) {
        onResult?(outcome)
        onResult = nil
    }

    // MARK: Testable funnels (plain values in, outcome out)

    nonisolated static func outcome(paymentId: String, signature: String?) -> RazorpayOutcome {
        .success(paymentId: paymentId, signature: signature)
    }

    /// Code 0 = user dismissed the sheet (Android parity).
    nonisolated static func outcome(failedCode: Int32, description: String) -> RazorpayOutcome {
        failedCode == dismissedCode ? .dismissed : .failed(code: failedCode, description: description)
    }

    /// The signature key varies across SDK versions — accept both spellings.
    nonisolated static func signature(from response: [AnyHashable: Any]?) -> String? {
        (response?["razorpay_signature"] as? String) ?? (response?["signature"] as? String)
    }

    private nonisolated static let dismissedCode: Int32 = 0
}
