// apps/android/app/src/main/java/com/mishran/app/data/local/entity/CartItemEntity.kt — Task 10.1 / P1 parity (pack sizes).
//
// One cart line, keyed by productId (the catalog's stable id). Quantity is
// user-owned; price is display-only by contract ("commerce deferred" on
// Product.displayPrice) so the entity carries the label verbatim and the
// ViewModel derives an *estimated* total from it — the server re-validates at
// checkout (POST /cart/validate) and its snapshot is authoritative.
//
// P1 parity (pack sizes): a derived pack line keys itself as
// `${productId}:${packLabel}` so sizes stack as separate lines; the base pack
// keeps the bare productId so pre-pack carts keep merging. `packLabel` is
// display metadata only — the server's CartItem has no variant field, so
// PlaceOrderUseCase collapses lines by BASE productId before validating.
package com.mishran.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cart_items")
data class CartItemEntity(
    @PrimaryKey val productId: String,
    val slug: String,
    val name: String,
    val imageUrl: String? = null,
    val displayPrice: String? = null,
    val quantity: Int,
    /** Selected pack chip ("500g"), when the line was added from one. Null = base pack. */
    val packLabel: String? = null,
    /** Epoch millis when the line was added — the cart renders in this order. */
    val addedAt: Long,
)
