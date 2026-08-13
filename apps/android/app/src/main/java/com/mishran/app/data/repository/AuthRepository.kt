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
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.flow.first
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: MishranApi,
    private val dataStore: DataStore<Preferences>,
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

    /** Drop the persisted session (access + refresh + customer). */
    suspend fun clearSession() {
        dataStore.edit {
            it.remove(DataStoreKeys.ACCESS_TOKEN)
            it.remove(DataStoreKeys.REFRESH_TOKEN)
            it.remove(DataStoreKeys.CUSTOMER_ID)
        }
    }
}
