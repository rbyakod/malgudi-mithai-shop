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
                verticalsRepository: VerticalsRepository(client: MishranAPIClient()),
                heroRepository: HeroRepository(client: MishranAPIClient()),
                brandRepository: BrandRepository(client: MishranAPIClient())
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
                CartToolbarLabel()
            }
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
                // Slim brand strip above everything: the live tagline when
                // /brand carries one, else the bundled announcement line.
                announcementStrip(viewModel.announcementText)

                // Admin-curated carousel replaces the static hero when /hero
                // resolves slides; empty/failed keeps the featured fallback.
                if viewModel.hasHeroSlides {
                    HeroCarousel(
                        slides: viewModel.heroSlides,
                        autoplayMs: viewModel.heroAutoplayMs
                    ) { route in
                        router.push(route)
                    }
                } else {
                    hero(bestSellers: viewModel.bestSellers, viewModel: viewModel)
                }

                sectionHeader(L("home.best_sellers"))
                bestSellersRail(viewModel)

                sectionHeader(L("home.shop_by_vertical"))
                verticalPortalsRow(viewModel)

                sectionHeader(L("home.pillars.title"))
                pillarsStrip()

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

    /// Slim one-line strip at the very top of Home content: the live brand
    /// tagline (accent-on-tint capsule) or the bundled fallback line.
    private func announcementStrip(_ text: String) -> some View {
        Text(text)
            .font(.mishranBodySm.weight(.semibold))
            .foregroundStyle(Color.mishranBrandAccent)
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .padding(.vertical, .mishranSpacingSm)
            .padding(.horizontal, .mishranSpacingLg)
            .background(Color.mishranBrandAccent.opacity(0.10))
            .accessibilityAddTraits(.isStaticText)
    }

    /// Photo hero over the first best seller's image, scrim, wordmark +
    /// tagline + browse CTA (web home's counterpart; Android parity). The
    /// wordmark/tagline use the LIVE brand copy when /brand carries any,
    /// else the bundled app.* strings.
    private func hero(bestSellers: [ProductEntity], viewModel: HomeViewModel) -> some View {
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
                Text(viewModel.heroWordmark)
                    .font(.mishranDisplay.weight(.light))
                    .foregroundStyle(.white)
                Text(viewModel.heroTagline)
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
            if viewModel.loadFailed {
                // Failed first fetch with nothing cached — an error + retry
                // row, never an eternal spinner (the pull-to-refresh above
                // also reloads, but the user has to know to look for it).
                VStack(spacing: .mishranSpacingSm) {
                    Text(L("home.load_error"))
                        .font(.mishranBodyMd)
                        .foregroundStyle(Color.mishranStateError)
                        .multilineTextAlignment(.center)
                    Button {
                        Task { await viewModel.load() }
                    } label: {
                        Label(L("home.retry"), systemImage: "arrow.clockwise")
                            .font(.mishranBodyMd.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.mishranBrandAccent)
                    .accessibilityHint("Reload the home screen")
                }
                .padding(.mishranSpacingLg)
                .frame(maxWidth: .infinity)
            } else {
                HStack {
                    Spacer()
                    ProgressView()
                        .padding(.vertical, .mishranSpacingXl)
                    Spacer()
                }
            }
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingMd) {
                    ForEach(viewModel.bestSellers, id: \.id) { product in
                        // onTap MUST be labeled: an unlabeled trailing
                        // closure binds onQuickAdd (the last closure param,
                        // legacy backward scan) — wiring quick-add onto the
                        // rail and leaving the card tap dead.
                        ProductCard(
                            product: product,
                            onTap: { router.push(.productDetail(slug: product.slug)) }
                        )
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

    /// "Why Mishran" pillar strip (P3): four cards, journalRail's surface/
    /// border language at a shorter height; each card pushes the journal
    /// with its pillar preselected (Route.stories carries the pillar).
    private func pillarsStrip() -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .mishranSpacingMd) {
                ForEach(HomeViewModel.whyMishranPillars) { card in
                    pillarCard(card)
                }
            }
            .padding(.horizontal, .mishranSpacingLg)
            .padding(.vertical, .mishranSpacingXs)
        }
    }

    /// One pillar card (extracted so the strip's ForEach stays cheap for
    /// the type checker).
    private func pillarCard(_ card: HomePillarCard) -> some View {
        let title = L(card.titleKey)
        return Button {
            router.push(.stories(pillar: card.storyPillar))
        } label: {
            VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                Image(systemName: card.symbol)
                    .font(.mishranBodyXl)
                    .foregroundStyle(Color.mishranBrandAccent)
                Text(title)
                    .font(.mishranBodyMd.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }
            .padding(.mishranSpacingMd)
            .frame(width: 150)
            .frame(minHeight: 88, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .fill(Color.mishranBrandSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: .mishranRadiusMd)
                    .strokeBorder(Color.mishranBrandAccent.opacity(0.15), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .accessibilityLabel(title)
        .accessibilityHint("Read the \(title) stories")
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
