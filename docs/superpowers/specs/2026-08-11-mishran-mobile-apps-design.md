# Mishran Mobile Apps (iOS + Android) — Customer-Facing Commerce App Design

**Status:** Spec (brainstorming output, awaiting user review)
**Date:** 2026-08-11
**Author:** Ravi Byakod (with Claude)
**Sources:**
- `2026-08-10-mishran-digital-flagship-design.md` (umbrella PRD)
- `2026-08-10-mishran-foundation-phase.md` (foundation implementation plan)
- `Mishran Brand Strategy Summary Draft 1.0` (PDF)

---

## 1. Executive Summary

This spec defines native mobile apps for iOS and Android that let Mishran customers browse the catalog, place orders, pay via Razorpay, and track delivery status. The apps ship **before** the Shopify commerce migration, against a custom backend that extends the existing Next.js + Payload CMS foundation. The backend is built with an adapter layer so every external dependency — payments, SMS, push, email, logistics, analytics — can be swapped via config when business contracts or scale demands change.

**Both platforms ship in v1.** Android (Kotlin + Jetpack Compose) targets Google Play; iOS (Swift + SwiftUI) targets the App Store. Android leads by ~2 months — first backend cut, first E2E integration, first store canary — with iOS following on the shared backend once Android v1 is in staged rollout. The two release trains run in parallel from Task 72 onward (see plan).

**iOS floor: iOS 17+.** Required for ActivityKit (Live Activity, Dynamic Island), SwiftData, modern SwiftUI. ~85% of Indian iPhone users on iOS 17+ as of spec date.

**iOS v1 includes platform differentiators** beyond Android feature parity:
- **Sign in with Apple** — required by App Store Review Guideline 4.8 because the app offers third-party login (phone OTP counts). ~3 tasks.
- **Live Activity + Dynamic Island** — lock-screen delivery tracker, milestone updates (Packed → Dispatched → Out for delivery → Delivered). ~4 tasks.
- **Apple Wallet loyalty pass** — repeat customers get a `.pkpass` with running loyalty tier + last order summary. Backend generates passes; iOS adds to Wallet. ~5 tasks.

**Critical posture:** This spec defers the umbrella web PRD's "commerce deferred" constraint specifically for the mobile channel. Web remains draft-only until the Shopify phase. Mobile runs its own commerce backend with a documented migration path to Shopify Storefront API once that migration lands.

### Out of scope for v1

- Admin functionality of any kind (this is a customer-only app)
- Live map driver tracking (v3)
- Third-party courier API integration (v2)
- AR gift preview (permanent non-goal)
- Voice concierge / PersonaPlex (Phase 9 in umbrella PRD)
- Subscriptions, rewards, referrals, customer accounts history beyond basic order list
- iPad-optimized layout (iPhone-only v1; iPad comes in v2)
- Apple Watch companion (v3)
- Apple Pay (under evaluation; Razorpay UPI/cards is v1 default)

---

## 2. Goals and Non-Goals

### Goals

| Area | Goal |
|---|---|
| Reach | Native app on Google Play **and** App Store covering 9 Indian languages. Android leads ship by ~2 months; iOS follows on shared backend. |
| Ordering | End-to-end browse → cart → checkout → Razorpay payment → order placement → order history. |
| Catalog | Offline-first catalog with search, category filter, dietary filter (sugar-free, eggless), regional collections. |
| Tracking | 5-step status-only delivery tracking with push notifications + Android home-screen widget + iOS Live Activity. No live map in v1. |
| Auth | Phone OTP login with biometric re-auth + Sign in with Apple (iOS, App Store rule 4.8). JWT sessions with refresh-token rotation. |
| Brand | Premium native feel matching Mishran's heritage-modern identity. Material 3 on Android; SwiftUI native on iOS. |
| Operations | Status updates driven by ops staff via Payload admin until v2 courier API integration. |
| Engineering | Every external dependency behind an adapter interface. Vendor swap is env var + impl change, not a rewrite. |

### Non-Goals (v1)

- Live map / driver-on-map tracking. Deferred to v3.
- Third-party courier integration (Delhivery/Shadowfax/etc.). Deferred to v2.
- iOS app. Deferred to a v2 release window 2–3 months after Android v1.
- Cash on Delivery (COD). Deferred — ops cost (failed deliveries, reconciliation, fraud).
- EMI and pay-later. Deferred until average order value justifies.
- Live Activities / Apple Wallet passes. Deferred to iOS v2.
- Loyalty, referrals, subscriptions. Out of scope.
- Wedding/corporate configurators on mobile. v1 routes these to the web lead form.
- Multi-warehouse inventory. Single Delhi NCR warehouse assumed for v1.
- Customer-side refund flow. v1 is ops-initiated via admin.

---

## 3. Audience and Use Cases

| Audience | Primary need | Mobile experience requirement |
|---|---|---|
| Everyday premium buyer | Fresh mithai for home, hosting, table | Fast discovery, freshness signals, easy reorder, delivery clarity |
| Gift buyer | Thoughtful, polished, personalized box | Gift-builder canvas on mobile-web; app routes to it for v1 |
| Wedding buyer | Bulk gifting, MOQ transparency | Routes to web wedding configurator; captures lead via deep link |
| Corporate buyer | GST-friendly, branded, repeat orders | Routes to web corporate lead form |
| Health-conscious buyer | Sugar-free without compromise | Sugar-free collection, dietary filters, ingredient clarity |
| Discovery-led buyer | Regional mithai, modern originals | Regional collections, editorial storytelling surfaces |
| Returning customer | Quick reorder, status visibility | Reorder from history, push notifications, order status widget |

---

## 4. Brand Strategy → Design Principles

Carried from the umbrella PRD into the mobile app:

1. **Milk-First Purity** — every PDP and the home surface foreground the Jhajjar farm story and freshness promise with sensory, specific language.
2. **The Karigar & His Mastery** — karigar archetype profiles (Chenna, Kaju, Ghee specialists) are first-class content.
3. **Karigari — Technique Driven by Tradition** — technique glossary appears on relevant product and story screens.
4. **Modern Experience** — app performance, accessibility, and clarity are non-negotiable. Heritage does not excuse friction.
5. **Copy principle** — warm, specific, sensory. Avoid generic claims ("premium quality") unless immediately backed by proof.

The app's reason to exist is the **native-feeling** experience. Material 3 on Android (with motion, dynamic color where supported, glanceable widget) and SwiftUI on iOS (with Live Activity and Wallet in v2) are how the brand earns the install over the responsive web.

---

## 5. Architecture Overview

### 5.1 High-level shape

```
┌─────────────────────────────────────────────────────────────────┐
│                       SHARED BACKEND                            │
│  Next.js 16 App Router + Payload 3.x CMS + MongoDB              │
│  (existing web codebase — extended with mobile commerce)        │
│                                                                 │
│  Routes (under /api/mobile/v1/*):                              │
│   • POST /auth/otp/send, /auth/otp/verify, /auth/refresh       │
│   • GET  /catalog/products, /catalog/categories                │
│   • GET  /products/:slug                                        │
│   • POST /cart/validate (server-side price/stock check)        │
│   • POST /orders, GET /orders, GET /orders/:id                  │
│   • POST /payments/razorpay/create-order                        │
│   • POST /payments/razorpay/verify                              │
│   • POST /webhooks/razorpay                                     │
│   • POST /delivery/status-update (internal ops)                │
│   • POST /addresses, GET /addresses                            │
│   • GET  /account/me                                            │
│   • POST /notifications/register-device                        │
│                                                                 │
│  Payload collections added:                                     │
│   customers, addresses, orders, payments, shipments,           │
│   serviceablePincodes, otpRequests, devices,                   │
│   idempotencyKeys, securityEvents, revokedTokens               │
└─────────────────────────────────────────────────────────────────┘
            ▲                              ▲
            │ HTTPS + JWT (RS256)          │
            │ OpenAPI 3.1 contract         │
            │ gzip + ETag caching          │
            │                              │
┌───────────┴──────────────┐    ┌──────────┴───────────────┐
│   ANDROID APP            │    │   iOS APP (v2)           │
│   Kotlin + Compose       │    │   Swift + SwiftUI        │
│   • MVVM + Coroutines    │    │   • MVVM + Combine       │
│   • Retrofit + OkHttp    │    │   • URLSession           │
│   • Hilt DI              │    │   • Keychain             │
│   • DataStore + Room     │    │   • Live Activity        │
│   • WorkManager          │    │   • Apple Wallet pass    │
│   • FCM push             │    │   • APNs push            │
│   • BiometricPrompt      │    │   • Apple Sign-in        │
│   • Razorpay Android SDK │    │   • Razorpay iOS SDK     │
│   • Material 3 widget    │    │                          │
│   • Google Wallet pass   │    │                          │
└──────────────────────────┘    └──────────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SHARED PACKAGES (pnpm-workspace monorepo)                     │
│   • api-contract/    OpenAPI 3.1 YAML + codegen per platform   │
│   • brand-tokens/    Tailwind-derived tokens JSON + codegen    │
│   • i18n-strings/    9-locale source JSON + per-platform codegen│
│   • analytics-taxonomy/  Event schema single source            │
│   • feature-flags/   GrowthBook config + per-platform SDKs     │
│   • e2e-flows/       Gherkin specs consumed cross-platform     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Repository structure

pnpm-workspace monorepo. Existing Next.js app stays in current location. New workspaces:

```
mithai-shop/
├── app/                       (existing Next.js — extended with mobile API routes)
├── components/                (existing web components)
├── context/                   (existing)
├── lib/                       (existing + new commerce/auth/notifications modules)
├── packages/
│   ├── api-contract/
│   ├── brand-tokens/
│   ├── i18n-strings/
│   ├── analytics-taxonomy/
│   ├── feature-flags/
│   └── e2e-flows/
├── apps/
│   ├── android/               (Kotlin + Compose)
│   └── ios/                   (Swift + SwiftUI, ships v2)
└── docs/
    └── superpowers/
        ├── plans/
        └── specs/
```

### 5.3 Infrastructure stance

**Self-hosted by default, with documented cloud-migration paths.** This is a deliberate cost-and-control posture for the foundation + mobile phase.

| Component | v1 choice | Cloud migration path |
|---|---|---|
| MongoDB | Self-hosted single-node replica set on a VPS (Docker). Required by Payload change-stream support. | Connection-string swap to Atlas M10+ when scale or HA demands. |
| File storage | Local disk on VPS for product imagery (synced from Payload). | MinIO (self-hosted S3-compatible) → S3/R2/GCS. |
| Email | Resend free tier (3k/mo). | SES / Postmark / SendGrid via `EmailService` adapter. |
| SMS + OTP | MSG91. | Kaleyra / Twilio / Gupshup via `OtpService` + `SmsService` adapters. |
| Push | FCM v1 (Android) + APNs direct (iOS, when shipped). | OneSignal / SNS via `PushService` adapter. |
| Error reporting | Self-hosted Sentry on the same VPS. | Hosted Sentry / Bugsnag via `ErrorReporter` adapter. |
| Logging | Pino JSON → Vercel log drain → self-hosted Loki. | Grafana Cloud / Datadog when volume justifies. |
| Metrics | Prometheus + Grafana self-hosted. | Grafana Cloud / Datadog. |
| App distribution | Play Store internal + production tracks. App Store Connect + TestFlight for iOS. | — |
| Apple Push (APNs) | Direct APNs via `apn` library, `.p8` key-based auth. | OneSignal / SNS via `PushService` adapter. |
| Apple Wallet passes | `node-passbook` library, signed `.pkpass` files. Passbook cert from Apple Developer portal. | — |
| Apple Sign-in | `jsonwebtoken` + Apple JWKS endpoint verification. | FirebaseAuth, Google OAuth via `AuthProvider` adapter. |

### 5.4 Release cadence

- **Backend:** continuous deploy via Vercel on merge to `main`.
- **Mobile:** 2-week sprints, monthly store releases per platform. Android leads; iOS follows ~2 months behind on shared backend.
- **API contract versioning:** `/api/mobile/v1/*`. Breaking changes require parallel `/v2/*` rollout with mobile min-version gate. Non-breaking additive changes within same major.
- **OTA updates:** Android-only — Play Asset Packs for non-native bug fixes (config strings, color tweaks). iOS requires full store resubmit. RemoteConfig (via `feature-flags/`) for non-binary toggles on both platforms.
- **iOS Live Activity + Wallet pass updates:** APNs-driven, not store-resubmit. New visual variants or pass layouts ship via push without store review.

---

## 6. Components and Modules

### 6.1 Backend modules

| Module | Responsibility |
|---|---|
| `payload.config.ts` | Adds collections: `customers`, `addresses`, `orders`, `payments`, `shipments`, `serviceablePincodes`, `otpRequests`, `devices`, `idempotencyKeys`, `revokedTokens`, `securityEvents`. Localized fields fall back to `en`. |
| `app/api/mobile/v1/*` | Thin route handlers. Validate JWT (or refresh token), delegate to services. No business logic in routes. |
| `app/api/admin/orders/[id]/status/route.ts` | Ops-only endpoint (Payload admin role) to advance delivery status. Triggers `OrderEventEmitter`. |
| `app/api/webhooks/razorpay/route.ts` | Razorpay webhook handler. Signature verification + idempotent update of `payments` doc. |
| `lib/commerce/CatalogService.ts` | Interface + `PayloadCatalogService` impl. Reads products, categories, search, filters. Future: `ShopifyStorefrontCatalogService`. |
| `lib/commerce/OrderService.ts` | Interface + `PayloadOrderService` impl. Cart validation → order creation → status transitions → refund initiation. |
| `lib/commerce/PaymentService.ts` | Interface + `RazorpayPaymentService` impl. Create-order, verify-signature, fetch-status, refund. Idempotent on `providerPaymentId`. |
| `lib/commerce/PincodeService.ts` | Reads `serviceablePincodes` collection. Returns tier (`fresh` / `shelf`), SLA, available cities. |
| `lib/commerce/DeliveryService.ts` | Interface. v1: `ManualDeliveryService` (ops updates status). v2: `CourierApiDeliveryService` (Delhivery/Shadowfax). v3: `LiveMapDeliveryService`. |
| `lib/auth/OtpService.ts` | Interface + `Msg91OtpService` impl. Rate-limit per phone (5/hr, 10/day). Hash stored in `otpRequests`. 6-digit, 5-min expiry. |
| `lib/auth/JwtService.ts` | RS256 JWT. Access (15 min) + refresh (30 d). Refresh rotation. Revocation list in `revokedTokens`. |
| `lib/auth/AuthProvider.ts` | Interface. v1: `JwtAuthProvider` (in-house OTP). v2: `AppleSignInProvider` (App Store rule 4.8). Future: `GoogleOAuthProvider`, `FirebaseAuthProvider`. |
| `lib/notifications/PushService.ts` | Interface + impls `FcmPushService`, `ApnsPushService`, `UnifiedPushService` (fans out to both). |
| `lib/notifications/OrderEventEmitter.ts` | Listens to order status transitions → fires push + (optional) SMS + analytics events. |
| `lib/notifications/SmsService.ts` | Interface + `Msg91SmsService` impl. Templates keyed, locale-aware. |
| `lib/email/EmailService.ts` | Interface + `ResendEmailService` impl. Order confirmation, delivery updates, refund receipts. |
| `lib/i18n/TranslationService.ts` | Interface. v1: `ManualTranslationService` (reads JSON from `packages/i18n-strings/`). Future: `GoogleTranslateService`, `DeepLService`, `OpenAiTranslationService` for marketing copy. |
| `lib/analytics/AnalyticsService.ts` | `MultiAnalyticsService` fans out to children: `Ga4AnalyticsService`, `MetaPixelService`. Future: `MixpanelService`, `AmplitudeService`, `PosthogService` (self-hosted), `RudderStackService`. |
| `lib/files/StorageService.ts` | Interface. v1: `LocalDiskStorageService`. Future: `MinioStorageService`, `S3StorageService`, `CloudflareR2StorageService`. |
| `lib/search/SearchService.ts` | Interface. v1: `MongoSearchService` (`$text` + regex). Future: `MeilisearchService`, `TypesenseService`, `AlgoliaService`. |
| `lib/featureflags/FeatureFlagService.ts` | Interface. v1: `EnvFlagService`. Future: `GrowthBookService`, `LaunchDarklyService`, `PosthogFlagService`. |
| `lib/observability/ErrorReporter.ts` | Interface. v1: `SentryReporter` (self-hosted). Future: `BugsnagReporter`, `CrashlyticsReporter`. |
| `lib/container.ts` | DI container. Resolves each service by env var. Single point of vendor swap. |
| `lib/idempotency/` | Helper. Stores request hash + response for 24h in `idempotencyKeys`. Same key + same body returns cached response. Same key + diff body returns 409. |
| `lib/security/RateLimiter.ts` | Per-phone, per-IP, per-endpoint token-bucket limits. Mongo-backed. |

### 6.2 Shared packages

| Package | Contents |
|---|---|
| `packages/api-contract/` | `openapi.yaml` (single source of truth). Generated: TS types via `openapi-typescript`; Kotlin data classes via `openapi-generator`; Swift `Codable` structs via `swift-openapi-generator`. CI check blocks PRs that break contract without version bump. |
| `packages/brand-tokens/` | `tokens.json` (colors, type scale, radii, shadows, spacing). Generated from web Tailwind config. Per-platform codegen: Compose `Color` / `Typography` objects; Swift `Color` / `Font` extensions; CSS variables for web. |
| `packages/i18n-strings/` | Per-locale JSON: `en.json`, `hi.json`, `kn.json`, `ta.json`, `te.json`, `mr.json`, `gu.json`, `bn.json`, `pa.json`. Tool checks for missing keys across locales on PR. Codegen: `strings.xml` per locale (Android); `Localizable.strings` per locale (iOS); `messages.json` per locale (web). |
| `packages/analytics-taxonomy/` | `events.yaml` — event names + params + types. Codegen per platform. |
| `packages/feature-flags/` | GrowthBook config + per-platform SDK wrappers. |
| `packages/e2e-flows/` | Gherkin feature files consumed by Maestro (Android, iOS) and Playwright (web). Cross-platform parity. |

### 6.3 Android app structure

```
apps/android/app/
├── ui/                      # Jetpack Compose screens, Material 3
│   ├── theme/               # MishranTheme.kt — colors/type from brand-tokens
│   ├── home/                # HomeScreen, carousel, festival strip
│   ├── catalog/             # CatalogScreen, search, filters
│   ├── product/             # ProductDetailScreen, gallery, quantity
│   ├── cart/                # CartScreen, edit qty, remove
│   ├── checkout/            # Address, slot, payment selection
│   ├── orders/              # OrderListScreen, OrderDetailScreen
│   ├── account/             # ProfileScreen, AddressBook, Settings
│   ├── auth/                # PhoneEntryScreen, OtpScreen, BiometricGate
│   └── components/          # Reusable composables
├── data/
│   ├── remote/              # Retrofit interfaces (from api-contract)
│   ├── local/               # Room DAOs (products cache, cart, addresses)
│   ├── repository/          # CatalogRepository, OrderRepository, etc.
│   └── sync/                # WorkManager workers (catalog refresh, push reg)
├── domain/
│   ├── model/               # Domain models (mapped from DTO)
│   └── usecase/             # PlaceOrderUseCase, ValidatePincodeUseCase, etc.
├── di/                      # Hilt modules
├── push/                    # FCM messaging service
├── widget/                  # OrderStatusWidget (Glance)
├── navigation/              # NavGraph, deep links (mishran://order/{id})
└── MishranApp.kt            # Application class
```

### 6.4 iOS app structure (v1)

```
apps/ios/Mishran/
├── UI/                      # SwiftUI screens (iOS 17+)
│   ├── Theme/               # MishranTheme.swift — colors/type from brand-tokens
│   ├── Home/                # HomeView, carousel, festival strip
│   ├── Catalog/             # CatalogView, search, filters
│   ├── Product/             # ProductDetailView, gallery, quantity
│   ├── Cart/                # CartView, edit qty, remove
│   ├── Checkout/            # Address, slot, payment selection
│   ├── Orders/              # OrderListView, OrderDetailView
│   ├── Account/             # ProfileView, AddressBook, Settings
│   └── Auth/                # PhoneEntryView, OTPView, BiometricGate, AppleSignInButton
├── Data/
│   ├── Remote/              # URLSession + async/await API client (from api-contract)
│   ├── Local/               # SwiftData models (products cache, cart, addresses)
│   ├── Repository/          # CatalogRepository, OrderRepository, etc.
│   └── Sync/                # BGTaskScheduler tasks (catalog refresh, push reg)
├── Domain/
│   ├── Models/              # Domain models (mapped from DTO)
│   └── UseCases/            # PlaceOrderUseCase, ValidatePincodeUseCase, etc.
├── DI/                      # Swift Concurrency + Factory pattern (no DI framework)
├── Push/                    # APNs delegate, UNUserNotificationCenter
├── LiveActivity/            # ActivityKit widget for delivery tracker + Dynamic Island
├── Wallet/                  # PassKit pass addition + LoyaltyPassManager
├── Auth/                    # ASAuthorizationAppleIDProvider wrapper, Keychain helpers
├── Navigation/              # NavigationStack + deep links (mishran://order/{id})
└── MishranApp.swift         # @main App struct
```

Notable iOS-specific surfaces:
- **`Auth/AppleSignIn.swift`** — `ASAuthorizationAppleIDProvider` wrapper. Server-side: `POST /auth/apple` exchanges `authorizationCode` for JWT pair. App Store Review rule 4.8 compliance.
- **`LiveActivity/DeliveryActivity.swift`** — ActivityKit widget config. Lock-screen + Dynamic Island presentation of `order.status_changed` push payloads.
- **`Wallet/LoyaltyPassManager.swift`** — `PKAddPassesViewController` flow. Fetches signed `.pkpass` from `GET /account/loyalty-pass`.
- **`Data/Local/`** uses SwiftData (iOS 17+) for offline-first parity with Android Room.
- **Push** uses APNs directly via `APNsService` impl (shared interface with FCM impl on backend).

### 6.5 Ops surfaces (within web admin)

Payload admin already at `/admin`. Extended with custom views:

- `/admin/orders-board` — kanban of orders by delivery status. Drag to advance.
- `/admin/pincode-manager` — CRUD on `serviceablePincodes`.
- `/admin/customer-detail` — order history, addresses, devices.
- `/admin/otp-logs` — OTP delivery audit, rate-limit hits.
- `/admin/payment-reconciliation` — match Razorpay settlements to `payments` docs.

---

## 7. Adapter Layer — Provider Swap Matrix

Every external dependency has an interface + pluggable impl. Routes / ops / app code depend on **interface only**. Wiring lives in `lib/container.ts`.

| Domain | Interface | Current impl | Future swaps anticipated |
|---|---|---|---|
| Payments | `PaymentService` | Razorpay | Cashfree, PhonePe, Billdesk, BharatPe, Stripe (intl) |
| OTP SMS | `OtpService` | MSG91 | Kaleyra, Twilio, Gupshup, SmsCountry, WhatsApp BSP |
| Transactional SMS | `SmsService` | MSG91 | (same vendor list as OTP) |
| Push (Android) | `PushService` impl | FCM v1 | OneSignal, AWS SNS |
| Push (iOS) | `PushService` impl | APNs direct | UnifiedPush, OneSignal, SNS |
| Email | `EmailService` | Resend | SES, Postmark, SendGrid, Mailgun, self-host SMTP |
| Logistics | `DeliveryService` | Manual ops | Delhivery, Shadowfax, Dunzo, Xpressbees, Ekart, Shiprocket |
| Translation | `TranslationService` | Manual JSON | Google Translate, DeepL, OpenAI |
| Analytics | `AnalyticsService` | GA4 + Meta Pixel | Mixpanel, Amplitude, Posthog (self-hosted), RudderStack |
| Auth | `AuthProvider` | JWT (in-house OTP) | Google OAuth, Apple Sign-in, FirebaseAuth |
| File storage | `StorageService` | Local disk | MinIO, S3, GCS, R2 |
| Search | `SearchService` | Mongo $text + regex | Meilisearch, Typesense, Elastic, Algolia |
| Feature flags | `FeatureFlagService` | Env var | GrowthBook, LaunchDarkly, Posthog, ConfigCat |
| Error reporting | `ErrorReporter` | Sentry (self-hosted) | Bugsnag, Crashlytics |
| DB | Mongo via Payload adapter | Self-hosted replica set | Atlas M10+, FerretDB, DocumentDB |

### Vendor swap migration checklist (per adapter)

When swapping provider X → Y:

1. Add new impl class implementing same interface.
2. Add env var branch in `lib/container.ts`.
3. Add config block for new vendor (key rotation, webhook URLs, IP allowlists).
4. Data backfill if vendor-specific IDs stored (e.g., `providerPaymentId` semantics differ).
5. Feature-flag the new impl behind `flag='use-new-{service}'` for 1 week on 5% traffic.
6. Cutover via env var change. Keep old impl class in code for rollback.
7. Remove old impl after 30 days of clean production.

---

## 8. Data Flows

### 8.1 Phone OTP + biometric login (first run)

1. User enters phone (`+91…`). App calls `POST /api/mobile/v1/auth/otp/send`.
2. Backend checks rate limit (5/hr, 10/day per phone), generates 6-digit code, stores Argon2 hash in `otpRequests`, sends SMS via `OtpService` (MSG91).
3. App starts 5-min countdown. SMS Retention API autofills OTP on Android.
4. User submits OTP. App calls `POST /auth/otp/verify { requestId, code }`.
5. Backend verifies hash + expiry, upserts `customers` doc, mints access JWT (15 min) + refresh JWT (30 d, rotated). Returns tokens + customer record.
6. App stores tokens in Android EncryptedSharedPreferences. Prompts: "Enable biometric quick login?"
7. User confirms. `BiometricPrompt` auth → refresh token stored in Android Keystore, key biometric-gated.

Subsequent logins: biometric unlocks Keystore → refresh token used → new access token → home in <300 ms.

### 8.2 Browse catalog (offline-first)

1. App cold start. `CatalogRepository.getCatalog(force=false)` checks Room for `products` with `stale_at < now-15min`.
2. If cached rows exist, emit to UI immediately.
3. Fire `GET /api/mobile/v1/catalog/products?since={etag}` with `If-None-Match: {etag}`.
4. Backend computes ETag from latest `products.updatedAt`. Returns `304 Not Modified` on match, else `200 + payload + new ETag`.
5. On `200`: upsert into Room, update etag + stale_at. On `304`: refresh stale_at only. On network fail: keep cache, show "Updated X min ago" banner.
6. WorkManager periodic job (every 6 h): background refresh.

UI: shimmer skeleton while first load. After that, always shows cached instantly.

### 8.3 Place order (critical path)

1. **Cart screen** (items locally in Room + DataStore). User taps **Checkout**.
2. `PincodeCheckUseCase` calls `GET /api/mobile/v1/catalog/serviceable?pincode={p}`. Backend looks up `serviceablePincodes` → tier + slaDays. If any cart item is `fresh` and pincode tier is `shelf`, hard-block with inline error.
3. **Checkout screen**: address (default or pick), delivery slot (for Delhi fresh: today/tomorrow slots), payment method (UPI / card / netbanking / wallet).
4. User taps **Pay ₹X**. App calls `POST /api/mobile/v1/cart/validate` with `items[], address.pincode, slot`. Backend re-fetches prices from `products` (does not trust client), re-checks pincode, re-checks stock, computes totals (itemsTotal, deliveryFee, taxes, discount). Returns `{ cartSnapshot, totals, expiresAt: +10min }`.
5. If cart changed since UI render, modal shows diff. User confirms.
6. App calls `POST /api/mobile/v1/payments/razorpay/create-order` with `cartSnapshot.id`. Backend uses idempotency key `sha256(customerId + snapshot.id)`. Creates `orders` doc (status=`pending_payment`), `payments` doc (status=`created`), calls Razorpay API `POST /v1/orders`, stores `providerOrderId`. Returns `{ orderId, razorpayOrderId, amount, keyId }`.
7. App opens Razorpay Android SDK. User completes UPI/card payment. SDK returns `{ razorpayPaymentId, signature }`.
8. App calls `POST /api/mobile/v1/payments/razorpay/verify` with `{ orderId, razorpayPaymentId, signature }`. Backend verifies HMAC SHA256 signature with `RAZORPAY_KEY_SECRET`. On invalid: 400 + security event log + payment marked `failed`. On valid: updates `payments.status='captured'`, `orders.status='confirmed'`, creates `shipments` doc (stage=`confirmed`), emits `OrderEventEmitter('order.confirmed')`. Returns `{ order }`.
9. App shows **Order Confirmed** screen with deep link `mishran://order/{orderId}`. Push notification `order.confirmed` fires to device. Order appears in `OrderListScreen` immediately (local cache upsert).

### 8.4 Delivery status update (ops → customer)

1. Ops staff opens `/admin/orders-board`, drags order from **Confirmed** to **Packed**.
2. Admin endpoint `POST /api/admin/orders/{id}/status { newStatus, note? }` validates transition (confirmed→packed OK; skipped→packed blocked). Updates `orders.status`, pushes to `shipments.history[]`, updates `shipments.currentStage`, sets ETA if dispatch stage. Emits `OrderEventEmitter('order.status_changed', { order, stage })`.
3. `OrderEventEmitter` fans out:
   - `PushService.send(customerId, event)` — looks up active tokens in `devices`, sends FCM v1 message (Android) or APNs request (iOS).
   - `SmsService.send` only on key stages: confirmed, out_for_delivery, delivered.
   - `AnalyticsService.track` server-side event.
4. Customer device receives FCM push. Foreground: in-app toast + order list refresh. Background: system notification (tap → deep link to OrderDetail). `OrderStatusWidget` updates via Glance state sync.

### 8.5 Push registration lifecycle

1. App first launch after login. `FirebaseMessaging.getInstance().token` retrieved.
2. App calls `POST /api/mobile/v1/notifications/register-device { platform, pushToken, appVersion, deviceModel, osVersion }`. Backend upserts `devices` doc, marks `active=true`.
3. On token rotation (FCM rotates periodically), WorkManager worker detects change → re-registers.
4. On logout: `POST /notifications/unregister-device { pushToken }`. Backend marks `devices.active=false`.

### 8.6 i18n language switch

1. User picks **தமிழ்** (Tamil) in settings.
2. `LocaleManager.set('ta')`. Persists in DataStore. Server sync `PATCH /account/me { locale: 'ta' }` so emails/notifications respect locale.
3. Compose `LocaleDelegate` updates. All i18n strings re-resolve from bundled `strings_ta.xml`. iOS equivalent: `Bundle.main.localizedString(forKey:value:table:)` against `Localizable.strings`.

### 8.7 Sign in with Apple (iOS, first run)

1. User taps **Sign in with Apple** on `PhoneEntryView`. `ASAuthorizationAppleIDProvider().createRequest()` returns nonce + requested scopes (`fullName`, `email`).
2. `ASAuthorizationController` performs Face ID / Touch ID / passcode challenge. Returns `ASAuthorizationAppleIDCredential` containing `identityToken` (JWT) + `authorizationCode`.
3. App calls `POST /api/mobile/v1/auth/apple { authorizationCode, identityToken, nonce }`. Backend verifies `identityToken` JWT against Apple's public keys (jwks URL `https://appleid.apple.com/auth/keys`). Extracts `sub` as Apple-scoped user ID.
4. Backend upserts `customers` doc with `appleSub` field. If first login: customer record created with `fullName` from scope (no phone yet — prompted post-onboarding). Mints JWT pair (same as OTP flow).
5. App stores tokens in Keychain (biometric-gated). Subsequent launches: Keychain item unlocks via `LocalAuthentication`; refresh token used to mint new access token.
6. **Credential revoked edge case:** User may revoke Apple Sign-in from Settings → Apple ID → Password & Security. On next refresh attempt, backend sees `appleSub` no longer valid (Apple's `/auth/revoke` endpoint check or 401 from refresh attempt with no `appleSub` fallback) → returns `TOKEN_REVOKED` → app forces re-login flow.

### 8.8 Live Activity for delivery tracking (iOS)

1. Order transitions to `confirmed` on backend. `OrderEventEmitter` fires `order.status_changed`.
2. `PushService` (APNs impl) sends a **push payload with `content-state` + `stale-date`** to the device's APNs token. Push type `.liveactivity` (not `.alert`). Payload includes ActivityKit push token (issued by Apple on LiveActivity start).
3. App had already started a LiveActivity when order was placed (`Activity<DeliveryAttributes>.request(...)`). The push updates the activity's `ContentState` without waking the app.
4. Lock-screen + Dynamic Island render current stage with brand-themed visuals (Mishran marigold accent for `dispatched`, saffron for `out_for_delivery`). User taps Live Activity → deep link to `OrderDetailView`.
5. When `order.status=delivered` (or `cancelled`): push sends `dismissal-date` → Live Activity ends.
6. **Edge case: app killed.** ActivityKit persists Live Activities at system level — they continue updating from APNs pushes even with app force-quit. Up to 8 hours of updates per activity (iOS limit); after that, system auto-dismisses.
7. **Edge case: multiple active orders.** Each Live Activity has a unique `Activity.id` (= orderId). Lock-screen stacks them; Dynamic Island shows most recent.

### 8.9 Apple Wallet loyalty pass (iOS)

1. Customer completes 2nd order. `OrderEventEmitter` fires `order.eligible_for_loyalty` (server-side rule).
2. Backend `WalletPassService` generates `.pkpass` using `node-passbook` library. Pass JSON includes: `serialNumber` (=customerId), `loyalty_tier` field (Silver after 2 orders, Gold after 5), `primaryFields` for last order summary.
3. Pass signed with Apple Passbook certificate (loaded from `certs/passbook.p12`, env var `PASSBOOK_CERT_PATH`). Files: `cert.pem`, `wwdr.pem` (Apple WWDR intermediate cert).
4. Pass stored in `MinIO` bucket `mithai-wallet-passes` at key `{customerId}/{serialNumber}.pkpass`. Signed URL (24h TTL) returned.
5. Customer receives push: "You've earned a Silver loyalty pass. Add to Wallet?" Taps → `PKAddPassesViewController.present(pass)` from downloaded URL.
6. Subsequent orders trigger `WalletPassService.updatePass(serialNumber, newFields)` → APNs `.pass` push to registered devices (Apple registers a pass when added; pass token stored backend-side per device).
7. **Edge case: pass revoked.** User may delete pass from Wallet. APNs returns `410 Gone` on next push to that pass token. Backend removes token from `walletPasses.devices[]`. Pass can be re-added via Account screen.

---

## 9. Error Handling

### 9.1 Client error taxonomy

Wrapped in a sealed `ApiResult<T>` (Kotlin) / equivalent (Swift). Errors carry `ErrorCode` enum, `traceId` for correlation with server logs, and `retryable` flag.

| ErrorCode | HTTP | Cause | UI behavior |
|---|---|---|---|
| `RATE_LIMITED` | 429 | OTP/request budget hit | Toast "Too many attempts. Try in X min." |
| `OTP_INVALID` | 400 | Wrong code | Inline error, decrement remaining attempts |
| `OTP_EXPIRED` | 410 | 5-min window passed | "Resend OTP" CTA highlighted |
| `PINCODE_NOT_SERVICEABLE` | 422 | Pincode not in collection | Hard block + suggest alternative |
| `CART_CHANGED` | 409 | Price/stock changed | Diff modal → confirm or back |
| `STOCK_INSUFFICIENT` | 409 | Item qty < requested | Edit qty modal |
| `PAYMENT_FAILED` | 402 | Razorpay verify failed | "Payment failed. Money will be refunded if deducted." + retry |
| `PAYMENT_ABANDONED` | — | User closed Razorpay SDK | Reusable order, restart from cart |
| `ORDER_NOT_FOUND` | 404 | Deep link to deleted order | "This order no longer exists" + back |
| `INVALID_STATE_TRANSITION` | 409 | Ops API misuse | Logged; ops sees toast in admin |
| `TOKEN_EXPIRED` | 401 | Access JWT past 15 min | Silent refresh; if refresh fails → relogin |
| `TOKEN_REVOKED` | 401 | Refresh token on revocation list | Force logout + biometric reset |
| `CONFLICT` | 409 | Idempotency replay with diff body | Surface conflict, keep original response |
| `VALIDATION` | 422 | Field errors | Map to form fields |
| `INTERNAL` | 500 | Unhandled server error | "Something went wrong. Trace: {id}" → support |
| `APPLE_AUTH_FAILED` | 401 | Sign in with Apple token invalid / revoked | Force re-login; clear Keychain biometric |
| `PASSBOOK_SIGN_FAILED` | 500 | `.pkpass` signing error (cert issue) | "Wallet pass temporarily unavailable"; log to Sentry |
| `LIVE_ACTIVITY_UPDATE_FAILED` | — | APNs `.liveactivity` push dropped | No UX impact; logged for monitoring |

### 9.2 Retry policy

| Failure | Strategy |
|---|---|
| Network timeout (10s default) | Exponential backoff: 1s, 2s, 4s — max 3 retries. Skip on non-idempotent POST unless `Idempotency-Key` set. |
| 5xx server error | Same backoff if `retryable: true` (returned by backend). |
| 429 rate limited | Honor `Retry-After` header. Queue non-critical calls. |
| Payment `/verify` failure | NEVER retry automatically — could double-charge. Surface to user, retry only on explicit tap. |
| Token refresh failure | One retry, then route to login. |

### 9.3 Backend error handling

- HTTP layer: all errors serialized as `{ error: { code, message, fieldErrors?, traceId } }`. 5xx never leaks stack/message. `traceId` returned in `X-Request-Id`. Async wrappers catch all promise rejections.
- Data layer: Mongo transactions for multi-doc updates (e.g., order placement touches `orders`, `payments`, `shipments`). On transaction abort → 500 with `traceId`. Unique constraint violations caught as 409 `VALIDATION` with field-level error.

**External API failures:**

| Partner | Failure mode | Handling |
|---|---|---|
| Razorpay create-order | Timeout / 5xx | Mark `payments.status='create_failed'`. Customer sees "Payment init failed." Cleanup job reconciles orphan orders after 10 min. |
| Razorpay webhook | Signature invalid | Log security event, 400 to Razorpay, no state change. |
| MSG91 OTP send | Timeout / non-200 | Return 503 `OTP_PROVIDER_DOWN`. Frontend shows "SMS sending failed, tap to retry." |
| FCM / APNs push | Token invalid | Mark `devices.active=false` on receipt of "NotRegistered" / "Unregistered". |
| Self-hosted Mongo | Connection lost | Health check (`/api/health`) returns degraded. App shows offline banner. PagerDuty alert. |

### 9.4 Idempotency

Every state-mutating endpoint accepts `Idempotency-Key` header (UUID v4). Backend stores request hash + response for 24h in `idempotencyKeys`. Replays:

- Same key + same body → return cached response.
- Same key + diff body → 409 `CONFLICT`, return original response metadata.

Required on: `POST /orders`, `POST /payments/razorpay/create-order`, `POST /payments/razorpay/verify`, `POST /cart/validate`, `POST /auth/otp/send`.

### 9.5 Order state machine

```
                  ┌────────────────────────────────┐
                  ▼                                │
created ──▶ pending_payment ──▶ confirmed ──▶ packed ──▶ dispatched ──▶ out_for_delivery ──▶ delivered
   │              │                  │           │            │                  │
   │              │                  │           │            │                  ├─▶ cancelled
   │              │                  │           │            │                  ├─▶ returned
   │              │                  │           │            │                  └─▶ failed_delivery
   │              ▼                  ▼           ▼            ▼
   │       payment_failed      cancelled   cancelled     cancelled
   │       (auto)              (user)      (user,        (ops, refund flow)
   │                                          if pre-dispatch)
   └──── abandoned (24h TTL cleanup job)
```

Allowed transitions enforced by `OrderService.transition()`. Invalid → `INVALID_STATE_TRANSITION` 409.

Refund flow: `delivered → returned` or `dispatched → failed_delivery` triggers `RefundService.initiate()` via Razorpay refund API. Manual ops approval required if > 24h after delivery.

### 9.6 Payment failure recovery

Two paths converge:

```
A) Client /verify call          B) Razorpay webhook (server-to-server)
   │                                 │
   └─▶ both verifySignature()        └─▶ verifySignature()
            │                                  │
            └─▶ updatePaymentDoc(providerPaymentId, status)
                  └─▶ atomic via Mongo upsert
                  └─▶ first write wins, second is no-op (idempotent on providerPaymentId)
```

Reconciliation cron (every 15 min): query `payments` where `status='created' AND createdAt < now-15min`. Call Razorpay `GET /payments/{id}` to fetch authoritative status. Update local doc. Catches cases where both client verify and webhook failed.

### 9.7 Push delivery guarantees

- **At-least-once.** Customer may receive duplicate push for same event. App dedupes via `event_id` in payload (kept in `notifications_seen` Room table for 30d, TTL-indexed).
- **Ordering not guaranteed.** App always fetches `/orders/{id}` fresh on notification tap rather than trusting payload body for state.
- **Silent failures.** FCM may swallow pushes (low battery, doze). WorkManager periodic job (every 1h while on Wi-Fi) syncs `orders` list — surfaces missed status updates as in-app badge.

### 9.8 Crash and telemetry

| Platform | Tool |
|---|---|
| Android | Firebase Crashlytics (free, deep native stack traces) |
| iOS | Firebase Crashlytics |
| Backend | Sentry (self-hosted) |
| Server logs | Pino JSON → stdout → Vercel log drain → self-hosted Loki |
| Metrics | Prometheus + Grafana (self-hosted). p50 / p95 / p99 latency, error rate per route, Razorpay/MSG91 call counts. |

### 9.9 Security incident handling

| Event | Detection | Response |
|---|---|---|
| OTP brute force | ≥5 failed `otpRequests` per phone in 5 min | Auto-lock OTP for that phone 30 min. Log + Sentry alert. |
| Bearer token reuse from new IP | `customers.lastIp` mismatch on refresh | Soft challenge: re-biometric or re-OTP. |
| Razorpay webhook signature fail | `/webhooks/razorpay` 400 | Log to `securityEvents` collection. Sentry page. |
| Mass refund attempt | ≥3 refund requests in 10 min from one ops user | Require admin approval above threshold. |
| Unusual order pattern | Order rate > 10/min per customer | Rate limit, log for review. |

---

## 10. Testing Strategy

### 10.1 Test pyramid

```
                    ┌──────────────┐
                    │   Manual /   │   ← Exploratory, UAT, store review
                    │  Smoke (5%)  │      pre-release
                    └──────────────┘
                  ┌──────────────────┐
                  │   E2E (10%)      │   ← Maestro (mobile), Playwright (web)
                  │   Critical paths │      flows: login, browse, checkout,
                  └──────────────────┘      payment, order tracking
              ┌──────────────────────────┐
              │  Integration (25%)        │   ← API contract tests, DB round-trip,
              │  Service ↔ Adapter        │      adapter fakes per vendor, Razorpay
              └──────────────────────────┘      webhook signature tests
        ┌──────────────────────────────────┐
        │   Unit (60%)                      │   ← Pure functions, viewmodels,
        │   Pure logic, mappers, validators │      composables, use cases
        └──────────────────────────────────┘
```

### 10.2 Shared packages

| Package | Tooling | Tests |
|---|---|---|
| `api-contract/` | `openapi-cli` + `redocly` spectral ruleset | Schema lint on PR. `oasdiff` against main for breaking-change detection. Block PR if breaking change without `/v2/` route or `x-backward-compatible: true` marker. |
| `brand-tokens/` | Vitest | Token round-trip: `tokens.json` → platform codegen → re-parse → equals input. |
| `i18n-strings/` | Custom script | Per-locale key coverage. Missing-key check across 9 locales blocks PR. Pseudo-translation smoke for layout-stress testing. |
| `analytics-taxonomy/` | Custom | Event schema validation against regex + type rules. |
| `feature-flags/` | Vitest | Flag evaluator truth table. |

### 10.3 Backend

**Framework:** Vitest + Supertest (route tests) + MongoDB Memory Server (in-process replica).

| Layer | What | Coverage gate |
|---|---|---|
| Unit | `lib/commerce/*` services against fake adapters. `JwtService` sign/verify/rotate. `OtpService` rate-limit logic. Validators. Mappers. | ≥85% line, ≥75% branch |
| Integration | Route handlers against real Mongo + fake external services (`nock` for Razorpay/MSG91). Cart validate → order place → payment verify full flow. Webhook signature pass + fail. | ≥70% line on `/api/mobile/v1/*` |
| Contract | Pact or Schemathesis. Each `/api/mobile/v1/*` route tested against OpenAPI spec. | 100% of routes |
| Adapter fakes | Each interface has an in-process fake (e.g., `FakePaymentService`, `FakeOtpService`). Used by integration tests + as scaffold for new vendors. | One fake per adapter interface |
| Idempotency | Replay same request twice with same `Idempotency-Key`. Assert same response, single DB write. | One test per mutating endpoint |
| Migration | Mongo migrations tested forward + backward against fixture DB. | 100% of migrations |
| Security | OWASP ZAP scan in CI weekly. Dependency scan (`pnpm audit`) on every PR. JWT secret rotation test. | Critical CVEs block release |
| Load | k6 scripts: login + browse + checkout 1000 RPS sustained 5 min. p95 < 500 ms. Trigger nightly against staging. | SLO gates per route |
| Razorpay webhook | Replayed real webhook payloads (anonymized). Signature validation must succeed on legit, fail on tampered. | 10 historical payloads per event type |

### 10.4 Android

| Layer | Tool | What |
|---|---|---|
| Unit (JVM) | JUnit5 + MockK + Turbine (Flow) | ViewModels, use cases, mappers, validators. Fakes for repository interfaces. |
| Compose UI | `compose-ui-test` + `hilt-android-testing` | Screen-level: render, assert state transitions, click through flows. Robolectric (fast) + emulator (visual). |
| Screenshot | Paparazzi or Shot | Per-screen, per-locale, per-theme snapshot. Pixel-diff blocks PR if > 2% delta. Re-baseline requires review. |
| Integration | Hilt + Room + real Retrofit against MockWebServer | Repository tests. DB cache invalidation. Offline behavior. |
| E2E | Maestro (recommended) or Espresso | Critical flows: OTP login → browse → add to cart → checkout → payment (mocked Razorpay SDK via test mode) → order placed → push received → order in list. Run on real device farm. |
| Widget | Robolectric + Glance test APIs | Order status widget renders all 5 states. Data source updates propagate. |
| Push | FCM test message via Firebase Admin + listener in instrumentation test | Token registration round-trip. |
| Performance | Macrobenchmark (Jetpack Metrics) + Perfetto | Cold start < 1.5s on mid-tier device (Pixel 4a equivalent). P95 frame drop < 5% scroll. Catalog search p95 < 200 ms local. |
| A11y | `compose-ui-test` accessibility checks + TalkBack on emulator | All tap targets ≥ 48dp. Contrast WCAG AA per theme. Focus order sane. |
| Lint | Android Lint + Detekt + ktlint | Block release on ≥ medium severity. |
| Bundle size | Bundlelint | AAB download size < 25 MB. |

### 10.5 iOS

Same pyramid shape as Android, different tooling.

| Layer | Tool | What |
|---|---|---|
| Unit | XCTest + Combine expectations + Swift Testing (`@Test`) | ViewModels (ObservableObject), use cases, mappers, validators. Fakes for repository interfaces. |
| SwiftUI UI | `XCTestCase` + ViewInspector | Screen-level: render, assert state transitions, navigate via NavigationPath. |
| Snapshot | swift-snapshot-testing | Per-screen, per-locale, per-theme (light/dark), per-size class (compact/regular). Pixel-diff blocks PR if > 2% delta. Re-baseline requires review. |
| Integration | URLSession + MockingURLProtocol against MockWebServer | Repository tests. SwiftData cache invalidation. Offline behavior. |
| E2E | Maestro (cross-platform flows) | Critical flows: OTP login → browse → add to cart → checkout → payment (mocked Razorpay SDK via test mode) → order placed → push received → order in list. Run on real device farm. |
| Live Activity | `ActivityTests` + Xcode Preview | All 5 order states render correctly. Push-driven updates fire on schedule. Dynamic Island compact + minimal + expanded presentations. |
| Wallet | XCTest + passkit stubs | `.pkpass` parsing, signing verification, update flow. Add-passes-to-Wallet presentation requires physical device (skip on simulator). |
| Push | APNs test push via `apns2` CLI + XCTest listener | Token registration round-trip. Silent push for Live Activity state updates. |
| Performance | XCTest `measure {}` + Xcode Organizer | Cold start < 1.5s on iPhone SE (3rd gen). P95 frame drop < 5% scroll. Catalog search p95 < 200 ms local. |
| A11y | XCTest Accessibility audit + VoiceOver on simulator | All tap targets ≥ 44pt. Contrast WCAG AA per theme. Focus order sane. Dynamic Type at all size categories. VoiceOver labels on all icons. |
| Lint | SwiftLint + SwiftFormat | Block release on ≥ medium severity. |
| Bundle size | App Thinning Size Report | IPA download size < 30 MB (Wallet cert adds ~1 MB). |

### 10.5.1 Backend coverage for iOS features

| Feature | Backend test | Gate |
|---|---|---|
| `POST /auth/apple` | Identity token JWT verification against Apple JWKS. Replay attack (same nonce twice) → 409. | Unit + integration |
| Apple JWKS rotation | Apple rotates keys ~quarterly. `AppleJwksService` fetches + caches. Stale key returns 401. | Integration |
| `.pkpass` generation | Valid pass signs with Passbook cert + WWDR. Verifies with Apple's verification tool. | Unit |
| `.pkpass` update + APNs `.pass` push | Pass token registered on add. Update fires push. Revoked pass → 410 cleanup. | Integration with APNs stub |
| Live Activity push (`.liveactivity` type) | ActivityKit push token registered. Status change → push with `content-state`. Dismissal push ends activity. | Integration with APNs stub |

### 10.6 Cross-platform parity tests

Each critical user flow has a **shared Gherkin spec** in `packages/e2e-flows/`. Android Maestro, iOS Maestro (later), and backend Playwright each consume the same flow file with platform-specific step implementations. Ensures feature parity.

Example (`packages/e2e-flows/login_checkout.feature`):

```gherkin
Feature: Phone OTP login → place order
  Scenario: New user, fresh mithai to Delhi NCR
    Given the catalog has Kaju Katli in stock
    And pincode 110001 is tier=fresh
    When I start the app with no session
    And I log in with phone 9999999999 and OTP 123456
    And I add 500g Kaju Katli to cart
    And I checkout to address at 110001
    And I pay via UPI mock
    Then I see the order confirmation screen
    And the order appears in my order list
    And I receive a push notification "Order confirmed"
```

### 10.7 Pre-release gate

Before each store release (monthly cadence):

| Check | Gate |
|---|---|
| All unit + integration green | Required |
| E2E on staging backend green | Required |
| 95th percentile cold start ≤ 1.5s on Pixel 4a | Required |
| No new Sentries in canary build for 24h | Required |
| Lighthouse / macrobenchmark scores not regressed > 5% | Required |
| Screenshot diffs reviewed | Required |
| Localization coverage at 100% keys for shipped locales | Required |
| Privacy policy + permissions manifest reviewed | Required |
| Store listing metadata localized for shipped locales | Required |
| Razorpay test mode end-to-end checkout passes | Required |
| Internal QA bug bash (1 day) signed off | Required |

### 10.8 Production monitoring + canary

- **Canary channel (Android):** Play Staged Rollout → 5% → watch Sentry + crash-free rate ≥ 99.5% + payment success rate ≥ 97% for 48h → ramp to 20% → 50% → 100%. Auto-halt on regression.
- **iOS (later):** Phased Release over 7 days via App Store Connect.
- **Backend:** Vercel deployments + canary flag via feature flags per route. Auto-rollback on `/api/health` degraded for 60s.

### 10.9 Test data + secrets

- Staging backend at `staging-api.mishran.app` — separate Mongo DB, separate Razorpay test-mode keys, separate MSG91 test sender ID.
- Device farm: BrowserStack or Firebase Test Lab. ~30 devices covering Android 10–15, low/mid/high tier.
- E2E accounts: hard-coded test phone numbers on staging bypass MSG91 → auto-approve OTP `123456` for test numbers only (server env-gated).
- Seed data: `scripts/seed-staging.ts` populates catalog, addresses, sample orders. Reset nightly.

### 10.10 Coverage reporting

- Backend: `c8` coverage → Codecov.
- Android: Kover report → Codecov.
- Coverage trends visible in PR check. Coverage drops > 2% block merge unless explicitly justified.

---

## 11. Constraints and Locked Decisions

| Decision | Locked value |
|---|---|
| Mobile timeline | Before Shopify migration. Custom commerce backend. |
| Mobile stack | Native Android (Kotlin + Compose) + native iOS (Swift + SwiftUI). Android leads ship by ~2 months; iOS follows on shared backend. |
| iOS minimum | iOS 17+. Required for ActivityKit, SwiftData, modern SwiftUI. ~85% of Indian iPhone users on iOS 17+ at spec date. |
| Backend shape | Extend existing Next.js + Payload + MongoDB. `/api/mobile/v1/*` REST + RS256 JWT. |
| Delivery tracking | v1 = status-only + iOS Live Activity + Dynamic Island. v2 = courier API. v3 = live map. |
| Auth | Phone OTP (MSG91) + biometric + Sign in with Apple (iOS, App Store rule 4.8). JWT (RS256, 15-min access, 30-day rotated refresh). |
| Languages | 9: en, hi, kn, ta, te, mr, gu, bn, pa. |
| Delivery geography | Two-tier: Delhi NCR = fresh mithai; top 8–10 metros = shelf-stable (dryfruit, namkeen, merch, gift boxes). |
| Payments | Razorpay. UPI + cards + netbanking + wallets. No COD, no EMI in v1. |
| Wallet loyalty pass | Apple Wallet `.pkpass` in v1 (Silver after 2 orders, Gold after 5). Generated server-side via `node-passbook`. |
| Live Activity | iOS lock-screen + Dynamic Island delivery tracker. ActivityKit + `.liveactivity` push type. |
| Mongo | Self-hosted single-node replica set (Docker). Cloud migration via connection-string swap. |
| Adapter layer | Every external service behind an interface. Vendor swap = env var + impl change. |

---

## 12. Roadmap (v1 → v2 → v3)

### v1 — Android ship + iOS ship (~5 months total)

**Months 0-3 (Android leads):**
- Backend extensions: OTP auth, catalog/orders/payments/shipments collections, REST routes under `/api/mobile/v1/*`.
- Adapter layer with current-impl classes for every external service.
- Android app: phone OTP + biometric, browse + search + filter, cart + checkout + Razorpay, order history, status-only delivery tracking, Android home-screen widget, push notifications, 9 locales.
- Ops surfaces in Payload admin: orders board, pincode manager, customer detail, OTP logs, payment reconciliation.
- Self-hosted infra: Mongo replica set, Sentry, Loki, Grafana, MinIO.
- Google Play staged rollout (5% → 100% over 2 weeks) starting end of month 3.

**Months 3-5 (iOS follows on shared backend):**
- iOS app: phone OTP + biometric + Sign in with Apple, browse + search + filter, cart + checkout + Razorpay, order history, status-only delivery tracking + Live Activity + Dynamic Island, push notifications (APNs), Apple Wallet loyalty pass, 9 locales.
- Backend extensions: `/auth/apple` endpoint, `WalletPassService` (node-passbook), ActivityKit push payload support in `PushService`, `.pkpass` storage in MinIO.
- App Store Connect submission (review lead time ~1-2 weeks; TestFlight beta during month 4).
- Phased App Store release (7 days) starting end of month 5.

### v2 — Courier API + iPad + reorder (~3–6 months after v1)

- Backend: `CourierApiDeliveryService` adapter impl (Delhivery or Shadowfax TBD).
- Reorder one-tap from history.
- Wishlist / favorites.
- Ratings and reviews on PDP.
- Refund flow self-serve.
- GST invoice download in-app.
- iPad-optimized layout for iOS (Universal app).
- Apple Pay (if pulled in from evaluation).
- Apple Watch glance for delivery status.

### v3 — Live map + COD + EMI (~6–9 months after v1)

- `LiveMapDeliveryService` adapter impl. Driver-side component or partner with driver-tracking API (Shadowfax On-Demand, Dunzo).
- WebSocket / SSE for live location.
- COD (after ops capacity for cash handling).
- EMI + pay-later.
- AR gift preview (non-goal unless explicitly pulled in).
- Multi-warehouse inventory (per-city allocation logic).

---

## 13. Open Questions (to resolve before plan)

These do not block spec approval but should be answered before the implementation plan:

1. **Ops team capacity** — who updates order status during v1 (before courier API)? Same team as web ops? Dedicated mobile ops?
2. **Delhi NCR warehouse address** — concrete address for pickup/delivery SLA calculations.
3. **Serviceable pincode seed list** — concrete Delhi NCR + top-8-metro pincode list for initial `serviceablePincodes` collection.
4. **Razorpay account** — existing or new? KYC status. Test-mode keys access.
5. **MSG91 account** — existing or new? Sender ID approval timeline.
6. **Domain** — `mishran.app` or different? Backend at `api.mishran.app`, staging at `staging-api.mishran.app`.
7. **Google Play developer account** — existing or new? DUNS / organization verification status.
8. **Apple Developer Program enrollment** — **required for v1 iOS ship; enroll immediately (weeks to activate).** Organization team ID needed for: App Store Connect, signing certificates, Passbook cert, App ID with Sign in with Apple + Push Notifications + Live Activity capabilities.
9. **Apple Passbook certificate** — separate cert from Apple Developer portal (`Certificates, Identifiers & Profiles → Pass Type IDs`). ~1 day turnaround after enrollment. Needed for `.pkpass` signing.
10. **Translation vendor** — for non-en/hi/kn locales (ta, te, mr, gu, bn, pa). In-house? Agency? Community?
11. **SMS template approvals** — TRAI/MLN registration for transactional SMS via MSG91. Lead time ~1 week per template.
12. **Apple Sign-in server keys** — generate `AuthKey_XXXXXXXXXX.p8` (Sign in with Apple Key) via Apple Developer portal. Configure `Services ID` + `Return URLs` for backend callback.
13. **APNs auth** — `.p8` key-based auth (recommended) or `.p12` legacy cert. Key-based recommended: one key works for both dev + prod, no annual cert renewal.

---

## 14. Success Metrics

| Metric | v1 target | v2 target | v3 target |
|---|---|---|---|
| Android crash-free sessions | ≥ 99.5% | ≥ 99.5% | ≥ 99.5% |
| iOS crash-free sessions | ≥ 99.5% | ≥ 99.5% | ≥ 99.5% |
| Payment success rate (Razorpay verified) | ≥ 97% | ≥ 98% | ≥ 98% |
| Cold start (p95, Pixel 4a) | ≤ 1.5s | ≤ 1.2s | ≤ 1.0s |
| Cold start (p95, iPhone SE 3) | ≤ 1.5s | ≤ 1.2s | ≤ 1.0s |
| Catalog search p95 (local) | ≤ 200ms | ≤ 150ms | ≤ 100ms |
| Order placement success rate (from cart) | ≥ 95% | ≥ 97% | ≥ 98% |
| MAU (Android) | 10k @ 6mo | 50k @ 12mo | 100k @ 18mo |
| MAU (iOS) | 5k @ 6mo | 25k @ 12mo | 50k @ 18mo |
| Live Activity opt-in (iOS) | ≥ 50% | ≥ 60% | ≥ 65% |
| Wallet pass add-rate (eligible iOS users) | ≥ 35% | ≥ 45% | ≥ 55% |
| Sign in with Apple share (iOS logins) | ≥ 30% | ≥ 35% | ≥ 40% |
| Repeat purchase rate (30d) | ≥ 25% | ≥ 35% | ≥ 45% |
| Average order value | ₹1,500 | ₹1,800 | ₹2,000 |
| Push notification opt-in | ≥ 60% | ≥ 65% | ≥ 70% |
| 4+ star Play Store rating | ≥ 4.3 | ≥ 4.5 | ≥ 4.6 |
| 4+ star App Store rating | ≥ 4.4 | ≥ 4.6 | ≥ 4.7 |

---

## 15. Glossary

| Term | Definition |
|---|---|
| **Adapter** | Interface that abstracts an external dependency. Concrete implementations are pluggable via DI. |
| **Karigar** | Traditional mithai craftsman. One of Mishran's four brand pillars. |
| **Karigari** | The craft technique — tradition-driven process. |
| **Pincode tier** | `fresh` (perishable mithai, Delhi NCR only) or `shelf` (shelf-stable, top metros). |
| **Serviceable pincode** | A pincode Mishran delivers to, with tier + SLA metadata. |
| **Snapshot (cart)** | Server-side immutable copy of cart state at validation time, used as basis for order. |
| **Live Activity** | iOS 16.1+ lock-screen widget showing real-time app state. Used for delivery tracking in v1; Mishran adopts iOS 17+ floor. |
| **Dynamic Island** | iPhone 14 Pro+ notch-replacement UI. Live Activities present in compact / minimal / expanded modes. |
| **ActivityKit** | iOS framework for Live Activities + Dynamic Island. Push-driven updates via APNs `.liveactivity` push type. |
| **`.pkpass`** | Apple Wallet pass file format. ZIP archive with `pass.json` + manifest + signature. |
| **Passbook cert** | Apple-issued certificate for signing `.pkpass` files. Separate from app signing certs. |
| **Sign in with Apple** | Apple's OAuth-like identity provider. Required by App Store Review Guideline 4.8 when app offers any third-party login. |
| **APNs** | Apple Push Notification service. Direct via `apn` library or via FCM as a broker. Mishran uses direct APNs with `.p8` key auth. |
| **Stage / Stage Rollout** | Google Play's phased release mechanism (5% → 20% → 50% → 100%). |
| **Phased Release** | App Store Connect's 7-day staged rollout for iOS updates. |
| **OTP** | One-time password (6-digit SMS). |
| **MOQ** | Minimum order quantity. Used for wedding / corporate. |
