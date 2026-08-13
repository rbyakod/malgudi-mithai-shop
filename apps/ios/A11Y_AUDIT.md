# iOS Accessibility Audit — Mishran v1

Task 20.4 (Mishran Mobile Apps v1). Contract: tap targets ≥ 44pt,
WCAG AA contrast, VoiceOver-usable core flows, Dynamic Type through the
accessibility size categories.

## Automated (green — `MishranUITests/AccessibilityTests.swift`)

Runs on iPhone SE 3 (iOS 17.2) against the seeded catalog:

| Check | Screens | Result |
|---|---|---|
| Every tappable element carries a non-empty label | catalog, product detail, cart | Pass |
| Tap targets ≥ 44pt × 44pt (reported element frame) | catalog, product detail, cart | Pass |
| Quantity announces label + `accessibilityValue` | product detail | Pass |
| Catalog renders at AX1 (AccessibilityM), AX3 (XL), AX5 (XXXL) | catalog | Pass |

Violations the audit caught and fixed:

1. **Filters button reported 28×27** — a `.frame(minWidth: 44, minHeight: 44)`
   on the image inside an icon button does not expand the frame XCUITest
   reports. Fixed with a fixed 44×44 frame + `contentShape` in
   `AccessibilityHelpers.mishranIconAction(label:hint:)` — the one-call
   contract for icon-only buttons.
2. **Cart quantity steppers reported 24×24** — same min-frame pitfall inside
   the compressed List row; QuantitySelector now uses `mishranIconAction`
   plus hints that speak the current quantity.

Dynamic Type note: SwiftUI scales the brand text styles through the
accessibility categories; the AX1–AX5 test asserts the core actions survive
(truncation that changes meaning would still need eyes — covered below).

## Contrast

Brand tokens (`mishranBrandInk` on `mishranBrandCanvas`, canvas-on-accent
button pairs) verified WCAG AA in the Android 8.x token audit; the same
token set compiles into the iOS theme (`ThemeTests`).

## Manual gates (hardware — pending Apple Developer enrollment, Open Question #8)

- [ ] VoiceOver walkthrough on a physical device: sign-in → catalog →
      detail → cart → checkout → order detail → account. Focus order
      follows reading order; every control speaks its label; quantity
      steppers speak the value; swipe actions announce ("Remove <name>
      from cart").
- [ ] VoiceOver + Dynamic Type AX3: no essential action becomes unreachable.
- [ ] Reduce Motion pass: Live Activity + stage transitions honor it.
- [ ] Full Keyboard Access on iPad (tab order, focus visibility).

Sign off per item here when hardware is available.
