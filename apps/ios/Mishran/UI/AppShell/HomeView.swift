// HomeView.swift — shell wiring owed since Task 16.3; restructured in P1 to
// the Android HomeScreen shape: a photo hero (web hero's counterpart), a
// best-sellers rail, shop-by-family chips that seed the catalog tab's
// filter, and a "Your orders" affordance. The full catalog grid lives one
// push away (Route.catalog) via the hero CTA / toolbar; offline-first
// catalog rows back every section. The view model builds only once a
// SwiftData container exists.
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

    @State private var viewModel: HomeViewModel?

    /// Cheap keychain probe on the main thread: no refresh token = signed
    /// out. Fine per render (one small SecItem read; the token pair is a
    /// single generic-password item).
    private var hasSession: Bool {
        KeychainTokenStore().refreshToken != nil
    }

    var body: some View {
        Group {
            if let viewModel {
                content(viewModel)
                    .toolbar { toolbarContent }
            } else {
                ProgressView()
            }
        }
        .task {
            onAppearTask?()
            guard viewModel == nil, let container else { return }
            let cache = await CatalogCache(context: container.mainContext)
            let model = HomeViewModel(
                repository: CatalogRepository(client: MishranAPIClient(), cache: cache)
            )
            viewModel = model
            await model.load()
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarLeading) {
            Button {
                router.push(.catalog(family: nil))
            } label: {
                Label("Sweets", systemImage: "square.grid.2x2")
            }
            .accessibilityLabel("Browse all sweets")
            if !hasSession {
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

    @ViewBuilder
    private func content(_ viewModel: HomeViewModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero(bestSellers: viewModel.bestSellers)

                sectionHeader("Best sellers")
                bestSellersRail(viewModel)

                sectionHeader("Shop by family")
                familyChipsRow(viewModel)

                Spacer(minLength: .mishranSpacingMd)
                HStack {
                    Spacer()
                    Button {
                        router.push(.orders)
                    } label: {
                        Label("Your orders", systemImage: "shippingbox")
                            .font(.mishranBodyLg.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.mishranBrandAccent)
                    .controlSize(.large)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .accessibilityLabel("Your orders")
                    .accessibilityHint("See the orders you have placed")
                    Spacer()
                }
                .padding(.horizontal, .mishranSpacingLg)
                Spacer(minLength: .mishranSpacingLg)
            }
        }
        .refreshable {
            await viewModel.load()
        }
        .background(Color.mishranBrandCanvas)
    }

    /// Photo hero over the first best seller's image, scrim, wordmark +
    /// tagline + browse CTA (web home's counterpart; Android parity).
    private func hero(bestSellers: [ProductEntity]) -> some View {
        ZStack(alignment: .bottomLeading) {
            ProductRemoteImage(imageURL: bestSellers.first?.images?.first)
                .frame(height: 260)
                .clipped()
                .accessibilityHidden(true)
            LinearGradient(
                colors: [.black.opacity(0.25), .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Text("Mishran")
                    .font(.mishranDisplay.weight(.light))
                    .foregroundStyle(.white)
                Text("Fresh mithai, made every day.")
                    .font(.mishranBodyLg)
                    .foregroundStyle(.white.opacity(0.85))
                Button {
                    router.push(.catalog(family: nil))
                } label: {
                    Text("Browse sweets")
                        .font(.mishranBodyMd.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(.white)
                .foregroundStyle(Color.mishranBrandAccent)
                .controlSize(.large)
                .accessibilityLabel("Browse sweets")
                .accessibilityHint("Open the full sweets catalog")
            }
            .padding(.mishranSpacingLg)
        }
    }

    @ViewBuilder
    private func bestSellersRail(_ viewModel: HomeViewModel) -> some View {
        if viewModel.products.isEmpty {
            HStack {
                Spacer()
                ProgressView()
                    .padding(.vertical, .mishranSpacingXl)
                Spacer()
            }
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingMd) {
                    ForEach(viewModel.bestSellers, id: \.id) { product in
                        ProductCard(product: product) {
                            router.push(.productDetail(slug: product.slug))
                        }
                        .frame(width: 180)
                    }
                }
                .padding(.horizontal, .mishranSpacingLg)
                .padding(.vertical, .mishranSpacingXs)
            }
        }
    }

    /// Family chips seed the catalog tab's family filter (Android's
    /// SavedStateHandle deep-link, iOS-style: the route carries the family).
    private func familyChipsRow(_ viewModel: HomeViewModel) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .mishranSpacingSm) {
                ForEach(viewModel.familyChips) { chip in
                    Button {
                        router.push(.catalog(family: chip.family))
                    } label: {
                        Text(chip.label)
                            .font(.mishranBodyMd)
                            .foregroundStyle(Color.mishranBrandInk)
                            .padding(.horizontal, .mishranSpacingMd)
                            .frame(minHeight: 44)
                            .background(
                                Capsule().fill(Color.mishranBrandSurface)
                            )
                            .overlay(
                                Capsule().strokeBorder(Color.mishranBrandAccent.opacity(0.4), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Shop \(chip.family.displayName)")
                    .accessibilityHint(chip.count > 0 ? "Show \(chip.count) sweets" : "Show this family")
                }
            }
            .padding(.horizontal, .mishranSpacingLg)
            .padding(.vertical, .mishranSpacingXs)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.mishranBodyXl.weight(.semibold))
            .foregroundStyle(Color.mishranBrandInk)
            .padding(.horizontal, .mishranSpacingLg)
            .padding(.top, .mishranSpacingLg)
            .padding(.bottom, .mishranSpacingSm)
            .accessibilityAddTraits(.isHeader)
    }
}
