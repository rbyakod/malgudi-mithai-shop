// BiometricGate.swift — Task 15.4 (Mishran Mobile Apps v1).
// LocalAuthentication wrapper behind an injectable evaluator closure — the
// testable seam (LAContext can't be constructed with enrolled biometrics on
// a bare CI simulator). Face ID / Touch ID verification on real hardware is
// a manual device check.
import Foundation
import LocalAuthentication

struct BiometricGate: Sendable {
    var evaluate: @Sendable () async -> Bool

    /// Production gate: biometrics-only policy (per plan — passcode fallback
    /// routes to sign-in, not an unlock).
    static let live = BiometricGate {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }
        return (try? await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Unlock Mishran to see your orders."
        )) ?? false
    }
}

/// Whether the user opted into biometric unlock (settings toggle; default
/// off — the launch gate only arms when this is on AND a refresh token
/// exists).
enum BiometricSettings {
    private static let key = "biometricUnlockEnabled"

    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}

/// Launch-gate state machine: evaluate → unlocked, or fall back to sign-in.
@MainActor
@Observable
final class BiometricUnlockViewModel {
    private(set) var isUnlocked = false
    private(set) var shouldFallBackToSignIn = false
    private(set) var isEvaluating = false

    func attemptUnlock(gate: BiometricGate) async {
        isEvaluating = true
        defer { isEvaluating = false }
        if await gate.evaluate() {
            isUnlocked = true
        } else {
            shouldFallBackToSignIn = true
        }
    }
}
