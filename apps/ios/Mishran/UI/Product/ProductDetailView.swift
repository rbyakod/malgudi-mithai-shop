// ProductDetailView.swift — Task 16.4 / P1 parity (Mishran Mobile Apps v1).
import SwiftData
import SwiftUI

struct ProductDetailView: View {
    @State private var viewModel: ProductDetailViewModel
    var onAddedToCart: (() -> Void)? = nil
    /// P1: Buy now adds the selected pack and jumps straight to checkout.
    var onBuyNow: (() -> Void)? = nil

    init(
        slug: String,
        client: MishranAPIClient,
        context: ModelContext,
        onAddedToCart: (() -> Void)? = nil,
        onBuyNow: (() -> Void)? = nil
    ) {
        _viewModel = State(initialValue: ProductDetailViewModel(slug: slug, client: client, context: context))
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
                        Text("Prices for other sizes are estimates — checkout uses the listed price.")
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
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, .mishranSpacingLg)
            } else if let message = viewModel.errorMessage {
                ContentUnavailableView {
                    Label("Couldn't load this sweet", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") {
                        Task { await viewModel.load() }
                    }
                }
                .padding(.top, .mishranSpacingLg)
            }
        }
        .navigationTitle(viewModel.product?.name ?? "Sweet")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if viewModel.product == nil {
                await viewModel.load()
            }
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
        if let ingredients = product.ingredients { rows.append(DetailRow(label: "Ingredients", value: ingredients)) }
        if let shelfLife = product.shelfLife { rows.append(DetailRow(label: "Shelf life", value: shelfLife)) }
        if let storage = product.storage { rows.append(DetailRow(label: "Storage", value: storage)) }
        if let allergens = product.allergens, !allergens.isEmpty {
            rows.append(DetailRow(label: "Allergens", value: allergens.joined(separator: ", ")))
        }
        return rows
    }
}
