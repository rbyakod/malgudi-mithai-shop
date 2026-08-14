// apps/android/app/src/test/java/com/mishran/app/ui/auth/BiometricGateViewModelTest.kt — Task 8.2.
//
// JVM unit tests for the cold-start gate decision tree. BiometricStatusProvider
// is a fun interface, so each test passes a plain lambda — no Context, no
// Android biometric stack. NOTE: not executable here (no SDK); source-complete.
package com.mishran.app.ui.auth

import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.util.BiometricResult
import com.mishran.app.util.BiometricStatus
import com.mishran.app.util.BiometricStatusProvider
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class BiometricGateViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        authRepository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `not enrolled and no session routes to login`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false
        coEvery { authRepository.isLoggedIn() } returns false

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()

        assertEquals(GateState.NeedLogin, vm.state.value)
    }

    @Test
    fun `plain stored session skips straight to home`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false
        coEvery { authRepository.isLoggedIn() } returns true

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()

        assertEquals(GateState.Unlocked, vm.state.value)
    }

    @Test
    fun `enrolled and sensor available prompts biometric`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()

        assertEquals(GateState.Prompt, vm.state.value)
    }

    @Test
    fun `enrolled but sensor gone falls back to login`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true

        // Fingerprints/face removed after enrollment — can't challenge.
        val vm = BiometricGateViewModel(authRepository, provider(BiometricStatus.NotEnrolled))
        advanceUntilIdle()

        assertEquals(GateState.NeedLogin, vm.state.value)
    }

    @Test
    fun `successful prompt restores session and unlocks`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true
        coEvery { authRepository.restoreSessionFromBiometric() } returns true

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()
        assertEquals(GateState.Prompt, vm.state.value)

        vm.onPromptResult(BiometricResult.Success)
        advanceUntilIdle()

        coVerify { authRepository.restoreSessionFromBiometric() }
        assertEquals(GateState.Unlocked, vm.state.value)
    }

    @Test
    fun `successful prompt with failed refresh falls back to login`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true
        coEvery { authRepository.restoreSessionFromBiometric() } returns false

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()

        vm.onPromptResult(BiometricResult.Success)
        advanceUntilIdle()

        assertEquals(GateState.NeedLogin, vm.state.value)
    }

    @Test
    fun `cancelled or locked-out prompt falls back to login`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true

        val vm = BiometricGateViewModel(authRepository, available())
        advanceUntilIdle()
        assertEquals(GateState.Prompt, vm.state.value)

        // ERROR_LOCKOUT (code 7) / user cancel — never reaches restore.
        vm.onPromptResult(BiometricResult.Error(7, "locked out"))
        advanceUntilIdle()

        coVerify(exactly = 0) { authRepository.restoreSessionFromBiometric() }
        assertEquals(GateState.NeedLogin, vm.state.value)
    }

    private fun available(): BiometricStatusProvider = provider(BiometricStatus.Available)

    private fun provider(status: BiometricStatus): BiometricStatusProvider =
        BiometricStatusProvider { status }
}
