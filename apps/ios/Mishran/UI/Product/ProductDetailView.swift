// ProductDetailView.swift — Task 16.4 / P1 parity (Mishran Mobile Apps v1).
// P3 parity: the pincode delivery-check section under the buy area, the
// "Ask on WhatsApp" row (prefilled product enquiry off the cached brand
// number), and the sticky bottom buy bar (compact-width idiom; the app is
// iPhone-only, so the bar applies unconditionally).
import SwiftData
import SwiftUI

struct ProductDetailView: View {
    @State private var viewModel: ProductDetailViewModel
    var onAddedToCart: (() -> Void)? = nil
    /// P1: Buy now adds the selected pack and jumps straight to checkout.
    var onBuyNow: (() -> Void)? = nil

    /// P3: pincode serviceability check (restores the last saved result).
    @State private var deliveryCheck: DeliveryCheckModel
    /// P3: support digits for the WhatsApp row — cached BrandRepository
    /// read, resolved once per appearance; the URL itself is composed at
    /// tap time so the prefill reflects the CURRENT pack + quantity.
    @State private var whatsappDigits: String?
    @Environment(\.openURL) private var openURL

    init(
        slug: String,
        client: MishranAPIClient,
        context: ModelContext,
        onAddedToCart: (() -> Void)? = nil,
        onBuyNow: (() -> Void)? = nil
    ) {
        _viewModel = State(initialValue: ProductDetailViewModel(slug: slug, client: client, context: context))
        _deliveryCheck = State(initialValue: DeliveryCheckModel(client: client))
        self.onAddedToCart = onAddedToCart
        self.onBuyNow = onBuyNow
    }

    var body: some View {
        ScrollView {
            if let product = viewModel.product {
                VStack(alignment: .leading, spacing: .mishranSpacingLg) {
                    // v1 renders a single hero image (first catalog photo).
                    ProductRemoteImage(imageURL: product.images?.first)
                        .frame(height: 240)
                        .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: .mishranSpacingSm) {
                        Text(product.name)
                            .font(.mishranDisplay.weight(.semibold))
                        HStack(spacing: .mishranSpacingSm) {
                            // Selected pack swaps the price line (P1).
                            if let price = viewModel.priceLine {
                                Text(price)
                                    .font(.mishranBodyXl)
                            }
                            if let freshness = product.freshnessStatus {
                                Text(freshness)
                                    .font(.mishranBodySm)
                                    .padding(.horizontal, .mishranSpacingSm)
                                    .padding(.vertical, 4)
                                    .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
                            }
                        }
                        .foregroundStyle(Color.mishranBrandInk)
                    }

                    if !viewModel.packSizes.isEmpty {
                        PackSizePicker(options: viewModel.packSizes, selection: packSelection)
                        // Display-only estimates (commerce is deferred
                        // server-side; cart/validate prices the base pack).
                        Text(L("product.pack_estimate"))
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                    }

                    if let tags = product.dietaryTags, !tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: .mishranSpacingSm) {
                                ForEach(tags, id: \.self) { tag in
                                    Text(tag.capitalized)
                                        .font(.mishranBodySm)
                                        .padding(.horizontal, .mishranSpacingSm)
                                        .padding(.vertical, 4)
                                        .background(Capsule().strokeBorder(Color.mishranBrandAccent.opacity(0.4)))
                                        .accessibilityLabel("Dietary: \(tag)")
                                }
                            }
                        }
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

                    // P3: pincode serviceability (between the buy area and
                    // the detail rows — the web PDP's placement).
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

                    ForEach(detailRows(for: product), id: \.label) { row in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(row.label)
                                .font(.mishranBodyMd.weight(.semibold))
                            Text(row.value)
                                .font(.mishranBodyMd)
                                .foregroundStyle(.secondary)
                        }
                        .accessibilityElement(children: .combine)
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
    }

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

    private struct DetailRow {
        let label: String
        let value: String
    }

    private func detailRows(for product: ProductEntity) -> [DetailRow] {
        var rows: [DetailRow] = []
        if let story = product.story { rows.append(DetailRow(label: "Story", value: story)) }
        if let ingredients = product.ingredients { rows.append(DetailRow(label: L("product.ingredients"), value: ingredients)) }
        if let shelfLife = product.shelfLife { rows.append(DetailRow(label: "Shelf life", value: shelfLife)) }
        if let storage = product.storage { rows.append(DetailRow(label: "Storage", value: storage)) }
        if let allergens = product.allergens, !allergens.isEmpty {
            rows.append(DetailRow(label: "Allergens", value: allergens.joined(separator: ", ")))
        }
        return rows
    }
}
