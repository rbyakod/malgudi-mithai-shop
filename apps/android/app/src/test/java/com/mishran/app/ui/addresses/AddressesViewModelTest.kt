// apps/android/app/src/test/java/com/mishran/app/ui/addresses/AddressesViewModelTest.kt — Task 10.2.
//
// JVM tests for the addresses state machine, focused on the delete flow
// (DELETE /addresses/{id}): success refreshes the list from the repository,
// failure surfaces the retry message and leaves the list untouched. The
// repository is mocked (mockk), matching the sibling ViewModel tests.
package com.mishran.app.ui.addresses

import com.mishran.api.models.Address
import com.mishran.app.data.repository.AddressRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class AddressesViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: AddressRepository

    private val home = address(id = "a1")
    private val work = address(id = "a2")

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init loads the saved addresses`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(home, work)

        val vm = AddressesViewModel(repository)
        advanceUntilIdle()

        assertFalse(vm.state.value.loading)
        assertEquals(listOf(home, work), vm.state.value.addresses)
    }

    @Test
    fun `successful delete refreshes the list`() = runTest(dispatcher) {
        val live = mutableListOf(home, work)
        coEvery { repository.listAddresses() } coAnswers { live.toList() }
        coEvery { repository.deleteAddress("a1") } answers {
            live.removeFirst()
            true
        }

        val vm = AddressesViewModel(repository)
        advanceUntilIdle()
        vm.deleteAddress(home)
        advanceUntilIdle()

        coVerify(exactly = 1) { repository.deleteAddress("a1") }
        // init refresh + post-delete refresh.
        coVerify(exactly = 2) { repository.listAddresses() }
        assertEquals(listOf(work), vm.state.value.addresses)
        assertNull(vm.state.value.message)
    }

    @Test
    fun `failed delete surfaces the retry message and keeps the list`() = runTest(dispatcher) {
        coEvery { repository.listAddresses() } returns listOf(home, work)
        coEvery { repository.deleteAddress("a2") } returns false

        val vm = AddressesViewModel(repository)
        advanceUntilIdle()
        vm.deleteAddress(work)
        advanceUntilIdle()

        assertEquals("Could not delete the address. Try again.", vm.state.value.message)
        assertEquals(listOf(home, work), vm.state.value.addresses)
        // No refresh on failure — the server still holds the address.
        coVerify(exactly = 1) { repository.listAddresses() }
    }

    private fun address(id: String) = Address(
        id = id,
        line1 = "12 Hauz Khas Village",
        city = "New Delhi",
        state = "Delhi",
        pincode = "110001",
    )
}
