// apps/android/app/src/main/java/com/mishran/app/navigation/Routes.kt — Task 7.4.
//
// Central route table for the Compose NavGraph. Routes with path params are
// declared as templates ("order/{id}") and paired with builder helpers so call
// sites never hand-format strings. Keeping every route here means deep links,
// bottom-nav, and programmatic navigate() calls all reference one source of
// truth — no drift between the manifest intent-filter and the NavHost.
package com.mishran.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.ui.graphics.vector.ImageVector

object Routes {
    const val SPLASH = "splash"
    const val AUTH_PHONE = "auth/phone"
    const val AUTH_OTP = "auth/otp/{requestId}"
    const val HOME = "home"
    /** Pattern with an optional family filter arg (Home's family cards). */
    const val CATALOG = "catalog?family={family}"
    const val PRODUCT = "product/{slug}"
    const val CART = "cart"
    const val CHECKOUT = "checkout"
    const val ORDERS = "orders"
    const val ORDER_CONFIRMED = "order-confirmed/{id}"
    const val ORDER_DETAIL = "order/{id}"
    const val ACCOUNT = "account"
    const val ADDRESSES = "addresses"

    /** Deep-link URI pattern — must stay in lockstep with the manifest intent-filter. */
    const val ORDER_DEEPLINK_PATTERN = "mishran://order/{id}"

    fun authOtp(requestId: String): String = "auth/otp/$requestId"
    /** Built CATALOG route: bare "catalog" (all families) or filtered. */
    fun catalog(family: String? = null): String =
        if (family == null) "catalog" else "catalog?family=$family"
    fun product(slug: String): String = "product/$slug"
    fun orderConfirmed(id: String): String = "order-confirmed/$id"
    fun orderDetail(id: String): String = "order/$id"

    /** Routes that show the bottom navigation bar. */
    val topLevel: Set<String> = setOf(HOME, CATALOG, ORDERS, ACCOUNT)
}

/**
 * A bottom-navigation destination. Labels are plain English for now; once the
 * i18n layer is wired (Phase 12), these become string-resource references.
 *
 * `route` is the NavHost pattern (used for selected-state matching); `navRoute`
 * is what tab taps actually navigate to — they differ only for CATALOG, whose
 * pattern carries an optional `{family}` arg that must be absent when built.
 */
enum class BottomDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val navRoute: String = route,
) {
    HOME(Routes.HOME, "Home", Icons.Filled.Home),
    CATALOG(Routes.CATALOG, "Catalog", Icons.Filled.MenuBook, navRoute = Routes.catalog()),
    ORDERS(Routes.ORDERS, "Orders", Icons.Filled.ReceiptLong),
    ACCOUNT(Routes.ACCOUNT, "Account", Icons.Filled.Person),
}
