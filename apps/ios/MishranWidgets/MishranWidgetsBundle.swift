// MishranWidgetsBundle.swift — the extension's @main entry point.
// DeliveryActivity is a plain Widget struct; without an explicit
// WidgetBundle marked @main the extension links an entry-less Mach-O,
// which the simulator tolerates but App Store validation rejects
// ("__swift5_entry section is missing" on the appex). WidgetKit also
// needs the bundle to discover the ActivityConfiguration at runtime —
// this is what makes the Live Activity render on device, not just build.
import WidgetKit

@main
struct MishranWidgetsBundle: WidgetBundle {
    var body: some Widget {
        DeliveryActivity()
    }
}
