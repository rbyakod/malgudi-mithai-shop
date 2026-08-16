// apps/android/app/src/main/java/com/mishran/app/util/WhatsAppLinks.kt — parity batch (WhatsApp surfaces).
//
// Pure builders for the wa.me deep links behind the app's three WhatsApp
// surfaces (Account support row, PDP "Ask on WhatsApp", cart "Send order").
// Kept framework-free (java.net.URLEncoder, not android.net.Uri) so the
// encoding is unit-testable on the JVM — the screens only ever fire the
// returned string through an ACTION_VIEW intent the nav graph owns.
//
// URLEncoder encodes spaces as '+', which the query-string grammar reads back
// as a space — wa.me accepts it, and it avoids pulling android.net.Uri (a
// stubbed jar in JVM tests) into a pure function.
package com.mishran.app.util

import java.net.URLEncoder

/**
 * `https://wa.me/<digits>?text=<encoded message>`; blank text drops the query
 * entirely so the link still opens the chat.
 */
fun buildWhatsAppUrl(digits: String, message: String): String {
    val chat = "https://wa.me/${digits.trim()}"
    val trimmed = message.trim()
    if (trimmed.isEmpty()) return chat
    val encoded = URLEncoder.encode(trimmed, "UTF-8")
    return "$chat?text=$encoded"
}
