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
        // Task 16.2: register the 6h catalog refresh before launch finishes;
        // schedule the first run. Same container the environment gets.
        if let container = try? ModelContainerFactory.makeContainer() {
            _modelContainer = State(initialValue: container)
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

        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-authScreen") {
            // UI-test preview of the sign-in flow (15.2) until the app shell
            // routes there on its own.
            _launchScreen = State(initialValue: .signIn)
        } else if BiometricSettings.isEnabled, KeychainTokenStore().refreshToken != nil {
            _launchScreen = State(initialValue: .biometricGate)
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
                        PlaceholderHomeView(router: router)
                            // First home appearance (Task 18.3): ask for
                            // notification permission once, then register
                            // with APNs. The token lands in DeviceRegistrar
                            // via the system notification it observes.
                            .task {
                                await PushPermissionRequester.live.requestIfNeeded()
                                UIApplication.shared.registerForRemoteNotifications()
                            }
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    PlaceholderDestinationView(route: route)
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

/// Scaffold home: sample product rows pushing .productDetail. Replaced by
/// the catalog screen in 16.x.
struct PlaceholderHomeView: View {
    let router: Router

    private let samples = [
        "kaju-katli": "Kaju Katli",
        "motichoor-laddoo": "Motichoor Laddoo",
    ]

    var body: some View {
        List {
            ForEach(samples.sorted(by: { $0.key < $1.key }), id: \.key) { slug, name in
                Button {
                    router.push(.productDetail(slug: slug))
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(name).font(.body.weight(.semibold))
                        Text(slug).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .accessibilityLabel(name)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Mishran")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink(value: Route.account) {
                    Label("Account", systemImage: "person.crop.circle")
                }
                .accessibilityLabel("Account")
            }
        }
    }
}

/// Scaffold destinations per route — one placeholder line each so every
/// Route case renders (and UI tests can assert on stable text). Real
/// screens replace their placeholder as their tasks land (18.1: orders).
struct PlaceholderDestinationView: View {
    let route: Route

    var body: some View {
        switch route {
        case let .productDetail(slug):
            Text("Product: \(slug)")
        case .cart:
            Text("Cart")
        case .checkout:
            Text("Checkout")
        case let .orderConfirmed(id):
            Text("Confirmed \(id)")
        case .orders:
            OrderListView()
        case let .orderDetail(id):
            OrderDetailView(orderId: id)
        case .account:
            AccountView()
        }
    }
}
