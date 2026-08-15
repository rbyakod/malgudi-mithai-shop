// CheckoutView.swift — Task 17.2 (Mishran Mobile Apps v1).
// Form: address → pincode serviceability (slot section appears only for
// the fresh tier) → payment. Place Order lands with 17.3 (Razorpay).
// Task 48.2: the picker's add-address path finally goes somewhere — the
// sheet creates server-side, mirrors into SwiftData, and pre-selects the
// new row so "Place order" is reachable in one flow.
import SwiftData
import SwiftUI

struct CheckoutView: View {
    @Bindable var viewModel: CheckoutViewModel
    var onPlaceOrder: ((CheckoutViewModel) -> Void)? = nil

    @State private var pincodeField = ""
    @State private var showingAddressForm = false
    @Environment(\.modelContext) private var context
    @State private var addressRepository = AddressRepository(client: MishranAPIClient())

    var body: some View {
        Form {
            Section("Delivery address") {
                AddressPicker(
                    selection: $viewModel.address,
                    onAddAddress: { showingAddressForm = true }
                )
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
        .sheet(isPresented: $showingAddressForm) {
            AddressFormView { input in
                await createAddress(input)
            }
        }
    }

    /// Task 48.2: create server-side, re-mirror the full list into
    /// AddressEntity (the picker's @Query picks it up), and select the new
    /// row when it's the first address or became the default — otherwise
    /// the user just saved an address they still have to pick by hand.
    private func createAddress(_ input: AddressInputDTO) async -> Bool {
        guard let created = await addressRepository.create(input: input) else { return false }
        let hadNoLocalAddresses = ((try? context.fetchCount(FetchDescriptor<AddressEntity>())) ?? 0) == 0
        // Full re-list picks up the server-side default demotion too; if the
        // list call fails, fall back to appending what we just created.
        var serverList = await addressRepository.list()
        if serverList.isEmpty {
            serverList = [created]
        }
        AddressEntity.replaceAll(with: serverList, in: context)

        if let id = created.id,
           let entity = (try? context.fetch(FetchDescriptor<AddressEntity>()))?.first(where: { $0.id == id }) {
            if hadNoLocalAddresses || created.isDefault == true {
                viewModel.address = entity
            }
        }
        return true
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
