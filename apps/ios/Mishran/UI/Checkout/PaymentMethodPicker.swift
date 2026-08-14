// PaymentMethodPicker.swift — Task 17.2 (Mishran Mobile Apps v1).
// Razorpay only in v1 (no COD/EMI per plan).
import SwiftUI

struct PaymentMethodPicker: View {
    @Binding var selection: CheckoutViewModel.PaymentMethod?

    var body: some View {
        Picker("Payment", selection: $selection) {
            ForEach(CheckoutViewModel.PaymentMethod.allCases) { method in
                Text(method.displayName).tag(CheckoutViewModel.PaymentMethod?.some(method))
            }
        }
        .pickerStyle(.navigationLink)
        .accessibilityLabel("Payment method")
    }
}
