// AccessibilityHelpers.swift — Task 20.4 (Mishran Mobile Apps v1).
// One-call audit contract for icon-only buttons: accessibility label,
// optional hint, and the ≥44pt tap-target floor the AccessibilityTests
// UI suite enforces. New icon buttons should use this instead of
// hand-rolling frame + label.
import SwiftUI

extension View {
    /// Icon-only action button: labeled, hinted, ≥44pt hit area.
    func mishranIconAction(label: String, hint: String? = nil) -> some View {
        modifier(IconActionModifier(label: label, hint: hint))
    }
}

private struct IconActionModifier: ViewModifier {
    let label: String
    let hint: String?

    func body(content: Content) -> some View {
        // Fixed 44×44 — a min-frame does not reliably expand the frame
        // XCUITest reports for SwiftUI icon buttons (the audit reads the
        // element frame, not the hit-test area).
        let framed = content
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        if let hint {
            framed.accessibilityLabel(label).accessibilityHint(hint)
        } else {
            framed.accessibilityLabel(label)
        }
    }
}
