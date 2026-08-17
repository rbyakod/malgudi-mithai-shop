// apps/android/app/src/test/java/com/mishran/app/ui/auth/PhoneEntryViewModelTest.kt — Task 8.1.
//
// JVM unit tests for PhoneEntryViewModel. AuthRepository is mocked (no DataStore
// plumbing needed); Context is a relaxed mock backing the resource-backed
// validation message. viewModelScope runs on Dispatchers.Main, so each test
// pins Main to a StandardTestDispatcher and drives it with runTest/advanceUntilIdle.
package com.mishran.app.ui.auth

import android.content.Context
import com.mishran.api.models.OtpSendResponse
import com.mishran.app.R
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.ui.common.UiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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

class PhoneEntryViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository
    private lateinit var context: Context

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        authRepository = mockk()
        context = mockk()
        every { context.getString(R.string.auth_phone_error_invalid) } returns
            "Enter a valid mobile number for the selected country."
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `default is India +91 and composes E164 on send`() = runTest(dispatcher) {
        val captured = slot<String>()
        coEvery { authRepository.sendOtp(capture(captured)) } returns
            OtpSendResponse(requestId = "req-1", expiresAt = "2026-08-11T10:00:00Z")

        val vm = PhoneEntryViewModel(context, authRepository)
        assertEquals("IN", vm.selectedCountry.value.iso2)
        vm.onNationalNumberChange("9999999999")
        assertEquals("+919999999999", vm.e164)
        vm.sendOtp()
        advanceUntilIdle()

        assertEquals("+919999999999", captured.captured)
        assertTrue("expected Success, got ${vm.uiState.value}", vm.uiState.value is UiState.Success)
    }

    @Test
    fun `US selection composes the 1 dial code`() = runTest(dispatcher) {
        val captured = slot<String>()
        coEvery { authRepository.sendOtp(capture(captured)) } returns
            OtpSendResponse(requestId = "req-1", expiresAt = "2026-08-11T10:00:00Z")

        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onSelectCountry(Countries.byIso2("US")!!)
        vm.onNationalNumberChange("6301234567")
        vm.sendOtp()
        advanceUntilIdle()

        assertEquals("+16301234567", captured.captured)
    }

    @Test
    fun `invalid national number shows error without calling repository`() = runTest(dispatcher) {
        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("123")
        vm.sendOtp()
        advanceUntilIdle()

        assertTrue(vm.uiState.value is UiState.Error)
        coVerify(exactly = 0) { authRepository.sendOtp(any()) }
    }

    @Test
    fun `pasted E164 decomposes to country plus remainder - India`() = runTest(dispatcher) {
        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("+919876543210")

        assertEquals("IN", vm.selectedCountry.value.iso2)
        assertEquals("9876543210", vm.nationalNumber.value)
        assertEquals("+919876543210", vm.e164)
    }

    @Test
    fun `pasted E164 decomposes to country plus remainder - United States`() = runTest(dispatcher) {
        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("+16301234567")

        assertEquals("US", vm.selectedCountry.value.iso2)
        assertEquals("6301234567", vm.nationalNumber.value)
        assertEquals("+16301234567", vm.e164)
    }

    @Test
    fun `formatting noise is stripped from typed digits`() = runTest(dispatcher) {
        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("98-765 43210")

        assertEquals("9876543210", vm.nationalNumber.value)
    }

    @Test
    fun `rate limit surfaces a friendly message`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } throws httpException(429)

        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("9999999999")
        vm.sendOtp()
        advanceUntilIdle()

        val state = vm.uiState.value as UiState.Error
        assertTrue("got: ${state.message}", state.message.contains("Too many"))
    }

    @Test
    fun `provider down (503) surfaces a friendly message`() = runTest(dispatcher) {
        coEvery { authRepository.sendOtp(any()) } throws httpException(503)

        val vm = PhoneEntryViewModel(context, authRepository)
        vm.onNationalNumberChange("9999999999")
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
