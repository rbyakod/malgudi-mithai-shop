// apps/android/app/src/test/java/com/mishran/app/ui/enquiry/EnquiryViewModelTest.kt — P2 net-new (enquiry).
//
// JVM unit tests for the enquiry form: the pure validator (required fields,
// email format), the form → wire-request mapping (contact nesting + payload
// extras, blanks dropped), phone pre-fill from the session, the ?type= preset,
// and the submit lifecycle (success carries the leadId, failure surfaces the
// retry copy, validation blocks the network call entirely).
// NOTE: source-complete (no SDK).
package com.mishran.app.ui.enquiry

import androidx.lifecycle.SavedStateHandle
import com.mishran.app.data.remote.api.LeadCreatedResponse
import com.mishran.app.data.remote.api.LeadSubmissionRequest
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.EnquiryRepository
import com.mishran.app.ui.common.UiState
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class EnquiryViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: EnquiryRepository
    private lateinit var authRepository: AuthRepository

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        authRepository = mockk()
        every { authRepository.sessionPhone() } returns flowOf(null)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    // ---- validation (pure) -------------------------------------------------

    @Test
    fun `a complete form validates clean`() {
        val errors = validateEnquiry(
            EnquiryForm(
                name = "Meera",
                phone = "+919876543210",
                email = "meera@example.com",
                message = "300 boxes of kaju katli",
            ),
        )
        assertTrue(errors.isEmpty())
    }

    @Test
    fun `blank name phone or message each flag their field`() {
        val errors = validateEnquiry(
            EnquiryForm(name = "  ", phone = "", email = "a@b.co", message = ""),
        )
        assertEquals(
            setOf(EnquiryField.NAME, EnquiryField.PHONE, EnquiryField.MESSAGE),
            errors.keys,
        )
    }

    @Test
    fun `missing email flags the field - the server requires it`() {
        val errors = validateEnquiry(
            EnquiryForm(name = "Meera", phone = "+919876543210", email = "", message = "hi"),
        )
        assertEquals(listOf(EnquiryField.EMAIL), errors.keys.toList())
    }

    @Test
    fun `malformed email flags the field`() {
        val errors = validateEnquiry(
            EnquiryForm(
                name = "Meera",
                phone = "+919876543210",
                email = "not-an-email",
                message = "hi",
            ),
        )
        assertEquals(listOf(EnquiryField.EMAIL), errors.keys.toList())
    }

    // ---- request mapping ---------------------------------------------------

    @Test
    fun `wedding extras ride the payload, not contact`() {
        val request = EnquiryForm(
            type = EnquiryType.WEDDING,
            name = "Meera",
            phone = "+919876543210",
            email = "meera@example.com",
            eventDate = "12 Nov 2026",
            city = "Mysuru",
            guests = "400",
            message = "Dessert table",
        ).toRequest()

        assertEquals("wedding", request.type)
        assertEquals(
            LeadSubmissionRequest.Contact(
                name = "Meera",
                email = "meera@example.com",
                phone = "+919876543210",
            ),
            request.contact,
        )
        assertEquals(
            // Parity batch: the web wire shape — ISO date, guests as a number.
            mapOf("message" to "Dessert table", "eventDate" to "2026-11-12", "city" to "Mysuru", "guests" to 400),
            request.payload,
        )
    }

    @Test
    fun `corporate extras carry company in contact and blanks are dropped`() {
        val request = EnquiryForm(
            type = EnquiryType.CORPORATE,
            name = "Arun",
            phone = "+919812345678",
            email = "arun@corp.example",
            company = "Acme Gifting",
            quantity = "250",
            neededBy = "", // blank — dropped
            message = "Diwali hampers",
        ).toRequest()

        assertEquals("corporate", request.type)
        assertEquals("Acme Gifting", request.contact.company)
        assertEquals(
            mapOf("message" to "Diwali hampers", "quantity" to 250),
            request.payload,
        )
    }

    // ---- ViewModel behavior ------------------------------------------------

    @Test
    fun `submit sends the request and surfaces the leadId`() = runTest(dispatcher) {
        val sent = slot<LeadSubmissionRequest>()
        coEvery { repository.submit(capture(sent)) } returns
            LeadCreatedResponse(leadId = "lead-42", message = "Lead received.")
        val vm = EnquiryViewModel(repository, authRepository, SavedStateHandle())
        vm.submitState.collectInTest(this)

        fillBasics(vm)
        vm.submit()
        advanceUntilIdle()

        val success = vm.submitState.value
        assertTrue(success is UiState.Success)
        assertEquals("lead-42", (success as UiState.Success).data.leadId)
        assertEquals("Meera", sent.captured.contact.name)
    }

    @Test
    fun `an invalid form never touches the network`() = runTest(dispatcher) {
        val vm = EnquiryViewModel(repository, authRepository, SavedStateHandle())
        vm.errors.collectInTest(this)
        vm.submitState.collectInTest(this)

        vm.submit() // blank form
        advanceUntilIdle()

        assertEquals(setOf(EnquiryField.NAME, EnquiryField.PHONE, EnquiryField.EMAIL, EnquiryField.MESSAGE), vm.errors.value.keys)
        assertEquals(UiState.Idle, vm.submitState.value)
        coVerify(exactly = 0) { repository.submit(any()) }
    }

    @Test
    fun `editing a field clears its stale error`() = runTest(dispatcher) {
        val vm = EnquiryViewModel(repository, authRepository, SavedStateHandle())
        vm.errors.collectInTest(this)

        vm.submit()
        advanceUntilIdle()
        assertTrue(EnquiryField.NAME in vm.errors.value.keys)

        vm.onFieldChange(EnquiryField.NAME, "Meera")
        assertNull(vm.errors.value[EnquiryField.NAME])
    }

    @Test
    fun `submit failure surfaces the retry copy`() = runTest(dispatcher) {
        coEvery { repository.submit(any()) } throws IOException("offline")
        val vm = EnquiryViewModel(repository, authRepository, SavedStateHandle())
        vm.submitState.collectInTest(this)

        fillBasics(vm)
        vm.submit()
        advanceUntilIdle()

        val error = vm.submitState.value
        assertTrue(error is UiState.Error)
        assertEquals("Something went wrong. Please try again.", (error as UiState.Error).message)
    }

    @Test
    fun `session phone pre-fills the field once`() = runTest(dispatcher) {
        every { authRepository.sessionPhone() } returns flowOf("+919876543210")
        val vm = EnquiryViewModel(repository, authRepository, SavedStateHandle())
        vm.form.collectInTest(this)
        advanceUntilIdle()

        assertEquals("+919876543210", vm.form.value.phone)
    }

    @Test
    fun `type arg presets the form - merch passes corporate`() = runTest(dispatcher) {
        val handle = SavedStateHandle(mapOf("type" to "corporate"))
        val vm = EnquiryViewModel(repository, authRepository, handle)
        vm.form.collectInTest(this)
        advanceUntilIdle()

        assertEquals(EnquiryType.CORPORATE, vm.form.value.type)
    }

    @Test
    fun `unknown type args fall back to wedding`() = runTest(dispatcher) {
        val handle = SavedStateHandle(mapOf("type" to "garbage"))
        val vm = EnquiryViewModel(repository, authRepository, handle)
        vm.form.collectInTest(this)
        advanceUntilIdle()

        assertEquals(EnquiryType.WEDDING, vm.form.value.type)
    }

    private fun fillBasics(vm: EnquiryViewModel) {
        vm.onFieldChange(EnquiryField.NAME, "Meera")
        vm.onFieldChange(EnquiryField.PHONE, "+919876543210")
        vm.onFieldChange(EnquiryField.EMAIL, "meera@example.com")
        vm.onFieldChange(EnquiryField.MESSAGE, "300 boxes")
    }
}

/** Collect the flow in the background so stateIn's WhileSubscribed starts. */
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectInTest(
    scope: kotlinx.coroutines.test.TestScope,
) {
    scope.backgroundScope.launch { this@collectInTest.collect { } }
}
