# Web ↔ Mobile parity analysis — 2026-08-15

Sources: four parallel code inventories (web storefront, `/api/mobile/v1` contract, iOS app,
Android app), with the four highest-severity claims re-verified by hand.

## 1. The framing asymmetry

The **web** is a marketing + lead-gen site with a *draft* cart: checkout, payment, auth,
account, orders are all branded stubs. The **mobile API + apps** carry the entire commerce
machinery. So "web → mobile parity" is really about *content and discovery* features; the
commerce direction runs the other way. Both directions have gaps, and both apps ship
**features that exist but cannot work** — those are the most urgent items.

## 2. Parity matrix — web feature → iOS → Android

| Web feature | iOS | Android | Verdict |
|---|---|---|---|
| Mithai catalog browse | ✅ offline-first grid | ✅ grid + badge | Parity (both exceed web) |
| Search by name | ✅ client-side | ✅ client-side | **Mobile exceeds web** (web has no search UI) |
| Family filter | ✅ filter sheet | ✅ filter sheet + chips | Parity+ (web has no filters) |
| Dietary filter | ✅ hardcoded 3 tags | ✅ catalog-derived tags | Parity+ (Android better: derived) |
| Sorting | ➖ none | ➖ none | Web has none either — even |
| QSR vertical (33 items) | ❌ | ❌ | **Missing both** (also needs API) |
| Snacks vertical (39) + retailer CTAs | ❌ | ❌ | **Missing both** (also needs API) |
| Merch vertical | ❌ | ❌ | **Missing both** (also needs API) |
| Home hero (carousel, CMS copy) | ❌ home = bare catalog | ⚠️ static hero, fake "best sellers" (first 8 by name) | Partial Android, none iOS |
| Home vertical portals / brand pillars | ❌ | ❌ | Missing (depends on verticals) |
| Stories/journal (hub, pillars, articles) | ❌ | ❌ | **Missing both** (needs API) |
| Wedding lead form | ❌ | ❌ | **Missing both** (web `/api/leads` is public — reusable) |
| Corporate lead form | ❌ | ❌ | Missing both |
| PDP price + tax note | ✅ | ✅ | Parity |
| PDP images/gallery | ❌ **SF Symbol placeholders everywhere** | ✅ Coil gallery + cards + hero | **iOS critical gap** |
| PDP pincode serviceability | ⚠️ lives in checkout only | ⚠️ lives in checkout (via address) | Acceptable mobile pattern — better than web |
| PDP pack-size selector (250/500/1kg) | ❌ | ❌ | **Missing both** (web-only feature today) |
| PDP buy-now | ❌ | ❌ | Missing both |
| PDP trust/provenance (karigar) strip | ⚠️ partial rows | ⚠️ partial rows | Minor gap |
| PDP story/ingredients/allergens/storage | ✅ | ✅ | Parity |
| Qty stepper 1–20 + add to cart | ✅ | ✅ | Parity |
| Cart badge + persistence | ✅ | ⚠️ badge: catalog toolbar icon only | Parity (Android badge shows count? — verify) |
| Editable cart (qty/remove/clear/totals) | ✅ swipe-to-delete | ✅ steppers + remove + clear + est. total | **Both exceed web** (web cart is read-only) |
| Checkout (address→slot→pay→confirm) | ❌ **dead end — cannot complete** | ⚠️ flow complete but payment verify broken | See defects |
| Razorpay pay + verify | ✅ wired | ⚠️ wired but signature always "" → verify fails | See defects |
| Order list/detail/timeline | ✅ pull-to-refresh | ✅ (no pull-to-refresh; Room cache + widget) | Mobile-only feature |
| OTP auth | ❌ **unreachable — no sign-in entry point** | ✅ full (SMS Retriever, biometric offer) | See defects |
| Sign in with Apple | ✅ (same unreachable flow) | n/a | See defects |
| Sign-out | ❌ none | ✅ | iOS gap |
| Account screen | ⚠️ wallet pass only | ✅ phone + addresses + sign-out | iOS gap |
| Delivery addresses CRUD | ❌ **none at all** | ⚠️ list/add/set-default (no delete — API has DELETE) | iOS critical; Android minor gap |
| Loyalty/wallet | ✅ Apple Wallet .pkpass | ❌ (Apple-only backend; no Google Wallet) | Android gap by design |
| Push notifications | ✅ APNs + Live Activity | ❌ inert (no google-services.json, no runtime permission ask) | Android gap |
| Biometric lock | ⚠️ code complete, cannot be armed | ✅ STRONG gate + enrollment | iOS gap |
| Deep links | ✅ mishran://order, /account | ✅ mishran://order + widget | Parity |
| i18n (3 locales on web) | ❌ 9 bundles generated, **zero wired** | ❌ same | **Missing both** — scaffolding exists |
| Theme switching (8 themes) | n/a | n/a | Deliberate skip — web marketing toy, not mobile-appropriate |
| Analytics (GA4/Pixel, 10 events) | ❌ | ❌ | Missing both |
| WhatsApp support links | ❌ | ⚠️ "Call support" with placeholder number | Missing/partial |
| SEO/sitemap/hreflang | n/a | n/a | Not applicable to apps |

## 3. Shipped-but-broken (all verified in code)

1. **iOS cannot sign in.** `AuthFlowView` is reachable only via the `-authScreen` launch
   argument (`MishranApp.swift:114`; comment admits "until the app shell routes there on its
   own" — it never does). Fresh install → catalog forever. No sign-in button, no sign-out.
2. **iOS checkout cannot complete.** `CheckoutView.swift:15` never passes
   `AddressPicker.onAddAddress`, and no code anywhere creates an address. `canPlaceOrder`
   requires an address → Place order permanently disabled.
3. **iOS renders no images at all.** No AsyncImage/Kingfisher/Nuke; every surface is an SF
   Symbol "photo" placeholder (ProductCard:17, ProductDetailView:21-24, CartLineItem:14-15).
4. **Android Razorpay verify always fails.** `PaymentResultSignatureHolder.park()` is never
   called — `MainActivity` doesn't override `onActivityResult` — so verify posts
   `signature = ""` and the server fails closed. Payments strand in `pending_payment`.
5. **Android push is inert.** `google-services.json` absent (plugins not applied) AND no
   runtime `POST_NOTIFICATIONS` request on 13+ — notification code ships but can never fire.
6. **Neither app can delete an address**, yet `DELETE /api/mobile/v1/addresses/[id]` exists
   (`route.ts:104`). The Android "contract has no DELETE" comment is stale.
7. Minor: dead duplicate `Routes.ADDRESSES` placeholder registration
   (`MishranNavGraph.kt:307`); `OrderConfirmedScreen` ETA params never passed
   (`MishranNavGraph.kt:249-265`); biometric gate unarbable on iOS; orders pagination
   page-1-only both apps; "Best sellers" is name-sorted head, not ranked.

## 4. Where mobile already exceeds web

Full commerce loop (cart→checkout→Razorpay→orders→tracking), offline-first catalog with
ETag/304 + background refresh, push + Live Activity + home-screen widget, biometrics,
deep links. Web's cart is read-only; both apps' carts are fully editable.

## 5. Mobile-fashion assessment

Good: offline-first, Room/SwiftData caches, swipe-to-delete (iOS), SMS Retriever autofill
(Android), serviceability folded into checkout address step, error/empty states throughout.
Needs work: iOS product images (a mithai app with no food photos), no pull-to-refresh on
Android lists, hardcoded English on both (web ships 3 locales), fake best-sellers ranking,
client-fabricated delivery slots (server has no slot catalog — acceptable v1, but label honestly).

## 6. Recommended plan

**P0 — make shipped features actually work (both apps)**
1. iOS: sign-in entry + sign-out (Account toolbar/buttons).
2. iOS: addresses screen + checkout wiring (mirror Android's screen; reuse DELETE too).
3. iOS: real image loading (AsyncImage or Kingfisher; reuse `images[]` already in DTO/entity).
4. Android: Razorpay signature parking (`onActivityResult` → `PaymentResultSignatureHolder.park`).
5. Android: runtime notification permission + FCM config decision.
6. Both: address delete; Android dead-route cleanup + OrderConfirmed ETA params.

**P1 — web-feature parity in apps**
7. PDP pack-size selector + buy-now (port `lib/mithai/packSizes.ts` logic to both apps).
8. i18n wiring on both (9-locale bundles already generated).
9. Android pull-to-refresh; real best-sellers signal (API `?sort=` or featured flag).
10. WhatsApp/support link with real number.

**P2 — net-new surfaces**
11. Stories/journal reader (needs API endpoint).
12. Wedding/corporate lead forms (reuse public `POST /api/leads`).
13. QSR/snacks/merch verticals (API exposure + app sections).
14. Mobile analytics (Firebase) + Android loyalty (Google Wallet) — deferred-register items.
