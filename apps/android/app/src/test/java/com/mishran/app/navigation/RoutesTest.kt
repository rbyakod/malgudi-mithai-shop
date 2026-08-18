// apps/android/app/src/test/java/com/mishran/app/navigation/RoutesTest.kt — B5 guest browsing.
//
// JVM tests for the route builders' guest-redirect contract: the ordering
// intercepts (checkout, buy-now) route a null session to AUTH_PHONE carrying
// redirectTo=<target>, so the OTP-verified session resumes the intercepted
// action instead of dropping on Home. Pure functions — no NavHost needed.
package com.mishran.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class RoutesTest {

    // ---- B5 ordering intercept --------------------------------------------

    @Test
    fun `guest tapping checkout routes to sign-in carrying the redirect`() {
        // Not CHECKOUT — the tap must never walk a guest into a 401 mid-flow.
        assertEquals(
            "auth/phone?redirectTo=checkout",
            Routes.orderingDestination(Routes.CHECKOUT, isLoggedIn = false),
        )
    }

    @Test
    fun `signed-in checkout proceeds to the target destination`() {
        assertEquals(
            Routes.CHECKOUT,
            Routes.orderingDestination(Routes.CHECKOUT, isLoggedIn = true),
        )
    }

    @Test
    fun `orders intercept redirects back to the orders tab`() {
        assertEquals(
            "auth/phone?redirectTo=orders",
            Routes.orderingDestination(Routes.ORDERS, isLoggedIn = false),
        )
    }

    // ---- redirect-aware auth route builders --------------------------------

    @Test
    fun `authPhone without a redirect builds the bare route`() {
        assertEquals("auth/phone", Routes.authPhone())
        assertEquals("auth/phone", Routes.authPhone(redirectTo = null))
    }

    @Test
    fun `authPhone url-encodes the redirect target`() {
        // Form-style: space → "+" (Navigation folds it back on decode).
        assertEquals(
            "auth/phone?redirectTo=some%2Fencoded+target",
            Routes.authPhone(redirectTo = "some/encoded target"),
        )
    }

    @Test
    fun `authOtp forwards the redirect alongside the phone`() {
        assertEquals(
            "auth/otp/req-1?phone=%2B919000000000&redirectTo=checkout",
            Routes.authOtp("req-1", "+919000000000", redirectTo = Routes.CHECKOUT),
        )
    }

    @Test
    fun `authOtp without a redirect keeps the legacy shape`() {
        assertEquals(
            "auth/otp/req-1?phone=%2B919000000000",
            Routes.authOtp("req-1", "+919000000000"),
        )
    }
}
