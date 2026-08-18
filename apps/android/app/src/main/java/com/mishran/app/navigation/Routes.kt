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

    /**
     * Phone-entry sign-in. The optional `redirectTo` (B5 guest browsing)
     * names the destination an ordering intercept was trying to reach — it
     * rides along to OTP and back, so a freshly signed-in user resumes the
     * intercepted action instead of landing on Home.
     */
    const val AUTH_PHONE = "auth/phone?redirectTo={redirectTo}"

    /** OTP verify; `phone` rides along so resend can re-send in place. */
    const val AUTH_OTP = "auth/otp/{requestId}?phone={phone}&redirectTo={redirectTo}"
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

    /** Built AUTH_PHONE route: bare "auth/phone" or with the redirect arg. */
    fun authPhone(redirectTo: String? = null): String =
        if (redirectTo == null) "auth/phone" else "auth/phone?redirectTo=${encodeArg(redirectTo)}"

    /**
     * Built AUTH_OTP route. The E.164 phone carries a "+", which some query
     * parsers read as a space — encode it, and Navigation decodes on arg read
     * (its query parser also folds "+" back to a space, which form-encoding
     * produces for literals). The B5 redirect (when an ordering intercept
     * sent the user here) is forwarded so the verified session lands back on
     * the intercepted action.
     */
    fun authOtp(requestId: String, phone: String, redirectTo: String? = null): String =
        "auth/otp/$requestId?phone=${encodeArg(phone)}" +
            (redirectTo?.let { "&redirectTo=${encodeArg(it)}" } ?: "")

    /**
     * Destination for an ordering action (B5 guest browsing): the target
     * itself when a session exists, else AUTH_PHONE carrying `redirectTo` so
     * the post-login redirect resumes the intercepted action instead of
     * dropping the user on Home. Pure — the NavGraph consults it at tap time
     * against the live session flag.
     */
    fun orderingDestination(target: String, isLoggedIn: Boolean): String =
        if (isLoggedIn) target else authPhone(redirectTo = target)

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

    /**
     * Query-arg encoding via the JDK (form style: space → "+"), not
     * android.net.Uri — keeps the builders pure so they run in JVM tests.
     * Navigation's query decode folds "+" back to a space, round-tripping.
     */
    private fun encodeArg(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")

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
