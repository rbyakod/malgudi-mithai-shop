// collections/GiftBoxes.ts
// STUB — Task 7 will flesh this out with the full gift-box schema
// (builder config, contents, tier, etc.). Registered here as a minimal
// collection so Occasions.recommendedProducts and Stories.relatedProducts
// can resolve their relationship targets. See MithaiProducts.ts for the
// same pattern.
import type { CollectionConfig } from "payload";

export const GiftBoxes: CollectionConfig = {
  slug: "gift-boxes",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [{ name: "name", type: "text", required: true }],
};
