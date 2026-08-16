// apps/android/app/src/main/java/com/mishran/app/navigation/MishranNavGraph.kt — Task 7.4.
//
// Single-activity Compose NavGraph. A [MishranAppRoot] Scaffold hosts a bottom
// navigation bar (Home / Catalog / Orders / Account) over a NavHost; detail and
// flow screens (product, cart, checkout, order detail, auth) render full-screen
// with the bar hidden. The order-detail destination accepts the
// `mishran://order/{id}` deep link so a push-notification / Wallet tap can
// re-enter the app straight onto an order.
//
// The Phase 7 graph shipped with placeholder screens; Phases 8–12 replaced
// every one of them with the real compositions behind the same routes, so the
// route shape is the surviving contract of this file.
package com.mishran.app.navigation

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
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
import com.mishran.app.data.repository.SettingsRepositoryEntryPoint
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
import com.mishran.app.ui.stories.StoriesScreen
import com.mishran.app.ui.stories.StoryReaderScreen
import com.mishran.app.ui.enquiry.EnquiryScreen
import com.mishran.app.ui.gift.GiftScreen
import com.mishran.app.ui.verticals.MerchDetailScreen
import com.mishran.app.ui.verticals.QsrDetailScreen
import com.mishran.app.ui.verticals.SnackDetailScreen

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

    // Task 13.1: runtime POST_NOTIFICATIONS request (Android 13+). Fired once,
    // on the user's first arrival at HOME — the one destination both the
    // OTP-fresh and biometric-returning paths land on. The result is unused
    // (denied is a valid state — ordering never depends on it), the asked flag
    // is persisted before the dialog opens so the app never re-prompts, and
    // navigation is never blocked on the outcome.
    val settingsRepository = remember {
        EntryPointAccessors.fromApplication<SettingsRepositoryEntryPoint>(
            context.applicationContext,
        ).settingsRepository()
    }
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* Result unused: granted or denied, the flag below stops a re-ask. */ }
    LaunchedEffect(currentRoute) {
        if (currentRoute == Routes.HOME &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !settingsRepository.isNotificationPermissionAsked()
        ) {
            settingsRepository.markNotificationPermissionAsked()
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    // Task 10.4: ETA extras for the confirmation screen. They ride a
    // composition-level holder instead of the route string (the slot label
    // carries spaces/punctuation not worth URL-encoding) and are rewritten on
    // every checkout success, so a stale ETA can never leak forward.
    var confirmedOrderSlotLabel by remember { mutableStateOf<String?>(null) }
    var confirmedOrderSlaDays by remember { mutableStateOf<Int?>(null) }

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
                // off the cached catalog, CTAs into Catalog and Orders. P2
                // net-new: the journal rail + vertical portals deep-link into
                // the new surfaces. P3: the admin hero carousel's slide CTA —
                // mithai slides go to product detail, other verticals to
                // their Batch E detail routes.
                HomeScreen(
                    onProductClick = { slug -> navController.navigate(Routes.product(slug)) },
                    onBrowseCatalog = { navController.navigate(Routes.catalog()) },
                    onFamilyClick = { family -> navController.navigate(Routes.catalog(family)) },
                    onVerticalClick = { vertical ->
                        navController.navigate(Routes.catalog(vertical = vertical))
                    },
                    onHeroSlideClick = { vertical, slug ->
                        when (vertical) {
                            "mithai" -> navController.navigate(Routes.product(slug))
                            "snacks" -> navController.navigate(Routes.snack(slug))
                            "qsr" -> navController.navigate(Routes.qsrItem(slug))
                            "merch" -> navController.navigate(Routes.merchItem(slug))
                        }
                    },
                    onStoryClick = { slug -> navController.navigate(Routes.story(slug)) },
                    onJournal = { navController.navigate(Routes.stories()) },
                    // Parity batch: "Why Mishran" cards — journal with the
                    // pillar preselected via the ?pillar= arg.
                    onPillarClick = { pillar -> navController.navigate(Routes.stories(pillar)) },
                    onOrders = { navController.navigate(Routes.ORDERS) },
                )
            }
            // Task 9.3: offline-first catalog browse (grid + search + filters).
            // Optional ?family= arg seeds the family filter (Home's cards);
            // ?vertical= selects the tab (Home's portals, P2 net-new).
            composable(
                route = Routes.CATALOG,
                arguments = listOf(
                    navArgument("family") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("vertical") {
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
                    onSnackClick = { slug -> navController.navigate(Routes.snack(slug)) },
                    onQsrClick = { slug -> navController.navigate(Routes.qsrItem(slug)) },
                    onMerchClick = { slug -> navController.navigate(Routes.merchItem(slug)) },
                )
            }
            composable(
                route = Routes.PRODUCT,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Task 9.4/10.1: detail (gallery + stepper); Add-to-cart writes
                // the Room cart, then pops back to where the user came from.
                // P1 parity: Buy now performs the same write (selected pack +
                // qty) and goes straight to checkout — the one-shot flow.
                ProductDetailScreen(
                    onAddedToCart = { navController.popBackStack() },
                    onBuyNow = { navController.navigate(Routes.CHECKOUT) },
                    // Parity batch: "Ask on WhatsApp" opens the wa.me link the
                    // screen composed (product facts + selected pack).
                    onWhatsApp = { url ->
                        val chat = android.content.Intent(
                            android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(url),
                        )
                        context.startActivity(chat)
                    },
                )
            }
            composable(Routes.CART) {
                // Task 10.1: local cart. Checkout is Task 10.2-10.4.
                // Parity batch: "Send order on WhatsApp" opens the wa.me link
                // the screen composed (lines + estimated total).
                CartScreen(
                    onWhatsApp = { url ->
                        val chat = android.content.Intent(
                            android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(url),
                        )
                        context.startActivity(chat)
                    },
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
                // order list; back from there returns Home (cart is gone). The
                // slot label / shelf SLA ride along for the ETA line.
                CheckoutScreen(
                    onOrderPlaced = { orderId, slotLabel, shelfSlaDays ->
                        confirmedOrderSlotLabel = slotLabel
                        confirmedOrderSlaDays = shelfSlaDays
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
                    slotLabel = confirmedOrderSlotLabel,
                    shelfSlaDays = confirmedOrderSlaDays,
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
                // Signed-in identity + support + sign-out. Clearing the whole
                // stack back to AUTH_PHONE keeps Back from resurrecting the
                // dead session. P1 parity: the support row opens WhatsApp via
                // wa.me/<digits> (the brand number from GET /brand, placeholder
                // digits until that lands — the ViewModel resolves which).
                AccountScreen(
                    onOpenAddresses = { navController.navigate(Routes.ADDRESSES) },
                    onOpenJournal = { navController.navigate(Routes.stories()) },
                    onOpenGift = { navController.navigate(Routes.GIFT) },
                    onOpenEnquiry = { navController.navigate(Routes.enquiry()) },
                    onWhatsApp = { digits ->
                        val chat = android.content.Intent(
                            android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse("https://wa.me/$digits"),
                        )
                        context.startActivity(chat)
                    },
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
            // ---- P2 net-new surfaces ------------------------------------------
            composable(
                route = Routes.STORIES,
                arguments = listOf(
                    navArgument("pillar") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) {
                // Journal list (Home rail / Account row / Home's "Why Mishran"
                // cards via ?pillar=). Newest-first with a hero card; the
                // optional pillar preselects the filter chip; pull-to-refresh
                // forces a network pass.
                StoriesScreen(
                    onBack = { navController.popBackStack() },
                    onStoryClick = { slug -> navController.navigate(Routes.story(slug)) },
                )
            }
            composable(Routes.GIFT) {
                // Parity batch: the gift-builder lead form (Account's "Build a
                // gift" row). Same one-shot POST /api/leads intake as the
                // enquiry form, typed "gift-builder-draft".
                GiftScreen(onBack = { navController.popBackStack() })
            }
            composable(
                route = Routes.STORY,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Reader: hero image + flattened paragraphs; network-first with
                // the cached body as the offline fallback.
                StoryReaderScreen(onBack = { navController.popBackStack() })
            }
            composable(
                route = Routes.ENQUIRY,
                arguments = listOf(
                    navArgument("type") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) {
                // Wedding/corporate lead form; merch's Enquire CTA presets
                // ?type=corporate.
                EnquiryScreen(onBack = { navController.popBackStack() })
            }
            composable(
                route = Routes.SNACK,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Retail snack: "Where to buy" rows open the retailer in the
                // external browser (ACTION_VIEW — the installed Custom Tabs
                // provider or plain browser), mirroring the WhatsApp row.
                SnackDetailScreen(
                    onBack = { navController.popBackStack() },
                    onOpenRetailer = { url ->
                        val open = android.content.Intent(
                            android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(url),
                        )
                        context.startActivity(open)
                    },
                )
            }
            composable(
                route = Routes.QSR_ITEM,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Walk-in counter item: veg/spice + store chips, no cart CTA.
                QsrDetailScreen(onBack = { navController.popBackStack() })
            }
            composable(
                route = Routes.MERCH_ITEM,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) {
                // Enquiry-led merch: the CTA lands on the enquiry form with the
                // type preset to corporate.
                MerchDetailScreen(
                    onBack = { navController.popBackStack() },
                    onEnquire = {
                        navController.navigate(Routes.enquiry(type = "corporate"))
                    },
                )
            }
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
                icon = {
                    Icon(destination.icon, contentDescription = stringResource(destination.labelRes))
                },
                label = { Text(stringResource(destination.labelRes)) },
            )
        }
    }
}
