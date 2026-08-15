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
import kotlinx.coroutines.launch
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

    // ---- P1 parity: pack-scoped cart writes + buy now ---------------------

    @Test
    fun `addToCart forwards the selected pack with quantity`() = runTest(dispatcher) {
        coEvery { repository.getProduct(any()) } returns product
        coEvery { cartRepository.add(any(), any(), any()) } returns Unit

        val vm = viewModel()
        advanceUntilIdle()

        var added = 0
        val collector = launch { vm.added.collect { added++ } }
        advanceUntilIdle()

        val oneKg = PackSize(label = "1 kg", priceLabel = "₹1,440 / 1 kg", grams = 1000)
        vm.incrementQuantity()
        vm.addToCart(oneKg)
        advanceUntilIdle()

        assertEquals(1, added)
        coVerify(exactly = 1) { cartRepository.add(product, 2, oneKg) }
        collector.cancel()
    }

    @Test
    fun `buyNow writes the pack then emits bought not added`() = runTest(dispatcher) {
        coEvery { repository.getProduct(any()) } returns product
        coEvery { cartRepository.add(any(), any(), any()) } returns Unit

        val vm = viewModel()
        advanceUntilIdle()

        var bought = 0
        var added = 0
        val boughtCollector = launch { vm.bought.collect { bought++ } }
        val addedCollector = launch { vm.added.collect { added++ } }
        advanceUntilIdle()

        val fiveHundred = PackSize(label = "500g", priceLabel = "₹720 / 500g", grams = 500)
        vm.buyNow(fiveHundred)
        advanceUntilIdle()

        assertEquals(1, bought)
        assertEquals(0, added) // one-shot flow: the screen navigates on `bought`
        coVerify(exactly = 1) { cartRepository.add(product, 1, fiveHundred) }
        boughtCollector.cancel()
        addedCollector.cancel()
    }
}
