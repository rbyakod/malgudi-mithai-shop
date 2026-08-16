// apps/android/app/src/test/java/com/mishran/app/ui/home/HomeViewModelTest.kt — P3 parity (admin hero).
//
// JVM tests for the Home ViewModel's hero exposure: the curated carousel
// lands in `hero` once fetched, and a failed/unset fetch leaves it null —
// the screen's condition for keeping the static hero — without disturbing
// the catalog flows. Mirrors StoriesViewModelTest's harness. NOTE:
// source-complete (no SDK).
package com.mishran.app.ui.home

import com.mishran.api.models.HeroSlide
import com.mishran.api.models.Product
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.data.repository.HeroCarousel
import com.mishran.app.data.repository.HeroRepository
import com.mishran.app.data.repository.StoryRepository
import com.mishran.app.data.repository.SupportContact
import com.mishran.app.domain.usecase.GetCatalogUseCase
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.io.IOException

class HomeViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var getCatalog: GetCatalogUseCase
    private lateinit var catalogRepository: CatalogRepository
    private lateinit var storyRepository: StoryRepository
    private lateinit var heroRepository: HeroRepository
    private lateinit var brandRepository: BrandRepository

    private val carousel = HeroCarousel(
        slides = listOf(
            HeroSlide(
                id = "p1",
                vertical = HeroSlide.Vertical.mithai,
                slug = "kaju-katli",
                name = "Kaju Katli",
                priceLabel = "₹720 / 500g",
                imageURL = "https://cdn.example.com/kaju.png",
                imageAlt = "Kaju katli",
            ),
            HeroSlide(
                id = "m1",
                vertical = HeroSlide.Vertical.merch,
                slug = "brass-box",
                name = "Brass Mithai Box",
                imageURL = "https://cdn.example.com/brass.jpg",
                imageAlt = "Brass box",
            ),
        ),
        autoplayMs = 6_000,
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        getCatalog = mockk()
        catalogRepository = mockk()
        storyRepository = mockk()
        heroRepository = mockk()
        brandRepository = mockk()
        // Parity batch: the brand-copy seam — null (offline first run) keeps
        // the screen on its localized fallbacks.
        coEvery { brandRepository.getSupportContact() } returns null
        every { getCatalog.invoke(any()) } returns flowOf(emptyList())
        every { catalogRepository.observeFeatured() } returns flowOf(emptyList())
        every { storyRepository.observeLatest(any()) } returns flowOf(emptyList())
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `a resolved carousel populates hero state`() = runTest(dispatcher) {
        coEvery { heroRepository.getHero() } returns carousel

        val vm = HomeViewModel(getCatalog, catalogRepository, storyRepository, heroRepository, brandRepository)
        vm.hero.collectInTest(this)
        advanceUntilIdle()

        assertEquals(carousel, vm.hero.value)
    }

    @Test
    fun `a failed hero fetch falls back to the static hero (null state) without blocking the catalog`() =
        runTest(dispatcher) {
            coEvery { heroRepository.getHero() } throws IOException("offline")
            every { getCatalog.invoke(any()) } returns flowOf(listOf(product("p1", "Kaju Katli")))

            val vm = HomeViewModel(getCatalog, catalogRepository, storyRepository, heroRepository, brandRepository)
            vm.hero.collectInTest(this)
            vm.products.collectInTest(this)
            advanceUntilIdle()

            assertNull(vm.hero.value) // the screen renders its static hero
            assertEquals(1, vm.products.value.size) // catalog flow unaffected
        }

    @Test
    fun `an unset global (repository collapses to null) keeps hero null`() = runTest(dispatcher) {
        coEvery { heroRepository.getHero() } returns null

        val vm = HomeViewModel(getCatalog, catalogRepository, storyRepository, heroRepository, brandRepository)
        vm.hero.collectInTest(this)
        advanceUntilIdle()

        assertNull(vm.hero.value)
    }

    // ---- brand copy (parity batch) ------------------------------------------

    @Test
    fun `the brand record populates the copy state`() = runTest(dispatcher) {
        coEvery { heroRepository.getHero() } returns null
        val contact = SupportContact(
            whatsappNumber = "+91-98765-43210",
            whatsappDigits = "919876543210",
            brandName = "Mishran Halwai",
            tagline = "Fresh from the karigar daily",
        )
        coEvery { brandRepository.getSupportContact() } returns contact

        val vm = HomeViewModel(getCatalog, catalogRepository, storyRepository, heroRepository, brandRepository)
        vm.brand.collectInTest(this)
        advanceUntilIdle()

        assertEquals(contact, vm.brand.value)
    }

    @Test
    fun `a failed brand fetch keeps the copy state null`() = runTest(dispatcher) {
        coEvery { heroRepository.getHero() } returns null
        coEvery { brandRepository.getSupportContact() } throws IOException("offline")

        val vm = HomeViewModel(getCatalog, catalogRepository, storyRepository, heroRepository, brandRepository)
        vm.brand.collectInTest(this)
        advanceUntilIdle()

        assertNull(vm.brand.value) // the screen renders its localized fallbacks
    }

    private fun product(id: String, name: String): Product = Product(
        id = id,
        slug = name.lowercase().replace(' ', '-'),
        name = name,
        // Only the fields Home slices matter; the rest take contract defaults.
        family = Product.Family.classic,
    )

    /** Keep the WhileSubscribed flows hot for the duration of the test. */
    private fun <T> StateFlow<T>.collectInTest(scope: TestScope) =
        scope.backgroundScope.launch { this@collectInTest.collect { } }
}
