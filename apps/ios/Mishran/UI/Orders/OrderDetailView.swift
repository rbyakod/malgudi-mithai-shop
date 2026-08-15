// OrderDetailView.swift — Task 18.1 (Mishran Mobile Apps v1).
// Order header + happy-path timeline (live stage highlighted) + items +
// totals. Side states (cancelled, payment_failed, …) render a banner
// instead of the timeline — the contract has no history array in v1.
import SwiftUI

struct OrderDetailView: View {
    @State private var viewModel: OrderDetailViewModel?
    /// P1: wa.me support link off GET /brand (fallback number when offline).
    @State private var helpURL: URL?
    @Environment(\.openURL) private var openURL
    let orderId: String

    var body: some View {
        Group {
            if let viewModel {
                content(viewModel)
            } else {
                ProgressView()
                    .task {
                        let vm = OrderDetailViewModel(orderId: orderId, client: MishranAPIClient())
                        viewModel = vm
                        await vm.load()
                    }
            }
        }
        .navigationTitle("Order \(orderId)")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(_ viewModel: OrderDetailViewModel) -> some View {
        if let order = viewModel.order {
            List {
                Section {
                    HStack {
                        OrderStatusBadge(status: order.status)
                        Spacer()
                        Text(OrderTimeline.formatDate(order.createdAt))
                            .font(.mishranBodySm)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }

                if OrderTimeline.stageIndex(for: order.status) != nil {
                    Section("Progress") {
                        ForEach(Array(OrderTimeline.stages.enumerated()), id: \.offset) { index, stage in
                            stageRow(stage, index: index, liveIndex: OrderTimeline.stageIndex(for: order.status))
                        }
                    }
                } else {
                    Section {
                        Label(OrderTimeline.label(for: order.status), systemImage: "info.circle")
                            .foregroundStyle(Color.mishranStateError)
                            .font(.mishranBodyMd)
                    }
                }

                Section("Items") {
                    ForEach(order.items, id: \.productId) { item in
                        HStack {
                            Text("\(item.quantity)× \(item.name)")
                                .font(.mishranBodyMd)
                            Spacer()
                            Text(CartView.rupees(item.priceInPaise * item.quantity))
                                .font(.mishranBodySm)
                        }
                    }
                }

                Section("Totals") {
                    totalRow("Items", order.totals.itemsTotalInPaise)
                    if order.totals.deliveryFeeInPaise > 0 {
                        totalRow("Delivery", order.totals.deliveryFeeInPaise)
                    }
                    if order.totals.taxesInPaise > 0 {
                        totalRow("Taxes", order.totals.taxesInPaise)
                    }
                    if order.totals.discountInPaise > 0 {
                        totalRow("Discount", -order.totals.discountInPaise)
                    }
                    HStack {
                        Text("Total")
                            .font(.mishranBodyLg.weight(.semibold))
                        Spacer()
                        Text(CartView.rupees(order.totals.totalInPaise))
                            .font(.mishranBodyLg.weight(.semibold))
                    }
                }

                Section {
                    Button {
                        if let helpURL { openURL(helpURL) }
                    } label: {
                        Label("Need help? WhatsApp us", systemImage: "message.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(helpURL == nil)
                    .accessibilityLabel("Need help? WhatsApp us")
                    .accessibilityHint("Opens WhatsApp chat with Mishran support")
                }
            }
            .refreshable { await viewModel.load() }
            .task {
                // P1: resolve the cached/fetched support digits once per
                // appearance; the row stays disabled until a URL exists.
                guard helpURL == nil else { return }
                let repository = BrandRepository(client: MishranAPIClient())
                let digits = await repository.whatsappDigits()
                helpURL = BrandRepository.whatsappURL(digits: digits)
            }
        } else if viewModel.isLoading {
            ProgressView()
        } else {
            ContentUnavailableView(
                "Couldn't load order",
                systemImage: "exclamationmark.triangle",
                description: Text(viewModel.errorMessage ?? "Try again.")
            )
        }
    }

    private func stageRow(_ stage: OrderStatus, index: Int, liveIndex: Int?) -> some View {
        let reached = index <= (liveIndex ?? -1)
        let isLive = index == liveIndex
        return HStack(spacing: .mishranSpacingMd) {
            Image(systemName: reached ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(reached ? Color.mishranBrandAccent : Color.secondary)
            Text(OrderTimeline.label(for: stage))
                .font(isLive ? .mishranBodyMd.weight(.semibold) : .mishranBodyMd)
            if isLive {
                Spacer()
                Text("Now")
                    .font(.mishranBodySm.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandAccent)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(OrderTimeline.label(for: stage)), \(reached ? "reached" : "pending")")
    }

    private func totalRow(_ label: String, _ paise: Int) -> some View {
        HStack {
            Text(label).font(.mishranBodyMd)
            Spacer()
            Text(CartView.rupees(paise)).font(.mishranBodySm)
        }
    }
}
