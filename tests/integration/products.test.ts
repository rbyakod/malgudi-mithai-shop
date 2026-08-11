// Integration test: 5 product collections registered in payload.config.ts
// (Task 7). Verifies each vertical can create + read a record end-to-end
// against the local MongoDB instance, and that the mithai schema exposes
// the brief-mandated discriminators (family, freshnessStatus, displayPrice).
//
// Env: MONGODB_URI must point at a live MongoDB. tests/setup-integration.ts
// loads .env.local before this file runs.
//
// Test isolation: mithai-products enforces a unique `slug`. The full suite
// may be re-run against a DB that already has a `kaju-katli` row (seed, or
// a previous test invocation). We append a per-run suffix to the slug to
// dodge the uniqueness violation and keep the test idempotent at the DB
// level. The `family` / `freshnessStatus` / `displayPrice` assertions are
// the load-bearing ones — they prove the schema was expanded.
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("product collections", () => {
  it("creates a mithai product with required + discriminator fields", async () => {
    const payload = await getPayload();
    // Suffix to dodge the unique constraint across re-runs / seed collisions.
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `kaju-katli-test-${suffix}`;
    const p = await payload.create({
      collection: "mithai-products",
      data: {
        name: "Kaju Katli",
        slug,
        family: "classic",
        shelfLife: "7 days",
        displayPrice: "₹920 / 250g",
        freshnessStatus: "made-to-order",
      },
    });
    expect(p.slug).toBe(slug);
    // Discriminator fields from the brief — stub doesn't have these, so this
    // is the load-bearing assertion that proves the schema was expanded.
    expect(p.family).toBe("classic");
    expect(p.freshnessStatus).toBe("made-to-order");
    expect(p.displayPrice).toBe("₹920 / 250g");
  });

  it("creates a gift box", async () => {
    const payload = await getPayload();
    const p = await payload.create({
      collection: "gift-boxes",
      data: { name: "Heritage 16-piece Hamper", size: "16-piece" },
    });
    expect(p.name).toBe("Heritage 16-piece Hamper");
    expect(p.size).toBe("16-piece");
  });

  it("creates a qsr menu item", async () => {
    const payload = await getPayload();
    const p = await payload.create({
      collection: "qsr-menu-items",
      data: {
        name: "Chole Bhature",
        category: "chole-bhature",
        veg: true,
        spiceLevel: "medium",
      },
    });
    expect(p.name).toBe("Chole Bhature");
    expect(p.category).toBe("chole-bhature");
  });

  it("creates a snack product", async () => {
    const payload = await getPayload();
    const p = await payload.create({
      collection: "snack-products",
      data: { name: "Aloo Bhujia", category: "namkeen", weight: "200g", msrp: "₹60" },
    });
    expect(p.name).toBe("Aloo Bhujia");
    expect(p.category).toBe("namkeen");
  });

  it("creates a merch product", async () => {
    const payload = await getPayload();
    const p = await payload.create({
      collection: "merch-products",
      data: { name: "Mithai-Making Tool Set", type: "tool", availability: "enquiry-only" },
    });
    expect(p.name).toBe("Mithai-Making Tool Set");
    expect(p.type).toBe("tool");
  });
});
