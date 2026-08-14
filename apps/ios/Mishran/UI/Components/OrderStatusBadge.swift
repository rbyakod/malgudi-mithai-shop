// OrderStatusBadge.swift — Task 18.1 (Mishran Mobile Apps v1).
// Status chip: label + tone-tinted capsule. The 5 happy-path stages get
// stage-indexed highlight treatment in OrderDetailView's timeline; this
// badge is the at-a-glance state on list rows and banners.
import SwiftUI

struct OrderStatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(OrderTimeline.label(for: status))
            .font(.mishranBodySm.weight(.semibold))
            .padding(.horizontal, .mishranSpacingSm)
            .padding(.vertical, 4)
            .background(tint.opacity(0.16), in: Capsule())
            .foregroundStyle(tint)
            .accessibilityLabel("Order status: \(OrderTimeline.label(for: status))")
    }

    private var tint: Color {
        switch OrderTimeline.tone(for: status) {
        case .positive: .mishranBrandAccent
        case .progress: Color.blue
        case .negative: .mishranStateError
        }
    }
}
