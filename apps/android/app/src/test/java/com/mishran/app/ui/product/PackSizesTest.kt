// apps/android/app/src/test/java/com/mishran/app/ui/product/PackSizesTest.kt — P1 parity.
//
// Table tests for the pack-size derivation, ported case-for-case from the
// web reference (lib/mithai/packSizes.ts — no test file exists there, so the
// cases encode its documented behavior): ladder selection, linear scaling
// with ₹10 rounding, en-IN lakh grouping, and every non-deriving shape
// (off-ladder, per-pack, on-request, bare, missing). NOTE: source-complete
// (no SDK).
package com.mishran.app.ui.product

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PackSizesTest {

    // ---- parseGrams -------------------------------------------------------

    @Test
    fun `parseGrams reads kg g gm and grams in any case`() {
        assertEquals(1000, parseGrams("1 kg"))
        assertEquals(1000, parseGrams("1kg"))
        assertEquals(1000, parseGrams("1 Kg"))
        assertEquals(1000, parseGrams("1 KG"))
        assertEquals(250, parseGrams("250g"))
        assertEquals(250, parseGrams(" 250 g "))
        assertEquals(480, parseGrams("480 gm"))
        assertEquals(700, parseGrams("700 grams"))
        assertEquals(500, parseGrams("0.5 kg"))
        assertEquals(1500, parseGrams("1.5kg"))
    }

    @Test
    fun `parseGrams rejects non-weight units and malformed values`() {
        assertNull(parseGrams("pack"))
        assertNull(parseGrams("250 ml"))
        assertNull(parseGrams("2 x 250g"))
        assertNull(parseGrams(""))
        assertNull(parseGrams("g"))
    }

    // ---- parsePrice -------------------------------------------------------

    @Test
    fun `parsePrice reads rupees before the first slash`() {
        assertEquals(920.0, parsePrice("₹920 / 250g")!!, 1e-9)
        assertEquals(1084.0, parsePrice("₹1,084 / 500g")!!, 1e-9)
        assertEquals(1084.0, parsePrice("₹ 1,084 / 500g")!!, 1e-9)
        assertEquals(920.5, parsePrice("₹920.50 / 250g")!!, 1e-9)
    }

    @Test
    fun `parsePrice rejects non-numeric or on-request labels`() {
        assertNull(parsePrice("₹ on request / pack"))
        assertNull(parsePrice("Rs. 45"))
        assertNull(parsePrice("₹455-470 / 250g"))
    }

    // ---- derivePackSizes: the full ladder ---------------------------------

    @Test
    fun `a 250g base derives the full ladder with the base verbatim`() {
        val packs = derivePackSizes("₹920 / 250g")

        assertEquals(
            listOf(
                PackSize(label = "250g", priceLabel = "₹920 / 250g", grams = 250),
                PackSize(label = "500g", priceLabel = "₹1,840 / 500g", grams = 500),
                PackSize(label = "1 kg", priceLabel = "₹3,680 / 1 kg", grams = 1000),
            ),
            packs,
        )
    }

    @Test
    fun `a 500g base scales down and up around the verbatim base`() {
        val packs = derivePackSizes("₹720 / 500g")

        assertEquals(
            listOf(
                PackSize(label = "250g", priceLabel = "₹360 / 250g", grams = 250),
                PackSize(label = "500g", priceLabel = "₹720 / 500g", grams = 500),
                PackSize(label = "1 kg", priceLabel = "₹1,440 / 1 kg", grams = 1000),
            ),
            packs,
        )
    }

    @Test
    fun `a 1 kg base derives the smaller rungs`() {
        val packs = derivePackSizes("₹920 / 1 kg")

        assertEquals(
            listOf(
                PackSize(label = "250g", priceLabel = "₹230 / 250g", grams = 250),
                PackSize(label = "500g", priceLabel = "₹460 / 500g", grams = 500),
                PackSize(label = "1 kg", priceLabel = "₹920 / 1 kg", grams = 1000),
            ),
            packs,
        )
    }

    @Test
    fun `scaling rounds to the nearest ten rupees`() {
        // 920.5 × 500 / 250 = 1841 → ₹1,840.
        val packs = derivePackSizes("₹920.50 / 250g")
        assertEquals("₹1,840 / 500g", packs[1].priceLabel)
    }

    @Test
    fun `derived prices use en-IN lakh grouping`() {
        // 108432 × 1000 / 250 = 433728 → ₹10-rounded 433730 → "4,33,730",
        // not the western "433,730".
        val packs = derivePackSizes("₹1,08,432 / 250g")
        assertEquals("₹4,33,730 / 1 kg", packs[2].priceLabel)
        // …and the 500g rung keeps the same grouping style.
        assertEquals("₹2,16,860 / 500g", packs[1].priceLabel)
    }

    @Test
    fun `case-insensitive unit parsing derives the ladder too`() {
        val packs = derivePackSizes("₹920 / 250GM")
        assertEquals(3, packs.size)
        assertEquals("₹1,840 / 500g", packs[1].priceLabel)
    }

    // ---- derivePackSizes: non-deriving shapes -----------------------------

    @Test
    fun `an off-ladder base keeps a single chip off the weight`() {
        // "130g" weight vs "₹399 / 700g" price — price unit is authoritative
        // for scaling but 700g is off-ladder, so nothing derives; the chip
        // falls back to the weight text.
        val packs = derivePackSizes("₹399 / 700g", weight = "130g")
        assertEquals(listOf(PackSize(label = "130g", priceLabel = "₹399 / 700g")), packs)
    }

    @Test
    fun `an off-ladder base without weight chips the price unit verbatim`() {
        val packs = derivePackSizes("₹399 / 700g")
        assertEquals(listOf(PackSize(label = "700g", priceLabel = "₹399 / 700g")), packs)
    }

    @Test
    fun `a per-pack price never derives`() {
        val packs = derivePackSizes("₹399 / pack")
        assertEquals(listOf(PackSize(label = "pack", priceLabel = "₹399 / pack")), packs)
    }

    @Test
    fun `a bare price with weight yields a single informational chip`() {
        val packs = derivePackSizes("₹455", weight = "250 g")
        assertEquals(listOf(PackSize(label = "250 g", priceLabel = "₹455")), packs)
    }

    @Test
    fun `an on-request price with weight still chips the weight`() {
        val packs = derivePackSizes("₹ on request", weight = "1 kg")
        assertEquals(listOf(PackSize(label = "1 kg", priceLabel = "₹ on request")), packs)
    }

    @Test
    fun `unparseable products get no chips at all`() {
        assertEquals(emptyList<PackSize>(), derivePackSizes(""))
        assertEquals(emptyList<PackSize>(), derivePackSizes("₹455"))
        assertEquals(emptyList<PackSize>(), derivePackSizes("Price on request"))
        assertEquals(emptyList<PackSize>(), derivePackSizes("₹ on request", weight = "  "))
    }

    // ---- groupIndianDigits (en-IN lakh grouping) ---------------------------

    @Test
    fun `grouping is indian style - first three then pairs`() {
        assertEquals("360", groupIndianDigits(360))
        assertEquals("1,840", groupIndianDigits(1840))
        assertEquals("2,61,860", groupIndianDigits(261860))
        assertEquals("4,33,730", groupIndianDigits(433730))
        assertEquals("1,08,432", groupIndianDigits(108432))
        assertEquals("10,84,320", groupIndianDigits(1084320))
        assertEquals("0", groupIndianDigits(0))
    }

    // ---- basePackFor (the preselected chip) --------------------------------

    @Test
    fun `the base pack is the chip carrying the verbatim display price`() {
        val packs = derivePackSizes("₹720 / 500g")
        val base = packs.basePackFor("₹720 / 500g")

        assertEquals("500g", base?.label)
        assertEquals("₹720 / 500g", base?.priceLabel)
    }

    @Test
    fun `basePackFor falls back to the first chip and tolerates a null price`() {
        val single = derivePackSizes("₹399 / 700g")
        assertEquals(single.first(), single.basePackFor(null))
        assertEquals(single.first(), single.basePackFor("₹999 / 999g"))

        assertEquals(null, emptyList<PackSize>().basePackFor("₹720 / 500g"))
    }
}
