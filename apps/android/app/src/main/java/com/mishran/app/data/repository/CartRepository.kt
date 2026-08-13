// apps/android/app/src/main/java/com/mishran/app/data/repository/CartRepository.kt — Task 10.1.
//
// The cart is local-only in v1 (Room table, no server cart). Adds upsert by
// productId so tapping "Add to cart" twice stacks quantity instead of
// duplicating a line; setQuantity floors at 1 (removal is an explicit action).
// Totals are *estimates* derived from displayPrice labels — the authoritative
// price is whatever the server's cart-validate snapshot says at checkout.
package com.mishran.app.data.repository

import com.mishran.api.models.Product
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.entity.CartItemEntity
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CartRepository @Inject constructor(
    private val cartDao: CartDao,
) {

    /** Live cart lines, oldest first. */
    fun observeItems(): Flow<List<CartItemEntity>> = cartDao.observeItems()

    /** Add a product (stacks quantity when the line already exists). */
    suspend fun add(product: Product, quantity: Int = 1) {
        val existing = cartDao.findByProductId(product.id)?.quantity ?: 0
        cartDao.upsert(product.toCartItem(quantity = existing + quantity))
    }

    /** Set an absolute quantity; values below 1 are normalized to 1. */
    suspend fun setQuantity(productId: String, quantity: Int) {
        val line = cartDao.findByProductId(productId) ?: return
        cartDao.upsert(line.copy(quantity = quantity.coerceAtLeast(1)))
    }

    suspend fun remove(productId: String) = cartDao.delete(productId)

    suspend fun clear() = cartDao.clear()

    suspend fun count(): Int = cartDao.count()
}

/** Snapshot the catalog fields the cart renders; quantity/addedAt are cart-owned. */
private fun Product.toCartItem(quantity: Int): CartItemEntity = CartItemEntity(
    productId = id,
    slug = slug,
    name = name,
    imageUrl = images.orEmpty().firstOrNull(),
    displayPrice = displayPrice,
    quantity = quantity,
    addedAt = System.currentTimeMillis(),
)

/**
 * Parse a paise amount from a display-price label ("₹720 / 500g" → 72000).
 * First run of digits (commas stripped) × 100. Returns null when the label
 * carries no number — the UI then omits the line from the estimated total.
 */
internal fun parsePaise(displayPrice: String?): Long? {
    if (displayPrice == null) return null
    val match = Regex("\\d[\\d,]*").find(displayPrice) ?: return null
    val rupees = match.value.replace(",", "").toLongOrNull() ?: return null
    return rupees * 100
}

/** Estimated cart total in paise; lines without a parseable price contribute 0. */
internal fun estimateTotalPaise(items: List<CartItemEntity>): Long =
    items.sumOf { (parsePaise(it.displayPrice) ?: 0L) * it.quantity }
