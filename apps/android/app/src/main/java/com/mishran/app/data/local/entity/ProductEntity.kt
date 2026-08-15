// apps/android/app/src/main/java/com/mishran/app/data/local/entity/ProductEntity.kt — Task 9.1 / P1 parity.
//
// Offline cache row for a catalog product. Mirrors the generated `Product`
// contract (id/slug/name/family/displayPrice/weight/featured/freshnessStatus/
// dietaryTags/allergens/ingredients/shelfLife/storage/images/story/karigar/
// updatedAt) with two adaptations Room requires:
//   - enum fields (family, freshnessStatus) are stored as their JSON *value*
//     strings ("sugar-free", "made-daily"); CatalogRepository maps to/from the
//     generated enums. Storing the value (not the Kotlin constant name) keeps
//     the cache human-readable and stable across codegen renames.
//   - List<String> fields go through [Converters] (pipe-joined).
// `staleAt` is the epoch-millis freshness cutoff the repository sets on every
// refresh; ProductDao.deleteStale(now) purges rows past it.
//
// P1 parity added `weight` (drives the PDP pack-size chips) and `featured`
// (flags the Home best-sellers rail; null = unflagged, pre-migration rows).
package com.mishran.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val slug: String,
    val name: String,
    val family: String,
    val displayPrice: String? = null,
    /** Net pack weight as display text ("250 g") — drives the pack-size chip. */
    val weight: String? = null,
    /** Flags the product for the Home best-sellers rail. */
    val featured: Boolean? = null,
    val freshnessStatus: String? = null,
    val dietaryTags: List<String> = emptyList(),
    val allergens: List<String> = emptyList(),
    val ingredients: String? = null,
    val shelfLife: String? = null,
    val storage: String? = null,
    val images: List<String> = emptyList(),
    val story: String? = null,
    val karigar: String? = null,
    val updatedAt: String? = null,
    /** Epoch millis after which this row is considered stale. See deleteStale(). */
    val staleAt: Long = 0L,
)
