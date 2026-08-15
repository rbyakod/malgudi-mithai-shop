// apps/android/app/src/test/java/com/mishran/app/data/repository/HeroRepositoryTest.kt — P3 parity (home hero).
//
// JVM tests for the network-only hero repository. The decode case runs the
// real wire JSON through Moshi (the same KotlinJsonAdapterFactory the
// network graph uses) before handing the parsed envelope to the mocked api —
// that exercises the generated Hero/HeroSlide @Json names (imageURL, the
// vertical enum) rather than hand-built objects. Failures and an unset
// global (empty slides) collapse to null so Home keeps its static hero.
// NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.api.models.HeroGet200Response
import com.mishran.app.data.remote.api.MishranApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

class HeroRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var repository: HeroRepository

    /** The endpoint's wire JSON — one mithai slide (relative media path) + a merch slide. */
    private val wireJson = """
        {
          "data": {
            "slides": [
              {
                "id": "p1",
                "vertical": "mithai",
                "slug": "kaju-katli",
                "name": "Kaju Katli",
                "priceLabel": "₹720 / 500g",
                "imageURL": "/api/media/file/hero-kaju.png",
                "imageAlt": "Silver-leafed kaju katli in a box"
              },
              {
                "id": "m1",
                "vertical": "merch",
                "slug": "brass-box",
                "name": "Brass Mithai Box",
                "imageURL": "https://cdn.example.com/brass-box.jpg",
                "imageAlt": "Engraved brass box"
              }
            ],
            "autoplayMs": 6000
          }
        }
    """.trimIndent()

    @Before
    fun setUp() {
        api = mockk()
        repository = HeroRepository(api)
    }

    @Test
    fun `the wire payload decodes and maps into a carousel with resolved media`() = runTest {
        val decoded = requireNotNull(
            Moshi.Builder()
                .add(KotlinJsonAdapterFactory())
                .build()
                .adapter(HeroGet200Response::class.java)
                .fromJson(wireJson),
        )
        coEvery { api.getHero() } returns decoded

        val carousel = repository.getHero()

        assertEquals(2, carousel?.slides?.size)
        assertEquals(6_000, carousel?.autoplayMs)
        val mithai = carousel?.slides?.first()
        assertEquals("kaju-katli", mithai?.slug)
        assertEquals("₹720 / 500g", mithai?.priceLabel)
        // Relative media path resolved against the API origin (BuildConfig
        // base URL varies by build, so assert both ends, not the middle).
        assertTrue(mithai?.imageURL?.startsWith("http") == true)
        assertTrue(mithai?.imageURL?.endsWith("/api/media/file/hero-kaju.png") == true)
        // Absolute URLs pass through untouched.
        assertEquals(
            "https://cdn.example.com/brass-box.jpg",
            carousel?.slides?.last()?.imageURL,
        )
    }

    @Test
    fun `an unset global (empty slides) is null, not an empty carousel`() = runTest {
        coEvery { api.getHero() } returns HeroGet200Response(
            com.mishran.api.models.Hero(slides = emptyList(), autoplayMs = 6_000),
        )

        assertNull(repository.getHero())
    }

    @Test
    fun `a failed fetch collapses to null and never throws`() = runTest {
        coEvery { api.getHero() } throws IOException("offline")

        assertNull(repository.getHero())
        coVerify(exactly = 1) { api.getHero() }
    }
}
