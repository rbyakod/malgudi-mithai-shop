// apps/android/app/src/test/java/com/mishran/app/data/repository/CartRepositoryTest.kt — Task 10.1.
//
// JVM unit tests for the cart repository + the price-estimation helpers.
// The DAO is mocked with an in-memory map keyed by productId so quantity
// stacking is exercised through the real repository logic. NOTE:
// source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.Product
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.entity.CartItemEntity
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
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
        repository = CartRepository(cartDao)

        every { cartDao.observeItems() } answers { flowOf(table.values.sortedBy { it.addedAt }) }
        coEvery { cartDao.findByProductId(any()) } answers { table[firstArg<String>()] }
        val upsertSlot = slot<CartItemEntity>()
        coEvery { cartDao.upsert(capture(upsertSlot)) } coAnswers {
            table[upsertSlot.captured.productId] = upsertSlot.captured
        }
        coEvery { cartDao.delete(any()) } coAnswers { table.remove(firstArg<String>()); Unit }
        coEvery { cartDao.clear() } just Runs
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
            line("₹720 / 500g", quantity = 2),   // 144000
            line("₹1,200", quantity = 1),        // 120000
        )
        assertEquals(264000L, estimateTotalPaise(items))
    }

    @Test
    fun `unpriced lines contribute zero but do not break the total`() {
        val items = listOf(
            line("₹500", quantity = 1),
            line(null, quantity = 3),
        )
        assertEquals(50000L, estimateTotalPaise(items))
    }

    private fun line(displayPrice: String?, quantity: Int) = CartItemEntity(
        productId = "p-$quantity-$displayPrice",
        slug = "slug",
        name = "Sweet",
        imageUrl = null,
        displayPrice = displayPrice,
        quantity = quantity,
        addedAt = 0L,
    )
}
