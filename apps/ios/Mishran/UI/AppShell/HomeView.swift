// HomeView.swift — shell wiring owed since Task 16.3; restructured in P1 to
// the Android HomeScreen shape: a photo hero (web hero's counterpart), a
// best-sellers rail, and a "Your orders" affordance. P2: the shop-by-family
// chips grew into the "Shop by vertical" portals row (image cards that open
// the catalog with the tab preselected — family filtering still lives in
// the catalog's filter sheet), and the "From the journal" rail previews the
// three newest stories. The full catalog grid lives one push away
// (Route.catalog) via the hero CTA / toolbar; offline-first catalog rows
// back every section. The view model builds only once a SwiftData container
// exists.
// Task 48.1: with no session the toolbar also offers the sign-in entry —
// before this the auth flow was unreachable outside launch arguments.
// Task 20.3: section strings wired to packages/i18n-strings via L().
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
                repository: CatalogRepository(client: MishranAPIClient(), cache: cache),
                storyRepository: StoryRepository(client: MishranAPIClient(), context: container.mainContext),
                verticalsRepository: VerticalsRepository(client: MishranAPIClient())
            )
            viewModel = model
            await model.load()
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarLeading) {
            Button {
                router.push(.catalog(vertical: .mithai, family: nil))
            } label: {
                Label(L("nav.catalog"), systemImage: "square.grid.2x2")
            }
            .accessibilityLabel("Browse all sweets")
            if !hasSession {
                Button {
                    onSignInRequested?()
                } label: {
                    Label(L("home.sign_in"), systemImage: "person.badge.key")
                }
                .accessibilityLabel(L("home.sign_in"))
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            NavigationLink(value: Route.cart) {
                Label(L("nav.cart"), systemImage: "cart")
            }
            .accessibilityLabel(L("nav.cart"))
            NavigationLink(value: Route.orders) {
                Label(L("nav.orders"), systemImage: "shippingbox")
            }
            .accessibilityLabel(L("nav.orders"))
            NavigationLink(value: Route.account) {
                Label(L("nav.account"), systemImage: "person.crop.circle")
            }
            .accessibilityLabel(L("nav.account"))
        }
    }

    @ViewBuilder
    private func content(_ viewModel: HomeViewModel) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero(bestSellers: viewModel.bestSellers)

                sectionHeader(L("home.best_sellers"))
                bestSellersRail(viewModel)

                sectionHeader(L("home.shop_by_vertical"))
                verticalPortalsRow(viewModel)

                if !viewModel.latestStories.isEmpty {
                    sectionHeader(L("home.journal"))
                    journalRail(viewModel)
                }

                Spacer(minLength: .mishranSpacingMd)
                HStack {
                    Spacer()
                    Button {
                        router.push(.orders)
                    } label: {
                        Label(L("home.your_orders"), systemImage: "shippingbox")
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
                Text(L("app.name"))
                    .font(.mishranDisplay.weight(.light))
                    .foregroundStyle(.white)
                Text(L("app.tagline"))
                    .font(.mishranBodyLg)
                    .foregroundStyle(.white.opacity(0.85))
                Button {
                    router.push(.catalog(vertical: .mithai, family: nil))
                } label: {
                    Text(L("home.browse"))
                        .font(.mishranBodyMd.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(.white)
                .foregroundStyle(Color.mishranBrandAccent)
                .controlSize(.large)
                .accessibilityLabel(L("home.browse"))
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

    /// Shop-by-vertical portals: image cards that open the catalog with the
    /// tab preselected (Route.catalog carries the vertical — the family
    /// seam's P2 extension). Placeholder portals keep the row's layout
    /// stable until the vertical pages land.
    private func verticalPortalsRow(_ viewModel: HomeViewModel) -> some View {
        let portals = viewModel.portals.isEmpty ? Vertical.placeholderPortals : viewModel.portals
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .mishranSpacingMd) {
                ForEach(portals) { portal in
                    Button {
                        router.push(.catalog(vertical: portal.vertical, family: nil))
                    } label: {
                        VerticalPortalCard(portal: portal)
                    }
                    .buttonStyle(.plain)
                    .frame(width: 150)
                    .accessibilityLabel("Shop \(portal.vertical.displayName)")
                    .accessibilityHint(portal.count > 0 ? "Browse \(portal.count) items" : "Browse this vertical")
                }
            }
            .padding(.horizontal, .mishranSpacingLg)
            .padding(.vertical, .mishranSpacingXs)
        }
    }

    /// "From the journal": the three newest stories, best-sellers-rail
    /// idiom (horizontal cards; tap opens the reader).
    private func journalRail(_ viewModel: HomeViewModel) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .mishranSpacingMd) {
                ForEach(viewModel.latestStories, id: \.id) { story in
                    Button {
                        router.push(.story(slug: story.slug))
                    } label: {
                        VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                            ProductRemoteImage(imageURL: story.heroImage)
                                .frame(height: 110)
                                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                                .accessibilityHidden(true)
                            Text(story.title)
                                .font(.mishranBodyMd.weight(.semibold))
                                .foregroundStyle(Color.mishranBrandInk)
                                .multilineTextAlignment(.leading)
                                .lineLimit(2)
                            if let pillar = story.pillar {
                                Text(pillar.capitalized)
                                    .font(.mishranBodySm)
                                    .foregroundStyle(Color.mishranBrandAccent)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.mishranSpacingSm)
                        .frame(width: 190, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: .mishranRadiusMd)
                                .fill(Color.mishranBrandSurface)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(story.title)
                    .accessibilityHint("Read this story")
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

/// One Shop-by-vertical portal tile: lead imagery over the label + count
/// (ProductCard's surface/border language at a shorter image).
private struct VerticalPortalCard: View {
    let portal: VerticalPortal

    var body: some View {
        VStack(alignment: .leading, spacing: .mishranSpacingSm) {
            ProductRemoteImage(imageURL: portal.imageURL)
                .frame(height: 90)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityHidden(true)
            Text(portal.label)
                .font(.mishranBodyMd.weight(.semibold))
                .foregroundStyle(Color.mishranBrandInk)
                .lineLimit(1)
        }
        .padding(.mishranSpacingSm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: .mishranRadiusMd)
                .fill(Color.mishranBrandSurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: .mishranRadiusMd)
                .strokeBorder(Color.mishranBrandAccent.opacity(0.15), lineWidth: 1)
        )
    }
}
