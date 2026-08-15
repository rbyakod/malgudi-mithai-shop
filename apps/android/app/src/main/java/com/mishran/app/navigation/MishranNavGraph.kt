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
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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
import dagger.hilt.android.EntryPointAccessors
import com.mishran.app.ui.auth.BiometricGate
import com.mishran.app.ui.auth.OtpScreen
import com.mishran.app.ui.auth.PhoneEntryScreen
import com.mishran.app.data.sync.PushRegistrationScheduler
import com.mishran.app.push.PushEventBusEntryPoint
import com.mishran.app.push.notificationBody
import com.mishran.app.ui.account.AccountScreen
import com.mishran.app.ui.addresses.AddressesScreen
import com.mishran.app.ui.cart.CartScreen
import com.mishran.app.ui.home.HomeScreen
import com.mishran.app.ui.catalog.CatalogScreen
import com.mishran.app.ui.checkout.CheckoutScreen
import com.mishran.app.ui.orderconfirmed.OrderConfirmedScreen
import com.mishran.app.ui.orders.OrderDetailScreen
import com.mishran.app.ui.orders.OrderListScreen
import com.mishran.app.ui.product.ProductDetailScreen

/**
 * Root of the app UI. Wire this into [com.mishran.app.MainActivity]; it owns
 * the [NavHostController] and decides whether the bottom bar is visible.
 */
@Composable
fun MishranAppRoot() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // Task 11.3: pushes landing while the app is foregrounded surface as an
    // in-app snackbar instead of only a system notification.
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val pushEventBus = remember {
        EntryPointAccessors.fromApplication<PushEventBusEntryPoint>(
            context.applicationContext,
        ).pushEventBus()
    }
    LaunchedEffect(pushEventBus) {
        pushEventBus.events.collect { event ->
            snackbarHostState.showSnackbar(notificationBody(event.stage))
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (currentRoute in Routes.topLevel) {
                MishranBottomBar(
                    currentRoute = currentRoute,
                    onNavigate = { destination ->
                        navController.navigate(destination.navRoute) {
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
                // Cold-start auth gate (Task 8.2): biometric-locked session →
                // prompt → Home; plain session → Home; otherwise → phone entry.
                // Either outcome pops SPLASH so the destination becomes the new
                // back-stack root (Back from Home/AUTH_PHONE exits the app).
                BiometricGate(
                    onUnlocked = {
                        navController.navigate(Routes.HOME) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                inclusive = true
                            }
                            launchSingleTop = true
                        }
                    },
                    onNeedLogin = {
                        navController.navigate(Routes.AUTH_PHONE) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                inclusive = true
                            }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(Routes.AUTH_PHONE) {
                PhoneEntryScreen(onOtpSent = { requestId ->
                    navController.navigate(Routes.authOtp(requestId))
                })
            }
            composable(
                route = Routes.AUTH_OTP,
                arguments = listOf(navArgument("requestId") { type = NavType.StringType }),
            ) {
                OtpScreen(
                    onVerified = {
                        // Session exists now — upload the FCM token (Task 11.3).
                        PushRegistrationScheduler.enqueue(context)
                        // Clear the entire back stack (splash + auth) so HOME is the
                        // new root: Back from Home exits the app, never returns to login.
                        navController.navigate(Routes.HOME) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                inclusive = true
                            }
                            launchSingleTop = true
                        }
                    },
                    onResend = { navController.popBackStack(Routes.AUTH_PHONE, inclusive = false) },
                )
            }
            composable(Routes.HOME) {
                // Real home since the placeholder era: greeting + featured rail
                // off the cached catalog, CTAs into Catalog and Orders.
                HomeScreen(
                    onProductClick = { slug -> navController.navigate(Routes.product(slug)) },
                    onBrowseCatalog = { navController.navigate(Routes.catalog()) },
                    onFamilyClick = { family -> navController.navigate(Routes.catalog(family)) },
                    onOrders = { navController.navigate(Routes.ORDERS) },
                )
            }
            // Task 9.3: offline-first catalog browse (grid + search + filters).
            // Optional ?family= arg seeds the family filter (Home's cards).
            composable(
                route = Routes.CATALOG,
                arguments = listOf(
                    navArgument("family") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) {
                CatalogScreen(
                    onProductClick = { product ->
                        navController.navigate(Routes.product(product.slug))
                    },
                    onCartClick = { navController.navigate(Routes.CART) },
                )
            }
            composable(
                route = Routes.PRODUCT,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Task 9.4/10.1: detail (gallery + stepper); Add-to-cart writes
                // the Room cart, then pops back to where the user came from.
                ProductDetailScreen(onAddedToCart = { navController.popBackStack() })
            }
            composable(Routes.CART) {
                // Task 10.1: local cart. Checkout is Task 10.2-10.4.
                CartScreen(
                    onCheckout = { navController.navigate(Routes.CHECKOUT) },
                    onBrowse = {
                        navController.navigate(Routes.catalog()) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(Routes.CHECKOUT) {
                // Task 10.3: validate → create-order → Razorpay → verify.
                // Task 10.4: success lands on the confirmation screen, not the
                // order list; back from there returns Home (cart is gone).
                CheckoutScreen(
                    onOrderPlaced = { orderId ->
                        navController.navigate(Routes.orderConfirmed(orderId)) {
                            popUpTo(Routes.HOME) { inclusive = false }
                        }
                    },
                )
            }
            composable(Routes.ORDERS) {
                // Task 11.1: offline-first order history (Room cache + refresh).
                OrderListScreen(
                    onOrderClick = { orderId ->
                        navController.navigate(Routes.orderDetail(orderId))
                    },
                    onOpenCart = { navController.navigate(Routes.CART) },
                    onBrowse = {
                        navController.navigate(Routes.catalog()) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(
                route = Routes.ORDER_CONFIRMED,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { entry ->
                val orderId = entry.arguments?.getString("id").orEmpty()
                OrderConfirmedScreen(
                    orderId = orderId,
                    onTrackOrder = { id ->
                        navController.navigate(Routes.orderDetail(id)) {
                            launchSingleTop = true
                        }
                    },
                    onContinueShopping = {
                        navController.navigate(Routes.catalog()) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(
                route = Routes.ORDER_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
                deepLinks = listOf(navDeepLink { uriPattern = Routes.ORDER_DEEPLINK_PATTERN }),
            ) { entry ->
                // Task 11.1: serves the Orders tab, Track-order CTA, and the
                // mishran://order/{id} push deep link. Support CTA dials the
                // support line (placeholder number until launch). NavBackStackEntry's
                // context is private, so grab the composition's instead.
                val context = LocalContext.current
                OrderDetailScreen(
                    onCallSupport = {
                        val dial = android.content.Intent(
                            android.content.Intent.ACTION_DIAL,
                            android.net.Uri.parse("tel:${com.mishran.app.ui.orders.SUPPORT_PHONE}"),
                        )
                        context.startActivity(dial)
                    },
                )
            }
            composable(Routes.ACCOUNT) {
                // Signed-in identity + sign-out. Clearing the whole stack back
                // to AUTH_PHONE keeps Back from resurrecting the dead session.
                AccountScreen(
                    onOpenAddresses = { navController.navigate(Routes.ADDRESSES) },
                    onSignedOut = {
                        navController.navigate(Routes.AUTH_PHONE) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                inclusive = true
                            }
                            launchSingleTop = true
                        }
                    },
                )
            }
            composable(Routes.ADDRESSES) {
                // Saved delivery addresses (Account → Delivery addresses).
                // Checkout's picker reads the same server-side list.
                AddressesScreen(onBack = { navController.popBackStack() })
            }
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
