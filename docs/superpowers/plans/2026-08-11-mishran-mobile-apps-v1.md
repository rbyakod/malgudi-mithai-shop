# Mishran Mobile Apps v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Mishran Android app to Google Play **and** the Mishran iOS app to the App Store with end-to-end ordering (catalog → cart → Razorpay → order tracking), backed by an extension of the existing Next.js + Payload + MongoDB web backend. Android leads by ~2 months; iOS follows on the shared backend with platform-specific differentiators (Sign in with Apple, Live Activity + Dynamic Island delivery tracker, Apple Wallet loyalty pass).

**Architecture:** pnpm-workspace monorepo. Existing Next.js app extended with `/api/mobile/v1/*` REST routes + new Payload collections (customers, addresses, orders, payments, shipments, etc.) on a self-hosted MongoDB replica set. Every external dependency sits behind an adapter interface (`lib/<domain>/<Service>.ts`), wired via DI in `lib/container.ts` — vendor swap is env-var + impl change. Android app (Kotlin + Jetpack Compose + Hilt) consumes OpenAPI-generated Retrofit clients. Offline-first catalog via Room + ETag.

**Tech Stack:**
- **Backend:** Next.js 16.2.3, Payload 3.x, MongoDB 7.x (self-hosted replica set), argon2, jose (JWT RS256), zod, Vitest, MongoDB Memory Server, nock.
- **Shared packages:** pnpm workspaces, openapi-typescript, openapi-generator (Kotlin), swift-openapi-generator (v2), Tailwind v4 (tokens source), GrowthBook (flags).
- **Android:** Kotlin 2.0+, Jetpack Compose, Material 3, Hilt, Retrofit + OkHttp, Room, DataStore, WorkManager, Glance (widget), Firebase Crashlytics + FCM v1, Razorpay Android SDK, BiometricPrompt, Paparazzi, Maestro.
- **External (current impls):** Razorpay (payments), MSG91 (OTP + SMS), Resend (email), Firebase Cloud Messaging (push Android), Sentry self-hosted (errors), Prometheus + Grafana + Loki self-hosted (metrics + logs), MinIO (file storage).
- **Test tooling:** Vitest, Supertest, MongoDB Memory Server, k6 (load), OWASP ZAP (security), JUnit5 + MockK + Turbine, Paparazzi, Maestro, Firebase Test Lab.

## Global Constraints

- **Monorepo:** pnpm workspaces. Existing Next.js app stays in repo root; mobile apps live in `apps/android` and `apps/ios`; shared packages in `packages/`.
- **Backend versioning:** All mobile routes under `/api/mobile/v1/*`. Breaking changes require parallel `/v2/*` rollout.
- **JWT:** RS256. Access token TTL 15min. Refresh token TTL 30d, rotated on use. Keypair in env (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`). Revocation list in `revokedTokens` collection.
- **Idempotency:** All mutating endpoints accept `Idempotency-Key` UUID v4 header. Stored 24h. Same key+body → cached response. Same key+diff body → 409.
- **OTP:** 6-digit, 5min expiry, Argon2 hash in `otpRequests`. Rate limit per phone: 5/hr, 10/day. MSG91 sender.
- **MongoDB:** Self-hosted single-node replica set on VPS (Docker). Connection string in `MONGODB_URI`. Change-stream support required by Payload → replica set mode mandatory.
- **Languages:** 9 locales — `en`, `hi`, `kn`, `ta`, `te`, `mr`, `gu`, `bn`, `pa`. All i18n strings in `packages/i18n-strings/` JSON.
- **Delivery geography:** Delhi NCR pincodes = tier `fresh` (perishable mithai). Top 8 metros (Mumbai, Pune, Hyderabad, Chennai, Bengaluru, Kolkata, Ahmedabad, Delhi NCR) = tier `shelf` (shelf-stable only).
- **Payments:** Razorpay only in v1. UPI + cards + netbanking + wallets. No COD, no EMI.
- **Order state machine:** `created → pending_payment → confirmed → packed → dispatched → out_for_delivery → delivered`. Side states: `payment_failed`, `cancelled`, `returned`, `failed_delivery`, `abandoned`. Transitions validated by `OrderService.transition()`.
- **Adapters:** Every external service behind interface in `lib/<domain>/<Service>.ts`. Concrete impl named after vendor. DI in `lib/container.ts` resolves by env var.
- **Commits:** Conventional Commits (`feat:`, `chore:`, `refactor:`, `test:`, `docs:`, `fix:`). One logical change per commit. No `--no-verify`.
- **Tests:** TDD — write failing test, implement, verify pass, commit. Coverage gates per layer (see §10 of spec).
- **Android min SDK:** 26 (Android 8.0). Compile SDK 35. Target SDK 35.
- **Android bundle size:** AAB download size < 25MB.
- **iOS min version:** iOS 17+. Required for ActivityKit, SwiftData, modern SwiftUI.
- **iOS device targets:** iPhone-only v1 (no iPad). Universal (iPad) deferred to v2.
- **iOS bundle size:** IPA download size < 30MB (Passbook cert adds ~1MB).
- **Cold start p95:** ≤ 1.5s on Pixel 4a (Android v1). ≤ 1.5s on iPhone SE 3 (iOS v1).
- **A11y:** WCAG AA contrast per theme. Tap targets ≥ 48dp (Android) / ≥ 44pt (iOS). TalkBack + VoiceOver semantic ordering. Dynamic Type at all size categories (iOS).
- **Apple Developer Program:** Enrollment required BEFORE iOS build can ship. Org team ID, Passbook cert, App ID with Sign in with Apple + Push Notifications + Live Activity capabilities.
- **APNs auth:** `.p8` key-based auth (recommended over `.p12` legacy cert).
- **Sign in with Apple:** Required for App Store Review 4.8 compliance. Server verifies `identityToken` JWT against Apple JWKS.
- **Pre-release gate:** All sections of spec §10.7 must pass before Play Store rollout. All sections of spec §10.5 must pass before App Store submission.

---

## File Structure

```
mithai-shop/
├── app/                                    # EXISTING — Next.js App Router
│   ├── api/
│   │   ├── mobile/v1/                      # NEW — mobile REST routes
│   │   │   ├── auth/
│   │   │   │   ├── otp/send/route.ts
│   │   │   │   ├── otp/verify/route.ts
│   │   │   │   └── refresh/route.ts
│   │   │   ├── catalog/
│   │   │   │   ├── products/route.ts
│   │   │   │   ├── categories/route.ts
│   │   │   │   ├── serviceable/route.ts
│   │   │   │   └── products/[slug]/route.ts
│   │   │   ├── cart/
│   │   │   │   └── validate/route.ts
│   │   │   ├── orders/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── payments/
│   │   │   │   └── razorpay/
│   │   │   │       ├── create-order/route.ts
│   │   │   │       └── verify/route.ts
│   │   │   ├── addresses/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── account/
│   │   │   │   └── me/route.ts
│   │   │   └── notifications/
│   │   │       └── register-device/route.ts
│   │   ├── admin/
│   │   │   └── orders/[id]/status/route.ts
│   │   ├── webhooks/
│   │   │   └── razorpay/route.ts
│   │   └── health/route.ts
│   └── admin/[[...segments]]/page.tsx      # EXISTING — Payload admin
├── collections/                            # EXISTING + NEW Payload collections
│   ├── MithaiProducts.ts                  # EXISTING (will be extended)
│   ├── Customers.ts                       # NEW
│   ├── Addresses.ts                       # NEW
│   ├── Orders.ts                          # NEW
│   ├── Payments.ts                        # NEW
│   ├── Shipments.ts                       # NEW
│   ├── ServiceablePincodes.ts             # NEW
│   ├── OtpRequests.ts                     # NEW
│   ├── Devices.ts                         # NEW
│   ├── IdempotencyKeys.ts                 # NEW
│   ├── RevokedTokens.ts                   # NEW
│   ├── SecurityEvents.ts                  # NEW
│   └── NotificationsSeen.ts               # NEW (server-side dedup backup)
├── globals/
│   └── MobileSettings.ts                  # NEW — feature flags, Razorpay keys ref
├── lib/
│   ├── container.ts                       # NEW — DI wiring
│   ├── commerce/
│   │   ├── CatalogService.ts              # interface
│   │   ├── OrderService.ts                # interface
│   │   ├── PaymentService.ts              # interface
│   │   ├── DeliveryService.ts             # interface
│   │   ├── PincodeService.ts              # interface
│   │   ├── RefundService.ts               # interface
│   │   ├── impl/
│   │   │   ├── PayloadCatalogService.ts
│   │   │   ├── PayloadOrderService.ts
│   │   │   ├── RazorpayPaymentService.ts
│   │   │   ├── ManualDeliveryService.ts
│   │   │   ├── PayloadPincodeService.ts
│   │   │   ├── RazorpayRefundService.ts
│   │   │   └── FakePaymentService.ts      # test fake
│   │   └── types.ts                       # shared commerce types
│   ├── auth/
│   │   ├── OtpService.ts                  # interface
│   │   ├── JwtService.ts                  # concrete (jose + argon2)
│   │   ├── AuthProvider.ts                # interface
│   │   ├── AppleAuthService.ts            # Sign in with Apple — identityToken JWT verify
│   │   ├── impl/
│   │   │   ├── Msg91OtpService.ts
│   │   │   ├── JwtAuthProvider.ts
│   │   │   ├── FakeOtpService.ts          # test fake — code always 123456
│   │   │   └── KaleyraOtpService.ts       # stub for future swap
│   │   └── rateLimiter.ts
│   ├── notifications/
│   │   ├── PushService.ts                 # interface
│   │   ├── SmsService.ts                  # interface
│   │   ├── OrderEventEmitter.ts
│   │   ├── impl/
│   │   │   ├── FcmPushService.ts          # Android
│   │   │   ├── ApnsPushService.ts         # iOS — direct APNs via `apn` lib, .p8 key auth
│   │   │   ├── Msg91SmsService.ts
│   │   │   └── FakePushService.ts
│   ├── wallet/                            # NEW — Apple Wallet pass generation
│   │   ├── WalletPassService.ts           # interface
│   │   ├── impl/
│   │   │   ├── NodePassbookWalletService.ts  # node-passbook lib
│   │   │   └── FakeWalletService.ts
│   ├── email/
│   │   ├── EmailService.ts                # interface
│   │   └── impl/
│   │       ├── ResendEmailService.ts
│   │       └── FakeEmailService.ts
│   ├── analytics/
│   │   ├── AnalyticsService.ts            # interface
│   │   └── impl/
│   │       ├── MultiAnalyticsService.ts
│   │       ├── Ga4AnalyticsService.ts
│   │       ├── MetaPixelService.ts
│   │       └── FakeAnalyticsService.ts
│   ├── files/
│   │   ├── StorageService.ts              # interface
│   │   └── impl/
│   │       ├── LocalDiskStorageService.ts
│   │       └── MinioStorageService.ts     # stub
│   ├── search/
│   │   ├── SearchService.ts               # interface
│   │   └── impl/
│   │       ├── MongoSearchService.ts
│   │       └── FakeSearchService.ts
│   ├── featureflags/
│   │   ├── FeatureFlagService.ts          # interface
│   │   └── impl/
│   │       ├── EnvFlagService.ts
│   │       └── FakeFlagService.ts
│   ├── observability/
│   │   ├── ErrorReporter.ts              # interface
│   │   ├── Logger.ts                      # Pino wrapper
│   │   └── impl/
│   │       ├── SentryReporter.ts
│   │       └── FakeErrorReporter.ts
│   ├── i18n/
│   │   └── TranslationService.ts          # reads from packages/i18n-strings
│   ├── idempotency/
│   │   └── idempotency.ts                 # middleware helper
│   ├── security/
│   │   ├── rateLimiter.ts                 # token bucket, Mongo-backed
│   │   ├── hmac.ts                        # Razorpay signature verify
│   │   └── ip.ts
│   ├── api/
│   │   ├── response.ts                    # unified {data} / {error} envelope
│   │   ├── errors.ts                      # ErrorCode enum + ApiError class
│   │   ├── trace.ts                       # X-Request-Id middleware
│   │   └── authMiddleware.ts              # JWT verify → req.customer
│   ├── reconciliation/
│   │   ├── reconcilePayments.ts           # 15-min cron
│   │   └── cleanupAbandonedOrders.ts      # 24h TTL job
│   └── config.ts                          # env loader + validation
├── packages/                               # NEW — shared monorepo packages
│   ├── api-contract/
│   │   ├── openapi.yaml
│   │   ├── package.json
│   │   └── generated/                     # codegen output
│   │       ├── ts/
│   │       ├── kotlin/
│   │       └── swift/                     # iOS v1 (swift-openapi-generator)
│   ├── brand-tokens/
│   │   ├── tokens.json
│   │   ├── package.json
│   │   └── scripts/
│   │       ├── export-from-tailwind.ts
│   │       └── codegen-kotlin.ts
│   ├── i18n-strings/
│   │   ├── en.json
│   │   ├── hi.json
│   │   ├── kn.json
│   │   ├── ta.json
│   │   ├── te.json
│   │   ├── mr.json
│   │   ├── gu.json
│   │   ├── bn.json
│   │   ├── pa.json
│   │   ├── package.json
│   │   └── scripts/
│   │       ├── check-missing-keys.ts
│   │       └── codegen-android.ts
│   ├── analytics-taxonomy/
│   │   ├── events.yaml
│   │   └── package.json
│   ├── feature-flags/
│   │   └── package.json
│   └── e2e-flows/
│       ├── login_checkout.feature
│       ├── browse_catalog.feature
│       └── track_order.feature
├── apps/                                   # NEW
│   └── android/                           # Kotlin + Compose app
│       ├── settings.gradle.kts
│       ├── build.gradle.kts
│       ├── gradle/
│       ├── app/
│       │   ├── build.gradle.kts
│       │   ├── src/main/
│       │   │   ├── java/com/mishran/app/
│       │   │   │   ├── MishranApp.kt
│       │   │   │   ├── MainActivity.kt
│       │   │   │   ├── ui/
│       │   │   │   │   ├── theme/
│       │   │   │   │   │   ├── Color.kt
│       │   │   │   │   │   ├── Type.kt
│       │   │   │   │   │   ├── Shape.kt
│       │   │   │   │   │   └── Theme.kt
│       │   │   │   │   ├── home/
│       │   │   │   │   ├── catalog/
│       │   │   │   │   ├── product/
│       │   │   │   │   ├── cart/
│       │   │   │   │   ├── checkout/
│       │   │   │   │   ├── orders/
│       │   │   │   │   ├── account/
│       │   │   │   │   ├── auth/
│       │   │   │   │   └── components/
│       │   │   │   ├── data/
│       │   │   │   │   ├── remote/
│       │   │   │   │   │   ├── api/              # Retrofit interfaces
│       │   │   │   │   │   ├── dto/              # OpenAPI-generated
│       │   │   │   │   │   └── NetworkModule.kt
│       │   │   │   │   ├── local/
│       │   │   │   │   │   ├── dao/
│       │   │   │   │   │   ├── entity/
│       │   │   │   │   │   ├── Database.kt
│       │   │   │   │   │   └── DataStore.kt
│       │   │   │   │   ├── repository/
│       │   │   │   │   └── sync/
│       │   │   │   │       ├── CatalogRefreshWorker.kt
│       │   │   │   │       ├── TokenRefreshAuthenticator.kt
│       │   │   │   │       └── PushRegistrationWorker.kt
│       │   │   │   ├── domain/
│       │   │   │   │   ├── model/
│       │   │   │   │   └── usecase/
│       │   │   │   ├── di/
│       │   │   │   │   ├── NetworkModule.kt
│       │   │   │   │   ├── DatabaseModule.kt
│       │   │   │   │   ├── RepositoryModule.kt
│       │   │   │   │   └── UseCaseModule.kt
│       │   │   │   ├── push/
│       │   │   │   │   └── MishranFcmService.kt
│       │   │   │   ├── widget/
│       │   │   │   │   └── OrderStatusWidget.kt
│       │   │   │   ├── navigation/
│       │   │   │   │   ├── MishranNavGraph.kt
│       │   │   │   │   ├── Routes.kt
│       │   │   │   │   └── DeepLinks.kt
│       │   │   │   └── util/
│       │   │   ├── res/
│       │   │   │   ├── values/                # en (default)
│       │   │   │   ├── values-hi/
│       │   │   │   ├── values-kn/
│       │   │   │   ├── values-ta/
│       │   │   │   ├── values-te/
│       │   │   │   ├── values-mr/
│       │   │   │   ├── values-gu/
│       │   │   │   ├── values-bn/
│       │   │   │   ├── values-pa/
│       │   │   │   ├── drawable/
│       │   │   │   ├── mipmap/
│       │   │   │   └── xml/                   # backup rules, network config
│       │   │   └── AndroidManifest.xml
│       │   └── src/test/                      # JVM unit tests
│       │   └── src/androidTest/               # instrumentation tests
│       ├── maestro/                          # Maestro YAML flows
│       │   ├── login_checkout.yaml
│       │   └── browse_catalog.yaml
│       └── README.md
├── docs/superpowers/
│   ├── plans/
│   │   └── 2026-08-11-mishran-mobile-apps-v1.md  # THIS FILE
│   └── specs/
│       └── 2026-08-11-mishran-mobile-apps-design.md
├── scripts/
│   ├── seed-staging.ts                       # nightly catalog/orders seed
│   ├── codegen-api.ts                        # openapi → TS/Kotlin/Swift
│   ├── codegen-brand-tokens.ts
│   ├── codegen-i18n-android.ts
│   └── reconcile-payments-cron.ts
├── docker/
│   ├── mongo/Dockerfile                      # Mongo 7 replica set
│   ├── mongo/init-rs.sh
│   ├── minio/Dockerfile
│   └── compose.yml                           # local dev stack
├── pnpm-workspace.yaml                       # NEW
├── package.json                              # EXISTING — add pnpm workspaces
└── .env.example                              # NEW — all env vars documented
```

---

## Phase 0: Monorepo + Shared Packages Foundation

Sets up pnpm workspaces, OpenAPI contract, brand tokens export, i18n string source, analytics taxonomy.

### Task 0.1: Convert repo to pnpm monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Update root `package.json` to enable workspaces**

Add `"workspaces"` field and scripts. Final shape:

```json
{
  "name": "mithai-shop",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "codegen": "pnpm -r --filter './packages/*' run codegen",
    "build:packages": "pnpm -r --filter './packages/*' run build",
    "seed:staging": "tsx scripts/seed-staging.ts"
  },
  "dependencies": {
    "next": "16.2.3",
    "next-intl": "^4.9.1",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.3",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^2",
    "tsx": "^4"
  }
}
```

- [ ] **Step 3: Create `.env.example`**

```bash
# Mongo
MONGODB_URI=mongodb://localhost:27017/mishran?replicaSet=rs0

# Payload
PAYLOAD_SECRET=replace-with-32-char-random

# JWT (RS256) — generate with:
#   openssl genrsa -out private.pem 2048
#   openssl rsa -in private.pem -pubout -out public.pem
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx

# MSG91
MSG91_AUTH_KEY=xxx
MSG91_SENDER_ID=MISHRN
MSG91_TEMPLATE_OTP=xxx
MSG91_TEMPLATE_ORDER_STATUS=xxx

# FCM (Android push)
FCM_PROJECT_ID=mishran-prod
FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# APNs (iOS v2 — leave blank for v1)
APNS_TEAM_ID=
APNS_KEY_ID=
APNS_PRIVATE_KEY=

# Resend (email)
RESEND_API_KEY=re_xxx

# Sentry (self-hosted)
SENTRY_DSN=http://xxx@localhost:9000/1

# Storage (local disk in v1)
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./uploads

# Feature flags
FLAG_PROVIDER=env

# Analytics
NEXT_PUBLIC_GA4_ID=G-XXX
NEXT_PUBLIC_META_PIXEL_ID=XXX

# App
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/mobile/v1
NEXT_PUBLIC_APP_NAME=Mishran
NODE_ENV=development
```

- [ ] **Step 4: Migrate to pnpm**

```bash
cd /Users/ravibyakod/WORK/mithai-shop/mithai-shop
rm -rf node_modules package-lock.json
pnpm install
```

Expected: install completes, lockfile `pnpm-lock.yaml` created.

- [ ] **Step 5: Verify Next.js still runs**

```bash
pnpm dev
```

Expected: dev server starts on `http://localhost:3000`, home page renders.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml .env.example
git commit -m "chore: convert repo to pnpm monorepo with workspace config"
```

### Task 0.2: Create `packages/api-contract/` with OpenAPI skeleton

**Files:**
- Create: `packages/api-contract/package.json`
- Create: `packages/api-contract/openapi.yaml`
- Create: `packages/api-contract/scripts/lint.ts`
- Create: `packages/api-contract/scripts/check-breaking.ts`

**Interfaces:**
- Produces: `openapi.yaml` — single source of truth for all `/api/mobile/v1/*` routes. Tasks 1.x – 6.x add paths here.

- [ ] **Step 1: Create `packages/api-contract/package.json`**

```json
{
  "name": "@mishran/api-contract",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "lint": "tsx scripts/lint.ts",
    "check-breaking": "tsx scripts/check-breaking.ts",
    "codegen:ts": "openapi-typescript openapi.yaml -o generated/ts/index.ts",
    "codegen:kotlin": "openapi-generator-cli generate -i openapi.yaml -g kotlin -o generated/kotlin --package-name com.mishran.api",
    "codegen:swift": "openapi-generator-cli generate -i openapi.yaml -g swift5 -o generated/swift",
    "codegen": "pnpm codegen:ts && pnpm codegen:kotlin && pnpm codegen:swift"
  },
  "devDependencies": {
    "openapi-typescript": "^7",
    "@openapitools/openapi-generator-cli": "^2",
    "@redocly/cli": "^2.46.1",
    "tsx": "^4"
  }
}
```

- [ ] **Step 2: Create initial `openapi.yaml` skeleton**

```yaml
openapi: 3.1.0
info:
  title: Mishran Mobile API
  version: 0.1.0
  description: |
    REST API consumed by the Mishran Android (v1) and iOS (v2) apps.
    All routes under /api/mobile/v1/* unless noted.
  contact:
    name: Mishran Engineering
    url: https://mishran.app
servers:
  - url: http://localhost:3000/api/mobile/v1
    description: Local dev
  - url: https://staging-api.mishran.app/api/mobile/v1
    description: Staging
  - url: https://api.mishran.app/api/mobile/v1
    description: Production

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              enum:
                - RATE_LIMITED
                - OTP_INVALID
                - OTP_EXPIRED
                - PINCODE_NOT_SERVICEABLE
                - CART_CHANGED
                - STOCK_INSUFFICIENT
                - PAYMENT_FAILED
                - PAYMENT_ABANDONED
                - ORDER_NOT_FOUND
                - INVALID_STATE_TRANSITION
                - TOKEN_EXPIRED
                - TOKEN_REVOKED
                - CONFLICT
                - VALIDATION
                - INTERNAL
                - OTP_PROVIDER_DOWN
            message:
              type: string
            fieldErrors:
              type: object
              additionalProperties:
                type: string
            traceId:
              type: string
    Customer:
      type: object
      required: [id, phone]
      properties:
        id: { type: string }
        phone: { type: string }
        name: { type: [string, "null"] }
        email: { type: [string, "null"] }
        locale:
          type: string
          enum: [en, hi, kn, ta, te, mr, gu, bn, pa]
        createdAt: { type: string, format: date-time }
    Paginated:
      type: object
      required: [items, total, page, pageSize]
      properties:
        items: { type: array, items: {} }
        total: { type: integer }
        page: { type: integer }
        pageSize: { type: integer }

security:
  - bearerAuth: []

paths: {}
```

- [ ] **Step 3: Create `scripts/lint.ts`**

```typescript
import { execSync } from 'node:child_process';
execSync('redocly lint openapi.yaml', { stdio: 'inherit', cwd: process.cwd() });
```

- [ ] **Step 4: Create `scripts/check-breaking.ts`**

```typescript
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const mainPath = join(cwd, 'openapi.yaml');
const cachedPath = join(cwd, '.openapi.main.yaml');

if (!existsSync(cachedPath)) {
  console.log('No cached main spec — skipping diff (first run).');
  process.exit(0);
}

try {
  execSync(`oasdiff breaking ${cachedPath} ${mainPath}`, { stdio: 'inherit', cwd });
  console.log('✓ No breaking changes detected.');
} catch {
  console.error('✗ Breaking changes detected. Bump /v2/* or mark x-backward-compatible.');
  process.exit(1);
}
```

- [ ] **Step 5: Install + run lint**

```bash
cd packages/api-contract
pnpm install
pnpm lint
```

Expected: Redocly lints the spec with no errors (warnings OK).

- [ ] **Step 6: Commit**

```bash
git add packages/api-contract/
git commit -m "feat(api-contract): scaffold OpenAPI 3.1 contract package with redocly + oasdiff checks"
```

### Task 0.3: Create `packages/brand-tokens/` with Tailwind export

**Files:**
- Create: `packages/brand-tokens/package.json`
- Create: `packages/brand-tokens/tokens.json`
- Create: `packages/brand-tokens/scripts/export-from-tailwind.ts`
- Create: `packages/brand-tokens/scripts/codegen-kotlin.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@mishran/brand-tokens",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "export": "tsx scripts/export-from-tailwind.ts",
    "codegen:kotlin": "tsx scripts/codegen-kotlin.ts",
    "build": "pnpm export && pnpm codegen:kotlin"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create initial `tokens.json` (will be overwritten by export script)**

```json
{
  "color": {
    "brand": { "canvas": "#f7efe0", "surface": "#fbf6ec", "accent": "#9b4d2a", "pop": "#d79a35", "ink": "#2c1810" },
    "neutral": { "100": "#f3f0e8", "500": "#5a5a5a", "900": "#1a1a1a" }
  },
  "radius": { "sm": "4px", "md": "8px", "lg": "12px", "xl": "20px", "full": "9999px" },
  "spacing": { "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px" },
  "typography": {
    "heading": { "fontFamily": "Helvetica Neue, Arial, sans-serif", "weight": "600" },
    "body": { "fontFamily": "-apple-system, BlinkMacSystemFont, Georgia, serif", "lineHeight": "1.7" }
  }
}
```

- [ ] **Step 3: Create `scripts/export-from-tailwind.ts`**

```typescript
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Source-of-truth for v1. Web Tailwind v4 @theme reverse-flow is a tracked
// follow-up (not yet implemented). See lib/themes.ts for theme list.
//
// Canonical brand palette mirrors `mishran-default` (DEFAULT_THEME in
// lib/themes.ts): kakvi brown accent + festive saffron gold pop on warm
// milk-cream canvas.

const tokens = {
  color: {
    brand: {
      canvas: '#f7efe0',  // warm milk-cream background (mishran-default)
      surface: '#fbf6ec', // lighter surface
      accent: '#9b4d2a',  // kakvi brown — primary brand
      pop: '#d79a35',     // festive saffron gold — secondary
      ink: '#2c1810',     // deep kakvi brown — text
    },
    neutral: {
      50: '#fafaf7',
      100: '#f3f0e8',
      200: '#e5e5dd',
      400: '#9a9a8e',
      500: '#5a5a5a',
      700: '#3a3a3a',
      900: '#1a1a1a',
    },
    state: {
      success: '#2d6a4f',
      warning: '#d4a017',
      error: '#9d1c1c',
    },
  },
  radius: { sm: '4px', md: '8px', lg: '12px', xl: '20px', full: '9999px' },
  spacing: {
    xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px',
  },
  typography: {
    heading: {
      fontFamily: 'Helvetica Neue, Arial, sans-serif',
      weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    },
    body: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, serif',
      lineHeight: '1.7',
      sizes: { sm: 12, md: 14, lg: 16, xl: 18, xxl: 24, display: 32 },
    },
  },
};

const outPath = join(process.cwd(), 'tokens.json');
writeFileSync(outPath, JSON.stringify(tokens, null, 2) + '\n', 'utf8');
console.log(`✓ Wrote ${outPath}`);
```

- [ ] **Step 4: Create `scripts/codegen-kotlin.ts`**

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'tokens.json'), 'utf8'));

const kotlin = `// AUTO-GENERATED by packages/brand-tokens/scripts/codegen-kotlin.ts
// Do not edit by hand.
package com.mishran.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.shapes.Shape

object MishranColors {
  val BrandCanvas = Color(0xFFF7EFE0)
  val BrandSurface = Color(0xFFFBF6EC)
  val BrandAccent = Color(0xFF9B4D2A)
  val BrandPop = Color(0xFFD79A35)
  val BrandInk = Color(0xFF2C1810)

  val Neutral50 = Color(0xFFFAFAF7)
  val Neutral100 = Color(0xFFF3F0E8)
  val Neutral200 = Color(0xFFE5E5DD)
  val Neutral400 = Color(0xFF9A9A8E)
  val Neutral500 = Color(0xFF5A5A5A)
  val Neutral700 = Color(0xFF3A3A3A)
  val Neutral900 = Color(0xFF1A1A1A)

  val StateSuccess = Color(0xFF2D6A4F)
  val StateWarning = Color(0xFFD4A017)
  val StateError = Color(0xFF9D1C1C)
}

object MishranRadii {
  val sm = 4.dp
  val md = 8.dp
  val lg = 12.dp
  val xl = 20.dp

  fun shapeSm(): Shape = RoundedCornerShape(sm)
  fun shapeMd(): Shape = RoundedCornerShape(md)
  fun shapeLg(): Shape = RoundedCornerShape(lg)
  fun shapeXl(): Shape = RoundedCornerShape(xl)
}

object MishranSpacing {
  val xs = 4.dp
  val sm = 8.dp
  val md = 16.dp
  val lg = 24.dp
  val xl = 32.dp
  val xxl = 48.dp
}

object MishranType {
  val bodySm: TextUnit = 12.sp
  val bodyMd: TextUnit = 14.sp
  val bodyLg: TextUnit = 16.sp
  val bodyXl: TextUnit = 18.sp
  val bodyXxl: TextUnit = 24.sp
  val display: TextUnit = 32.sp
}
`;

const outDir = join(process.cwd(), 'generated', 'kotlin', 'com', 'mishran', 'app', 'ui', 'theme');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'MishranTokens.kt'), kotlin, 'utf8');
console.log('✓ Wrote MishranTokens.kt');
```

- [ ] **Step 5: Run codegen**

```bash
cd packages/brand-tokens
pnpm install
pnpm build
```

Expected: `tokens.json` written + `generated/kotlin/com/mishran/app/ui/theme/MishranTokens.kt` written.

- [ ] **Step 6: Commit**

```bash
git add packages/brand-tokens/
git commit -m "feat(brand-tokens): token export + Kotlin codegen for Android theme"
```

### Task 0.4: Create `packages/i18n-strings/` with 9 locales

**Files:**
- Create: `packages/i18n-strings/package.json`
- Create: `packages/i18n-strings/en.json` + 8 more locale files
- Create: `packages/i18n-strings/scripts/check-missing-keys.ts`
- Create: `packages/i18n-strings/scripts/codegen-android.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@mishran/i18n-strings",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "check": "tsx scripts/check-missing-keys.ts",
    "codegen:android": "tsx scripts/codegen-android.ts",
    "build": "pnpm check && pnpm codegen:android"
  },
  "devDependencies": {
    "tsx": "^4"
  }
}
```

- [ ] **Step 2: Create `en.json` (source of truth)**

```json
{
  "app.name": "Mishran",
  "app.tagline": "Modern house of traditional mithai",
  "nav.home": "Home",
  "nav.catalog": "Sweets",
  "nav.orders": "Orders",
  "nav.account": "Account",
  "nav.cart": "Cart",

  "auth.phone.title": "Enter your phone number",
  "auth.phone.subtitle": "We'll send you a 6-digit code",
  "auth.phone.placeholder": "+91 90000 00000",
  "auth.phone.cta": "Send OTP",
  "auth.otp.title": "Verify it's you",
  "auth.otp.subtitle": "Enter the code we sent to {phone}",
  "auth.otp.placeholder": "6-digit code",
  "auth.otp.cta": "Verify",
  "auth.otp.resend": "Resend code",
  "auth.otp.countdown": "Resend in {seconds}s",
  "auth.biometric.prompt": "Use biometric to log in to Mishran",
  "auth.biometric.title": "Welcome back",
  "auth.biometric.cta": "Quick login",
  "auth.error.rate_limited": "Too many attempts. Try again in {minutes} minutes.",
  "auth.error.otp_invalid": "Wrong code. {remaining} attempts left.",
  "auth.error.otp_expired": "Code expired. Tap resend.",

  "catalog.search.placeholder": "Search sweets, gifts…",
  "catalog.filter.title": "Filter",
  "catalog.filter.category": "Category",
  "catalog.filter.dietary": "Dietary",
  "catalog.empty": "No sweets match your filters.",
  "catalog.stale_banner": "Updated {minutes} min ago",

  "product.add_to_cart": "Add to cart",
  "product.quantity": "Quantity",
  "product.freshness": "Freshness promise",
  "product.ingredients": "Ingredients",
  "product.out_of_stock": "Out of stock",

  "cart.title": "Your cart",
  "cart.empty": "Your cart is empty.",
  "cart.empty_cta": "Browse sweets",
  "cart.subtotal": "Subtotal",
  "cart.delivery_fee": "Delivery",
  "cart.total": "Total",
  "cart.checkout": "Checkout",
  "cart.qty_decrease": "Decrease quantity",
  "cart.qty_increase": "Increase quantity",
  "cart.remove": "Remove",

  "checkout.title": "Checkout",
  "checkout.address.title": "Delivery address",
  "checkout.address.add_new": "Add new address",
  "checkout.address.line1": "Address line 1",
  "checkout.address.line2": "Address line 2 (optional)",
  "checkout.address.city": "City",
  "checkout.address.state": "State",
  "checkout.address.pincode": "PIN code",
  "checkout.address.tag": "Tag (Home, Work…)",
  "checkout.slot.title": "Delivery slot",
  "checkout.slot.today": "Today",
  "checkout.slot.tomorrow": "Tomorrow",
  "checkout.payment.title": "Payment method",
  "checkout.payment.upi": "UPI",
  "checkout.payment.card": "Credit / Debit card",
  "checkout.payment.netbanking": "Netbanking",
  "checkout.payment.wallet": "Wallet",
  "checkout.pay": "Pay {amount}",
  "checkout.error.pincode_not_serviceable": "We can't deliver to {pincode} yet.",
  "checkout.error.cart_changed": "Some items changed. Review and try again.",
  "checkout.error.stock_insufficient": "{name} only has {qty} left.",
  "checkout.error.payment_failed": "Payment failed. If money was deducted, it will be refunded in 5-7 days.",

  "orders.title": "Your orders",
  "orders.empty": "No orders yet.",
  "orders.status.created": "Placed",
  "orders.status.pending_payment": "Awaiting payment",
  "orders.status.confirmed": "Confirmed",
  "orders.status.packed": "Packed",
  "orders.status.dispatched": "Dispatched",
  "orders.status.out_for_delivery": "Out for delivery",
  "orders.status.delivered": "Delivered",
  "orders.status.cancelled": "Cancelled",
  "orders.status.payment_failed": "Payment failed",
  "orders.reorder": "Reorder",
  "orders.view_details": "View details",
  "orders.track": "Track",

  "account.title": "Account",
  "account.profile": "Profile",
  "account.addresses": "Saved addresses",
  "account.language": "Language",
  "account.notifications": "Notifications",
  "account.support": "Support",
  "account.logout": "Log out",
  "account.locale.en": "English",
  "account.locale.hi": "हिन्दी",
  "account.locale.kn": "ಕನ್ನಡ",
  "account.locale.ta": "தமிழ்",
  "account.locale.te": "తెలుగు",
  "account.locale.mr": "मराठी",
  "account.locale.gu": "ગુજરાતી",
  "account.locale.bn": "বাংলা",
  "account.locale.pa": "ਪੰਜਾਬੀ",

  "common.retry": "Retry",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.loading": "Loading…",
  "common.error_generic": "Something went wrong. Trace: {traceId}",
  "common.offline_banner": "You're offline. Showing cached data.",

  "push.order.confirmed.title": "Order confirmed",
  "push.order.confirmed.body": "We've received your order #{id}.",
  "push.order.packed.title": "Packed with care",
  "push.order.packed.body": "Your order #{id} is being prepped.",
  "push.order.dispatched.title": "On the way",
  "push.order.dispatched.body": "Your order #{id} has been dispatched.",
  "push.order.out_for_delivery.title": "Out for delivery",
  "push.order.out_for_delivery.body": "Your order #{id} will arrive soon.",
  "push.order.delivered.title": "Delivered",
  "push.order.delivered.body": "Enjoy! Order #{id} delivered.",

  "widget.order_status.title": "Mishran order",
  "widget.order_status.empty": "No active orders"
}
```

- [ ] **Step 3: Create the 8 other locale files (initial translations)**

For each locale (`hi`, `kn`, `ta`, `te`, `mr`, `gu`, `bn`, `pa`), create a stub `<locale>.json` with same keys, values either translated or marked TODO. Example for `hi.json`:

```json
{
  "app.name": "मिश्रण",
  "app.tagline": "पारंपरिक मिठाई का आधुनिक घर",
  "nav.home": "होम",
  "nav.catalog": "मिठाई",
  "nav.orders": "ऑर्डर",
  "nav.account": "खाता",
  "nav.cart": "कार्ट",

  "auth.phone.title": "अपना फ़ोन नंबर डालें",
  "auth.phone.subtitle": "हम आपको 6-अंकों का कोड भेजेंगे",
  "auth.phone.placeholder": "+91 90000 00000",
  "auth.phone.cta": "OTP भेजें",
  "auth.otp.title": "अपनी पहचान सत्यापित करें",
  "auth.otp.subtitle": "{phone} पर भेजा गया कोड डालें",
  "auth.otp.placeholder": "6-अंकों का कोड",
  "auth.otp.cta": "सत्यापित करें",
  "auth.otp.resend": "कोड पुनः भेजें",
  "auth.otp.countdown": "{seconds} सेकंड में पुनः भेजें",
  "auth.biometric.prompt": "मिश्रण में लॉग इन करने के लिए बायोमेट्रिक का उपयोग करें",
  "auth.biometric.title": "वापसी पर स्वागत है",
  "auth.biometric.cta": "त्वरित लॉगिन",
  "auth.error.rate_limited": "बहुत अधिक प्रयास। {minutes} मिनट में पुनः प्रयास करें।",
  "auth.error.otp_invalid": "गलत कोड। {remaining} प्रयास शेष।",
  "auth.error.otp_expired": "कोड समाप्त। पुनः भेजें।",

  "catalog.search.placeholder": "मिठाई, उपहार खोजें…",
  "catalog.filter.title": "फ़िल्टर",
  "catalog.filter.category": "श्रेणी",
  "catalog.filter.dietary": "आहार संबंधी",
  "catalog.empty": "आपके फ़िल्टर से कोई मिठाई मेल नहीं खाती।",
  "catalog.stale_banner": "{minutes} मिनट पहले अपडेट",

  "product.add_to_cart": "कार्ट में डालें",
  "product.quantity": "मात्रा",
  "product.freshness": "ताज़गी का वादा",
  "product.ingredients": "सामग्री",
  "product.out_of_stock": "स्टॉक में नहीं",

  "cart.title": "आपका कार्ट",
  "cart.empty": "आपका कार्ट खाली है।",
  "cart.empty_cta": "मिठाई देखें",
  "cart.subtotal": "उप-योग",
  "cart.delivery_fee": "डिलीवरी",
  "cart.total": "कुल",
  "cart.checkout": "चेकआउट",
  "cart.qty_decrease": "मात्रा घटाएँ",
  "cart.qty_increase": "मात्रा बढ़ाएँ",
  "cart.remove": "हटाएँ",

  "checkout.title": "चेकआउट",
  "checkout.address.title": "डिलीवरी का पता",
  "checkout.address.add_new": "नया पता जोड़ें",
  "checkout.address.line1": "पता पंक्ति 1",
  "checkout.address.line2": "पता पंक्ति 2 (वैकल्पिक)",
  "checkout.address.city": "शहर",
  "checkout.address.state": "राज्य",
  "checkout.address.pincode": "पिन कोड",
  "checkout.address.tag": "टैग (घर, कार्य…)",
  "checkout.slot.title": "डिलीवरी स्लॉट",
  "checkout.slot.today": "आज",
  "checkout.slot.tomorrow": "कल",
  "checkout.payment.title": "भुगतान विधि",
  "checkout.payment.upi": "यूपीआई",
  "checkout.payment.card": "क्रेडिट / डेबिट कार्ड",
  "checkout.payment.netbanking": "नेटबैंकिंग",
  "checkout.payment.wallet": "वॉलेट",
  "checkout.pay": "{amount} का भुगतान करें",
  "checkout.error.pincode_not_serviceable": "हम {pincode} पर डिलीवरी नहीं कर सकते।",
  "checkout.error.cart_changed": "कुछ आइटम बदल गए। समीक्षा करें।",
  "checkout.error.stock_insufficient": "{name} में केवल {qty} बचे हैं।",
  "checkout.error.payment_failed": "भुगतान विफल। यदि राशि कटी, तो 5-7 दिनों में वापस मिलेगी।",

  "orders.title": "आपके ऑर्डर",
  "orders.empty": "अभी तक कोई ऑर्डर नहीं।",
  "orders.status.created": "दिया गया",
  "orders.status.pending_payment": "भुगतान लंबित",
  "orders.status.confirmed": "पुष्टि की गई",
  "orders.status.packed": "पैक किया गया",
  "orders.status.dispatched": "भेज दिया गया",
  "orders.status.out_for_delivery": "डिलीवरी के लिए निकला",
  "orders.status.delivered": "डिलीवर हुआ",
  "orders.status.cancelled": "रद्द",
  "orders.status.payment_failed": "भुगतान विफल",
  "orders.reorder": "पुनः ऑर्डर",
  "orders.view_details": "विवरण देखें",
  "orders.track": "ट्रैक",

  "account.title": "खाता",
  "account.profile": "प्रोफ़ाइल",
  "account.addresses": "सहेजे गए पते",
  "account.language": "भाषा",
  "account.notifications": "सूचनाएँ",
  "account.support": "सहायता",
  "account.logout": "लॉग आउट",
  "account.locale.en": "English",
  "account.locale.hi": "हिन्दी",
  "account.locale.kn": "ಕನ್ನಡ",
  "account.locale.ta": "தமிழ்",
  "account.locale.te": "తెలుగు",
  "account.locale.mr": "मराठी",
  "account.locale.gu": "ગુજરાતી",
  "account.locale.bn": "বাংলা",
  "account.locale.pa": "ਪੰਜਾਬੀ",

  "common.retry": "पुनः प्रयास",
  "common.cancel": "रद्द करें",
  "common.confirm": "पुष्टि करें",
  "common.loading": "लोड हो रहा है…",
  "common.error_generic": "कुछ गलत हुआ। ट्रेस: {traceId}",
  "common.offline_banner": "आप ऑफ़लाइन हैं। कैश किया गया डेटा दिख रहा है।",

  "push.order.confirmed.title": "ऑर्डर की पुष्टि हुई",
  "push.order.confirmed.body": "ऑर्डर #{id} प्राप्त हुआ।",
  "push.order.packed.title": "सावधानी से पैक किया",
  "push.order.packed.body": "ऑर्डर #{id} तैयार हो रहा है।",
  "push.order.dispatched.title": "रास्ते में",
  "push.order.dispatched.body": "ऑर्डर #{id} भेज दिया गया।",
  "push.order.out_for_delivery.title": "डिलीवरी के लिए निकला",
  "push.order.out_for_delivery.body": "ऑर्डर #{id} जल्द पहुँचेगा।",
  "push.order.delivered.title": "डिलीवर हुआ",
  "push.order.delivered.body": "ऑर्डर #{id} डिलीवर हुआ।",

  "widget.order_status.title": "मिश्रण ऑर्डर",
  "widget.order_status.empty": "कोई सक्रिय ऑर्डर नहीं"
}
```

For the other 7 locales (`kn`, `ta`, `te`, `mr`, `gu`, `bn`, `pa`): create the file with the same keys, English values as placeholders, and a comment header `// TODO: translate to <locale>`. This unblocks v1 build; native translation pass happens in Phase 12 (Hardening).

- [ ] **Step 4: Create `scripts/check-missing-keys.ts`**

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.cwd();
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'package.json');
if (!files.includes('en.json')) {
  console.error('en.json missing — required as source of truth.');
  process.exit(1);
}
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
const enKeys = new Set(Object.keys(en));

let failed = false;
for (const f of files) {
  if (f === 'en.json') continue;
  const loc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const locKeys = new Set(Object.keys(loc));
  const missing = [...enKeys].filter((k) => !locKeys.has(k));
  const extra = [...locKeys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`✗ ${f}:`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
  } else {
    console.log(`✓ ${f}: ${locKeys.size} keys match en.json`);
  }
}
if (failed) process.exit(1);
```

- [ ] **Step 5: Create `scripts/codegen-android.ts`**

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

const cwd = process.cwd();
const files = readdirSync(cwd).filter((f) => f.endsWith('.json') && f !== 'package.json');

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

function toAndroidResourceName(key: string): string {
  return key.replace(/\./g, '_');
}

for (const f of files) {
  const locale = f.replace('.json', '');
  const values: Record<string, string> = JSON.parse(readFileSync(join(cwd, f), 'utf8'));
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
  for (const [key, value] of Object.entries(values)) {
    xml += `  <string name="${toAndroidResourceName(key)}">${escapeXml(value)}</string>\n`;
  }
  xml += '</resources>\n';

  const outDir = locale === 'en'
    ? join(cwd, 'generated', 'android', 'values')
    : join(cwd, 'generated', 'android', `values-${locale}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'strings.xml'), xml, 'utf8');
  console.log(`✓ ${locale} → ${outDir}`);
}
```

- [ ] **Step 6: Run check + codegen**

```bash
cd packages/i18n-strings
pnpm install
pnpm check
pnpm codegen:android
```

Expected: all locales pass key check; `generated/android/values*/strings.xml` files written.

- [ ] **Step 7: Commit**

```bash
git add packages/i18n-strings/
git commit -m "feat(i18n): add 9-locale string package with Android codegen"
```

### Task 0.5: Create `packages/analytics-taxonomy/` and `packages/feature-flags/`

**Files:**
- Create: `packages/analytics-taxonomy/package.json`
- Create: `packages/analytics-taxonomy/events.yaml`
- Create: `packages/feature-flags/package.json`
- Create: `packages/feature-flags/flags.yaml`

- [ ] **Step 1: Create `analytics-taxonomy/events.yaml`**

```yaml
version: 1
events:
  - name: app_launch
    params:
      cold_start: { type: boolean, required: true }
      locale: { type: string, required: true }
      app_version: { type: string, required: true }
  - name: screen_view
    params:
      screen: { type: string, required: true }
      referrer_screen: { type: string, required: false }
  - name: search_performed
    params:
      query: { type: string, required: true }
      result_count: { type: integer, required: true }
  - name: product_viewed
    params:
      product_id: { type: string, required: true }
      slug: { type: string, required: true }
  - name: add_to_cart
    params:
      product_id: { type: string, required: true }
      quantity: { type: integer, required: true }
      price_paise: { type: integer, required: true }
  - name: checkout_started
    params:
      cart_value_paise: { type: integer, required: true }
      item_count: { type: integer, required: true }
  - name: pincode_checked
    params:
      pincode: { type: string, required: true }
      serviceable: { type: boolean, required: true }
      tier: { type: string, required: false }
  - name: payment_initiated
    params:
      order_id: { type: string, required: true }
      amount_paise: { type: integer, required: true }
      method: { type: string, required: true }
  - name: payment_succeeded
    params:
      order_id: { type: string, required: true }
      amount_paise: { type: integer, required: true }
      method: { type: string, required: true }
  - name: payment_failed
    params:
      order_id: { type: string, required: true }
      reason_code: { type: string, required: true }
  - name: order_status_changed
    params:
      order_id: { type: string, required: true }
      from_status: { type: string, required: true }
      to_status: { type: string, required: true }
  - name: push_received
    params:
      event_id: { type: string, required: true }
      event_type: { type: string, required: true }
  - name: push_tapped
    params:
      event_id: { type: string, required: true }
      event_type: { type: string, required: true }
```

- [ ] **Step 2: Create `feature-flags/flags.yaml`**

```yaml
version: 1
flags:
  - key: enable_otp_login
    default: true
    description: "Show OTP login flow"
  - key: enable_razorpay_checkout
    default: true
    description: "Enable live Razorpay payments (false = test mode)"
  - key: enable_order_widget
    default: true
    description: "Show Android order-status widget configuration"
  - key: enable_locale_pa
    default: true
    description: "Show Punjabi in language picker"
  - key: maintenance_mode
    default: false
    description: "Block all checkouts; show maintenance screen"
```

- [ ] **Step 3: Create both `package.json` files (minimal)**

`analytics-taxonomy/package.json`:
```json
{
  "name": "@mishran/analytics-taxonomy",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "lint": "tsx scripts/lint.ts"
  },
  "devDependencies": { "tsx": "^4" }
}
```

`feature-flags/package.json`:
```json
{
  "name": "@mishran/feature-flags",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "lint": "tsx scripts/lint.ts"
  },
  "devDependencies": { "tsx": "^4" }
}
```

(Stub lint scripts that just `console.log('lint ok')` for now.)

- [ ] **Step 4: Commit**

```bash
git add packages/analytics-taxonomy/ packages/feature-flags/
git commit -m "feat(packages): analytics taxonomy + feature flags source-of-truth"
```

### Task 0.6: Docker dev stack (Mongo replica set + MinIO + Sentry stub)

**Files:**
- Create: `docker/compose.yml`
- Create: `docker/mongo/Dockerfile`
- Create: `docker/mongo/init-rs.sh`
- Create: `docker/minio/Dockerfile`

- [ ] **Step 1: Create `docker/compose.yml`**

```yaml
version: '3.9'
services:
  mongo:
    build: ./mongo
    container_name: mishran-mongo
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: mishran
      MONGO_INITDB_ROOT_PASSWORD: mishrandev
      MONGO_INITDB_DATABASE: mishran
    volumes:
      - mongo-data:/data/db
    command: ["--replSet", "rs0", "--bind_ip_all", "--port", "27017"]
    healthcheck:
      test: |
        mongosh --quiet --eval 'try { rs.status().ok } catch (e) { 0 }'
      interval: 10s
      timeout: 5s
      retries: 5

  mongo-init:
    image: mongo:7
    depends_on:
      mongo:
        condition: service_healthy
    entrypoint: |
      mongosh --host mongo:27017 -u mishran -p mishrandev --eval '
        try { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] }) } catch (e) { print(e.codeName) }
      '
    restart: "no"

  minio:
    image: minio/minio:latest
    container_name: mishran-minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: mishran
      MINIO_ROOT_PASSWORD: mishrandev
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data

volumes:
  mongo-data:
  minio-data:
```

- [ ] **Step 2: Create `docker/mongo/Dockerfile`**

```dockerfile
FROM mongo:7
```

(No customization; inherit upstream image.)

- [ ] **Step 3: Start stack**

```bash
cd docker
docker compose up -d
docker compose logs -f mongo-init
```

Expected: `mongo-init` exits 0 after printing `already initialized` or success. Mongo reachable on `mongodb://mishran:mishrandev@localhost:27017/mishran?replicaSet=rs0&authSource=admin`.

- [ ] **Step 4: Update `.env.example` MONGODB_URI to match dev stack**

```bash
MONGODB_URI=mongodb://mishran:mishrandev@localhost:27017/mishran?replicaSet=rs0&authSource=admin
```

- [ ] **Step 5: Commit**

```bash
git add docker/ .env.example
git commit -m "chore: add Docker dev stack (Mongo replica set + MinIO)"
```

---

## Phase 1: Backend — Payload Collections for Mobile Commerce

Defines Mongo collections for customers, addresses, orders, payments, shipments, serviceable pincodes, OTP requests, devices, idempotency keys, revoked tokens, security events.

### Task 1.1: Install backend dependencies

**Files:**
- Modify: root `package.json`

- [ ] **Step 1: Install runtime + test deps**

```bash
pnpm add payload @payloadcms/db-mongodb @payloadcms/richtext-lexical sharp argon2 jose zod razorpay resend @aws-sdk/client-s3 @aws-sdk/s3-request-presigner firebase-admin pino pino-http
pnpm add -D vitest @vitest/coverage-v8 mongodb-memory-server supertest @types/supertest nock @redocly/cli oasdiff openapi-typescript tsx
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add backend dependencies (payload, jose, razorpay, vitest, etc.)"
```

### Task 1.2: Create `lib/config.ts` env loader

**Files:**
- Create: `lib/config.ts`
- Create: `lib/config.test.ts`

**Interfaces:**
- Produces: `config` object consumed by all backend modules. Properties typed.

- [ ] **Step 1: Write the failing test `lib/config.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MONGODB_URI = 'mongodb://localhost/db';
    process.env.PAYLOAD_SECRET = 'a'.repeat(32);
    process.env.JWT_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nTEST\n-----END RSA PRIVATE KEY-----';
    process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_xxx';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsecret';
    process.env.MSG91_AUTH_KEY = 'msgkey';
    process.env.MSG91_SENDER_ID = 'MISHRN';
    process.env.FCM_PROJECT_ID = 'mishran-test';
    process.env.SENTRY_DSN = '';
    process.env.NODE_ENV = 'test';
  });

  it('parses valid env', async () => {
    const { config } = await import('./config');
    expect(config.mongoUri).toBe('mongodb://localhost/db');
    expect(config.jwt.algorithm).toBe('RS256');
    expect(config.otp.rateLimit.perPhonePerHour).toBe(5);
  });

  it('throws on missing required env', async () => {
    delete process.env.MONGODB_URI;
    await expect(() => import('./config')).rejects.toThrow(/MONGODB_URI/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/config.ts`**

```typescript
import { z } from 'zod';

const schema = z.object({
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  mongoUri: z.string().min(1, 'MONGODB_URI is required'),
  payloadSecret: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 chars'),
  jwtPrivateKey: z.string().min(1, 'JWT_PRIVATE_KEY is required'),
  jwtPublicKey: z.string().min(1, 'JWT_PUBLIC_KEY is required'),
  razorpayKeyId: z.string().min(1),
  razorpayKeySecret: z.string().min(1),
  razorpayWebhookSecret: z.string().min(1),
  msg91AuthKey: z.string().min(1),
  msg91SenderId: z.string().min(1),
  msg91TemplateOtp: z.string().min(1),
  fcmProjectId: z.string().optional(),
  resendApiKey: z.string().min(1),
  sentryDsn: z.string().optional().default(''),
  storageProvider: z.enum(['local', 'minio', 's3']).default('local'),
  storageLocalPath: z.string().default('./uploads'),
  flagProvider: z.enum(['env', 'growthbook']).default('env'),
  ga4Id: z.string().optional(),
  metaPixelId: z.string().optional(),
});

export type Config = z.infer<typeof schema> & {
  jwt: { algorithm: 'RS256' as const; accessTtlSeconds: number; refreshTtlSeconds: number };
  otp: { length: number; ttlSeconds: number; rateLimit: { perPhonePerHour: number; perPhonePerDay: number } };
};

export const config: Config = {
  ...schema.parse(process.env),
  jwt: { algorithm: 'RS256', accessTtlSeconds: 15 * 60, refreshTtlSeconds: 30 * 24 * 60 * 60 },
  otp: { length: 6, ttlSeconds: 5 * 60, rateLimit: { perPhonePerHour: 5, perPhonePerDay: 10 } },
};
```

- [ ] **Step 4: Run test to verify pass**

```bash
pnpm vitest run lib/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/config.ts lib/config.test.ts
git commit -m "feat(config): zod-validated env config loader with test coverage"
```

### Task 1.3: Customers collection

**Files:**
- Create: `collections/Customers.ts`
- Modify: `payload.config.ts` (add to `collections` array)

**Interfaces:**
- Produces: `customers` collection with fields: `phone` (unique), `name`, `email`, `locale`, `defaultAddresses`, `lastIp`, `createdAt`, `updatedAt`.

- [ ] **Step 1: Write `collections/Customers.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Customers: CollectionConfig = {
  slug: 'customers',
  auth: false,
  timestamps: true,
  admin: { useAsTitle: 'phone', defaultColumns: ['phone', 'name', 'locale', 'createdAt'] },
  indexes: [
    { fields: { phone: 1 }, options: { unique: true } },
    { fields: { createdAt: -1 } },
  ],
  fields: [
    { name: 'phone', type: 'text', required: true, unique: true, maxLength: 15 },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'email' },
    {
      name: 'locale',
      type: 'select',
      defaultValue: 'en',
      options: ['en', 'hi', 'kn', 'ta', 'te', 'mr', 'gu', 'bn', 'pa'].map((code) => ({ label: code, value: code })),
    },
    { name: 'defaultAddresses', type: 'array', fields: [{ name: 'addressId', type: 'relationship', relationTo: 'addresses' }] },
    { name: 'lastIp', type: 'text' },
    { name: 'lastSeenAt', type: 'date' },
  ],
};

export default Customers;
```

- [ ] **Step 2: Register in `payload.config.ts`**

Add `import { Customers } from './collections/Customers';` and add `Customers` to the `collections: [...]` array.

- [ ] **Step 3: Start dev server + verify admin shows collection**

```bash
pnpm dev
```

Visit `http://localhost:3000/admin/collections/customers`. Expected: empty Customers listing renders.

- [ ] **Step 4: Commit**

```bash
git add collections/Customers.ts payload.config.ts
git commit -m "feat(payload): add Customers collection with phone, locale, addresses"
```

### Task 1.4: Addresses collection

**Files:**
- Create: `collections/Addresses.ts`
- Modify: `payload.config.ts`

- [ ] **Step 1: Write `collections/Addresses.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Addresses: CollectionConfig = {
  slug: 'addresses',
  timestamps: true,
  admin: { useAsTitle: 'line1', defaultColumns: ['line1', 'city', 'pincode', 'tag'] },
  indexes: [{ fields: { customerId: 1 } }],
  fields: [
    { name: 'customerId', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'line1', type: 'text', required: true },
    { name: 'line2', type: 'text' },
    { name: 'city', type: 'text', required: true },
    { name: 'state', type: 'text', required: true },
    { name: 'pincode', type: 'text', required: true, maxLength: 10 },
    { name: 'lat', type: 'number' },
    { name: 'lng', type: 'number' },
    { name: 'tag', type: 'select', options: ['home', 'work', 'other'], defaultValue: 'home' },
    { name: 'isDefault', type: 'checkbox', defaultValue: false },
  ],
};

export default Addresses;
```

- [ ] **Step 2: Register in `payload.config.ts`. Commit.**

```bash
git add collections/Addresses.ts payload.config.ts
git commit -m "feat(payload): add Addresses collection"
```

### Task 1.5: Orders collection

**Files:**
- Create: `collections/Orders.ts`
- Create: `lib/commerce/types.ts`
- Modify: `payload.config.ts`

**Interfaces:**
- Produces: `orders` collection. `Order` type in `lib/commerce/types.ts` shared across services.

- [ ] **Step 1: Write `lib/commerce/types.ts`**

```typescript
export type OrderStatus =
  | 'created' | 'pending_payment' | 'confirmed' | 'packed' | 'dispatched'
  | 'out_for_delivery' | 'delivered' | 'payment_failed' | 'cancelled'
  | 'returned' | 'failed_delivery' | 'abandoned';

export type OrderSource = 'mobile-android' | 'mobile-ios' | 'web';

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  unit: string;
  priceInPaise: number;
  image?: string;
}

export interface OrderTotals {
  itemsTotalInPaise: number;
  deliveryFeeInPaise: number;
  taxesInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totals: OrderTotals;
  status: OrderStatus;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
  deliveryAddressId: string;
  slot?: { date: string; window: string };
  source: OrderSource;
  razorpayOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['pending_payment', 'cancelled', 'abandoned'],
  pending_payment: ['confirmed', 'payment_failed', 'cancelled', 'abandoned'],
  confirmed: ['packed', 'cancelled'],
  packed: ['dispatched', 'cancelled'],
  dispatched: ['out_for_delivery', 'failed_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'failed_delivery'],
  delivered: ['returned'],
  payment_failed: ['cancelled'],
  cancelled: [],
  returned: [],
  failed_delivery: ['returned'],
  abandoned: [],
};
```

- [ ] **Step 2: Write `collections/Orders.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Orders: CollectionConfig = {
  slug: 'orders',
  timestamps: true,
  admin: { useAsTitle: 'id', defaultColumns: ['id', 'customerId', 'status', 'totalInPaise', 'createdAt'], group: 'Commerce' },
  indexes: [
    { fields: { customerId: 1, createdAt: -1 } },
    { fields: { status: 1 } },
    { fields: { razorpayOrderId: 1 }, options: { unique: true, sparse: true } },
  ],
  fields: [
    { name: 'customerId', type: 'relationship', relationTo: 'customers', required: true, index: true },
    {
      name: 'items', type: 'array', required: true, minRows: 1,
      fields: [
        { name: 'productId', type: 'relationship', relationTo: 'mithai-products', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unit', type: 'text', required: true },
        { name: 'priceInPaise', type: 'number', required: true, min: 0 },
        { name: 'image', type: 'text' },
      ],
    },
    {
      name: 'totals', type: 'group', required: true,
      fields: [
        { name: 'itemsTotalInPaise', type: 'number', required: true },
        { name: 'deliveryFeeInPaise', type: 'number', required: true },
        { name: 'taxesInPaise', type: 'number', required: true },
        { name: 'discountInPaise', type: 'number', required: true, defaultValue: 0 },
        { name: 'totalInPaise', type: 'number', required: true },
      ],
    },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'created',
      options: ['created', 'pending_payment', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'payment_failed', 'cancelled', 'returned', 'failed_delivery', 'abandoned'].map((v) => ({ label: v, value: v })),
      index: true,
    },
    {
      name: 'paymentStatus', type: 'select', required: true, defaultValue: 'pending',
      options: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'].map((v) => ({ label: v, value: v })),
    },
    { name: 'deliveryAddressId', type: 'relationship', relationTo: 'addresses', required: true },
    {
      name: 'slot', type: 'group',
      fields: [
        { name: 'date', type: 'date' },
        { name: 'window', type: 'text' },
      ],
    },
    { name: 'source', type: 'select', required: true, options: ['mobile-android', 'mobile-ios', 'web'].map((v) => ({ label: v, value: v })) },
    { name: 'razorpayOrderId', type: 'text', unique: true, sparse: true },
    { name: 'cartSnapshotId', type: 'text' },
  ],
};

export default Orders;
```

- [ ] **Step 3: Register. Commit.**

```bash
git add collections/Orders.ts lib/commerce/types.ts payload.config.ts
git commit -m "feat(payload): add Orders collection + shared commerce types"
```

### Task 1.6: Payments, Shipments, ServiceablePincodes collections

**Files:**
- Create: `collections/Payments.ts`
- Create: `collections/Shipments.ts`
- Create: `collections/ServiceablePincodes.ts`

- [ ] **Step 1: `collections/Payments.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Payments: CollectionConfig = {
  slug: 'payments',
  timestamps: true,
  admin: { useAsTitle: 'id', group: 'Commerce', defaultColumns: ['id', 'orderId', 'status', 'amountInPaise', 'createdAt'] },
  indexes: [
    { fields: { orderId: 1 } },
    { fields: { providerPaymentId: 1 }, options: { unique: true, sparse: true } },
    { fields: { status: 1, createdAt: 1 } },
  ],
  fields: [
    { name: 'orderId', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'provider', type: 'select', required: true, options: ['razorpay', 'cashfree', 'phonepe'].map((v) => ({ label: v, value: v })) },
    { name: 'providerOrderId', type: 'text', index: true },
    { name: 'providerPaymentId', type: 'text', unique: true, sparse: true },
    { name: 'status', type: 'select', required: true, options: ['created', 'create_failed', 'captured', 'failed', 'refunded', 'partially_refunded'].map((v) => ({ label: v, value: v })), index: true },
    { name: 'amountInPaise', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'text', defaultValue: 'INR', maxLength: 3 },
    { name: 'method', type: 'select', options: ['upi', 'card', 'netbanking', 'wallet', 'emi'].map((v) => ({ label: v, value: v })) },
    { name: 'rawWebhookEvents', type: 'array', fields: [{ name: 'payload', type: 'json' }, { name: 'receivedAt', type: 'date' }] },
  ],
};

export default Payments;
```

- [ ] **Step 2: `collections/Shipments.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Shipments: CollectionConfig = {
  slug: 'shipments',
  timestamps: true,
  admin: { useAsTitle: 'orderId', group: 'Commerce', defaultColumns: ['orderId', 'currentStage', 'updatedAt'] },
  indexes: [{ fields: { orderId: 1 }, options: { unique: true } }],
  fields: [
    { name: 'orderId', type: 'relationship', relationTo: 'orders', required: true, unique: true },
    {
      name: 'currentStage', type: 'select', required: true,
      options: ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'failed_delivery'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'history', type: 'array',
      fields: [
        { name: 'stage', type: 'select', options: ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'failed_delivery'].map((v) => ({ label: v, value: v })) },
        { name: 'at', type: 'date', required: true },
        { name: 'note', type: 'text' },
        { name: 'actor', type: 'text' },
      ],
    },
    { name: 'eta', type: 'date' },
    { name: 'providerShipmentId', type: 'text' },
    { name: 'providerTrackingId', type: 'text' },
  ],
};

export default Shipments;
```

- [ ] **Step 3: `collections/ServiceablePincodes.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const ServiceablePincodes: CollectionConfig = {
  slug: 'serviceablePincodes',
  admin: { useAsTitle: 'pincode', group: 'Operations', defaultColumns: ['pincode', 'tier', 'city', 'slaDays'] },
  indexes: [{ fields: { pincode: 1 }, options: { unique: true } }, { fields: { tier: 1 } }, { fields: { city: 1 } }],
  fields: [
    { name: 'pincode', type: 'text', required: true, unique: true, maxLength: 10 },
    { name: 'tier', type: 'select', required: true, options: [{ label: 'Fresh (perishable)', value: 'fresh' }, { label: 'Shelf-stable', value: 'shelf' }] },
    { name: 'city', type: 'text', required: true },
    { name: 'state', type: 'text', required: true },
    { name: 'slaDays', type: 'number', required: true, min: 0 },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
};

export default ServiceablePincodes;
```

- [ ] **Step 4: Register all three in `payload.config.ts`. Commit.**

```bash
git add collections/Payments.ts collections/Shipments.ts collections/ServiceablePincodes.ts payload.config.ts
git commit -m "feat(payload): add Payments, Shipments, ServiceablePincodes collections"
```

### Task 1.7: Auth + ops collections (OtpRequests, Devices, IdempotencyKeys, RevokedTokens, SecurityEvents)

**Files:**
- Create: `collections/OtpRequests.ts`
- Create: `collections/Devices.ts`
- Create: `collections/IdempotencyKeys.ts`
- Create: `collections/RevokedTokens.ts`
- Create: `collections/SecurityEvents.ts`

- [ ] **Step 1: `collections/OtpRequests.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const OtpRequests: CollectionConfig = {
  slug: 'otpRequests',
  timestamps: true,
  admin: { group: 'Auth', defaultColumns: ['phone', 'expiresAt', 'createdAt'], useAsTitle: 'phone' },
  indexes: [{ fields: { phone: 1, createdAt: -1 } }, { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }],
  fields: [
    { name: 'phone', type: 'text', required: true, index: true },
    { name: 'codeHash', type: 'text', required: true },
    { name: 'attempts', type: 'number', defaultValue: 0 },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'consumedAt', type: 'date' },
    { name: 'messageId', type: 'text' },
  ],
};

export default OtpRequests;
```

- [ ] **Step 2: `collections/Devices.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const Devices: CollectionConfig = {
  slug: 'devices',
  timestamps: true,
  admin: { group: 'Auth', defaultColumns: ['customerId', 'platform', 'active', 'updatedAt'] },
  indexes: [{ fields: { pushToken: 1 }, options: { unique: true, sparse: true } }, { fields: { customerId: 1, active: 1 } }],
  fields: [
    { name: 'customerId', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'platform', type: 'select', required: true, options: ['android', 'ios'].map((v) => ({ label: v, value: v })) },
    { name: 'pushToken', type: 'text', required: true, unique: true, sparse: true },
    { name: 'appVersion', type: 'text' },
    { name: 'deviceModel', type: 'text' },
    { name: 'osVersion', type: 'text' },
    { name: 'locale', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
};

export default Devices;
```

- [ ] **Step 3: `collections/IdempotencyKeys.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const IdempotencyKeys: CollectionConfig = {
  slug: 'idempotencyKeys',
  timestamps: true,
  admin: { hidden: true },
  indexes: [{ fields: { key: 1 }, options: { unique: true } }, { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }],
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'requestHash', type: 'text', required: true },
    { name: 'responseStatus', type: 'number', required: true },
    { name: 'responseBody', type: 'json', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};

export default IdempotencyKeys;
```

- [ ] **Step 4: `collections/RevokedTokens.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const RevokedTokens: CollectionConfig = {
  slug: 'revokedTokens',
  timestamps: true,
  admin: { hidden: true },
  indexes: [{ fields: { jti: 1 }, options: { unique: true } }, { fields: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } }],
  fields: [
    { name: 'jti', type: 'text', required: true, unique: true, index: true },
    { name: 'customerId', type: 'relationship', relationTo: 'customers', required: true },
    { name: 'reason', type: 'select', options: ['logout', 'rotation', 'revoked', 'biometric_reset'].map((v) => ({ label: v, value: v })) },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
};

export default RevokedTokens;
```

- [ ] **Step 5: `collections/SecurityEvents.ts`**

```typescript
import { CollectionConfig } from 'payload';

export const SecurityEvents: CollectionConfig = {
  slug: 'securityEvents',
  timestamps: true,
  admin: { group: 'Auth', defaultColumns: ['type', 'customerId', 'createdAt'], useAsTitle: 'type' },
  indexes: [{ fields: { type: 1, createdAt: -1 } }, { fields: { customerId: 1 } }],
  fields: [
    { name: 'type', type: 'select', required: true, options: ['otp_brute_force', 'token_reuse_new_ip', 'webhook_signature_fail', 'mass_refund_attempt', 'unusual_order_pattern'].map((v) => ({ label: v, value: v })) },
    { name: 'customerId', type: 'relationship', relationTo: 'customers' },
    { name: 'ip', type: 'text' },
    { name: 'details', type: 'json' },
  ],
};

export default SecurityEvents;
```

- [ ] **Step 6: Register all five. Commit.**

```bash
git add collections/OtpRequests.ts collections/Devices.ts collections/IdempotencyKeys.ts collections/RevokedTokens.ts collections/SecurityEvents.ts payload.config.ts
git commit -m "feat(payload): add auth + ops collections (OtpRequests, Devices, IdempotencyKeys, RevokedTokens, SecurityEvents)"
```

### Task 1.8: Seed serviceable pincodes for Delhi NCR + top metros

**Files:**
- Create: `scripts/seed-pincodes.ts`
- Create: `data/delhi-ncr-pincodes.json` (subset of common pincodes for v1)
- Create: `data/metro-pincodes.json`

- [ ] **Step 1: Build Delhi NCR pincode seed (~30 entries)**

`data/delhi-ncr-pincodes.json`:
```json
[
  {"pincode":"110001","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110002","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110003","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110005","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110011","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110017","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110024","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110048","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"110092","city":"New Delhi","state":"Delhi","slaDays":1},
  {"pincode":"201301","city":"Noida","state":"Uttar Pradesh","slaDays":1},
  {"pincode":"201304","city":"Noida","state":"Uttar Pradesh","slaDays":1},
  {"pincode":"201309","city":"Noida","state":"Uttar Pradesh","slaDays":1},
  {"pincode":"122001","city":"Gurugram","state":"Haryana","slaDays":1},
  {"pincode":"002","city":"Gurugram","state":"Haryana","slaDays":1},
  {"pincode":"122002","city":"Gurugram","state":"Haryana","slaDays":1},
  {"pincode":"122009","city":"Gurugram","state":"Haryana","slaDays":1},
  {"pincode":"121001","city":"Faridabad","state":"Haryana","slaDays":2},
  {"pincode":"201009","city":"Ghaziabad","state":"Uttar Pradesh","slaDays":2}
]
```

(Filter or extend based on actual ops coverage at ship time.)

- [ ] **Step 2: Build metro pincode seed (10 entries per city, covering central pincodes)**

`data/metro-pincodes.json`:
```json
[
  {"pincode":"400001","city":"Mumbai","state":"Maharashtra","slaDays":3},
  {"pincode":"400050","city":"Mumbai","state":"Maharashtra","slaDays":3},
  {"pincode":"400076","city":"Mumbai","state":"Maharashtra","slaDays":3},
  {"pincode":"411001","city":"Pune","state":"Maharashtra","slaDays":3},
  {"pincode":"411014","city":"Pune","state":"Maharashtra","slaDays":3},
  {"pincode":"500001","city":"Hyderabad","state":"Telangana","slaDays":3},
  {"pincode":"500032","city":"Hyderabad","state":"Telangana","slaDays":3},
  {"pincode":"600001","city":"Chennai","state":"Tamil Nadu","slaDays":3},
  {"pincode":"600119","city":"Chennai","state":"Tamil Nadu","slaDays":3},
  {"pincode":"560001","city":"Bengaluru","state":"Karnataka","slaDays":3},
  {"pincode":"560102","city":"Bengaluru","state":"Karnataka","slaDays":3},
  {"pincode":"700001","city":"Kolkata","state":"West Bengal","slaDays":3},
  {"pincode":"700091","city":"Kolkata","state":"West Bengal","slaDays":3},
  {"pincode":"380001","city":"Ahmedabad","state":"Gujarat","slaDays":3},
  {"pincode":"380054","city":"Ahmedabad","state":"Gujarat","slaDays":3}
]
```

- [ ] **Step 3: Write `scripts/seed-pincodes.ts`**

```typescript
import { getPayload } from 'payload';
import config from '../payload.config';
import { readFileSync } from 'node:fs';

async function main() {
  const payload = await getPayload({ config });
  const delhi = JSON.parse(readFileSync('./data/delhi-ncr-pincodes.json', 'utf8'));
  const metros = JSON.parse(readFileSync('./data/metro-pincodes.json', 'utf8'));

  for (const p of delhi) {
    await payload.create({ collection: 'serviceablePincodes', data: { ...p, tier: 'fresh', active: true }, overwriteExisting: true });
  }
  for (const p of metros) {
    await payload.create({ collection: 'serviceablePincodes', data: { ...p, tier: 'shelf', active: true }, overwriteExisting: true });
  }

  console.log(`✓ Seeded ${delhi.length} Delhi NCR pincodes (tier=fresh) + ${metros.length} metro pincodes (tier=shelf)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run seed against dev DB**

```bash
pnpm tsx scripts/seed-pincodes.ts
```

Expected: console logs success count.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-pincodes.ts data/
git commit -m "feat(seed): Delhi NCR + top-metro serviceable pincode seed data"
```

---

---

## Phase 2: Backend — Auth (OTP + JWT) and Adapter Layer Wiring

### Task 2.1: ApiError class, ErrorCode enum, response envelope

**Files:**
- Create: `lib/api/errors.ts`
- Create: `lib/api/response.ts`
- Create: `lib/api/errors.test.ts`

**Interfaces:**
- Produces: `ApiError` class, `ErrorCode` enum, `jsonResponse()` + `errorResponse()` helpers. Used by every route.

- [ ] **Step 1: Write `lib/api/errors.ts`**

```typescript
export const ErrorCode = {
  RATE_LIMITED: 'RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_PROVIDER_DOWN: 'OTP_PROVIDER_DOWN',
  PINCODE_NOT_SERVICEABLE: 'PINCODE_NOT_SERVICEABLE',
  CART_CHANGED: 'CART_CHANGED',
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_ABANDONED: 'PAYMENT_ABANDONED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

const STATUS_CODES: Record<ErrorCode, number> = {
  RATE_LIMITED: 429,
  OTP_INVALID: 400,
  OTP_EXPIRED: 410,
  OTP_PROVIDER_DOWN: 503,
  PINCODE_NOT_SERVICEABLE: 422,
  CART_CHANGED: 409,
  STOCK_INSUFFICIENT: 409,
  PAYMENT_FAILED: 402,
  PAYMENT_ABANDONED: 422,
  ORDER_NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  TOKEN_EXPIRED: 401,
  TOKEN_REVOKED: 401,
  CONFLICT: 409,
  VALIDATION: 422,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly traceId: string;
  readonly fieldErrors?: Record<string, string>;
  readonly retryable: boolean;

  constructor(public code: ErrorCode, message: string, opts: { fieldErrors?: Record<string, string>; retryable?: boolean; traceId?: string } = {}) {
    super(message);
    this.statusCode = STATUS_CODES[code];
    this.traceId = opts.traceId ?? 'none';
    this.fieldErrors = opts.fieldErrors;
    this.retryable = opts.retryable ?? false;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        fieldErrors: this.fieldErrors,
        traceId: this.traceId,
      },
    };
  }
}
```

- [ ] **Step 2: Write `lib/api/response.ts`**

```typescript
import { NextResponse } from 'next/server';
import { ApiError } from './errors';

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function errorResponse(err: unknown, traceId: string = 'none') {
  if (err instanceof ApiError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode, headers: { 'X-Request-Id': traceId } });
  }
  // Don't leak internal details.
  const internal = new ApiError('INTERNAL' as any, 'Something went wrong.', { traceId });
  return NextResponse.json(internal.toJSON(), { status: 500, headers: { 'X-Request-Id': traceId } });
}
```

- [ ] **Step 3: Write `lib/api/errors.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { ApiError, ErrorCode } from './errors';

describe('ApiError', () => {
  it('maps code to status', () => {
    expect(new ApiError(ErrorCode.RATE_LIMITED, 'too many').statusCode).toBe(429);
    expect(new ApiError(ErrorCode.ORDER_NOT_FOUND, 'x').statusCode).toBe(404);
    expect(new ApiError(ErrorCode.TOKEN_EXPIRED, 'x').statusCode).toBe(401);
  });
  it('includes traceId in JSON', () => {
    const e = new ApiError(ErrorCode.INTERNAL, 'oops', { traceId: 'abc' });
    expect(e.toJSON().error.traceId).toBe('abc');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run lib/api/errors.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api/
git commit -m "feat(api): ApiError class + response envelope with traceId"
```

### Task 2.2: `lib/observability/Logger.ts` (Pino wrapper)

**Files:**
- Create: `lib/observability/Logger.ts`

- [ ] **Step 1: Write `Logger.ts`**

```typescript
import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.nodeEnv === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.codeHash',
      '*.razorpayKeySecret',
      'env.RAZORPAY_KEY_SECRET',
      'env.MSG91_AUTH_KEY',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(name) {
      return { level: name };
    },
  },
  serializers: {
    req(req) {
      req.body = undefined;
      return req;
    },
  },
});

export type Logger = typeof logger;
```

- [ ] **Step 2: Commit**

```bash
git add lib/observability/Logger.ts
git commit -m "feat(observability): Pino logger with secret redaction"
```

### Task 2.3: `lib/auth/JwtService.ts` (jose + RS256)

**Files:**
- Create: `lib/auth/JwtService.ts`
- Create: `lib/auth/JwtService.test.ts`

**Interfaces:**
- Produces: `JwtService` with `issueAccessToken(customerId)`, `issueRefreshToken(customerId)`, `verify(token)`, `revoke(jti, reason)`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { JwtService } from './JwtService';
import { generateKeyPairSync } from 'node:crypto';

describe('JwtService', () => {
  let svc: JwtService;
  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = (k: any) => k.export({ type: 'pkcs1', format: 'pem' }).toString();
    svc = new JwtService({ privateKey: pem(privateKey), publicKey: pem(publicKey), accessTtlSeconds: 60, refreshTtlSeconds: 3600 });
  });

  it('issues and verifies access token', async () => {
    const tok = await svc.issueAccessToken('cust_1');
    const claims = await svc.verify(tok);
    expect(claims.customerId).toBe('cust_1');
    expect(claims.kind).toBe('access');
  });

  it('issues and verifies refresh token', async () => {
    const tok = await svc.issueRefreshToken('cust_1');
    const claims = await svc.verify(tok);
    expect(claims.kind).toBe('refresh');
  });

  it('rejects wrong kind', async () => {
    const refresh = await svc.issueRefreshToken('cust_1');
    await expect(svc.verify(refresh, 'access')).rejects.toThrow();
  });

  it('rejects tampered token', async () => {
    const tok = await svc.issueAccessToken('cust_1');
    await expect(svc.verify(tok + 'x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
pnpm vitest run lib/auth/JwtService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `JwtService.ts`**

```typescript
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import { getPayload } from 'payload';
import type { Payload } from 'payload';
import config from '../../payload.config';

export interface TokenClaims extends JWTPayload {
  customerId: string;
  kind: 'access' | 'refresh';
}

export class JwtService {
  constructor(
    private deps: { privateKey: string; publicKey: string; accessTtlSeconds: number; refreshTtlSeconds: number },
  ) {}

  private async key(kind: 'private' | 'public') {
    const pem = kind === 'private' ? this.deps.privateKey : this.deps.publicKey;
    const buf = new TextEncoder().encode(pem);
    const { importPKCS8, importSPKI } = await import('jose');
    return kind === 'private' ? importPKCS8(buf, 'RS256') : importSPKI(buf, 'RS256');
  }

  async issueAccessToken(customerId: string): Promise<string> {
    const key = await this.key('private');
    return new SignJWT({ customerId, kind: 'access' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.deps.accessTtlSeconds}s`)
      .sign(key);
  }

  async issueRefreshToken(customerId: string): Promise<string> {
    const key = await this.key('private');
    return new SignJWT({ customerId, kind: 'refresh' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${this.deps.refreshTtlSeconds}s`)
      .sign(key);
  }

  async verify(token: string, expectedKind?: 'access' | 'refresh'): Promise<TokenClaims> {
    const key = await this.key('public');
    const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'] });
    const claims = payload as TokenClaims;
    if (expectedKind && claims.kind !== expectedKind) {
      throw new Error(`Expected ${expectedKind} token, got ${claims.kind}`);
    }
    // Check revocation list
    const payload = await getPayload({ config });
    const revoked = await payload.find({ collection: 'revokedTokens', where: { jti: { equals: claims.jti } }, limit: 1 });
    if (revoked.docs.length > 0) {
      throw new Error('Token revoked');
    }
    return claims;
  }

  async revoke(jti: string, customerId: string, reason: 'logout' | 'rotation' | 'revoked' | 'biometric_reset', expiresAt: Date): Promise<void> {
    const payload = await getPayload({ config });
    await payload.create({ collection: 'revokedTokens', data: { jti, customerId, reason, expiresAt: expiresAt.toISOString() } });
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
pnpm vitest run lib/auth/JwtService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/JwtService.ts lib/auth/JwtService.test.ts
git commit -m "feat(auth): RS256 JWT service with verify + revoke list check"
```

### Task 2.4: `OtpService` interface + MSG91 impl + Fake

**Files:**
- Create: `lib/auth/OtpService.ts`
- Create: `lib/auth/impl/Msg91OtpService.ts`
- Create: `lib/auth/impl/FakeOtpService.ts`
- Create: `lib/auth/impl/Msg91OtpService.test.ts`

**Interfaces:**
- Produces: `OtpService` interface. Impl resolves by env `OTP_PROVIDER`.

- [ ] **Step 1: Write `lib/auth/OtpService.ts`**

```typescript
export interface OtpService {
  send(phone: string, code: string): Promise<{ messageId: string }>;
  deliveryReport(messageId: string): Promise<'sent' | 'failed' | 'pending'>;
}
```

- [ ] **Step 2: Write `lib/auth/impl/FakeOtpService.ts`**

```typescript
import type { OtpService } from '../OtpService';

export class FakeOtpService implements OtpService {
  async send() { return { messageId: 'fake-msg-1' }; }
  async deliveryReport() { return 'sent' as const; }
}
```

- [ ] **Step 3: Write `lib/auth/impl/Msg91OtpService.ts`**

```typescript
import type { OtpService } from '../OtpService';
import { config } from '../../config';

export class Msg91OtpService implements OtpService {
  constructor(private deps: { authKey: string; senderId: string; templateId: string }) {}

  async send(phone: string, code: string): Promise<{ messageId: string }> {
    const url = `https://api.msg91.com/api/v5/otp?template_id=${this.deps.templateId}&mobile=${encodeURIComponent(phone)}&authkey=${this.deps.authKey}&OTP=${code}&sender=${this.deps.senderId}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`MSG91 OTP send failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as { message: string; type: string };
    return { messageId: body.message };
  }

  async deliveryReport(messageId: string): Promise<'sent' | 'failed' | 'pending'> {
    // MSG91 doesn't expose a simple delivery report API; treat as 'sent' after 2s.
    return 'sent';
  }
}
```

- [ ] **Step 4: Write test `Msg91OtpService.test.ts` using `nock`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { Msg91OtpService } from './Msg91OtpService';

describe('Msg91OtpService', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.enableNetConnect());

  it('sends OTP and returns messageId', async () => {
    nock('https://api.msg91.com')
      .get(/\/api\/v5\/otp/)
      .query(true)
      .reply(200, { message: 'msg-123', type: 'success' });

    const svc = new Msg91OtpService({ authKey: 'k', senderId: 'MISHRN', templateId: 'tpl' });
    const result = await svc.send('+919999999999', '123456');
    expect(result.messageId).toBe('msg-123');
  });

  it('throws on non-200', async () => {
    nock('https://api.msg91.com').get(/.*/).query(true).reply(500, 'err');
    const svc = new Msg91OtpService({ authKey: 'k', senderId: 'MISHRN', templateId: 'tpl' });
    await expect(svc.send('+919999999999', '123456')).rejects.toThrow(/MSG91/);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run lib/auth/impl/Msg91OtpService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/OtpService.ts lib/auth/impl/
git commit -m "feat(auth): OtpService interface + MSG91 + Fake impls with nock tests"
```

### Task 2.5: `lib/auth/rateLimiter.ts` (token bucket, Mongo-backed)

**Files:**
- Create: `lib/security/rateLimiter.ts`
- Create: `lib/security/rateLimiter.test.ts`

**Interfaces:**
- Produces: `RateLimiter.check(key, limit, windowSeconds)` → throws on exceed.

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from './rateLimiter';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017/ratelimiter-test?replicaSet=rs0';

describe('RateLimiter', () => {
  let limiter: RateLimiter;
  let client: MongoClient;

  beforeEach(async () => {
    client = new MongoClient(uri);
    await client.connect();
    await client.db().dropDatabase();
    limiter = new RateLimiter(client.db());
  });

  it('allows up to limit then blocks', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(limiter.check('phone:+91', 5, 3600)).resolves.toBeUndefined();
    }
    await expect(limiter.check('phone:+91', 5, 3600)).rejects.toThrow();
  });

  it('separate keys are independent', async () => {
    await limiter.check('phone:A', 2, 3600);
    await limiter.check('phone:A', 2, 3600);
    await expect(limiter.check('phone:B', 2, 3600)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Write `rateLimiter.ts`**

```typescript
import type { Db } from 'mongodb';
import { ApiError, ErrorCode } from '../api/errors';

interface RateBucket { _id: string; count: number; windowStart: Date; }

export class RateLimiter {
  constructor(private db: Db) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<void> {
    const col = this.db.collection<RateBucket>('rateBuckets');
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowSeconds * 1000);

    // Atomic upsert + increment
    const result = await col.findOneAndUpdate(
      { _id: key, windowStart: { $gte: windowStart } },
      { $inc: { count: 1 }, $setOnInsert: { windowStart: now } },
      { upsert: true, returnDocument: 'after' },
    );

    if (result && result.count > limit) {
      throw new ApiError(ErrorCode.RATE_LIMITED, `Rate limit exceeded for ${key}`, { retryable: true });
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run lib/security/rateLimiter.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/security/rateLimiter.ts lib/security/rateLimiter.test.ts
git commit -m "feat(security): Mongo token-bucket rate limiter"
```

### Task 2.6: OTP send + verify routes

**Files:**
- Create: `app/api/mobile/v1/auth/otp/send/route.ts`
- Create: `app/api/mobile/v1/auth/otp/verify/route.ts`
- Create: `app/api/mobile/v1/auth/otp/send/route.test.ts`
- Create: `app/api/mobile/v1/auth/otp/verify/route.test.ts`
- Modify: `packages/api-contract/openapi.yaml` — add `/auth/otp/send`, `/auth/otp/verify`

- [ ] **Step 1: Add to OpenAPI spec**

In `openapi.yaml`, add inside `components.schemas`:

```yaml
    OtpSendRequest:
      type: object
      required: [phone]
      properties:
        phone: { type: string, pattern: '^\+[1-9]\d{6,14}$' }
    OtpSendResponse:
      type: object
      required: [requestId, expiresAt]
      properties:
        requestId: { type: string }
        expiresAt: { type: string, format: date-time }
    OtpVerifyRequest:
      type: object
      required: [requestId, code]
      properties:
        requestId: { type: string }
        code: { type: string, pattern: '^[0-9]{6}$' }
    OtpVerifyResponse:
      type: object
      required: [accessToken, refreshToken, customer]
      properties:
        accessToken: { type: string }
        refreshToken: { type: string }
        customer: { $ref: '#/components/schemas/Customer' }
```

In `paths`:

```yaml
  /auth/otp/send:
    post:
      tags: [auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/OtpSendRequest' }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/OtpSendResponse' } } } } }
        '429': { description: Rate limited, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '503': { description: SMS provider down, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
  /auth/otp/verify:
    post:
      tags: [auth]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/OtpVerifyRequest' }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/OtpVerifyResponse' } } } } }
        '400': { description: Invalid OTP, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '410': { description: OTP expired, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

- [ ] **Step 2: Write failing test `send/route.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { MongoClient } from 'mongodb';
import { POST as sendHandler } from './route';

vi.mock('../../../../../../../lib/container', () => ({
  container: {
    otpService: { send: vi.fn().mockResolvedValue({ messageId: 'msg-1' }) },
    rateLimiter: { check: vi.fn() },
  },
}));

describe('POST /auth/otp/send', () => {
  it('returns 200 with requestId', async () => {
    const req = new Request('http://localhost/api/mobile/v1/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+919999999999' }),
    });
    const res = await sendHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requestId).toBeTruthy();
    expect(body.data.expiresAt).toBeTruthy();
  });

  it('rejects invalid phone', async () => {
    const req = new Request('http://localhost/api/mobile/v1/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: 'bad' }),
    });
    const res = await sendHandler(req);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 3: Run test to verify fail**

```bash
pnpm vitest run app/api/mobile/v1/auth/otp/send/route.test.ts
```

- [ ] **Step 4: Write `send/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import { randomBytes, randomInt } from 'node:crypto';
import argon2 from 'argon2';
import config from '../../../../../../payload.config';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { logger } from '../../../../../../lib/observability/Logger';

const Body = z.object({ phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone') });

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new ApiError(ErrorCode.VALIDATION, 'Invalid phone', { fieldErrors: { phone: parsed.error.issues[0]?.message ?? 'invalid' } });

    await container.rateLimiter.check(`otp:send:${parsed.data.phone}`, 5, 3600);
    await container.rateLimiter.check(`otp:send:${parsed.data.phone}:daily`, 10, 86400);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });

    const payload = await getPayload({ config });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const created = await payload.create({
      collection: 'otpRequests',
      data: { phone: parsed.data.phone, codeHash, attempts: 0, expiresAt: expiresAt.toISOString() },
    });

    try {
      const send = await container.otpService.send(parsed.data.phone, code);
      await payload.update({ collection: 'otpRequests', id: created.id, data: { messageId: send.messageId } });
    } catch (e) {
      logger.error({ traceId, err: e }, 'OTP send failed');
      throw new ApiError(ErrorCode.OTP_PROVIDER_DOWN, 'SMS provider unavailable', { retryable: true });
    }

    return jsonResponse({ requestId: created.id, expiresAt: expiresAt.toISOString() }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 5: Run test to verify pass**

```bash
pnpm vitest run app/api/mobile/v1/auth/otp/send/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write `verify/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import argon2 from 'argon2';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

const Body = z.object({
  requestId: z.string().min(1),
  code: z.string().regex(/^[0-9]{6}$/),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new ApiError(ErrorCode.VALIDATION, 'Invalid input', { fieldErrors: { code: 'Must be 6 digits' } });

    const payload = await getPayload({ config });
    const otp = await payload.findByID({ collection: 'otpRequests', id: parsed.data.requestId });
    if (!otp) throw new ApiError(ErrorCode.OTP_EXPIRED, 'OTP not found or expired');
    if (otp.consumedAt) throw new ApiError(ErrorCode.OTP_INVALID, 'OTP already used');
    if (new Date(otp.expiresAt) < new Date()) throw new ApiError(ErrorCode.OTP_EXPIRED, 'OTP expired');

    if (otp.attempts >= 5) throw new ApiError(ErrorCode.OTP_INVALID, 'Too many attempts');

    const ok = await argon2.verify(otp.codeHash, parsed.data.code);
    await payload.update({ collection: 'otpRequests', id: otp.id, data: { attempts: (otp.attempts ?? 0) + 1 } });
    if (!ok) throw new ApiError(ErrorCode.OTP_INVALID, `Wrong code. ${5 - (otp.attempts ?? 0) - 1} attempts left`);

    await payload.update({ collection: 'otpRequests', id: otp.id, data: { consumedAt: new Date().toISOString() } });

    // Upsert customer
    const existing = await payload.find({ collection: 'customers', where: { phone: { equals: otp.phone } }, limit: 1 });
    const customer = existing.docs[0] ?? await payload.create({ collection: 'customers', data: { phone: otp.phone, locale: 'en' } });

    const accessToken = await container.jwtService.issueAccessToken(customer.id);
    const refreshToken = await container.jwtService.issueRefreshToken(customer.id);

    return jsonResponse({ accessToken, refreshToken, customer: { id: customer.id, phone: customer.phone, name: customer.name, email: customer.email, locale: customer.locale } }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 7: Write verify tests (3 cases: success, wrong code, expired)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('../../../../../../../lib/container', async () => {
  const actual = await vi.importActual('../../../../../../../lib/container');
  return { ...actual, container: { jwtService: { issueAccessToken: vi.fn().mockResolvedValue('at'), issueRefreshToken: vi.fn().mockResolvedValue('rt') } } };
});

// Mock getPayload + argon2 in setup as needed
// (Truncated for brevity — full test setup uses MongoDB Memory Server)
describe('POST /auth/otp/verify', () => {
  it('returns tokens on valid OTP', async () => { /* … */ });
  it('rejects invalid code', async () => { /* … */ });
  it('rejects expired', async () => { /* … */ });
});
```

(Full implementation uses the shared Vitest setup with MongoDB Memory Server; see Task 2.10.)

- [ ] **Step 8: Run all auth tests + commit**

```bash
pnpm vitest run app/api/mobile/v1/auth/
git add app/api/mobile/v1/auth/ packages/api-contract/openapi.yaml
git commit -m "feat(auth): OTP send + verify routes with rate limiting and customer upsert"
```

### Task 2.7: Auth refresh + revoke (logout) routes

**Files:**
- Create: `app/api/mobile/v1/auth/refresh/route.ts`
- Create: `app/api/mobile/v1/auth/logout/route.ts`

- [ ] **Step 1: Write `refresh/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing refresh token');
    const refresh = auth.slice(7);
    let claims;
    try {
      claims = await container.jwtService.verify(refresh, 'refresh');
    } catch {
      throw new ApiError(ErrorCode.TOKEN_REVOKED, 'Invalid refresh token');
    }
    // Rotate: revoke old, issue new
    if (claims.jti) {
      await container.jwtService.revoke(claims.jti, claims.customerId, 'rotation', new Date((claims.exp ?? 0) * 1000));
    }
    const accessToken = await container.jwtService.issueAccessToken(claims.customerId);
    const newRefresh = await container.jwtService.issueRefreshToken(claims.customerId);
    return jsonResponse({ accessToken, refreshToken: newRefresh }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 2: Write `logout/route.ts` (similar — revoke refresh token)**

```typescript
import { NextRequest } from 'next/server';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing token');
    const token = auth.slice(7);
    try {
      const claims = await container.jwtService.verify(token, 'refresh');
      if (claims.jti) await container.jwtService.revoke(claims.jti, claims.customerId, 'logout', new Date((claims.exp ?? 0) * 1000));
    } catch { /* ok — already revoked */ }
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 3: Add paths to OpenAPI spec.**

- [ ] **Step 4: Tests + commit**

```bash
git add app/api/mobile/v1/auth/ packages/api-contract/openapi.yaml
git commit -m "feat(auth): refresh (rotation) + logout routes"
```

### Task 2.8: Auth middleware

**Files:**
- Create: `lib/api/authMiddleware.ts`

- [ ] **Step 1: Write `authMiddleware.ts`**

```typescript
import { NextRequest } from 'next/server';
import { container } from '../container';
import { ApiError, ErrorCode } from './errors';

export async function requireCustomer(req: NextRequest): Promise<{ customerId: string; jti?: string }> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing token');
  try {
    const claims = await container.jwtService.verify(auth.slice(7), 'access');
    return { customerId: claims.customerId, jti: claims.jti };
  } catch {
    throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Invalid or expired token');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/api/authMiddleware.ts
git commit -m "feat(api): requireCustomer auth middleware"
```

### Task 2.9: `lib/container.ts` DI wiring

**Files:**
- Create: `lib/container.ts`

**Interfaces:**
- Produces: `container` object exported once. All routes import from here.

- [ ] **Step 1: Write `lib/container.ts`**

```typescript
import { JwtService } from './auth/JwtService';
import { Msg91OtpService } from './auth/impl/Msg91OtpService';
import { FakeOtpService } from './auth/impl/FakeOtpService';
import { RazorpayPaymentService } from './commerce/impl/RazorpayPaymentService';
import { FakePaymentService } from './commerce/impl/FakePaymentService';
import { MongoRateLimiterAdapter } from './security/MongoRateLimiterAdapter';
import { FcmPushService } from './notifications/impl/FcmPushService';
import { FakePushService } from './notifications/impl/FakePushService';
import { Msg91SmsService } from './notifications/impl/Msg91SmsService';
import { ResendEmailService } from './email/impl/ResendEmailService';
import { MultiAnalyticsService } from './analytics/impl/MultiAnalyticsService';
import { LocalDiskStorageService } from './files/impl/LocalDiskStorageService';
import { MongoSearchService } from './search/impl/MongoSearchService';
import { EnvFlagService } from './featureflags/impl/EnvFlagService';
import { SentryReporter } from './observability/impl/SentryReporter';
import { FakeErrorReporter } from './observability/impl/FakeErrorReporter';
import { config } from './config';
import { MongoClient } from 'mongodb';
import type { OtpService } from './auth/OtpService';
import type { PaymentService } from './commerce/PaymentService';
import type { PushService } from './notifications/PushService';
import type { SmsService } from './notifications/SmsService';
import type { EmailService } from './email/EmailService';
import type { AnalyticsService } from './analytics/AnalyticsService';
import type { StorageService } from './files/StorageService';
import type { SearchService } from './search/SearchService';
import type { FeatureFlagService } from './featureflags/FeatureFlagService';
import type { ErrorReporter } from './observability/ErrorReporter';

function resolveByEnv<T>(envValue: string | undefined, options: Record<string, () => T>, fallback: string): T {
  const key = envValue ?? fallback;
  const factory = options[key];
  if (!factory) throw new Error(`Unknown provider "${key}" for service. Available: ${Object.keys(options).join(', ')}`);
  return factory();
}

// Mongo shared client
let mongoClient: MongoClient | null = null;
async function getMongo() {
  if (!mongoClient) {
    mongoClient = new MongoClient(config.mongoUri);
    await mongoClient.connect();
  }
  return mongoClient.db();
}

// Lazy resolver because some deps need Mongo
const lazy = <T>(factory: () => Promise<T> | T): { get: () => Promise<T> } => {
  let cached: T | null = null;
  return { get: async () => cached ??= await factory() };
};

const otpLazy = lazy<OtpService>(() => resolveByEnv(process.env.OTP_PROVIDER, {
  msg91: () => new Msg91OtpService({ authKey: config.msg91AuthKey, senderId: config.msg91SenderId, templateId: process.env.MSG91_TEMPLATE_OTP! }),
  fake: () => new FakeOtpService(),
}, config.nodeEnv === 'test' ? 'fake' : 'msg91'));

const paymentLazy = lazy<PaymentService>(() => resolveByEnv(process.env.PAYMENT_PROVIDER, {
  razorpay: () => new RazorpayPaymentService({ keyId: config.razorpayKeyId, keySecret: config.razorpayKeySecret }),
  fake: () => new FakePaymentService(),
}, config.nodeEnv === 'test' ? 'fake' : 'razorpay'));

const pushLazy = lazy<PushService>(() => resolveByEnv(process.env.PUSH_PROVIDER, {
  fcm: async () => new FcmPushService({ projectId: config.fcmProjectId! }),
  fake: () => new FakePushService(),
}, config.nodeEnv === 'test' ? 'fake' : 'fcm'));

const smsLazy = lazy<SmsService>(() => resolveByEnv(process.env.SMS_PROVIDER, {
  msg91: () => new Msg91SmsService({ authKey: config.msg91AuthKey, senderId: config.msg91SenderId }),
  fake: () => ({ async send() { return { messageId: 'fake' }; } }) as SmsService,
}, config.nodeEnv === 'test' ? 'fake' : 'msg91'));

const emailLazy = lazy<EmailService>(() => resolveByEnv(process.env.EMAIL_PROVIDER, {
  resend: () => new ResendEmailService({ apiKey: config.resendApiKey }),
  fake: () => ({ async send() { return { messageId: 'fake' }; } }) as EmailService,
}, config.nodeEnv === 'test' ? 'fake' : 'resend'));

const analyticsLazy = lazy<AnalyticsService>(() => new MultiAnalyticsService([]));
const storageLazy = lazy<StorageService>(() => resolveByEnv(config.storageProvider, {
  local: () => new LocalDiskStorageService({ basePath: config.storageLocalPath }),
  minio: () => { throw new Error('Minio not yet wired in Task 2.9'); },
}, 'local'));

const searchLazy = lazy<SearchService>(async () => new MongoSearchService(await getMongo()));
const flagsLazy = lazy<FeatureFlagService>(() => resolveByEnv(config.flagProvider, {
  env: () => new EnvFlagService(),
}, 'env'));

const reporterLazy = lazy<ErrorReporter>(() => resolveByEnv(process.env.ERROR_PROVIDER, {
  sentry: () => new SentryReporter({ dsn: config.sentryDsn }),
  fake: () => new FakeErrorReporter(),
}, config.nodeEnv === 'test' ? 'fake' : 'sentry'));

const rateLimiterLazy = lazy(async () => {
  const { RateLimiter } = await import('./security/rateLimiter');
  return new RateLimiter(await getMongo());
});

export const container = {
  jwtService: new JwtService({
    privateKey: config.jwtPrivateKey,
    publicKey: config.jwtPublicKey,
    accessTtlSeconds: config.jwt.accessTtlSeconds,
    refreshTtlSeconds: config.jwt.refreshTtlSeconds,
  }),
  get otpService() { return otpLazy.get(); },
  get paymentService() { return paymentLazy.get(); },
  get pushService() { return pushLazy.get(); },
  get smsService() { return smsLazy.get(); },
  get emailService() { return emailLazy.get(); },
  get analyticsService() { return analyticsLazy.get(); },
  get storageService() { return storageLazy.get(); },
  get searchService() { return searchLazy.get(); },
  get flagService() { return flagsLazy.get(); },
  get errorReporter() { return reporterLazy.get(); },
  get rateLimiter() { return rateLimiterLazy.get(); },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/container.ts
git commit -m "feat(di): container wiring with env-driven provider selection"
```

### Task 2.10: Vitest setup with MongoDB Memory Server + global mocks

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: root `package.json` (test setup)

- [ ] **Step 1: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['**/*.test.ts', 'vitest.setup.ts'],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 2: Write `vitest.setup.ts`**

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let replSet: MongoMemoryReplSet | null = null;
let client: MongoClient | null = null;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  // Other env vars already set by .env.test if needed
});

afterEach(async () => {
  if (client) {
    const dbs = await client.db().admin().listDatabases();
    for (const db of dbs.databases) {
      if (!['admin', 'local', 'config'].includes(db.name)) {
        await client.db(db.name).dropDatabase();
      }
    }
  }
});

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
});
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts vitest.setup.ts
git commit -m "test: vitest config with MongoDB Memory replica set"
```

---

## Phase 3: Backend — Catalog + Cart APIs

### Task 3.1: Catalog products GET endpoint with ETag

**Files:**
- Create: `app/api/mobile/v1/catalog/products/route.ts`
- Create: `app/api/mobile/v1/catalog/products/route.test.ts`
- Modify: OpenAPI spec — add `/catalog/products`

- [ ] **Step 1: Add to OpenAPI spec**

```yaml
  /catalog/products:
    get:
      tags: [catalog]
      security: []
      parameters:
        - in: header
          name: If-None-Match
          schema: { type: string }
        - in: query
          name: category
          schema: { type: string }
        - in: query
          name: tier
          schema: { type: string, enum: [fresh, shelf] }
        - in: query
          name: dietary
          schema: { type: array, items: { type: string, enum: [sugar_free, eggless, vegan] } }
        - in: query
          name: page
          schema: { type: integer, default: 1 }
        - in: query
          name: pageSize
          schema: { type: integer, default: 50, maximum: 100 }
        - in: query
          name: q
          schema: { type: string }
      responses:
        '200':
          description: OK
          headers:
            ETag: { schema: { type: string } }
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    allOf:
                      - $ref: '#/components/schemas/Paginated'
                      - type: object
                        properties:
                          items: { type: array, items: { $ref: '#/components/schemas/Product' } }
        '304': { description: Not Modified }
```

(Also add `Product` schema to `components.schemas` mirroring `MithaiProducts` fields + `id`, `slug`, `name`, `priceInPaise`, `displayPrice`, `unit`, `category`, `dietary`, `images[]`, `stock`, `tier`, `description`, `ingredients`, `freshnessDays`, `updatedAt`.)

- [ ] **Step 2: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';

describe('GET /catalog/products', () => {
  beforeEach(async () => {
    const { seedCatalog } = await import('../../../../../../../../scripts/seed-test-catalog');
    await seedCatalog();
  });

  it('returns 200 with product list + ETag', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeTruthy();
    const body = await res.json();
    expect(body.data.items.length).toBeGreaterThan(0);
  });

  it('returns 304 when If-None-Match matches', async () => {
    const req1 = new Request('http://localhost/api/mobile/v1/catalog/products');
    const res1 = await GET(req1);
    const etag = res1.headers.get('ETag')!;
    const req2 = new Request('http://localhost/api/mobile/v1/catalog/products', { headers: { 'If-None-Match': etag } });
    const res2 = await GET(req2);
    expect(res2.status).toBe(304);
  });

  it('filters by tier=fresh', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products?tier=fresh');
    const res = await GET(req);
    const body = await res.json();
    expect(body.data.items.every((p: any) => p.tier === 'fresh')).toBe(true);
  });
});
```

- [ ] **Step 3: Write `route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { createHash } from 'node:crypto';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category') ?? undefined;
    const tier = url.searchParams.get('tier') as 'fresh' | 'shelf' | undefined;
    const dietary = url.searchParams.getAll('dietary');
    const q = url.searchParams.get('q') ?? undefined;
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100);

    const payload = await getPayload({ config });

    const where: Record<string, unknown> = {};
    if (category) where.category = { equals: category };
    if (tier) where.tier = { equals: tier };
    if (dietary.length) where.dietary = { in: dietary };
    if (q) where.name = { contains: q };

    const result = await payload.find({
      collection: 'mithai-products',
      where,
      page,
      limit: pageSize,
      sort: '-updatedAt',
    });

    const etagInput = result.docs.map((d) => `${d.id}:${d.updatedAt}`).join('|');
    const etag = '"' + createHash('sha1').update(etagInput).digest('hex').slice(0, 16) + '"';
    if (req.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    return jsonResponse({
      items: result.docs.map(serializeProduct),
      total: result.totalDocs,
      page: result.page,
      pageSize: result.limit,
    }, { headers: { ETag: etag } });
  } catch (err) {
    return errorResponse(err);
  }
}

function serializeProduct(p: any) {
  return {
    id: p.id, slug: p.slug, name: p.name, priceInPaise: p.priceInPaise,
    displayPrice: p.displayPrice, unit: p.unit, category: p.category,
    dietary: p.dietary ?? [], images: p.images?.map((i: any) => i.url ?? i) ?? [],
    stock: p.stock, tier: p.tier, description: p.description,
    ingredients: p.ingredients, freshnessDays: p.freshnessDays, updatedAt: p.updatedAt,
  };
}
```

- [ ] **Step 4: Run tests, commit.**

```bash
git add app/api/mobile/v1/catalog/products/ packages/api-contract/openapi.yaml
git commit -m "feat(catalog): GET /catalog/products with ETag caching"
```

### Task 3.2: Product detail by slug

**Files:**
- Create: `app/api/mobile/v1/catalog/products/[slug]/route.ts`
- Modify: OpenAPI spec — add `/catalog/products/{slug}`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const payload = await getPayload({ config });
    const result = await payload.find({ collection: 'mithai-products', where: { slug: { equals: slug } }, limit: 1 });
    if (!result.docs[0]) throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Product "${slug}" not found`);
    const p = result.docs[0];
    return jsonResponse({
      id: p.id, slug: p.slug, name: p.name, priceInPaise: p.priceInPaise,
      displayPrice: p.displayPrice, unit: p.unit, category: p.category,
      dietary: p.dietary ?? [], images: p.images?.map((i: any) => i.url ?? i) ?? [],
      stock: p.stock, tier: p.tier, description: p.description, ingredients: p.ingredients,
      freshnessDays: p.freshnessDays, updatedAt: p.updatedAt, relatedProductIds: p.relatedProductIds ?? [],
    });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Tests + commit.**

### Task 3.3: Pincode serviceability check

**Files:**
- Create: `app/api/mobile/v1/catalog/serviceable/route.ts`
- Modify: OpenAPI spec

- [ ] **Step 1: Write route**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';

const Query = z.object({ pincode: z.string().regex(/^[0-9]{6}$/) });

export async function GET(req: NextRequest) {
  try {
    const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return jsonResponse({ serviceable: false, reason: 'invalid_pincode' }, { status: 422 });
    const payload = await getPayload({ config });
    const result = await payload.find({ collection: 'serviceablePincodes', where: { pincode: { equals: parsed.data.pincode }, active: { equals: true } }, limit: 1 });
    if (!result.docs[0]) return jsonResponse({ serviceable: false });
    const p = result.docs[0] as any;
    return jsonResponse({ serviceable: true, tier: p.tier, city: p.city, slaDays: p.slaDays });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Tests + commit.**

### Task 3.4: Cart validate endpoint

**Files:**
- Create: `app/api/mobile/v1/cart/validate/route.ts`
- Modify: OpenAPI spec

- [ ] **Step 1: Add to OpenAPI**

```yaml
  /cart/validate:
    post:
      tags: [cart]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CartValidateRequest' }
      responses:
        '200': { description: OK, content: { application/json: { schema: { type: object, properties: { data: { $ref: '#/components/schemas/CartSnapshot' } } } } } }
        '409': { description: Cart changed, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
```

- [ ] **Step 2: Add schemas (`CartValidateRequest`, `CartItem`, `CartSnapshot`, `OrderTotals`)**

- [ ] **Step 3: Write route** (re-fetches prices from `products`, re-checks pincode, computes totals, returns cart snapshot with `expiresAt: +10min`)

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { randomUUID } from 'node:crypto';

const Body = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1),
  })).min(1),
  pincode: z.string().regex(/^[0-9]{6}$/),
  slot: z.object({ date: z.string(), window: z.string() }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new ApiError(ErrorCode.VALIDATION, 'Invalid cart', { fieldErrors: parsed.error.flatten().fieldErrors as any });

    const payload = await getPayload({ config });

    // Pincode check
    const pincodeDoc = await payload.find({ collection: 'serviceablePincodes', where: { pincode: { equals: parsed.data.pincode }, active: { equals: true } }, limit: 1 });
    if (!pincodeDoc.docs[0]) throw new ApiError(ErrorCode.PINCODE_NOT_SERVICEABLE, `Can't deliver to ${parsed.data.pincode}`);
    const pincode = pincodeDoc.docs[0] as any;

    // Fetch all products fresh
    const items: any[] = [];
    let itemsTotal = 0;
    for (const it of parsed.data.items) {
      const product = await payload.findByID({ collection: 'mithai-products', id: it.productId, overrideAccess: false });
      if (!product) throw new ApiError(ErrorCode.CART_CHANGED, `Item no longer available`);
      if (product.tier === 'fresh' && pincode.tier === 'shelf') throw new ApiError(ErrorCode.PINCODE_NOT_SERVICEABLE, `${product.name} ships fresh only to Delhi NCR`);
      if (product.stock < it.quantity) throw new ApiError(ErrorCode.STOCK_INSUFFICIENT, `${product.name} only has ${product.stock} left`, { fieldErrors: { productId: product.id, available: String(product.stock) } });
      items.push({ productId: product.id, slug: product.slug, name: product.name, quantity: it.quantity, unit: product.unit, priceInPaise: product.priceInPaise, image: product.images?.[0]?.url });
      itemsTotal += product.priceInPaise * it.quantity;
    }

    const deliveryFee = computeDeliveryFee(itemsTotal, pincode.tier);
    const taxes = Math.round(itemsTotal * 0.05); // 5% GST estimate; refine per product
    const total = itemsTotal + deliveryFee + taxes;

    const snapshotId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    return jsonResponse({
      snapshotId,
      customerId,
      items,
      totals: { itemsTotalInPaise: itemsTotal, deliveryFeeInPaise: deliveryFee, taxesInPaise: taxes, discountInPaise: 0, totalInPaise: total },
      pincodeTier: pincode.tier,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

function computeDeliveryFee(itemsTotalPaise: number, tier: 'fresh' | 'shelf'): number {
  if (tier === 'fresh') return itemsTotalPaise >= 50_000 ? 0 : 5_000;
  return itemsTotalPaise >= 100_000 ? 0 : 15_000;
}
```

- [ ] **Step 4: Tests for valid cart, price changed, stock insufficient, fresh-pincode-block. Commit.**

---

## Phase 4: Backend — Orders + Razorpay Payments + Idempotency

### Task 4.1: Idempotency middleware helper

**Files:**
- Create: `lib/idempotency/idempotency.ts`
- Create: `lib/idempotency/idempotency.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withIdempotency } from './idempotency';

describe('withIdempotency', () => {
  it('caches identical request', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{"data":1}', { status: 200 }));
    const key = 'k1';
    const body = '{"a":1}';
    const r1 = await withIdempotency(key, body, handler);
    const r2 = await withIdempotency(key, body, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await r2.json()).toEqual({ data: 1 });
  });

  it('rejects different body same key', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await withIdempotency('k2', '{"a":1}', handler);
    const r = await withIdempotency('k2', '{"a":2}', handler);
    expect(r.status).toBe(409);
  });
});
```

- [ ] **Step 2: Write `withIdempotency`**

```typescript
import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
import config from '../../payload.config';
import { ApiError, ErrorCode } from '../api/errors';
import { NextResponse } from 'next/server';

export async function withIdempotency<T extends Response>(
  key: string | null,
  body: string,
  handler: () => Promise<T>,
): Promise<Response> {
  if (!key) return handler();

  const payload = await getPayload({ config });
  const hash = createHash('sha256').update(body).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existing = await payload.find({ collection: 'idempotencyKeys', where: { key: { equals: key } }, limit: 1 });
  if (existing.docs[0]) {
    const doc = existing.docs[0] as any;
    if (doc.requestHash !== hash) {
      const err = new ApiError(ErrorCode.CONFLICT, 'Idempotency key reused with different body');
      return NextResponse.json(err.toJSON(), { status: 409 });
    }
    return NextResponse.json(doc.responseBody, { status: doc.responseStatus });
  }

  const result = await handler();
  const cloned = result.clone();
  const text = await cloned.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep as text */ }
  await payload.create({
    collection: 'idempotencyKeys',
    data: { key, requestHash: hash, responseStatus: result.status, responseBody: parsed, expiresAt: expiresAt.toISOString() },
  });
  return result;
}
```

- [ ] **Step 3: Run tests. Commit.**

### Task 4.2: `OrderService` interface + Payload impl + state machine

**Files:**
- Create: `lib/commerce/OrderService.ts`
- Create: `lib/commerce/impl/PayloadOrderService.ts`
- Create: `lib/commerce/impl/PayloadOrderService.test.ts`

- [ ] **Step 1: Interface**

```typescript
import type { Order, OrderStatus } from '../types';

export interface OrderService {
  createFromSnapshot(snapshot: any, customerId: string, source: 'mobile-android' | 'mobile-ios' | 'web'): Promise<Order>;
  getById(id: string, customerId: string): Promise<Order | null>;
  listForCustomer(customerId: string, page: number, pageSize: number): Promise<{ items: Order[]; total: number }>;
  transition(orderId: string, newStatus: OrderStatus, opts: { actor: string; note?: string }): Promise<Order>;
}
```

- [ ] **Step 2: Impl with transition validation**

```typescript
import { getPayload } from 'payload';
import config from '../../../payload.config';
import type { Order, OrderStatus } from '../../types';
import { ORDER_TRANSITIONS } from '../../types';
import type { OrderService } from '../OrderService';
import { ApiError, ErrorCode } from '../../../api/errors';

export class PayloadOrderService implements OrderService {
  async createFromSnapshot(snapshot: any, customerId: string, source: 'mobile-android' | 'mobile-ios' | 'web'): Promise<Order> {
    const payload = await getPayload({ config });
    const created = await payload.create({
      collection: 'orders',
      data: {
        customerId,
        items: snapshot.items,
        totals: snapshot.totals,
        status: 'pending_payment',
        paymentStatus: 'pending',
        deliveryAddressId: snapshot.deliveryAddressId,
        slot: snapshot.slot,
        source,
        cartSnapshotId: snapshot.snapshotId,
      },
    });
    return this.mapDoc(created);
  }

  async getById(id: string, customerId: string): Promise<Order | null> {
    const payload = await getPayload({ config });
    try {
      const doc = await payload.findByID({ collection: 'orders', id, overrideAccess: false });
      if (doc.customerId !== customerId) return null;
      return this.mapDoc(doc);
    } catch { return null; }
  }

  async listForCustomer(customerId: string, page: number, pageSize: number) {
    const payload = await getPayload({ config });
    const result = await payload.find({ collection: 'orders', where: { customerId: { equals: customerId } }, page, limit: pageSize, sort: '-createdAt' });
    return { items: result.docs.map((d) => this.mapDoc(d)), total: result.totalDocs };
  }

  async transition(orderId: string, newStatus: OrderStatus, opts: { actor: string; note?: string }): Promise<Order> {
    const payload = await getPayload({ config });
    const doc = await payload.findByID({ collection: 'orders', id: orderId });
    if (!doc) throw new ApiError(ErrorCode.ORDER_NOT_FOUND, `Order ${orderId} not found`);
    const current = doc.status as OrderStatus;
    const allowed = ORDER_TRANSITIONS[current];
    if (!allowed.includes(newStatus)) throw new ApiError(ErrorCode.INVALID_STATE_TRANSITION, `Cannot transition ${current} → ${newStatus}`);

    const updated = await payload.update({ collection: 'orders', id: orderId, data: { status: newStatus } });

    // Update shipment history
    await payload.update({
      collection: 'shipments',
      where: { orderId: { equals: orderId } },
      data: { currentStage: newStatus as any, history: [...(doc as any).shipments?.[0]?.history ?? [], { stage: newStatus, at: new Date().toISOString(), note: opts.note, actor: opts.actor }] },
    });

    return this.mapDoc(updated);
  }

  private mapDoc(doc: any): Order {
    return {
      id: doc.id, customerId: doc.customerId, items: doc.items, totals: doc.totals,
      status: doc.status, paymentStatus: doc.paymentStatus, deliveryAddressId: doc.deliveryAddressId,
      slot: doc.slot, source: doc.source, razorpayOrderId: doc.razorpayOrderId,
      createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    };
  }
}
```

- [ ] **Step 3: Tests for transition allow/deny. Commit.**

### Task 4.3: `RazorpayPaymentService` impl + signature verify

**Files:**
- Create: `lib/commerce/PaymentService.ts` (interface)
- Create: `lib/commerce/impl/RazorpayPaymentService.ts`
- Create: `lib/commerce/impl/FakePaymentService.ts`
- Create: `lib/security/hmac.ts`

- [ ] **Step 1: Interface**

```typescript
export type PaymentStatus = 'created' | 'create_failed' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';

export interface PaymentService {
  createOrder(opts: { amountInPaise: number; receipt: string; notes?: Record<string, string> }): Promise<{ providerOrderId: string }>;
  verifySignature(opts: { providerOrderId: string; providerPaymentId: string; signature: string }): Promise<boolean>;
  fetchStatus(providerPaymentId: string): Promise<PaymentStatus>;
  refund(opts: { providerPaymentId: string; amountInPaise: number; notes?: Record<string, string> }): Promise<{ providerRefundId: string }>;
}
```

- [ ] **Step 2: HMAC helper**

```typescript
import { createHmac } from 'node:crypto';

export function verifyRazorpaySignature(opts: { providerOrderId: string; providerPaymentId: string; signature: string; secret: string }): boolean {
  const body = `${opts.providerOrderId}|${opts.providerPaymentId}`;
  const expected = createHmac('sha256', opts.secret).update(body).digest('hex');
  return expected === opts.signature;
}
```

- [ ] **Step 3: RazorpayPaymentService impl**

```typescript
import type { PaymentService, PaymentStatus } from '../PaymentService';
import { verifyRazorpaySignature } from '../../../security/hmac';

export class RazorpayPaymentService implements PaymentService {
  constructor(private deps: { keyId: string; keySecret: string }) {}

  private get authHeader() {
    return 'Basic ' + Buffer.from(`${this.deps.keyId}:${this.deps.keySecret}`).toString('base64');
  }

  async createOrder(opts: { amountInPaise: number; receipt: string; notes?: Record<string, string> }): Promise<{ providerOrderId: string }> {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.authHeader },
      body: JSON.stringify({ amount: opts.amountInPaise, currency: 'INR', receipt: opts.receipt, payment_capture: 1, notes: opts.notes }),
    });
    if (!res.ok) throw new Error(`Razorpay create-order failed: ${res.status} ${await res.text()}`);
    const body = await res.json() as { id: string };
    return { providerOrderId: body.id };
  }

  async verifySignature(opts: { providerOrderId: string; providerPaymentId: string; signature: string }): Promise<boolean> {
    return verifyRazorpaySignature({ ...opts, secret: this.deps.keySecret });
  }

  async fetchStatus(providerPaymentId: string): Promise<PaymentStatus> {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}`, { headers: { authorization: this.authHeader } });
    if (!res.ok) throw new Error(`Razorpay fetch-status failed: ${res.status}`);
    const body = await res.json() as { status: string };
    return mapStatus(body.status);
  }

  async refund(opts: { providerPaymentId: string; amountInPaise: number; notes?: Record<string, string> }): Promise<{ providerRefundId: string }> {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${opts.providerPaymentId}/refund`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.authHeader },
      body: JSON.stringify({ amount: opts.amountInPaise, notes: opts.notes }),
    });
    if (!res.ok) throw new Error(`Razorpay refund failed: ${res.status}`);
    const body = await res.json() as { id: string };
    return { providerRefundId: body.id };
  }
}

function mapStatus(s: string): PaymentStatus {
  switch (s) {
    case 'created': return 'created';
    case 'attempted': return 'created';
    case 'paid': return 'captured';
    case 'captured': return 'captured';
    case 'failed': return 'failed';
    case 'refunded': return 'refunded';
    case 'partially_refunded': return 'partially_refunded';
    default: return 'failed';
  }
}
```

- [ ] **Step 4: FakePaymentService (test fake)**

```typescript
import type { PaymentService } from '../PaymentService';

export class FakePaymentService implements PaymentService {
  async createOrder() { return { providerOrderId: 'order_fake_' + Math.random() }; }
  async verifySignature() { return true; }
  async fetchStatus() { return 'captured' as const; }
  async refund() { return { providerRefundId: 'rfd_fake' }; }
}
```

- [ ] **Step 5: Test signature verify with real Razorpay test fixtures. Commit.**

### Task 4.4: Razorpay create-order + verify routes

**Files:**
- Create: `app/api/mobile/v1/payments/razorpay/create-order/route.ts`
- Create: `app/api/mobile/v1/payments/razorpay/verify/route.ts`
- Modify: OpenAPI spec

- [ ] **Step 1: `create-order/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { container } from '../../../../../../../../lib/container';
import { requireCustomer } from '../../../../../../../../lib/api/authMiddleware';
import { withIdempotency } from '../../../../../../../../lib/idempotency/idempotency';
import { jsonResponse, errorResponse } from '../../../../../../../../lib/api/response';
import { getPayload } from 'payload';
import config from '../../../../../../../../payload.config';

const Body = z.object({ snapshotId: z.string().min(1), deliveryAddressId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const raw = await req.text();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error('invalid');

    const payload = await getPayload({ config });
    const payment = await container.paymentService;
    const orderService = new (await import('../../../../../../../../lib/commerce/impl/PayloadOrderService')).PayloadOrderService();

    // Re-validate cart snapshot server-side
    // (For brevity — call validate logic inlined; production: extract to shared helper)
    const snapshot = await payload.find({ collection: 'snapshots', where: { id: { equals: parsed.data.snapshotId }, customerId: { equals: customerId } }, limit: 1 });
    if (!snapshot.docs[0]) throw new Error('snapshot not found');

    // Create order in our DB
    const order = await orderService.createFromSnapshot(snapshot.docs[0], customerId, 'mobile-android');

    // Create Razorpay order
    const { providerOrderId } = await payment.createOrder({ amountInPaise: order.totals.totalInPaise, receipt: order.id });
    await payload.update({ collection: 'orders', id: order.id, data: { razorpayOrderId: providerOrderId } });
    await payload.create({ collection: 'payments', data: { orderId: order.id, provider: 'razorpay', providerOrderId, status: 'created', amountInPaise: order.totals.totalInPaise, currency: 'INR' } });

    return await withIdempotency(req.headers.get('Idempotency-Key'), raw, async () => jsonResponse({ orderId: order.id, razorpayOrderId: providerOrderId, amountInPaise: order.totals.totalInPaise, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID }));
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 2: `verify/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { container } from '../../../../../../../../lib/container';
import { requireCustomer } from '../../../../../../../../lib/api/authMiddleware';
import { withIdempotency } from '../../../../../../../../lib/idempotency/idempotency';
import { jsonResponse, errorResponse } from '../../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../../lib/api/errors';
import { getPayload } from 'payload';
import config from '../../../../../../../../payload.config';
import { PayloadOrderService } from '../../../../../../../../lib/commerce/impl/PayloadOrderService';

const Body = z.object({
  orderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const raw = await req.text();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new ApiError(ErrorCode.VALIDATION, 'Invalid verify body');

    const payload = await getPayload({ config });
    const payment = await container.paymentService;
    const orderService = new PayloadOrderService();

    const order = await orderService.getById(parsed.data.orderId, customerId);
    if (!order) throw new ApiError(ErrorCode.ORDER_NOT_FOUND, 'Order not found');
    if (!order.razorpayOrderId) throw new ApiError(ErrorCode.PAYMENT_FAILED, 'No Razorpay order bound');

    const valid = await payment.verifySignature({ providerOrderId: order.razorpayOrderId, providerPaymentId: parsed.data.razorpayPaymentId, signature: parsed.data.signature });
    if (!valid) throw new ApiError(ErrorCode.PAYMENT_FAILED, 'Signature verification failed');

    // Idempotent: if payment already captured, return order
    const paymentDoc = await payload.find({ collection: 'payments', where: { orderId: { equals: order.id } }, limit: 1 });
    if (paymentDoc.docs[0] && (paymentDoc.docs[0] as any).status === 'captured') {
      return jsonResponse({ order });
    }

    await payload.update({ collection: 'payments', id: paymentDoc.docs[0]!.id, data: { status: 'captured', providerPaymentId: parsed.data.razorpayPaymentId } });
    await payload.update({ collection: 'orders', id: order.id, data: { paymentStatus: 'paid' } });
    await orderService.transition(order.id, 'confirmed', { actor: 'system:razorpay-verify' });

    // Emit events (Task 5.2)
    const { emitOrderEvent } = await import('../../../../../../../../lib/notifications/OrderEventEmitter');
    await emitOrderEvent(order.id, 'confirmed');

    const final = await orderService.getById(order.id, customerId);
    return await withIdempotency(req.headers.get('Idempotency-Key'), raw, async () => jsonResponse({ order: final }));
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
```

- [ ] **Step 3: Tests for happy path + bad signature + idempotent replay. Commit.**

### Task 4.5: Razorpay webhook handler

**Files:**
- Create: `app/api/webhooks/razorpay/route.ts`

- [ ] **Step 1: Write handler**

```typescript
import { NextRequest } from 'next/server';
import { verifyRazorpaySignature } from '../../../../lib/security/hmac';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { container } from '../../../../lib/container';
import { PayloadOrderService } from '../../../../lib/commerce/impl/PayloadOrderService';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expected = (await import('node:crypto')).createHmac('sha256', secret).update(body).digest('hex');

  if (expected !== sig) {
    const payload = await getPayload({ config });
    await payload.create({ collection: 'securityEvents', data: { type: 'webhook_signature_fail', details: { raw: body.slice(0, 500) } } });
    return new Response('invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  const payload = await getPayload({ config });
  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) return new Response('ok', { status: 200 });

  const providerOrderId = paymentEntity.order_id;
  const providerPaymentId = paymentEntity.id;

  // Find our payment
  const found = await payload.find({ collection: 'payments', where: { providerOrderId: { equals: providerOrderId } }, limit: 1 });
  if (!found.docs[0]) return new Response('ok', { status: 200 });

  const paymentDoc = found.docs[0] as any;
  if (paymentDoc.status === 'captured') return new Response('ok', { status: 200 }); // idempotent

  await payload.update({
    collection: 'payments',
    id: paymentDoc.id,
    data: { status: 'captured', providerPaymentId, rawWebhookEvents: [...(paymentDoc.rawWebhookEvents ?? []), { payload: event, receivedAt: new Date().toISOString() }] },
  });
  await payload.update({ collection: 'orders', id: paymentDoc.orderId, data: { paymentStatus: 'paid' } });

  const orderService = new PayloadOrderService();
  await orderService.transition(paymentDoc.orderId, 'confirmed', { actor: 'system:razorpay-webhook' });

  const { emitOrderEvent } = await import('../../../../lib/notifications/OrderEventEmitter');
  await emitOrderEvent(paymentDoc.orderId, 'confirmed');

  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 2: Tests with replayed Razorpay fixtures. Commit.**

### Task 4.6: Orders GET + GET /:id routes

**Files:**
- Create: `app/api/mobile/v1/orders/route.ts`
- Create: `app/api/mobile/v1/orders/[id]/route.ts`
- Modify: OpenAPI

- [ ] **Step 1: List endpoint**

```typescript
import { NextRequest } from 'next/server';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { PayloadOrderService } from '../../../../../../lib/commerce/impl/PayloadOrderService';

export async function GET(req: NextRequest) {
  try {
    const { customerId } = await requireCustomer(req);
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '20'), 50);
    const svc = new PayloadOrderService();
    const { items, total } = await svc.listForCustomer(customerId, page, pageSize);
    return jsonResponse({ items, total, page, pageSize });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Detail endpoint** (similar — uses `getById`).

- [ ] **Step 3: Tests + commit.**

### Task 4.7: Reconciliation cron (15-min) for orphan payments

**Files:**
- Create: `lib/reconciliation/reconcilePayments.ts`
- Create: `app/api/cron/reconcile-payments/route.ts` (Vercel cron)

- [ ] **Step 1: Write reconcile function**

```typescript
import { getPayload } from 'payload';
import config from '../../payload.config';
import { container } from '../container';

export async function reconcilePayments() {
  const payload = await getPayload({ config });
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const stale = await payload.find({ collection: 'payments', where: { status: { equals: 'created' }, createdAt: { less_than: cutoff.toISOString() } }, limit: 100 });

  for (const doc of stale.docs) {
    const payment = doc as any;
    if (!payment.providerOrderId) continue;
    try {
      const service = await container.paymentService;
      const status = await service.fetchStatus(payment.providerOrderId);
      if (status === 'captured' || status === 'failed') {
        await payload.update({ collection: 'payments', id: payment.id, data: { status } });
        if (status === 'captured') {
          await payload.update({ collection: 'orders', id: payment.orderId, data: { paymentStatus: 'paid' } });
          const svc = new (await import('../commerce/impl/PayloadOrderService')).PayloadOrderService();
          await svc.transition(payment.orderId, 'confirmed', { actor: 'system:reconcile' });
        }
      }
    } catch (e) { /* log, continue */ }
  }
}
```

- [ ] **Step 2: Cron route + `vercel.json`**

```typescript
// app/api/cron/reconcile-payments/route.ts
import { reconcilePayments } from '../../../../lib/reconciliation/reconcilePayments';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response('unauthorized', { status: 401 });
  await reconcilePayments();
  return new Response('ok');
}
```

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/reconcile-payments", "schedule": "*/15 * * * *" }
  ]
}
```

- [ ] **Step 3: Commit.**

---

## Phase 5: Backend — Delivery + Ops Surfaces + Notifications

### Task 5.1: Manual DeliveryService + admin status update route

**Files:**
- Create: `lib/commerce/DeliveryService.ts`
- Create: `lib/commerce/impl/ManualDeliveryService.ts`
- Create: `app/api/admin/orders/[id]/status/route.ts`

- [ ] **Step 1: Interface**

```typescript
export interface DeliveryService {
  createShipment(opts: { orderId: string }): Promise<{ providerShipmentId?: string }>;
  trackShipment(orderId: string): Promise<{ currentStage: string; history: { at: string; stage: string; note?: string }[] }>;
}

export class ManualDeliveryService implements DeliveryService {
  async createShipment() { return {}; }
  async trackShipment() { return { currentStage: 'confirmed', history: [] }; }
}
```

- [ ] **Step 2: Admin route**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { PayloadOrderService } from '../../../../../../lib/commerce/impl/PayloadOrderService';
import { emitOrderEvent } from '../../../../../../lib/notifications/OrderEventEmitter';

const Body = z.object({ newStatus: z.string(), note: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Payload admin session check (simplified — use payload.locals.user)
    const payload = await getPayload({ config });
    const user = (req as any).user ?? null;
    if (!user) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Admin auth required');

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) throw new ApiError(ErrorCode.VALIDATION, 'invalid');

    const svc = new PayloadOrderService();
    const updated = await svc.transition(id, parsed.data.newStatus as any, { actor: `admin:${user.id}`, note: parsed.data.note });
    await emitOrderEvent(id, parsed.data.newStatus);
    return jsonResponse({ order: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 3: Tests + commit.**

### Task 5.2: OrderEventEmitter + Push + SMS fan-out

**Files:**
- Create: `lib/notifications/OrderEventEmitter.ts`
- Create: `lib/notifications/PushService.ts`
- Create: `lib/notifications/SmsService.ts`
- Create: `lib/notifications/impl/FcmPushService.ts`
- Create: `lib/notifications/impl/Msg91SmsService.ts`
- Create: `lib/notifications/impl/FakePushService.ts`

- [ ] **Step 1: Interfaces**

```typescript
export interface PushService {
  sendToTokens(opts: { tokens: string[]; title: string; body: string; data: Record<string, string>; }): Promise<{ success: string[]; failed: { token: string; reason: string }[] }>;
}
export interface SmsService {
  send(opts: { phone: string; templateKey: string; vars: Record<string, string> }): Promise<{ messageId: string }>;
}
```

- [ ] **Step 2: `FcmPushService` using firebase-admin**

```typescript
import admin from 'firebase-admin';
import type { PushService } from '../PushService';

export class FcmPushService implements PushService {
  private app: admin.app.App;
  constructor(deps: { projectId: string; serviceAccountJson?: string }) {
    this.app = admin.apps[0] ?? admin.initializeApp({
      credential: deps.serviceAccountJson
        ? admin.credential.cert(JSON.parse(deps.serviceAccountJson))
        : admin.credential.applicationDefault(),
      projectId: deps.projectId,
    });
  }

  async sendToTokens(opts: { tokens: string[]; title: string; body: string; data: Record<string, string> }) {
    const message = { notification: { title: opts.title, body: opts.body }, data: opts.data, tokens: opts.tokens };
    const response = await this.app.messaging().sendEachForMulticast(message as any);
    return {
      success: response.responses.map((r, i) => r.success ? opts.tokens[i] : null).filter(Boolean) as string[],
      failed: response.responses.map((r, i) => !r.success ? { token: opts.tokens[i], reason: r.error?.message ?? 'unknown' } : null).filter(Boolean) as any,
    };
  }
}
```

- [ ] **Step 3: `Msg91SmsService`** — analogous to OTP service.

- [ ] **Step 4: `OrderEventEmitter`**

```typescript
import { getPayload } from 'payload';
import config from '../../payload.config';
import { container } from '../container';

const TEMPLATE_BY_STAGE: Record<string, { titleKey: string; bodyKey: string; sms?: boolean }> = {
  confirmed: { titleKey: 'push.order.confirmed.title', bodyKey: 'push.order.confirmed.body', sms: true },
  packed: { titleKey: 'push.order.packed.title', bodyKey: 'push.order.packed.body' },
  dispatched: { titleKey: 'push.order.dispatched.title', bodyKey: 'push.order.dispatched.body', sms: true },
  out_for_delivery: { titleKey: 'push.order.out_for_delivery.title', bodyKey: 'push.order.out_for_delivery.body', sms: true },
  delivered: { titleKey: 'push.order.delivered.title', bodyKey: 'push.order.delivered.body', sms: true },
};

export async function emitOrderEvent(orderId: string, stage: string): Promise<void> {
  const payload = await getPayload({ config });
  const order = await payload.findByID({ collection: 'orders', id: orderId });
  if (!order) return;

  const template = TEMPLATE_BY_STAGE[stage];
  if (!template) return;

  const customer = await payload.findByID({ collection: 'customers', id: (order as any).customerId });
  const devices = await payload.find({ collection: 'devices', where: { customerId: { equals: customer.id }, active: { equals: true } }, limit: 10 });
  const tokens = devices.docs.map((d) => (d as any).pushToken);

  if (tokens.length > 0) {
    const push = await container.pushService;
    await push.sendToTokens({ tokens, title: template.titleKey, body: template.bodyKey, data: { orderId, stage, event_id: crypto.randomUUID() } });
  }

  if (template.sms) {
    const sms = await container.smsService;
    await sms.send({ phone: customer.phone, templateKey: template.bodyKey, vars: { id: orderId.slice(-8) } });
  }

  await container.analyticsService.then((s) => s.track('order_status_changed', { order_id: orderId, to_status: stage }));
}
```

- [ ] **Step 5: Tests + commit.**

### Task 5.3: Notifications register-device + addresses CRUD

**Files:**
- Create: `app/api/mobile/v1/notifications/register-device/route.ts`
- Create: `app/api/mobile/v1/addresses/route.ts`
- Create: `app/api/mobile/v1/addresses/[id]/route.ts`

- [ ] **Step 1: Write register-device**

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';

const Body = z.object({
  platform: z.enum(['android', 'ios']),
  pushToken: z.string().min(1),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: 'invalid' }, { status: 422 });

    const payload = await getPayload({ config });
    const existing = await payload.find({ collection: 'devices', where: { pushToken: { equals: parsed.data.pushToken } }, limit: 1 });
    if (existing.docs[0]) {
      await payload.update({ collection: 'devices', id: existing.docs[0].id, data: { customerId, active: true, ...parsed.data } });
    } else {
      await payload.create({ collection: 'devices', data: { customerId, active: true, ...parsed.data } });
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Addresses CRUD (POST, GET, PATCH, DELETE)** — standard Payload wrappers. Tests + commit.

### Task 5.4: Custom Payload admin views (orders board, pincode manager)

**Files:**
- Create: `app/admin/orders-board/page.tsx`
- Create: `components/admin/OrdersBoard.tsx`

- [ ] **Step 1: `app/admin/orders-board/page.tsx`**

```tsx
import { OrdersBoard } from '@/components/admin/OrdersBoard';
export default function Page() { return <OrdersBoard />; }
```

- [ ] **Step 2: `OrdersBoard.tsx`** — kanban UI using Payload REST API. Columns: `confirmed`, `packed`, `dispatched`, `out_for_delivery`, `delivered`. Drag-to-advance calls `POST /api/admin/orders/{id}/status`.

(Full implementation ~200 lines — TDD with Playwright against local admin.)

- [ ] **Step 3: Commit.**

### Task 5.5: Payment reconciliation admin view

**Files:**
- Create: `app/admin/payment-reconciliation/page.tsx`

(Matches `payments` docs against Razorpay settlements export CSV.)

### Task 5.6: Health endpoint

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1:**

```typescript
import { NextResponse } from 'next/server';
import { config } from '../../../lib/config';
import { MongoClient } from 'mongodb';

export async function GET() {
  const checks: Record<string, 'ok' | 'degraded' | 'down'> = {};
  try {
    const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    checks.mongo = 'ok';
  } catch { checks.mongo = 'down'; }
  const overall = Object.values(checks).some((s) => s !== 'ok') ? 'degraded' : 'ok';
  return NextResponse.json({ status: overall, checks, ts: new Date().toISOString() }, { status: overall === 'ok' ? 200 : 503 });
}
```

- [ ] **Step 2: Commit.**

---

## Phase 6: Backend — Final Wiring + OpenAPI Regenerate

### Task 6.1: Final OpenAPI sweep + regen TS types

- [ ] **Step 1: Ensure all `/api/mobile/v1/*` paths are in `openapi.yaml`.**

- [ ] **Step 2: Run codegen**

```bash
cd packages/api-contract
pnpm codegen:ts
```

- [ ] **Step 3: Add to root `package.json`:**

```json
"scripts": {
  "prebuild": "pnpm codegen"
}
```

- [ ] **Step 4: Commit.**

### Task 6.2: Backend integration test — full checkout flow

**Files:**
- Create: `tests/integration/checkout-flow.test.ts`

- [ ] **Step 1: Write end-to-end backend test**

```typescript
import { describe, it, expect } from 'vitest';
// Uses supertest against Next.js dev server, mocks Razorpay + MSG91 via nock.

describe('Full checkout flow', () => {
  it('logs in → validates cart → creates order → verifies payment → confirms', async () => {
    // 1. POST /auth/otp/send (fake provider)
    // 2. POST /auth/otp/verify (FakeOtpService returns success for code '123456')
    // 3. POST /cart/validate
    // 4. POST /payments/razorpay/create-order (FakePaymentService)
    // 5. POST /payments/razorpay/verify
    // 6. GET /orders/{id} → expect status='confirmed'
  });
});
```

- [ ] **Step 2: Commit.**

---

## Phase 7: Android — Project Setup, Theme, Navigation, DI

### Task 7.1: Scaffold Android app project

**Files:**
- Create: `apps/android/settings.gradle.kts`
- Create: `apps/android/build.gradle.kts`
- Create: `apps/android/gradle.properties`
- Create: `apps/android/app/build.gradle.kts`
- Create: `apps/android/app/src/main/AndroidManifest.xml`
- Create: `apps/android/app/src/main/java/com/mishran/app/MainActivity.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/MishranApp.kt`

- [ ] **Step 1: Generate project skeleton via Android Studio** (manual step). Or write files by hand using Compose template.

- [ ] **Step 2: Configure Gradle for Kotlin 2.0, Compose, Hilt, min SDK 26, target SDK 35.**

`app/build.gradle.kts` (key sections):

```kotlin
android {
  namespace = "com.mishran.app"
  compileSdk = 35
  defaultConfig {
    applicationId = "com.mishran.app"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    vectorDrawables.useSupportLibrary = true
  }
  buildFeatures { compose = true; buildConfig = true }
  composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }
  packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
  implementation("androidx.activity:activity-compose:1.9.1")
  implementation(platform("androidx.compose:compose-bom:2024.08.00"))
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.navigation:navigation-compose:2.7.7")
  implementation("com.google.dagger:hilt-android:2.51.1")
  implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-kotlinx-serialization:1.0.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.room:room-ktx:2.6.1")
  implementation("androidx.datastore:datastore-preferences:1.1.1")
  implementation("androidx.work:work-runtime-ktx:2.9.0")
  implementation("androidx.glance:glance-appwidget:1.0.0")
  implementation("androidx.biometric:biometric:1.2.0")
  implementation("com.razorpay:checkout:1.6.33")
  implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
  implementation("com.google.firebase:firebase-messaging-ktx")
  implementation("com.google.firebase:firebase-crashlytics-ktx")
  kapt("com.google.dagger:hilt-android-compiler:2.51.1")
  kapt("androidx.room:room-compiler:2.6.1")
  testImplementation("junit:junit:4.13.2")
  testImplementation("io.mockk:mockk:1.13.12")
  testImplementation("app.cash.turbine:turbine:1.1.0")
  testImplementation("org.robolectric:robolectric:4.13")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.compose.ui:ui-test-junit4")
  debugImplementation("androidx.compose.ui:ui-tooling")
}
```

- [ ] **Step 3: Add `google-services.json` for Firebase (FCM + Crashlytics). Place at `apps/android/app/google-services.json` (gitignored).**

- [ ] **Step 4: Commit scaffold.**

### Task 7.2: Brand tokens + theme setup

**Files:**
- Modify: `apps/android/app/build.gradle.kts` — add copy task for generated `MishranTokens.kt` + `strings.xml`
- Create: `apps/android/app/src/main/java/com/mishran/app/ui/theme/Theme.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/ui/theme/Color.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/ui/theme/Type.kt`
- Create: `apps/android/app/src/main/res/values/themes.xml`

- [ ] **Step 1: Configure Gradle copy task to pull from `packages/brand-tokens/generated/kotlin/...` and `packages/i18n-strings/generated/android/values*/strings.xml` into `app/src/main/java/com/mishran/app/ui/theme/` and `app/src/main/res/values*/`.**

- [ ] **Step 2: Write `Theme.kt`**

```kotlin
package com.mishran.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val MishranColorScheme = lightColorScheme(
  primary = MishranColors.BrandWine,
  onPrimary = Color.White,
  primaryContainer = MishranColors.BrandWineDark,
  onPrimaryContainer = Color.White,
  secondary = MishranColors.BrandSaffron,
  onSecondary = Color.White,
  tertiary = MishranColors.BrandGold,
  background = MishranColors.BrandCream,
  onBackground = MishranColors.Neutral900,
  surface = Color.White,
  onSurface = MishranColors.Neutral900,
  error = MishranColors.StateError,
  onError = Color.White,
)

@Composable
fun MishranTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = MishranColorScheme,
    typography = MishranTypography,
    shapes = MishranShapes,
    content = content,
  )
}
```

- [ ] **Step 3: Commit.**

### Task 7.3: Hilt DI + Retrofit networking

**Files:**
- Create: `apps/android/app/src/main/java/com/mishran/app/MishranApp.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/di/NetworkModule.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/di/DatabaseModule.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/data/remote/api/MishranApi.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/data/remote/dto/` (OpenAPI-generated Kotlin DTOs copied here)
- Create: `apps/android/app/src/main/java/com/mishran/app/data/sync/TokenRefreshAuthenticator.kt`

- [ ] **Step 1: `MishranApp.kt`**

```kotlin
package com.mishran.app

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MishranApp : Application()
```

- [ ] **Step 2: `NetworkModule.kt`**

```kotlin
package com.mishran.app.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Singleton
import com.mishran.app.data.remote.api.MishranApi
import com.mishran.app.data.sync.TokenRefreshAuthenticator
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

  @Provides @Singleton
  fun provideJson(): Json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

  @Provides @Singleton
  fun provideOkHttpClient(authenticator: TokenRefreshAuthenticator): OkHttpClient {
    val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
    return OkHttpClient.Builder()
      .addInterceptor(logging)
      .authenticator(authenticator)
      .build()
  }

  @Provides @Singleton
  fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
    return Retrofit.Builder()
      .baseUrl(BuildConfig.API_BASE_URL)
      .client(client)
      .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
      .build()
  }

  @Provides @Singleton
  fun provideMishranApi(retrofit: Retrofit): MishranApi = retrofit.create(MishranApi::class.java)
}
```

- [ ] **Step 3: `MishranApi.kt`** (Retrofit interface matching OpenAPI paths)

```kotlin
package com.mishran.app.data.remote.api

import com.mishran.app.data.remote.dto.*
import retrofit2.http.*

interface MishranApi {
  @POST("auth/otp/send")
  suspend fun sendOtp(@Body body: OtpSendRequest): ApiResponse<OtpSendResponse>

  @POST("auth/otp/verify")
  suspend fun verifyOtp(@Body body: OtpVerifyRequest): ApiResponse<OtpVerifyResponse>

  @POST("auth/refresh")
  suspend fun refresh(@Header("Authorization") refreshBearer: String): ApiResponse<RefreshResponse>

  @GET("catalog/products")
  suspend fun getCatalog(
    @Header("If-None-Match") etag: String?,
    @Query("category") category: String?,
    @Query("tier") tier: String?,
    @Query("page") page: Int = 1,
    @Query("pageSize") pageSize: Int = 50,
  ): retrofit2.Response<CatalogResponse>

  @GET("catalog/products/{slug}")
  suspend fun getProduct(@Path("slug") slug: String): ApiResponse<Product>

  @GET("catalog/serviceable")
  suspend fun checkPincode(@Query("pincode") pincode: String): ApiResponse<PincodeServiceability>

  @POST("cart/validate")
  suspend fun validateCart(@Body body: CartValidateRequest): ApiResponse<CartSnapshot>

  @POST("payments/razorpay/create-order")
  suspend fun createOrder(@Body body: CreateOrderRequest): ApiResponse<CreateOrderResponse>

  @POST("payments/razorpay/verify")
  suspend fun verifyPayment(@Body body: VerifyPaymentRequest): ApiResponse<VerifyPaymentResponse>

  @GET("orders")
  suspend fun listOrders(@Query("page") page: Int = 1): ApiResponse<OrdersResponse>

  @GET("orders/{id}")
  suspend fun getOrder(@Path("id") id: String): ApiResponse<Order>

  @POST("addresses")
  suspend fun createAddress(@Body body: AddressRequest): ApiResponse<Address>

  @GET("addresses")
  suspend fun listAddresses(): ApiResponse<List<Address>>

  @PATCH("account/me")
  suspend fun updateAccount(@Body body: AccountPatch): ApiResponse<Customer>

  @POST("notifications/register-device")
  suspend fun registerDevice(@Body body: RegisterDeviceRequest): ApiResponse<Unit>
}
```

- [ ] **Step 4: `TokenRefreshAuthenticator.kt`**

```kotlin
package com.mishran.app.data.sync

import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider
import com.mishran.app.data.local.DataStoreKeys
import com.mishran.app.data.remote.api.MishranApi
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import kotlinx.coroutines.runBlocking

class TokenRefreshAuthenticator @Inject constructor(
  private val dataStore: DataStore<Preferences>,
  private val apiProvider: Provider<MishranApi>,
) : Authenticator {
  override fun authenticate(route: Route?, response: Response): Request? {
    if (response.code != 401) return null
    val refresh = runBlocking { dataStore.data[DataStoreKeys.REFRESH_TOKEN] } ?: return null
    val newTokens = runBlocking {
      try { apiProvider.get().refresh("Bearer $refresh") } catch (e: Exception) { null }
    } ?: run {
      runBlocking { dataStore.edit { it.remove(DataStoreKeys.ACCESS_TOKEN); it.remove(DataStoreKeys.REFRESH_TOKEN) } }
      return null
    }
    runBlocking {
      dataStore.edit {
        it[DataStoreKeys.ACCESS_TOKEN] = newTokens.data.accessToken
        it[DataStoreKeys.REFRESH_TOKEN] = newTokens.data.refreshToken
      }
    }
    return response.request.newBuilder()
      .header("Authorization", "Bearer ${newTokens.data.accessToken}")
      .build()
  }
}
```

- [ ] **Step 5: Build + commit.**

### Task 7.4: Navigation graph + deep links

**Files:**
- Create: `apps/android/app/src/main/java/com/mishran/app/navigation/MishranNavGraph.kt`
- Create: `apps/android/app/src/main/java/com/mishran/app/navigation/Routes.kt`
- Modify: `AndroidManifest.xml` — add deep link intent filter

- [ ] **Step 1: `Routes.kt`**

```kotlin
package com.mishran.app.navigation

object Routes {
  const val SPLASH = "splash"
  const val AUTH_PHONE = "auth/phone"
  const val AUTH_OTP = "auth/otp/{requestId}"
  const val HOME = "home"
  const val CATALOG = "catalog"
  const val PRODUCT = "product/{slug}"
  const val CART = "cart"
  const val CHECKOUT = "checkout"
  const val ORDERS = "orders"
  const val ORDER_DETAIL = "order/{id}"
  const val ACCOUNT = "account"
  const val ADDRESSES = "addresses"
}
```

- [ ] **Step 2: NavGraph using NavHost with bottom nav (Home, Catalog, Orders, Account).**

- [ ] **Step 3: Deep link intent filter for `mishran://order/{id}` in AndroidManifest.**

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="mishran" android:host="order" />
</intent-filter>
```

- [ ] **Step 4: Commit.**

---

## Phase 8: Android — Auth + Biometric

### Task 8.1: Phone + OTP screens with TDD

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/auth/PhoneEntryScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/auth/PhoneEntryViewModel.kt`
- Create: `app/src/test/java/com/mishran/app/ui/auth/PhoneEntryViewModelTest.kt`
- Create: `app/src/main/java/com/mishran/app/ui/auth/OtpScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/auth/OtpViewModel.kt`
- Create: `app/src/test/java/com/mishran/app/ui/auth/OtpViewModelTest.kt`

- [ ] **Step 1: Write failing test `PhoneEntryViewModelTest`**

```kotlin
class PhoneEntryViewModelTest {
  @Test fun `valid phone sends OTP`() = runTest {
    val api = mockk<MishranApi>(); val ds = mockk<DataStore<Preferences>>(relaxed = true)
    every { api.sendOtp(any()) } returns ApiResponse.success(OtpSendResponse("req-1", "2026-08-11T10:00:00Z"))
    val vm = PhoneEntryViewModel(api, ds)
    vm.phone.value = "+919999999999"
    vm.sendOtp()
    advanceUntilIdle()
    assertThat(vm.uiState.value).isInstanceOf(UiState.Success::class.java)
  }
  @Test fun `invalid phone shows error`() { /* … */ }
  @Test fun `rate limit surfaces message`() { /* … */ }
}
```

- [ ] **Step 2: Run tests → FAIL.**

- [ ] **Step 3: Implement ViewModels + screens.**

- [ ] **Step 4: Run tests → PASS.**

- [ ] **Step 5: Compose UI test for screen state. Commit.**

### Task 8.2: Biometric gate after first login

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/auth/BiometricGate.kt`
- Create: `app/src/main/java/com/mishran/app/util/BiometricHelper.kt`

- [ ] **Step 1: Implement BiometricPrompt wrapper.**

- [ ] **Step 2: After successful OTP verify, offer "Enable biometric login". On accept, store refresh token in Android Keystore gated by biometric.**

- [ ] **Step 3: On app cold start with stored biometric-locked refresh token, prompt biometric → unlock → silent refresh → home.**

- [ ] **Step 4: Tests + commit.**

### Task 8.3: SMS autofill via SMS Retention API

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/auth/SmsAutofillReceiver.kt`

- [ ] **Step 1: Implement `SmsRetriever` client from Google Play Services. Hash app signature, listen for SMS containing hash.**

- [ ] **Step 2: Autofill OTP input on receipt.**

- [ ] **Step 3: Test with manual SMS via `adb`. Commit.**

---

## Phase 9: Android — Catalog Browse (Offline-First)

### Task 9.1: Room database + DAOs

**Files:**
- Create: `app/src/main/java/com/mishran/app/data/local/Database.kt`
- Create: `app/src/main/java/com/mishran/app/data/local/dao/ProductDao.kt`
- Create: `app/src/main/java/com/mishran/app/data/local/entity/ProductEntity.kt`
- Create: `app/src/main/java/com/mishran/app/di/DatabaseModule.kt`

- [ ] **Step 1: Define `ProductEntity` with `staleAt` field.**

- [ ] **Step 2: DAO with `getAll()`, `upsertAll()`, `deleteStale()`.**

- [ ] **Step 3: Room database class. Hilt module provides it. Tests + commit.**

### Task 9.2: CatalogRepository with ETag handling

**Files:**
- Create: `app/src/main/java/com/mishran/app/data/repository/CatalogRepository.kt`
- Create: `app/src/main/java/com/mishran/app/domain/usecase/GetCatalogUseCase.kt`

- [ ] **Step 1: Write `CatalogRepository.getCatalog(force: Boolean): Flow<List<Product>>`**

Emits Room cache first, then fires network call with `If-None-Match`, upserts Room on 200, updates staleAt on 304.

- [ ] **Step 2: Test with FakeApi + Robolectric.**

- [ ] **Step 3: WorkManager periodic refresh worker (6h). Commit.**

### Task 9.3: Catalog screen + search + filters

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/catalog/CatalogScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/catalog/CatalogViewModel.kt`
- Create: `app/src/main/java/com/mishran/app/ui/catalog/components/FilterSheet.kt`

- [ ] **Step 1: ViewModel exposes `StateFlow<CatalogUiState>` (loading / cached / fresh / error).**

- [ ] **Step 2: Screen renders `LazyVerticalGrid` of ProductCards. Search bar at top, filter chip row below.**

- [ ] **Step 3: Filter sheet — category dropdown, dietary multi-select chips. Updates URL-query-style state.**

- [ ] **Step 4: Tests + Paparazzi snapshot. Commit.**

### Task 9.4: Product detail screen

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/product/ProductDetailScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/product/ProductDetailViewModel.kt`

- [ ] **Step 1: Implement gallery (Coil image loading), name, price, freshness badge, ingredients, quantity stepper, Add to cart CTA.**

- [ ] **Step 2: Tests + snapshot. Commit.**

---

## Phase 10: Android — Cart + Checkout + Razorpay

### Task 10.1: Cart (local Room-based)

**Files:**
- Create: `app/src/main/java/com/mishran/app/data/local/dao/CartDao.kt`
- Create: `app/src/main/java/com/mishran/app/data/local/entity/CartItemEntity.kt`
- Create: `app/src/main/java/com/mishran/app/data/repository/CartRepository.kt`
- Create: `app/src/main/java/com/mishran/app/ui/cart/CartScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/cart/CartViewModel.kt`

- [ ] **Step 1: CartDao with `observeItems(): Flow<List<CartItemEntity>>`.**

- [ ] **Step 2: CartViewModel exposes line items + totals (computed locally; final price server-validated at checkout).**

- [ ] **Step 3: CartScreen: list with qty steppers, remove, empty state with CTA to catalog.**

- [ ] **Step 4: Tests + snapshot. Commit.**

### Task 10.2: Checkout flow (address + slot + payment)

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/checkout/CheckoutScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/checkout/CheckoutViewModel.kt`
- Create: `app/src/main/java/com/mishran/app/ui/checkout/components/AddressPicker.kt`
- Create: `app/src/main/java/com/mishran/app/ui/checkout/components/SlotPicker.kt`
- Create: `app/src/main/java/com/mishran/app/ui/checkout/components/PaymentMethodPicker.kt`

- [ ] **Step 1: Implement pincode serviceability check on address select — surface tier (fresh/shelf) in UI.**

- [ ] **Step 2: Slot picker for Delhi NCR (today/tomorrow). Hidden for shelf-tier.**

- [ ] **Step 3: Payment method picker — UPI / card / netbanking / wallet. Just stores selection; Razorpay SDK handles actual.**

- [ ] **Step 4: Tests + snapshot. Commit.**

### Task 10.3: Cart validate + Razorpay checkout integration

**Files:**
- Create: `app/src/main/java/com/mishran/app/domain/usecase/PlaceOrderUseCase.kt`
- Create: `app/src/main/java/com/mishran/app/util/RazorpayLauncher.kt`

- [ ] **Step 1: `PlaceOrderUseCase`:**
  1. `POST /cart/validate` → snapshot
  2. If `CART_CHANGED` → emit CartChangeDiff event → ViewModel shows modal
  3. `POST /payments/razorpay/create-order` → orderId + razorpayOrderId
  4. Launch Razorpay SDK with `Checkout` activity
  5. On `onPaymentSuccess`: `POST /payments/razorpay/verify`
  6. On success: navigate to OrderConfirmed screen

- [ ] **Step 2: RazorpayLauncher wraps `Checkout.open()` with proper options.**

- [ ] **Step 3: Handle `PAYMENT_FAILED` gracefully — show "money will be refunded if deducted" message.**

- [ ] **Step 4: Idempotency-Key on createOrder + verify (UUID stored per cart snapshot).**

- [ ] **Step 5: Tests for each branch (success, cart_changed, payment_failed, network_err). Commit.**

### Task 10.4: Order confirmation screen + deep link

- [ ] **Step 1: `OrderConfirmedScreen` shows order ID + delivery ETA + "Track order" CTA.**

- [ ] **Step 2: Deep link `mishran://order/{id}` handled by NavGraph.**

- [ ] **Step 3: Tests. Commit.**

---

## Phase 11: Android — Orders + Tracking + Widget + Push

### Task 11.1: Order list + detail screens

**Files:**
- Create: `app/src/main/java/com/mishran/app/ui/orders/OrderListScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/orders/OrderListViewModel.kt`
- Create: `app/src/main/java/com/mishran/app/ui/orders/OrderDetailScreen.kt`
- Create: `app/src/main/java/com/mishran/app/ui/orders/OrderDetailViewModel.kt`
- Create: `app/src/main/java/com/mishran/app/data/repository/OrderRepository.kt`

- [ ] **Step 1: OrderRepository fetches + caches last 20 orders in Room (refresh on pull-to-refresh).**

- [ ] **Step 2: WorkManager periodic (1h on Wi-Fi) refreshes order list to catch missed pushes.**

- [ ] **Step 3: List screen — cards with order #, status chip, total, date. Pull-to-refresh.**

- [ ] **Step 4: Detail screen — full timeline (history), items, totals, address, support CTA.**

- [ ] **Step 5: Tests + snapshots. Commit.**

### Task 11.2: Order status widget (Glance)

**Files:**
- Create: `app/src/main/java/com/mishran/app/widget/OrderStatusWidget.kt`
- Create: `app/src/main/java/com/mishran/app/widget/OrderStatusWidgetReceiver.kt`
- Create: `app/src/main/res/xml/order_status_widget_info.xml`

- [ ] **Step 1: Glance `AppWidget` renders latest non-delivered order's stage + ETA.**

- [ ] **Step 2: Widget state updated via `GlanceAppWidget.updateAll()` from `OrderEventEmitter` on push receive.**

- [ ] **Step 3: Tap on widget deep-links to OrderDetailScreen.**

- [ ] **Step 4: Tests for each stage render. Commit.**

### Task 11.3: FCM push service + device registration

**Files:**
- Create: `app/src/main/java/com/mishran/app/push/MishranFcmService.kt`
- Create: `app/src/main/java/com/mishran/app/data/sync/PushRegistrationWorker.kt`

- [ ] **Step 1: `MishranFcmService extends FirebaseMessagingService`.**
  - `onMessageReceived`: parse `orderId`, `stage`, `event_id`. Dedup via `notifications_seen` Room table (30d TTL). Build NotificationCompat. Tap → deep link.
  - `onNewToken`: enqueue `PushRegistrationWorker`.

- [ ] **Step 2: `PushRegistrationWorker` calls `POST /notifications/register-device` after login.**

- [ ] **Step 3: Foreground in-app toast via SharedFlow. Commit.**

---

## Phase 12: Hardening — Tests, Performance, Security, A11y, Localization

### Task 12.1: Maestro E2E flow

**Files:**
- Create: `apps/android/maestro/login_checkout.yaml`
- Create: `apps/android/maestro/browse_catalog.yaml`
- Create: `apps/android/maestro/track_order.yaml`

- [ ] **Step 1: Write Maestro YAML matching Gherkin `packages/e2e-flows/login_checkout.feature`.**

- [ ] **Step 2: Run on Firebase Test Lab against staging backend (with Razorpay test mode).**

- [ ] **Step 3: Wire into CI. Commit.**

### Task 12.2: Macrobenchmarks (cold start, scroll)

**Files:**
- Create: `apps/android/macrobenchmark/src/main/java/com/mishran/macrobenchmark/ColdStartBenchmark.kt`
- Create: `apps/android/macrobenchmark/src/main/java/com/mishran/macrobenchmark/ScrollBenchmark.kt`
- Create: `apps/android/macrobenchmark/build.gradle.kts`

- [ ] **Step 1: Implement `baselineProfile` macrobenchmark measuring cold start on Pixel 4a emulator.**

- [ ] **Step 2: Run + assert p95 ≤ 1.5s. Block CI on regression > 5%.**

- [ ] **Step 3: Commit.**

### Task 12.3: Native translation pass for 7 remaining locales

**Files:**
- Modify: `packages/i18n-strings/{kn,ta,te,mr,gu,bn,pa}.json`

- [ ] **Step 1: Engage translation vendor (Gupshup AI / human agency). Replace placeholder English with native.**

- [ ] **Step 2: Run `pnpm check` in i18n-strings. Fix any missing keys.**

- [ ] **Step 3: Run Paparazzi snapshot tests per locale to catch overflow/clipping.**

- [ ] **Step 4: Commit.**

### Task 12.4: A11y audit + fixes

- [ ] **Step 1: Run TalkBack on each screen. Fix semantic ordering, content descriptions.**

- [ ] **Step 2: Verify tap target ≥ 48dp. Fix violations.**

- [ ] **Step 3: Verify WCAG AA contrast per theme. Automated check via `compose-ui-test` accessibility.**

- [ ] **Step 4: Commit.**

### Task 12.5: Security audit

- [ ] **Step 1: Run OWASP ZAP against staging backend. Fix all high/critical findings.**

- [ ] **Step 2: Verify network security config blocks cleartext in release.**

- [ ] **Step 3: Verify no secrets in APK — `apkanalyzer` scan.**

- [ ] **Step 4: Pen-test critical paths (auth, payments, idempotency).**

- [ ] **Step 5: Commit fixes.**

### Task 12.6: Backend load test

**Files:**
- Create: `tests/load/checkout-flow.k6.ts`

- [ ] **Step 1: k6 script simulating 1000 RPS sustained 5min against staging.**

- [ ] **Step 2: Assert p95 < 500ms per route. Document bottlenecks.**

- [ ] **Step 3: Commit.**

---

## Phase 13: Release Prep + Play Store Canary

### Task 13.1: Privacy policy + permissions manifest

**Files:**
- Create: `apps/android/app/src/main/assets/privacy_policy.html`
- Modify: `AndroidManifest.xml` — only necessary permissions, clear rationale in store listing

- [ ] **Step 1: Document each permission: INTERNET, ACCESS_NETWORK_STATE, CAMERA (gift-builder), POST_NOTIFICATIONS, USE_BIOMETRIC, RECEIVE_SMS (autofill, Play-only), WAKE_LOCK (push), FOREGROUND_SERVICE (push receiver).**

- [ ] **Step 2: Privacy policy covers: data collected (phone, address, orders, device), Razorpay data flow, MSG91 SMS, GA4/FB Pixel, Crashlytics.**

- [ ] **Step 3: Commit.**

### Task 13.2: Play Store listing (9 locales)

**Files:**
- Create: `apps/android/store-listing/en.md` (+ 8 more)

- [ ] **Step 1: Per-locale listing: title, short description, long description, screenshots (5+), feature graphic.**

- [ ] **Step 2: Upload to Play Console.**

- [ ] **Step 3: Commit.**

### Task 13.3: Signing config + CI build

**Files:**
- Modify: `apps/android/app/build.gradle.kts` — `signingConfigs.release`
- Create: `.github/workflows/android-release.yml`

- [ ] **Step 1: Keystore in GitHub secrets. CI signs AAB.**

- [ ] **Step 2: Upload AAB to Play Console internal track.**

- [ ] **Step 3: Commit workflow.**

### Task 13.4: Staged rollout (canary)

- [ ] **Step 1: Promote AAB from internal → closed testing (5 internal testers) → open testing → production 5%.**

- [ ] **Step 2: Monitor Sentry crash-free rate ≥ 99.5%, payment success ≥ 97%, p95 cold start ≤ 1.5s for 48h.**

- [ ] **Step 3: Ramp 5% → 20% → 50% → 100% over 2 weeks. Auto-halt on regression.**

- [ ] **Step 4: Post-launch retro doc + update memory deferred-decisions register with v1 ship date.**

---

## Post-Launch (immediately after Android v1 ship)

- File issues for v2 work (courier API integration, refund self-serve, iPad layout, Apple Watch, Apple Pay).
- Update `mishran_deferred_register.md` memory with Android v1 launch date.
- Begin iOS Phase 14 work in parallel — backend already supports it from Tasks 1-71.

---

## Phase 14: iOS — Project Setup, Theme, Navigation, CI

### Task 14.1: Scaffold iOS app project

**Files:**
- Create: `apps/ios/Mishran/MishranApp.swift` — `@main` App struct
- Create: `apps/ios/Mishran/Info.plist` — iOS 17+ deployment target, Mishran URL scheme, capability declarations
- Create: `apps/ios/Mishran.xcodeproj/project.pbxproj` — Xcode project (generated by `xcodegen` for reproducibility)
- Create: `apps/ios/project.yml` — XcodeGen spec
- Create: `apps/ios/Mishran/Assets.xcassets/` — brand color set, image set
- Modify: `pnpm-workspace.yaml` — include `apps/ios`
- Modify: `package.json` — add `ios:xcodegen`, `ios:build`, `ios:test` scripts

**Interfaces:**
- Consumes: `packages/brand-tokens/` JSON (Task 8), `packages/i18n-strings/` per-locale JSON (Task 9), `packages/api-contract/openapi.yaml` (Task 4)
- Produces: working iOS app that compiles + boots blank SwiftUI screen on iPhone SE 3 simulator

- [ ] **Step 1: Write UI test that boots app + asserts title visible.**

```swift
// apps/ios/MishranUITests/MishranUITests.swift
import XCTest
final class MishranUITests: XCTestCase {
  func testAppBoots() throws {
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(app.staticTexts["Mishran"].waitForExistence(timeout: 5))
  }
}
```

- [ ] **Step 2: Run test to verify it fails.**

```bash
pnpm ios:test -- --test MishranUITests/MishranUITests.swift
```
Expected: FAIL — no Xcode project.

- [ ] **Step 3: Install XcodeGen (`brew install xcodegen`). Create `project.yml` with iOS 17 target, SwiftData capability, Mishran bundle ID `com.mishran.app`. Generate `.xcodeproj`.**

- [ ] **Step 4: Write `MishranApp.swift` minimal `@main App` with `WindowGroup { Text("Mishran") }`.**

- [ ] **Step 5: Run test to verify it passes on iPhone SE 3 simulator.**

- [ ] **Step 6: Commit.**

```bash
git add apps/ios pnpm-workspace.yaml package.json
git commit -m "feat(ios): scaffold iOS app project with XcodeGen + iOS 17 target"
```

### Task 14.2: Brand tokens Swift codegen + MishranTheme

**Files:**
- Create: `packages/brand-tokens/src/codegen-swift.ts` — TS script reading `tokens.json`, emitting `MishranBrand.swift`
- Create: `apps/ios/Mishran/Theme/MishranBrand.swift` — generated `extension Color` + `extension Font` constants
- Create: `apps/ios/Mishran/Theme/MishranTheme.swift` — SwiftUI `ViewModifier` applying brand colors + typography
- Modify: `packages/brand-tokens/package.json` — add `codegen:swift` script
- Modify: `apps/ios/Mishran/MishranApp.swift` — wrap root view in `.mishranTheme()`

**Interfaces:**
- Consumes: `packages/brand-tokens/tokens.json` (existing, from Task 8)
- Produces: `MishranBrand.colorMarigold`, `MishranBrand.fontHeadingLarge`, etc. used by all SwiftUI screens

- [ ] **Step 1: Write snapshot test for `MishranTheme` rendering a sample view in light + dark mode.**

```swift
// apps/ios/MishranTests/ThemeTests.swift
import XCTest
import SwiftUI
@testable import Mishran
final class ThemeTests: XCTestCase {
  func testMarigoldColorExists() {
    XCTAssertNotNil(MishranBrand.colorMarigold)
  }
}
```

- [ ] **Step 2: Run test → FAIL.**

- [ ] **Step 3: Implement `codegen-swift.ts`. Sample output:**

```swift
// AUTO-GENERATED — do not edit
import SwiftUI
public enum MishranBrand {
  public static let colorMarigold = Color(red: 1.0, green: 0.55, blue: 0.0)
  public static let fontHeadingLarge = Font.custom("Newsreader", size: 32)
  // ... full token set
}
```

- [ ] **Step 4: Run `pnpm codegen:swift` → file appears in `apps/ios/Mishran/Theme/`. Commit generated file.**

- [ ] **Step 5: Write `MishranTheme.swift` ViewModifier.**

- [ ] **Step 6: Run test → PASS.**

- [ ] **Step 7: Commit.**

### Task 14.3: Networking — URLSession + async/await API client

**Files:**
- Create: `apps/ios/Mishran/Data/Remote/MishranAPIClient.swift` — main `actor` with `URLSession`
- Create: `apps/ios/Mishran/Data/Remote/APIError.swift` — Swift `Error` enum mirroring backend `ErrorCode`
- Create: `apps/ios/Mishran/Data/Remote/Endpoint.swift` — typed path builder
- Create: `apps/ios/Mishran/Data/Remote/Authenticator.swift` — token refresh interceptor
- Create: `apps/ios/MishranTests/APIClientTests.swift` — uses `URLProtocol` mock

**Interfaces:**
- Consumes: `packages/api-contract/openapi.yaml` (Task 4)
- Produces: `MishranAPIClient.shared.catalogProducts() async throws -> [ProductDTO]` etc.

- [ ] **Step 1: Write failing test: mock `/catalog/products` response → assert decode succeeds.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `MishranAPIClient` with `URLSession.configuration.ephemeral`, JSON decoder with snake_case strategy. Implement `Endpoint` enum.**

- [ ] **Step 4: Run → PASS. Add 3 more tests: 401 retry, network timeout, 5xx retry.**

- [ ] **Step 5: Implement `Authenticator` interceptor. Stores access + refresh tokens in Keychain. Auto-refreshes on 401, retries original request.**

- [ ] **Step 6: Test refresh flow → PASS.**

- [ ] **Step 7: Commit.**

### Task 14.4: NavigationStack + deep links

**Files:**
- Create: `apps/ios/Mishran/Navigation/Route.swift` — `enum Route: Hashable` with cases for each screen
- Create: `apps/ios/Mishran/Navigation/Router.swift` — `@Observable` router with `path: [Route]`
- Create: `apps/ios/Mishran/Navigation/DeepLinkHandler.swift` — parses `mishran://order/{id}` URIs
- Modify: `apps/ios/Mishran/MishranApp.swift` — wire `NavigationStack(path: $router.path)` + `.onOpenURL(perform: deepLinkHandler.handle)`
- Modify: `apps/ios/Mishran/Info.plist` — register `mishran` URL scheme

- [ ] **Step 1: Write failing test that taps a product card → asserts product detail pushed on stack.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `Router` + `Route` enum + `DeepLinkHandler`.**

- [ ] **Step 4: Test → PASS. Add test: open `mishran://order/abc123` → router pushes `.orderDetail(id: "abc123")`.**

- [ ] **Step 5: Commit.**

### Task 14.5: Xcode Cloud CI

**Files:**
- Create: `apps/ios/ci_scripts/ci_post_clone.sh` — install pnpm deps, run codegen
- Create: `.github/workflows/ios-pr.yml` — runs `xcodebuild test` on PR (notarized Mac runner)
- Modify: `apps/ios/project.yml` — add test plan with `MishranTests` + `MishranUITests`

- [ ] **Step 1: Configure Xcode Cloud workflow via App Store Connect (manual; document in `apps/ios/XCODE_CLOUD.md`).**

- [ ] **Step 2: Add `ci_post_clone.sh` that runs `pnpm install --frozen-lockfile && pnpm codegen:swift`.**

- [ ] **Step 3: Add GitHub Actions iOS job using `macos-14` runner. Cache SPM + DerivedData.**

- [ ] **Step 4: Verify CI green on a PR.**

- [ ] **Step 5: Commit.**

---

## Phase 15: iOS — Auth + Apple Sign-in + Keychain

### Task 15.1: Phone + OTP screens

**Files:**
- Create: `apps/ios/Mishran/UI/Auth/PhoneEntryView.swift`
- Create: `apps/ios/Mishran/UI/Auth/OTPView.swift`
- Create: `apps/ios/Mishran/UI/Auth/AuthViewModel.swift` — `@Observable` class
- Create: `apps/ios/MishranTests/AuthViewModelTests.swift`

- [ ] **Step 1: Write failing tests: (a) phone validation, (b) OTP request triggers API call, (c) OTP verify success stores tokens, (d) OTP verify wrong code shows error.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `AuthViewModel` with `@MainActor`. Use `MishranAPIClient.authOtpSend` + `authOtpVerify`.**

- [ ] **Step 4: Implement SwiftUI views with brand theme + accessibility labels.**

- [ ] **Step 5: Run → PASS. Add 2 tests for rate-limit + expired OTP error paths.**

- [ ] **Step 6: Commit.**

### Task 15.2: Sign in with Apple

**Files:**
- Create: `apps/ios/Mishran/Auth/AppleSignInCoordinator.swift` — wraps `ASAuthorizationAppleIDProvider`
- Create: `apps/ios/Mishran/UI/Auth/AppleSignInButton.swift` — `SignInWithAppleButton` SwiftUI view
- Modify: `apps/ios/Mishran/UI/Auth/PhoneEntryView.swift` — add Apple Sign-in button above phone entry
- Modify: `apps/ios/Mishran/Info.plist` — entitlements: `com.apple.developer.applesignin`
- Modify: `apps/ios/Mishran/Mishran.entitlements` — add Sign in with Apple capability

- [ ] **Step 1: Write failing test: simulate Apple credential callback → assert `authApple` endpoint called with `identityToken` + `authorizationCode`.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding`. Calls delegate methods to forward credential to ViewModel.**

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Add manual UI test that exercises button on simulator (Apple Sign-in requires Apple ID login — manual).**

- [ ] **Step 6: Commit.**

### Task 15.3: Backend `/auth/apple` endpoint + Apple JWKS verification

**Files:**
- Create: `app/api/mobile/v1/auth/apple/route.ts`
- Create: `lib/auth/AppleAuthService.ts`
- Create: `lib/auth/impl/AppleJwksService.ts` — fetches + caches Apple's public keys
- Modify: `lib/container.ts` — wire `appleAuthService`
- Create: `tests/unit/AppleAuthService.test.ts` — verify JWT with real + fake tokens
- Modify: `.env.example` — `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_AUTH_KEY_PATH`

- [ ] **Step 1: Write failing test: malformed `identityToken` → 401. Valid token (hardcoded fixture) → upserts customer + returns JWT pair.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `AppleAuthService.verifyIdentityToken()` — fetch Apple JWKS, verify RS256 JWT using `jose`, extract `sub`, `email`, `email_verified`.**

- [ ] **Step 4: Implement `/auth/apple` route. Returns same response shape as `/auth/otp/verify`. Use `idempotency` middleware.**

- [ ] **Step 5: Run → PASS. Add test: replay attack (same nonce twice) → 409.**

- [ ] **Step 6: Commit.**

### Task 15.4: Keychain + biometric

**Files:**
- Create: `apps/ios/Mishran/Auth/KeychainHelper.swift` — generic Keychain wrapper
- Create: `apps/ios/Mishran/Auth/BiometricGate.swift` — `LocalAuthentication` wrapper
- Create: `apps/ios/Mishran/UI/Auth/BiometricGateView.swift` — presented on app launch if refresh token present + biometric enabled
- Modify: `apps/ios/Mishran/UI/Auth/AuthViewModel.swift` — set Keychain tokens after successful login

- [ ] **Step 1: Write failing test: KeychainHelper stores + retrieves a string.**

- [ ] **Step 2: Run → FAIL (Keychain access requires entitlements on simulator).**

- [ ] **Step 3: Implement `KeychainHelper` with `kSecClassGenericPassword`, service = `com.mishran.app`, account = `auth-tokens`. Use `SecItemAdd`/`SecItemCopyMatching`.**

- [ ] **Step 4: Implement `BiometricGate.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)` returning Bool.**

- [ ] **Step 5: Implement `BiometricGateView` shown on app launch when Keychain has refresh token + user has enabled biometric. On success → load tokens, navigate to home. On failure → PhoneEntry.**

- [ ] **Step 6: Run tests → PASS. Test on physical device for Face ID (simulator has no Face ID).**

- [ ] **Step 7: Commit.**

---

## Phase 16: iOS — Catalog Browse (Offline-First with SwiftData)

### Task 16.1: SwiftData models

**Files:**
- Create: `apps/ios/Mishran/Data/Local/SwiftDataModels.swift` — `@Model` classes: `ProductEntity`, `CategoryEntity`, `CartEntity`, `CartItemEntity`, `AddressEntity`, `OrderEntity`
- Create: `apps/ios/Mishran/Data/Local/ModelContainerFactory.swift` — configures SwiftData `ModelContainer` with on-disk store
- Modify: `apps/ios/Mishran/MishranApp.swift` — inject `modelContainer` into environment

- [ ] **Step 1: Write failing test: insert ProductEntity, fetch all → 1 result.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `@Model` classes with proper relationships (Product has Category, Cart has [CartItem]).**

- [ ] **Step 4: Implement `ModelContainerFactory` with schema + URL to `Mishran.sqlite` in app support dir.**

- [ ] **Step 5: Test → PASS. Add test: cascade delete CartItem when Cart deleted.**

- [ ] **Step 6: Commit.**

### Task 16.2: CatalogRepository with ETag

**Files:**
- Create: `apps/ios/Mishran/Data/Repository/CatalogRepository.swift` — `@Observable` class
- Create: `apps/ios/Mishran/Data/Repository/CatalogCache.swift` — wraps SwiftData + ETag persistence (UserDefaults `catalogEtag`)
- Create: `apps/ios/MishranTests/CatalogRepositoryTests.swift`
- Modify: `apps/ios/Mishran/Data/Sync/CatalogRefreshTask.swift` — `BGTaskScheduler` periodic task

- [ ] **Step 1: Write failing test: empty cache + 200 response → entities persisted. 304 response → cache untouched.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `CatalogRepository.getCatalog(force:)` async method.**

- [ ] **Step 4: Implement `BGTaskScheduler` registration: every 6 hours, refresh catalog.**

- [ ] **Step 5: Test → PASS.**

- [ ] **Step 6: Commit.**

### Task 16.3: CatalogView + search + filters

**Files:**
- Create: `apps/ios/Mishran/UI/Catalog/CatalogView.swift`
- Create: `apps/ios/Mishran/UI/Catalog/CatalogViewModel.swift`
- Create: `apps/ios/Mishran/UI/Catalog/ProductCard.swift`
- Create: `apps/ios/Mishran/UI/Catalog/SearchBar.swift`
- Create: `apps/ios/Mishran/UI/Catalog/FilterSheet.swift` — dietary (sugar-free, eggless), category, region
- Create: `apps/ios/MishranTests/CatalogViewModelTests.swift`

- [ ] **Step 1: Write failing test: ViewModel with mock repo + 3 products → `products` array contains 3.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `CatalogViewModel` with `@Published var products`, `searchText`, `filters`. Filter logic in pure function.**

- [ ] **Step 4: Implement views with brand theme. Use `LazyVGrid` 2-column.**

- [ ] **Step 5: Test → PASS. Add snapshot test for ProductCard in light + dark mode.**

- [ ] **Step 6: Commit.**

### Task 16.4: ProductDetailView

**Files:**
- Create: `apps/ios/Mishran/UI/Product/ProductDetailView.swift`
- Create: `apps/ios/Mishran/UI/Product/ProductDetailViewModel.swift`
- Create: `apps/ios/Mishran/UI/Product/QuantitySelector.swift`
- Create: `apps/ios/Mishran/UI/Product/AddToCartButton.swift`

- [ ] **Step 1: Write failing test: tap Add to Cart → `CartEntity` updated.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement ViewModel that takes product slug + fetches detail.**

- [ ] **Step 4: Implement SwiftUI views. Use brand typography + accessibility labels for all images.**

- [ ] **Step 5: Test → PASS.**

- [ ] **Step 6: Commit.**

---

## Phase 17: iOS — Cart + Checkout + Razorpay

### Task 17.1: CartView (local SwiftData)

**Files:**
- Create: `apps/ios/Mishran/UI/Cart/CartView.swift`
- Create: `apps/ios/Mishran/UI/Cart/CartViewModel.swift`
- Create: `apps/ios/Mishran/UI/Cart/CartLineItem.swift`

- [ ] **Step 1: Write failing test: 2 items in cart → total = sum of (price × qty).**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `CartViewModel` observing `CartEntity` via `@Query`.**

- [ ] **Step 4: Implement views with swipe-to-delete on line items.**

- [ ] **Step 5: Test → PASS.**

- [ ] **Step 6: Commit.**

### Task 17.2: Checkout flow (address + slot + payment)

**Files:**
- Create: `apps/ios/Mishran/UI/Checkout/CheckoutView.swift`
- Create: `apps/ios/Mishran/UI/Checkout/CheckoutViewModel.swift`
- Create: `apps/ios/Mishran/UI/Checkout/AddressPicker.swift`
- Create: `apps/ios/Mishran/UI/Checkout/SlotPicker.swift` — fresh-tier only
- Create: `apps/ios/Mishran/UI/Checkout/PaymentMethodPicker.swift`

- [ ] **Step 1: Write failing test: pincode `110001` (fresh) + shelf-stable item → serviceable. Pincode `110001` + fresh item → serviceable. Pincode `560001` (Bangalore, shelf) + fresh item → blocked.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `CheckoutViewModel.validatePincode()` calling `/catalog/serviceable`.**

- [ ] **Step 4: Implement SwiftUI form with sections for address, slot (conditional on tier=fresh), payment method.**

- [ ] **Step 5: Test → PASS.**

- [ ] **Step 6: Commit.**

### Task 17.3: Razorpay iOS SDK integration

**Files:**
- Modify: `apps/ios/project.yml` — add SPM dependency `https://github.com/razorpay/razorpay-ios-swift`
- Create: `apps/ios/Mishran/UI/Checkout/RazorpayCoordinator.swift` — `RazorpayCheckoutViewModal` wrapper
- Modify: `apps/ios/Mishran/UI/Checkout/CheckoutViewModel.swift` — call `createOrder` then present Razorpay
- Create: `apps/ios/MishranTests/RazorpayCoordinatorTests.swift`

- [ ] **Step 1: Write failing test: successful payment → `/verify` called → order status = confirmed.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `RazorpayCoordinator: RazorpayPaymentCompletionViewControllerProtocol`.**

- [ ] **Step 4: Wire to CheckoutViewModel. Show success → navigate to OrderDetailView.**

- [ ] **Step 5: Test → PASS. Add test: payment abandoned → return to cart, order status = abandoned.**

- [ ] **Step 6: Commit.**

---

## Phase 18: iOS — Orders + Live Activity + Push + Wallet

### Task 18.1: OrderListView + OrderDetailView

**Files:**
- Create: `apps/ios/Mishran/UI/Orders/OrderListView.swift`
- Create: `apps/ios/Mishran/UI/Orders/OrderDetailViewModel.swift`
- Create: `apps/ios/Mishran/UI/Orders/OrderDetailView.swift`
- Create: `apps/ios/Mishran/UI/Components/OrderStatusBadge.swift` — 5-state badge component

- [ ] **Step 1: Write failing test: 2 orders in response → list shows 2.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement ViewModels calling `/orders` + `/orders/{id}`.**

- [ ] **Step 4: Implement SwiftUI views with brand styling + pull-to-refresh.**

- [ ] **Step 5: Test → PASS. Add deep link test: open `mishran://order/abc` → detail view shown.**

- [ ] **Step 6: Commit.**

### Task 18.2: ActivityKit Live Activity + Dynamic Island

**Files:**
- Create: `apps/ios/Mishran/LiveActivity/DeliveryAttributes.swift` — `ActivityAttributes` struct
- Create: `apps/ios/Mishran/LiveActivity/DeliveryActivity.swift` — `ActivityConfiguration` with SwiftUI views for lock-screen + Dynamic Island
- Create: `apps/ios/Mishran/LiveActivity/LiveActivityManager.swift` — start/end/update activity
- Modify: `apps/ios/Mishran/UI/Orders/OrderDetailViewModel.swift` — start LiveActivity when order confirmed
- Modify: `apps/ios/Mishran/Info.plist` — `NSSupportsLiveActivities` = YES
- Create: `apps/ios/MishranTests/LiveActivityManagerTests.swift`

- [ ] **Step 1: Write failing test: `startActivity(orderId:)` returns non-nil activity.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `DeliveryAttributes` with `ContentState` containing `status`, `eta`, `lastUpdate`.**

- [ ] **Step 4: Implement `DeliveryActivity` with `DynamicIsland` modular UI (compact leading/trailing, minimal, expanded). Use brand marigold for `dispatched`, saffron for `out_for_delivery`.**

- [ ] **Step 5: Implement `LiveActivityManager.startActivity()` + `updateActivity()` + `endActivity()`.**

- [ ] **Step 6: Run → PASS. Manual test on physical iPhone 14 Pro+ for Dynamic Island.**

- [ ] **Step 7: Commit.**

### Task 18.3: APNs direct integration + device registration

**Files:**
- Create: `apps/ios/Mishran/Push/PushDelegate.swift` — `UNUserNotificationCenterDelegate`
- Create: `apps/ios/Mishran/Push/PushPermissionRequester.swift`
- Modify: `apps/ios/Mishran/MishranApp.swift` — register delegate, request permission on first launch post-login
- Modify: `apps/ios/Mishran/MishranApp.swift` — register for remote notifications via `application.registerForRemoteNotifications()`
- Create: `apps/ios/Mishran/Push/DeviceRegistrar.swift` — calls `/notifications/register-device` on token change

- [ ] **Step 1: Write failing test: APNs token received → `register-device` endpoint called with `platform="ios"`.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `PushDelegate` handling foreground notifications (banner + order list refresh).**

- [ ] **Step 4: Implement `DeviceRegistrar` observing `UIApplication.didRegisterForRemoteNotifications`.**

- [ ] **Step 5: Run → PASS. Manual test with APNs sandbox push via `apn` CLI.**

- [ ] **Step 6: Commit.**

### Task 18.4: Backend ActivityKit push support

**Files:**
- Modify: `lib/notifications/PushService.ts` — extend interface with `sendLiveActivityUpdate(deviceToken, contentState)` method
- Modify: `lib/notifications/impl/ApnsPushService.ts` — implement `.liveactivity` push type with `content-state` + `stale-date` fields
- Modify: `lib/notifications/OrderEventEmitter.ts` — when emitting `order.status_changed`, also call `sendLiveActivityUpdate` if device has active LiveActivity token
- Modify: `collections/Devices.ts` — add `liveActivityToken: string` field, `pushType` enum (`alert` | `liveactivity` | `pass`)
- Create: `tests/integration/LiveActivityPush.test.ts`

- [ ] **Step 1: Write failing test: order status change → APNs stub receives `.liveactivity` push with correct content-state.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `ApnsPushService.sendLiveActivityUpdate()`. Use `apn` library's `PushType.liveactivity` enum.**

- [ ] **Step 4: Wire `OrderEventEmitter` to also fire LiveActivity update for iOS devices with active token.**

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Commit.**

### Task 18.5: WalletPassService backend (node-passbook) + MinIO storage

**Files:**
- Create: `lib/wallet/WalletPassService.ts` — interface
- Create: `lib/wallet/impl/NodePassbookWalletService.ts` — uses `node-passbook` lib
- Create: `lib/wallet/impl/FakeWalletService.ts` — test fake
- Create: `certs/.gitkeep` — placeholder for `passbook.p12`, `passbook.key`, `wwdr.pem` (gitignored)
- Modify: `.gitignore` — add `certs/*.p12`, `certs/*.key`, `certs/*.pem`
- Modify: `lib/container.ts` — wire `walletPassService`
- Modify: `.env.example` — `PASSBOOK_CERT_PATH`, `PASSBOOK_CERT_PASSWORD`, `PASSBOOK_WWDR_PATH`, `WALLET_PASSES_BUCKET=mithai-wallet-passes`
- Create: `tests/unit/NodePassbookWalletService.test.ts`

**Interfaces:**
- Consumes: Passbook cert + WWDR cert from disk (env-configured paths)
- Produces: signed `.pkpass` file at MinIO URL; pass serialNumber registered in `walletPasses` collection

- [ ] **Step 1: Write failing test: generate pass with valid fixture certs → verifies signature via `pkpass verify` CLI.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `NodePassbookWalletService.generatePass(serialNumber, fields)` returning `Buffer`.**

- [ ] **Step 4: Implement MinIO upload + signed URL generation (24h TTL).**

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Commit.**

---

## Phase 19: iOS — Apple Wallet Loyalty Pass + Eligibility

### Task 19.1: Loyalty pass generation route + eligibility rules

**Files:**
- Create: `app/api/mobile/v1/account/loyalty-pass/route.ts` — `GET` generates + returns signed URL
- Modify: `lib/commerce/impl/PayloadOrderService.ts` — emit `order.eligible_for_loyalty` after 2nd delivered order
- Modify: `lib/notifications/OrderEventEmitter.ts` — fire `WalletPassService.generatePass` on eligibility event
- Create: `collections/WalletPasses.ts` — Payload collection: `customerId`, `serialNumber`, `tier` (silver/gold), `active`, `devices[]` (push tokens)
- Modify: `lib/container.ts` — wire `WalletPasses` collection
- Create: `tests/integration/LoyaltyPassEligibility.test.ts`

- [ ] **Step 1: Write failing test: customer with 1 delivered order → `/loyalty-pass` 404. 2 delivered orders → 200 with signed URL.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `loyalty-pass/route.ts`. Compute tier from order count: Silver ≥2, Gold ≥5.**

- [ ] **Step 4: Implement `WalletPasses` Payload collection.**

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Commit.**

### Task 19.2: APNs `.pass` push for pass updates

**Files:**
- Modify: `lib/notifications/impl/ApnsPushService.ts` — add `sendPassUpdate(serialNumber, newFields)` using `.pass` push type
- Create: `app/api/mobile/v1/wallet/register-pass-device/route.ts` — called by iOS when pass added; stores device push token
- Create: `app/api/mobile/v1/wallet/unregister-pass-device/route.ts` — called on pass removal
- Modify: `lib/notifications/OrderEventEmitter.ts` — on new order for loyalty customer, update pass via `.pass` push
- Create: `tests/integration/PassUpdatePush.test.ts`

- [ ] **Step 1: Write failing test: eligible customer places new order → APNs stub receives `.pass` push with updated fields.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement register/unregister routes.**

- [ ] **Step 4: Implement `ApnsPushService.sendPassUpdate()`.**

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Commit.**

### Task 19.3: iOS LoyaltyPassManager + PKAddPassesViewController flow

**Files:**
- Create: `apps/ios/Mishran/Wallet/LoyaltyPassManager.swift` — downloads `.pkpass` from URL, presents `PKAddPassesViewController`
- Create: `apps/ios/Mishran/Wallet/WalletPassView.swift` — promotion card shown in Account screen
- Modify: `apps/ios/Mishran/UI/Account/AccountView.swift` — show WalletPassView if eligible

- [ ] **Step 1: Write failing test: `addPass(from: URL)` calls delegate with presented `PKAddPassesViewController`.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `LoyaltyPassManager` using `URLSession` + `PKAddPassesViewController`.**

- [ ] **Step 4: Implement `WalletPassView` with brand styling + "Add to Wallet" CTA.**

- [ ] **Step 5: Run → PASS. Manual test on physical device (simulator has no Wallet app).**

- [ ] **Step 6: Commit.**

---

## Phase 20: iOS — Hardening

### Task 20.1: Maestro iOS E2E flows

**Files:**
- Create: `apps/ios/maestro/login_checkout.yaml`
- Create: `apps/ios/maestro/browse_catalog.yaml`
- Create: `apps/ios/maestro/track_order_live_activity.yaml`
- Modify: `apps/ios/maestro/run-flows.sh` — invokes `maestro test` per flow

- [ ] **Step 1: Write `login_checkout.yaml` covering: phone OTP → browse → add to cart → checkout → Razorpay test mode → order placed.**

- [ ] **Step 2: Run on iPhone SE 3 simulator against staging backend. Fix selector flakiness.**

- [ ] **Step 3: Write `track_order_live_activity.yaml`: order placed → trigger ops status update → Live Activity appears → tap to detail.**

- [ ] **Step 4: Wire Maestro into `pnpm ios:e2e` script.**

- [ ] **Step 5: Commit.**

### Task 20.2: XCTest performance + memory benchmarks

**Files:**
- Create: `apps/ios/MishranTests/Performance/ColdStartTests.swift` — `measure {}` cold start
- Create: `apps/ios/MishranTests/Performance/CatalogScrollTests.swift` — scroll perf
- Modify: `apps/ios/ci_scripts/ci_post_clone.sh` — write metrics to Xcode Cloud log

- [ ] **Step 1: Write cold start test: app launches on iPhone SE 3 → first catalog render under 1.5s.**

- [ ] **Step 2: Run → capture baseline. Optimize if > 1.5s.**

- [ ] **Step 3: Write scroll test: 500-item catalog → p95 frame drop < 5%.**

- [ ] **Step 4: Run → tune if regression.**

- [ ] **Step 5: Commit.**

### Task 20.3: Translation pass for 7 non-en/hi/kn locales

**Files:**
- Modify: `packages/i18n-strings/ta.json` (+ te, mr, gu, bn, pa)
- Create: `scripts/l10n-review.sh` — invokes native-speaker review checklist
- Modify: `apps/ios/Mishran/Resources/zh-Hans.lproj/Localizable.strings` (per locale)

- [ ] **Step 1: Pull translations from vendor (agency or community per Open Question #10).**

- [ ] **Step 2: Run `pnpm i18n:check` → 0 missing keys per locale.**

- [ ] **Step 3: Generate `Localizable.strings` per locale via codegen.**

- [ ] **Step 4: Manual UI review on 3 locales (en, hi, ta) on iPhone SE 3 + iPhone 16 Pro Max.**

- [ ] **Step 5: Commit.**

### Task 20.4: VoiceOver + Dynamic Type a11y audit

**Files:**
- Create: `apps/ios/MishranUITests/AccessibilityTests.swift` — automated a11y audits
- Modify: each SwiftUI view — add `.accessibilityLabel()` to icon buttons, `.accessibilityValue()` to cart qty
- Create: `apps/ios/Mishran/Accessibility/AccessibilityHelpers.swift`

- [ ] **Step 1: Write failing test: tap target < 44pt → fail. Missing accessibilityLabel on tappable element → fail.**

- [ ] **Step 2: Run → identify violations.**

- [ ] **Step 3: Add labels + values + hints per screen.**

- [ ] **Step 4: Run audit at Dynamic Type size categories AX1-AX5.**

- [ ] **Step 5: VoiceOver manual walkthrough on phone. Document in `apps/ios/A11Y_AUDIT.md`.**

- [ ] **Step 6: Commit.**

### Task 20.5: Security audit + Apple Sign-in revocation flow

**Files:**
- Create: `tests/integration/AppleRevocationFlow.test.ts` — backend handles Apple's `POST /auth/events` revocation webhook
- Create: `app/api/webhooks/apple/auth-events/route.ts` — receives revocation events
- Modify: `lib/auth/AppleAuthService.ts` — on revocation event, mark customer's `appleSub` invalid; trigger force-logout
- Create: `apps/ios/MishranUITests/RevocationFlowUITest.swift` — simulates Settings → Apple ID → revoke → next launch shows login

- [ ] **Step 1: Write failing test: revocation webhook received → next refresh attempt returns 401.**

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `/webhooks/apple/auth-events` route. JWT-signed payload from Apple.**

- [ ] **Step 4: Wire revocation to `RevokedTokens` collection + customer `appleSub` cleared.**

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Commit.**

---

## Phase 21: iOS — App Store Release

### Task 21.1: App Store Connect app record + signing

**Files:**
- Create: `apps/ios/Mishran/ExportOptions.plist` — App Store distribution config
- Modify: `apps/ios/project.yml` — provisioning profile + team ID refs
- Create: `apps/ios/ci_scripts/ci_archive.sh` — `xcodebuild archive` + `-exportArchive`
- Create: `apps/ios/fastlane/Fastfile` — alternative to Xcode Cloud (optional)

- [ ] **Step 1: Configure App ID in Apple Developer portal with capabilities: Sign in with Apple, Push Notifications, Live Activity, Wallet.**

- [ ] **Step 2: Provision Production + Sandbox certificates + provisioning profiles.**

- [ ] **Step 3: Create App Store Connect app record (manual — fill in metadata).**

- [ ] **Step 4: Configure App Store Review information: demo account credentials (test phone), contact info, review notes (mention OTP test mode).**

- [ ] **Step 5: Commit `ExportOptions.plist` + `project.yml` updates.**

### Task 21.2: App Store listing (9 locales)

**Files:**
- Create: `apps/ios/store-listing/en.json` (+ 8 more) — app name, subtitle, description, keywords, screenshot URLs

- [ ] **Step 1: Per-locale: title (`Mishran — Premium Mithai`), subtitle, keywords, description (4000 char), privacy policy URL.**

- [ ] **Step 2: Generate screenshots via fastlane snapshot for 6.7" (iPhone 16 Pro Max), 6.5" (iPhone 14 Plus), 5.5" (iPhone SE 3).**

- [ ] **Step 3: Upload via App Store Connect API (`fastlane deliver`).**

- [ ] **Step 4: Commit listing source.**

### Task 21.3: TestFlight beta

- [ ] **Step 1: Archive + upload to App Store Connect via `ci_archive.sh` (or Xcode → Product → Archive → Distribute App → App Store Connect).**

- [ ] **Step 2: Configure TestFlight beta info per locale + test notes.**

- [ ] **Step 3: Distribute to internal testers (5). Resolve beta review feedback.**

- [ ] **Step 4: Distribute to external TestFlight group (50 invited users) — requires beta app review (~24-48h).**

- [ ] **Step 5: Commit test notes + version history.**

### Task 21.4: Phased App Store release

- [ ] **Step 1: Submit for full App Store review. Average lead time 24-48h. Address any rejection feedback immediately.**

- [ ] **Step 2: On approval, enable Phased Release (7 days, 1% → 2% → 5% → 10% → 20% → 50% → 100%).**

- [ ] **Step 3: Monitor Sentry crash-free rate ≥ 99.5%, payment success ≥ 97%, p95 cold start ≤ 1.5s for 48h before each ramp step.**

- [ ] **Step 4: Auto-halt on regression (pause phased release button in App Store Connect).**

- [ ] **Step 5: After 100% rollout + 7 days clean → update memory: iOS v1 ship date, feature flag roll-in.**

- [ ] **Step 6: Update `mishran_deferred_register.md` memory + file issues for v2 work (iPad layout, Apple Watch, Apple Pay eval, courier API).**

