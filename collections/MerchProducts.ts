// collections/MerchProducts.ts
// STUB — Task 7 will flesh this out with the full merchandise product
// schema. Registered here as a minimal collection so Stories.relatedProducts
// can resolve its relationship target. See MithaiProducts.ts for the same
// pattern.
import type { CollectionConfig } from "payload";

export const MerchProducts: CollectionConfig = {
  slug: "merch-products",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [{ name: "name", type: "text", required: true }],
};
