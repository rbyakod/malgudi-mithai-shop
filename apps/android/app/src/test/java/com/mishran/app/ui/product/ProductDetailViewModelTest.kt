// apps/android/app/src/test/java/com/mishran/app/ui/product/ProductDetailViewModelTest.kt — Task 9.4 / B11.
//
// JVM unit tests for the detail screen's state machine: Room→network lookup
// mapping onto UiState, quantity stepper bounds, and retry. SavedStateHandle
// is instantiated directly (it is plain Kotlin). B11 adds the reviews suite:
// the wire-page mapping (row cap, hidden remainder, nullable author/body,
// string dates) and the aggregate formatting helpers. NOTE: source-complete
// (no SDK).
package com.mishran.app.ui.product

import androidx.lifecycle.SavedStateHandle
import com.mishran.api.models.Product
import com.mishran.api.models.ServiceableResponse
import com.mishran.app.data.remote.api.ReviewsResponse
import com.mishran.app.data.repository.AddressRepository
import com.mishran.app.data.repository.BrandRepository
import com.mishran.app.data.repository.CartRepository
import com.mishran.app.data.repository.CatalogRepository
import com.mishran.app.data.repository.ReviewRepository
import com.mishran.app.data.repository.SettingsRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ProductDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()
    private lateinit var repository: CatalogRepository
    private lateinit var cartRepository: CartRepository
    private lateinit var addressRepository: AddressRepository
    private lateinit var settingsRepository: SettingsRepository
    private lateinit var brandRepository: BrandRepository
    private lateinit var reviewRepository: ReviewRepository

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
        addressRepository = mockk()
        settingsRepository = mockk()
        brandRepository = mockk()
        reviewRepository = mockk()
        // Parity batch: both init seams answer "nothing cached" by default,
        // and the product lookup answers the happy path — per-test stubs
        // recorded later take precedence in mockk. B11: no reviews by default.
        // iOS PDP parity: no same-family siblings by default (rail hidden).
        coEvery { repository.getProduct(any()) } returns product
        coEvery { settingsRepository.deliveryCheck() } returns null
        coEvery { settingsRepository.setDeliveryCheck(any()) } returns Unit
        coEvery { brandRepository.getSupportContact() } returns null
        coEvery { reviewRepository.getProductReviews(any(), any()) } returns null
        coEvery { repository.getFamilySiblings(any(), any()) } returns emptyList()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(slug: String = "kaju-katli") = ProductDetailViewModel(
        repository,
        cartRepository,
        addressRepository,
        settingsRepository,
        brandRepository,
        reviewRepository,
        SavedStateHandle(mapOf("slug" to slug)),
    )

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

    // ---- iOS PDP parity: sticky buy bar -------------------------------------

    @Test
    fun `the sticky stepper drives the same quantity the cart write sees`() =
        runTest(dispatcher) {
            // The sticky bar's stepper and Add-to-cart call the SAME ViewModel
            // functions as the in-content module — bump via the sticky path,
            // then verify the write carries the bumped quantity.
            coEvery { repository.getProduct(any()) } returns product
            coEvery { cartRepository.add(any(), any(), any()) } returns Unit

            val vm = viewModel()
            advanceUntilIdle()

            var added = 0
            val collector = launch { vm.added.collect { added++ } }
            advanceUntilIdle()

            vm.incrementQuantity() // sticky bar's "+"
            vm.incrementQuantity()
            vm.decrementQuantity() // sticky bar's "—" (floored at 1 like the in-content one)
            vm.addToCart(null) // sticky bar's Add to cart
            advanceUntilIdle()

            assertEquals(1, added)
            coVerify(exactly = 1) { cartRepository.add(product, 2, null) }
            collector.cancel()
        }

    @Test
    fun `sticky bar quantity line tracks the stepper and hides without a price`() {
        coEvery { repository.getProduct(any()) } returns product

        val vm = viewModel()
        vm.incrementQuantity()
        vm.incrementQuantity()

        // "qty × price" off the live VM state, as the bar renders it.
        assertEquals("3 × ₹920 / 250g", stickyQuantityLine(vm.quantity.value, "₹920 / 250g"))
        assertNull(stickyQuantityLine(vm.quantity.value, product.displayPrice))
    }

    // ---- Parity batch: "Check delivery" ----------------------------------

    @Test
    fun `a persisted snapshot restores the pincode and result without a refetch`() =
        runTest(dispatcher) {
            coEvery { settingsRepository.deliveryCheck() } returns
                DeliveryCheckSnapshot("110001", "fresh", "New Delhi", 0).encode()

            val vm = viewModel()
            advanceUntilIdle()

            assertEquals("110001", vm.pincode.value)
            val state = vm.deliveryCheck.value
            assertTrue(state is DeliveryCheckState.Serviceable)
            state as DeliveryCheckState.Serviceable
            assertEquals("fresh", state.tier)
            assertEquals("New Delhi", state.city)
            coVerify(exactly = 0) { addressRepository.checkServiceability(any()) }
        }

    @Test
    fun `a malformed pincode flips to Invalid without a request`() = runTest(dispatcher) {
        val vm = viewModel()
        advanceUntilIdle()

        vm.onPincodeChange("1234")
        vm.checkDelivery()
        advanceUntilIdle()

        assertTrue(vm.deliveryCheck.value is DeliveryCheckState.Invalid)
        coVerify(exactly = 0) { addressRepository.checkServiceability(any()) }
    }

    @Test
    fun `a serviceable answer renders the tier, city and SLA, and persists`() =
        runTest(dispatcher) {
            coEvery { addressRepository.checkServiceability("110001") } returns
                ServiceableResponse(serviceable = true, tier = "shelf", city = "New Delhi", slaDays = 3)

            val vm = viewModel()
            advanceUntilIdle()

            vm.onPincodeChange("110001")
            vm.checkDelivery()
            advanceUntilIdle()

            val state = vm.deliveryCheck.value as DeliveryCheckState.Serviceable
            assertEquals("110001", state.pincode)
            assertEquals("shelf", state.tier)
            assertEquals("New Delhi", state.city)
            assertEquals(3, state.slaDays)
            coVerify(exactly = 1) {
                settingsRepository.setDeliveryCheck(
                    DeliveryCheckSnapshot("110001", "shelf", "New Delhi", 3).encode(),
                )
            }
        }

    @Test
    fun `a not-serviceable answer is surfaced, never persisted`() = runTest(dispatcher) {
        coEvery { addressRepository.checkServiceability("700001") } returns
            ServiceableResponse(serviceable = false)

        val vm = viewModel()
        advanceUntilIdle()

        vm.onPincodeChange("700001")
        vm.checkDelivery()
        advanceUntilIdle()

        assertEquals(DeliveryCheckState.NotServiceable("700001"), vm.deliveryCheck.value)
        coVerify(exactly = 0) { settingsRepository.setDeliveryCheck(any()) }
    }

    @Test
    fun `an unreachable serviceability lookup degrades to Error`() = runTest(dispatcher) {
        coEvery { addressRepository.checkServiceability(any()) } returns null

        val vm = viewModel()
        advanceUntilIdle()

        vm.onPincodeChange("110001")
        vm.checkDelivery()
        advanceUntilIdle()

        assertEquals(DeliveryCheckState.Error, vm.deliveryCheck.value)
    }

    @Test
    fun `pincode entry is clamped to six digits`() {
        val vm = viewModel()
        vm.onPincodeChange("1100019")
        assertEquals("110001", vm.pincode.value)
    }

    // ---- Pure helpers (directly, no harness) ------------------------------

    @Test
    fun `isServiceablePincode accepts six digits with a non-zero lead`() {
        assertTrue(isServiceablePincode("110001"))
        assertFalse(isServiceablePincode("011001")) // leading zero
        assertFalse(isServiceablePincode("11001")) // five digits
        assertFalse(isServiceablePincode("11000a")) // non-digit
        assertFalse(isServiceablePincode(""))
    }

    @Test
    fun `snapshot encode and decode round-trip`() {
        val snapshot = DeliveryCheckSnapshot("110001", "fresh", "New Delhi", null)
        assertEquals("110001|fresh|New Delhi|", snapshot.encode())
        assertEquals(snapshot, DeliveryCheckSnapshot.decode(snapshot.encode()))
    }

    @Test
    fun `snapshot decode rejects malformed payloads`() {
        assertEquals(null, DeliveryCheckSnapshot.decode("110001|fresh")) // too few parts
        assertEquals(null, DeliveryCheckSnapshot.decode("|fresh|city|2")) // empty pincode
        assertEquals(null, DeliveryCheckSnapshot.decode("110001||city|2")) // empty tier
    }

    @Test
    fun `deliveryDaysLabel prefers same-day for fresh, SLA days otherwise`() {
        assertEquals("same-day", deliveryDaysLabel("fresh", 0, "same-day"))
        assertEquals("3 days", deliveryDaysLabel("shelf", 3, "same-day"))
        assertEquals("", deliveryDaysLabel("shelf", null, "same-day"))
    }

    @Test
    fun `buildProductWhatsAppMessage enumerates pack, price and quantity`() {
        val oneKg = PackSize(label = "1 kg", priceLabel = "₹1,440 / 1 kg", grams = 1000)
        val message = buildProductWhatsAppMessage(product.copy(displayPrice = "₹720 / 500g"), oneKg, 2)
        assertTrue(message.contains("Kaju Katli"))
        assertTrue(message.contains("1 kg · ₹1,440 / 1 kg"))
        assertTrue(message.contains("Quantity: 2"))
    }

    @Test
    fun `buildProductWhatsAppMessage falls back to the display price without a pack`() {
        val message = buildProductWhatsAppMessage(product.copy(displayPrice = "₹720 / 500g"), null, 1)
        assertTrue(message.contains("₹720 / 500g"))
        assertTrue(message.contains("Quantity: 1"))
    }

    // ---- B11: customer reviews ---------------------------------------------

    @Test
    fun `reviews load once the product resolves and surface the mapped page`() =
        runTest(dispatcher) {
            coEvery { reviewRepository.getProductReviews("p1", any()) } returns reviewPage()

            val vm = viewModel()
            advanceUntilIdle()

            coVerify(exactly = 1) { reviewRepository.getProductReviews("p1", any()) }
            val reviews = vm.reviews.value
            assertTrue(reviews != null)
            assertEquals(2, reviews?.rows?.size)
        }

    @Test
    fun `a review fetch failure leaves the section hidden`() = runTest(dispatcher) {
        coEvery { reviewRepository.getProductReviews(any(), any()) } returns null

        val vm = viewModel()
        advanceUntilIdle()

        assertNull(vm.reviews.value)
    }

    // ---- iOS PDP parity: same-family cross-sell rail -----------------------

    @Test
    fun `cross-sell loads once the product resolves and surfaces the siblings`() =
        runTest(dispatcher) {
            val siblings = listOf(
                sibling("motichoor-ladoo"),
                sibling("besan-ladoo"),
            )
            coEvery {
                repository.getFamilySiblings(Product.Family.classic, "kaju-katli")
            } returns siblings

            val vm = viewModel()
            advanceUntilIdle()

            assertEquals(siblings, vm.crossSell.value)
            coVerify(exactly = 1) { repository.getFamilySiblings(Product.Family.classic, "kaju-katli") }
        }

    @Test
    fun `no siblings keeps the rail hidden without an error`() = runTest(dispatcher) {
        val vm = viewModel()
        advanceUntilIdle()

        assertEquals(emptyList<Product>(), vm.crossSell.value)
    }

    @Test
    fun `a sibling lookup failure degrades to an empty rail`() = runTest(dispatcher) {
        coEvery { repository.getFamilySiblings(any(), any()) } throws java.io.IOException("offline")

        val vm = viewModel()
        advanceUntilIdle()

        // The PDP still renders — the rail hides, never an error surface.
        assertTrue(vm.state.value is UiState.Success)
        assertEquals(emptyList<Product>(), vm.crossSell.value)
    }

    /** A minimal same-family sibling for rail assertions. */
    private fun sibling(slug: String) = Product(
        id = slug,
        slug = slug,
        name = slug.replace('-', ' '),
        family = Product.Family.classic,
    )

    @Test
    fun `toReviewsUi maps rows with nullable author, string date and verified stamp`() {
        val ui = reviewPage().toReviewsUi()!!

        assertEquals(4.5, ui.averageRating, 0.0001)
        assertEquals(2, ui.total)
        assertEquals(0, ui.hiddenCount)
        val named = ui.rows[0]
        assertEquals("Meera", named.authorDisplayName)
        assertEquals("17 Aug 2026", named.dateLabel)
        assertEquals(5, named.rating)
        assertEquals("Silvertop quality.", named.body)
        assertTrue(named.verifiedPurchase)
        // Anonymous author stays null so the UI renders the localized label.
        assertNull(ui.rows[1].authorDisplayName)
        assertFalse(ui.rows[1].verifiedPurchase)
        // A null body (wire-nullable) maps to the empty string.
        assertEquals("", ui.rows[1].body)
    }

    @Test
    fun `toReviewsUi caps rows at five and folds the surplus into hiddenCount`() {
        val page = ReviewsResponse.Page(
            items = (1..7).map { index ->
                publicReview(id = "r$index", createdAt = "2026-08-1${index % 10}T09:00:00Z")
            },
            averageRating = 3.7,
            total = 12,
            page = 1,
            pageSize = 7,
        )

        val ui = page.toReviewsUi()!!

        assertEquals(5, ui.rows.size)
        assertEquals(7, ui.hiddenCount)
        assertEquals(12, ui.total)
    }

    @Test
    fun `toReviewsUi renders nothing for zero reviews or a missing aggregate`() {
        assertNull(
            ReviewsResponse.Page(
                items = emptyList(),
                averageRating = null,
                total = 0,
                page = 1,
                pageSize = 5,
            ).toReviewsUi(),
        )
        assertNull(
            ReviewsResponse.Page(
                items = listOf(publicReview()),
                averageRating = null,
                total = 1,
                page = 1,
                pageSize = 5,
            ).toReviewsUi(),
        )
    }

    @Test
    fun `reviewDateLabel parses ISO offsets and hides unparseable dates`() {
        assertEquals("17 Aug 2026", reviewDateLabel("2026-08-17T09:30:00Z"))
        assertEquals("17 Aug 2026", reviewDateLabel("2026-08-17T15:00:00+05:30"))
        assertEquals("", reviewDateLabel("not-a-date"))
    }

    @Test
    fun `formatReviewRating always renders one decimal`() {
        assertEquals("4.5", formatReviewRating(4.5))
        assertEquals("4.0", formatReviewRating(4.0))
        assertEquals("5.0", formatReviewRating(5.0))
    }

    private fun reviewPage() = ReviewsResponse.Page(
        items = listOf(
            publicReview(
                id = "r1",
                author = "Meera",
                rating = 5,
                body = "Silvertop quality.",
                verified = true,
                createdAt = "2026-08-17T09:30:00Z",
            ),
            publicReview(
                id = "r2",
                author = null,
                rating = 4,
                body = null,
                verified = false,
                createdAt = "2026-08-15T18:00:00Z",
            ),
        ),
        averageRating = 4.5,
        total = 2,
        page = 1,
        pageSize = 5,
    )

    private fun publicReview(
        id: String = "r1",
        author: String? = "Meera",
        rating: Int = 5,
        body: String? = "Fresh and lovely.",
        verified: Boolean = true,
        createdAt: String = "2026-08-17T09:30:00Z",
    ) = ReviewsResponse.Item(
        id = id,
        rating = rating,
        authorDisplayName = author,
        verifiedPurchase = verified,
        createdAt = createdAt,
        body = body,
    )
}
