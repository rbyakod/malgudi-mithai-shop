// apps/android/app/src/test/java/com/mishran/app/ui/auth/BiometricEnrollmentViewModelTest.kt — Task 8.2.
//
// JVM unit tests for the post-sign-in enrollment offer decision + action.
// NOTE: not executable here (no SDK); source-complete.
package com.mishran.app.ui.auth

import com.mishran.app.data.repository.AuthRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class BiometricEnrollmentViewModelTest {

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
    fun `offers enrollment when sensor available and not enabled`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false

        val vm = BiometricEnrollmentViewModel(authRepository, provider(BiometricStatus.Available))

        assertTrue(vm.shouldOffer())
    }

    @Test
    fun `no offer when no STRONG sensor`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false

        val vm = BiometricEnrollmentViewModel(authRepository, provider(BiometricStatus.NotEnrolled))

        assertFalse(vm.shouldOffer())
    }

    @Test
    fun `no offer when already enabled`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true

        val vm = BiometricEnrollmentViewModel(authRepository, provider(BiometricStatus.Available))

        assertFalse(vm.shouldOffer())
    }

    @Test
    fun `enable persists token then runs completion`() = runTest(dispatcher) {
        coEvery { authRepository.enableBiometricLogin() } returns true

        val vm = BiometricEnrollmentViewModel(authRepository, provider(BiometricStatus.Available))
        var navigated = false

        vm.enable { navigated = true }
        advanceUntilIdle()

        coVerify { authRepository.enableBiometricLogin() }
        assertTrue(navigated)
    }

    private fun provider(status: BiometricStatus): BiometricStatusProvider =
        BiometricStatusProvider { status }
}
