// apps/android/app/src/main/java/com/mishran/app/data/repository/AuthRepository.kt — Task 8.1.
//
// Single access point for authentication: OTP send/verify, token persistence,
// and session queries. Wraps [MishranApi] + the typed DataStore so ViewModels
// depend on one repository (trivial to fake in tests) rather than the raw API
// + DataStore plumbing. Token writes are the source of truth for "signed in";
// [com.mishran.app.data.sync.AuthInterceptor] + [TokenRefreshAuthenticator] read
// the same keys this repository writes.
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.api.models.OtpSendRequest
import com.mishran.api.models.OtpSendResponse
import com.mishran.api.models.OtpVerifyRequest
import com.mishran.api.models.OtpVerifyResponse
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.MishranDatabase
import com.mishran.app.data.local.SecureTokenStore
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: MishranApi,
    private val dataStore: DataStore<Preferences>,
    // Keystore-encrypted store for the biometric-gated refresh token (Task 8.2).
    // Distinct from the plain DataStore: it is only written when the user opts
    // into biometric login, and only read after a successful BiometricPrompt.
    private val secureTokenStore: SecureTokenStore,
    // Room cache owner — clearSession() wipes tables on sign-out (Task 12.5).
    private val database: MishranDatabase,
) {
    /** Send an OTP to an E.164 phone; returns the server requestId + expiry. */
    suspend fun sendOtp(phone: String): OtpSendResponse {
        val resp = api.sendOtp(OtpSendRequest(phone = phone))
        return resp.data ?: throw IOException("Empty sendOtp response")
    }

    /**
     * Verify a 6-digit code against [requestId]. On success the access + refresh
     * tokens and customer id are persisted, then the verified payload returned.
     */
    suspend fun verifyOtp(requestId: String, code: String): OtpVerifyResponse {
        val resp = api.verifyOtp(OtpVerifyRequest(requestId = requestId, code = code))
        val data = resp.data ?: throw IOException("Empty verifyOtp response")
        dataStore.edit {
            it[DataStoreKeys.ACCESS_TOKEN] = data.accessToken
            it[DataStoreKeys.REFRESH_TOKEN] = data.refreshToken
            it[DataStoreKeys.CUSTOMER_ID] = data.customer.id
        }
        return data
    }

    /** True when a session exists (an access token is persisted). */
    suspend fun isLoggedIn(): Boolean =
        dataStore.data.first()[DataStoreKeys.ACCESS_TOKEN] != null

    /**
     * Sign out completely (Task 12.5 audit): drop the persisted session
     * (access + refresh + customer), the Keystore-encrypted biometric token
     * (a surviving one would let the next biometric prompt silently restore
     * the logged-out session), and the Room caches (orders/addresses/cart
     * must not outlive the session — the mishran://order/{id} deep link reads
     * Room before the network, and getOrder's network fallback 401s without
     * a session).
     */
    suspend fun clearSession() {
        dataStore.edit {
            it.remove(DataStoreKeys.ACCESS_TOKEN)
            it.remove(DataStoreKeys.REFRESH_TOKEN)
            it.remove(DataStoreKeys.CUSTOMER_ID)
        }
        secureTokenStore.clear()
        withContext(Dispatchers.IO) {
            database.clearAllTables()
        }
    }

    // ---- Biometric login (Task 8.2) ----------------------------------------

    /**
     * Opt this device into biometric unlock: copy the current refresh token
     * into the Keystore-encrypted store. Idempotent — overwrites any prior
     * token, so it is safe after every rotation. Returns false only when there
     * is no refresh token to copy (caller had not completed sign-in).
     */
    suspend fun enableBiometricLogin(): Boolean {
        val refresh = dataStore.data.first()[DataStoreKeys.REFRESH_TOKEN] ?: return false
        secureTokenStore.saveRefreshToken(refresh)
        return true
    }

    /** True when a biometric-gated refresh token exists for cold-start unlock. */
    suspend fun isBiometricLoginEnabled(): Boolean = secureTokenStore.hasRefreshToken()

    /** Drop the biometric-gated token; leaves the live DataStore session intact. */
    suspend fun disableBiometricLogin() {
        secureTokenStore.clear()
    }

    /**
     * Re-enter the app behind a biometric challenge: copy the encrypted refresh
     * token back into the DataStore (where [TokenRefreshAuthenticator] reads
     * it), then silent-refresh to mint a fresh access token. Returns false when
     * no stored token exists or the refresh failed — the caller must send the
     * user to OTP sign-in rather than show a raw error at cold start.
     *
     * Rotation-safe: the backend revokes the consumed refresh token, so the
     * newly issued one is written back into the encrypted store for the next
     * cold start.
     */
    suspend fun restoreSessionFromBiometric(): Boolean {
        val refresh = secureTokenStore.getRefreshToken() ?: return false
        // Make the token visible to AuthInterceptor / TokenRefreshAuthenticator.
        dataStore.edit { it[DataStoreKeys.REFRESH_TOKEN] = refresh }
        val refreshed = try {
            api.refresh("Bearer $refresh").data
        } catch (e: Exception) {
            return false
        }
        dataStore.edit {
            it[DataStoreKeys.ACCESS_TOKEN] = refreshed.accessToken
            it[DataStoreKeys.REFRESH_TOKEN] = refreshed.refreshToken
        }
        secureTokenStore.saveRefreshToken(refreshed.refreshToken)
        return true
    }
}
