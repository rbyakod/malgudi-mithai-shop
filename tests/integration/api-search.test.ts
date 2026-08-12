// Integration test: GET /api/search handler.
// Calls the extracted pure handler directly (no dev server / HTTP fetch) so it
// runs cleanly under Vitest. Verifies that the handler:
//   - Returns 200 with valid `{ results: SearchResult[] }` shape.
//   - Includes a mithai product with "kaju" in its name when queried for "kaju".
//   - Returns an empty `results` array for queries shorter than 2 characters.
//
// Self-sufficient: seeds a dedicated test mithai product with "kaju" in its
// name in `beforeAll` and deletes it in `afterAll` so the test does NOT depend
// on `npm run seed` having run. Cleanup is idempotent (deletes by slug).
//
// Env: MONGODB_URI from .env.local via tests/setup-integration.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { handleSearchGet, type SearchResult } from "@/lib/search-api";
import { getPayload } from "@/lib/payload-client";

// Unique slug so concurrent test runs do not collide and so cleanup is precise.
const TEST_SLUG = `test-search-kaju-${process.pid}-${Date.now()}`;
const TEST_NAME = "Kaju Katli (Search Test)";

describe("GET /api/search handler", () => {
  let createdId: string | undefined;

  beforeAll(async () => {
    const payload = await getPayload();
    // Clean up any stale doc with the same slug from a prior run that died
    // before afterAll fired. Then create fresh.
    const stale = await payload.find({
      collection: "mithai-products",
      where: { slug: { equals: TEST_SLUG } },
    });
    for (const doc of stale.docs) {
      await payload.delete({ collection: "mithai-products", id: doc.id });
    }

    const created = (await payload.create({
      collection: "mithai-products",
      data: {
        name: TEST_NAME,
        slug: TEST_SLUG,
        family: "classic",
        ingredients: "Cashew, sugar, ghee",
      },
    })) as { id: string };
    createdId = created.id;
  });

  afterAll(async () => {
    if (!createdId) return;
    const payload = await getPayload();
    try {
      await payload.delete({ collection: "mithai-products", id: createdId });
    } catch {
      // Already gone — ignore.
    }
  });

  it("returns 200 with valid { results: SearchResult[] } shape", async () => {
    const req = new Request("http://test/api/search?q=kaju&limit=10");
    const res = await handleSearchGet(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: SearchResult[] };
    expect(Array.isArray(body.results)).toBe(true);
    for (const r of body.results) {
      expect(typeof r.kind).toBe("string");
      expect(["string", "number"].includes(typeof r.id)).toBe(true);
      expect(typeof r.label).toBe("string");
      expect(typeof r.snippet).toBe("string");
    }
  });

  it("returns the seeded kaju mithai for q=kaju", async () => {
    const req = new Request("http://test/api/search?q=kaju&limit=20");
    const res = await handleSearchGet(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: SearchResult[] };
    const match = body.results.find(
      (r) => r.label?.toLowerCase().includes("kaju"),
    );
    expect(match).toBeDefined();
    expect(match?.kind).toBe("mithai");
  });

  it("returns empty results array for query shorter than 2 chars", async () => {
    const req = new Request("http://test/api/search?q=k&limit=10");
    const res = await handleSearchGet(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: SearchResult[] };
    expect(body.results).toEqual([]);
  });

  it("returns empty results array when q is missing", async () => {
    const req = new Request("http://test/api/search?limit=10");
    const res = await handleSearchGet(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: SearchResult[] };
    expect(body.results).toEqual([]);
  });
});
