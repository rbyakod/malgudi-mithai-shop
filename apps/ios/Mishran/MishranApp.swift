// MishranApp.swift — Task 14.1/14.4 (Mishran Mobile Apps v1).
// Root: brand theme + NavigationStack driven by Router, mishran:// deep
// links via DeepLinkHandler. The placeholder home + destination views are
// scaffolding until the real screens land (16.x/17.x).
import SwiftUI

@main
struct MishranApp: App {
    @State private var router = Router()
    private let deepLinkHandler: DeepLinkHandler

    /// Launch gate (Task 15.4): biometric unlock when the user enabled it
    /// AND a refresh token survives in the keychain.
    private enum LaunchScreen {
        case home, biometricGate, signIn
    }

    @State private var launchScreen: LaunchScreen

    init() {
        let router = Router()
        _router = State(initialValue: router)
        // Same instance the stack binds to — deep links move the real path.
        deepLinkHandler = DeepLinkHandler(router: router)
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
    }
}

/// Scaffold destinations per route — one placeholder line each so every
/// Route case renders (and UI tests can assert on stable text).
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
            Text("Orders")
        case let .orderDetail(id):
            Text("Order \(id)")
        }
    }
}
