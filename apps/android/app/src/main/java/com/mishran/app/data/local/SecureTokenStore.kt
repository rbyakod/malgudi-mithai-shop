// apps/android/app/src/main/java/com/mishran/app/data/local/SecureTokenStore.kt — Task 8.2.
//
// Keystore-backed encrypted storage for the biometric-gated refresh token.
// EncryptedSharedPreferences derives its keys/values from an Android Keystore
// master key (AES256-GCM), so the refresh token is encrypted at rest — pulling
// it off-device yields ciphertext.
//
// v1 SECURITY DESIGN (deliberate, with a tracked upgrade path):
//   The master key is NOT bound to a CryptoObject at the biometric layer.
// Instead, access is gated by the UI: SecureTokenStore is only ever read after
// a successful BiometricPrompt (see BiometricGate). The TODO upgrade is to bind
// the key with setUserAuthenticationRequired(true) + a CryptoObject so the key
// itself is biometric-locked — stronger, but requires the prompt/crypto
// handshake which is deferred to hardening (Phase 12) to avoid key-invalidation
// churn now.
package com.mishran.app.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecureTokenStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs by lazy { createPrefs() }

    /** Persist the refresh token behind the Keystore-encrypted store. */
    fun saveRefreshToken(token: String) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token).apply()
    }

    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    fun hasRefreshToken(): Boolean = prefs.contains(KEY_REFRESH_TOKEN)

    fun clear() {
        prefs.edit().clear().apply()
    }

    private fun createPrefs() = EncryptedSharedPreferences.create(
        context,
        FILE_NAME,
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private companion object {
        const val FILE_NAME = "mishran_biometric_prefs"
        const val KEY_REFRESH_TOKEN = "refresh_token"
    }
}
