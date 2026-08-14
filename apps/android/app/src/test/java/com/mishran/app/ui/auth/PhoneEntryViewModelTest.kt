// apps/android/app/src/test/java/com/mishran/app/ui/auth/PhoneEntryViewModelTest.kt — Task 8.1.
//
// JVM unit tests for PhoneEntryViewModel. AuthRepository is mocked (no DataStore
// plumbing needed). viewModelScope runs on Dispatchers.Main, so each test pins
// Main to a StandardTestDispatcher and drives it with runTest/advanceUntilIdle.
// NOTE: not executable in this checkout (no Android SDK); source-complete.
package com.mishran.app.ui.auth

import com.mishran.api.models.OtpSendResponse
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class PhoneEntryViewModelTest {

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
    fun `valid phone sends OTP and reaches Success`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } returns
            OtpSendResponse(requestId = "req-1", expiresAt = "2026-08-11T10:00:00Z")

        val vm = PhoneEntryViewModel(authRepository)
        vm.phone.value = "+919999999999"
        vm.sendOtp()
        advanceUntilIdle()

        assertTrue("expected Success, got ${vm.uiState.value}", vm.uiState.value is UiState.Success)
    }

    @Test
    fun `invalid phone shows error without calling repository`() = runTest(dispatcher) {
        val vm = PhoneEntryViewModel(authRepository)
        vm.phone.value = "123"
        vm.sendOtp()
        advanceUntilIdle()

        assertTrue(vm.uiState.value is UiState.Error)
        coVerify(exactly = 0) { authRepository.sendOtp(any()) }
    }

    @Test
    fun `rate limit surfaces a friendly message`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } throws httpException(429)

        val vm = PhoneEntryViewModel(authRepository)
        vm.phone.value = "+919999999999"
        vm.sendOtp()
        advanceUntilIdle()

        val state = vm.uiState.value as UiState.Error
        assertTrue("got: ${state.message}", state.message.contains("Too many"))
    }

    @Test
    fun `provider down (503) surfaces a friendly message`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } throws httpException(503)

        val vm = PhoneEntryViewModel(authRepository)
        vm.phone.value = "+919999999999"
        vm.sendOtp()
        advanceUntilIdle()

        val state = vm.uiState.value as UiState.Error
        assertTrue("got: ${state.message}", state.message.contains("SMS", ignoreCase = true))
    }

    private fun httpException(code: Int): HttpException {
        val body = "".toResponseBody("text/plain".toMediaTypeOrNull())
        return HttpException(Response.error<Any>(code, body))
    }
}
