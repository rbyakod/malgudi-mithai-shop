// Integration test: brand collections registered in payload.config.ts.
// Verifies the Stories collection can create + read a record end-to-end
// against the local MongoDB instance.
//
// Env: MONGODB_URI must point at a live MongoDB. .env.local provides it for
// `next dev`; Vitest doesn't auto-load .env.local, so tests/setup-integration.ts
// handles that and runs before this file.
import { describe, it, expect } from "vitest";
import { getPayload } from "@/lib/payload-client";

describe("brand collections", () => {
  it("creates and reads a story", async () => {
    const payload = await getPayload();
    // The slug is unique and the shared local test DB persists between runs,
    // so clear any record a previous (possibly crashed) run left behind —
    // otherwise the create below trips the duplicate-slug validator.
    const stale = await payload.find({
      collection: "stories",
      where: { slug: { equals: "jhajjar-farm-story" } },
      limit: 1,
    });
    if (stale.docs.length > 0 && stale.docs[0].id) {
      await payload.delete({
        collection: "stories",
        id: String(stale.docs[0].id),
      });
    }
    const created = await payload.create({
      collection: "stories",
      data: {
        title: "Jhajjar Farm Story",
        slug: "jhajjar-farm-story",
        pillar: "farm",
        // locale is enforced by the brief but is optional at the schema level;
        // pass it so the test mirrors the documented contract.
        locale: "en",
      },
    });
    expect(created.title).toBe("Jhajjar Farm Story");
    expect(created.slug).toBe("jhajjar-farm-story");
  });
});
