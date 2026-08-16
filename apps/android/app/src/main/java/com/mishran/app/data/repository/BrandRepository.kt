// apps/android/app/src/main/java/com/mishran/app/data/repository/BrandRepository.kt — P1 parity (WhatsApp support) / live-brand-copy parity.
//
// The brand record behind GET /brand (public, tiny, static): fetch it at most
// once per install and cache it in the preferences DataStore — offline-first
// like every other seam, so the Account support row, PDP/cart WhatsApp rows,
// Home's announcement strip, and the static hero masthead render instantly on
// later visits. A failed fetch returns null; the caller falls back to the
// built-in placeholder (PLACEHOLDER_WHATSAPP_DIGITS, the same number
// OrderDetail's dialer uses) or the localized fallback copy rather than
// hiding the surface.
//
// Live brand copy (parity): the regenerated Brand contract carries optional
// brandName/tagline/positioning from the brand-settings global. They ride the
// SAME cached SupportContact (null when the global omits them) so every
// consumer gets copy + contact in one read; positioning has no UI surface yet
// and is deliberately not cached.
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Brand contact + display copy as the UI needs it: a display number, wa.me
 * digits, and the optional brand-settings copy (null when the global omits
 * them — callers render their localized fallback in that case).
 */
data class SupportContact(
    /** Display form, e.g. "+91-98765-43210". */
    val whatsappNumber: String,
    /** Digits only, for https://wa.me/<digits> deep links. */
    val whatsappDigits: String,
    /** Brand name from the brand-settings global; null when unset. */
    val brandName: String? = null,
    /** One-line tagline from the brand-settings global; null when unset. */
    val tagline: String? = null,
)

@Singleton
class BrandRepository @Inject constructor(
    private val api: MishranApi,
    private val dataStore: DataStore<Preferences>,
) {

    /**
     * The cached-or-fetched brand contact + copy; null when neither DataStore
     * nor the network has one (offline first run). Never throws.
     */
    suspend fun getSupportContact(): SupportContact? {
        dataStore.data.first().let { prefs ->
            val number = prefs[DataStoreKeys.BRAND_WHATSAPP_NUMBER]
            val digits = prefs[DataStoreKeys.BRAND_WHATSAPP_DIGITS]
            if (!number.isNullOrBlank() && !digits.isNullOrBlank()) {
                return SupportContact(
                    whatsappNumber = number,
                    whatsappDigits = digits,
                    brandName = prefs[DataStoreKeys.BRAND_NAME]?.takeIf { it.isNotBlank() },
                    tagline = prefs[DataStoreKeys.BRAND_TAGLINE]?.takeIf { it.isNotBlank() },
                )
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
            brandName = brand.brandName?.takeIf { it.isNotBlank() },
            tagline = brand.tagline?.takeIf { it.isNotBlank() },
        )
        dataStore.edit { prefs ->
            prefs[DataStoreKeys.BRAND_WHATSAPP_NUMBER] = contact.whatsappNumber
            prefs[DataStoreKeys.BRAND_WHATSAPP_DIGITS] = contact.whatsappDigits
            // Copy keys are absent-when-null: a later fetch with the copy
            // unset overwrites a stale value with absence, exactly like /brand.
            if (contact.brandName == null) prefs.remove(DataStoreKeys.BRAND_NAME)
            else prefs[DataStoreKeys.BRAND_NAME] = contact.brandName
            if (contact.tagline == null) prefs.remove(DataStoreKeys.BRAND_TAGLINE)
            else prefs[DataStoreKeys.BRAND_TAGLINE] = contact.tagline
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
