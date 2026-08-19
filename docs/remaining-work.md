# Remaining work — v1 close-out

Audited 2026-08-18 · session resumes 2026-08-19 · canon: `main` @ `c4b9d2e`, prod healthy

## Where we stand

The v1 goal — a working product across all four surfaces (web storefront,
admin console, iOS app, Android app) — is **code-complete and live** at
https://mishran.pranavb.com. 122 of 123 tracked tasks closed. What remains
falls into three buckets: five owner-side account actions that gate real
usage, three agent-doable code items, and a deferred-by-design v2/v3
register.

## A. Owner actions (portal / accounts — ~1 hour, needs your logins)

| # | Action | Where | Why it gates |
|---|--------|-------|--------------|
| 1 | **Deliver the iOS app**: drag `apps/ios/build/Mishran-0.1.0-202608180816.ipa` into Transporter → Deliver. Create the ASC record first if not yet: name `Mishran`, bundle `com.mishran.app`, SKU `mishran`, Full Access | App Store Connect + Transporter | Family can't test iOS until TestFlight processes. Signing, entitlements, Team ID `2X7B7DMV95` all verified done. This is task #41's last step |
| 2 | **Register the Razorpay webhook**: URL `https://mishran.pranavb.com/api/webhooks/razorpay`, events `payment.captured` + `payment.failed`. The secret's local copy was purged; read it on the VPS: `ssh hermes-vps 'sudo -iu mithai grep RAZORPAY_WEBHOOK_SECRET /opt/mithai-shop/.env'` | Razorpay Dashboard | Payments work today (client verify + reconcile cron cover it — proven by the ₹2,258 paid smoke), but the webhook is belt-and-suspenders |
| 3 | **Enable UPI** on the Razorpay account | Razorpay Dashboard | The UPI checkout rail (web + apps, B14/B15) is built but can't transact until enabled |
| 4 | **MSG91 real keys** + register the missing SMS template (`push.order.confirmed.body`) | MSG91 | OTP currently uses the bypass list; order-confirmed SMS silently fails. When keys arrive, OTP_BYPASS_* vars get stripped per deployment doc §10 |
| 5 | **Resend**: set `RESEND_API_KEY` + verify the `mishran.shop` domain | Resend | Abandoned-cart and lead emails are no-ops until then |

### Your test pass (task #43)

Drive web + Android (already on the Pixel — hosted APK matches the latest
build) + iOS once TestFlight processes. Real orders have already been placed
on the web, so this is mostly the two apps.

### Content decisions (no code — waiting on you)

- Real WhatsApp / support number (placeholder `+91 80000 00000` everywhere).
- FSSAI number for the web footer chip ("pending").
- Karigar + leadTime data in admin — the PDP provenance block stays hidden
  on all platforms until products have these filled.

## B. Code work (agent-doable)

1. **#123 — eslint debt**: 176 `no-explicit-any` errors in committed test
   files (pre-dates D10). Mechanical; clears the repo-wide lint gate.
2. **#124 — merch Enquire stub**: the web merch Enquire button is an
   unwired "Enquiries open soon" disabled stub — wire it to the existing
   public `POST /api/leads` (same endpoint the gift builder uses) or give
   it an honest label. (The Play listing's "one-tap reorder" claim became
   true when B4 shipped — resolved.)
3. **#125 — Android PDP parity**: the last real parity gap — Android PDP
   lacks the trust strip, provenance rows, same-family cross-sell rail,
   and sticky buy bar that iOS + web have. iOS is the reference
   implementation; the serializer already emits `leadTime` + `karigarName`.
   Ends with a fresh APK re-host per the standing rule.

### Accepted gaps (documented, no action)

- Guest checkout is web-only — by design.
- Apps are Razorpay-only; COD server + web shipped in B12. Adding app COD
  UI is a deliberate v3 item unless pulled forward.

## C. Deferred by design (revisit at v2/v3 gates)

Headline items from the deferred register: courier API integration
(Delhivery/Shadowfax), wishlist, self-serve refunds, live driver map, EMI /
pay-later, subscriptions, AR gift preview, loyalty Wallet passes, native
Kannada review of `kn.json`, Razorpay settlement reconciliation automation.
The strategic one to surface when ready: **Shopify migration** (adapter
swap plan exists in the register).

## Execution order

- **Owner first**: items 1–2 (TestFlight + webhook) — they unblock
  everything else.
- **Agent queue (2026-08-19)**: #123 → #124 → #125, each a scoped change
  with its own gates.
