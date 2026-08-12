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

describe("resolveHomeHeroSlides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when global is empty", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({ slides: [] }),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("returns empty array when global has no slides field", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockResolvedValue({}),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
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
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual({
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
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0]).toEqual({
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
    const slides = await resolveHomeHeroSlides();
    expect(slides[0].name).toBe("Hero Copy");
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
    const slides = await resolveHomeHeroSlides();
    expect(slides).toHaveLength(1);
    expect(slides[0].id).toBe("y");
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
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
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
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });

  it("returns empty when findGlobal throws", async () => {
    (getPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPayload({
        findGlobal: vi.fn().mockRejectedValue(new Error("DB down")),
      })
    );
    const slides = await resolveHomeHeroSlides();
    expect(slides).toEqual([]);
  });
});
