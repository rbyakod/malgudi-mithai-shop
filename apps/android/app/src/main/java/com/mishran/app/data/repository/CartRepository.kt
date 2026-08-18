// apps/android/app/src/main/java/com/mishran/app/data/repository/CartRepository.kt — Task 10.1 / P1 parity (pack sizes).
//
// The cart is local-only in v1 (Room table, no server cart). Adds upsert by
// line id so tapping "Add to cart" twice stacks quantity instead of
// duplicating a line; setQuantity floors at 1 (removal is an explicit action).
// Totals are *estimates* derived from displayPrice labels — the authoritative
// price is whatever the server's cart-validate snapshot says at checkout.
//
// P1 parity (pack sizes): `add` takes the selected PDP pack. The BASE pack
// (priceLabel == the product's verbatim displayPrice) keeps the bare
// productId so pre-pack cart lines keep merging, exactly like the web
// BuyModule; a DERIVED pack keys itself `${productId}:${label}` so sizes
// stack as separate lines. The pack's estimated priceLabel becomes the
// line's displayPrice so the estimated total scales with the chosen size.
//
// Parity batch (reorder): `addPackLine` re-inserts an ORDER line back into
// the cart without resolving a Product — the order item already carries every
// field the line renders (name, image, unit price, pack label). Its id
// follows the same rule verbatim, so a reordered line merges with the line
// that created it instead of duplicating it.
//
// B9 (cart estimates): `estimate` prices the cart on the server via the
// PUBLIC POST /cart/estimate — guests included, nothing persisted. It is the
// authoritative display number while browsing; the local label-scrape math
// below (parsePaise / estimateTotalPaise) stays as the clearly-marked
// OFFLINE-FAILURE FALLBACK the UI silently degrades to when the estimate
// call fails (never blocks checkout).
package com.mishran.app.data.repository

import com.mishran.api.models.CartEstimate
import com.mishran.api.models.CartEstimateRequest
import com.mishran.api.models.CartItem
import com.mishran.api.models.Product
import com.mishran.app.data.local.dao.CartDao
import com.mishran.app.data.local.entity.CartItemEntity
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.ui.product.PackSize
import com.mishran.app.ui.product.groupIndianDigits
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

/** Per-line quantity backstop — the same cap the PDP stepper enforces. */
const val MAX_LINE_QUANTITY = 20

@Singleton
class CartRepository @Inject constructor(
    private val cartDao: CartDao,
    private val api: MishranApi,
) {

    /** Live cart lines, oldest first. */
    fun observeItems(): Flow<List<CartItemEntity>> = cartDao.observeItems()

    /**
     * Add a product (stacks quantity when the line already exists). [pack] is
     * the selected PDP chip, if any — see the file header for the line-id rule.
     */
    suspend fun add(product: Product, quantity: Int = 1, pack: PackSize? = null) {
        val line = product.toCartItem(quantity = quantity, pack = pack)
        val existing = cartDao.findByProductId(line.productId)?.quantity ?: 0
        cartDao.upsert(line.copy(quantity = existing + quantity))
    }

    /**
     * Reorder write: insert an order line back into the cart WITHOUT
     * resolving a Product — the order item already carries everything the
     * line renders. The line id follows the file-header rule verbatim: a
     * non-null [packLabel] keys itself `${productId}:${packLabel}`, null
     * keeps the bare productId, so the reordered line merges with the line
     * that created it. Quantity stacks on an existing line, capped at
     * [MAX_LINE_QUANTITY].
     */
    suspend fun addPackLine(
        productId: String,
        slug: String,
        name: String,
        imageUrl: String?,
        packLabel: String?,
        unitPricePaise: Long,
        unit: String? = null,
        quantity: Int = 1,
    ) {
        val lineId = packLabel?.let { "$productId:$it" } ?: productId
        val existing = cartDao.findByProductId(lineId)?.quantity ?: 0
        cartDao.upsert(
            CartItemEntity(
                productId = lineId,
                slug = slug,
                name = name,
                imageUrl = imageUrl,
                displayPrice = packLinePriceLabel(unitPricePaise, unit),
                quantity = (existing + quantity).coerceAtMost(MAX_LINE_QUANTITY),
                packLabel = packLabel,
                addedAt = System.currentTimeMillis(),
            ),
        )
    }

    /** Set an absolute quantity; values below 1 are normalized to 1. */
    suspend fun setQuantity(productId: String, quantity: Int) {
        val line = cartDao.findByProductId(productId) ?: return
        cartDao.upsert(line.copy(quantity = quantity.coerceAtLeast(1)))
    }

    suspend fun remove(productId: String) = cartDao.delete(productId)

    suspend fun clear() = cartDao.clear()

    suspend fun count(): Int = cartDao.count()

    /**
     * B9: server-priced cart estimate (POST /cart/estimate — public, works
     * for signed-out guests). [pincode] is the persisted PDP delivery-check
     * pincode when one exists, else null (the server then answers a null tier
     * and the UI keeps its no-pincode copy). Returns null on ANY failure —
     * transport, stale lines, rate limit — so the caller silently falls back
     * to the local label-scrape estimate and the checkout flow never blocks.
     */
    suspend fun estimate(items: List<CartItemEntity>, pincode: String?): CartEstimate? = try {
        api.estimateCart(
            CartEstimateRequest(
                items = estimateItems(items),
                pincode = pincode,
            ),
        ).data
    } catch (e: Exception) {
        null
    }
}

/**
 * Snapshot the catalog fields the cart renders; quantity/addedAt are
 * cart-owned. A derived pack rewrites the line id + displayPrice (its
 * estimate); the base pack / no-pack path is byte-for-byte the legacy shape.
 */
internal fun Product.toCartItem(quantity: Int, pack: PackSize? = null): CartItemEntity {
    // Only a DERIVED pack (priceLabel ≠ the product's verbatim displayPrice)
    // suffixed the id; the base chip / pack-less add keeps the bare id.
    val derivedId = pack
        ?.takeIf { it.priceLabel != displayPrice }
        ?.let { "$id:${it.label}" }
    return CartItemEntity(
        productId = derivedId ?: id,
        slug = slug,
        name = name,
        imageUrl = images.orEmpty().firstOrNull(),
        displayPrice = pack?.priceLabel ?: displayPrice,
        quantity = quantity,
        packLabel = pack?.label,
        addedAt = System.currentTimeMillis(),
    )
}

/**
 * A reorder line's displayPrice: paise → the catalog's label shape
 * ("₹720 / 500g"), Indian-grouped like the PDP's pack labels so the estimate
 * parser (parsePaise) reads back the same number the customer paid. The unit
 * suffix is dropped when the order line carries none.
 */
internal fun packLinePriceLabel(unitPricePaise: Long, unit: String? = null): String {
    val rupees = unitPricePaise / 100
    val remainder = (unitPricePaise % 100).toInt()
    val price = buildString {
        append("₹")
        append(groupIndianDigits(rupees))
        if (remainder != 0) {
            append(".")
            append(remainder.toString().padStart(2, '0'))
        }
    }
    val suffix = unit?.trim().orEmpty()
    return if (suffix.isEmpty()) price else "$price / $suffix"
}

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

/**
 * B9: cart lines → the estimate request's items. Unlike validate (which
 * collapses every pack of a product into ONE base-id line), the estimate
 * contract prices per packLabel, so lines group by (BASE product id, pack
 * label) — "p1" + "p1:1 kg" become two priced lines off the same product,
 * quantities summed within each group. Pack labels ride along only when the
 * line carries one; the suffixed line id never leaves the device.
 */
internal fun estimateItems(items: List<CartItemEntity>): List<CartItem> =
    items
        .groupBy(
            keySelector = { baseCartProductId(it.productId) to it.packLabel },
            valueTransform = { it.quantity },
        )
        .map { (key, quantities) ->
            CartItem(
                productId = key.first,
                quantity = quantities.sum(),
                packLabel = key.second,
            )
        }

/**
 * Strip the pack suffix off a cart line id ("p1:500g" → "p1"; bare ids pass
 * through) — the same rule PlaceOrderUseCase.baseProductId applies, restated
 * locally so the estimate mapping above reads on its own.
 */
internal fun baseCartProductId(lineId: String): String = lineId.substringBefore(':')
