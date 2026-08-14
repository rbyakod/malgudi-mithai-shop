// apps/android/app/src/test/java/com/mishran/app/ui/product/ProductDetailViewModelTest.kt — Task 9.4.
//
// JVM unit tests for the detail screen's state machine: Room→network lookup
// mapping onto UiState, quantity stepper bounds, and retry. SavedStateHandle
// is instantiated directly (it is plain Kotlin). NOTE: source-complete (no SDK).
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Product
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.ui.common.UiState
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ProductDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: CatalogRepository
    private lateinit var cartRepository: CartRepository

    private val product = Product(
        id = "p1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = Product.Family.classic,
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository = mockk()
        cartRepository = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(slug: String = "kaju-katli") =
        ProductDetailViewModel(repository, cartRepository, SavedStateHandle(mapOf("slug" to slug)))

    @Test
    fun `slug is read from the saved state handle`() {
        assertEquals("kaju-katli", viewModel().slug)
    }

    @Test
    fun `found product maps to Success`() = runTest(dispatcher) {
        coEvery { repository.getProduct("kaju-katli") } returns product

        val vm = viewModel()
        advanceUntilIdle()

        assertEquals(UiState.Success(product), vm.state.value)
    }

    @Test
    fun `missing product maps to Error`() = runTest(dispatcher) {
        coEvery { repository.getProduct(any()) } returns null

        val vm = viewModel()
        advanceUntilIdle()

        assertTrue(vm.state.value is UiState.Error)
    }

    @Test
    fun `quantity starts at one and decrements no lower`() = runTest(dispatcher) {
        coEvery { repository.getProduct(any()) } returns product

        val vm = viewModel()
        advanceUntilIdle()

        assertEquals(1, vm.quantity.value)
        vm.decrementQuantity()
        assertEquals(1, vm.quantity.value)
    }

    @Test
    fun `quantity increments and is capped at the backstop maximum`() = runTest(dispatcher) {
        coEvery { repository.getProduct(any()) } returns product

        val vm = viewModel()
        advanceUntilIdle()

        repeat(25) { vm.incrementQuantity() }
        assertEquals(20, vm.quantity.value)
    }

    @Test
    fun `load retries the lookup`() = runTest(dispatcher) {
        coEvery { repository.getProduct("kaju-katli") } returns null andThen product

        val vm = viewModel()
        advanceUntilIdle()
        assertTrue(vm.state.value is UiState.Error)

        vm.load()
        advanceUntilIdle()
        assertEquals(UiState.Success(product), vm.state.value)
        coVerify(exactly = 2) { repository.getProduct("kaju-katli") }
    }
}
