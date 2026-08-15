// apps/android/app/src/test/java/com/mishran/app/ui/catalog/CatalogViewModelTest.kt — Task 9.3.
//
// JVM unit tests for the catalog ViewModel + the pure filter function.
// GetCatalogUseCase is mocked as a flow-of-lists: [cached, fresh] mirrors the
// repository's two-emit contract. NOTE: source-complete (no SDK).
package com.mishran.app.ui.catalog

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Product
import com.mishran.app.domain.usecase.GetCatalogUseCase
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.flowOf
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

class CatalogViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var getCatalog: GetCatalogUseCase

    private val cachedList = listOf(product("p1", "Kaju Katli", Product.Family.classic, listOf("sugar-free")))
    private val freshList = listOf(
        product("p1", "Kaju Katli", Product.Family.classic, listOf("sugar-free")),
        product("p2", "Mysore Pak", Product.Family.regional, listOf("eggless")),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        getCatalog = mockk()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `first emission renders as Cached, second as Fresh`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList, freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        assertEquals(CatalogUiState.Fresh(freshList), vm.uiState.value)
        assertEquals(2, vm.uiState.value.products.size)
    }

    @Test
    fun `visible products track the latest emission`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList, freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        assertEquals(freshList, vm.visibleProducts.value)
    }

    @Test
    fun `search query filters visible products by name case-insensitively`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onSearchQueryChange("kaju")
        advanceUntilIdle()
        assertEquals(listOf(freshList[0]), vm.visibleProducts.value)
    }

    @Test
    fun `clearing search restores the full list`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onSearchQueryChange("kaju")
        vm.onSearchQueryChange("")
        advanceUntilIdle()
        assertEquals(freshList, vm.visibleProducts.value)
    }

    @Test
    fun `family filter narrows to that family`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onFiltersChange(CatalogFilters(family = Product.Family.regional))
        advanceUntilIdle()
        assertEquals(listOf(freshList[1]), vm.visibleProducts.value)
    }

    @Test
    fun `dietary tags are AND-ed`() = runTest(dispatcher) {
        val both = listOf(
            product("p1", "A", Product.Family.classic, listOf("sugar-free", "eggless")),
            product("p2", "B", Product.Family.classic, listOf("sugar-free")),
        )
        every { getCatalog(any()) } returns flowOf(both)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onFiltersChange(CatalogFilters(dietaryTags = setOf("sugar-free", "eggless")))
        advanceUntilIdle()
        assertEquals(listOf(both[0]), vm.visibleProducts.value)
    }

    @Test
    fun `clearFilters resets family and tags`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.activeFilters.collectInTest(this)
        advanceUntilIdle()

        vm.onFiltersChange(CatalogFilters(family = Product.Family.regional, dietaryTags = setOf("x")))
        vm.clearFilters()
        advanceUntilIdle()

        assertEquals(CatalogFilters(), vm.activeFilters.value)
    }

    @Test
    fun `available dietary tags are the distinct union across products`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.availableDietaryTags.collectInTest(this)
        advanceUntilIdle()

        assertEquals(setOf("sugar-free", "eggless"), vm.availableDietaryTags.value)
    }

    @Test
    fun `refresh re-invokes the use case with force`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        vm.refresh()
        advanceUntilIdle()

        io.mockk.verify { getCatalog(true) }
    }

    @Test
    fun `initial load is not forced`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)

        val vm = CatalogViewModel(getCatalog, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        io.mockk.verify(exactly = 1) { getCatalog(false) }
        io.mockk.verify(exactly = 0) { getCatalog(true) }
    }

    // ---- filterProducts (pure function) ----------------------------------

    @Test
    fun `blank query and empty filters keep everything`() {
        assertEquals(freshList, filterProducts(freshList, "  ", CatalogFilters()))
    }

    @Test
    fun `query matches slug but not partial names`() {
        val hits = filterProducts(freshList, "mysore-pak", CatalogFilters())
        assertEquals(listOf(freshList[1]), hits)
        assertEquals(emptyList<Product>(), filterProducts(freshList, "kajuu", CatalogFilters()))
    }

    @Test
    fun `filters compose with query`() {
        val hits = filterProducts(freshList, "pak", CatalogFilters(family = Product.Family.regional))
        assertEquals(listOf(freshList[1]), hits)
        assertTrue(filterProducts(freshList, "pak", CatalogFilters(family = Product.Family.classic)).isEmpty())
    }

    private fun product(
        id: String,
        name: String,
        family: Product.Family,
        dietaryTags: List<String>,
    ) = Product(
        id = id,
        slug = name.lowercase().replace(" ", "-"),
        name = name,
        family = family,
        dietaryTags = dietaryTags,
    )
}

/** Collect the flow in the background so stateIn's WhileSubscribed starts. */
private fun <T> kotlinx.coroutines.flow.StateFlow<T>.collectInTest(
    scope: kotlinx.coroutines.test.TestScope,
) {
    scope.backgroundScope.launch { this@collectInTest.collect { } }
}
