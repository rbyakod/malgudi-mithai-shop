// Task 15.4 (Mishran Mobile Apps v1): Keychain + biometric tests.
// KeychainHelper is exercised for real on the simulator (TEST_HOST app
// process — SecItem works there). BiometricGate wraps LAContext behind an
// injectable evaluator closure — the testable seam (LAContext can't be
// constructed with enrolled biometrics in CI sims).
import XCTest
@testable import Mishran

@MainActor
final class KeychainAndBiometricTests: XCTestCase {
    // MARK: KeychainHelper — generic kSecClassGenericPassword wrapper

    func testKeychainHelperStoresAndRetrievesString() throws {
        let helper = KeychainHelper()
        defer { try? helper.removeString(forKey: "unit-test-token", service: "com.mishran.app.unit") }

        try helper.setString("secret-1", forKey: "unit-test-token", service: "com.mishran.app.unit")
        XCTAssertEqual(try helper.getString(forKey: "unit-test-token", service: "com.mishran.app.unit"), "secret-1")
    }

    func testKeychainHelperUpdateOverwritesAndDeleteRemoves() throws {
        let helper = KeychainHelper()
        defer { try? helper.removeString(forKey: "unit-test-token", service: "com.mishran.app.unit") }

        try helper.setString("old", forKey: "unit-test-token", service: "com.mishran.app.unit")
        try helper.setString("new", forKey: "unit-test-token", service: "com.mishran.app.unit")
        XCTAssertEqual(try helper.getString(forKey: "unit-test-token", service: "com.mishran.app.unit"), "new")

        try helper.removeString(forKey: "unit-test-token", service: "com.mishran.app.unit")
        XCTAssertNil(try helper.getString(forKey: "unit-test-token", service: "com.mishran.app.unit"))
    }

    func testKeychainHelperMissingKeyReturnsNil() throws {
        let helper = KeychainHelper()
        XCTAssertNil(try helper.getString(forKey: "never-set", service: "com.mishran.app.unit"))
    }

    // MARK: BiometricGate — evaluator seam

    func testBiometricGateDelegatesToEvaluator() async {
        let allowing = BiometricGate(evaluate: { true })
        let trueResult = await allowing.evaluate()
        XCTAssertTrue(trueResult)

        let refusing = BiometricGate(evaluate: { false })
        let falseResult = await refusing.evaluate()
        XCTAssertFalse(falseResult)
    }

    func testBiometricGateLiveCanBeQueriedWithoutCrashing() async {
        // No enrolled biometrics on a bare CI simulator — must return false,
        // never trap. (Face ID verification itself is a physical-device
        // manual check.)
        let live = BiometricGate.live
        _ = await live.evaluate()
    }

    // MARK: Unlock view model — success/failure routing

    func testUnlockViewModelRoutesSuccessAndFailure() async {
        let vm = BiometricUnlockViewModel()
        await vm.attemptUnlock(gate: BiometricGate(evaluate: { true }))
        XCTAssertTrue(vm.isUnlocked)
        XCTAssertFalse(vm.shouldFallBackToSignIn)

        let failing = BiometricUnlockViewModel()
        await failing.attemptUnlock(gate: BiometricGate(evaluate: { false }))
        XCTAssertFalse(failing.isUnlocked)
        XCTAssertTrue(failing.shouldFallBackToSignIn)
    }
}
