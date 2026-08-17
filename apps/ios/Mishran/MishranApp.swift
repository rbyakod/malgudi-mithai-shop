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
            // UI-test seams: wipe persisted state on demand, then seed a
            // small catalog so headless flows can drive the grid + detail
            // without a backend (same idea as -authScreen).
            SeedData.resetStoreIfNeeded(context: container.mainContext)
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
                        // there on its own. AuthFlowView shares one view model
                        // across the phone + code half-screens: switching on
                        // `stage` is what moves phone entry → OTP entry, and a
                        // verified sign-in (OTP or SIWA) hands control back to
                        // the app — launch lands on home with the session in
                        // the keychain.
                        AuthFlowView { launchScreen = .home }
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
                        } onSignInRequested: {
                            // Task 48.1: the toolbar's sign-in entry flips the
                            // launch surface straight to the auth flow.
                            launchScreen = .signIn
                        }
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    DestinationView(route: route, router: router, onSignedOut: {
                        // Task 48.1: AccountView's sign-out lands back on the
                        // auth flow — signedInOnce stays set, so the next
                        // cold launch takes the same branch.
                        launchScreen = .signIn
                    })
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

/// Phone → OTP sign-in container (Task 15.1 wiring): both half-screens
/// share one AuthViewModel; `stage` drives the transition, so a successful
/// send (stage → .otp) reveals the code entry without a bespoke callback.
private struct AuthFlowView: View {
    @State private var viewModel = AuthViewModel(client: MishranAPIClient())
    let onSignedIn: () -> Void

    var body: some View {
        switch viewModel.stage {
        case .phone:
            PhoneEntryView(viewModel: viewModel, onSignedIn: onSignedIn)
        case .otp:
            OTPView(viewModel: viewModel) {
                onSignedIn()
            }
        }
    }
}

/// Real destinations per route — every case renders its shipped screen
/// (shell wiring owed since 16.3; orderConfirmed landed with it).
/// Task 48.1: onSignedOut threads AccountView's sign-out back to the app
/// shell (launch surface flip) — same closure pattern HomeView uses.
struct DestinationView: View {
    let route: Route
    let router: Router
    var onSignedOut: (() -> Void)? = nil
    @Environment(\.modelContext) private var context

    var body: some View {
        switch route {
        case let .productDetail(slug):
            ProductDetailView(
                slug: slug,
                client: MishranAPIClient(),
                context: context,
                onBuyNow: { router.push(.checkout) },
                onSelectProduct: { sibling in router.push(.productDetail(slug: sibling)) }
            )
        case let .catalog(vertical, family):
            CatalogDestination(router: router, context: context, vertical: vertical, family: family)
        case let .verticalDetail(vertical, slug):
            VerticalDetailView(vertical: vertical, slug: slug, router: router)
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
            AccountView(router: router, onSignedOut: onSignedOut)
        case .addresses:
            AddressesView()
        case let .stories(pillar):
            StoriesView(initialPillar: pillar)
        case let .story(slug):
            StoryReaderView(
                slug: slug,
                repository: StoryRepository(client: MishranAPIClient(), context: context),
                context: context
            )
        case let .enquiry(type):
            EnquiryView(initialType: type)
        case .gift:
            GiftView()
        }
    }
}

/// P2: per-vertical detail dispatcher — the three non-mithai verticals each
/// have their own screen (retailers / walk-in stores / enquiry CTA); mithai
/// details ride the existing productDetail route, so that branch is
/// unreachable by construction.
struct VerticalDetailView: View {
    let vertical: Vertical
    let slug: String
    let router: Router

    var body: some View {
        switch vertical {
        case .mithai:
            EmptyView()
        case .snacks:
            SnackDetailView(slug: slug)
        case .qsr:
            QsrDetailView(slug: slug)
        case .merch:
            MerchDetailView(slug: slug, router: router)
        }
    }
}

/// Catalog pushed from Home (hero CTA / toolbar / portal). P2: the grid
/// grew vertical tabs — a segmented Mithai · Snacks · QSR · Merch header
/// switches between the existing products flow (unchanged, route family
/// still seeds its filter) and the verticals view model. Same construction
/// Home used pre-restructure: cache + repository off the ambient model
/// context.
private struct CatalogDestination: View {
    let router: Router
    let context: ModelContext
    let family: ProductFamily?
    /// P2: the preselected tab (Home's portals push with a vertical set).
    @State private var selectedTab: Vertical
    @State private var viewModel: CatalogViewModel?
    @State private var verticalsViewModel: VerticalCatalogViewModel?

    init(router: Router, context: ModelContext, vertical: Vertical, family: ProductFamily?) {
        self.router = router
        self.context = context
        self.family = family
        _selectedTab = State(initialValue: vertical)
    }

    var body: some View {
        VStack(spacing: .mishranSpacingSm) {
            // Pill tabs, not a segmented Picker: the native control's segments
            // are 32pt tall, under the 44pt minimum tap target the a11y audit
            // enforces (AccessibilityTests.auditButtons).
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingSm) {
                    ForEach(Vertical.allCases) { vertical in
                        let isSelected = vertical == selectedTab
                        Button {
                            selectedTab = vertical
                        } label: {
                            Text(vertical.displayName)
                                .font(.mishranBodySm.weight(.semibold))
                                .padding(.horizontal, .mishranSpacingMd)
                                .frame(minHeight: 44)
                                .background(
                                    Capsule().fill(
                                        isSelected ? Color.mishranBrandAccent : Color.mishranBrandSurface
                                    )
                                )
                                .overlay(
                                    Capsule().strokeBorder(
                                        Color.mishranBrandAccent.opacity(isSelected ? 0 : 0.25),
                                        lineWidth: 1
                                    )
                                )
                                .foregroundStyle(isSelected ? .white : Color.mishranBrandInk)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                    }
                }
                .padding(.horizontal, .mishranSpacingMd)
            }

            switch selectedTab {
            case .mithai:
                if let viewModel {
                    CatalogView(viewModel: viewModel) { product in
                        router.push(.productDetail(slug: product.slug))
                    }
                } else {
                    ProgressView()
                }
            case .snacks, .qsr, .merch:
                if let verticalsViewModel {
                    VerticalListView(viewModel: verticalsViewModel) { card in
                        router.push(.verticalDetail(vertical: card.vertical, slug: card.slug))
                    }
                } else {
                    ProgressView()
                }
            }
        }
        // P3: live cart-count entry (same CartToolbarLabel as Home's
        // toolbar) — catalog shoppers shouldn't have to pop back to check.
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                NavigationLink(value: Route.cart) {
                    CartToolbarLabel()
                }
            }
        }
        .task {
            guard viewModel == nil else { return }
            let cache = await CatalogCache(context: context)
            let viewModel = CatalogViewModel(
                repository: CatalogRepository(client: MishranAPIClient(), cache: cache)
            )
            if let family {
                viewModel.filters.family = family
            }
            self.viewModel = viewModel
            let verticalsViewModel = VerticalCatalogViewModel(
                repository: VerticalsRepository(client: MishranAPIClient()),
                selected: selectedTab
            )
            self.verticalsViewModel = verticalsViewModel
            await verticalsViewModel.select(selectedTab)
        }
        .onChange(of: selectedTab) { _, newValue in
            Task { await verticalsViewModel?.select(newValue) }
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
