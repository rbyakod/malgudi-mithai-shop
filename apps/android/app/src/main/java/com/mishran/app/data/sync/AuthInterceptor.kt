// apps/android/app/src/main/java/com/mishran/app/data/sync/AuthInterceptor.kt — Task 7.3.
//
// Application interceptor that attaches the current access token as a bearer to
// every outbound request. It is the proactive sibling of
// [TokenRefreshAuthenticator]: this interceptor puts the token on the request
// up front (so authed endpoints do not waste a round-trip 401-ing first), and
// the authenticator swaps a stale token for a fresh one on 401.
//
// Requests that already carry an Authorization header — e.g. `refresh()`, which
// sets the refresh bearer explicitly via @Header — are passed through untouched
// so we never clobber a deliberately-set credential.
package com.mishran.app.data.sync

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.mishran.app.data.local.DataStoreKeys
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

class AuthInterceptor @Inject constructor(
    private val dataStore: DataStore<Preferences>,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header("Authorization") != null) return chain.proceed(request)

        val token = runBlocking { dataStore.data.first()[DataStoreKeys.ACCESS_TOKEN] }
            ?: return chain.proceed(request)

        return chain.proceed(
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build(),
        )
    }
}
