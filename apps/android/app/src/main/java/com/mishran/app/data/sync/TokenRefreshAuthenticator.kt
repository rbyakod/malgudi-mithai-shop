// apps/android/app/src/main/java/com/mishran/app/data/sync/TokenRefreshAuthenticator.kt — Task 7.3.
//
// OkHttp Authenticator that transparently refreshes an expired access token on
// 401 and retries the original request once. Two recursion guards are required
// because the refresh call rides the SAME OkHttp client as everything else:
//
//   1. Refresh-endpoint self-guard — a 401 on `auth/refresh` itself returns
//      null immediately instead of calling refresh() again (otherwise a dead
//      refresh token would make the authenticator call itself forever).
//   2. Per-request attempt cap — even after a successful refresh, a server
//      that keeps 401-ing stops the authenticator after one retry, handing the
//      401 back to the caller.
//
// The plan's draft had neither guard and read the DataStore with invalid
// `dataStore.data[KEY]` syntax (a Flow has no subscript) — both corrected here.
package com.mishran.app.data.sync

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.remote.api.MishranApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider

class TokenRefreshAuthenticator @Inject constructor(
    private val dataStore: DataStore<Preferences>,
    // Provider breaks the DI cycle: DataStore -> Authenticator -> OkHttp ->
    // Retrofit -> MishranApi -> OkHttp. Deferring MishranApi resolution to
    // first call avoids constructing OkHttp before the authenticator exists.
    private val apiProvider: Provider<MishranApi>,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Guard 0: only react to Unauthorized.
        if (response.code != 401) return null

        // Guard 1: never try to refresh the refresh call itself.
        if (response.request.url.encodedPath.endsWith("auth/refresh")) return null

        // Guard 2: one retry max per request chain.
        if (response.responseCount() >= MAX_ATTEMPTS) {
            clearTokens()
            return null
        }

        val refresh = runBlocking { dataStore.data.first()[DataStoreKeys.REFRESH_TOKEN] }
            ?: return null // never signed in — surface the 401 to the caller

        val newTokens = runBlocking {
            try {
                apiProvider.get().refresh("Bearer $refresh").data
            } catch (e: Exception) {
                null
            }
        } ?: run {
            // Refresh failed (revoked / network) — drop the session.
            clearTokens()
            return null
        }

        runBlocking {
            dataStore.edit {
                it[DataStoreKeys.ACCESS_TOKEN] = newTokens.accessToken
                it[DataStoreKeys.REFRESH_TOKEN] = newTokens.refreshToken
            }
        }

        return response.request.newBuilder()
            .header("Authorization", "Bearer ${newTokens.accessToken}")
            .build()
    }

    private fun clearTokens() {
        runBlocking {
            dataStore.edit {
                it.remove(DataStoreKeys.ACCESS_TOKEN)
                it.remove(DataStoreKeys.REFRESH_TOKEN)
            }
        }
    }

    /** Walks the prior-response chain to count how many times this request has been tried. */
    private fun Response.responseCount(): Int {
        var response: Response? = this
        var count = 1
        while (response?.priorResponse != null) {
            count++
            response = response.priorResponse
        }
        return count
    }

    private companion object {
        const val MAX_ATTEMPTS = 2
    }
}
