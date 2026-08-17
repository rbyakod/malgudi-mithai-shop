// MishranTheme.swift — Task 14.2 (Mishran Mobile Apps v1).
// Root ViewModifier applying the brand defaults (colors + typography from the
// generated token extensions in Generated/MishranTokens.swift). Individual
// screens override as needed; this sets the canvas.
import SwiftUI

struct MishranThemeModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            // Body typography at lg (16pt) with ink on the warm canvas —
            // the shop-front palette on every screen by default.
            .font(.mishranBodyLg)
            .foregroundStyle(Color.mishranBrandInk)
            .tint(Color.mishranBrandAccent)
            .background(Color.mishranBrandCanvas)
            // Lock light: brand tokens (canvas/ink/accent) are fixed light
            // values, and pushed screens draw the system background over
            // the canvas — following system dark mode left nav bars, scroll
            // backgrounds, and .secondary text black/washed-out while cards
            // stayed cream. A real dark palette is a deliberate v2 decision.
            .preferredColorScheme(.light)
            .environment(\.layoutDirection, .leftToRight)
    }
}

extension View {
    /// Apply Mishran brand defaults. Call once at the root of `MishranApp`.
    func mishranTheme() -> some View {
        modifier(MishranThemeModifier())
    }
}
