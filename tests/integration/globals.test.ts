// Integration test: Payload globals (Task 8).
// Verifies all 5 globals are registered and accessible via Local API.
//
// Env: MONGODB_URI must point at a live MongoDB. .env.local provides it for
// `next dev`; Vitest doesn't auto-load .env.local, so tests/setup-integration.ts
// handles that and runs before this file.
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("globals", () => {
  it("finds and updates brand-settings global", async () => {
    const payload = await getPayload();

    // Find should return default values or empty object
    const found = await payload.findGlobal({ slug: "brand-settings" });
    expect(found).toBeDefined();

    // Update with test data
    const updated = await payload.updateGlobal({
      slug: "brand-settings",
      data: { brandName: "Test Brand" },
    });
    expect(updated.brandName).toBe("Test Brand");

    // Re-fetch and verify persistence
    const refetched = await payload.findGlobal({ slug: "brand-settings" });
    expect(refetched.brandName).toBe("Test Brand");
  });

  it("finds nav-settings global", async () => {
    const payload = await getPayload();
    const found = await payload.findGlobal({ slug: "nav-settings" });
    expect(found).toBeDefined();
  });

  it("finds theme-settings global", async () => {
    const payload = await getPayload();
    const found = await payload.findGlobal({ slug: "theme-settings" });
    expect(found).toBeDefined();
  });

  it("finds analytics-settings global", async () => {
    const payload = await getPayload();
    const found = await payload.findGlobal({ slug: "analytics-settings" });
    expect(found).toBeDefined();
  });

  it("finds store-settings global", async () => {
    const payload = await getPayload();
    const found = await payload.findGlobal({ slug: "store-settings" });
    expect(found).toBeDefined();
  });
});
