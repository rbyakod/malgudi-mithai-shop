// CartView.swift — Task 17.1 (Mishran Mobile Apps v1).
// @Query observes the cart lines; CartViewModel owns writes + totals.
import SwiftData
import SwiftUI

struct CartView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \CartItemEntity.name) private var lines: [CartItemEntity]
    @State private var viewModel: CartViewModel?
    var onCheckout: (() -> Void)? = nil

    var body: some View {
        Group {
            if let viewModel {
                content(viewModel)
            } else {
                ProgressView()
                    .onAppear { viewModel = CartViewModel(context: context) }
            }
        }
        .navigationTitle("Cart")
        .onAppear { viewModel?.reload() }
    }

    @ViewBuilder
    private func content(_ viewModel: CartViewModel) -> some View {
        if lines.isEmpty {
            ContentUnavailableView(
                "Your cart is empty",
                systemImage: "cart",
                description: Text("Browse the sweets catalog to fill it.")
            )
        } else {
            List {
                Section {
                    ForEach(lines, id: \.productId) { line in
                        CartLineItem(
                            line: line,
                            onQuantityChange: { viewModel.setQuantity(productId: line.productId, quantity: $0) },
                            onRemove: { viewModel.removeLine(productId: line.productId) }
                        )
                        .listRowBackground(Color.mishranBrandSurface)
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            viewModel.removeLine(productId: lines[index].productId)
                        }
                    }
                }

                Section {
                    row(label: "Items", value: "\(viewModel.itemCount)")
                    row(label: "Total", value: Self.rupees(viewModel.totalPaise))
                        .font(.mishranBodyLg.weight(.semibold))
                } footer: {
                    Text("Delivery calculated at checkout.")
                }

                Section {
                    Button {
                        onCheckout?()
                    } label: {
                        Text("Checkout")
                            .font(.mishranBodyLg.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.mishranBrandAccent)
                    .foregroundStyle(Color.mishranBrandCanvas)
                    .controlSize(.large)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .accessibilityLabel("Checkout")

                    Button("Clear cart", role: .destructive) {
                        viewModel.clear()
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("Clear cart")
                }
            }
        }
    }

    private func row(label: String, value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .foregroundStyle(Color.mishranBrandInk)
        }
    }

    /// 72000 paise → "₹720".
    static func rupees(_ paise: Int) -> String {
        let rupees = Double(paise) / 100
        let text = rupees.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(rupees))
            : String(format: "%.2f", rupees)
        return "₹\(text)"
    }
}
