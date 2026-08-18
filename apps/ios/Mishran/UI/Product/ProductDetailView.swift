// ProductDetailView.swift — Task 16.4 / P1 parity (Mishran Mobile Apps v1).
// P3 parity: pincode delivery check, "Ask on WhatsApp", sticky buy bar.
// Web-PDP parity restructure: 4:5 hero with serif-initial fallback, family
// eyebrow + translated freshness promise (replaces the raw enum capsule),
// trust strip, provenance rows (karigar · lead time · shelf life), story as
// an italic editorial lead + ingredients section, honest-label rows, and a
// same-family cross-sell rail (mirrors components/mithai/MithaiPDP.tsx).
import SwiftData
import SwiftUI

struct ProductDetailView: View {
    @State private var viewModel: ProductDetailViewModel
    var onAddedToCart: (() -> Void)? = nil
    /// P1: Buy now adds the selected pack and jumps straight to checkout.
    var onBuyNow: (() -> Void)? = nil
    /// Cross-sell navigation: sibling cards push another productDetail
    /// route (wired from DestinationView, which owns the Router).
    var onSelectProduct: ((String) -> Void)? = nil

    /// P3: pincode serviceability check (restores the last saved result).
    @State private var deliveryCheck: DeliveryCheckModel
    /// P3: support digits for the WhatsApp row — cached BrandRepository
    /// read, resolved once per appearance; the URL itself is composed at
    /// tap time so the prefill reflects the CURRENT pack + quantity.
    @State private var whatsappDigits: String?
    /// Same-family siblings for the cross-sell rail (prefix 4); loaded
    /// cache-first off the ambient context, fetched once when empty.
    @State private var crossSell: [ProductEntity] = []
    @Environment(\.openURL) private var openURL
    /// Kept for the cross-sell cache reads (cache-first, like the repo).
    private let context: ModelContext

    init(
        slug: String,
        client: MishranAPIClient,
        context: ModelContext,
        onAddedToCart: (() -> Void)? = nil,
        onBuyNow: (() -> Void)? = nil,
        onSelectProduct: ((String) -> Void)? = nil
    ) {
        _viewModel = State(initialValue: ProductDetailViewModel(slug: slug, client: client, context: context))
        _deliveryCheck = State(initialValue: DeliveryCheckModel(client: client))
        self.context = context
        self.onAddedToCart = onAddedToCart
        self.onBuyNow = onBuyNow
        self.onSelectProduct = onSelectProduct
    }

    var body: some View {
        ScrollView {
            if let product = viewModel.product {
                VStack(alignment: .leading, spacing: .mishranSpacingLg) {
                    hero(for: product)

                    // Header: family eyebrow → name → price → freshness
                    // promise (translated; unknown statuses render raw).
                    VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                        if !product.family.isEmpty {
                            Text(Self.familyLabel(for: product.family))
                                .font(.mishranBodySm.weight(.medium))
                                .textCase(.uppercase)
                                .tracking(1.8)
                                .foregroundStyle(Color.mishranBrandAccent)
                        }
                        Text(product.name)
                            .font(.mishranDisplay.weight(.light))
                        if let price = viewModel.priceLine {
                            Text(price)
                                .font(.mishranBodyXl)
                        }
                        if let promise = Self.freshnessPromise(for: product.freshnessStatus) {
                            Text(promise)
                                .font(.mishranBodyMd.weight(.light))
                                .italic()
                                .foregroundStyle(Color.mishranNeutral500)
                        }
                    }
                    .foregroundStyle(Color.mishranBrandInk)

                    if !viewModel.packSizes.isEmpty {
                        PackSizePicker(options: viewModel.packSizes, selection: packSelection)
                        // Display-only estimates (commerce is deferred
                        // server-side; cart/validate prices the base pack).
                        Text(L("product.pack_estimate"))
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                    }

                    QuantitySelector(quantity: $viewModel.quantity)

                    HStack(spacing: .mishranSpacingSm) {
                        AddToCartButton(
                            action: {
                                viewModel.addToCart()
                                onAddedToCart?()
                            },
                            isAdded: viewModel.addedToCart
                        )
                        BuyNowButton {
                            viewModel.addToCart()
                            onBuyNow?()
                        }
                    }

                    // Trust strip — real fields only, quiet uppercase
                    // microcopy (freshness · shelf life · lead time · diet).
                    let trustItems = Self.trustStripItems(for: product)
                    if !trustItems.isEmpty {
                        trustStrip(trustItems)
                    }

                    // P3: pincode serviceability (between the buy area and
                    // the editorial sections — the web PDP's placement).
                    DeliveryCheckSection(model: deliveryCheck)

                    // P3: prefilled product enquiry over WhatsApp.
                    Button {
                        openWhatsAppEnquiry(for: product)
                    } label: {
                        Label(L("product.whatsapp.ask"), systemImage: "message.circle.fill")
                            .font(.mishranBodyMd.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.mishranBrandAccent)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .disabled(whatsappDigits == nil)
                    .accessibilityLabel(L("product.whatsapp.ask"))
                    .accessibilityHint("Opens WhatsApp with this product prefilled")

                    let provenance = Self.provenanceRows(for: product)
                    if !provenance.isEmpty {
                        provenanceBlock(provenance)
                    }

                    storySection(for: product)

                    honestLabelSection(for: product)

                    if !crossSell.isEmpty {
                        crossSellRail
                    }

                    // B11: approved public reviews — hidden entirely while
                    // unloaded/failed and when the product has none (web
                    // parity: no empty state).
                    if let reviews = viewModel.reviews, reviews.total > 0 {
                        reviewsSection(reviews)
                    }
                }
                .padding(.mishranSpacingLg)
            } else if viewModel.isLoading {
                ProgressView(L("common.loading"))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, .mishranSpacingLg)
            } else if let message = viewModel.errorMessage {
                ContentUnavailableView {
                    Label(L("common.load_error"), systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button(L("common.retry")) {
                        Task { await viewModel.load() }
                    }
                }
                .padding(.top, .mishranSpacingLg)
            }
        }
        .background(Color.mishranBrandCanvas)
        .navigationTitle(viewModel.product?.name ?? "Sweet")
        .navigationBarTitleDisplayMode(.inline)
        // P3: sticky buy bar (web's buy-rail counterpart). safeAreaInset
        // keeps the scroll content inset above the bar on every device;
        // iPhone-only app → unconditional (no size-class gate needed).
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let product = viewModel.product {
                buyBar(for: product)
            }
        }
        .task {
            if viewModel.product == nil {
                await viewModel.load()
            }
        }
        .task {
            // Resolve the support digits once per appearance (cache-first);
            // the row stays disabled until digits exist.
            guard whatsappDigits == nil else { return }
            let repository = BrandRepository(client: MishranAPIClient())
            whatsappDigits = await repository.whatsappDigits()
        }
        // Re-runs when the loaded product's slug appears: cross-sell reads
        // the same-family cache rows (direct PDP entrylands fetch once),
        // and the reviews fetch rides the same trigger (B11).
        .task(id: viewModel.product?.slug) {
            await loadCrossSell()
            await viewModel.loadReviews()
        }
    }

    // MARK: Hero

    /// 4:5 editorial hero (web's aspect-[4/5]). Real photo when the doc has
    /// one; otherwise the designed fallback — brand gradient + serif initial.
    ///
    /// The 4:5 box is fixed by `Color.clear.aspectRatio(.fit)` off the width
    /// the ScrollView proposes — never by `.fill` on the content itself: a
    /// vertical ScrollView proposes (width, nil), and with no definite
    /// height a scaledToFill image under `.fill` falls back toward its
    /// natural pixel size, rendering the hero enormous (#84). The overlay
    /// merely cover-crops into the already-fixed box.
    private func hero(for product: ProductEntity) -> some View {
        Color.clear
            .aspectRatio(4 / 5, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .overlay {
                if let imageURL = product.images?.first {
                    ProductRemoteImage(imageURL: imageURL)
                } else {
                    heroFallback(for: product)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusLg))
            .accessibilityHidden(true)
    }

    /// No-photo hero: brand gradient with the product's serif initial.
    private func heroFallback(for product: ProductEntity) -> some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.mishranBrandAccent.opacity(0.25),
                    Color.mishranBrandPop.opacity(0.15),
                    Color.mishranBrandCanvas,
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            Text(String((product.name.first ?? "·")).uppercased())
                .font(.system(size: 96, weight: .light, design: .serif))
                .italic()
                .foregroundStyle(Color.mishranBrandAccent)
        }
    }

    // MARK: Trust strip

    private func trustStrip(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingSm) {
            Divider()
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingSm) {
                    ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                        if index > 0 {
                            Text("·")
                        }
                        Text(item)
                            .tracking(1.2)
                    }
                }
            }
        }
        .font(.mishranBodySm.weight(.medium))
        .textCase(.uppercase)
        .foregroundStyle(Color.mishranBrandAccent.opacity(0.9))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pdp.trust-strip")
    }

    // MARK: Provenance

    private struct ProvenanceRow {
        let label: String
        let value: String
    }

    private func provenanceBlock(_ rows: [ProvenanceRow]) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingMd) {
            Divider()
            ForEach(rows, id: \.label) { row in
                VStack(alignment: .leading, spacing: .mishranSpacingXs) {
                    Text(row.label)
                        .font(.mishranBodySm.weight(.medium))
                        .textCase(.uppercase)
                        .tracking(1.8)
                        .foregroundStyle(Color.mishranBrandAccent.opacity(0.8))
                    Text(row.value)
                        .font(.mishranBodyXl.weight(.light))
                        .foregroundStyle(Color.mishranBrandInk)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pdp.provenance")
    }

    // MARK: Story + ingredients

    /// Story as the magazine lead: paragraphs split on newline, the first
    /// larger and ink, the rest quieter — then the ingredients heading.
    private func storySection(for product: ProductEntity) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingLg) {
            let paragraphs = Self.storyParagraphs(for: product.story)
            if !paragraphs.isEmpty {
                VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                    ForEach(Array(paragraphs.enumerated()), id: \.offset) { index, paragraph in
                        Text(paragraph)
                            .font(index == 0 ? .mishranBodyXxl.weight(.light) : .mishranBodyXl.weight(.light))
                            .italic()
                            .foregroundStyle(index == 0 ? Color.mishranBrandInk : Color.mishranNeutral500)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("pdp.story")
            }
            if let ingredients = product.ingredients {
                VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                    Text(L("product.ingredients"))
                        .font(.mishranBodySm.weight(.medium))
                        .textCase(.uppercase)
                        .tracking(1.8)
                        .foregroundStyle(Color.mishranBrandAccent)
                    Text(ingredients)
                        .font(.mishranBodyXl.weight(.light))
                        .foregroundStyle(Color.mishranBrandInk)
                }
            }
        }
    }

    // MARK: Honest label

    /// Allergens + storage — rows render only when the doc carries the
    /// data (no empty "—" placeholders), mirroring the web's aside.
    private func honestLabelSection(for product: ProductEntity) -> some View {
        let rows = Self.honestLabelRows(for: product)
        return Group {
            if !rows.isEmpty {
                VStack(alignment: .leading, spacing: .mishranSpacingMd) {
                    ForEach(rows, id: \.label) { row in
                        VStack(alignment: .leading, spacing: .mishranSpacingXs) {
                            Text(row.label)
                                .font(.mishranBodySm.weight(.medium))
                                .textCase(.uppercase)
                                .tracking(1.8)
                                .foregroundStyle(Color.mishranBrandAccent)
                            Text(row.value)
                                .font(.mishranBodyMd)
                                .foregroundStyle(Color.mishranNeutral500)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("pdp.honest-label")
            }
        }
    }

    // MARK: Cross-sell

    /// "More from the {family} collection" — same-family siblings from the
    /// catalog cache, capped at 4 like the web rail.
    private var crossSellRail: some View {
        VStack(alignment: .leading, spacing: .mishranSpacingMd) {
            Divider()
            Text(L("product.cross_sell.title", Self.familyLabel(for: viewModel.product?.family ?? "")))
                .font(.mishranBodyMd.weight(.semibold))
                .foregroundStyle(Color.mishranBrandInk)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .mishranSpacingMd) {
                    ForEach(crossSell) { sibling in
                        // onTap labeled — see HomeView.bestSellersRail (an
                        // unlabeled trailing closure would bind onQuickAdd).
                        ProductCard(
                            product: sibling,
                            onTap: { onSelectProduct?(sibling.slug) }
                        )
                        .frame(width: 180)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pdp.cross-sell")
    }

    private func loadCrossSell() async {
        guard let product = viewModel.product else { return }
        let cache = CatalogCache(context: context)
        var siblings = cache
            .cachedProducts()
            .filter { $0.family == product.family && $0.slug != product.slug }
        if siblings.isEmpty {
            // Direct PDP entry on a cold store: pull the catalog once
            // (seeds the shared cache for later screens too).
            let repository = CatalogRepository(client: MishranAPIClient(), cache: cache)
            await repository.getCatalog()
            siblings = repository
                .products
                .filter { $0.family == product.family && $0.slug != product.slug }
        }
        crossSell = Array(siblings.prefix(4))
    }

    // MARK: Reviews (B11)

    /// "Customer reviews" — aggregate StarRow + summary line, then up to 5
    /// approved rows (author · verified badge · date · body) and a plain
    /// "+ N more" caption. Section styling matches provenance/honest-label
    /// (divider, quiet uppercase heading, accent label color).
    private func reviewsSection(_ reviews: ReviewListDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingMd) {
            Divider()
            Text(L("reviews.title"))
                .font(.mishranBodySm.weight(.medium))
                .textCase(.uppercase)
                .tracking(1.8)
                .foregroundStyle(Color.mishranBrandAccent)
                .accessibilityAddTraits(.isHeader)

            HStack(spacing: .mishranSpacingMd) {
                StarRow(rating: reviews.averageRating ?? 0)
                Text(Self.reviewSummary(reviews))
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranNeutral500)
            }
            .accessibilityElement(children: .combine)

            let shown = Array(reviews.items.prefix(5))
            ForEach(shown) { review in
                reviewRow(review)
            }

            // Overflow caption only — pagination is a later batch.
            if reviews.total > shown.count {
                Text(L("reviews.more", String(reviews.total - shown.count)))
                    .font(.mishranBodySm)
                    .foregroundStyle(Color.mishranNeutral500)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pdp.reviews")
    }

    /// One review: author (Anonymous fallback) with the verified-purchase
    /// badge and the parsed date, body beneath when the row carries one.
    private func reviewRow(_ review: ReviewDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingXs) {
            HStack(spacing: .mishranSpacingSm) {
                Text(review.authorDisplayName ?? L("reviews.anonymous"))
                    .font(.mishranBodyMd.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                if review.verifiedPurchase {
                    Text(L("reviews.verified"))
                        .font(.mishranBodySm.weight(.medium))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Color.mishranBrandPop)
                }
                Spacer(minLength: 0)
                if let date = StoryFormatting.displayString(review.createdAt) {
                    Text(date)
                        .font(.mishranBodySm)
                        .foregroundStyle(Color.mishranNeutral500)
                }
            }
            if let body = review.body, !body.isEmpty {
                Text(body)
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranNeutral500)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// "4.5 · 12 reviews" — one-decimal rating (web's toFixed(1)) with the
    /// singular/plural summary the i18n tables carry. Internal for tests.
    static func reviewSummary(_ reviews: ReviewListDTO) -> String {
        let rating = ReviewFormatting.rating(reviews.averageRating ?? 0)
        return reviews.total == 1
            ? L("reviews.summary_one", rating)
            : L("reviews.summary_other", rating, String(reviews.total))
    }

    // MARK: Field → copy maps (mirrors MithaiPDP.tsx FRESHNESS_KEY/DIETARY_KEY)

    /// Translated freshness promise; unknown statuses render verbatim.
    private static func freshnessPromise(for status: String?) -> String? {
        guard let status, !status.isEmpty else { return nil }
        switch status {
        case "made-daily": return L("product.trust.fresh_daily")
        case "made-to-order": return L("product.trust.fresh_to_order")
        case "batch-frozen": return L("product.trust.frozen")
        default: return status
        }
    }

    /// Uppercase trust-strip items — only the fields the doc carries.
    private static func trustStripItems(for product: ProductEntity) -> [String] {
        var items: [String] = []
        if let promise = freshnessPromise(for: product.freshnessStatus) {
            items.append(promise)
        }
        if let shelfLife = product.shelfLife {
            items.append(L("product.trust.shelf_life", shelfLife))
        }
        if let leadTime = product.leadTime {
            items.append(leadTime)
        }
        items.append(contentsOf: (product.dietaryTags ?? []).map(dietaryLabel))
        return items
    }

    /// Known dietary tags localize; admin-entered free text renders verbatim.
    private static func dietaryLabel(for tag: String) -> String {
        switch tag.lowercased() {
        case "vegetarian": return L("product.trust.vegetarian")
        case "sugar-free": return L("product.trust.sugar_free")
        default: return tag.capitalized
        }
    }

    private static func provenanceRows(for product: ProductEntity) -> [ProvenanceRow] {
        var rows: [ProvenanceRow] = []
        if let karigarName = product.karigarName {
            rows.append(ProvenanceRow(label: L("product.provenance.karigar"), value: karigarName))
        }
        if let leadTime = product.leadTime {
            rows.append(ProvenanceRow(label: L("product.provenance.freshness"), value: leadTime))
        }
        if let shelfLife = product.shelfLife {
            rows.append(ProvenanceRow(label: L("product.shelf_life"), value: shelfLife))
        }
        return rows
    }

    private static func honestLabelRows(for product: ProductEntity) -> [ProvenanceRow] {
        var rows: [ProvenanceRow] = []
        if let allergens = product.allergens, !allergens.isEmpty {
            rows.append(ProvenanceRow(label: L("product.allergens"), value: allergens.joined(separator: ", ")))
        }
        if let storage = product.storage {
            rows.append(ProvenanceRow(label: L("product.storage"), value: storage))
        }
        return rows
    }

    private static func storyParagraphs(for story: String?) -> [String] {
        guard let story else { return [] }
        return story
            .components(separatedBy: "\n")
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    /// Localized family display name (catalog.family.* — same table the
    /// catalog filter chips use); unknown values fall back to capitalized.
    private static func familyLabel(for family: String) -> String {
        switch family {
        case "classic": return L("catalog.family.classic")
        case "original": return L("catalog.family.originals")
        case "sugar-free": return L("catalog.family.sugar_free")
        case "regional": return L("catalog.family.regional")
        case "seasonal": return L("catalog.family.seasonal")
        default: return family.isEmpty ? family : family.capitalized
        }
    }

    // MARK: Buy bar

    /// Bottom bar: truncated name + "qty × price" + Add to cart. The
    /// in-content Buy now button stays as-is — the bar is the always-visible
    /// escape hatch for long detail scrolls, not a replacement.
    private func buyBar(for product: ProductEntity) -> some View {
        VStack(spacing: 0) {
            Divider()
            HStack(spacing: .mishranSpacingMd) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(product.name)
                        .font(.mishranBodyMd.weight(.semibold))
                        .lineLimit(1)
                    if let price = viewModel.priceLine {
                        Text("\(viewModel.quantity) × \(price)")
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .accessibilityElement(children: .combine)

                Spacer(minLength: .mishranSpacingSm)

                Button {
                    viewModel.addToCart()
                    onAddedToCart?()
                } label: {
                    Label(L("product.add_to_cart"), systemImage: "cart.badge.plus")
                        .font(.mishranBodyMd.weight(.semibold))
                        .padding(.horizontal, .mishranSpacingSm)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.mishranBrandAccent)
                .foregroundStyle(Color.mishranBrandCanvas)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .accessibilityLabel(L("product.add_to_cart"))
                // Distinct from the in-content AddToCartButton so XCUITest
                // queries stay unambiguous (both read "Add to cart" to VO).
                .accessibilityIdentifier("pdp.add-to-cart.sticky")
            }
            .padding(.horizontal, .mishranSpacingLg)
            .padding(.vertical, .mishranSpacingSm)
        }
        .background(.regularMaterial)
    }

    /// Compose the wa.me enquiry URL at TAP time (the prefill mirrors the
    /// currently selected pack + quantity, not whatever was live at render)
    /// and hand it to the system opener.
    private func openWhatsAppEnquiry(for product: ProductEntity) {
        guard let whatsappDigits else { return }
        let text = WhatsAppMessages.productEnquiry(
            name: product.name,
            packLabel: ProductDetailViewModel.packLabel(
                pack: viewModel.selectedPack,
                displayPrice: product.displayPrice
            ),
            priceLine: viewModel.priceLine,
            quantity: viewModel.quantity
        )
        if let url = BrandRepository.whatsappURL(digits: whatsappDigits, text: text) {
            openURL(url)
        }
    }

    /// Selection routes through selectPack (guards against ids outside the
    /// derived chips); clearing is not an option in the UI.
    private var packSelection: Binding<PackSize?> {
        Binding(
            get: { viewModel.selectedPack },
            set: { if let pack = $0 { viewModel.selectPack(pack) } }
        )
    }
}
