// HomeView.swift — shell wiring owed since Task 16.3, landed ahead of the
// 20.x hardening flows (E2E needs the real catalog as the launch surface).
// Catalog is the home: offline-first grid, toolbar hops to cart / orders /
// account. The view model builds only once a SwiftData container exists.
// Task 48.1: with no session the toolbar also offers the sign-in entry —
// before this the auth flow was unreachable outside launch arguments.
import SwiftData
import SwiftUI

struct HomeView: View {
    let router: Router
    let container: ModelContainer?
    /// The 18.3 push kick: ask permission once, then register with APNs.
    var onAppearTask: (() -> Void)? = nil
    /// Task 48.1: sign-in entry — no session in the keychain means the only
    /// path to ordering is through the auth flow the shell now surfaces.
    var onSignInRequested: (() -> Void)? = nil

    @State private var viewModel: CatalogViewModel?

    /// Cheap keychain probe on the main thread: no refresh token = signed
    /// out. Fine per render (one small SecItem read; the token pair is a
    /// single generic-password item).
    private var hasSession: Bool {
        KeychainTokenStore().refreshToken != nil
    }

    var body: some View {
        Group {
            if let viewModel {
                CatalogView(viewModel: viewModel) { product in
                    router.push(.productDetail(slug: product.slug))
                }
                .toolbar {
                    if !hasSession {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                onSignInRequested?()
                            } label: {
                                Label("Sign in", systemImage: "person.badge.key")
                            }
                            .accessibilityLabel("Sign in")
                        }
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        NavigationLink(value: Route.cart) {
                            Label("Cart", systemImage: "cart")
                        }
                        .accessibilityLabel("Cart")
                        NavigationLink(value: Route.orders) {
                            Label("Orders", systemImage: "shippingbox")
                        }
                        .accessibilityLabel("Orders")
                        NavigationLink(value: Route.account) {
                            Label("Account", systemImage: "person.crop.circle")
                        }
                        .accessibilityLabel("Account")
                    }
                }
            } else {
                ProgressView()
            }
        }
        .task {
            onAppearTask?()
            guard viewModel == nil, let container else { return }
            let cache = await CatalogCache(context: container.mainContext)
            viewModel = CatalogViewModel(
                repository: CatalogRepository(client: MishranAPIClient(), cache: cache)
            )
        }
    }
}
