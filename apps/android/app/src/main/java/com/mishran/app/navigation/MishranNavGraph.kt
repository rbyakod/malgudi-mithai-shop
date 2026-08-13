// apps/android/app/src/main/java/com/mishran/app/navigation/MishranNavGraph.kt — Task 7.4.
//
// Single-activity Compose NavGraph. A [MishranAppRoot] Scaffold hosts a bottom
// navigation bar (Home / Catalog / Orders / Account) over a NavHost; detail and
// flow screens (product, cart, checkout, order detail, auth) render full-screen
// with the bar hidden. The order-detail destination accepts the
// `mishran://order/{id}` deep link so a push-notification / Wallet tap can
// re-enter the app straight onto an order.
//
// Every destination is a placeholder for now (Phase 7 deliverable = the graph
// + navigation wiring); Phases 8–12 swap in the real screens behind the same
// routes, so this file changes in composition only, not in route shape.
package com.mishran.app.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink

/**
 * Root of the app UI. Wire this into [com.mishran.app.MainActivity]; it owns
 * the [NavHostController] and decides whether the bottom bar is visible.
 */
@Composable
fun MishranAppRoot() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        bottomBar = {
            if (currentRoute in Routes.topLevel) {
                MishranBottomBar(
                    currentRoute = currentRoute,
                    onNavigate = { destination ->
                        navController.navigate(destination.route) {
                            // Pop up to the start destination, saving state so
                            // each tab's back stack is preserved, and avoid
                            // re-creating the same destination on repeated taps.
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.SPLASH,
            modifier = Modifier.fillMaxSize().padding(innerPadding),
        ) {
            composable(Routes.SPLASH) {
                PlaceholderScreen("Splash — auth gate lands in Phase 8")
            }
            composable(Routes.AUTH_PHONE) {
                PlaceholderScreen("Sign in (phone)")
            }
            composable(
                route = Routes.AUTH_OTP,
                arguments = listOf(navArgument("requestId") { type = NavType.StringType }),
            ) { entry ->
                PlaceholderScreen("Verify OTP — requestId=${entry.arguments?.getString("requestId")}")
            }
            composable(Routes.HOME) { PlaceholderScreen("Home") }
            composable(Routes.CATALOG) { PlaceholderScreen("Catalog") }
            composable(
                route = Routes.PRODUCT,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) { entry ->
                PlaceholderScreen("Product — slug=${entry.arguments?.getString("slug")}")
            }
            composable(Routes.CART) { PlaceholderScreen("Cart") }
            composable(Routes.CHECKOUT) { PlaceholderScreen("Checkout") }
            composable(Routes.ORDERS) { PlaceholderScreen("Orders") }
            composable(
                route = Routes.ORDER_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = Routes.ORDER_DEEPLINK_PATTERN }),
            ) { entry ->
                PlaceholderScreen("Order detail — id=${entry.arguments?.getString("id")}")
            }
            composable(Routes.ACCOUNT) { PlaceholderScreen("Account") }
            composable(Routes.ADDRESSES) { PlaceholderScreen("Addresses") }
        }
    }
}

@Composable
private fun MishranBottomBar(
    currentRoute: String?,
    onNavigate: (BottomDestination) -> Unit,
) {
    NavigationBar {
        BottomDestination.entries.forEach { destination ->
            NavigationBarItem(
                selected = currentRoute == destination.route,
                onClick = { onNavigate(destination) },
                icon = { Icon(destination.icon, contentDescription = destination.label) },
                label = { Text(destination.label) },
            )
        }
    }
}

/** Themed placeholder; replaced by real screens in Phases 8–12. */
@Composable
private fun PlaceholderScreen(title: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
    }
}
