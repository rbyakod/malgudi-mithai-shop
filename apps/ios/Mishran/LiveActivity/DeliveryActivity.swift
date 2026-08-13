// DeliveryActivity.swift — Task 18.2 (Mishran Mobile Apps v1).
// Live Activity rendering — lock-screen banner + Dynamic Island. Lives in
// the MishranWidgets extension (ActivityConfiguration widgets only render
// from a widget extension bundle); state/attributes are shared via
// DeliveryAttributes.swift, compiled into both targets.
//
// Stage accents per plan Step 4: marigold (brand pop) for dispatched,
// saffron (state warning) for out_for_delivery. Dynamic Island rendering
// is manual-gated on a physical iPhone 14 Pro+ (plan Step 6).
import ActivityKit
import SwiftUI
import WidgetKit

struct DeliveryActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryAttributes.self) { context in
            // Lock screen / banner.
            HStack(spacing: .mishranSpacingMd) {
                Image(systemName: "shippingbox.fill")
                    .font(.mishranBodyLg)
                    .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mishran order \(context.attributes.orderId)")
                        .font(.mishranBodySm.weight(.semibold))
                        .foregroundStyle(Color.mishranBrandInk)
                    Text(Self.stageLabel(context.state.status))
                        .font(.mishranBodySm)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: Self.stageSymbol(context.state.status))
                    .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
            }
            .padding(.mishranSpacingMd)
            .activityBackgroundTint(Color.mishranBrandSurface)
            .accessibilityLabel("Delivery status: \(context.state.status)")
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Mishran", systemImage: "shippingbox.fill")
                        .font(.mishranBodySm)
                        .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.status)
                        .font(.mishranBodySm.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.center) {
                    Text("Order \(context.attributes.orderId)")
                        .font(.mishranBodySm)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.statusLabel)
                        .font(.mishranBodySm)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "shippingbox.fill")
                    .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
            } compactTrailing: {
                Image(systemName: Self.stageSymbol(context.state.status))
                    .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
            } minimal: {
                Image(systemName: "shippingbox.fill")
                    .foregroundStyle(DeliveryAttributes.stageTint(for: context.state.status))
            }
            .keylineTint(DeliveryAttributes.stageTint(for: context.state.status))
        }
    }

    /// Stage key → SF Symbol (unknown → box).
    nonisolated static func stageSymbol(_ status: String) -> String {
        switch status {
        case "confirmed": "checkmark.circle.fill"
        case "packed": "gift.fill"
        case "dispatched": "truck.fill"
        case "out_for_delivery": "bicycle"
        case "delivered": "house.fill"
        default: "shippingbox.fill"
        }
    }

    /// Friendly copy for the lock-screen line (extension-local; the app's
    /// OrderTimeline handles in-app rendering).
    nonisolated static func stageLabel(_ status: String) -> String {
        switch status {
        case "confirmed": "Confirmed"
        case "packed": "Packed"
        case "dispatched": "Dispatched"
        case "out_for_delivery": "Out for delivery"
        case "delivered": "Delivered"
        default: "On its way"
        }
    }
}
