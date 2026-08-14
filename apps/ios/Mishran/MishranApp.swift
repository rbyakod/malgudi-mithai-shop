// MishranApp.swift — Task 14.1/14.4 (Mishran Mobile Apps v1).
// Root: brand theme + NavigationStack driven by Router, mishran:// deep
// links via DeepLinkHandler. The placeholder home + destination views are
// scaffolding until the real screens land (16.x/17.x).
import SwiftData
import SwiftUI
import UIKit
import UserNotifications

/// Applies the modelContainer only when one was built (keeps body type
/// stable when the container is nil).
struct ModelContainerInjector: ViewModifier {
    let container: ModelContainer?

    func body(content: Content) -> some View {
        if let container {
            content.modelContainer(container)
        } else {
            content
        }
    }
}

@main
struct MishranApp: App {
    @State private var router = Router()
    private let deepLinkHandler: DeepLinkHandler
    /// Task 18.3: APNs — foreground banners + tap-to-order routing, token
    /// upsert via DeviceRegistrar.
    private let pushDelegate: PushDelegate
    private let deviceRegistrar: DeviceRegistrar

    /// Launch gate (Task 15.4): biometric unlock when the user enabled it
    /// AND a refresh token survives in the keychain.
    private enum LaunchScreen {
        case home, biometricGate, signIn
    }

    @State private var launchScreen: LaunchScreen
    /// SwiftData store (Task 16.1) — on-disk Mishran.sqlite, injected into
    /// the environment for repository consumption.
    @State private var modelContainer: ModelContainer?

    init() {
        let router = Router()
        _router = State(initialValue: router)
        // Same instance the stack binds to — deep links move the real path.
        deepLinkHandler = DeepLinkHandler(router: router)
        let arguments = ProcessInfo.processInfo.arguments
        // Task 16.2: register the 6h catalog refresh before launch finishes;
        // schedule the first run. Same container the environment gets.
        if let container = try? ModelContainerFactory.makeContainer() {
            _modelContainer = State(initialValue: container)
            // UI-test seam: seed a small catalog so headless flows can drive
            // the grid + detail without a backend (same idea as -authScreen).
            if arguments.contains(SeedData.seedCatalogArgument) {
                SeedData.seedCatalogIfNeeded(context: container.mainContext)
            }
            CatalogRefreshTask.register {
                let cache = await CatalogCache(context: container.mainContext)
                let repository = await CatalogRepository(client: MishranAPIClient(), cache: cache)
                await repository.getCatalog()
            }
            CatalogRefreshTask.scheduleNext()
        }
        // Task 18.3: APNs — foreground banners + tap-to-order routing come
        // from PushDelegate; DeviceRegistrar upserts the APNs + Live Activity
        // tokens with /notifications/register-device.
        pushDelegate = PushDelegate(router: router)
        deviceRegistrar = DeviceRegistrar(client: MishranAPIClient())
        UNUserNotificationCenter.current().delegate = pushDelegate
        deviceRegistrar.startObserving()
        DeviceRegistrar.liveActivityTokenSink = { [deviceRegistrar] token in
            Task { @MainActor in await deviceRegistrar.registerLiveActivityToken(token) }
        }

        if arguments.contains("-authScreen") {
            // UI-test preview of the sign-in flow (15.2).
            _launchScreen = State(initialValue: .signIn)
        } else if BiometricSettings.isEnabled, KeychainTokenStore().refreshToken != nil {
            _launchScreen = State(initialValue: .biometricGate)
        } else if UserDefaults.standard.bool(forKey: AuthViewModel.signedInOnceKey),
                  KeychainTokenStore().refreshToken == nil {
            // Signed in before but no session survives (server-side
            // revocation or logout) — land on sign-in, never silently
            // continue as the dead session (Task 20.5). UI tests exercise
            // this branch via the ephemeral `-signedInOnce true` launch
            // argument (argument-domain UserDefaults, nothing persisted).
            _launchScreen = State(initialValue: .signIn)
        } else {
            _launchScreen = State(initialValue: .home)
        }
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $router.path) {
                Group {
                    switch launchScreen {
                    case .biometricGate:
                        BiometricGateView(
                            onUnlocked: { launchScreen = .home },
                            onFallbackToSignIn: { launchScreen = .signIn }
                        )
                    case .signIn:
                        // `-authScreen` launch argument previews the sign-in
                        // flow for UI tests (15.2) until the app shell routes
                        // there on its own.
                        PhoneEntryView(viewModel: AuthViewModel(client: MishranAPIClient()))
                    case .home:
                        HomeView(router: router, container: modelContainer) {
                            // First home appearance (Task 18.3): ask for
                            // notification permission once, then register
                            // with APNs. The token lands in DeviceRegistrar
                            // via the system notification it observes.
                            Task {
                                await PushPermissionRequester.live.requestIfNeeded()
                                UIApplication.shared.registerForRemoteNotifications()
                            }
                        }
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    DestinationView(route: route, router: router)
                }
            }
            .mishranTheme()
            .onOpenURL { url in
                deepLinkHandler.handle(url)
            }
            .modifier(ModelContainerInjector(container: modelContainer))
        }
    }
}

/// Real destinations per route — every case renders its shipped screen
/// (shell wiring owed since 16.3; orderConfirmed landed with it).
struct DestinationView: View {
    let route: Route
    let router: Router
    @Environment(\.modelContext) private var context

    var body: some View {
        switch route {
        case let .productDetail(slug):
            ProductDetailView(slug: slug, client: MishranAPIClient(), context: context)
        case .cart:
            CartView(onCheckout: { router.push(.checkout) })
        case .checkout:
            CheckoutDestination(router: router, context: context)
        case let .orderConfirmed(id):
            OrderConfirmedView(
                orderId: id,
                onTrackOrder: { router.push(.orderDetail(id: id)) },
                onContinueShopping: { router.popToRoot() }
            )
        case .orders:
            OrderListView()
        case let .orderDetail(id):
            OrderDetailView(orderId: id)
        case .account:
            AccountView()
        }
    }
}

/// Checkout needs a view model built with the ambient model context; the
/// confirmed state routes to the thank-you screen (reset — no way back
/// into a completed checkout).
private struct CheckoutDestination: View {
    let router: Router
    let context: ModelContext
    @State private var viewModel: CheckoutViewModel?

    var body: some View {
        Group {
            if let viewModel {
                CheckoutView(viewModel: viewModel) { vm in
                    if case let .confirmed(orderId) = vm.paymentState {
                        router.reset(to: .orderConfirmed(id: orderId))
                    }
                }
            } else {
                ProgressView()
            }
        }
        .task {
            if viewModel == nil {
                viewModel = CheckoutViewModel(client: MishranAPIClient(), context: context)
            }
        }
    }
}
