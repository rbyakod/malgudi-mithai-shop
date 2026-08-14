// apps/android/app/src/test/java/com/mishran/app/data/repository/CatalogMappersTest.kt — Task 9.2.
//
// JVM unit tests for the Product ↔ ProductEntity mappers. These are the seam
// where JSON value-strings ("sugar-free") meet Kotlin enum constants
// (sugarMinusFree) and where nullable lists collapse into the pipe-joined
// converter representation — exactly the two places a catalog cache silently
// corrupts if mapping drifts. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.Product
import com.mishran.app.data.local.entity.ProductEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CatalogMappersTest {

    private fun sampleProduct(
        family: Product.Family = Product.Family.sugarMinusFree,
        freshnessStatus: Product.FreshnessStatus? = Product.FreshnessStatus.madeMinusDaily,
        dietaryTags: List<String>? = listOf("sugar-free", "eggless"),
        allergens: List<String>? = listOf("nuts"),
        images: List<String>? = listOf("https://cdn.mishran.in/kaju-katli.jpg"),
    ) = Product(
        id = "prod-1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = family,
        displayPrice = "₹720 / 500g",
        freshnessStatus = freshnessStatus,
        dietaryTags = dietaryTags,
        allergens = allergens,
        ingredients = "Cashews, sugar",
        shelfLife = "7 days",
        storage = "Cool, dry place",
        images = images,
        story = "Slivered-cashew fudge",
        karigar = "karigar-9",
        updatedAt = "2026-08-01T10:00:00Z",
    )

    @Test
    fun `entity round-trips back to an equal product`() {
        val entity = sampleProduct().toEntity(staleAt = 123L)
        assertEquals(sampleProduct(), entity.toDomain())
    }

    @Test
    fun `staleAt is stamped on the entity`() {
        assertEquals(987654321L, sampleProduct().toEntity(staleAt = 987654321L).staleAt)
    }

    @Test
    fun `enum constants persist as their JSON value strings`() {
        val entity = sampleProduct().toEntity(staleAt = 0L)
        assertEquals("sugar-free", entity.family)
        assertEquals("made-daily", entity.freshnessStatus)
    }

    @Test
    fun `unknown family value falls back to classic rather than crashing`() {
        val entity = sampleProduct().toEntity(staleAt = 0L).copy(family = "unknown-family")
        assertEquals(Product.Family.classic, entity.toDomain().family)
    }

    @Test
    fun `unknown freshness value maps to null instead of crashing`() {
        val entity = sampleProduct().toEntity(staleAt = 0L).copy(freshnessStatus = "mystery")
        assertNull(entity.toDomain().freshnessStatus)
    }

    @Test
    fun `null freshness on the wire stays null end to end`() {
        assertNull(
            sampleProduct(freshnessStatus = null).toEntity(staleAt = 0L).toDomain().freshnessStatus,
        )
    }

    @Test
    fun `null lists collapse to empty and restore to null`() {
        val domain = sampleProduct(dietaryTags = null, allergens = null, images = null)
            .toEntity(staleAt = 0L)
            .toDomain()
        assertNull(domain.dietaryTags)
        assertNull(domain.allergens)
        assertNull(domain.images)
    }

    @Test
    fun `classic family value round-trips without enum fallback`() {
        val domain = sampleProduct(family = Product.Family.classic).toEntity(staleAt = 0L).toDomain()
        assertEquals(Product.Family.classic, domain.family)
    }
}
