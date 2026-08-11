// collections/MithaiProducts.ts
// STUB — Task 7 will flesh this out with the full mithai product schema
// (variants, pricing, ingredients, etc.). Registered here as a minimal
// collection so that brand collections (Stories.relatedProducts,
// Karigars.specialties, Occasions.recommendedProducts) can resolve their
// relationship targets during Payload config sanitization.
//
// When Task 7 expands this, it should keep the slug "mithai-products" and
// replace this file in place.
import type { CollectionConfig } from "payload";

export const MithaiProducts: CollectionConfig = {
  slug: "mithai-products",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [{ name: "name", type: "text", required: true }],
};
