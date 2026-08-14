// apps/android/app/src/test/java/com/mishran/app/data/repository/AuthRepositoryTest.kt — Task 12.5.
//
// Pins the logout security contract found missing in the Phase 12 audit:
// clearSession() used to drop only the DataStore tokens, which left (a) the
// Keystore-encrypted biometric refresh token in place — a later biometric
// unlock would silently restore the logged-out session — and (b) the Room
// caches (orders, addresses, cart) readable via a mishran://order/{id} deep
// link with no session at all. NOTE: not executable here (no SDK);
// source-complete.
package com.mishran.app.data.repository

import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.mutablePreferencesOf
import androidx.datastore.core.DataStore
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.local.MishranDatabase
import com.mishran.app.data.local.SecureTokenStore
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.Runs
import io.mockk.every
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var secureTokenStore: SecureTokenStore
    private lateinit var database: MishranDatabase
    private lateinit var repository: AuthRepository

    private val writtenPrefs: MutablePreferences = mutablePreferencesOf(
        DataStoreKeys.ACCESS_TOKEN to "access",
        DataStoreKeys.REFRESH_TOKEN to "refresh",
        DataStoreKeys.CUSTOMER_ID to "cust_1",
    )

    @Before
    fun setUp() {
        api = mockk()
        dataStore = mockk()
        secureTokenStore = mockk()
        database = mockk()
        repository = AuthRepository(api, dataStore, secureTokenStore, database)

        every { dataStore.data } returns flowOf(writtenPrefs)
        // Stub the member (edit{} delegates to updateData) — mocking the
        // extension itself confuses MockK's signature matching. edit applies
        // its transform to a copy, so fold the result back into writtenPrefs.
        coEvery { dataStore.updateData(any()) } coAnswers {
            val updated = firstArg<suspend (Preferences) -> Preferences>().invoke(writtenPrefs)
            writtenPrefs.clear()
            @Suppress("UNCHECKED_CAST")
            updated.asMap().forEach { (key, value) ->
                writtenPrefs[key as Preferences.Key<Any>] = value
            }
            updated
        }
        coEvery { secureTokenStore.clear() } just Runs
        coEvery { database.clearAllTables() } just Runs
    }

    @Test
    fun `clearSession drops the persisted session keys`() = runTest {
        repository.clearSession()

        assertFalse(writtenPrefs.contains(DataStoreKeys.ACCESS_TOKEN))
        assertFalse(writtenPrefs.contains(DataStoreKeys.REFRESH_TOKEN))
        assertFalse(writtenPrefs.contains(DataStoreKeys.CUSTOMER_ID))
    }

    @Test
    fun `clearSession also drops the biometric refresh token`() = runTest {
        // Logout must fully sign out: a surviving Keystore token would let
        // the next biometric prompt restore the session (Task 12.5 audit).
        repository.clearSession()

        coVerify(exactly = 1) { secureTokenStore.clear() }
    }

    @Test
    fun `clearSession wipes the Room caches`() = runTest {
        // Orders/addresses/cart must not outlive the session — the order
        // deep link reads Room before the network (Task 12.5 audit).
        repository.clearSession()

        coVerify(exactly = 1) { database.clearAllTables() }
    }
}
