// apps/android/app/src/test/java/com/mishran/app/ui/auth/OtpViewModelTest.kt — Task 8.1.
//
// JVM unit tests for OtpViewModel. requestId is fed through SavedStateHandle
// exactly as the NavGraph arg would. NOTE: not executable here (no SDK);
// source-complete.
package com.mishran.app.ui.auth

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Customer
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
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
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

    private fun httpException(code: Int): HttpException {
        val body = "".toResponseBody("text/plain".toMediaTypeOrNull())
        return HttpException(Response.error<Any>(code, body))
    }
}
