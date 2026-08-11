// collections/SnackProducts.ts
// STUB — Task 7 will flesh this out with the full savory-snack product
// schema. Registered here as a minimal collection so Stories.relatedProducts
// can resolve its relationship target. See MithaiProducts.ts for the same
// pattern.
import type { CollectionConfig } from "payload";

export const SnackProducts: CollectionConfig = {
  slug: "snack-products",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [{ name: "name", type: "text", required: true }],
};
