// apps/android/app/src/test/java/com/mishran/app/ui/enquiry/EnquiryFormTest.kt — parity batch.
//
// JVM unit tests for the enquiry form's pure halves: validation (required
// fields, email-required-because-the-server-400s, GSTIN shape) and the
// form → wire request mapping (typed contact + web-shaped payload, blanks
// omitted, dates normalized to ISO). The ViewModel harness stays in the
// screen tests; these need no mocks at all. NOTE: source-complete (no SDK).
package com.mishran.app.ui.enquiry

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EnquiryFormTest {

    // ---- validation ---------------------------------------------------------

    @Test
    fun `a complete form validates clean`() {
        val errors = validateEnquiry(
            EnquiryForm(
                name = "Asha Rao",
                phone = "919876543210",
                email = "asha@example.com",
                message = "500 boxes for a wedding",
            ),
        )
        assertTrue(errors.isEmpty())
    }

    @Test
    fun `name, phone and message are required`() {
        val errors = validateEnquiry(EnquiryForm())
        assertTrue(EnquiryField.NAME in errors)
        assertTrue(EnquiryField.PHONE in errors)
        assertTrue(EnquiryField.MESSAGE in errors)
    }

    @Test
    fun `email is required even though the old contract made it optional`() {
        // The server route 400s a lead without contact.email — the client
        // must flag it before the request goes out.
        val errors = validateEnquiry(
            EnquiryForm(name = "Asha", phone = "919876543210", email = "", message = "Hi"),
        )
        assertTrue(EnquiryField.EMAIL in errors)
    }

    @Test
    fun `a present email must be well-formed`() {
        val base = EnquiryForm(name = "Asha", phone = "919876543210", message = "Hi")
        assertTrue(EnquiryField.EMAIL in validateEnquiry(base.copy(email = "asha@example")))
        assertTrue(EnquiryField.EMAIL in validateEnquiry(base.copy(email = "asha example.com")))
        assertTrue(EnquiryField.EMAIL !in validateEnquiry(base.copy(email = "asha.rao@example.co.in")))
    }

    @Test
    fun `GSTIN validates only when non-empty and must be 15 caps-or-digits`() {
        val base = EnquiryForm(
            name = "Asha",
            phone = "919876543210",
            email = "asha@example.com",
            message = "Hi",
        )
        assertTrue(EnquiryField.GSTIN !in validateEnquiry(base.copy(gstin = ""))) // optional
        assertTrue(EnquiryField.GSTIN in validateEnquiry(base.copy(gstin = "29ABCDE1234F1Z"))) // 14
        assertTrue(EnquiryField.GSTIN in validateEnquiry(base.copy(gstin = "29abcde1234f1z5"))) // lowercase
        assertTrue(EnquiryField.GSTIN !in validateEnquiry(base.copy(gstin = "29ABCDE1234F1Z5"))) // valid

        assertTrue("29ABCDE1234F1Z5".matches(GSTIN_PATTERN))
        assertFalse("29ABCDE1234F1Z".matches(GSTIN_PATTERN))
    }

    // ---- wire shape ----------------------------------------------------------

    @Test
    fun `wedding extras ride the payload in the web's exact shapes`() {
        val request = EnquiryForm(
            type = EnquiryType.WEDDING,
            name = "Asha Rao",
            phone = "919876543210",
            email = "asha@example.com",
            message = "Wedding order",
            eventDate = "12 Nov 2026",
            city = "Mysore",
            guests = "400",
            budget = "₹1,00,000",
            mithaiPreferences = "kaju katli",
            packaging = "individual boxes",
        ).toRequest()

        assertEquals("wedding", request.type)
        assertEquals("Asha Rao", request.contact.name)
        assertEquals("asha@example.com", request.contact.email)
        assertEquals("919876543210", request.contact.phone)
        assertNull(request.contact.company)
        assertEquals(
            mapOf(
                "message" to "Wedding order",
                "eventDate" to "2026-11-12", // human date normalized to ISO
                "city" to "Mysore",
                "guests" to 400, // JSON number, not a string
                "budget" to "₹1,00,000",
                "mithaiPreferences" to "kaju katli",
                "packaging" to "individual boxes",
            ),
            request.payload,
        )
    }

    @Test
    fun `corporate extras map company and GSTIN onto the typed contact`() {
        val request = EnquiryForm(
            type = EnquiryType.CORPORATE,
            name = "Dev",
            phone = "919876543210",
            email = "dev@corp.example",
            message = "Diwali gifting",
            company = "Corp Pvt Ltd",
            quantity = "250",
            neededBy = "20 Oct 2026",
            gstin = "29abcde1234f1z5",
            occasion = "Diwali gifting",
            branding = "logo seal",
        ).toRequest()

        assertEquals("Corp Pvt Ltd", request.contact.company)
        assertEquals("29ABCDE1234F1Z5", request.contact.GSTIN) // uppercased
        assertEquals(250, request.payload["quantity"])
        assertEquals("2026-10-20", request.payload["deadline"])
        assertEquals("Diwali gifting", request.payload["occasion"])
        assertEquals("logo seal", request.payload["branding"])
        assertFalse(request.payload.containsKey("company")) // typed, not duplicated
    }

    @Test
    fun `blank extras are omitted rather than sent as empty strings`() {
        val request = EnquiryForm(
            name = "Asha",
            phone = "919876543210",
            email = "asha@example.com",
            message = "Hi",
        ).toRequest()

        assertFalse(request.payload.containsKey("city"))
        assertFalse(request.payload.containsKey("guests"))
        assertFalse(request.payload.containsKey("eventDate"))
        assertEquals("919876543210", request.contact.phone) // phone is present…
        assertNull(request.contact.company) // …but the absent optionals stay absent
        assertNull(request.contact.GSTIN)
    }

    // ---- date normalization ---------------------------------------------------

    @Test
    fun `toIsoDate accepts ISO verbatim, human dates, and passes unknown text through`() {
        assertEquals("2026-11-12", toIsoDate("2026-11-12"))
        assertEquals("2026-11-12", toIsoDate("12 Nov 2026"))
        assertNull(toIsoDate("   "))
        assertEquals("next month", toIsoDate("next month")) // free-form rides along raw
    }
}
