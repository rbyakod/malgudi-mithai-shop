// apps/android/app/src/main/java/com/mishran/app/ui/gift/GiftViewModel.kt — parity batch (gift builder).
//
// State for the gift-builder lead form (Account's "Build a gift" row): the
// web gift box builder's quote-request counterpart. Contact fields + three
// dropdowns (occasion, box size, budget) + a needed-by date and two free-text
// fields, client-side validation, and a one-shot POST /api/leads submit whose
// success state carries the server's leadId — the same intake and state shape
// as EnquiryViewModel.
//
// Validation spec: name/email required (email required AND well-formed for
// the same reason as the enquiry form — the server route hard-400s a lead
// without contact.email), phone pre-filled from the signed-in session and
// editable but optional. The dropdown options are the web builder's verbatim
// lists; everything else is free text.
//
// Wire shape (the web gift-builder draft, exactly): type
// "gift-builder-draft", contact {name,email,phone}, payload {occasion,
// boxSize, budget, city, date, dietary, message} with empty optionals
// omitted, source "android-app". The date is normalized to ISO yyyy-MM-dd by
// the enquiry form's [toIsoDate] so both forms store the same shape.
package com.mishran.app.ui.gift

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.data.remote.api.LeadCreatedResponse
import com.mishran.app.data.remote.api.LeadSubmissionRequest
import com.mishran.app.data.repository.AuthRepository
import com.mishran.app.data.repository.EnquiryRepository
import com.mishran.app.ui.common.UiState
import com.mishran.app.ui.enquiry.toIsoDate
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** The occasion dropdown's options — the web gift builder's verbatim list. */
internal val GIFT_OCCASIONS = listOf(
    "Diwali", "Wedding", "Corporate", "Birthday", "Housewarming", "Other",
)

/** The box-size dropdown's options — verbatim wire values. */
internal val GIFT_BOX_SIZES = listOf("4-piece", "8-piece", "16-piece", "Custom")

/** The budget dropdown's options — verbatim display + wire values. */
internal val GIFT_BUDGETS = listOf("Under ₹1,000", "₹1,000-₹2,500", "₹2,500-₹5,000", "₹5,000+")

/** Fields that can carry a validation error. */
enum class GiftField { NAME, EMAIL }

/** The whole form as one immutable value — single-emit updates, pure validation. */
data class GiftForm(
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val city: String = "",
    val occasion: String = "",
    val boxSize: String = "",
    val budget: String = "",
    val date: String = "",
    val dietary: String = "",
    val message: String = "",
)

@HiltViewModel
class GiftViewModel @Inject constructor(
    private val repository: EnquiryRepository,
    authRepository: AuthRepository,
) : ViewModel() {

    private val _form = MutableStateFlow(GiftForm())
    val form: StateFlow<GiftForm> = _form.asStateFlow()

    /** Field-level validation messages; empty map = submittable. */
    private val _errors = MutableStateFlow<Map<GiftField, String>>(emptyMap())
    val errors: StateFlow<Map<GiftField, String>> = _errors.asStateFlow()

    /** One-shot submit lifecycle; Success carries the created leadId. */
    private val _submitState = MutableStateFlow<UiState<LeadCreatedResponse>>(UiState.Idle)
    val submitState: StateFlow<UiState<LeadCreatedResponse>> = _submitState.asStateFlow()

    init {
        // Pre-fill the phone from the session, once, without clobbering edits
        // — the same convenience pre-fill as the enquiry form.
        viewModelScope.launch {
            val phone = authRepository.sessionPhone().first() ?: return@launch
            if (_form.value.phone.isBlank()) {
                _form.value = _form.value.copy(phone = phone)
            }
        }
    }

    /** Generic field write; clearing a field's text clears its stale error. */
    fun onFieldChange(setter: (GiftForm.() -> GiftForm)) {
        _form.value = _form.value.setter()
        _errors.value = emptyMap()
    }

    fun submit() {
        val validation = validateGift(_form.value)
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
        _form.value = GiftForm()
        _errors.value = emptyMap()
    }
}

/**
 * Pure validation: name required; email required (the server route 400s a
 * lead without contact.email) and well-formed. Returns field → user-facing
 * message; an empty map means the form may be submitted.
 */
internal fun validateGift(form: GiftForm): Map<GiftField, String> {
    val errors = linkedMapOf<GiftField, String>()
    if (form.name.isBlank()) errors[GiftField.NAME] = "Please add your name."
    if (form.email.isBlank()) {
        errors[GiftField.EMAIL] = "Please add an email address."
    } else if (!GIFT_EMAIL_PATTERN.matches(form.email.trim())) {
        errors[GiftField.EMAIL] = "That email address doesn't look right."
    }
    return errors
}

/**
 * Form → wire request, the web gift-builder draft's exact shape. Dropdown
 * values ride the payload verbatim; the date normalizes to ISO yyyy-MM-dd;
 * blanks are omitted rather than sent as empty strings.
 */
internal fun GiftForm.toRequest(): LeadSubmissionRequest = LeadSubmissionRequest(
    type = GIFT_LEAD_TYPE,
    contact = LeadSubmissionRequest.Contact(
        name = name.trim(),
        email = email.trim(),
        phone = phone.trim().takeIf { it.isNotBlank() },
    ),
    payload = buildMap {
        occasion.takeIf { it.isNotBlank() }?.let { put("occasion", it) }
        boxSize.takeIf { it.isNotBlank() }?.let { put("boxSize", it) }
        budget.takeIf { it.isNotBlank() }?.let { put("budget", it) }
        city.trim().takeIf { it.isNotBlank() }?.let { put("city", it) }
        toIsoDate(date)?.let { put("date", it) }
        dietary.trim().takeIf { it.isNotBlank() }?.let { put("dietary", it) }
        message.trim().takeIf { it.isNotBlank() }?.let { put("message", it) }
    },
    source = GIFT_LEAD_SOURCE,
)

/** The gift builder's lead type — the web draft's exact wire value. */
internal const val GIFT_LEAD_TYPE = "gift-builder-draft"

/** The web gift builder's submitting-surface marker. */
internal const val GIFT_LEAD_SOURCE = "android-app"

/** Same deliberately simple shape as the enquiry form's pattern. */
internal val GIFT_EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
