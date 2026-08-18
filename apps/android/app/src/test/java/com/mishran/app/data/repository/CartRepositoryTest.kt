// apps/android/app/src/test/java/com/mishran/app/data/repository/CartRepositoryTest.kt — Task 10.1 / P1 parity / parity batch (reorder) / B9.
//
// JVM unit tests for the cart repository + the price-estimation helpers,
// including the pack-scoped adds (P1 parity): base pack keeps the bare
// product id, derived packs key "${productId}:${label}". The reorder adds
// (parity batch) assert the same id contract straight from order-line args.
// B9 adds the server-estimate seam: the request mapping (base ids + pack
// labels, quantities summed per group) and the never-throw contract. The DAO
// is mocked with an in-memory map keyed by productId so quantity stacking is
// exercised through the real repository logic. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.CartEstimate
import com.mishran.api.models.CartEstimatePost200Response
import com.mishran.api.models.CartItem
import com.mishran.api.models.Product
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.ui.product.PackSize
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CartRepositoryTest {

    private lateinit var cartDao: CartDao
    private lateinit var api: MishranApi
    private lateinit var repository: CartRepository

    private val table = mutableMapOf<String, CartItemEntity>()

    private val kajuKatli = Product(
        id = "p1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = Product.Family.classic,
        displayPrice = "₹720 / 500g",
        images = listOf("https://cdn.mishran.in/kaju-katli.jpg"),
    )

    @Before
    fun setUp() {
        cartDao = mockk()
        api = mockk()
        repository = CartRepository(cartDao, api)

        every { cartDao.observeItems() } answers { flowOf(table.values.sortedBy { it.addedAt }) }
        coEvery { cartDao.findByProductId(any()) } answers { table[firstArg<String>()] }
        val upsertSlot = slot<CartItemEntity>()
        coEvery { cartDao.upsert(capture(upsertSlot)) } coAnswers {
            table[upsertSlot.captured.productId] = upsertSlot.captured
        }
        coEvery { cartDao.delete(any()) } coAnswers { table.remove(firstArg<String>()); Unit }
        coEvery { cartDao.clear() } coAnswers { table.clear() }
        coEvery { cartDao.count() } answers { table.size }
    }

    @Test
    fun `add inserts a new line with quantity and snapshot fields`() = runTest {
        repository.add(kajuKatli, quantity = 2)

        val line = table.getValue("p1")
        assertEquals("kaju-katli", line.slug)
        assertEquals(2, line.quantity)
        assertEquals("₹720 / 500g", line.displayPrice)
        assertEquals("https://cdn.mishran.in/kaju-katli.jpg", line.imageUrl)
    }

    @Test
    fun `add stacks quantity on an existing line instead of duplicating`() = runTest {
        repository.add(kajuKatli, quantity = 1)
        repository.add(kajuKatli, quantity = 2)

        assertEquals(1, table.size)
        assertEquals(3, table.getValue("p1").quantity)
    }

    @Test
    fun `a quick add (pack = null) merges into an existing bare-id line`() = runTest {
        // PDP base-pack add first, then the catalog grid's quick add: both
        // key the bare product id, so the quantities stack — one line.
        repository.add(kajuKatli, quantity = 2, pack = null)
        repository.add(kajuKatli, quantity = 1, pack = null)

        assertEquals(1, table.size)
        assertEquals(3, table.getValue("p1").quantity)
        assertEquals(null, table.getValue("p1").packLabel)
    }

    @Test
    fun `setQuantity normalizes below-one values to one`() = runTest {
        repository.add(kajuKatli, quantity = 3)
        repository.setQuantity("p1", 0)

        assertEquals(1, table.getValue("p1").quantity)
    }

    @Test
    fun `setQuantity ignores unknown products`() = runTest {
        repository.setQuantity("missing", 5)
        assertTrue(table.isEmpty())
    }

    @Test
    fun `remove deletes only the targeted line`() = runTest {
        repository.add(kajuKatli, quantity = 1)
        repository.add(kajuKatli.copy(id = "p2", slug = "mysore-pak", name = "Mysore Pak"), 1)

        repository.remove("p1")

        assertEquals(setOf("p2"), table.keys)
    }

    @Test
    fun `clear wipes the table`() = runTest {
        repository.add(kajuKatli, quantity = 1)
        repository.clear()

        coVerify(exactly = 1) { cartDao.clear() }
        assertEquals(0, repository.count())
    }

    // ---- P1 parity: pack-scoped adds --------------------------------------

    @Test
    fun `a derived pack keys its line by product id and label`() = runTest {
        val oneKg = PackSize(label = "1 kg", priceLabel = "₹1,440 / 1 kg", grams = 1000)
        repository.add(kajuKatli, quantity = 1, pack = oneKg)

        val line = table.getValue("p1:1 kg")
        assertEquals("₹1,440 / 1 kg", line.displayPrice)
        assertEquals("1 kg", line.packLabel)
        assertEquals(1, line.quantity)
    }

    @Test
    fun `the base pack keeps the bare product id so old lines still merge`() = runTest {
        val base = PackSize(label = "500g", priceLabel = "₹720 / 500g", grams = 500)
        repository.add(kajuKatli, quantity = 1, pack = base)

        // Bare id, verbatim price — byte-for-byte the pre-pack shape except
        // the decorative packLabel.
        val line = table.getValue("p1")
        assertEquals("₹720 / 500g", line.displayPrice)
        assertEquals("500g", line.packLabel)
        assertEquals(1, table.size)
    }

    @Test
    fun `a pack add stacks quantity on its own line without touching the base`() = runTest {
        val oneKg = PackSize(label = "1 kg", priceLabel = "₹1,440 / 1 kg", grams = 1000)
        repository.add(kajuKatli, quantity = 1)
        repository.add(kajuKatli, quantity = 1, pack = oneKg)
        repository.add(kajuKatli, quantity = 2, pack = oneKg)

        assertEquals(1, table.getValue("p1").quantity)
        assertEquals(3, table.getValue("p1:1 kg").quantity)
        assertEquals(setOf("p1", "p1:1 kg"), table.keys)
    }

    // ---- Parity batch: reorder (addPackLine) ------------------------------

    @Test
    fun `a reorder line with a pack label keys product id and label`() = runTest {
        repository.addPackLine(
            productId = "p1",
            slug = "kaju-katli",
            name = "Kaju Katli",
            imageUrl = "https://cdn.mishran.in/kaju-katli.jpg",
            packLabel = "500g",
            unitPricePaise = 72000,
            unit = "500g",
            quantity = 2,
        )

        val line = table.getValue("p1:500g")
        assertEquals(2, line.quantity)
        assertEquals("500g", line.packLabel)
        assertEquals("Kaju Katli", line.name)
        assertEquals("₹720 / 500g", line.displayPrice)
        // The catalog-shaped label must round-trip through the estimate parser.
        assertEquals(72000L, parsePaise(line.displayPrice))
    }

    @Test
    fun `a reorder line without a pack label keeps the bare product id`() = runTest {
        repository.addPackLine(
            productId = "p1",
            slug = "kaju-katli",
            name = "Kaju Katli",
            imageUrl = null,
            packLabel = null,
            unitPricePaise = 18000,
            unit = "250g",
            quantity = 1,
        )

        val line = table.getValue("p1")
        assertEquals(1, line.quantity)
        assertEquals(null, line.packLabel)
        assertEquals("₹180 / 250g", line.displayPrice)
    }

    @Test
    fun `a reorder line stacks quantity on the existing line instead of duplicating`() = runTest {
        repository.addPackLine(
            productId = "p1", slug = "kaju-katli", name = "Kaju Katli",
            imageUrl = null, packLabel = "500g", unitPricePaise = 72000,
            unit = "500g", quantity = 2,
        )
        // The same line reordered again — plus a base-pack add of the same
        // product, which must NOT merge into the pack line.
        repository.addPackLine(
            productId = "p1", slug = "kaju-katli", name = "Kaju Katli",
            imageUrl = null, packLabel = "500g", unitPricePaise = 72000,
            unit = "500g", quantity = 3,
        )
        repository.addPackLine(
            productId = "p1", slug = "kaju-katli", name = "Kaju Katli",
            imageUrl = null, packLabel = null, unitPricePaise = 72000,
            unit = "500g", quantity = 1,
        )

        assertEquals(5, table.getValue("p1:500g").quantity)
        assertEquals(1, table.getValue("p1").quantity)
        assertEquals(setOf("p1", "p1:500g"), table.keys)
    }

    @Test
    fun `a reorder line never exceeds the quantity backstop`() = runTest {
        repository.addPackLine(
            productId = "p1", slug = "kaju-katli", name = "Kaju Katli",
            imageUrl = null, packLabel = null, unitPricePaise = 72000,
            unit = null, quantity = 15,
        )
        repository.addPackLine(
            productId = "p1", slug = "kaju-katli", name = "Kaju Katli",
            imageUrl = null, packLabel = null, unitPricePaise = 72000,
            unit = null, quantity = 15,
        )

        assertEquals(MAX_LINE_QUANTITY, table.getValue("p1").quantity)
    }

    @Test
    fun `packLinePriceLabel renders catalog-shaped labels`() {
        assertEquals("₹720 / 500g", packLinePriceLabel(72000, "500g"))
        assertEquals("₹1,440", packLinePriceLabel(144000, null))
        // Indian grouping, blank unit dropped, sub-rupee remainder kept.
        assertEquals("₹1,08,432", packLinePriceLabel(10843200, "  "))
        assertEquals("₹12.50", packLinePriceLabel(1250, null))
    }

    // ---- parsePaise / estimateTotalPaise (pure functions) -----------------

    @Test
    fun `parsePaise reads the first number and converts to paise`() {
        assertEquals(72000L, parsePaise("₹720 / 500g"))
        assertEquals(120000L, parsePaise("₹1,200"))
        assertEquals(4500L, parsePaise("Rs. 45"))
    }

    @Test
    fun `parsePaise returns null on unparseable labels`() {
        assertNull(parsePaise(null))
        assertNull(parsePaise("Price on request"))
        assertNull(parsePaise(""))
    }

    @Test
    fun `estimateTotalPaise multiplies unit price by quantity and sums`() {
        val items = listOf(
            line("p1", "₹720 / 500g", quantity = 2),   // 144000
            line("p2", "₹1,200", quantity = 1),        // 120000
        )
        assertEquals(264000L, estimateTotalPaise(items))
    }

    @Test
    fun `unpriced lines contribute zero but do not break the total`() {
        val items = listOf(
            line("p1", "₹500", quantity = 1),
            line("p2", null, quantity = 3),
        )
        assertEquals(50000L, estimateTotalPaise(items))
    }

    // ---- B9: server estimate (POST /cart/estimate) -------------------------

    @Test
    fun `estimate unwraps the data envelope and returns the CartEstimate`() = runTest {
        val estimate = cartEstimate()
        coEvery { api.estimateCart(any()) } returns CartEstimatePost200Response(estimate)

        assertEquals(estimate, repository.estimate(table.values.toList(), pincode = "110001"))
    }

    @Test
    fun `estimate maps lines to base ids with pack labels and sums per group`() = runTest {
        val requestSlot = slot<com.mishran.api.models.CartEstimateRequest>()
        coEvery { api.estimateCart(capture(requestSlot)) } returns
            CartEstimatePost200Response(cartEstimate())

        repository.estimate(
            items = listOf(
                line("p1", "₹720 / 500g", quantity = 2, packLabel = "500g"),
                line("p1:1 kg", "₹1,440 / 1 kg", quantity = 1, packLabel = "1 kg"),
                line("p1:1 kg", "₹1,440 / 1 kg", quantity = 2, packLabel = "1 kg"),
                line("p2", "₹180 / 250g", quantity = 1, packLabel = null),
            ),
            pincode = "110001",
        )

        val request = requestSlot.captured
        assertEquals("110001", request.pincode)
        assertEquals(
            listOf(
                CartItem(productId = "p1", quantity = 2, packLabel = "500g"),
                CartItem(productId = "p1", quantity = 3, packLabel = "1 kg"),
                CartItem(productId = "p2", quantity = 1, packLabel = null),
            ),
            request.items,
        )
    }

    @Test
    fun `estimate sends a null pincode when none was persisted`() = runTest {
        val requestSlot = slot<com.mishran.api.models.CartEstimateRequest>()
        coEvery { api.estimateCart(capture(requestSlot)) } returns
            CartEstimatePost200Response(cartEstimate())

        repository.estimate(items = listOf(line("p2", "₹180", quantity = 1)), pincode = null)

        assertNull(requestSlot.captured.pincode)
    }

    @Test
    fun `estimate collapses to null on any failure so checkout never blocks`() = runTest {
        coEvery { api.estimateCart(any()) } throws java.io.IOException("offline")

        assertNull(repository.estimate(table.values.toList(), pincode = "110001"))
    }

    @Test
    fun `estimateItems keys off the base id and the pack label`() {
        val items = listOf(
            line("p1", "₹720 / 500g", quantity = 2, packLabel = "500g"),
            line("p1:1 kg", "₹1,440 / 1 kg", quantity = 1, packLabel = "1 kg"),
            line("p1:1 kg", "₹1,440 / 1 kg", quantity = 4, packLabel = "1 kg"),
            line("p2", "₹180", quantity = 1, packLabel = null),
        )
        assertEquals(
            listOf(
                CartItem(productId = "p1", quantity = 2, packLabel = "500g"),
                CartItem(productId = "p1", quantity = 5, packLabel = "1 kg"),
                CartItem(productId = "p2", quantity = 1, packLabel = null),
            ),
            estimateItems(items),
        )
    }

    @Test
    fun `baseCartProductId strips the pack suffix and keeps bare ids`() {
        assertEquals("p1", baseCartProductId("p1:500g"))
        assertEquals("p1", baseCartProductId("p1"))
    }

    private fun cartEstimate() = CartEstimate(
        itemsTotalInPaise = 144000,
        deliveryFeeInPaise = 4900,
        discountInPaise = 0,
        totalInPaise = 148900,
        pincodeTier = "shelf",
        freeDeliveryThresholdInPaise = 200000,
        freeDeliveryEligible = false,
    )

    private fun line(
        productId: String,
        displayPrice: String?,
        quantity: Int,
        packLabel: String? = null,
    ) = CartItemEntity(
        productId = productId,
        slug = "slug-$productId",
        name = "Sweet $productId",
        imageUrl = null,
        displayPrice = displayPrice,
        quantity = quantity,
        packLabel = packLabel,
        addedAt = 0L,
    )
}
