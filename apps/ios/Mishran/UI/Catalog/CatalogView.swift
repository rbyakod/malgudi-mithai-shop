// CatalogView.swift — Task 16.3 (Mishran Mobile Apps v1).
// 2-column LazyVGrid of ProductCards with search + filter sheet.
import SwiftUI

struct CatalogView: View {
    @Bindable var viewModel: CatalogViewModel
    var onSelect: ((ProductEntity) -> Void)? = nil

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
                        }
                    }
                }
                .padding(.horizontal, .mishranSpacingMd)
                .padding(.bottom, .mishranSpacingLg)

                if viewModel.filteredProducts.isEmpty && !viewModel.isLoading {
                    ContentUnavailableView(
                        "No sweets found",
                        systemImage: "magnifyingglass",
                        description: Text("Try a different search or clear filters.")
                    )
                }
            }
            .refreshable {
                await viewModel.load(force: true)
            }
        }
        .overlay {
            if viewModel.isLoading && viewModel.products.isEmpty {
                ProgressView("Loading sweets…")
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            FilterSheet(filters: $viewModel.filters)
                .presentationDetents([.medium])
        }
        .navigationTitle("Sweets")
        .task {
            if viewModel.products.isEmpty {
                await viewModel.load()
            }
        }
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
