// apps/android/app/src/main/java/com/mishran/app/ui/enquiry/EnquiryViewModel.kt — P2 net-new (enquiry).
//
// State for the single wedding/corporate lead form: a type toggle that swaps
// the extra-field set (event date/city/guests vs company/quantity/needed-by),
// client-side validation, and a one-shot POST /api/leads submit whose success
// state carries the server's leadId. The phone field is pre-filled from the
// signed-in session (AuthRepository.sessionPhone) and stays editable — the
// form is public and pre-fill is a convenience, never an obligation.
//
// Validation spec: name/phone/message required, email format-checked when
// present. One deliberate deviation, documented: email is ALSO required
// client-side because the server route (lib/leads-api.ts) hard-400s a lead
// without contact.email — letting the request go out to fail there would just
// trade a field highlight for a full-screen error.
package com.mishran.app.ui.enquiry

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.remote.api.LeadCreatedResponse
import com.mishran.app.data.remote.api.LeadSubmissionRequest
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.EnquiryRepository
import com.mishran.app.ui.common.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Which ops lane the lead belongs to — wire values match the server's enum. */
enum class EnquiryType(val wireValue: String) {
    WEDDING("wedding"),
    CORPORATE("corporate"),
}

/** Every editable field on the form (validation errors key off these). */
enum class EnquiryField { NAME, PHONE, EMAIL, MESSAGE }

/**
 * The whole form as one immutable value — the screen owns nothing, so type
 * toggles and edits are single-emit updates and validation is a pure map over
 * this type.
 */
data class EnquiryForm(
    val type: EnquiryType = EnquiryType.WEDDING,
    val name: String = "",
    val phone: String = "",
    val email: String = "",
    val message: String = "",
    // Wedding extras.
    val eventDate: String = "",
    val city: String = "",
    val guests: String = "",
    // Corporate extras.
    val company: String = "",
    val quantity: String = "",
    val neededBy: String = "",
)

@HiltViewModel
class EnquiryViewModel @Inject constructor(
    private val repository: EnquiryRepository,
    authRepository: AuthRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** Optional ?type= arg (merch detail's Enquire CTA presets corporate). */
    private val initialType = savedStateHandle.get<String>("type")
        ?.let { value -> EnquiryType.entries.firstOrNull { it.wireValue == value } }
        ?: EnquiryType.WEDDING

    private val _form = MutableStateFlow(EnquiryForm(type = initialType))
    val form: StateFlow<EnquiryForm> = _form.asStateFlow()

    /** Field-level validation messages; empty map = submittable. */
    private val _errors = MutableStateFlow<Map<EnquiryField, String>>(emptyMap())
    val errors: StateFlow<Map<EnquiryField, String>> = _errors.asStateFlow()

    /** One-shot submit lifecycle; Success carries the created leadId. */
    private val _submitState = MutableStateFlow<UiState<LeadCreatedResponse>>(UiState.Idle)
    val submitState: StateFlow<UiState<LeadCreatedResponse>> = _submitState.asStateFlow()

    init {
        // Pre-fill the phone from the session, once, without clobbering edits:
        // the flow's first value is read synchronously before any UI event.
        viewModelScope.launch {
            val phone = authRepository.sessionPhone().first() ?: return@launch
            if (_form.value.phone.isBlank()) {
                _form.value = _form.value.copy(phone = phone)
            }
        }
    }

    fun onTypeChange(type: EnquiryType) {
        _form.value = _form.value.copy(type = type)
    }

    /** Generic field write; clearing a field's text clears its stale error. */
    fun onFieldChange(field: EnquiryField, value: String) {
        _form.value = when (field) {
            EnquiryField.NAME -> _form.value.copy(name = value)
            EnquiryField.PHONE -> _form.value.copy(phone = value)
            EnquiryField.EMAIL -> _form.value.copy(email = value)
            EnquiryField.MESSAGE -> _form.value.copy(message = value)
        }
        _errors.value = _errors.value - field
    }

    /** Extra (type-specific) fields are free-form and never validated. */
    fun onExtraChange(setter: (EnquiryForm.() -> EnquiryForm)) {
        _form.value = _form.value.setter()
    }

    fun submit() {
        val validation = validateEnquiry(_form.value)
        if (validation.isNotEmpty()) {
            _errors.value = validation
            return
        }
        if (_submitState.value is UiState.Loading) return
        _submitState.value = UiState.Loading
        viewModelScope.launch {
            _submitState.value = try {
                UiState.Success(repository.submit(_form.value.toRequest()))
            } catch (e: Exception) {
                UiState.Error("Something went wrong. Please try again.")
            }
        }
    }

    /** Back from the success dead-end to a blank form (post-submit "again"). */
    fun reset() {
        _submitState.value = UiState.Idle
        _form.value = EnquiryForm(type = _form.value.type)
        _errors.value = emptyMap()
    }
}

/**
 * Pure validation: name/phone/message must be non-blank; email must be present
 * (server requirement — see file header) AND well-formed. Returns field →
 * user-facing message; an empty map means the form may be submitted.
 */
internal fun validateEnquiry(form: EnquiryForm): Map<EnquiryField, String> {
    val errors = linkedMapOf<EnquiryField, String>()
    if (form.name.isBlank()) errors[EnquiryField.NAME] = "Please add your name."
    if (form.phone.isBlank()) errors[EnquiryField.PHONE] = "Please add a phone number."
    if (form.email.isBlank()) {
        errors[EnquiryField.EMAIL] = "Please add an email address."
    } else if (!EMAIL_PATTERN.matches(form.email.trim())) {
        errors[EnquiryField.EMAIL] = "That email address doesn't look right."
    }
    if (form.message.isBlank()) errors[EnquiryField.MESSAGE] = "Please tell us what you need."
    return errors
}

/**
 * Form → wire request. Identity + phone + company ride the typed `contact`
 * object; everything else (message, wedding/corporate extras) goes into the
 * free-form `payload` the server persists verbatim. Blanks are omitted rather
 * than sent as empty strings so the stored lead stays clean.
 */
internal fun EnquiryForm.toRequest(): LeadSubmissionRequest = LeadSubmissionRequest(
    type = type.wireValue,
    contact = LeadSubmissionRequest.Contact(
        name = name.trim(),
        email = email.trim(),
        phone = phone.trim().takeIf { it.isNotBlank() },
        company = company.trim().takeIf { it.isNotBlank() },
    ),
    payload = buildMap {
        message.trim().takeIf { it.isNotBlank() }?.let { put("message", it) }
        when (type) {
            EnquiryType.WEDDING -> {
                eventDate.trim().takeIf { it.isNotBlank() }?.let { put("eventDate", it) }
                city.trim().takeIf { it.isNotBlank() }?.let { put("city", it) }
                guests.trim().takeIf { it.isNotBlank() }?.let { put("guests", it) }
            }
            EnquiryType.CORPORATE -> {
                quantity.trim().takeIf { it.isNotBlank() }?.let { put("quantity", it) }
                neededBy.trim().takeIf { it.isNotBlank() }?.let { put("neededBy", it) }
            }
        }
    },
)

/** Deliberately simple: one @, a dot in the domain, no spaces. */
private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
