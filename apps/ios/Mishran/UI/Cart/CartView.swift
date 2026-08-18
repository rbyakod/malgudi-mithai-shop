// CartView.swift — Task 17.1 (Mishran Mobile Apps v1).
// @Query observes the cart lines; CartViewModel owns writes + totals.
// P3 parity: "Send order on WhatsApp" — the same openURL hand-off
// OrderDetailView's Need-help row uses, with the enumerated order prefill
// composed by WhatsAppMessages.cartOrder (pure, unit-tested).
// Batch B9: the summary footer prices delivery off the view model's
// /cart/estimate — a saved pincode shows the tier fee + free-delivery
// threshold progress; otherwise the calculated-at-checkout copy carries a
// Check affordance that reuses the PDP's delivery-check flow in a sheet.
import SwiftData
import SwiftUI

struct CartView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.openURL) private var openURL
    @Query(sort: \CartItemEntity.name) private var lines: [CartItemEntity]
    @State private var viewModel: CartViewModel?
    /// P3: support digits for the WhatsApp send (cached BrandRepository
    /// read, resolved once per appearance); the button stays disabled until
    /// digits exist.
    @State private var whatsappDigits: String?
    /// B9: the PDP's delivery-check model, hosted in a sheet when the cart
    /// footer offers "Check" (created lazily like the view model).
    @State private var deliveryCheck: DeliveryCheckModel?
    @State private var isShowingDeliveryCheck = false
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
        .navigationTitle(L("cart.title"))
        .onAppear {
            viewModel?.reload()
            if deliveryCheck == nil {
                deliveryCheck = DeliveryCheckModel(client: MishranAPIClient())
            }
        }
        .task {
            guard whatsappDigits == nil else { return }
            let repository = BrandRepository(client: MishranAPIClient())
            whatsappDigits = await repository.whatsappDigits()
        }
        // The existing PDP delivery-check flow, presented modally — the
        // section + model are reused as-is (no new pincode UI).
        .sheet(isPresented: $isShowingDeliveryCheck) {
            if let deliveryCheck {
                DeliveryCheckSection(model: deliveryCheck)
                    .padding(.mishranSpacingLg)
                    .background(Color.mishranBrandCanvas)
                    .presentationDetents([.medium])
            }
        }
        .onChange(of: isShowingDeliveryCheck) { _, showing in
            // The sheet may have saved a fresh serviceable pincode —
            // re-estimate so the fee/progress line appears immediately.
            if !showing { viewModel?.refreshEstimate() }
        }
    }

    @ViewBuilder
    private func content(_ viewModel: CartViewModel) -> some View {
        if lines.isEmpty {
            ContentUnavailableView(
                L("cart.empty"),
                systemImage: "cart",
                description: Text(L("cart.empty_hint"))
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
                    // B9: the estimate's tier fee rides the summary once a
                    // saved pincode priced the cart (fallback: no row).
                    if case let .priced(feePaise, _) = viewModel.deliveryFooter {
                        row(label: L("cart.delivery_fee"), value: Self.rupees(feePaise))
                    }
                    row(label: L("cart.total"), value: Self.rupees(viewModel.totalPaise))
                        .font(.mishranBodyLg.weight(.semibold))
                } footer: {
                    deliveryFooterBlock(viewModel.deliveryFooter)
                }

                Section {
                    Button {
                        onCheckout?()
                    } label: {
                        Text(L("cart.checkout"))
                            .font(.mishranBodyLg.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.mishranBrandAccent)
                    .foregroundStyle(Color.mishranBrandCanvas)
                    .controlSize(.large)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .accessibilityLabel(L("cart.checkout"))

                    // P3: prefilled order over WhatsApp (wa.me deep link —
                    // the operator gets the full line list + total without
                    // the shopper typing anything).
                    Button {
                        sendOnWhatsApp(totalPaise: viewModel.totalPaise)
                    } label: {
                        Label(L("cart.whatsapp.send"), systemImage: "message.circle.fill")
                            .font(.mishranBodyMd.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.mishranBrandAccent)
                    .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                    .disabled(whatsappDigits == nil)
                    .accessibilityLabel(L("cart.whatsapp.send"))
                    .accessibilityHint("Opens WhatsApp with your order prefilled")

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

    /// B9: delivery line under the summary — checkout-time copy (+ Check
    /// affordance) until a saved pincode prices the cart, then the
    /// free-delivery progress the estimate resolved.
    @ViewBuilder
    private func deliveryFooterBlock(_ footer: CartViewModel.DeliveryFooter) -> some View {
        switch footer {
        case .atCheckout:
            HStack(spacing: .mishranSpacingSm) {
                Text(L("cart.delivery_at_checkout"))
                Spacer(minLength: 0)
                Button {
                    isShowingDeliveryCheck = true
                } label: {
                    Text(L("product.delivery.check"))
                        .font(.mishranBodySm.weight(.semibold))
                        .frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.borderless)
                .tint(Color.mishranBrandAccent)
                .accessibilityLabel(L("product.delivery.check"))
                .accessibilityHint("Checks delivery to your pincode")
            }
        case let .priced(_, progress):
            Text(CartViewModel.progressLine(progress))
        }
    }

    /// Compose the wa.me order URL from the CURRENT lines (row order —
    /// name-sorted, same as the list) and hand it to the system opener.
    private func sendOnWhatsApp(totalPaise: Int) {
        guard let whatsappDigits else { return }
        let text = WhatsAppMessages.cartOrder(
            lines: lines.map { line in
                (name: line.name, packLabel: line.packLabel, quantity: line.quantity, unitPricePaise: line.unitPricePaise)
            },
            totalPaise: totalPaise
        )
        if let url = BrandRepository.whatsappURL(digits: whatsappDigits, text: text) {
            openURL(url)
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
