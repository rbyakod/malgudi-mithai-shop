// apps/android/app/src/main/java/com/mishran/app/ui/product/DeliveryCheckSection.kt — parity batch / B9.
//
// The "Check delivery" UI, extracted from ProductDetailScreen so TWO hosts
// render the exact same box: the PDP inline section (parity batch) and the
// cart's delivery sheet (B9 — the cart footer's no-pincode affordance opens
// it; no new pincode UI was built). The composable is fully parameterized;
// [DeliveryCheckController] is the shared state machine both hosts' View
// Models delegate to (6-digit validation, the serviceability call, DataStore
// persistence of the last serviceable answer).
package com.mishran.app.ui.product

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mishran.app.R
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Lifecycle of the "Check delivery" box. */
sealed interface DeliveryCheckState {
    /** No check yet (or reset via "Change") — the entry form shows. */
    data object Idle : DeliveryCheckState

    /** A check is in flight. */
    data object Checking : DeliveryCheckState

    /** The pincode is serviceable; tier drives the label + ETA wording. */
    data class Serviceable(
        val pincode: String,
        val tier: String,
        val city: String?,
        val slaDays: Int?,
    ) : DeliveryCheckState

    /** Reachable answer: this pincode is outside the network. */
    data class NotServiceable(val pincode: String) : DeliveryCheckState

    /** Client-side format rejection (not 6 digits) — no request goes out. */
    data object Invalid : DeliveryCheckState

    /** Transport/server failure — retryable via Check again. */
    data object Error : DeliveryCheckState
}

/**
 * What the delivery box remembers across hosts. Only SERVICEABLE results
 * persist — restoring "we don't deliver there" or a transient error would
 * present stale news as current, and the web's memory is the positive check.
 */
data class DeliveryCheckSnapshot(
    val pincode: String,
    val tier: String,
    val city: String?,
    val slaDays: Int?,
) {
    /**
     * Pipe-encode for the preferences DataStore: "pincode|tier|city|slaDays".
     * Tier values ("fresh"/"shelf") are fixed enums and cities in the
     * serviceability table carry no pipes, so the format is collision-free.
     */
    fun encode(): String = listOf(pincode, tier, city.orEmpty(), slaDays?.toString().orEmpty())
        .joinToString("|")

    companion object {
        /** Decode [encode]'s output; null when malformed (never crash on prefs). */
        fun decode(raw: String): DeliveryCheckSnapshot? {
            val parts = raw.split("|")
            if (parts.size != 4) return null
            if (parts[0].isEmpty() || parts[1].isEmpty()) return null
            return DeliveryCheckSnapshot(
                pincode = parts[0],
                tier = parts[1],
                city = parts[2].takeIf { it.isNotEmpty() },
                slaDays = parts[3].takeIf { it.isNotEmpty() }?.toIntOrNull(),
            )
        }
    }
}

/**
 * The delivery-check state machine, shared by the hosts' View Models
 * ([ViewModel.viewModelScope] arrives as [scope]). Owns the pincode field,
 * runs the check against [AddressRepository.checkServiceability], and
 * persists the last serviceable answer via [SettingsRepository] so the PDP
 * restores it (and B9's cart estimate reads it) on later visits.
 */
class DeliveryCheckController(
    private val addressRepository: AddressRepository,
    private val settingsRepository: SettingsRepository,
    private val scope: kotlinx.coroutines.CoroutineScope,
) {
    /** The pincode field's text; survives state transitions so "Change" keeps it. */
    private val _pincode = MutableStateFlow("")
    val pincode: StateFlow<String> = _pincode.asStateFlow()

    private val _deliveryCheck = MutableStateFlow<DeliveryCheckState>(DeliveryCheckState.Idle)
    val deliveryCheck: StateFlow<DeliveryCheckState> = _deliveryCheck.asStateFlow()

    init {
        // Restore the last persisted check (no refetch — the web behavior):
        // the snapshot populates the field AND the result row together.
        scope.launch {
            val snapshot = settingsRepository.deliveryCheck()?.let(DeliveryCheckSnapshot::decode)
            if (snapshot != null) {
                _pincode.value = snapshot.pincode
                _deliveryCheck.value = DeliveryCheckState.Serviceable(
                    pincode = snapshot.pincode,
                    tier = snapshot.tier,
                    city = snapshot.city,
                    slaDays = snapshot.slaDays,
                )
            }
        }
    }

    fun onPincodeChange(value: String) {
        _pincode.value = value.take(DELIVERY_PINCODE_MAX_DIGITS)
    }

    /**
     * Run the check. A malformed pincode flips to Invalid without a request;
     * a null response means offline or unreachable (Error), a serviceable
     * false means a real not-serviceable answer. Successes persist.
     */
    fun checkDelivery() {
        val candidate = _pincode.value.trim()
        if (!isServiceablePincode(candidate)) {
            _deliveryCheck.value = DeliveryCheckState.Invalid
            return
        }
        if (_deliveryCheck.value is DeliveryCheckState.Checking) return
        _deliveryCheck.value = DeliveryCheckState.Checking
        scope.launch {
            val response = try {
                addressRepository.checkServiceability(candidate)
            } catch (e: Exception) {
                null
            }
            _deliveryCheck.value = when {
                // The repository already collapses failures to null; the try
                // is belt-and-braces so this state machine never throws.
                response == null -> DeliveryCheckState.Error
                response.serviceable -> DeliveryCheckState.Serviceable(
                    pincode = candidate,
                    tier = response.tier.orEmpty(),
                    city = response.city,
                    slaDays = response.slaDays,
                )
                else -> DeliveryCheckState.NotServiceable(candidate)
            }
            val serviceable = _deliveryCheck.value as? DeliveryCheckState.Serviceable
            if (serviceable != null) {
                settingsRepository.setDeliveryCheck(
                    DeliveryCheckSnapshot(
                        pincode = serviceable.pincode,
                        tier = serviceable.tier,
                        city = serviceable.city,
                        slaDays = serviceable.slaDays,
                    ).encode(),
                )
            }
        }
    }

    /** "Change": back to the entry form, pincode kept for editing. */
    fun resetDeliveryCheck() {
        _deliveryCheck.value = DeliveryCheckState.Idle
    }
}

/**
 * Indian pincodes: exactly 6 digits, first non-zero — the same rule checkout
 * applies (restated locally so the delivery box does not import checkout's
 * internals for one regex).
 */
internal fun isServiceablePincode(pincode: String): Boolean =
    Regex("[1-9]\\d{5}").matches(pincode)

/**
 * The delivery result line's ETA segment: "same-day" for the fresh tier (the
 * localized label arrives as a parameter — resources are composable-only),
 * "<n> days" from the SLA otherwise, empty when the SLA is unknown.
 */
internal fun deliveryDaysLabel(tier: String, slaDays: Int?, sameDayLabel: String): String = when {
    tier == TIER_FRESH -> sameDayLabel
    slaDays != null -> "$slaDays days"
    else -> ""
}

/** The fresh tier's wire value — mirrors checkout's TIER_FRESH. */
internal const val TIER_FRESH = "fresh"

/** The pincode field accepts exactly this many digits. */
internal const val DELIVERY_PINCODE_MAX_DIGITS = 6

/** The shelf tier's wire value (mirrors checkout's TIER_SHELF). */
private const val TIER_SHELF_WIRE = "shelf"

/**
 * "Check delivery" box. Idle (or Invalid/Error) shows the pincode entry +
 * Check; a landed Serviceable/NotServiceable answer shows the result row with
 * a "Change" reset that keeps the field's text. Checking shows the spinner
 * copy; Invalid/Error carry their own inline messages under the field.
 */
@Composable
fun DeliveryCheckSection(
    pincode: String,
    check: DeliveryCheckState,
    onPincodeChange: (String) -> Unit,
    onCheck: () -> Unit,
    onReset: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.product_delivery_label),
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.semantics { heading() },
        )
        when (check) {
            is DeliveryCheckState.Serviceable -> {
                val tierLabel = when (check.tier) {
                    TIER_SHELF_WIRE -> stringResource(R.string.product_delivery_tier_shelf)
                    else -> stringResource(R.string.product_delivery_tier_fresh)
                }
                val daysLabel = deliveryDaysLabel(
                    tier = check.tier,
                    slaDays = check.slaDays,
                    sameDayLabel = stringResource(R.string.product_delivery_same_day),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(
                            R.string.product_delivery_result,
                            check.city.orEmpty(),
                            tierLabel,
                            daysLabel,
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onReset) {
                        Text(stringResource(R.string.product_delivery_change))
                    }
                }
            }
            is DeliveryCheckState.NotServiceable -> {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stringResource(
                            R.string.product_delivery_not_serviceable,
                            check.pincode,
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onReset) {
                        Text(stringResource(R.string.product_delivery_change))
                    }
                }
            }
            else -> {
                // Entry form — also the shape shown for Checking (disabled),
                // Invalid and Error (supporting text carries the difference).
                OutlinedTextField(
                    value = pincode,
                    onValueChange = onPincodeChange,
                    label = { Text(stringResource(R.string.product_delivery_placeholder)) },
                    isError = check is DeliveryCheckState.Invalid,
                    singleLine = true,
                    supportingText = when (check) {
                        DeliveryCheckState.Invalid -> {
                            { Text(stringResource(R.string.product_delivery_invalid)) }
                        }
                        DeliveryCheckState.Error -> {
                            { Text(stringResource(R.string.product_delivery_error)) }
                        }
                        else -> null
                    },
                    trailingIcon = if (check is DeliveryCheckState.Checking) {
                        {
                            CircularProgressIndicator(
                                modifier = Modifier.height(18.dp).width(18.dp),
                                strokeWidth = 2.dp,
                            )
                        }
                    } else {
                        null
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                if (check !is DeliveryCheckState.Checking) {
                    Button(
                        onClick = onCheck,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                    ) {
                        Text(stringResource(R.string.product_delivery_check))
                    }
                } else {
                    Text(
                        text = stringResource(R.string.product_delivery_checking),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
