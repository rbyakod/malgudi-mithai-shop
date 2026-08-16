// tests/e2e/cart-retention.spec.ts
// Conversion/retention batch — cart free-delivery threshold UI, the
// pan-India upsell rail, one-tap reorder, review capture, loyalty card,
// the consent-gated email nudge, and ?draft= restore.
//
// Server pieces that live in the parallel Batch A (POST /api/cart-drafts,
// GET /account/loyalty, POST /reviews) are intercepted with route.fulfill —
// these tests pin the UI contract, not the endpoints. The upsell rail and
// threshold estimate run against the REAL seeded catalog/dev server.
//
// Cart/tier state is seeded through localStorage via addInitScript (the
// same keys CartItems restores post-hydration). Reorder navigation to
// /cart is client-side, so the seeded storage is never re-applied mid-test.

import {test, expect, type Page, type Route} from "@playwright/test";

// ---- Shared fixtures ------------------------------------------------------------

type CartSeedItem = {
  id: string;
  name: string;
  priceLabel: string;
  quantity: number;
  image: string;
};

/** Seed cart + pincode tier before any document script runs. */
function seedCart(page: Page, items: CartSeedItem[], tier: "fresh" | "shelf") {
  void page.addInitScript(
    ({items, tier}: {items: CartSeedItem[]; tier: "fresh" | "shelf"}) => {
      window.localStorage.setItem("mithai-cart-v1", JSON.stringify(items));
      window.localStorage.setItem(
        "mithran-pincode-v1",
        JSON.stringify({
          pincode: "110001",
          tier,
          city: "New Delhi",
          slaDays: 1,
        }),
      );
    },
    {items, tier},
  );
}

/** Fake a signed-in customer (AuthContext restores this shape without a
 *  server round-trip; every /api/mobile/v1 call the islands make is
 *  intercepted in these tests). */
function seedSession(page: Page) {
  void page.addInitScript(() => {
    window.localStorage.setItem(
      "mishran-auth-v1",
      JSON.stringify({
        accessToken: "e2e-token",
        refreshToken: "e2e-refresh",
        customer: {
          id: "cust-e2e-1",
          phone: "+919999999999",
          name: "E2E Customer",
          email: null,
          locale: "en",
        },
      }),
    );
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

// The fabricated order — mixed packLabel/legacy items so reorder covers
// both id shapes; totals keep the receipt block quiet.
function orderBody(status: string) {
  return {
    data: {
      id: "order-e2e-00000001",
      items: [
        {
          productId: "prod-e2e-1",
          slug: "kaju-katli",
          name: "Kaju Katli",
          quantity: 1,
          unit: "500g",
          priceInPaise: 78000,
          image: "",
          packLabel: "500g",
        },
        {
          productId: "prod-e2e-2",
          slug: "motichoor-laddoo",
          name: "Motichoor Laddoo",
          quantity: 2,
          unit: "1 kg",
          priceInPaise: 81400,
          image: "",
        },
      ],
      totals: {
        itemsTotalInPaise: 240800,
        deliveryFeeInPaise: 4900,
        taxesInPaise: 0,
        discountInPaise: 0,
        totalInPaise: 245700,
      },
      status,
      paymentStatus: "paid",
      createdAt: "2026-08-01T10:00:00.000Z",
    },
  };
}

async function interceptOrderDetail(page: Page, status: string) {
  await page.route("**/api/mobile/v1/orders/order-e2e-1", (route) =>
    json(route, orderBody(status)),
  );
  // The account chrome (orders list, address book) may load on the way —
  // keep every other mobile-API call quiet and empty.
  await page.route("**/api/mobile/v1/orders?**", (route) =>
    json(route, {data: {items: []}}),
  );
  await page.route("**/api/mobile/v1/addresses", (route) =>
    json(route, {data: {items: []}}),
  );
}

// ---- B1: free-delivery threshold estimate ----------------------------------------

test.describe("cart estimate: free-delivery thresholds", () => {
  test("below the fresh threshold shows the progress row and the flat fee", async ({page}) => {
    seedCart(page, [
      {
        id: "seed-1",
        name: "Sev Badam Burfi",
        priceLabel: "₹499 / 500g",
        quantity: 1,
        image: "",
      },
    ], "fresh");
    await page.goto("/en/cart");

    // ₹499 against the ₹999 fresh default → exactly ₹500 to go, fee ₹49.
    await expect(page.getByTestId("cart-estimate-free-progress")).toHaveText(
      "Add ₹500 more for free delivery",
    );
    await expect(page.getByTestId("cart-estimate-fee")).toHaveText("₹49");
    await expect(page.getByTestId("cart-estimate-total")).toHaveText("₹548");
  });

  test("at/above the threshold shows FREE and hides the progress row", async ({page}) => {
    seedCart(page, [
      {
        id: "seed-1",
        name: "Kaju Katli",
        priceLabel: "₹1,562 / 1 kg",
        quantity: 1,
        image: "",
      },
    ], "fresh");
    await page.goto("/en/cart");

    await expect(page.getByTestId("cart-estimate-fee")).toHaveText("FREE");
    await expect(page.getByTestId("cart-estimate-free-progress")).toHaveCount(0);
    // Fee dropped from the total: subtotal is the total.
    await expect(page.getByTestId("cart-estimate-total")).toHaveText("₹1,562");
  });
});

// ---- B1: pan-India upsell rail ----------------------------------------------------

test.describe("cart upsell rail", () => {
  test("renders shelf candidates, hides in-cart products, and adds quietly", async ({page}) => {
    // A real PDP add first: kaju-katli (featured, made-to-order = shelf
    // candidate) must then disappear from the rail.
    await page.goto("/en/mithai/kaju-katli");
    await page.getByTestId("add-to-cart").click();
    await page.goto("/en/cart");

    const rail = page.getByTestId("cart-upsell-rail");
    await expect(rail).toBeVisible();

    // Seeded catalog: 40 shelf-stable products exist, so the rail carries
    // cards — and none of them is the product already in the cart.
    const cards = rail.locator("li");
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
    await expect(rail.getByText("Kaju Katli", {exact: true})).toHaveCount(0);

    // Quiet add → a second cart line + the tagged analytics event.
    const linesBefore = await page.getByTestId("cart-line").count();
    await rail.getByTestId("cart-upsell-add").first().click();
    await expect(page.getByTestId("cart-line")).toHaveCount(linesBefore + 1);

    const addEvents = await page.evaluate(() =>
      (window as unknown as {dataLayer?: Array<Record<string, unknown>>})
        .dataLayer?.filter(
          (e) => e.event === "add_to_cart" && e.source === "cart_upsell",
        ),
    );
    expect(addEvents?.length ?? 0).toBe(1);
    expect(addEvents![0]!.quantity).toBe(1);
  });
});

// ---- B2: one-tap reorder ----------------------------------------------------------

test.describe("order again", () => {
  test("maps composite ids for packLabel items and bare ids for legacy ones", async ({page}) => {
    seedSession(page);
    await interceptOrderDetail(page, "confirmed");
    await page.goto("/en/account/orders/order-e2e-1");

    await expect(page.getByTestId("order-detail-total")).toBeVisible();
    await page.getByTestId("order-again").click();
    await expect(page.getByTestId("order-again-added")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/cart$/, {timeout: 15_000});

    // Client-side navigation kept the seeded session; the cart now holds
    // both id shapes with the recomposed priceLabels.
    const saved = await page.evaluate(() =>
      localStorage.getItem("mithai-cart-v1"),
    );
    const items = JSON.parse(saved ?? "[]") as Array<{
      id: string;
      priceLabel: string;
      quantity: number;
    }>;
    expect(items.map((i) => i.id).sort()).toEqual([
      "prod-e2e-1:500g",
      "prod-e2e-2",
    ]);
    const composite = items.find((i) => i.id === "prod-e2e-1:500g")!;
    expect(composite.priceLabel).toBe("₹780 / 500g");
    expect(composite.quantity).toBe(1);
    const legacy = items.find((i) => i.id === "prod-e2e-2")!;
    expect(legacy.priceLabel).toBe("₹814 / 1 kg");
    expect(legacy.quantity).toBe(2);
  });
});

// ---- B4: review capture -----------------------------------------------------------

test.describe("review capture on delivered orders", () => {
  test("stars + note POST per item and show the moderation confirmation", async ({page}) => {
    seedSession(page);
    await interceptOrderDetail(page, "delivered");

    const posted: Array<Record<string, unknown>> = [];
    await page.route("**/api/mobile/v1/reviews", (route) => {
      if (route.request().method() === "POST") {
        posted.push(route.request().postDataJSON() as Record<string, unknown>);
      }
      return json(route, {data: {id: "review-1"}});
    });

    await page.goto("/en/account/orders/order-e2e-1");

    // One form per line item; no forms on the items list itself.
    const forms = page.getByTestId("review-form");
    await expect(forms).toHaveCount(2);

    // Rate the first item 4 stars with a note.
    await forms.first().getByTestId("review-star-4").click();
    await forms
      .first()
      .getByLabel("Your note (optional)")
      .fill("Silk-smooth, exactly like the shop.");
    await forms.first().getByRole("button", {name: "Submit review"}).click();

    // Success replaces only the submitted form.
    await expect(page.getByTestId("review-received")).toHaveCount(1);
    await expect(page.getByTestId("review-form")).toHaveCount(1);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      productId: "prod-e2e-1",
      rating: 4,
      body: "Silk-smooth, exactly like the shop.",
    });
  });

  test("no review surface on non-delivered orders", async ({page}) => {
    seedSession(page);
    await interceptOrderDetail(page, "dispatched");
    await page.goto("/en/account/orders/order-e2e-1");
    await expect(page.getByTestId("order-detail-total")).toBeVisible();
    await expect(page.getByTestId("review-form")).toHaveCount(0);
  });
});

// ---- B3: loyalty card -------------------------------------------------------------

test.describe("loyalty card", () => {
  async function interceptAccountBasics(page: Page) {
    await page.route("**/api/mobile/v1/orders?**", (route) =>
      json(route, {data: {items: []}}),
    );
    await page.route("**/api/mobile/v1/addresses", (route) =>
      json(route, {data: {items: []}}),
    );
  }

  test("shows the progress line below Silver", async ({page}) => {
    seedSession(page);
    await interceptAccountBasics(page);
    await page.route("**/api/mobile/v1/account/loyalty", (route) =>
      json(route, {
        data: {
          deliveredCount: 1,
          tier: null,
          silverAtDelivered: 2,
          goldAtDelivered: 5,
        },
      }),
    );
    await page.goto("/en/account");

    await expect(page.getByTestId("loyalty-card")).toBeVisible();
    await expect(page.getByTestId("loyalty-progress")).toHaveText(
      "1 delivered · 1 more for Silver",
    );
    await expect(page.getByTestId("loyalty-tier")).toHaveCount(0);
  });

  test("shows the tier chip once earned", async ({page}) => {
    seedSession(page);
    await interceptAccountBasics(page);
    await page.route("**/api/mobile/v1/account/loyalty", (route) =>
      json(route, {
        data: {
          deliveredCount: 3,
          tier: "silver",
          silverAtDelivered: 2,
          goldAtDelivered: 5,
        },
      }),
    );
    await page.goto("/en/account");

    await expect(page.getByTestId("loyalty-tier")).toHaveText("Silver member");
    await expect(page.getByTestId("loyalty-progress")).toHaveCount(0);
  });

  test("hides entirely when the endpoint is unavailable", async ({page}) => {
    seedSession(page);
    await interceptAccountBasics(page);
    await page.route("**/api/mobile/v1/account/loyalty", (route) =>
      json(route, {error: {code: "NOT_FOUND", message: "no loyalty"}}, 404),
    );
    await page.goto("/en/account");

    await expect(page.getByTestId("account-name")).toBeVisible();
    await expect(page.getByTestId("loyalty-card")).toHaveCount(0);
  });
});

// ---- B5: email nudge + draft restore ----------------------------------------------

test.describe("cart recovery", () => {
  test("email nudge POSTs the consent-gated capture and confirms", async ({page}) => {
    seedCart(page, [
      {
        id: "seed-1",
        name: "Kaju Katli",
        priceLabel: "₹920 / 250g",
        quantity: 1,
        image: "",
      },
    ], "fresh");

    const posted: Array<Record<string, unknown>> = [];
    await page.route("**/api/cart-drafts", (route) => {
      if (route.request().method() === "POST") {
        posted.push(route.request().postDataJSON() as Record<string, unknown>);
      }
      return json(route, {id: "draft-1"});
    });

    await page.goto("/en/cart");

    const nudge = page.getByTestId("cart-email-nudge");
    await expect(nudge).toBeVisible();
    // Submit is inert without consent.
    await page.getByTestId("cart-email-input").fill("e2e@example.com");
    await expect(
      nudge.getByRole("button", {name: "Save", exact: true}),
    ).toBeDisabled();
    await page.getByTestId("cart-email-consent").check();
    await nudge.getByRole("button", {name: "Save", exact: true}).click();

    await expect(page.getByTestId("cart-email-success")).toHaveText(
      "Saved — we'll keep an eye on your cart",
    );

    const capture = posted.find((b) => typeof b.email === "string");
    expect(capture).toMatchObject({
      email: "e2e@example.com",
      marketingConsent: true,
    });
    const sessionId = await page.evaluate(() =>
      localStorage.getItem("mishran-cart-session-v1"),
    );
    expect(capture!.sessionId).toBe(sessionId);
  });

  test("?draft= restores the cart, fires cart_restored, and strips the param", async ({page}) => {
    await page.route("**/api/cart-drafts/draft-e2e-1", (route) =>
      json(route, {
        items: [
          {
            id: "restored-1",
            name: "Restored Motichoor Laddoo",
            priceLabel: "₹814 / 1 kg",
            quantity: 2,
            image: "",
          },
        ],
        estimate: {subtotalInPaise: 162800, itemCount: 2, tier: null},
      }),
    );
    // The post-restore autosync must not 404 noisily.
    await page.route("**/api/cart-drafts", (route) =>
      json(route, {id: "draft-e2e-1"}),
    );

    await page.goto("/en/cart?draft=draft-e2e-1");

    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByText("Restored Motichoor Laddoo")).toBeVisible();
    await expect(page.getByTestId("cart-restored-note")).toBeVisible();
    await expect(page).toHaveURL(/\/en\/cart$/);

    const restored = await page.evaluate(() =>
      (
        window as unknown as {dataLayer?: Array<Record<string, unknown>>}
      ).dataLayer?.filter((e) => e.event === "cart_restored"),
    );
    expect(restored?.length ?? 0).toBe(1);
    expect(restored![0]!.itemCount).toBe(2);

    // The restored cart persisted for the next visit.
    const saved = await page.evaluate(() =>
      localStorage.getItem("mithai-cart-v1"),
    );
    expect(JSON.parse(saved ?? "[]")).toHaveLength(1);
  });
});
