// apps/android/app/src/main/java/com/mishran/app/util/AppSignatureHelper.kt — Task 8.3.
//
// Computes the 11-char app signature hash the SMS Retriever API matches on.
// The backend OTP template (MSG91) MUST append this hash to the SMS body —
// without it the Retriever never fires. This is primarily a dev-time helper:
// run it once per signing config, paste the printed hash into the MSG91
// template, then it is fixed. Debug + release certs produce DIFFERENT hashes,
// so each build type needs its own template entry server-side.
package com.mishran.app.util

import android.content.Context
import android.content.pm.PackageManager
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64

object AppSignatureHelper {

    /** The hash to append to OTP SMSes for this app's signing cert ("" if unreadable). */
    fun appSignature(context: Context): String {
        val sha1 = signingCertSha1(context) ?: return ""
        return computeHash(context.packageName, sha1)
    }

    /**
     * Pure hash for unit testing. Mirrors Google's AppSignatureHelper algorithm:
     * SHA-256 of "<packageName> <sha1Hex>" → first 9 bytes → base64 (no padding)
     * → first 11 chars.
     */
    fun computeHash(packageName: String, sha1Hex: String): String {
        val appInfo = "$packageName $sha1Hex"
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(appInfo.toByteArray(StandardCharsets.UTF_8))
        val truncated = digest.copyOfRange(0, minOf(HASHED_BYTES, digest.size))
        // java.util.Base64 (not android.util) so the pure function runs under a
        // JVM unit test too; API 26+ supports it on-device.
        return Base64.getEncoder().withoutPadding().encodeToString(truncated)
            .take(HASH_LENGTH)
    }

    // GET_SIGNATURES is deprecated at API 28 in favor of SigningInfo, but it
    // works on every min-SDK level here (26+). A signing-cert lookup is a
    // dev-time convenience only, so broad compat beats the modern API surface.
    private fun signingCertSha1(context: Context): String? = try {
        val signatures = context.packageManager
            .getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)
            .signatures
        val cert = signatures?.firstOrNull() ?: return null
        MessageDigest.getInstance("SHA-1").digest(cert.toByteArray())
            .joinToString("") { "%02x".format(it) }
    } catch (e: Exception) {
        null
    }

    private const val HASHED_BYTES = 9
    private const val HASH_LENGTH = 11
}
