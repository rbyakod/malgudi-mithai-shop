// apps/android/app/src/test/java/com/mishran/app/data/repository/AddressRepositoryTest.kt — Task 10.2.
//
// JVM unit tests for the address + serviceability wrapper. NOTE:
// source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.Address
import com.mishran.api.models.AddressesGet200Response
import com.mishran.api.models.AddressesGet200ResponseData
import com.mishran.api.models.CatalogServiceableGet200Response
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.data.remote.api.MishranApi
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AddressRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var repository: AddressRepository

    @Before
    fun setUp() {
        api = mockk()
        repository = AddressRepository(api)
    }

    @Test
    fun `listAddresses sorts the default address first`() = runTest {
        val plain = Address(id = "a1", isDefault = false)
        val default = Address(id = "a2", isDefault = true)
        coEvery { api.listAddresses() } returns AddressesGet200Response(
            data = AddressesGet200ResponseData(items = listOf(plain, default)),
        )

        val result = repository.listAddresses()

        assertEquals(listOf("a2", "a1"), result.map { it.id })
    }

    @Test
    fun `listAddresses collapses failures to an empty list`() = runTest {
        coEvery { api.listAddresses() } throws java.io.IOException("offline")

        assertEquals(emptyList<Address>(), repository.listAddresses())
    }

    @Test
    fun `checkServiceability unwraps the envelope`() = runTest {
        val expected = ServiceableResponse(serviceable = true, tier = "fresh", slaDays = 1)
        coEvery { api.checkPincode("110001") } returns CatalogServiceableGet200Response(expected)

        assertEquals(expected, repository.checkServiceability("110001"))
    }

    @Test
    fun `checkServiceability returns null on failure`() = runTest {
        coEvery { api.checkPincode(any()) } throws java.io.IOException("offline")

        assertNull(repository.checkServiceability("110001"))
    }
}
