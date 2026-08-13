// CheckoutView.swift — Task 17.2 (Mishran Mobile Apps v1).
// Form: address → pincode serviceability (slot section appears only for
// the fresh tier) → payment. Place Order lands with 17.3 (Razorpay).
import SwiftUI

struct CheckoutView: View {
    @Bindable var viewModel: CheckoutViewModel
    var onPlaceOrder: ((CheckoutViewModel) -> Void)? = nil

    @State private var pincodeField = ""

    var body: some View {
        Form {
            Section("Delivery address") {
                AddressPicker(selection: $viewModel.address)
            }

            Section {
                HStack {
                    TextField("Pincode", text: $pincodeField)
                        .font(.mishranBodyLg)
                        .keyboardType(.numberPad)
                        .onChange(of: pincodeField) { _, newValue in
                            pincodeField = String(newValue.filter(\.isNumber).prefix(6))
                        }
                        .accessibilityLabel("Delivery pincode")
                    Button("Check") {
                        Task { await viewModel.validatePincode(pincodeField) }
                    }
                    .disabled(pincodeField.count != 6)
                    .accessibilityLabel("Check delivery availability")
                }

                switch viewModel.serviceability {
                case .checking:
                    HStack { ProgressView(); Text("Checking…") }
                case .serviceable(let tier, let city, let slaDays):
                    Label(
                        slaDays == 0 ? "Same-day delivery in \(city)" : "\(city): ~\(slaDays) day delivery",
                        systemImage: "checkmark.circle.fill"
                    )
                    .foregroundStyle(Color.mishranBrandAccent)
                    .font(.mishranBodyMd)
                    .accessibilityLabel("Serviceable, \(tier) tier, \(city)")
                case .blocked(let reason):
                    Label(blockingText(reason), systemImage: "xmark.octagon.fill")
                        .foregroundStyle(Color.mishranStateError)
                        .font(.mishranBodyMd)
                        .accessibilityLabel("Not serviceable")
                case .unknown:
                    EmptyView()
                }
            } header: {
                Text("Delivery check")
            }

            if viewModel.isFreshTier, !viewModel.slotOptions.isEmpty {
                Section("Delivery slot") {
                    SlotPicker(options: viewModel.slotOptions, selection: $viewModel.selectedSlot)
                }
            }

            Section("Payment") {
                PaymentMethodPicker(selection: $viewModel.paymentMethod)
            }

            Section {
                Button {
                    Task { await viewModel.placeOrder() }
                } label: {
                    Text("Place order")
                        .font(.mishranBodyLg.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.mishranBrandAccent)
                .foregroundStyle(Color.mishranBrandCanvas)
                .controlSize(.large)
                .clipShape(RoundedRectangle(cornerRadius: .mishranRadiusMd))
                .disabled(!viewModel.canPlaceOrder || viewModel.isPlacingOrder)
                .accessibilityLabel("Place order")

                if viewModel.isPlacingOrder {
                    HStack {
                        ProgressView()
                        Text(viewModel.placingOrderStatus)
                            .font(.mishranBodyMd)
                    }
                }
            }

            if let message = viewModel.errorMessage {
                Text(message)
                    .font(.mishranBodyMd)
                    .foregroundStyle(Color.mishranStateError)
            }

            // Terminal payment states (Task 17.3). Confirmed routes to the
            // order detail view once 18.x lands it; for now the banner is
            // the confirmation surface.
            switch viewModel.paymentState {
            case .confirmed(let orderId):
                Label("Order confirmed — \(orderId)", systemImage: "checkmark.seal.fill")
                    .font(.mishranBodyLg.weight(.semibold))
                    .foregroundStyle(Color.mishranBrandAccent)
                    .accessibilityLabel("Order confirmed")
            case .abandoned:
                Label("Payment cancelled — your cart is saved.", systemImage: "arrow.uturn.backward")
                    .font(.mishranBodyMd)
            default:
                EmptyView()
            }
        }
        .navigationTitle("Checkout")
        // Confirmed hands off to the shell (thank-you screen); the parent
        // decides the navigation move.
        .onChange(of: viewModel.paymentState) { _, state in
            if case .confirmed = state {
                onPlaceOrder?(viewModel)
            }
        }
    }

    private func blockingText(_ reason: CheckoutViewModel.BlockingReason) -> String {
        switch reason {
        case .notServiceable:
            "We don't deliver to this pincode yet."
        case .freshItemOutsideFreshTier:
            "Fresh sweets ship same-day in Delhi NCR only. Swap them for shelf-stable sweets, or use a Delhi address."
        case .network:
            "Couldn't check this pincode. Try again."
        }
    }
}
