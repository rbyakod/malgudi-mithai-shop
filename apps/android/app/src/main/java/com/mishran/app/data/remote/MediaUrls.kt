// apps/android/app/src/main/java/com/mishran/app/data/remote/MediaUrls.kt
//
// The mobile API returns media paths relative to the server origin
// ("/api/media/file/Sweets_Box.png") — Payload emits relative URLs unless
// SERVER_URL is configured, and the contract keeps them that way so responses
// stay host-agnostic. Coil (and any HTTP image loader) needs an absolute URL,
// so catalog/order image strings are resolved against the API origin at the
// repository mapping boundary — one place, and every consumer (grid, detail
// gallery, cart rows) receives a loadable URL.
package com.mishran.app.data.remote

import com.mishran.app.BuildConfig

/**
 * Resolve an image reference from the API to an absolute URL. Absolute
 * references pass through untouched (idempotent on already-resolved rows);
 * relative paths are prefixed with the API origin derived from
 * [BuildConfig.API_BASE_URL] ("<origin>/api/mobile/v1/").
 */
fun resolveMediaUrl(path: String): String {
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    val origin = BuildConfig.API_BASE_URL.trimEnd('/').removeSuffix("/api/mobile/v1")
    return origin + if (path.startsWith("/")) path else "/$path"
}
