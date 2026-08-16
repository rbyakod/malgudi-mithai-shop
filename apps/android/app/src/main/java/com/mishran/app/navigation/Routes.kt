// apps/android/app/src/main/java/com/mishran/app/navigation/Routes.kt — Task 7.4.
//
// Central route table for the Compose NavGraph. Routes with path params are
// declared as templates ("order/{id}") and paired with builder helpers so call
// sites never hand-format strings. Keeping every route here means deep links,
// bottom-nav, and programmatic navigate() calls all reference one source of
// truth — no drift between the manifest intent-filter and the NavHost.
package com.mishran.app.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.ui.graphics.vector.ImageVector
import com.mishran.app.R

object Routes {
    const val SPLASH = "splash"
    const val AUTH_PHONE = "auth/phone"
    const val AUTH_OTP = "auth/otp/{requestId}"
    const val HOME = "home"
    /** Pattern with optional family filter + vertical tab args (Home deep links). */
    const val CATALOG = "catalog?family={family}&vertical={vertical}"
    const val PRODUCT = "product/{slug}"
    const val CART = "cart"
    const val CHECKOUT = "checkout"
    const val ORDERS = "orders"
    const val ORDER_CONFIRMED = "order-confirmed/{id}"
    const val ORDER_DETAIL = "order/{id}"
    const val ACCOUNT = "account"
    const val ADDRESSES = "addresses"
    // P2 net-new surfaces.
    /** Pattern with an optional pillar filter arg (Home's "Why Mishran" cards). */
    const val STORIES = "stories?pillar={pillar}"
    const val STORY = "story/{slug}"
    const val ENQUIRY = "enquiry?type={type}"
    const val SNACK = "snack/{slug}"
    const val QSR_ITEM = "qsr/{slug}"
    const val MERCH_ITEM = "merch/{slug}"
    // Parity batch: the gift-builder lead form (Account's "Build a gift" row).
    const val GIFT = "gift"

    /** Deep-link URI pattern — must stay in lockstep with the manifest intent-filter. */
    const val ORDER_DEEPLINK_PATTERN = "mishran://order/{id}"

    fun authOtp(requestId: String): String = "auth/otp/$requestId"

    /**
     * Built CATALOG route: bare "catalog" (all families, Mithai tab) or with
     * whichever optional args are set. Values are plain tokens (family enum
     * values, vertical wire names) — no URL-encoding needed today.
     */
    fun catalog(family: String? = null, vertical: String? = null): String {
        val args = listOfNotNull(
            family?.let { "family=$it" },
            vertical?.let { "vertical=$it" },
        )
        return if (args.isEmpty()) "catalog" else "catalog?${args.joinToString("&")}"
    }
    fun product(slug: String): String = "product/$slug"
    fun story(slug: String): String = "story/$slug"

    /**
     * Built STORIES route: bare "stories" (All pillars) or with the pillar
     * preselected — the same optional-arg idiom as [catalog]; values are the
     * Story.Pillar wire names ("farm", "karigar", …).
     */
    fun stories(pillar: String? = null): String =
        if (pillar == null) "stories" else "stories?pillar=$pillar"

    /** Enquiry route; `type` presets the form (merch passes "corporate"). */
    fun enquiry(type: String? = null): String =
        if (type == null) "enquiry" else "enquiry?type=$type"
    fun snack(slug: String): String = "snack/$slug"
    fun qsrItem(slug: String): String = "qsr/$slug"
    fun merchItem(slug: String): String = "merch/$slug"
    fun orderConfirmed(id: String): String = "order-confirmed/$id"
    fun orderDetail(id: String): String = "order/$id"

    /** Routes that show the bottom navigation bar. */
    val topLevel: Set<String> = setOf(HOME, CATALOG, ORDERS, ACCOUNT)
}

/**
 * A bottom-navigation destination. Labels are string-resource ids resolved
 * with stringResource() at the call site (the enum itself is not composable).
 *
 * `route` is the NavHost pattern (used for selected-state matching); `navRoute`
 * is what tab taps actually navigate to — they differ only for CATALOG, whose
 * pattern carries an optional `{family}` arg that must be absent when built.
 */
enum class BottomDestination(
    val route: String,
    @StringRes val labelRes: Int,
    val icon: ImageVector,
    val navRoute: String = route,
) {
    HOME(Routes.HOME, R.string.nav_home, Icons.Filled.Home),
    CATALOG(Routes.CATALOG, R.string.nav_catalog, Icons.Filled.MenuBook, navRoute = Routes.catalog()),
    ORDERS(Routes.ORDERS, R.string.nav_orders, Icons.Filled.ReceiptLong),
    ACCOUNT(Routes.ACCOUNT, R.string.nav_account, Icons.Filled.Person),
}
