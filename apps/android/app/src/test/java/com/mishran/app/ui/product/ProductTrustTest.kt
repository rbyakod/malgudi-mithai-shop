// apps/android/app/src/test/java/com/mishran/app/ui/product/ProductTrustTest.kt — iOS PDP parity.
//
// JVM unit tests for the PDP parity copy-derivation in ProductTrust.kt:
// which trust-strip slots render (only non-empty fields), dietary tag
// localization with free-text passthrough, provenance visibility against the
// currently-empty production fields, and the sticky buy bar's "qty × price"
// line. Pure functions over plain strings — no SDK needed.
package com.mishran.app.ui.product

import com.mishran.api.models.Product
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ProductTrustTest {

    private val copy = TrustStripCopy(
        freshDaily = "Made fresh each morning",
        freshToOrder = "Made to order, finished on request",
        frozen = "Finished fresh, frozen at peak",
        shelfLife = { "$it shelf life" },
        vegetarian = "Vegetarian",
        sugarFree = "Sugar-free",
    )

    private fun product(
        freshnessStatus: Product.FreshnessStatus? = null,
        shelfLife: String? = null,
        leadTime: String? = null,
        dietaryTags: List<String>? = null,
        karigarName: String? = null,
    ) = Product(
        id = "p1",
        slug = "kaju-katli",
        name = "Kaju Katli",
        family = Product.Family.classic,
        freshnessStatus = freshnessStatus,
        shelfLife = shelfLife,
        dietaryTags = dietaryTags,
        leadTime = leadTime,
        karigarName = karigarName,
    )

    // ---- Trust strip: which slots render ----------------------------------

    @Test
    fun `an empty product renders no trust strip`() {
        assertEquals(emptyList<String>(), trustStripItems(product(), copy))
    }

    @Test
    fun `each field alone renders exactly its own item`() {
        assertEquals(
            listOf(copy.freshDaily),
            trustStripItems(product(freshnessStatus = Product.FreshnessStatus.madeMinusDaily), copy),
        )
        assertEquals(
            listOf("7 days shelf life"),
            trustStripItems(product(shelfLife = "7 days"), copy),
        )
        assertEquals(
            listOf("Made to order in 24h"),
            trustStripItems(product(leadTime = "Made to order in 24h"), copy),
        )
        assertEquals(
            listOf(copy.vegetarian),
            trustStripItems(product(dietaryTags = listOf("vegetarian")), copy),
        )
    }

    @Test
    fun `every freshness status localizes to its promise`() {
        assertEquals(
            copy.freshDaily,
            freshnessPromise(Product.FreshnessStatus.madeMinusDaily, copy),
        )
        assertEquals(
            copy.freshToOrder,
            freshnessPromise(Product.FreshnessStatus.madeMinusToMinusOrder, copy),
        )
        assertEquals(
            copy.frozen,
            freshnessPromise(Product.FreshnessStatus.batchMinusFrozen, copy),
        )
        assertNull(freshnessPromise(null, copy))
    }

    @Test
    fun `known dietary tags localize and unknown ones pass through capitalized`() {
        assertEquals(copy.vegetarian, dietaryTrustLabel("vegetarian", copy))
        assertEquals(copy.sugarFree, dietaryTrustLabel("Sugar-Free", copy))
        // Admin free text renders verbatim (just capitalized), never dropped.
        assertEquals("Jain", dietaryTrustLabel("jain", copy))
        assertEquals("Eggless", dietaryTrustLabel("eggless", copy))
    }

    @Test
    fun `a fully populated product renders every slot in order`() {
        val items = trustStripItems(
            product(
                freshnessStatus = Product.FreshnessStatus.madeMinusDaily,
                shelfLife = "7 days",
                leadTime = "Made to order in 24h",
                dietaryTags = listOf("vegetarian", "sugar-free", "jain"),
            ),
            copy,
        )
        assertEquals(
            listOf(
                copy.freshDaily,
                "7 days shelf life",
                "Made to order in 24h",
                copy.vegetarian,
                copy.sugarFree,
                "Jain",
            ),
            items,
        )
    }

    @Test
    fun `blank strings never leak a slot`() {
        assertEquals(
            emptyList<String>(),
            trustStripItems(product(shelfLife = "  ", leadTime = "", dietaryTags = emptyList()), copy),
        )
    }

    // ---- Provenance: hidden until the fields exist -------------------------

    @Test
    fun `production-shaped data hides the provenance block entirely`() {
        // Today's production rows carry none of these — the empty return is
        // the block hiding, which is correct, not a bug.
        assertEquals(
            emptyList<ProvenanceRow>(),
            provenanceRows(product(), karigarLabel = "", freshnessLabel = "", shelfLifeLabel = ""),
        )
    }

    @Test
    fun `karigar renders the made-by row with the name as the value`() {
        val rows = provenanceRows(
            product(karigarName = "Karigar Suresh"),
            karigar = "Karigar",
            freshness = "Freshness",
            shelfLife = "Shelf life",
        )
        assertEquals(listOf(ProvenanceRow("Karigar", "Karigar Suresh")), rows)
    }

    @Test
    fun `lead time and shelf life rows render independently`() {
        assertEquals(
            listOf(ProvenanceRow("Freshness", "Made to order in 24h")),
            provenanceRows(product(leadTime = "Made to order in 24h"), "Karigar", "Freshness", "Shelf life"),
        )
        assertEquals(
            listOf(ProvenanceRow("Shelf life", "10 days")),
            provenanceRows(product(shelfLife = "10 days"), "Karigar", "Freshness", "Shelf life"),
        )
    }

    @Test
    fun `a fully populated product renders karigar, freshness then shelf life`() {
        val rows = provenanceRows(
            product(karigarName = "Karigar Suresh", leadTime = "48h notice", shelfLife = "5 days"),
            karigar = "Karigar",
            freshness = "Freshness",
            shelfLife = "Shelf life",
        )
        assertEquals(
            listOf(
                ProvenanceRow("Karigar", "Karigar Suresh"),
                ProvenanceRow("Freshness", "48h notice"),
                ProvenanceRow("Shelf life", "5 days"),
            ),
            rows,
        )
    }

    @Test
    fun `blank provenance fields are treated as absent`() {
        assertEquals(
            emptyList<ProvenanceRow>(),
            provenanceRows(product(karigarName = "  "), "Karigar", "Freshness", "Shelf life"),
        )
    }

    // ---- Sticky buy bar line ------------------------------------------------

    @Test
    fun `stickyQuantityLine joins quantity and price`() {
        assertEquals("2 × ₹920 / 250g", stickyQuantityLine(2, "₹920 / 250g"))
        assertEquals("1 × ₹720 / 500g", stickyQuantityLine(1, "₹720 / 500g"))
    }

    @Test
    fun `stickyQuantityLine hides when there is no price line`() {
        assertNull(stickyQuantityLine(3, null))
        assertNull(stickyQuantityLine(3, ""))
    }
}
