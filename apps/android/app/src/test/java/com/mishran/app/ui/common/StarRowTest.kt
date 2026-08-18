// apps/android/app/src/test/java/com/mishran/app/ui/common/StarRowTest.kt — B11.
//
// JVM unit tests for the star-row geometry (the pure per-star fill fraction
// that drives the composable's clipping). NOTE: source-complete (no SDK).
package com.mishran.app.ui.common

import org.junit.Assert.assertEquals
import org.junit.Test

class StarRowTest {

    @Test
    fun `a 4-point-5 rating fills four stars and halves the fifth`() {
        assertEquals(
            listOf(1f, 1f, 0.5f),
            starFillFractions(2.5).take(3),
        )
        assertEquals(
            listOf(1f, 1f, 1f, 1f, 0.5f),
            starFillFractions(4.5),
        )
    }

    @Test
    fun `whole ratings fill exactly that many stars`() {
        assertEquals(listOf(1f, 1f, 1f, 0f, 0f), starFillFractions(3.0))
        assertEquals(listOf(1f, 1f, 1f, 1f, 1f), starFillFractions(5.0))
        assertEquals(listOf(0f, 0f, 0f, 0f, 0f), starFillFractions(0.0))
    }

    @Test
    fun `fractional remainders carry the exact clip`() {
        val fractions = starFillFractions(4.3)
        assertEquals(listOf(1f, 1f, 1f, 1f), fractions.take(4))
        assertEquals(0.3f, fractions[4], 0.0001f)
    }

    @Test
    fun `ratings outside zero-to-five clamp instead of overflowing`() {
        assertEquals(listOf(0f, 0f, 0f, 0f, 0f), starFillFractions(-1.0))
        assertEquals(listOf(1f, 1f, 1f, 1f, 1f), starFillFractions(6.0))
    }
}
