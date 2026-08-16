// apps/android/app/src/test/java/com/mishran/app/ui/gift/GiftFormTest.kt — parity batch.
//
// JVM unit tests for the gift-builder form's pure halves: validation
// (name/email required, email well-formed) and the form → wire mapping (the
// web gift-builder draft's exact shape: type "gift-builder-draft", contact
// {name,email,phone}, payload {occasion,boxSize,budget,city,date,dietary,
// message} with blanks omitted, source "android-app"). NOTE:
// source-complete (no SDK).
package com.mishran.app.ui.gift

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GiftFormTest {

    // ---- validation ---------------------------------------------------------

    @Test
    fun `a minimal valid form passes with only name and email`() {
        val errors = validateGift(GiftForm(name = "Asha Rao", email = "asha@example.com"))
        assertTrue(errors.isEmpty())
    }

    @Test
    fun `name and email are required`() {
        val errors = validateGift(GiftForm())
        assertTrue(GiftField.NAME in errors)
        assertTrue(GiftField.EMAIL in errors)
    }

    @Test
    fun `a present email must be well-formed`() {
        val base = GiftForm(name = "Asha")
        assertTrue(GiftField.EMAIL in validateGift(base.copy(email = "asha@example")))
        assertTrue(GiftField.EMAIL in validateGift(base.copy(email = "not an email")))
        assertTrue(GiftField.EMAIL !in validateGift(base.copy(email = "asha.rao@example.co.in")))
    }

    @Test
    fun `phone is optional — the session pre-fill is a convenience`() {
        val errors = validateGift(GiftForm(name = "Asha", email = "asha@example.com", phone = ""))
        assertTrue(errors.isEmpty())
    }

    // ---- dropdown option lists (the web builder's verbatim values) -----------

    @Test
    fun `occasion, box-size and budget options match the web builder verbatim`() {
        assertEquals(
            listOf("Diwali", "Wedding", "Corporate", "Birthday", "Housewarming", "Other"),
            GIFT_OCCASIONS,
        )
        assertEquals(listOf("4-piece", "8-piece", "16-piece", "Custom"), GIFT_BOX_SIZES)
        assertEquals(
            listOf("Under ₹1,000", "₹1,000-₹2,500", "₹2,500-₹5,000", "₹5,000+"),
            GIFT_BUDGETS,
        )
    }

    // ---- wire shape -----------------------------------------------------------

    @Test
    fun `a full form maps to the gift-builder draft exactly`() {
        val request = GiftForm(
            name = "Asha Rao",
            email = "asha@example.com",
            phone = "919876543210",
            city = "Mysore",
            occasion = "Diwali",
            boxSize = "16-piece",
            budget = "₹5,000+",
            date = "20 Oct 2026",
            dietary = "no nuts",
            message = "Happy Diwali!",
        ).toRequest()

        assertEquals("gift-builder-draft", request.type)
        assertEquals("android-app", request.source)
        assertEquals("Asha Rao", request.contact.name)
        assertEquals("asha@example.com", request.contact.email)
        assertEquals("919876543210", request.contact.phone)
        assertNull(request.contact.company)
        assertNull(request.contact.GSTIN)
        assertEquals(
            mapOf(
                "occasion" to "Diwali",
                "boxSize" to "16-piece",
                "budget" to "₹5,000+",
                "city" to "Mysore",
                "date" to "2026-10-20", // human date normalized to ISO
                "dietary" to "no nuts",
                "message" to "Happy Diwali!",
            ),
            request.payload,
        )
    }

    @Test
    fun `blank optionals are omitted rather than sent as empty strings`() {
        val request = GiftForm(name = "Asha", email = "asha@example.com").toRequest()

        assertEquals("gift-builder-draft", request.type)
        assertEquals("android-app", request.source)
        assertNull(request.contact.phone)
        assertTrue(request.payload.isEmpty())
    }

    @Test
    fun `an already-ISO date passes through untouched`() {
        val request = GiftForm(
            name = "Asha",
            email = "asha@example.com",
            date = "2026-10-20",
        ).toRequest()
        assertEquals("2026-10-20", request.payload["date"])
    }

    @Test
    fun `the type and source constants carry the web draft's wire values`() {
        assertEquals("gift-builder-draft", GIFT_LEAD_TYPE)
        assertEquals("android-app", GIFT_LEAD_SOURCE)
        assertFalse(GIFT_LEAD_TYPE.isBlank())
    }
}
