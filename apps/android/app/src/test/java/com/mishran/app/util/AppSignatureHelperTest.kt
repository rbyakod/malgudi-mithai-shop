// apps/android/app/src/test/java/com/mishran/app/util/AppSignatureHelperTest.kt — Task 8.3.
//
// JVM unit tests for the pure hash. The signing-cert lookup (appSignature) is
// Android-only and not covered here; computeHash uses java.util.Base64 so it
// runs under plain JVM (no Robolectric). NOTE: source-complete (no SDK).
package com.mishran.app.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppSignatureHelperTest {

    private val pkg = "com.mishran.app"
    private val sha1 = "ab12cd34ef5678901234fedcba0987654321aabb"

    @Test
    fun `hash is exactly 11 characters`() {
        assertEquals(11, AppSignatureHelper.computeHash(pkg, sha1).length)
    }

    @Test
    fun `hash is deterministic for the same input`() {
        val a = AppSignatureHelper.computeHash(pkg, sha1)
        val b = AppSignatureHelper.computeHash(pkg, sha1)
        assertEquals(a, b)
    }

    @Test
    fun `different sha1 certs produce different hashes`() {
        val a = AppSignatureHelper.computeHash(pkg, sha1)
        val b = AppSignatureHelper.computeHash(pkg, "000000000000000000000000000000000000ffff")
        assertNotEquals(a, b)
    }

    @Test
    fun `hash stays in the base64 alphabet`() {
        val hash = AppSignatureHelper.computeHash(pkg, sha1)
        assertTrue("got: $hash", hash.all { it.isLetterOrDigit() || it == '+' || it == '/' })
    }
}
