// tests/unit/cross-sell.test.ts
// lib/verticals/crossSell.ts — the pure picker behind the mithai PDP
// cross-sell rail (Batch 8): exclude self, drop uncardable docs, uploaded
// media first (stable), cap at 4.

import {describe, it, expect} from "vitest";
import {pickCrossSell} from "@/lib/verticals/crossSell";

type Doc = {
  id: number;
  name: string;
  slug: string;
  images?: Array<{image?: {url?: string} | string} | null> | null;
};

const withImage = (id: number, name: string, slug: string): Doc => ({
  id,
  name,
  slug,
  images: [{image: {url: `/media/${slug}.jpg`}}],
});

const bare = (id: number, name: string, slug: string): Doc => ({
  id,
  name,
  slug,
  images: [],
});

describe("pickCrossSell", () => {
  it("excludes the current product by slug", () => {
    const docs = [
      withImage(1, "Kaju Katli", "kaju-katli"),
      withImage(2, "Badam Burfi", "badam-burfi"),
    ];
    const picks = pickCrossSell(docs, "kaju-katli", 4);
    expect(picks.map((d) => d.slug)).toEqual(["badam-burfi"]);
  });

  it("caps the rail at the limit (default 4)", () => {
    const docs = Array.from({length: 9}, (_, i) =>
      withImage(i + 1, `Sweet ${i + 1}`, `sweet-${i + 1}`),
    );
    expect(pickCrossSell(docs, "none")).toHaveLength(4);
    expect(pickCrossSell(docs, "none", 2)).toHaveLength(2);
  });

  it("orders docs with uploaded media ahead of bare docs, stably", () => {
    const docs = [
      bare(1, "A", "a"),
      withImage(2, "B", "b"),
      bare(3, "C", "c"),
      withImage(4, "D", "d"),
      bare(5, "E", "e"),
    ];
    const picks = pickCrossSell(docs, "self");
    expect(picks.map((d) => d.slug)).toEqual(["b", "d", "a", "c"]);
  });

  it("drops docs without a name or slug (nothing to card or link)", () => {
    const docs = [
      withImage(1, "A", "a"),
      {id: 2, name: "", slug: "b", images: []},
      {id: 3, name: "C", slug: "", images: []},
      {id: 4, name: "", slug: "", images: []},
    ];
    expect(pickCrossSell(docs, "self").map((d) => d.slug)).toEqual(["a"]);
  });

  it("does not mutate the input array (the caller's order survives)", () => {
    const docs = [bare(1, "A", "a"), withImage(2, "B", "b")];
    pickCrossSell(docs, "self");
    expect(docs.map((d) => d.slug)).toEqual(["a", "b"]);
  });

  it("treats unpopulated image ids as media-less", () => {
    // depth 0 fetches leave the upload as a bare id string — the picker
    // must not mistake that for renderable media.
    const docs: Doc[] = [
      {id: 1, name: "A", slug: "a", images: [{image: "665f0c1e2ab"}]},
      withImage(2, "B", "b"),
    ];
    expect(pickCrossSell(docs, "self").map((d) => d.slug)).toEqual(["b", "a"]);
  });

  it("returns [] when nothing survives", () => {
    expect(pickCrossSell([], "self")).toEqual([]);
    expect(
      pickCrossSell([withImage(1, "Only One", "only-one")], "only-one"),
    ).toEqual([]);
  });
});
