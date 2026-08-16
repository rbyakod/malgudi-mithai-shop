# Family testing — Android app

**Download:** https://mishran.pranavb.com/download/mishran-latest.apk

That URL always serves the newest APK we've pushed (`scripts/host-apk.sh`).
Re-download it after we tell you an update landed — browsers may otherwise
serve a cached copy.

## Install (one time, ~2 minutes)

1. Open the link in **Chrome** on the Android phone.
2. Chrome warns about downloading an APK → **Download anyway**.
3. Tap the downloaded file → Android asks to allow installs from Chrome →
   **Settings → Allow from this source** → back → **Install**.
4. (Some phones: Settings → Apps → Chrome → Install unknown apps → Allow.)

The app installs as **Mishran (Debug)** alongside any store copy — it does
not interfere with it.

## Sign in

Payments SMS is not live yet, so there is one shared test login:

| Field    | Value          |
|----------|----------------|
| Phone    | `+918088983014` |
| OTP code | `424242`       |

Everyone shares this account for now (orders all land on it). When you want
your own number on the login screen instead, send the number to Ravi — it's
a one-line server setting, no app update needed.

## What to try

1. **Home** — hero carousel, best sellers, family chips.
2. **Catalog** — search (try "kaju"), filter by family, open a product.
3. **Product** — change pack size, check pincode delivery, add to cart.
4. **Cart** — change quantities.
5. **Checkout** — pick/add an address, choose a delivery slot, pay.
   Payments are in **TEST mode**: no real money moves. Use Razorpay's test
   card `4111 1111 1111 1111`, any future expiry, any CVV.
6. **Account → Orders** — see the order you just placed.

## Reporting issues

WhatsApp Ravi with: what you did, what you expected, what happened, and a
screenshot. Anything broken before checkout matters most right now.

---

## Shareable blurb (copy-paste into the family group)

> We're testing our sweets app! 🍯
> 1. On your Android phone, open: https://mishran.pranavb.com/download/mishran-latest.apk
> 2. Allow the download, then Install (say yes to "unknown apps" — it's our own site).
> 3. Open **Mishran** → sign in with phone **+918088983014**, code **424242**.
> 4. Browse, add to cart, and try checkout — payment is in test mode, use card
>    4111 1111 1111 1111 with any future expiry.
> Tell Ravi what worked and what didn't — screenshots help!
