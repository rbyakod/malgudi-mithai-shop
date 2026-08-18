// apps/android/app/src/test/java/com/mishran/app/data/repository/ReviewRepositoryTest.kt — B11.
//
// JVM unit tests for the reviews read path: the real Moshi decode of the
// GET /reviews envelope (nullable author, absent optional body, ISO string
// dates, Double aggregate) plus the never-throw contract that hides the PDP
// section on failure. NOTE: source-complete (no SDK).
package com.mishran.app.data.repository

import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.remote.api.ReviewsResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import java.io.IOException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ReviewRepositoryTest {

    private lateinit var api: MishranApi
    private lateinit var repository: ReviewRepository
    private lateinit var moshi: Moshi

    @Before
    fun setUp() {
        api = mockk()
        repository = ReviewRepository(api)
        moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    }

    @Test
    fun `the wire envelope decodes with a nullable author, absent body and string dates`() {
        val response = moshi
            .adapter(ReviewsResponse::class.java)
            .fromJson(WIRE_PAGE)!!

        val page = response.data!!
        assertEquals(12, page.total)
        assertEquals(4.5, page.averageRating!!, 0.0001)
        assertEquals(2, page.items.size)

        val named = page.items[0]
        assertEquals("r1", named.id)
        assertEquals(5, named.rating)
        assertEquals("Meera", named.authorDisplayName)
        assertEquals(true, named.verifiedPurchase)
        assertEquals("2026-08-17T09:30:00Z", named.createdAt)
        assertEquals("Silvertop quality.", named.body)

        // Anonymous author arrives as an explicit JSON null; `body` is the
        // contract's only defaulted field, so its absence decodes to null.
        val anonymous = page.items[1]
        assertNull(anonymous.authorDisplayName)
        assertEquals(false, anonymous.verifiedPurchase)
        assertNull(anonymous.body)

    }

    @Test
    fun `a page with zero reviews keeps the nullable aggregate null`() {
        val response = moshi
            .adapter(ReviewsResponse::class.java)
            .fromJson("""{"data":{"items":[],"averageRating":null,"total":0,"page":1,"pageSize":5}}""")!!

        assertNull(response.data?.averageRating)
        assertEquals(0, response.data?.total)
    }

    @Test
    fun `getProductReviews unwraps the envelope and passes the page size`() = runTest {
        val pageSizeSlot = slot<Int>()
        coEvery { api.getReviews(productId = any(), page = any(), pageSize = capture(pageSizeSlot)) } returns
            moshi.adapter(ReviewsResponse::class.java).fromJson(WIRE_PAGE)!!

        val page = repository.getProductReviews("p1")!!

        assertEquals(12, page.total)
        assertEquals(5, pageSizeSlot.captured)
        coVerify(exactly = 1) { api.getReviews(productId = "p1", page = any(), pageSize = any()) }
    }

    @Test
    fun `a fetch failure collapses to null so the section hides silently`() = runTest {
        coEvery { api.getReviews(productId = any(), page = any(), pageSize = any()) } throws
            IOException("offline")

        assertNull(repository.getProductReviews("p1"))
    }

    private companion object {
        val WIRE_PAGE = """
            {
              "data": {
                "items": [
                  {
                    "id": "r1",
                    "rating": 5,
                    "authorDisplayName": "Meera",
                    "verifiedPurchase": true,
                    "createdAt": "2026-08-17T09:30:00Z",
                    "body": "Silvertop quality."
                  },
                  {
                    "id": "r2",
                    "rating": 4,
                    "authorDisplayName": null,
                    "verifiedPurchase": false,
                    "createdAt": "2026-08-15T18:00:00Z"
                  }
                ],
                "averageRating": 4.5,
                "total": 12,
                "page": 1,
                "pageSize": 5
              }
            }
        """.trimIndent()
    }
}
