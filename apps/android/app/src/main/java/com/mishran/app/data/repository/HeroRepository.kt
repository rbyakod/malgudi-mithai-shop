// apps/android/app/src/main/java/com/mishran/app/data/repository/HeroRepository.kt — P3 parity (home hero).
//
// Network-only fetcher for the admin-curated home hero carousel (the
// `home-hero` global the web renders). Deliberately NOT Room-cached — same
// call as the verticals: a browse-y surface where the local static hero is
// a fine fallback, cheaper than a second ETag/offline pipeline. Any failure
// (offline, 5xx, malformed body) collapses to null so HomeViewModel keeps
// serving its static hero instead of an error state; media URLs are
// resolved to absolute form at this boundary, as everywhere else.
package com.mishran.app.data.repository

import com.mishran.api.models.HeroSlide
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.remote.resolveMediaUrl
import javax.inject.Inject
import javax.inject.Singleton

/** The hero carousel as the UI needs it: slides + the autoplay interval. */
data class HeroCarousel(
    /** Resolved slides, server order; never empty in a non-null carousel. */
    val slides: List<HeroSlide>,
    /** Server-clamped autoplay interval (ms, 3000…15000). */
    val autoplayMs: Int,
)

@Singleton
class HeroRepository @Inject constructor(
    private val api: MishranApi,
) {

    /**
     * The admin-curated carousel, or null when the fetch failed or the
     * global is unset (empty slides — the contract's "keep the local
     * fallback hero" signal). Never throws.
     */
    suspend fun getHero(): HeroCarousel? = try {
        val hero = api.getHero().data
        if (hero.slides.isEmpty()) null
        else HeroCarousel(
            slides = hero.slides.map { slide ->
                slide.copy(imageURL = resolveMediaUrl(slide.imageURL))
            },
            autoplayMs = hero.autoplayMs,
        )
    } catch (e: Exception) {
        null // offline / 5xx — the static hero stays
    }
}
