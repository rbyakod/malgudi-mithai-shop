// AccountView.swift — Task 19.3 (Mishran Mobile Apps v1).
// Minimal account hub: loyalty-pass promotion card (19.3) + quick links.
// Deep links mishran://account land here.
import SwiftUI

struct AccountView: View {
    @State private var viewModel = AccountViewModel(client: MishranAPIClient())

    var body: some View {
        List {
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
        }
        .navigationTitle("Account")
        .task {
            await viewModel.loadLoyaltyPass()
        }
    }
}
