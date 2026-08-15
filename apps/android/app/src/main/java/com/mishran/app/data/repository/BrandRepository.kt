// apps/android/app/src/main/java/com/mishran/app/data/repository/BrandRepository.kt — P1 parity (WhatsApp support).
//
// The brand support contact behind GET /brand (public, tiny, static): fetch
// it at most once per install and cache it in the preferences DataStore —
// offline-first like every other seam, and the Account support row renders
// instantly on later visits. A failed fetch returns null; the caller falls
// back to the built-in placeholder (PLACEHOLDER_WHATSAPP_DIGITS, the same
// number OrderDetail's dialer uses) rather than hiding the row.
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/** WhatsApp contact as the UI needs it: a display form + wa.me digits. */
data class SupportContact(
    /** Display form, e.g. "+91-98765-43210". */
    val whatsappNumber: String,
    /** Digits only, for https://wa.me/<digits> deep links. */
    val whatsappDigits: String,
)

@Singleton
class BrandRepository @Inject constructor(
    private val api: MishranApi,
    private val dataStore: DataStore<Preferences>,
) {

    /**
     * The cached-or-fetched support contact; null when neither DataStore nor
     * the network has one (offline first run). Never throws.
     */
    suspend fun getSupportContact(): SupportContact? {
        dataStore.data.first().let { prefs ->
            val number = prefs[DataStoreKeys.BRAND_WHATSAPP_NUMBER]
            val digits = prefs[DataStoreKeys.BRAND_WHATSAPP_DIGITS]
            if (!number.isNullOrBlank() && !digits.isNullOrBlank()) {
                return SupportContact(whatsappNumber = number, whatsappDigits = digits)
            }
        }
        val brand = try {
            api.getBrand().data
        } catch (e: Exception) {
            return null // offline / 5xx — keep serving whatever the cache had
        }
        if (brand.whatsappDigits.isBlank()) return null
        val contact = SupportContact(
            whatsappNumber = brand.whatsappNumber,
            whatsappDigits = brand.whatsappDigits,
        )
        dataStore.edit { prefs ->
            prefs[DataStoreKeys.BRAND_WHATSAPP_NUMBER] = contact.whatsappNumber
            prefs[DataStoreKeys.BRAND_WHATSAPP_DIGITS] = contact.whatsappDigits
        }
        return contact
    }
}

/**
 * Placeholder until /brand lands (matches OrderDetailScreen's SUPPORT_PHONE,
 * "+918000000000" — digits only for wa.me). Callers show this whenever the
 * fetch has not succeeded yet, so the support row is always actionable.
 */
const val PLACEHOLDER_WHATSAPP_DIGITS: String = "918000000000"

/** Placeholder display form that pairs with [PLACEHOLDER_WHATSAPP_DIGITS]. */
const val PLACEHOLDER_WHATSAPP_NUMBER: String = "+91 80000 00000"
