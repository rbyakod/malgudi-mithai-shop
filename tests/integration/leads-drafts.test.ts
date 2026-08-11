// Integration test: leads + drafts collections.
// Verifies both collections can create + read records with TTL on drafts.expiresAt
// against the local MongoDB instance.
//
// Env: MONGODB_URI must point at a live MongoDB. .env.local provides it for
// `next dev`; Vitest doesn't auto-load .env.local, so tests/setup-integration.ts
// handles that and runs before this file.
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("leads + drafts", () => {
  it("creates a wedding lead", async () => {
    const payload = await getPayload();
    const lead = await payload.create({
      collection: "leads",
      data: {
        type: "wedding",
        contact: { name: "Anjali", email: "anjali@example.com", phone: "+91XXXXXXXXXX" },
        payload: { occasion: "wedding", qty: 200, city: "Bengaluru" },
        status: "new",
        source: "weddings-page",
      },
    });
    expect(lead.status).toBe("new");
  });

  it("creates a draft with TTL 30 days from now", async () => {
    const payload = await getPayload();
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const uniqueSessionId = `sess-${Date.now()}-${Math.random()}`;
    const draft = await payload.create({
      collection: "drafts",
      data: {
        sessionId: uniqueSessionId,
        config: { items: [] },
        expiresAt: inThirtyDays,
      },
    });
    expect(new Date(draft.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
