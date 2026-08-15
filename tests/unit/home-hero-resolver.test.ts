// tests/unit/home-hero-resolver.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveHomeHeroSlides } from "@/lib/home-hero";

// Mock payload-client so we control findGlobal + findByID behaviour.
vi.mock("@/lib/payload-client", () => ({
  getPayload: vi.fn(),
}));

import { getPayload } from "@/lib/payload-client";

type MockPayload = {
  findGlobal: ReturnType<typeof vi.fn>;
  findByID: ReturnType<typeof vi.fn>;
};

function mockPayload(overrides: Partial<MockPayload> = {}): MockPayload {
  return {
    findGlobal: vi.fn(),
    findByID: vi.fn(),
    ...overrides,
  };
}

const EMPTY = {slides: [], autoplayMs: 5000};

describe("resolveHomeHeroSlides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when global is empty", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({ slides: [] }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result).toEqual(EMPTY);
  });

  // Regression: the real Local API populates polymorphic relationships to
  // depth 2, so findGlobal hands back the FULL product doc as `value`, not
  // the bare id. Passing the doc to findByID threw and the slide silently
  // dropped — the carousel never rendered despite a curated global.
  it("extracts the id when findGlobal populates the product relationship", async () => {
    const doc = {
      id: "m1",
      name: "Kaju Katli",
      slug: "kaju-katli",
      images: [{ image: { url: "u", alt: "alt" } }],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            { product: { relationTo: "mithai-products", value: doc } },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(doc),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].id).toBe("m1");
    const payload = await (getPayload as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: "mithai-products",
      id: "m1",
    });
  });

  it("returns empty result when global has no slides field", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({}),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result).toEqual(EMPTY);
  });

  it("resolves mithai product with array images field", async () => {
    const mithaiDoc = {
      id: "mithai-1",
      name: "Kaju Katli",
      slug: "kaju-katli",
      displayPrice: "₹800 / 500g",
      images: [
        {
          image: {
            url: "https://cdn.test/kaju.jpg",
            alt: "Kaju Katli",
          },
        },
      ],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: {
                relationTo: "mithai-products",
                value: "mithai-1",
              },
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(mithaiDoc),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toEqual({
      id: "mithai-1",
      collection: "mithai-products",
      name: "Kaju Katli",
      priceLabel: "₹800 / 500g",
      image: "https://cdn.test/kaju.jpg",
      imageAlt: "Kaju Katli",
      href: "/mithai/kaju-katli",
    });
  });

  it("resolves qsr product with single image field and no price", async () => {
    const qsrDoc = {
      id: "qsr-1",
      name: "Masala Chai",
      slug: "masala-chai",
      image: { url: "https://cdn.test/chai.jpg", alt: "Chai" },
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: {
                relationTo: "qsr-menu-items",
                value: "qsr-1",
              },
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(qsrDoc),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toEqual({
      id: "qsr-1",
      collection: "qsr-menu-items",
      name: "Masala Chai",
      priceLabel: undefined,
      image: "https://cdn.test/chai.jpg",
      imageAlt: "Chai",
      href: "/qsr/masala-chai",
    });
  });

  it("uses captionOverride when present", async () => {
    const doc = {
      id: "m1",
      name: "Original Name",
      slug: "orig",
      images: [{ image: { url: "u", alt: "alt" } }],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            {
              product: { relationTo: "mithai-products", value: "m1" },
              captionOverride: "Hero Copy",
            },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(doc),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides[0].name).toBe("Hero Copy");
  });

  it("derives the href slug for slugless collections (snacks/qsr/merch)", async () => {
    // snack-products has no `slug` field — the web PDP URL derives from the
    // name. Before the derivation, every non-mithai slide silently dropped.
    const snackDoc = {
      id: "s1",
      name: "Aloo Bhujia (Standy)",
      images: [{ image: { url: "https://cdn.test/bhujia.jpg", alt: "Bhujia" } }],
      _status: "published",
    };
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            { product: { relationTo: "snack-products", value: "s1" } },
          ],
        }),
        findByID: vi.fn().mockResolvedValue(snackDoc),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].href).toBe("/snacks/aloo-bhujia-standy");
  });

  it("skips slides when product fetch throws", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [
            { product: { relationTo: "mithai-products", value: "x" } },
            { product: { relationTo: "mithai-products", value: "y" } },
          ],
        }),
        findByID: vi.fn()
          .mockRejectedValueOnce(new Error("deleted"))
          .mockResolvedValueOnce({
            id: "y",
            name: "OK",
            slug: "ok",
            images: [{ image: { url: "u", alt: "alt" } }],
            _status: "published",
          }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].id).toBe("y");
  });

  it("skips slides when product has no image", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "qsr-menu-items", value: "q1" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "q1",
          name: "No Image Item",
          slug: "noimg",
          image: undefined,
          _status: "published",
        }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toEqual([]);
  });

  it("skips draft products", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "mithai-products", value: "d" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "d",
          name: "Draft",
          slug: "draft",
          images: [{ image: { url: "u", alt: "alt" } }],
          _status: "draft",
        }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.slides).toEqual([]);
  });

  it("returns empty when findGlobal throws", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockRejectedValue(new Error("DB down")),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result).toEqual(EMPTY);
  });

  it("passes locale through to payload.findByID for localized product name", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "mithai-products", value: "m1" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "m1",
          name: "काजू कतली",
          slug: "kaju-katli",
          images: [{ image: { url: "u", alt: "alt" } }],
          _status: "published",
        }),
      })
    );
    const result = await resolveHomeHeroSlides("hi");
    expect(result.slides[0].name).toBe("काजू कतली");
    const call = (getPayload as ReturnType<typeof vi.fn>).mock.results[0]
      .value;
    const payload = await call;
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: "mithai-products",
      id: "m1",
      locale: "hi",
    });
  });

  it("omits locale from findByID when not provided", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          slides: [{ product: { relationTo: "mithai-products", value: "m1" } }],
        }),
        findByID: vi.fn().mockResolvedValue({
          id: "m1",
          name: "Kaju Katli",
          slug: "kaju-katli",
          images: [{ image: { url: "u", alt: "alt" } }],
          _status: "published",
        }),
      })
    );
    await resolveHomeHeroSlides();
    const payload = await (getPayload as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: "mithai-products",
      id: "m1",
    });
  });

  it("returns autoplayMs from global when set", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          autoplayMs: 7000,
          slides: [],
        }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.autoplayMs).toBe(7000);
  });

  it("defaults autoplayMs to 5000 when global field missing", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({ slides: [] }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.autoplayMs).toBe(5000);
  });

  it("clamps autoplayMs below 3000 up to 3000", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          autoplayMs: 1000,
          slides: [],
        }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.autoplayMs).toBe(3000);
  });

  it("clamps autoplayMs above 15000 down to 15000", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({
          autoplayMs: 60000,
          slides: [],
        }),
      })
    );
    const result = await resolveHomeHeroSlides();
    expect(result.autoplayMs).toBe(15000);
  });
});
