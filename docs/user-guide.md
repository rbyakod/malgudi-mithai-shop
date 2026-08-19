# Mishran User Guide

Everything you can do on Mishran today — on the web, on iPhone, and on
Android — and how to do it. Written for customers, testers, and the team.

> **Maintaining this guide (standing rule):** whenever a feature is added,
> changed, or removed on any platform, update this file in the same change.
> It is the record of what exists and how to use it — it must never drift
> from shipped behavior.

Last updated: 2026-08-17.

---

## 1. The three surfaces

| | Web storefront | iOS app | Android app |
|---|---|---|---|
| Where | https://mishran.pranavb.com | TestFlight (v0.1.0, build 202608171042 — processing) | https://mishran.pranavb.com/download/mishran-latest.apk |
| Works best on | Any modern browser, mobile or desktop | iPhone, portrait only | Android 8.0+ phones |
| Sign in required to order | Yes (phone OTP) | No — browse first, sign in to order | No — browse first, sign in to order |
| Languages | English, हिन्दी, ಕನ್ನಡ | 9 languages (see §12) | 9 languages (see §12) |
| Appearance | Light | Light (locked) | Follows system light/dark |

**Tester login (all platforms):** phone **+91 8088983014**, OTP **424242**.
This dummy account always works, including when the SMS provider is down.

**Payments on the apps:** Razorpay only (UPI, cards, netbanking, wallets —
all inside the Razorpay sheet). **On the web** you can pay online the same
way, pick a dedicated **UPI** rail (one-tap apps on your phone, a QR code
on desktop — still inside Razorpay), or choose **Cash on delivery** at
checkout and hand the cash to the delivery partner at your door (online is
the default).

---

## 2. Signing in

There are no passwords anywhere — you sign in with a phone number and a
6-digit texted code.

### Web (`/sign-in`)
1. Enter your phone **with country code** (e.g. `+919876543210` — the field
   comes seeded with `+91`). Tap **Send code**.
2. Enter the 6-digit code. **Resend code** is available with a 30-second
   countdown (the server also rate-limits: 5 sends/hour, 10/day).

### iOS
1. On first launch you land on Home — you can browse everything without
   signing in. Tap **Sign in** (top-left) when you want to order.
2. Pick your country from the country chip — it defaults to **🇮🇳 +91**.
   The picker searches by country name, ISO code (`IN`), or dial code
   (`971`). Type your mobile number **without** the country code
   (placeholder `90000 00000`). If you paste a full number like
   `+919876543210`, the app figures out the country and strips the code.
3. **Send OTP** → enter the 6-digit code → **Verify**. There's also a
   **Sign in with Apple** button that skips OTP entirely.
4. If the code doesn't arrive, **Resend code** re-sends right on the code
   screen (available after a 30-second countdown). **Wrong number? Start
   over** returns to the phone screen.

### Android
1. The app opens straight to Home — browse everything without signing in,
   like iOS. When you try to order (**Checkout** from the cart, **Buy now**
   on a product, or opening **Orders**), you're asked to sign in and then
   returned to exactly what you were doing.
2. Same country picker as iOS (default 🇮🇳 +91, searchable, paste-tolerant).
3. **Send OTP** → the code field often **fills itself in** (SMS Retriever
   auto-read; no SMS permission is used). **Resend code** re-sends right on
   the code screen after a 30-second countdown.
4. After verifying, Android offers **biometric login** (fingerprint/face)
   for next time — Enable or Skip. On later launches, a system biometric
   prompt unlocks the app if enabled.

---

## 3. Home

### Web
- Announcement strip ("Handcrafted daily · Delivered fresh across
  Bengaluru") with the WhatsApp number.
- **Hero** — featured products in a slow Ken Burns pan (a gentle
  video-like drift, pure CSS). The shop ships two looks, and the owner
  picks between them in **Admin → Storefront settings** to experiment
  with customers:
  - **Framed** (default): editorial two-column hero with a rotating
    product card that includes the price and its own **Add to cart**.
  - **Cinematic**: a full-width image band with the headline, gold
    **Explore mithai** button, and a product chip (name + price + **Add
    to cart**) over the photo.
  Both auto-advance every 5 seconds and honor your device's reduced-motion
  setting (autoplay and the drift stop entirely). The framed card pauses
  while you hover it — handy right before clicking **Add to cart**; the
  cinematic band keeps rotating even with the cursor resting on the photo,
  since the band fills most of the screen (keyboard focus still pauses it).
- Product photos across the shop (catalog cards, product pages, journal)
  carry the same subtle always-on drift. It's a display effect only —
  photos never change content — and it also switches off with
  reduced-motion or from **Admin → Storefront settings → Product image
  motion**.
- **"Find your Mishran"** — the four verticals (Mithai · QSR · Snacks ·
  Merch) as full-width cards.
- **"Why Mishran"** — the four promise cards, each linking into Stories.

### iOS
Top to bottom: announcement strip → **hero carousel** (auto-rotates every
5 s; swipe or tap the dots; a single swipe resets the timer; rotation turns
itself off if Reduce Motion is on) → **Best sellers** rail (tap a card for
the product) → **Shop by vertical** portals → **Why Mishran** pillar cards
(open the Journal pre-filtered) → **From the journal** (3 newest stories) →
**Your orders** button. Pull down to refresh.

Toolbar: **Sweets** (browse catalog), **Sign in** (when signed out),
**Cart** (live count badge), **Orders**, **Account**.

### Android
Same layout family: announcement strip → hero carousel (swipe + dots,
autoplay) → Best sellers rail → **Shop by family** chips (Classic,
Originals, Sugar-free, Regional, Seasonal — jump straight into a filtered
catalog) → Why Mishran pillars → Shop by vertical tiles → journal preview
(**See all**) → Your orders.

Bottom navigation: **Home · Sweets · Orders · Account** (the cart badge
lives on the Sweets tab's toolbar, not the bottom bar).

---

## 4. Browsing the catalog

The four **verticals** are the same everywhere:
**Mithai** (order online) · **Snacks** (retail packs — buy at partner
stores, not in the cart) · **QSR** (walk-in counter menu — no ordering) ·
**Merch** (boxes and keepsakes — enquiry only).

### Mithai catalog
- **Search**: by name, ingredients, story, family, and dietary tags on the
  apps; on web it's a server search box ("Search sweets — kaju, gulab,
  peda…"). Web keeps the query in the URL, so a filtered view is
  shareable/bookmarkable.
- **Filters**: family/category (Classic, Originals, Sugar-free, Regional,
  Seasonal) and dietary needs (Sugar-free, Eggless, Gluten-free on iOS;
  web adds a **Freshness** filter: Made daily / Made to order / Batch
  frozen). Active filters show as removable chips.
- **Sort**: **Featured / Name A–Z / Name Z–A** on the apps (remembered
  between launches); web's mithai grid follows the featured order, and the
  other vertical hubs have their own Sort control.
- **Quick add** (apps only): the **+** button on any mithai grid card adds
  one base pack instantly. On web, the QSR/Snacks/Merch hub cards carry
  **Quick add** buttons, but those verticals don't check out — see §5.
- **Offline**: both apps cache the mithai catalog — it opens instantly and
  keeps working without a network (refreshed in the background every 6
  hours). Snacks/QSR/Merch tabs need a connection.

### Product cards elsewhere
Snacks cards show MRP + pack weight; QSR cards show a veg/non-veg dot and
category; Merch cards show type and availability. On web, catalog photos
carry the subtle always-on drift noted in §3 (off with reduced-motion or
the admin toggle).

---

## 5. Product pages

### Mithai product page (the main buy flow)
Common to all platforms:
1. **Hero photo** (a designed monogram tile if the product has no photo
   yet). On web the hero photo slowly drifts, like the home hero.
2. **Family, name, price, freshness promise** ("Made fresh each morning" /
   "Made to order…" / "Finished fresh, frozen at peak").
3. **Pack size**: 250 g / 500 g / 1 kg chips when the product is priced on
   that ladder — other weights are estimates scaled from the base price
   ("Estimated — final price at checkout"). Products priced per-pack show a
   single chip.
4. **Quantity** 1–20.
5. **Add to cart** and **Buy now** (Buy now = add + jump straight to
   checkout). Web and iOS also offer **Ask on WhatsApp** / a WhatsApp link
   with the product, pack, and quantity pre-filled.
6. **Pincode delivery check** (iOS, Android, web): type a 6-digit pincode
   → **Check**. Green means we deliver: "Delivers to {city} · Fresh ·
   same-day" or a shelf-stable variant with day counts. Red means not yet:
   "pan-India shipping coming soon." The result is remembered, so the next
   product page (and on every platform, the cart's delivery estimate)
   reuses it.
7. **Trust information**: freshness, shelf life, lead time, dietary tags,
   ingredients, story, **allergens**, **storage**, and the **karigar** who
   made it (web + iOS + Android). Android shows a compact trust strip under
   the price (freshness promise · shelf life · lead time · dietary tags) and
   provenance rows that hide while a product's karigar/lead-time data is
   blank.
8. **Cross-sell rail** — "More from the {family} collection" (web, iOS,
   Android). On Android it sits below customer reviews and needs one
   catalog fetch on a cold cache before it fills.
9. **Customer reviews** (web, iOS, Android) — the average star rating, up
   to five approved reviews (newest first) with author display name, date,
   and a gold **Verified purchase** badge when the review came from a real
   delivered order, plus a "+N more" note when there are extras. The
   section is hidden entirely on products with no approved reviews yet.
   On web and iOS it sits below the cross-sell rail; on Android below the
   allergens section.

Platform specifics: **web** has a sticky buy bar on mobile screens;
**iOS** has a sticky bottom buy bar everywhere; **Android** now has one
too — product name, a compact quantity stepper (kept in sync with the
one in the page), and Add to cart pinned above the bottom edge.

### Snack / QSR / Merch pages
- **Snack**: price (MRP), weight, description, and **Where to buy** —
  external retailer links. Never enters the cart.
- **QSR**: veg badge, spice level, description, and which counters carry
  it. No prices, no ordering — walk in.
- **Merch**: price, availability, description, and **Enquire** → opens the
  bulk & events enquiry form. On web, **Enquire** jumps to an enquiry form
  right on the page (name, email, phone, quantity, notes) — it lands in the
  shop's leads inbox and the team replies by email.

---

## 6. Cart

Works the same everywhere: per-line quantity steppers (1–20), remove, and
a running total. Carts persist on the device.

- **Web** (`/cart`) is the most complete:
  - **Delivery estimate** in the cart itself, keyed off the pincode you
    checked: fresh tier (₹49, **free over ₹999**) or shelf-stable (₹99,
    **free over ₹1,999**), with a progress line ("Add ₹x more for free
    delivery").
  - **Upsell rail** — "Ships pan-India": shelf-stable best sellers you can
    add in one tap.
  - **"Email me this cart"** — saves your email so we can send you a
    recovery link if you abandon the cart (the link restores the exact
    cart).
  - **Order on WhatsApp** sends the full itemized cart to the shop.
  - Unpriced items show an "On request" pill; the final total is always
    confirmed at checkout.
- **iOS**: quantity steppers, swipe-left to delete, **Checkout**, **Send
  order on WhatsApp**, **Clear cart**. With a checked pincode saved, the
  footer shows the live delivery fee and a free-delivery progress line
  ("Add ₹x more for free delivery" / "Free delivery unlocked"); without
  one it reads "calculated at checkout" with a **Check** button that
  opens the delivery check, and the footer re-prices the moment it lands.
- **Android**: same actions (− / + / remove / clear), an estimated total
  (with an "On request" note when prices are missing), Checkout, and Send
  order on WhatsApp. Delivery pricing matches iOS — a saved checked
  pincode shows the fee + free-delivery progress; the **Check** affordance
  opens the delivery check in a bottom sheet and re-prices on the spot.

---

## 7. Checkout & payment

**Web** (`/checkout`, sign-in required) is a three-step flow:
1. **Address** — pick a saved address (each shows its delivery tier badge)
   or add a new one; the kitchen checks serviceability per pincode.
2. **Delivery slot** — fresh-tier orders choose one of four slots (Today or
   Tomorrow × 10:00–14:00 or 16:00–20:00). Shelf-stable orders skip this
   and dispatch in a few days.
3. **Review & pay** — the order is **re-priced by the kitchen in real
   time** (the amounts shown are the server's, not the estimate), a
   **Coupon** field sits between the items and the totals (see below),
   and a payment choice: **Pay online** (default), **UPI**, or **Cash on
   delivery**. Online: **Pay ₹{amount}** opens Razorpay; if payment
   fails or the window is closed, your order is saved and you can retry
   or finish on WhatsApp — you're never double-charged (idempotency
   keys). UPI: the same button opens a Razorpay window with UPI as the
   only method — on a phone it lists your UPI apps (GPay, PhonePe, BHIM)
   for a one-tap pay; on a desktop it shows a QR code to scan from your
   UPI app. Cash on delivery skips Razorpay entirely — you confirm, the
   order is placed instantly (a small note reminds you to have the cash
   ready for the delivery partner).

**iOS**: Checkout form → pick/add address → pincode check → slot (fresh
tier only) → **Pay ₹{amount}** → Razorpay sheet → confirmation. The
progress reads "Checking your cart… → Creating your order… → Waiting for
payment… → Confirming payment…". Addresses can be added mid-checkout.

**Coupon codes** (web, iOS, and Android): before paying you can apply a
coupon code — type it (it uppercases as you type; up to 40 characters)
and tap **Apply**. The kitchen validates it live against your cart and
address; the summary then shows a **Coupon discount −₹…** row plus a chip
with the applied code and a **Remove** button. A code that doesn't work
says so with the kitchen's reason ("expired", "Add ₹200 more to use this
code", …) and nothing is blocked — checkout continues at full price. If a
code expires or hits its limit between applying and paying, it's dropped
with a message and you can pay straight away; removing a code re-checks
the cart so the discount disappears. On iOS, **Apply** stays disabled
until an address is picked (validation needs its pincode).

**UPI on each surface**: on the **web** the dedicated UPI choice opens
Razorpay with UPI as the only method (one-tap app list on your phone, QR
on desktop). In the **Android app** the Razorpay sheet's UPI tab lists
your installed UPI apps — GPay, PhonePe, BHIM — for a one-tap pay; the
UPI chip records your preference and the sheet still offers every
method. The **iOS app** opens the same sheet with its UPI tab (entering
any UPI ID keeps working there — Razorpay exempts iOS from the 2026
collect deprecation); neither mobile SDK can pre-select a method, so no
per-app deep links are promised on either app.

**Android**: Checkout shows saved addresses (add them from Account →
Saved addresses first), a serviceability readout ("Fresh — same-day
network" / "Shelf — shipped"), slot chips on the fresh tier, a coupon
field (above) just above the CTA, and a payment preference (UPI / card /
netbanking / wallet — the Razorpay sheet collects the actual payment and
always offers every method).
The CTA tells you what's missing ("Select a delivery address" → "Pick a
delivery slot" → "Place order"). Android verifies the payment signature
server-side before confirming.

**After payment**: all three land on a confirmation screen with the order
reference and a **Track** button. A receipt SMS follows.

---

## 8. Orders & tracking

- **Order statuses** (same vocabulary everywhere): Placed → Awaiting
  payment → Confirmed → Packed → Dispatched → Out for delivery →
  Delivered, plus Cancelled / Payment failed / Returned / Delivery failed
  / Abandoned.
- **Web**: `/account` shows your 10 most recent orders with a **Load
  more** button to page through the full history; `/track-order` is a
  shortcut to the same list; each order's receipt page shows items,
  totals, **Order again** (one tap puts everything back in the cart), and
  — once delivered — a **star-rating review form** per item (approved
    reviews then appear on the product page — §5).
- **iOS**: Orders list → detail with a five-stage progress timeline
  (Confirmed → Packed → Dispatched → Out for delivery → Delivered), items,
  totals, **Need help** (WhatsApp), and **Order again** — every line goes
  back into the cart (pack sizes honored) and you land in the cart to
  review it. Starting a delivery-track on iOS
  also pins a **Live Activity** to your Lock Screen that updates as the
  order moves.
- **Android**: Orders tab → same five-stage timeline, items, totals, a
  **Call support** button, and **Reorder** — all items go back into the
  cart (pack sizes honored) with a confirming toast ("Added to cart", or
  "2 of 3 items added" if a line failed) and a **Go to cart** shortcut.
  Push notifications announce each stage
  ("Packed with care", "Out for delivery", …) and tapping one opens that
  order. The Android **home-screen widget** ("Mishran order") shows your
  latest in-flight order and deep-links to it.

---

## 9. Account

- **Profile**: web shows name/phone/email with sign-out; the apps show
  your verified phone and sign-out. There's no profile editor anywhere
  yet.
- **Addresses**: add / set-default / delete on all platforms, with
  Home/Work/Other tags. Serviceability badges per address on web.
- **Biometric unlock**: both apps have a toggle in Account (iOS:
  Preferences; Android: beside Language). Turning it on stores your
  session behind the device's fingerprint/face check, so the next launch
  unlocks with biometrics instead of a code; turning it off returns to
  normal sign-in. Hidden on devices with no enrolled fingerprint or face.
- **Loyalty**: two delivered orders earn **Silver**, five earn **Gold**.
  Web shows your tier progress on `/account`; iOS can add the loyalty card
  to **Apple Wallet** once earned; Android doesn't surface loyalty yet.
- **Sign out** revokes the session server-side and clears local data.

---

## 10. Gifting & events

All of these are **quote-request forms**: you describe the gift or event,
the team replies on WhatsApp/email with an assortment and price before
anything is packed or charged.

- **Build a gift** — occasion (Diwali/Wedding/Corporate/Birthday/
  Housewarming/Other), box size (4/8/16-piece or custom), budget band,
  needed-by date, dietary notes, and a message card. You get a reference
  number for the enquiry. On web there's also a **Quote on WhatsApp**
  button that pre-fills everything.
- **Weddings** (`/weddings`, web) — event date, city, guest count, budget,
  mithai and packaging preferences.
- **Corporate** (`/corporate`, web; Bulk & events on the apps) — company,
  GSTIN, quantity, deadline, occasion, branding — with a wedding/corporate
  toggle in the apps.
- **Gift boxes** (`/gifts`, web) — curated boxes with "In the box"
  contents, add-ons, and compatible sweets; the buy path is the builder or
  WhatsApp, not the cart.
- **Occasions** (`/occasions`, web) — seven occasion landing pages
  (Diwali, Weddings, Raksha Bandhan, Housewarming, Corporate Gifting,
  Holi, Birthdays & Celebrations), each with a hero image, evergreen
  copy, and a curated recommended-products rail of mithai and gift boxes
  (`scripts/seed-occasions.ts` seeds and can be re-run safely).

---

## 11. Stories (the Journal)

Long-form pieces grouped by pillar: **Milk & Farms · Karigar Mastery ·
Karigari · Packaging · Festivals · Regional · Recipes · Modern
Experience**. Each story has a hero image, date, rich-text body, and a
"Featured in this story" product rail. The apps' journal is cached for
offline reading, and the **Why Mishran** pillars on Home are shortcuts
into the matching pillar. Web also has dedicated pillar routes
(`/stories/farms`, `/stories/karigars`, `/stories/karigari`,
`/stories/journal`).

---

## 12. Languages

| Platform | Available | Switcher | Behavior |
|---|---|---|---|
| Web | English, हिन्दी, ಕನ್ನಡ | Header dropdown (stays on the same page) | URL carries the locale (`/en/…`, `/hi/…`, `/kn/…`) |
| iOS | + தமிழ், తెలుగు, मराठी, ગુજરાતી, বাংলা, ਪੰਜਾਬੀ | Account → Language | Applies on next app launch |
| Android | same 9 as iOS | Account → Language | Applies immediately |

Default when no choice is made: your device language if it's one of the
supported ones, else English. (A small amount of checkout/support copy is
still English on the apps.)

---

## 13. Notifications, offline & platform extras

- **Order notifications**: Android and iOS both ask permission once (first
  Home visit) and never re-ask if denied; pushes announce every order
  stage and open the order when tapped. Android additionally shows
  in-app snackbars for foreground updates and refreshes the home-screen
  widget.
- **Offline**: mithai catalog and journal work offline on both apps; web
  needs a connection. Orders stay readable offline on Android (hourly
  refresh) and reload on iOS when online.
- **iOS extras**: Sign in with Apple · Live Activity for deliveries ·
  Apple Wallet loyalty pass · biometric unlock toggle · light-mode-locked
  design.
- **Android extras**: biometric unlock · SMS auto-fill of the OTP ·
  order-status home-screen widget · system dark mode · deep link
  `mishran://order/{id}`.
- **Accessibility**: all three carry labeled controls and minimum tap
  targets; web has a dedicated `/accessibility` statement. iOS respects
  Reduce Motion (stops carousel autoplay), as does Android (system
  animation setting) and web (`prefers-reduced-motion`).

---

## 14. Help & legal (web)

`/help/shipping` (live fee and slot information), `/help/returns`
(replacement-or-refund promise for perishables), `/help/contact` (WhatsApp
hours 9:00–21:00 IST, kitchens in Bengaluru), `/about`, `/privacy`,
`/terms`, `/accessibility`. The footer links all of these.

---

## 15. Staff & ops tools (web)

Staff tools live behind the admin login at `/admin` — the pages below
ask you to sign in there first, then reload.

- **Orders console** (`/staff/orders-board`): every order in one table —
  id, placed time, customer + phone, source (web / iOS / Android), payment
  method, payment state, status, and total. Filter by status, payment
  method, payment state, source, or date range, or search by phone number
  or order id; the page refreshes itself every 20 seconds. Row actions:
  move an order to its next legal status (each move fires the customer's
  SMS/push notification), and on cash-on-delivery orders a **Cash
  collected** button marks the payment paid once the money is in hand. A
  **Board** tab keeps the original drag-to-advance kanban view.
- **Payment reconciliation** (`/staff/payment-reconciliation`): match
  captured Razorpay payments against a pasted settlement export; a
  **cash to collect** summary shows the outstanding COD total with a link
  into the orders console.

---

## 16. Tester notes

- **Test login**: +91 8088983014, OTP 424242 (works on all platforms, no
  SMS needed).
- **Android install**: download from
  https://mishran.pranavb.com/download/mishran-latest.apk — installing
  over a previous build keeps your cart/login (same signing key). The link
  always serves the newest build.
- **iOS**: TestFlight invite pending App Store processing of build
  202608171042; until then, testing runs on the simulator.
- **Delivery tiers for testing**: Bengaluru pincodes are fresh-tier
  (same-day slots); most other serviceable pincodes are shelf-tier (a few
  days). Fresh-tier sweets can't ship to shelf-tier addresses — checkout
  will tell you to swap the items or the address.
- **Payments in test**: Razorpay runs in TEST mode — no real money moves.
  Use test cards/UPI from the Razorpay test dashboard.
- **What's intentionally still placeholder**: WhatsApp/support numbers
  (show +91 80000 00000 until the real one is configured), FSSAI licence
  ("pending" chip in the web footer), occasion page content, and social
  links in the footer.

---

## 17. Known gaps (by design or deferred)

So nobody hunts for what isn't there:

- **No guest checkout on web** — ordering there requires an account. Both
  apps let you browse and fill a cart without signing in; ordering asks.
- **Web Build-a-gift is a quote form**, not an interactive box builder
  (by design — the team prices every bespoke box before packing).
- **Paid checkout is TEST-mode-only until real Razorpay TEST keys land**
  — order creation for online/UPI payment currently runs against a
  placeholder secret, so the paid flow can't be exercised end-to-end;
  COD and everything after payment (verify → status → console) are live
  and verified. (Blocked on the real key pair.)
- **COD UI exists on web only** — the server accepts cash orders from any
  client (`POST /orders/cod`), but the apps' checkout still offers the
  Razorpay sheet alone; adding a COD toggle to the apps is the next
  commerce batch.
