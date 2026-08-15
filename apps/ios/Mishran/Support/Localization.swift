// Localization.swift — Task 20.3 wiring (Mishran Mobile Apps v1).
// L(key, args…) resolves the flat dot-keys from the generated
// Localizable.strings tables (packages/i18n-strings/generated/ios,
// source of truth: packages/i18n-strings/<locale>.json — regenerate with
// `pnpm --filter @mishran/i18n-strings codegen:ios`).
//
// The iOS codegen keeps ICU-style `{token}` placeholders verbatim, and
// neither String(localized:) nor Text() substitutes them — the helper
// replaces each `{token}` with the positional argument of the same index.
// NSLocalizedString (not String(localized:)) backs the lookup because the
// key is a runtime string: String.LocalizationValue treats its argument as
// a compile-time literal, so a dynamic key needs the careful
// String(localized: String.LocalizationValue(key)) spelling anyway —
// NSLocalizedString is the plain equivalent that reads the same table on
// the iOS 17 deployment floor. Falls back to the key itself when a table
// entry is missing (same behavior as NSLocalizedString).
import Foundation

/// Localized string for a flat dot-key, with positional `{token}` fill-in.
///
///     L("cart.title")                          // "Your cart"
///     L("auth.otp.subtitle", viewModel.phone)  // "Enter the code we sent to +91…"
///     L("checkout.pay", "₹720")                // "Pay ₹720"
func L(_ key: String, _ args: String...) -> String {
    let template = NSLocalizedString(key, comment: "")
    guard !args.isEmpty else { return template }
    var result = template
    // One `{token}` per argument, in order; unmatched tokens and surplus
    // arguments pass through untouched (args containing "{…}" are not a
    // supported shape — no product text carries braces).
    for arg in args {
        guard let range = result.range(of: #"\{[^}]+\}"#, options: .regularExpression) else { break }
        result.replaceSubrange(range, with: arg)
    }
    return result
}
