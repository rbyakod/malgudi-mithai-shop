// apps/android/app/src/test/java/com/mishran/app/data/repository/BrandRepositoryTest.kt — P1 parity.
//
// JVM tests for the /brand support-contact cache: DataStore-first (one fetch
// per install), network fallback writes the cache, and failures return null
// so the Account row keeps its placeholder. The DataStore mock mirrors
// CatalogRepositoryTest's — `data` is a hot flow of prefs, `updateData`
// applies the edit transform into an observable MutablePreferences. NOTE:
// source-complete (no SDK).
package com.mishran.app.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.mutablePreferencesOf
import com.mishran.api.models.Brand
import com.mishran.api.models.BrandGet200Response
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.io.IOException

class BrandRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var repository: BrandRepository

    /** Whatever the repository has persisted so far. */
    private val stored: MutablePreferences = mutablePreferencesOf()

    private val contact = SupportContact(
        whatsappNumber = "+91-98765-43210",
        whatsappDigits = "919876543210",
    )

    @Before
    fun setUp() {
        api = mockk()
        dataStore = mockk()
        stored.clear()
        repository = BrandRepository(api, dataStore)

        every { dataStore.data } answers { flowOf(stored as Preferences) }
        // Stub the member (edit{} delegates to updateData) — same trick as
        // CatalogRepositoryTest: apply the transform to the live prefs.
        coEvery { dataStore.updateData(any()) } coAnswers {
            @Suppress("UNCHECKED_CAST")
            val transform = firstArg<suspend (Preferences) -> Preferences>()
            val updated = transform(stored as Preferences)
            stored.clear()
            @Suppress("UNCHECKED_CAST")
            updated.asMap().forEach { (key, value) ->
                stored[key as Preferences.Key<Any>] = value
            }
            updated
        }
    }

    private fun seedCache() {
        stored[DataStoreKeys.BRAND_WHATSAPP_NUMBER] = contact.whatsappNumber
        stored[DataStoreKeys.BRAND_WHATSAPP_DIGITS] = contact.whatsappDigits
    }

    @Test
    fun `a cached contact is served without touching the network`() = runTest {
        seedCache()

        assertEquals(contact, repository.getSupportContact())
        coVerify(exactly = 0) { api.getBrand() }
    }

    @Test
    fun `a cold cache fetches brand once and writes it through`() = runTest {
        coEvery { api.getBrand() } returns BrandGet200Response(
            Brand(whatsappNumber = "+91-98765-43210", whatsappDigits = "919876543210"),
        )

        assertEquals(contact, repository.getSupportContact())

        assertEquals(contact.whatsappNumber, stored[DataStoreKeys.BRAND_WHATSAPP_NUMBER])
        assertEquals(contact.whatsappDigits, stored[DataStoreKeys.BRAND_WHATSAPP_DIGITS])

        // The second call must come from the cache, not a second GET.
        repository.getSupportContact()
        coVerify(exactly = 1) { api.getBrand() }
    }

    @Test
    fun `a half-empty cache falls through to the network`() = runTest {
        stored[DataStoreKeys.BRAND_WHATSAPP_NUMBER] = contact.whatsappNumber // digits missing
        coEvery { api.getBrand() } returns BrandGet200Response(
            Brand(whatsappNumber = "+91-98765-43210", whatsappDigits = "919876543210"),
        )

        assertEquals(contact, repository.getSupportContact())
        coVerify(exactly = 1) { api.getBrand() }
    }

    @Test
    fun `a failed fetch with no cache returns null`() = runTest {
        coEvery { api.getBrand() } throws IOException("offline")

        assertNull(repository.getSupportContact())
        coVerify(exactly = 0) { dataStore.updateData(any()) }
    }

    @Test
    fun `blank digits are treated as no contact and never cached`() = runTest {
        coEvery { api.getBrand() } returns BrandGet200Response(
            Brand(whatsappNumber = "+91-00000-00000", whatsappDigits = ""),
        )

        assertNull(repository.getSupportContact())
        assertNull(stored[DataStoreKeys.BRAND_WHATSAPP_NUMBER])
    }
}
