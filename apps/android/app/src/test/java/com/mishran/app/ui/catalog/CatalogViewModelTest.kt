// apps/android/app/src/test/java/com/mishran/app/ui/catalog/CatalogViewModelTest.kt — Task 9.3 / P2 net-new (verticals).
//
// JVM unit tests for the catalog ViewModel + the pure filter function.
// GetCatalogUseCase is mocked as a flow-of-lists: [cached, fresh] mirrors the
// repository's two-emit contract. The P2 vertical-tab tests mock
// VerticalRepository with Result values (loading → content / error → retry).
// NOTE: source-complete (no SDK).
package com.mishran.app.ui.catalog

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Merch
import com.mishran.api.models.Product
import com.mishran.api.models.QsrItem
import com.mishran.api.models.Snack
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.SettingsRepository
import com.mishran.app.data.repository.VerticalRepository
import com.mishran.app.domain.usecase.GetCatalogUseCase
import io.mockk.coEvery
import io.mockk.coVerify
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
import java.io.IOException

class CatalogViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var getCatalog: GetCatalogUseCase
    private lateinit var verticalRepository: VerticalRepository
    private lateinit var cartRepository: CartRepository
    private lateinit var settingsRepository: SettingsRepository

    private val cachedList = listOf(product("p1", "Kaju Katli", Product.Family.classic, listOf("sugar-free")))
    private val freshList = listOf(
        product("p1", "Kaju Katli", Product.Family.classic, listOf("sugar-free")),
        product("p2", "Mysore Pak", Product.Family.regional, listOf("eggless")),
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        getCatalog = mockk()
        verticalRepository = mockk()
        cartRepository = mockk()
        settingsRepository = mockk()
        // Parity batch defaults: no persisted sort, empty live cart badge.
        every { settingsRepository.catalogSortFlow() } returns flowOf(null)
        coEvery { settingsRepository.setCatalogSort(any()) } returns Unit
        every { cartRepository.observeItems() } returns flowOf(emptyList())
        coEvery { cartRepository.add(any(), any(), any()) } returns Unit
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `first emission renders as Cached, second as Fresh`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList, freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        assertEquals(CatalogUiState.Fresh(freshList), vm.uiState.value)
        assertEquals(2, vm.uiState.value.products.size)
    }

    @Test
    fun `visible products track the latest emission`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList, freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        assertEquals(freshList, vm.visibleProducts.value)
    }

    @Test
    fun `search query filters visible products by name case-insensitively`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onSearchQueryChange("kaju")
        advanceUntilIdle()
        assertEquals(listOf(freshList[0]), vm.visibleProducts.value)
    }

    @Test
    fun `clearing search restores the full list`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
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

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
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

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        vm.onFiltersChange(CatalogFilters(dietaryTags = setOf("sugar-free", "eggless")))
        advanceUntilIdle()
        assertEquals(listOf(both[0]), vm.visibleProducts.value)
    }

    @Test
    fun `clearFilters resets family and tags`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
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

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.availableDietaryTags.collectInTest(this)
        advanceUntilIdle()

        assertEquals(setOf("sugar-free", "eggless"), vm.availableDietaryTags.value)
    }

    @Test
    fun `refresh re-invokes the use case with force`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(freshList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        vm.refresh()
        advanceUntilIdle()

        io.mockk.verify { getCatalog(true) }
    }

    @Test
    fun `initial load is not forced`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.uiState.collectInTest(this)
        advanceUntilIdle()

        io.mockk.verify(exactly = 1) { getCatalog(false) }
        io.mockk.verify(exactly = 0) { getCatalog(true) }
    }

    // ---- vertical tabs (P2 net-new) ---------------------------------------

    @Test
    fun `mithai is the default tab and never touches the vertical repository`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        coEvery { verticalRepository.getSnacks() } returns Result.success(emptyList())
        coEvery { verticalRepository.getQsrItems() } returns Result.success(emptyList())
        coEvery { verticalRepository.getMerch() } returns Result.success(emptyList())

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.verticalState.collectInTest(this)
        advanceUntilIdle()

        assertEquals(CatalogVertical.MITHAI, vm.activeVertical.value)
        assertEquals(VerticalListing.Mithai, vm.verticalState.value)
        coVerify(exactly = 0) { verticalRepository.getSnacks() }
        coVerify(exactly = 0) { verticalRepository.getQsrItems() }
        coVerify(exactly = 0) { verticalRepository.getMerch() }
    }

    @Test
    fun `switching to snacks swaps the grid source to the snack list`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        val snack = Snack(id = "sn-1", slug = "mixture", name = "Mixture")
        coEvery { verticalRepository.getSnacks() } returns Result.success(listOf(snack))
        coEvery { verticalRepository.getQsrItems() } returns Result.success(emptyList())
        coEvery { verticalRepository.getMerch() } returns Result.success(emptyList())

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        val emissions = mutableListOf<VerticalListing>()
        // Child of the test scope, not backgroundScope: under the virtual
        // scheduler a backgroundScope subscriber gets the initial value but
        // can miss the post-switch emission even though stateIn's value
        // updates (verified with an isolated combine/flatMapLatest repro).
        // Cancelled before the assertions — the endless collect would
        // otherwise make runTest wait forever.
        val collector = launch { vm.verticalState.collect { emissions += it } }
        advanceUntilIdle()

        vm.onVerticalChange(CatalogVertical.SNACKS)
        advanceUntilIdle()
        collector.cancel()

        assertEquals(CatalogVertical.SNACKS, vm.activeVertical.value)
        // Mithai first (stateIn's initial + marker), then the snacks content —
        // StateFlow conflation may drop the intermediate loading emission, so
        // assert the endpoints, not the count.
        assertEquals(VerticalListing.Mithai, emissions.first())
        assertEquals(VerticalListing.Snacks(items = listOf(snack)), emissions.last())
    }

    @Test
    fun `a failed vertical load surfaces the error state`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        coEvery { verticalRepository.getSnacks() } returns Result.success(emptyList())
        coEvery { verticalRepository.getQsrItems() } returns Result.failure(IOException("offline"))
        coEvery { verticalRepository.getMerch() } returns Result.success(emptyList())

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.verticalState.collectInTest(this)
        advanceUntilIdle()

        vm.onVerticalChange(CatalogVertical.QSR)
        advanceUntilIdle()

        val state = vm.verticalState.value
        assertTrue(state is VerticalListing.Qsr && state.error != null && state.items.isEmpty())
    }

    @Test
    fun `retryVertical re-runs the loader and can recover`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        val merch = Merch(id = "mr-1", slug = "gift-box", name = "Gift Box")
        var fail = true
        coEvery { verticalRepository.getSnacks() } returns Result.success(emptyList())
        coEvery { verticalRepository.getQsrItems() } returns Result.success(emptyList())
        coEvery { verticalRepository.getMerch() } answers {
            if (fail) Result.failure(IOException("offline")) else Result.success(listOf(merch))
        }

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.verticalState.collectInTest(this)
        advanceUntilIdle()

        vm.onVerticalChange(CatalogVertical.MERCH)
        advanceUntilIdle()
        assertTrue(vm.verticalState.value is VerticalListing.Merch && (vm.verticalState.value as VerticalListing.Merch).error != null)

        fail = false
        vm.retryVertical()
        advanceUntilIdle()
        assertEquals(VerticalListing.Merch(items = listOf(merch)), vm.verticalState.value)
    }

    @Test
    fun `the vertical deep-link arg seeds the tab and falls back to mithai`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        coEvery { verticalRepository.getSnacks() } returns Result.success(emptyList())
        coEvery { verticalRepository.getQsrItems() } returns Result.success(emptyList())
        coEvery { verticalRepository.getMerch() } returns Result.success(emptyList())

        val deepLinked = CatalogViewModel(
            getCatalog,
            verticalRepository,
            cartRepository,
            settingsRepository,
            SavedStateHandle(mapOf("vertical" to "merch")),
        )
        deepLinked.verticalState.collectInTest(this)
        advanceUntilIdle()
        assertEquals(CatalogVertical.MERCH, deepLinked.activeVertical.value)

        val bogus = CatalogViewModel(
            getCatalog,
            verticalRepository,
            cartRepository,
            settingsRepository,
            SavedStateHandle(mapOf("vertical" to "nope")),
        )
        bogus.verticalState.collectInTest(this)
        advanceUntilIdle()
        assertEquals(CatalogVertical.MITHAI, bogus.activeVertical.value)
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

    // ---- widened search matcher (parity batch) -----------------------------

    @Test
    fun `query matches the long description`() {
        val wordy = product("p9", "Motichur Ladoo", Product.Family.classic, emptyList())
            .copy(story = "Made the Bikaner way with boondi fried in ghee.")
        assertEquals(listOf(wordy), filterProducts(listOf(wordy, freshList[1]), "boondi", CatalogFilters()))
    }

    @Test
    fun `query matches the family wire value`() {
        val regional = freshList[1] // Mysore Pak, family regional
        assertEquals(listOf(regional), filterProducts(freshList, "regional", CatalogFilters()))
    }

    @Test
    fun `query matches a dietary tag`() {
        // sugar-free lives on p1 (Kaju Katli), eggless only on p2 (Mysore Pak).
        assertEquals(listOf(freshList[0]), filterProducts(freshList, "sugar-free", CatalogFilters()))
        assertEquals(listOf(freshList[1]), filterProducts(freshList, "eggless", CatalogFilters()))
    }

    // ---- sort (parity batch) ------------------------------------------------

    @Test
    fun `featured sort puts flagged rows first, ties by name`() {
        val zFeatured = product("p1", "Zedo", Product.Family.classic, emptyList()).copy(featured = true)
        val aFeatured = product("p2", "Aloo", Product.Family.classic, emptyList()).copy(featured = true)
        val plain = product("p3", "Beta", Product.Family.classic, emptyList())
        assertEquals(
            listOf(aFeatured, zFeatured, plain),
            sortProducts(listOf(plain, zFeatured, aFeatured), CatalogSortOrder.FEATURED),
        )
    }

    @Test
    fun `name sorts compare lowercase both directions`() {
        val b = product("p1", "Beta", Product.Family.classic, emptyList())
        val a = product("p2", "apple", Product.Family.classic, emptyList())
        assertEquals(listOf(a, b), sortProducts(listOf(b, a), CatalogSortOrder.NAME_ASC))
        assertEquals(listOf(b, a), sortProducts(listOf(b, a), CatalogSortOrder.NAME_DESC))
    }

    @Test
    fun `the persisted sort order seeds the choice and changes persist`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)
        every { settingsRepository.catalogSortFlow() } returns flowOf("name_desc")

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.visibleProducts.collectInTest(this)
        advanceUntilIdle()

        assertEquals(CatalogSortOrder.NAME_DESC, vm.sortOrder.value)

        vm.onSortChange(CatalogSortOrder.NAME_ASC)
        advanceUntilIdle()
        coVerify(exactly = 1) { settingsRepository.setCatalogSort("name_asc") }
    }

    @Test
    fun `an unknown persisted sort value falls back to Featured`() {
        assertEquals(CatalogSortOrder.FEATURED, CatalogSortOrder.fromWireValue("bogus"))
        assertEquals(CatalogSortOrder.FEATURED, CatalogSortOrder.fromWireValue(null))
    }

    // ---- cart badge + quick add (parity batch) ------------------------------

    @Test
    fun `badge count sums line quantities, not lines`() {
        val lines = listOf(
            CartItemEntity(productId = "p1", slug = "a", name = "A", quantity = 3, addedAt = 0L),
            CartItemEntity(productId = "p2", slug = "b", name = "B", quantity = 1, addedAt = 1L),
        )
        assertEquals(4, cartBadgeCount(lines))
        assertEquals(0, cartBadgeCount(emptyList()))
    }

    @Test
    fun `badge count tracks the live cart`() = runTest(dispatcher) {
        val table = kotlinx.coroutines.flow.MutableStateFlow(emptyList<CartItemEntity>())
        every { cartRepository.observeItems() } returns table
        every { getCatalog(any()) } returns flowOf(cachedList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        vm.cartCount.collectInTest(this)
        advanceUntilIdle()
        assertEquals(0, vm.cartCount.value)

        table.value = listOf(
            CartItemEntity(productId = "p1", slug = "a", name = "A", quantity = 2, addedAt = 0L),
        )
        advanceUntilIdle()
        assertEquals(2, vm.cartCount.value)
    }

    @Test
    fun `quickAdd writes the base pack as a bare-id line and confirms`() = runTest(dispatcher) {
        every { getCatalog(any()) } returns flowOf(cachedList)

        val vm = CatalogViewModel(getCatalog, verticalRepository, cartRepository, settingsRepository, SavedStateHandle())
        var confirmed = 0
        val collector = launch { vm.quickAdded.collect { confirmed++ } }
        advanceUntilIdle()

        vm.quickAdd(cachedList[0])
        advanceUntilIdle()

        // Bare productId line (pack = null) so a PDP base-pack add merges in.
        coVerify(exactly = 1) { cartRepository.add(cachedList[0], 1, null) }
        assertEquals(1, confirmed)
        collector.cancel()
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
