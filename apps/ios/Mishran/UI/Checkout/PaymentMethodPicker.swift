// PaymentMethodPicker.swift — Task 17.2 (Mishran Mobile Apps v1).
// Razorpay only in v1 (no COD/EMI per plan).
// B15 note: the Razorpay sheet owns method selection outright — the iOS
// SDK has no UPI preselect (and iOS is exempt from the 2026 UPI-collect
// deprecation, so the sheet's UPI tab keeps working). The label carries
// the UPI-first emphasis; no per-app deep links are promised.
import SwiftUI

struct PaymentMethodPicker: View {
    @Binding var selection: CheckoutViewModel.PaymentMethod?

    var body: some View {
        Picker(L("checkout.payment.title"), selection: $selection) {
            ForEach(CheckoutViewModel.PaymentMethod.allCases) { method in
                Text(method.displayName).tag(CheckoutViewModel.PaymentMethod?.some(method))
            }
        }
        .pickerStyle(.navigationLink)
        .accessibilityLabel(L("checkout.payment.title"))
    }
}
