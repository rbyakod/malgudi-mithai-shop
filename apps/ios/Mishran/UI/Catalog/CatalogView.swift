// CatalogView.swift — Task 16.3 (Mishran Mobile Apps v1).
// 2-column LazyVGrid of ProductCards with search + filter sheet. P3 parity:
// a sort menu (Featured / name A–Z / Z–A, persisted) under the search bar,
// and a quick-add button on every card (base pack, one tap — the grid is
// the mithai tab, so the whole grid quick-adds).
import SwiftData
import SwiftUI

struct CatalogView: View {
    @Bindable var viewModel: CatalogViewModel
    var onSelect: ((ProductEntity) -> Void)? = nil

    @Environment(\.modelContext) private var context
    @State private var isShowingFilters = false

    private let columns = [
        GridItem(.flexible(), spacing: .mishranSpacingMd),
        GridItem(.flexible(), spacing: .mishranSpacingMd),
    ]

    var body: some View {
        VStack(spacing: .mishranSpacingMd) {
            SearchBar(text: $viewModel.searchText) {
                isShowingFilters = true
            }

            if !viewModel.filters.isEmpty {
                FilterSummaryRow(filters: viewModel.filters) {
                    viewModel.filters = CatalogFilters()
                }
            }

            sortRow

            if let message = viewModel.errorMessage {
                Text(message)
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranStateError)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, .mishranSpacingMd)
                    .accessibilityLabel("Error: \(message)")
            }

            ScrollView {
                LazyVGrid(columns: columns, spacing: .mishranSpacingMd) {
                    ForEach(viewModel.filteredProducts, id: \.id) { product in
                        ProductCard(product: product) {
                            onSelect?(product)
                        } onQuickAdd: {
                            ProductDetailViewModel.quickAddToCart(product, in: context)
                        }
                    }
                }
                .padding(.horizontal, .mishranSpacingMd)
                .padding(.bottom, .mishranSpacingLg)

                if viewModel.filteredProducts.isEmpty && !viewModel.isLoading {
                    ContentUnavailableView(
                        L("catalog.empty"),
                        systemImage: "magnifyingglass",
                        description: Text(L("catalog.empty_hint"))
                    )
                }
            }
            .refreshable {
                await viewModel.load(force: true)
            }
        }
        .overlay {
            if viewModel.isLoading && viewModel.products.isEmpty {
                ProgressView(L("common.loading"))
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            FilterSheet(filters: $viewModel.filters)
                .presentationDetents([.medium])
        }
        .navigationTitle(L("nav.catalog"))
        .task {
            if viewModel.products.isEmpty {
                await viewModel.load()
            }
        }
    }

    /// Sort menu (iOS-native Menu + Picker idiom): label shows the active
    /// mode, the picker re-orders the grid and persists the choice. ≥44pt
    /// frame — the a11y audit reads the element frame, not the hit area.
    private var sortRow: some View {
        HStack {
            Spacer()
            Menu {
                Picker(L("catalog.sort.label"), selection: $viewModel.sort) {
                    ForEach(CatalogSort.allCases) { sort in
                        Text(sort.displayName).tag(sort)
                    }
                }
            } label: {
                Label(viewModel.sort.displayName, systemImage: "arrow.up.arrow.down")
                    .font(.mishranBodySm.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandInk)
                    .padding(.horizontal, .mishranSpacingSm)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(L("catalog.sort.label"))
            .accessibilityValue(viewModel.sort.displayName)
        }
        .padding(.horizontal, .mishranSpacingSm)
    }
}

/// Active-filter chips + a clear-all escape hatch.
struct FilterSummaryRow: View {
    let filters: CatalogFilters
    var onClear: () -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .mishranSpacingSm) {
                if let family = filters.family {
                    chip(label: family.displayName)
                }
                ForEach(filters.dietary.sorted(), id: \.self) { tag in
                    chip(label: tag)
                }
                Button("Clear filters", action: onClear)
                    .font(.mishranBodySm)
                    .foregroundStyle(Color.mishranBrandAccent)
                    .accessibilityLabel("Clear all filters")
            }
            .padding(.horizontal, .mishranSpacingMd)
        }
    }

    private func chip(label: String) -> some View {
        Text(label)
            .font(.mishranBodySm)
            .padding(.horizontal, .mishranSpacingSm)
            .padding(.vertical, 4)
            .background(Capsule().fill(Color.mishranBrandAccent.opacity(0.14)))
            .foregroundStyle(Color.mishranBrandInk)
            .accessibilityLabel("Filter: \(label)")
    }
}
