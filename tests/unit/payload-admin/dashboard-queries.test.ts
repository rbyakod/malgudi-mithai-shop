// Tests for dashboard query helpers. Mocks global.fetch; verifies URL
// construction (filter params), response shape mapping, and error swallowing
// in fetchCatalogCounts.
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {
  fetchRecentLeads,
  updateLeadStatus,
  fetchMithaiByFreshness,
  fetchPendingStories,
  fetchCatalogCounts,
} from "@/components/payload-admin/lib/dashboard-queries";

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as unknown as Response;
}

describe("dashboard-queries", () => {
  const fetchSpy = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchSpy.mockReset();
    vi.restoreAllMocks();
  });

  describe("fetchRecentLeads", () => {
    it("builds URL with default limit=5, sort=-createdAt, depth=0", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({docs: [], totalDocs: 0})
      );
      await fetchRecentLeads();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("/api/leads?limit=5&sort=-createdAt&depth=0");
      expect(init).toMatchObject({credentials: "same-origin"});
    });

    it("honors custom limit", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({docs: [], totalDocs: 0})
      );
      await fetchRecentLeads(10);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "/api/leads?limit=10&sort=-createdAt&depth=0"
      );
    });

    it("maps response.docs to LeadRow[]", async () => {
      const docs = [
        {
          id: "lead-1",
          contact: {name: "Ravi", email: "r@x.com", phone: "+919999999999"},
          status: "new",
          createdAt: "2026-08-10T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValueOnce(
        mockResponse({docs, totalDocs: 1})
      );
      const result = await fetchRecentLeads();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "lead-1",
        name: "Ravi",
        email: "r@x.com",
        phone: "+919999999999",
        status: "new",
        createdAt: "2026-08-10T00:00:00Z",
      });
    });

    it("sends Accept: application/json header", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({docs: [], totalDocs: 0})
      );
      await fetchRecentLeads();
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(init.headers).toMatchObject({Accept: "application/json"});
    });

    it("handles missing contact group gracefully", async () => {
      const docs = [
        {
          id: "lead-2",
          status: "contacted",
          createdAt: "2026-08-10T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValueOnce(
        mockResponse({docs, totalDocs: 1})
      );
      const result = await fetchRecentLeads();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "lead-2",
        name: "",
        email: undefined,
        status: "contacted",
      });
    });

    it("throws on non-ok response", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({}, false, 500));
      await expect(fetchRecentLeads()).rejects.toThrow(/500/);
    });

    it("patches lead status", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({id: "lead-1", status: "won"}));
      await updateLeadStatus("lead-1", "won");
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("/api/leads/lead-1");
      expect(init).toMatchObject({
        method: "PATCH",
        credentials: "same-origin",
      });
      expect(JSON.parse(String((init as RequestInit).body))).toEqual({status: "won"});
    });
  });

  describe("fetchMithaiByFreshness", () => {
    it("builds URL with published filter, limit=20, depth=0", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({docs: []}));
      await fetchMithaiByFreshness();
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "/api/mithai-products?limit=20&depth=0&sort=-updatedAt&where[_status][equals]=published"
      );
    });

    it("groups docs by freshnessStatus", async () => {
      const docs = [
        {
          id: "m1",
          name: "Kaju Katli",
          freshnessStatus: "made-daily",
        },
        {
          id: "m2",
          name: "Motichoor Laddu",
          freshnessStatus: "made-to-order",
        },
        {
          id: "m3",
          name: "Frozen Mithai",
          freshnessStatus: "batch-frozen",
        },
        {
          id: "m4",
          name: "Another Daily",
          freshnessStatus: "made-daily",
        },
      ];
      fetchSpy.mockResolvedValueOnce(mockResponse({docs}));
      const result = await fetchMithaiByFreshness();
      expect(result["made-daily"]).toHaveLength(2);
      expect(result["made-to-order"]).toHaveLength(1);
      expect(result["batch-frozen"]).toHaveLength(1);
      expect(result["made-daily"][0].name).toBe("Kaju Katli");
    });

    it("drops docs with unknown/missing freshnessStatus", async () => {
      const docs = [
        {id: "m1", name: "No Freshness"},
        {id: "m2", name: "Bad Value", freshnessStatus: "unknown"},
      ];
      fetchSpy.mockResolvedValueOnce(mockResponse({docs}));
      const result = await fetchMithaiByFreshness();
      expect(result["made-daily"]).toHaveLength(0);
      expect(result["made-to-order"]).toHaveLength(0);
      expect(result["batch-frozen"]).toHaveLength(0);
    });

    it("always returns all three buckets even when empty", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({docs: []}));
      const result = await fetchMithaiByFreshness();
      expect(result).toHaveProperty("made-daily");
      expect(result).toHaveProperty("made-to-order");
      expect(result).toHaveProperty("batch-frozen");
      expect(result["made-daily"]).toEqual([]);
    });
  });

  describe("fetchPendingStories", () => {
    it("builds URL with draft filter + draft=true", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({docs: []}));
      await fetchPendingStories();
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "/api/stories?limit=5&sort=-updatedAt&depth=0&where[_status][equals]=draft&draft=true"
      );
    });

    it("honors custom limit", async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({docs: []}));
      await fetchPendingStories(3);
      expect(fetchSpy.mock.calls[0][0]).toBe(
        "/api/stories?limit=3&sort=-updatedAt&depth=0&where[_status][equals]=draft&draft=true"
      );
    });

    it("maps response.docs to StoryRow[]", async () => {
      const docs = [
        {
          id: "s1",
          title: "Farm Story",
          pillar: "farm",
          updatedAt: "2026-08-09T00:00:00Z",
        },
      ];
      fetchSpy.mockResolvedValueOnce(mockResponse({docs}));
      const result = await fetchPendingStories();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "s1",
        title: "Farm Story",
        pillar: "farm",
      });
    });
  });

  describe("fetchCatalogCounts", () => {
    it("uses Promise.all fan-out across 5 collections", async () => {
      fetchSpy.mockResolvedValue(mockResponse({totalDocs: 7}));
      await fetchCatalogCounts();
      expect(fetchSpy).toHaveBeenCalledTimes(5);
      const urls = fetchSpy.mock.calls.map(c => c[0]);
      expect(urls).toEqual([
        "/api/mithai-products?limit=0&depth=0",
        "/api/qsr-menu-items?limit=0&depth=0",
        "/api/snack-products?limit=0&depth=0",
        "/api/merch-products?limit=0&depth=0",
        "/api/gift-boxes?limit=0&depth=0",
      ]);
    });

    it("returns totalDocs per collection", async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse({totalDocs: 5}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 10}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 3}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 1}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 8}));
      const result = await fetchCatalogCounts();
      expect(result).toEqual({
        "mithai-products": 5,
        "qsr-menu-items": 10,
        "snack-products": 3,
        "merch-products": 1,
        "gift-boxes": 8,
      });
    });

    it("swallows per-collection errors (returns null on failure)", async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse({totalDocs: 5}))
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(mockResponse({totalDocs: 3}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 1}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 8}));
      const result = await fetchCatalogCounts();
      expect(result).toEqual({
        "mithai-products": 5,
        "qsr-menu-items": null,
        "snack-products": 3,
        "merch-products": 1,
        "gift-boxes": 8,
      });
    });

    it("swallows non-ok responses too (returns null)", async () => {
      fetchSpy
        .mockResolvedValueOnce(mockResponse({totalDocs: 5}))
        .mockResolvedValueOnce(mockResponse({}, false, 500))
        .mockResolvedValueOnce(mockResponse({totalDocs: 3}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 1}))
        .mockResolvedValueOnce(mockResponse({totalDocs: 8}));
      const result = await fetchCatalogCounts();
      expect(result["qsr-menu-items"]).toBeNull();
      expect(result["mithai-products"]).toBe(5);
    });

    it("returns null for ALL on total failure (does not throw)", async () => {
      fetchSpy.mockRejectedValue(new Error("offline"));
      const result = await fetchCatalogCounts();
      expect(result).toEqual({
        "mithai-products": null,
        "qsr-menu-items": null,
        "snack-products": null,
        "merch-products": null,
        "gift-boxes": null,
      });
    });
  });
});
