// tests/e2e/checkout.spec.ts
// Full web checkout — THE honest payment e2e (plan Batch 5): only the
// Razorpay POPUP is faked; everything else is real.
//
//   page.exposeFunction("__sig")   — Node-side HMAC-SHA256 over
//                                    `${orderId}|${paymentId}` with the
//                                    REAL RAZORPAY_KEY_SECRET (env).
//   page.addInitScript            — window.Razorpay stub whose open()
//                                    invokes the REAL handler callback with
//                                    a REAL payment id + REAL signature.
//
// So the flow exercises the real sign-in, real /cart/validate (real server
// pricing + snapshot), real /payments/razorpay/create-order (real Razorpay
// order via the test-mode API), real /payments/razorpay/verify (real HMAC
// check) — and asserts the order lands confirmed + paid, the cart clears,
// `purchase` hits the dataLayer, and the success page shows a non-zero
// total (the end-to-end proof of the server-pricing batch).
//
// Environment needed to run (documented; skipped without it):
//   RAZORPAY_KEY_SECRET / RAZORPAY_KEY_ID (rzp_test_* — NEVER live keys)
//   a server on PORT with local Mongo + seeded catalog + seeded pincodes
//   (scripts/seed-pincodes.ts — Delhi NCR 110001.. is tier=fresh) and
//   OTP_BYPASS_PHONE / OTP_BYPASS_CODE (SIGNIN_E2E_PHONE / OTP_BYPASS_CODE
//   env for the spec, default +918088983014 / 424242).
//
// PROVIDER MODES: with real test-mode keys the create-order route calls the
// real Razorpay API. Boxes that only carry placeholder keys (secret shorter
// than a real Razorpay secret) must run the server with PAYMENT_PROVIDER=fake
// — the sanctioned local/test seam (lib/container.ts) — under which
// create-order, the DB order row, idempotency, and the real HMAC verify all
// still execute for real; only Razorpay's HTTP order-create is stubbed
// server-side (the popup is stubbed browser-side in both modes).

import {test, expect} from "@playwright/test";
import {createHmac} from "node:crypto";

// Checkout flows share the OTP/customer rows and the rate limiter — run
// them one at a time instead of fighting parallel workers.
test.describe.configure({mode: "serial"});

const PHONE = process.env.SIGNIN_E2E_PHONE ?? "+918088983014";
// The payment test signs in on its own number so a parallel guard test
// never races the same OTP/customer row (Mongo transactions transient-
// fail when two verifies hit the same fresh customer at once).
const PAY_PHONE = process.env.SIGNIN_E2E_PAY_PHONE ?? PHONE;
const CODE = process.env.OTP_BYPASS_CODE ?? "424242";
const SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const PROVIDER = process.env.PAYMENT_PROVIDER ?? "razorpay";
// Razorpay secrets are never this short — an 11-char value is a placeholder.
const SECRET_IS_REAL = SECRET.length >= 20;
// Delhi NCR pincode seeded tier=fresh by scripts/seed-pincodes.ts.
const FRESH_PINCODE = process.env.CHECKOUT_E2E_PINCODE ?? "110001";

async function signIn(page: import("@playwright/test").Page, phone = PHONE) {
  await page.goto("/en/sign-in");
  await page.getByTestId("sign-in-phone").fill(phone);
  await page.getByTestId("sign-in-submit").click();
  await page.getByTestId("sign-in-code").fill(CODE);
  await page.getByTestId("sign-in-verify").click();
  // Wait for the session to LAND (AuthContext persist → localStorage)
  // before any full-page navigation — otherwise the test races the
  // verify response and the next load restores no session.
  await expect(page).toHaveURL(/\/en\/account$/);
}

/**
 * Add the first online-priced product to the cart. The seeded catalog
 * carries some "on request" items which /cart/validate (correctly)
 * rejects — walk the catalog cards until a PDP shows a parseable ₹ price.
 */
async function addPricedItemToCart(page: import("@playwright/test").Page) {
  await page.goto("/en/mithai");
  const hrefs = await page
    .locator('a[href^="/en/mithai/"]')
    .evaluateAll((anchors) =>
      anchors
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
        // The hub itself is /en/mithai — only deeper links are products.
        .filter((href) => href.split("/").filter(Boolean).length > 2),
  );
  expect(hrefs.length, "seeded mithai catalog renders product cards").toBeGreaterThan(0);

  for (const href of hrefs) {
    await page.goto(href);
    const priceText = await page
      .getByTestId("display-price")
      .first()
      .textContent();
    if (priceText && /₹\s*[\d,]+/.test(priceText)) {
      await page.getByTestId("add-to-cart").click();
      await expect(page.getByTestId("display-price")).toBeVisible();
      return;
    }
  }
  throw new Error("No online-priced mithai product found in the catalog");
}

// ---- Guards-only tests (no Razorpay keys needed) ------------------------------

test.describe("checkout guards", () => {
  test("signed-out /checkout shows the sign-in prompt, not middleware", async ({page}) => {
    await page.goto("/en/checkout");
    // Fresh context = no session in localStorage.
    await expect(page.getByTestId("sign-in-cta")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);
  });

  test("empty cart redirects to /cart after the hydration restore", async ({page}) => {
    await signIn(page);
    await page.goto("/en/checkout");
    // Dev-server first compile of /cart can exceed the default 5s.
    await expect(page).toHaveURL(/\/en\/cart$/, {timeout: 15_000});
  });
});

// ---- The honest payment e2e ----------------------------------------------------

test.describe("checkout: real validate → real create-order → real verify", () => {
  test.skip(
    Boolean(
      !SECRET ||
        (KEY_ID && !KEY_ID.startsWith("rzp_test_")) ||
        (PROVIDER !== "fake" && !SECRET_IS_REAL),
    ),
    "needs real test-mode Razorpay keys (or PAYMENT_PROVIDER=fake server) + local Mongo/seeded catalog; refusing live keys or placeholder secrets in razorpay mode",
  );

  test("cart → address → slot → summary → pay → confirmed receipt", async ({page}) => {
    // Node-side signer: the REAL secret, the REAL signature scheme the
    // verify route checks (lib/security/hmac.ts).
    await page.exposeFunction("__sig", async (orderId: string, paymentId: string) =>
      createHmac("sha256", SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex"),
    );

    // Fake ONLY the popup: a window.Razorpay whose open() hands the real
    // handler a real-looking payment id signed with the real secret.
    await page.addInitScript(() => {
      class FakeRazorpay {
        opts: {
          order_id: string;
          handler: (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => void;
        };
        constructor(opts: FakeRazorpay["opts"]) {
          this.opts = opts;
        }
        open() {
          void (async () => {
            const paymentId = `pay_test_${Math.random().toString(36).slice(2)}`;
            const signature = await (
              window as unknown as {
                __sig: (orderId: string, paymentId: string) => Promise<string>;
              }
            ).__sig(this.opts.order_id, paymentId);
            this.opts.handler({
              razorpay_order_id: this.opts.order_id,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
            });
          })();
        }
        on() {}
      }
      (window as unknown as {Razorpay: unknown}).Razorpay = FakeRazorpay;
    });

    await signIn(page, PAY_PHONE);
    await addPricedItemToCart(page);

    // Cart — estimate present, proceed to checkout.
    await page.goto("/en/cart");
    await expect(page.getByTestId("cart-estimate-total")).toContainText("₹");
    await page.getByTestId("proceed-to-checkout").click();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // Step 1 — address (compact AddressBook, checkout variant).
    await page.getByTestId("address-add-toggle").click();
    await page.getByTestId("address-line1").fill("12 Connaught Place");
    await page.getByLabel("City", {exact: true}).fill("New Delhi");
    await page.getByLabel("State", {exact: true}).fill("Delhi");
    await page.getByTestId("address-pincode").fill(FRESH_PINCODE);
    await page.getByTestId("address-save").click();
    await expect(page.getByTestId("address-card").first()).toBeVisible();

    // Fresh-tier pincode → deliver here advances to the slot step.
    await page.getByTestId("address-deliver-here").first().click();
    await expect(page.getByTestId("slot-option").first()).toBeVisible();

    // Step 2 — slot (today/tomorrow × morning/evening).
    await page.getByTestId("slot-option").first().click();
    await page.getByTestId("slot-continue").click();

    // Step 3 — server-priced summary. A real /cart/validate ran; the
    // total must be a non-zero rupee amount (price + delivery fee).
    const total = page.getByTestId("checkout-total");
    await expect(total).toBeVisible();
    await expect(total).toHaveText(/₹\s*[\d,]+/);
    expect((await total.textContent())?.trim()).not.toBe("₹0");
    expect(Number((await total.textContent())?.replace(/[₹,\s]/g, "") ?? "0")).toBeGreaterThan(0);

    // begin_checkout fired after the first successful validate.
    const beginEvents = await page.evaluate(() =>
      (window as unknown as {dataLayer?: Array<{event: string}>}).dataLayer?.filter(
        (e) => e.event === "begin_checkout",
      ),
    );
    expect(beginEvents?.length ?? 0).toBeGreaterThanOrEqual(1);

    // Pay — the fake popup invokes the real handler with a real signature;
    // create-order and verify both run for real server-side.
    await page.getByTestId("checkout-pay").click();
    await expect(page).toHaveURL(/\/en\/checkout\/success\?orderId=.+/, {
      timeout: 15_000,
    });

    // Receipt: confirmed + paid + non-zero total.
    await expect(page.getByTestId("order-status")).toHaveText(/confirmed/i);
    await expect(page.getByTestId("order-detail-total")).toHaveText(/₹\s*[\d,]+/);
    const receiptTotal = Number(
      ((await page.getByTestId("order-detail-total").textContent()) ?? "").replace(
        /[₹,\s]/g,
        "",
      ),
    );
    expect(receiptTotal).toBeGreaterThan(0);
    // Payment state renders from the fetched order (OrderDetail island).
    await expect(page.locator("section, div").filter({hasText: /paid/i}).first()).toBeVisible();

    // purchase hit the dataLayer with the real order id.
    const purchase = await page.evaluate(() => {
      const url = new URL(window.location.href);
      const orderId = url.searchParams.get("orderId");
      const events = (window as unknown as {dataLayer?: Array<Record<string, unknown>>})
        .dataLayer;
      return {
        orderId,
        purchases: (events ?? []).filter((e) => e.event === "purchase"),
      };
    });
    expect(purchase.purchases.length).toBe(1);
    expect(purchase.purchases[0]!.orderId).toBe(purchase.orderId);

    // Cart cleared (CartContext persisted the empty list).
    const savedCart = await page.evaluate(() => localStorage.getItem("mithai-cart-v1"));
    expect(JSON.parse(savedCart ?? "[]")).toEqual([]);
  });
});
