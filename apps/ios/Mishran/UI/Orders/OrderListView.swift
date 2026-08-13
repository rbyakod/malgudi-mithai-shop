// OrderListView.swift — Task 18.1 (Mishran Mobile Apps v1).
// Customer's orders, newest first, pull-to-refresh. Rows push the detail.
import SwiftUI

struct OrderListView: View {
    @State private var viewModel: OrdersViewModel?

    var body: some View {
        Group {
            if let viewModel {
                content(viewModel)
            } else {
                ProgressView()
                    .task {
                        let vm = OrdersViewModel(client: MishranAPIClient())
                        viewModel = vm
                        await vm.load()
                    }
            }
        }
        .navigationTitle("Your orders")
    }

    @ViewBuilder
    private func content(_ viewModel: OrdersViewModel) -> some View {
        if viewModel.orders.isEmpty, !viewModel.isLoading {
            ContentUnavailableView(
                "No orders yet",
                systemImage: "shippingbox",
                description: Text("Your sweet orders will appear here.")
            )
        } else {
            List {
                if let message = viewModel.errorMessage {
                    Text(message)
                        .font(.mishranBodyMd)
                        .foregroundStyle(Color.mishranStateError)
                }
                ForEach(viewModel.orders) { order in
                    NavigationLink(value: Route.orderDetail(id: order.id)) {
                        row(order)
                    }
                }
            }
            .refreshable { await viewModel.load() }
        }
    }

    private func row(_ order: OrderDTO) -> some View {
        VStack(alignment: .leading, spacing: .mishranSpacingSm) {
            HStack {
                Text("Order \(order.id)")
                    .font(.mishranBodyMd.weight(.semibold))
                Spacer()
                OrderStatusBadge(status: order.status)
            }
            Text(OrderTimeline.formatDate(order.createdAt))
                .font(.mishranBodySm)
                .foregroundStyle(.secondary)
            HStack {
                Text("\(order.items.count) item\(order.items.count == 1 ? "" : "s")")
                    .font(.mishranBodySm)
                Spacer()
                Text(CartView.rupees(order.totals.totalInPaise))
                    .font(.mishranBodySm.weight(.semibold))
            }
        }
        .accessibilityElement(children: .combine)
    }
}
