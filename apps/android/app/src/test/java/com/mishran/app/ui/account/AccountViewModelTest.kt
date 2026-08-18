// apps/android/app/src/test/java/com/mishran/app/ui/account/AccountViewModelTest.kt
// — Known-gaps B2.
//
// JVM unit tests for the Account-tab biometric toggle: the availability
// gate on the row, and the enable/disable writers over the Task 8.2
// AuthRepository seams (enableBiometricLogin / disableBiometricLogin /
// isBiometricLoginEnabled).
package com.mishran.app.ui.account

import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.SettingsRepository
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

class AccountViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository
    private lateinit var settingsRepository: SettingsRepository
    private lateinit var brandRepository: BrandRepository

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        authRepository = mockk(relaxed = true)
        settingsRepository = mockk(relaxed = true)
        brandRepository = mockk(relaxed = true)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(sensor: BiometricStatus = BiometricStatus.Available): AccountViewModel =
        AccountViewModel(
            authRepository,
            settingsRepository,
            brandRepository,
            BiometricStatusProvider { sensor },
        )

    @Test
    fun `toggle is available only with a STRONG sensor`() {
        assertTrue(viewModel().biometricAvailable)
        assertFalse(viewModel(BiometricStatus.NotEnrolled).biometricAvailable)
        assertFalse(viewModel(BiometricStatus.NoHardware).biometricAvailable)
    }

    @Test
    fun `enable copies the token and flips the state`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false
        coEvery { authRepository.enableBiometricLogin() } returns true

        val vm = viewModel()
        advanceUntilIdle()
        assertFalse(vm.biometricEnabled.value)

        vm.enableBiometric()
        advanceUntilIdle()

        assertTrue(vm.biometricEnabled.value)
        coVerify(exactly = 1) { authRepository.enableBiometricLogin() }
    }

    @Test
    fun `a failed enable leaves the opt-in off`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns false
        coEvery { authRepository.enableBiometricLogin() } returns false

        val vm = viewModel()
        vm.enableBiometric()
        advanceUntilIdle()

        assertFalse(vm.biometricEnabled.value)
    }

    @Test
    fun `disable drops the token`() = runTest(dispatcher) {
        coEvery { authRepository.isBiometricLoginEnabled() } returns true

        val vm = viewModel()
        advanceUntilIdle()
        assertTrue(vm.biometricEnabled.value)

        vm.disableBiometric()
        advanceUntilIdle()

        assertFalse(vm.biometricEnabled.value)
        coVerify(exactly = 1) { authRepository.disableBiometricLogin() }
    }
}
