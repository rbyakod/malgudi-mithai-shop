// AccountView.swift — Task 19.3 (Mishran Mobile Apps v1).
// Minimal account hub: loyalty-pass promotion card (19.3) + quick links.
// Deep links mishran://account land here.
// Task 48.1: signed-in identity header + sign-out (tokens, best-effort
// server logout, local cart/order caches), and the Task 48.2 row into
// delivery-address management.
import SwiftData
import SwiftUI

struct AccountView: View {
    @State private var viewModel = AccountViewModel(client: MishranAPIClient())
    @Environment(\.modelContext) private var context
    let router: Router
    /// Task 48.1: the shell flips its launch surface to sign-in when this
    /// fires (same closure pattern as HomeView.onSignInRequested).
    var onSignedOut: (() -> Void)? = nil

    @State private var isSigningOut = false
    /// Best-effort client for the sign-out call — separate from the view
    /// model's so the loyalty state stays untouched.
    @State private var signOutClient = MishranAPIClient()

    /// Cheap keychain probe: a refresh token means a live session. Nothing
    /// customer-shaped persists locally yet (signedInCustomer lives only in
    /// the sign-in view model's memory), so the header shows a static
    /// identity until a customer cache lands.
    private var hasSession: Bool {
        KeychainTokenStore().refreshToken != nil
    }

    var body: some View {
        List {
            if hasSession {
                Section {
                    HStack(spacing: .mishranSpacingMd) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.mishranDisplay)
                            .foregroundStyle(Color.mishranBrandAccent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Signed in")
                                .font(.mishranBodyLg.weight(.semibold))
                            Text("Phone-verified Mishran account")
                                .font(.mishranBodySm)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)

                    Button(role: .destructive) {
                        Task { await signOut() }
                    } label: {
                        HStack {
                            if isSigningOut {
                                ProgressView()
                            } else {
                                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        }
                        .frame(minHeight: 44)
                    }
                    .disabled(isSigningOut)
                    .accessibilityLabel("Sign out")
                }
            }

            Section {
                WalletPassView(viewModel: viewModel)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section("Orders") {
                NavigationLink(value: Route.orders) {
                    Label("Order history", systemImage: "clock.arrow.circlepath")
                }
            }
            Section("Delivery") {
                NavigationLink(value: Route.addresses) {
                    Label("Delivery addresses", systemImage: "mappin.and.ellipse")
                }
                .accessibilityLabel("Delivery addresses")
            }
        }
        .navigationTitle("Account")
        .task {
            await viewModel.loadLoyaltyPass()
        }
    }

    /// Sign-out (Task 48.1): server logout + tokens dropped, then the
    /// customer-scoped local caches (cart lines + row, cached orders — and
    /// the address mirror, which would otherwise leak into the next
    /// customer's checkout picker). signedInOnce stays true so the next
    /// launch lands on sign-in, exactly like the revoked-session branch.
    private func signOut() async {
        isSigningOut = true
        defer { isSigningOut = false }
        await signOutClient.signOut()

        if let cart = try? context.fetch(FetchDescriptor<CartEntity>()).first {
            cart.delete(in: context)
        }
        for order in (try? context.fetch(FetchDescriptor<OrderEntity>())) ?? [] {
            context.delete(order)
        }
        for address in (try? context.fetch(FetchDescriptor<AddressEntity>())) ?? [] {
            context.delete(address)
        }
        try? context.save()

        router.popToRoot()
        onSignedOut?()
    }
}
