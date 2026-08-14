// HomeView.swift — shell wiring owed since Task 16.3, landed ahead of the
// 20.x hardening flows (E2E needs the real catalog as the launch surface).
// Catalog is the home: offline-first grid, toolbar hops to cart / orders /
// account. The view model builds only once a SwiftData container exists.
import SwiftData
import SwiftUI

struct HomeView: View {
    let router: Router
    let container: ModelContainer?
    /// The 18.3 push kick: ask permission once, then register with APNs.
    var onAppearTask: (() -> Void)? = nil

    @State private var viewModel: CatalogViewModel?

    var body: some View {
        Group {
            if let viewModel {
                CatalogView(viewModel: viewModel) { product in
                    router.push(.productDetail(slug: product.slug))
                }
                .toolbar {
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
