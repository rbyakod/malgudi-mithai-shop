// MishranApp.swift — Task 14.1/14.4 (Mishran Mobile Apps v1).
// Root: brand theme + NavigationStack driven by Router, mishran:// deep
// links via DeepLinkHandler. The placeholder home + destination views are
// scaffolding until the real screens land (16.x/17.x).
import SwiftUI

@main
struct MishranApp: App {
    @State private var router = Router()
    private let deepLinkHandler: DeepLinkHandler

    init() {
        let router = Router()
        _router = State(initialValue: router)
        // Same instance the stack binds to — deep links move the real path.
        deepLinkHandler = DeepLinkHandler(router: router)
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $router.path) {
                PlaceholderHomeView(router: router)
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
