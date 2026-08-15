// apps/android/app/src/main/java/com/mishran/app/data/local/DataStoreKeys.kt — Task 7.3.
//
// Typed Preferences keys for the auth + session DataStore. Kept as a small
// object (not a wrapper class) so callers read `dataStore.data[ACCESS_TOKEN]`
// directly; the keys are string-typed values, which is all the auth layer needs
// today. A typed Account holder can replace this later without churn here.
package com.mishran.app.data.local

import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey

object DataStoreKeys {
    /** Short-lived JWT access token; sent as `Authorization: Bearer <…>`. */
    val ACCESS_TOKEN: Preferences.Key<String> = stringPreferencesKey("access_token")

    /** Long-lived refresh token; sent as the bearer for POST /auth/refresh. */
    val REFRESH_TOKEN: Preferences.Key<String> = stringPreferencesKey("refresh_token")

    /** Customer id from the verified token; used for owner-scoped cache keys. */
    val CUSTOMER_ID: Preferences.Key<String> = stringPreferencesKey("customer_id")

    /** Signed-in customer's phone (E.164), shown on the Account screen. */
    val CUSTOMER_PHONE: Preferences.Key<String> = stringPreferencesKey("customer_phone")

    /** Last catalog ETag, replayed as If-None-Match to short-circuit 304s. */
    val CATALOG_ETAG: Preferences.Key<String> = stringPreferencesKey("catalog_etag")

    /** Persisted locale tag (en, hi, kn, …) chosen by the user, if any. */
    val LOCALE: Preferences.Key<String> = stringPreferencesKey("locale")
}
