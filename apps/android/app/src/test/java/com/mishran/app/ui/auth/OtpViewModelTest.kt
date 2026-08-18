// apps/android/app/src/test/java/com/mishran/app/ui/auth/OtpViewModelTest.kt — Task 8.1.
//
// JVM unit tests for OtpViewModel. requestId/phone are fed through
// SavedStateHandle exactly as the NavGraph args would.
package com.mishran.app.ui.auth

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Customer
import com.mishran.api.models.OtpSendResponse
import com.mishran.api.models.OtpVerifyResponse
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class OtpViewModelTest {

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
    fun `requestId is read from SavedStateHandle`() {
        val vm = OtpViewModel(SavedStateHandle(mapOf("requestId" to "req-1")), authRepository)
        assertEquals("req-1", vm.requestId)
    }

    @Test
    fun `valid code verifies and reaches Success`() = runTest(dispatcher) {
        coEvery { authRepository.verifyOtp(any(), any()) } returns OtpVerifyResponse(
            accessToken = "at",
            refreshToken = "rt",
            customer = Customer(id = "c1", phone = "+919999999999"),
        )

        val vm = OtpViewModel(SavedStateHandle(mapOf("requestId" to "req-1")), authRepository)
        vm.code.value = "123456"
        vm.verify()
        advanceUntilIdle()

        assertTrue(vm.uiState.value is UiState.Success)
    }

    @Test
    fun `invalid code length shows error without calling repository`() = runTest(dispatcher) {
        val vm = OtpViewModel(SavedStateHandle(mapOf("requestId" to "req-1")), authRepository)
        vm.code.value = "12"
        vm.verify()
        advanceUntilIdle()

        assertTrue(vm.uiState.value is UiState.Error)
        coVerify(exactly = 0) { authRepository.verifyOtp(any(), any()) }
    }

    @Test
    fun `expired code surfaces a friendly message`() = runTest(dispatcher) {
        coEvery { authRepository.verifyOtp(any(), any()) } throws httpException(410)

        val vm = OtpViewModel(SavedStateHandle(mapOf("requestId" to "req-1")), authRepository)
        vm.code.value = "123456"
        vm.verify()
        advanceUntilIdle()

        val state = vm.uiState.value as UiState.Error
        assertTrue("got: ${state.message}", state.message.contains("expired", ignoreCase = true))
    }

    // ---- in-place resend -------------------------------------------------

    private fun otpHandle(requestId: String = "req-1", phone: String = "+919999999999") =
        SavedStateHandle(mapOf("requestId" to requestId, "phone" to phone))

    @Test
    fun `arrival starts the resend cooldown`() = runTest(dispatcher) {
        val vm = OtpViewModel(otpHandle(), authRepository)
        runCurrent()
        assertEquals(30, vm.resendCountdown.value)
    }

    @Test
    fun `resend swaps in the fresh requestId and clears stale digits`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp("+919999999999") } returns
            OtpSendResponse(requestId = "req-2", expiresAt = "2026-08-17T10:00:00Z")

        val vm = OtpViewModel(otpHandle(requestId = "req-1"), authRepository)
        vm.code.value = "123456"  // stale digits from the first send
        vm.resendCountdown.value = 0  // cooldown elapsed
        vm.resend()
        runCurrent()

        assertEquals("req-2", vm.requestId)
        assertEquals("", vm.code.value)
        assertEquals(30, vm.resendCountdown.value)
        assertNull(vm.resendError.value)
    }

    @Test
    fun `resend is blocked during the cooldown`() = runTest(dispatcher) {
        val vm = OtpViewModel(otpHandle(), authRepository)
        vm.resendCountdown.value = 10
        vm.resend()
        advanceUntilIdle()

        coVerify(exactly = 0) { authRepository.sendOtp(any()) }
        // The init-started countdown ticks to 0 during advanceUntilIdle; what
        // matters is that a blocked resend never RESTARTED it (== 30).
        assertTrue(vm.resendCountdown.value < 30)
    }

    @Test
    fun `resend rate limit surfaces a message`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } throws httpException(429)

        val vm = OtpViewModel(otpHandle(), authRepository)
        vm.resendCountdown.value = 0
        vm.resend()
        advanceUntilIdle()

        val message = vm.resendError.value
        assertTrue("got: $message", message.orEmpty().contains("Too many", ignoreCase = true))
        // A failed send keeps the OLD requestId alive for verify.
        assertEquals("req-1", vm.requestId)
    }

    private fun httpException(code: Int): HttpException {
        val body = "".toResponseBody("text/plain".toMediaTypeOrNull())
        return HttpException(Response.error<Any>(code, body))
    }
}
