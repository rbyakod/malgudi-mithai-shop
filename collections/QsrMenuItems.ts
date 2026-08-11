// collections/QsrMenuItems.ts
// STUB — Task 7 will flesh this out with the full QSR (quick-service
// restaurant) menu item schema. Registered here as a minimal collection so
// Stories.relatedProducts can resolve its relationship target. See
// MithaiProducts.ts for the same pattern.
import type { CollectionConfig } from "payload";

export const QsrMenuItems: CollectionConfig = {
  slug: "qsr-menu-items",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [{ name: "name", type: "text", required: true }],
};
